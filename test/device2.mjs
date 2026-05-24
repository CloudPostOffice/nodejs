import cpo from '../index.mjs';

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d2 = cpo.device(process.env.CPO_TEST_DEVICE_2_ID, process.env.CPO_TEST_DEVICE_2_SECRET);

await d2.listen((msg) => {
  console.log('Received:', msg);
});

console.log('Device 2 listening for messages...');
