'use strict';

const cpo = require('../index');

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d2 = cpo.device(process.env.CPO_TEST_DEVICE_2_ID, process.env.CPO_TEST_DEVICE_2_SECRET);

async function main() {
  await d2.listen((msg) => {
    console.log('Received:', msg);
  });
  console.log('Device 2 listening for messages...');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
