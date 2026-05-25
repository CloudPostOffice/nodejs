import cpo from '../index.mjs';

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d2 = cpo.postbox(process.env.CPO_TEST_POSTBOX_2_ID, process.env.CPO_TEST_POSTBOX_2_SECRET);

await d2.listen((msg) => {
  console.log('Received:', msg);
});

console.log('Postbox 2 listening for messages...');
