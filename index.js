'use strict';

const Postbox = require('./lib/Postbox');

let _options = { baseUrl: 'https://cloudpostoffice.com' };
let _defaultPostbox = null;

/**
 * Create a postbox handle. Automatically authenticates and connects to the
 * MQTT broker on first use — no manual setup required.
 *
 * The first postbox created becomes the default for top-level
 * cpo.publish() / cpo.subscribe() calls.
 *
 * @param   {string} postboxId
 * @param   {string} postboxSecret
 * @returns {Postbox}
 *
 * @example
 * const d1 = cpo.postbox('my-postbox-id', 'my-secret');
 * await d1.send({ to: 'other-postbox', msg: 'hello' });
 * await d1.listen(msg => console.log(msg));
 */
function postbox(postboxId, postboxSecret) {
  if (!postboxId || !postboxSecret) {
    throw new Error('postbox() requires both a postboxId and a postboxSecret');
  }
  const d = new Postbox(postboxId, postboxSecret, _options);
  if (!_defaultPostbox) _defaultPostbox = d;
  return d;
}

/**
 * Publish a message to a named topic using the default postbox.
 *
 * @param {string} topicName
 * @param {any}    message
 */
function publish(topicName, message) {
  if (!_defaultPostbox) throw new Error('Call cpo.postbox() before cpo.publish()');
  return _defaultPostbox.publish(topicName, message);
}

/**
 * Subscribe to a named topic using the default postbox.
 *
 * @param {string}   topicName
 * @param {Function} callback  fn(message, topicName)
 */
function subscribe(topicName, callback) {
  if (!_defaultPostbox) throw new Error('Call cpo.postbox() before cpo.subscribe()');
  return _defaultPostbox.subscribe(topicName, callback);
}

/**
 * Override SDK-level options (call before creating any postboxes).
 *
 * @param {{ baseUrl?: string }} options
 */
function configure(options = {}) {
  if (options.baseUrl !== undefined) {
    const url = options.baseUrl;
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
    if (!isLocalhost && !url.startsWith('https://')) {
      throw new Error('baseUrl must use https:// (http:// is only allowed for localhost)');
    }
  }
  Object.assign(_options, options);
}

module.exports = { postbox, publish, subscribe, configure };
