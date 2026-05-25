'use strict';

/**
 * Quick smoke test — create a postbox and send a message.
 * Run: node test/script.js
 */

const cpo = require('../index');

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

const d1 = cpo.postbox(process.env.CPO_TEST_POSTBOX_1_ID, process.env.CPO_TEST_POSTBOX_1_SECRET);

d1.listen((msg) => {
  console.log('Received:', msg);
});

d1.send({ to: process.env.CPO_TEST_POSTBOX_2_ID, msg: 'hello from script.js' })
  .then(() => console.log('Message sent successfully'))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
