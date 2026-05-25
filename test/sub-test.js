'use strict';

/**
 * Subscribes to a named topic and prints incoming messages.
 * Run this before pub-test.js.
 *
 * Usage:
 *   CPO_BASE_URL=https://cloudpostoffice.com \
 *   CPO_TEST_POSTBOX_2_ID=proj-xxxx--postbox-2 \
 *   CPO_TEST_POSTBOX_2_SECRET=your-secret \
 *   node test/sub-test.js
 */

const cpo = require('../index');

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

async function main() {
  const d2 = cpo.postbox(process.env.CPO_TEST_POSTBOX_2_ID, process.env.CPO_TEST_POSTBOX_2_SECRET);

  await d2.subscribe('topic-news', function(topic, msg) {
    console.log(topic, ':->', msg);
  });

  console.log('Subscribed to topic: news — waiting for messages...');
}

main().catch((err) => {
  console.error('Subscribe failed:', err.message);
  process.exit(1);
});
