'use strict';

const mqtt = require('mqtt');

const BROKER_PORT = 8883;
const CONNECT_TIMEOUT_MS = 15_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

// MQTT v5 reason codes that indicate an auth/token problem
const AUTH_ERROR_CODES = new Set([
  0x87, // Not Authorized
  0x8D, // Keep Alive Timeout (EMQX uses this when JWT expires mid-session)
  0x97, // Quota Exceeded (sometimes used for invalid token)
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Postbox {
  constructor(postboxId, postboxSecret, options = {}) {
    this._id = postboxId;
    this._secret = postboxSecret;
    this._baseUrl = options.baseUrl || 'https://cloudpostoffice.com';

    this._client = null;
    this._auth = null;
    this._accountRef = null;
    this._projectId = null;
    this._connectPromise = null;
    this._intentionalDisconnect = false;
    this._lastDisconnectReasonCode = null;

    // { topicFilter: string, callback: Function }[]
    this._subscriptions = [];
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  _validateTopicName(name) {
    if (!name || typeof name !== 'string') throw new Error('Topic name must be a non-empty string');
    if (name.includes('/'))  throw new Error(`Topic name must not contain "/": "${name}"`);
    if (name.includes('+'))  throw new Error(`Topic name must not contain "+": "${name}"`);
    if (name.includes('#'))  throw new Error(`Topic name must not contain "#": "${name}"`);
    if (name.includes('--')) throw new Error(`Topic name must not contain "--": "${name}"`);
  }

  /**
   * Send a message to another postbox on the same account/project.
   *
   * @param {{ to: string, msg: any }} options
   */
  async send({ to, msg }) {
    if (!to) throw new Error('send() requires a "to" field with the target postbox ID');
    await this._connect();
    const topic = this._topic(`postboxes/${to}`);
    const payload = JSON.stringify({ from: this._id, msg, ts: Date.now() });
    return this._publish(topic, payload);
  }

  /**
   * Register a callback for messages addressed to this postbox.
   * May be called multiple times to add multiple handlers.
   * Returns the postbox so calls can be chained.
   *
   * @param {Function} callback  fn(message) — message is { from, msg, ts }
   */
  async listen(callback) {
    await this._connect();
    const topic = this._topic(`postboxes/${this._id}`);
    await this._subscribe(topic, callback);
    return this;
  }

  /**
   * Publish a message to a named topic.
   *
   * @param {string} topicName
   * @param {any}    message
   */
  async publish(topicName, message) {
    this._validateTopicName(topicName);
    await this._connect();
    const topic = this._topic(`topic/${topicName}`);
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    return this._publish(topic, payload);
  }

  /**
   * Subscribe to a named topic.
   * Returns the postbox so calls can be chained.
   *
   * @param {string}   topicName
   * @param {Function} callback  fn(message, topicName)
   */
  async subscribe(topicName, callback) {
    this._validateTopicName(topicName);
    await this._connect();
    const topic = this._topic(`topic/${topicName}`);
    await this._subscribe(topic, (msg) => callback(topicName, msg));
    return this;
  }

  /**
   * Gracefully close the MQTT connection.
   */
  disconnect() {
    this._intentionalDisconnect = true;
    if (this._client) {
      this._client.end();
      this._client = null;
      this._connectPromise = null;
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  _connect() {
    if (this._connectPromise) return this._connectPromise;
    this._connectPromise = this._doConnect().catch((err) => {
      this._connectPromise = null;
      throw err;
    });
    return this._connectPromise;
  }

  async _doConnect() {
    const data = await this._authenticate();
    this._auth = data;
    const [accountRef, projectId] = data.clientId.split(':');
    this._accountRef = accountRef;
    this._projectId = projectId;
    await this._connectMqtt();
  }

  async _authenticate() {
    let response;
    try {
      response = await fetch(`${this._baseUrl}/api/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postboxId: this._id, postboxSecret: this._secret }),
      });
    } catch (networkError) {
      const err = new Error(`Network error during authentication: ${networkError.message}`);
      err.cause = networkError;
      throw err;
    }

    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || 'Authentication failed');
      err.status = response.status;
      throw err;
    }
    return data;
  }

  _connectMqtt() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`MQTT connection timed out for postbox "${this._id}"`)),
        CONNECT_TIMEOUT_MS
      );

      const client = mqtt.connect(`mqtts://${this._auth.broker}`, {
        port: BROKER_PORT,
        clientId: this._auth.clientId,
        username: this._id,
        password: this._auth.token,
        rejectUnauthorized: true,
        clean: false,           // persistent session — broker queues messages while offline
        reconnectPeriod: 0,     // we manage reconnection ourselves
        protocolVersion: 5,     // MQTT v5 for disconnect reason codes
      });

      client.once('connect', () => {
        clearTimeout(timer);
        this._client = client;
        this._setupClientHandlers(client);
        resolve();
      });

      client.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  _setupClientHandlers(client) {
    client.on('message', (incomingTopic, payload) => {
      let parsed;
      try { parsed = JSON.parse(payload.toString()); } catch { parsed = payload.toString(); }
      for (const { topicFilter, callback } of this._subscriptions) {
        if (topicFilter === incomingTopic) callback(parsed);
      }
    });

    client.on('disconnect', (packet) => {
      this._lastDisconnectReasonCode = packet?.reasonCode ?? null;
    });

    client.on('close', () => {
      if (!this._intentionalDisconnect) {
        this._handleUnexpectedDisconnect();
      }
    });
  }

  async _handleUnexpectedDisconnect() {
    let delay = BACKOFF_INITIAL_MS;

    while (!this._intentionalDisconnect) {
      await sleep(delay);
      delay = Math.min(delay * 2, BACKOFF_MAX_MS);

      try {
        if (AUTH_ERROR_CODES.has(this._lastDisconnectReasonCode)) {
          // Token expired — get a fresh one before reconnecting
          this._auth = await this._authenticate();
        }

        await this._reconnectMqtt();
        await this._resubscribeAll();
        this._lastDisconnectReasonCode = null;
        return;
      } catch {
        // keep retrying
      }
    }
  }

  _reconnectMqtt() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`MQTT reconnect timed out for postbox "${this._id}"`)),
        CONNECT_TIMEOUT_MS
      );

      // Update the password to the (potentially refreshed) token
      this._client.options.password = this._auth.token;
      this._client.reconnect();

      this._client.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });

      this._client.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async _resubscribeAll() {
    for (const { topicFilter } of this._subscriptions) {
      await new Promise((resolve, reject) => {
        this._client.subscribe(topicFilter, { qos: 1 }, (err) =>
          err ? reject(err) : resolve()
        );
      });
    }
  }

  _topic(subtopic) {
    return `${this._accountRef}/${this._projectId}/${subtopic}`;
  }

  _publish(topic, payload) {
    return new Promise((resolve, reject) => {
      this._client.publish(topic, payload, { qos: 1 }, (err) =>
        err ? reject(err) : resolve()
      );
    });
  }

  async _subscribe(topicFilter, callback) {
    await new Promise((resolve, reject) => {
      this._client.subscribe(topicFilter, { qos: 1 }, (err) =>
        err ? reject(err) : resolve()
      );
    });
    this._subscriptions.push({ topicFilter, callback });
  }
}

module.exports = Postbox;
