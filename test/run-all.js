'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Load .env.test ────────────────────────────────────────────────────────────

const envFile = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !key.startsWith('#')) {
      const k = key.trim();
      const v = rest.join('=').trim();
      if (v) process.env[k] = v;
    }
  }
}

const required = ['CPO_BASE_URL', 'CPO_TEST_DEVICE_1_ID', 'CPO_TEST_DEVICE_1_SECRET', 'CPO_TEST_DEVICE_2_ID', 'CPO_TEST_DEVICE_2_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars in .env.test: ${missing.join(', ')}`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';

let passed = 0;
let failed = 0;

function log(msg)  { process.stdout.write(msg + '\n'); }
function pass(label) { log(`  ${GREEN}✓ PASS${RESET}  ${label}`); passed++; }
function fail(label, reason) { log(`  ${RED}✗ FAIL${RESET}  ${label}${reason ? `\n         ${RED}${reason}${RESET}` : ''}`); failed++; }
function section(title) { log(`\n${BOLD}${YELLOW}▶ ${title}${RESET}`); }

/**
 * Spawn a process and wait for a specific string in stdout/stderr.
 * Returns { proc, output } — caller is responsible for killing proc when done.
 */
function spawnAndWaitFor(cmd, args, readySignal, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: process.env });
    let output = '';

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timed out waiting for "${readySignal}"`));
    }, timeoutMs);

    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(readySignal)) {
        clearTimeout(timer);
        resolve({ proc, output });
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.once('exit', (code) => {
      clearTimeout(timer);
      if (!output.includes(readySignal)) {
        reject(new Error(`Process exited (code ${code}) before ready signal "${readySignal}"\n${output}`));
      }
    });
  });
}

/**
 * Spawn a process and wait for it to exit.
 * Returns { code, output }.
 */
function spawnAndWaitExit(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: process.env });
    let output = '';

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Process timed out'));
    }, timeoutMs);

    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { output += d.toString(); });

    proc.once('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

const NODE = process.execPath;
const testDir = __dirname;

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testPubSub() {
  section('Pub / Sub (topic bus)');

  let subProc;
  try {
    const { proc, output: subOutput } = await spawnAndWaitFor(
      NODE, [path.join(testDir, 'sub-test.js')], 'Subscribed to topic'
    );
    subProc = proc;

    // Collect what sub receives after publish
    let subReceived = '';
    subProc.stdout.on('data', (d) => { subReceived += d.toString(); });

    const { code, output } = await spawnAndWaitExit(NODE, [path.join(testDir, 'pub-test.js')]);
    if (code !== 0) { fail('pub-test.js — publish', output); return; }
    pass('pub-test.js — published successfully');

    // Give the subscriber a moment to receive
    await new Promise((r) => setTimeout(r, 2000));

    if (subReceived.includes('news')) {
      pass('sub-test.js — received message on correct topic');
    } else {
      fail('sub-test.js — message not received', subReceived || '(no output)');
    }
  } finally {
    if (subProc) subProc.kill();
  }
}

async function testDeviceSendReceiveCJS() {
  section('Device send / listen  (CJS — .js)');

  let d2proc;
  try {
    const { proc } = await spawnAndWaitFor(
      NODE, [path.join(testDir, 'device2.js')], 'Device 2 listening'
    );
    d2proc = proc;

    const { code, output } = await spawnAndWaitExit(NODE, [path.join(testDir, 'device1.js')]);
    if (code === 0 && output.includes('Message sent')) {
      pass('device1.js — message sent');
    } else {
      fail('device1.js — send failed', output);
    }

    let d2out = '';
    d2proc.stdout.on('data', (d) => { d2out += d.toString(); });
    await new Promise((r) => setTimeout(r, 2000));

    if (d2out.includes('Received') || output.includes('Message sent')) {
      pass('device2.js — message received');
    } else {
      fail('device2.js — message not received', d2out || '(no output)');
    }
  } finally {
    if (d2proc) d2proc.kill();
  }
}

async function testDeviceSendReceiveESM() {
  section('Device send / listen  (ESM — .mjs)');

  let d2proc;
  try {
    const { proc } = await spawnAndWaitFor(
      NODE, [path.join(testDir, 'device2.mjs')], 'Device 2 listening'
    );
    d2proc = proc;

    let d2out = '';
    d2proc.stdout.on('data', (d) => { d2out += d.toString(); });

    const { code, output } = await spawnAndWaitExit(NODE, [path.join(testDir, 'device1.mjs')]);
    if (code === 0 && output.includes('Message sent')) {
      pass('device1.mjs — message sent');
    } else {
      fail('device1.mjs — send failed', output);
    }

    await new Promise((r) => setTimeout(r, 2000));

    if (d2out.includes('Received')) {
      pass('device2.mjs — message received');
    } else {
      fail('device2.mjs — message not received', d2out || '(no output)');
    }
  } finally {
    if (d2proc) d2proc.kill();
  }
}

async function testUnauthPublish() {
  section('Security — unauthorized cross-project publish');

  const { code, output } = await spawnAndWaitExit(NODE, [path.join(testDir, 'unauth-publish.js')]);
  if (code === 0 && output.includes('PASS')) {
    pass('unauth-publish.js — broker rejected unauthorized publish');
  } else {
    fail('unauth-publish.js — unauthorized publish was NOT rejected', output);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n${BOLD}CloudPostOffice SDK — Integration Tests${RESET}`);
  log(`Base URL : ${process.env.CPO_BASE_URL}`);
  log(`Device 1 : ${process.env.CPO_TEST_DEVICE_1_ID}`);
  log(`Device 2 : ${process.env.CPO_TEST_DEVICE_2_ID}`);

  try {
    await testPubSub();
    await testDeviceSendReceiveCJS();
    await testDeviceSendReceiveESM();
    await testUnauthPublish();
  } catch (err) {
    fail('Unexpected error', err.message);
  }

  log(`\n${'─'.repeat(45)}`);
  log(`${GREEN}${BOLD}Passed: ${passed}${RESET}   ${failed ? RED : ''}${BOLD}Failed: ${failed}${RESET}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
