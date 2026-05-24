'use strict';

const Device = require('./lib/Device');

let _options = { baseUrl: 'https://cloudpostoffice.com' };
let _defaultDevice = null;

/**
 * Create a device handle. Automatically authenticates and connects to the
 * MQTT broker on first use — no manual setup required.
 *
 * The first device created becomes the default for top-level
 * cpo.publish() / cpo.subscribe() calls.
 *
 * @param   {string} deviceId
 * @param   {string} deviceSecret
 * @returns {Device}
 *
 * @example
 * const d1 = cpo.device('my-device-id', 'my-secret');
 * await d1.send({ to: 'other-device', msg: 'hello' });
 * await d1.listen(msg => console.log(msg));
 */
function device(deviceId, deviceSecret) {
  if (!deviceId || !deviceSecret) {
    throw new Error('device() requires both a deviceId and a deviceSecret');
  }
  const d = new Device(deviceId, deviceSecret, _options);
  if (!_defaultDevice) _defaultDevice = d;
  return d;
}

/**
 * Publish a message to a named topic using the default device.
 *
 * @param {string} topicName
 * @param {any}    message
 */
function publish(topicName, message) {
  if (!_defaultDevice) throw new Error('Call cpo.device() before cpo.publish()');
  return _defaultDevice.publish(topicName, message);
}

/**
 * Subscribe to a named topic using the default device.
 *
 * @param {string}   topicName
 * @param {Function} callback  fn(message, topicName)
 */
function subscribe(topicName, callback) {
  if (!_defaultDevice) throw new Error('Call cpo.device() before cpo.subscribe()');
  return _defaultDevice.subscribe(topicName, callback);
}

/**
 * Override SDK-level options (call before creating any devices).
 *
 * @param {{ baseUrl?: string }} options
 */
function configure(options = {}) {
  if (options.baseUrl !== undefined) {
    const url = options.baseUrl;
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
    if (!isLocalhost && !url.startsWith('https://')) {
      throw new Error('baseUrl must use https:// (http:// is only allowed for localhost)');
    }
  }
  Object.assign(_options, options);
}

module.exports = { device, publish, subscribe, configure };
