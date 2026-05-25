'use strict';

/**
 * Publishes a message to a named topic.
 * Run sub-test.js first so the subscriber is ready.
 *
 * Usage:
 *   CPO_BASE_URL=https://cloudpostoffice.com \
 *   CPO_TEST_POSTBOX_1_ID=proj-xxxx--postbox-1 \
 *   CPO_TEST_POSTBOX_1_SECRET=your-secret \
 *   node test/pub-test.js
 */

const cpo = require('../index');

cpo.configure({ baseUrl: process.env.CPO_BASE_URL || 'http://localhost:3000' });

async function main() {
  const d1 = cpo.postbox(process.env.CPO_TEST_POSTBOX_1_ID, process.env.CPO_TEST_POSTBOX_1_SECRET);

  try {
    await d1.publish('topic-news', 'message is->pub sub message from postbox 1');
    console.log('Published to topic: news');
    d1.disconnect();
  } catch (err) {
    console.error('Publish failed:', err.message);
    process.exit(1);
  }
}

main();
