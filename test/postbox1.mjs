import cpo from '../index.mjs';

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d1 = cpo.postbox(process.env.CPO_TEST_POSTBOX_1_ID, process.env.CPO_TEST_POSTBOX_1_SECRET);

try {

  await d1.send({ to: process.env.CPO_TEST_POSTBOX_2_ID, msg: 'Hello from Postbox 1 (ESM)!' });

  d1.disconnect();

  console.log('Message sent.');
} catch (err) {
  console.error('Failed to send:', err.message);
  process.exit(1);
}
