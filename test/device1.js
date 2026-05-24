'use strict';

const cpo = require('../index');

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d1 = cpo.device(process.env.CPO_TEST_DEVICE_1_ID, process.env.CPO_TEST_DEVICE_1_SECRET);

async function main() {
  try {

    await d1.send({ to: process.env.CPO_TEST_DEVICE_2_ID, msg: 'Hello from Device 1!' });

  d1.disconnect();
  
    console.log('Message sent.');
  } catch (err) {
    console.error('Failed to send:', err.message);
    process.exit(1);
  }
}

main();
