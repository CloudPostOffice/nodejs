'use strict';

/**
 * Tests that a legitimate device CANNOT publish to topics outside its project.
 * 
 * Authenticates as device-1 (gets a real JWT), then connects with a raw MQTT
 * client and tries to publish to a fake topic that is outside the allowed ACL.
 * 
 * Expected result: EMQX rejects the publish and disconnects the client.
 * If the publish succeeds, ACL enforcement is NOT working.
 * 
 * Usage:
 *   CPO_BASE_URL=https://cloudpostoffice.com \
 *   CPO_TEST_DEVICE_1_ID=proj-xxxx--device-1 \
 *   CPO_TEST_DEVICE_1_SECRET=your-secret \
 *   node test/unauth-publish.js
 */

const mqtt = require('mqtt');

const BASE_URL   = process.env.CPO_BASE_URL   || 'http://localhost:3000';
const DEVICE_ID  = process.env.CPO_TEST_DEVICE_1_ID;
const DEVICE_SECRET = process.env.CPO_TEST_DEVICE_1_SECRET;

if (!DEVICE_ID || !DEVICE_SECRET) {
  console.error('Set CPO_TEST_DEVICE_1_ID and CPO_TEST_DEVICE_1_SECRET');
  process.exit(1);
}

const FAKE_TOPIC = 'fake-account/fake-project/devices/victim-device';

async function authenticate() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: DEVICE_ID, deviceSecret: DEVICE_SECRET }),
    });
  } catch (err) {
    throw new Error(`Network error connecting to ${BASE_URL}: ${err.message}${err.cause ? ` (cause: ${err.cause.message})` : ''}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth failed (${res.status}): ${data.error}`);
  return data;
}

async function main() {
  console.log(`Authenticating as: ${DEVICE_ID}`);
  const { token, broker } = await authenticate();
  console.log(`Authenticated. Broker: ${broker}`);
  console.log(`Attempting to publish to fake topic: ${FAKE_TOPIC}`);

  const client = mqtt.connect(`mqtts://${broker}`, {
    port: 8883,
    clientId: `test-unauth-${Date.now()}`,
    username: DEVICE_ID,
    password: token,
    rejectUnauthorized: true,
    reconnectPeriod: 0,
    protocolVersion: 5,
    connectTimeout: 10_000,
  });

  let connected = false;

  client.once('connect', () => {
    connected = true;
    console.log('Connected to broker.');

    client.publish(FAKE_TOPIC, 'hacked', { qos: 1 }, (err) => {
      if (err) {
        console.log(`\n✓ PASS — publish rejected by broker: ${err.message}`);
        client.end();
        process.exit(0);
      } else {
        console.log('\n✗ FAIL — publish succeeded. ACL enforcement is NOT working!');
        client.end();
        process.exit(1);
      }
    });
  });

  client.on('disconnect', (packet) => {
    if (connected) {
      console.log(`\n✓ PASS — broker disconnected client (reason code: ${packet?.reasonCode ?? 'unknown'}). ACL enforced.`);
      process.exit(0);
    }
  });

  client.once('error', (err) => {
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  });

  setTimeout(() => {
    console.log('\n✗ FAIL — timed out waiting for broker response.');
    client.end();
    process.exit(1);
  }, 15_000);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
