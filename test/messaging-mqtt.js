'use strict';

/**
 * End-to-end messaging test.
 *
 * Device 1 publishes a message to a shared topic.
 * Device 2 receives it.
 *
 * Run: node test/messaging.js
 */

const CloudPostOffice = require('../index');
const mqtt = require('mqtt');

// Override with CPO_BASE_URL env var to point at a different server.
const BASE_URL = process.env.CPO_BASE_URL || 'http://localhost:3000';

const DEVICE_1 = { id: 'device-pgd7l', secret: 'nbthenf87wu31wok' };
const DEVICE_2 = { id: 'device-r2pgc', secret: '7y1nm0f5054bakx1' };

const BROKER_PORT = 8883;
const TIMEOUT_MS = 10_000;

/**
 * Build a full topic path from the clientId returned by authenticate().
 * clientId format: "{account_ref}:{project_id}:{deviceId}"
 */
function buildTopic(clientId, subtopic) {
  const [accountRef, projectId] = clientId.split(':');
  return `${accountRef}/${projectId}/${subtopic}`;
}

/**
 * Connect a device to the MQTT broker using its JWT token.
 */
function connectDevice({ deviceId, token, clientId, broker }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`MQTT connect timed out for ${deviceId}`)),
      TIMEOUT_MS
    );

    const client = mqtt.connect(`mqtts://${broker}`, {
      port: BROKER_PORT,
      clientId,
      username: deviceId,
      password: token,
      rejectUnauthorized: true,
    });

    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });

    client.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function run() {
  console.log('=== CloudPostOffice — device-to-device messaging test ===\n');
  console.log(`API: ${BASE_URL}`);
  console.log('');

  // Step 1: Authenticate both devices
  console.log('Authenticating devices...');
  const sdk = new CloudPostOffice({ baseUrl: BASE_URL });

  const [auth1, auth2] = await Promise.all([
    sdk.authenticate(DEVICE_1.id, DEVICE_1.secret),
    sdk.authenticate(DEVICE_2.id, DEVICE_2.secret),
  ]);

  console.log(`  Device 1 (${DEVICE_1.id}) — clientId: ${auth1.clientId}`);
  console.log(`  Device 2 (${DEVICE_2.id}) — clientId: ${auth2.clientId}`);

  // Step 2: Build the shared topic (both devices are on the same account/project)
  const topic = buildTopic(auth1.clientId, 'topic/test-channel');
  console.log(`\nUsing topic: ${topic}`);

  // Step 3: Connect both to the broker
  console.log('\nConnecting to MQTT broker...');
  const [client1, client2] = await Promise.all([
    connectDevice({ deviceId: DEVICE_1.id, ...auth1 }),
    connectDevice({ deviceId: DEVICE_2.id, ...auth2 }),
  ]);
  console.log('  Both devices connected.');

  // Step 4: Device 2 subscribes
  await new Promise((resolve, reject) => {
    client2.subscribe(topic, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
  });
  console.log(`  Device 2 subscribed.`);

  // Step 5: Arm the receive listener on device 2 before publishing
  const messageReceived = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for message on device 2')),
      TIMEOUT_MS
    );

    client2.once('message', (incomingTopic, payload) => {
      clearTimeout(timer);
      resolve({ topic: incomingTopic, message: JSON.parse(payload.toString()) });
    });
  });

  // Step 6: Device 1 publishes
  const outgoing = {
    from: DEVICE_1.id,
    text: 'Hello from device 1!',
    timestamp: new Date().toISOString(),
  };

  await new Promise((resolve, reject) => {
    client1.publish(topic, JSON.stringify(outgoing), { qos: 1 }, (err) =>
      err ? reject(err) : resolve()
    );
  });
  console.log(`\nDevice 1 published:`, outgoing);

  // Step 7: Wait for device 2 to receive it
  const result = await messageReceived;
  console.log(`Device 2 received on "${result.topic}":`, result.message);

  console.log('\n✓ Test passed — message delivered successfully.\n');

  client1.end();
  client2.end();
}

run().catch((err) => {
  console.error('\n✗ Test failed:', err.message);
  process.exit(1);
});
