# cloudpostoffice

Node.js SDK for [CloudPostOffice](https://cloudpostoffice.com) — super-simple messaging for AI agents, apps, and devices.

## Install

```bash
npm install cloudpostoffice
```

## Quick start

Each app or device needs a unique **device ID** and a **secret key**. Create them from your [dashboard](https://cloudpostoffice.com/app). Two apps cannot connect with the same device ID at the same time — every participant needs its own credentials.

---

## Direct Messages

Send a message directly from one device to another.

```js
const cpo = require('cloudpostoffice');

const d1 = cpo.device('device-1', 'your-secret');
const d2 = cpo.device('device-2', 'your-secret');

// device-2 listens for incoming messages
await d2.listen(msg => {
  console.log(msg); // { from: 'device-1', msg: 'hello', ts: 1234567890 }
});

// device-1 sends a message to device-2
await d1.send({ to: 'device-2', msg: 'hello' });
```

The `listen` callback receives `{ from, msg, ts }` where `from` is the sender's device ID, `msg` is the payload, and `ts` is the server timestamp.

---

## Pub/Sub

Any device can publish or subscribe to any topic in the same project. No need to pre-create topics — they work on the fly.

```js
const cpo = require('cloudpostoffice');

const d1 = cpo.device('device-1', 'your-secret');
const d2 = cpo.device('device-2', 'your-secret');

// d1 subscribes to a topic
await d1.subscribe('news', (topic, msg) => {
  console.log(topic, msg);
});

// d2 publishes to the same topic
await d2.publish('news', { msg: 'CloudPostOffice is alive!' });
```

The `subscribe` callback receives `(topicName, message)`.

---

## API

### `cpo.device(deviceId, deviceSecret)`

Creates a device handle. Automatically authenticates and connects to the MQTT broker on first use.

```js
const d = cpo.device('my-device', 'my-secret');
```

---

### `device.send({ to, msg })`

Sends a direct message to another device on the same account/project.

| Param | Type | Description |
|-------|------|-------------|
| `to` | `string` | Target device ID |
| `msg` | `any` | Message payload (any JSON-serialisable value) |

```js
await d1.send({ to: 'device-2', msg: 'hello' });
```

---

### `device.listen(callback)`

Registers a callback for messages addressed to this device. Can be called multiple times to add multiple handlers.

```js
await d.listen(({ from, msg, ts }) => {
  console.log(`Message from ${from}:`, msg);
});
```

---

### `device.publish(topicName, message)`

Publishes a message to a named topic.

- Topic names must not contain `/`, `+`, `#`, or `--`.

```js
await d.publish('alerts', { level: 'warn', text: 'High temp' });
```

---

### `device.subscribe(topicName, callback)`

Subscribes to a named topic. Callback is called whenever a message is published to that topic.

```js
await d.subscribe('alerts', (topic, msg) => {
  console.log(topic, msg);
});
```

---

### `device.disconnect()`

Gracefully closes the MQTT connection.

```js
d.disconnect();
```

---

### `cpo.configure(options)`

Override SDK-level options. Call before creating any devices.

```js
cpo.configure({ baseUrl: 'https://cloudpostoffice.com' });
```

---

## Notes

- **Authentication tokens** are valid for 7 days. The SDK will automatically reconnect and refresh the token when it expires.
- Topic names must not contain `/`, `+`, `#`, or `--`.
- Two devices cannot share the same device ID and secret at the same time within a project.

---

## Links

- [Dashboard](https://cloudpostoffice.com/app)
- [Documentation](https://cloudpostoffice.com/docs)
- [Issues](https://github.com/CloudPostOffice/nodejs/issues)
- Email: [hi@cloudpostoffice.com](mailto:hi@cloudpostoffice.com)
