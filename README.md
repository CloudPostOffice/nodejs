# cloudpostoffice

Node.js SDK for [CloudPostOffice](https://cloudpostoffice.com) — super-simple messaging for AI agents, apps, and devices.

## Install

```bash
npm install cloudpostoffice
```

## Quick start

Each app or device needs a unique **postbox ID** and a **secret key**. Create them from your [dashboard](https://cloudpostoffice.com/app). Two apps cannot connect with the same postbox ID at the same time — every participant needs its own credentials.

---

## Direct Messages

Send a message directly from one postbox to another.

```js
const cpo = require('cloudpostoffice');

const p1 = cpo.postbox('postbox-1', 'your-secret');
const p2 = cpo.postbox('postbox-2', 'your-secret');

// postbox-2 listens for incoming messages
await p2.listen(msg => {
  console.log(msg); // { from: 'postbox-1', msg: 'hello', ts: 1234567890 }
});

// postbox-1 sends a message to postbox-2
await p1.send({ to: 'postbox-2', msg: 'hello' });
```

The `listen` callback receives `{ from, msg, ts }` where `from` is the sender's postbox ID, `msg` is the payload, and `ts` is the server timestamp.

---

## Pub/Sub

Any postbox can publish or subscribe to any topic in the same project. No need to pre-create topics — they work on the fly.

```js
const cpo = require('cloudpostoffice');

const p1 = cpo.postbox('postbox-1', 'your-secret');
const p2 = cpo.postbox('postbox-2', 'your-secret');

// p1 subscribes to a topic
await p1.subscribe('news', (topic, msg) => {
  console.log(topic, msg);
});

// p2 publishes to the same topic
await p2.publish('news', { msg: 'CloudPostOffice is live!' });
```

The `subscribe` callback receives `(topicName, message)`.

---

## API

### `cpo.postbox(postboxId, postboxSecret)`

Creates a postbox handle. Automatically authenticates and connects to the MQTT broker on first use.

```js
const p = cpo.postbox('my-postbox', 'my-secret');
```

---

### `postbox.send({ to, msg })`

Sends a direct message to another postbox on the same account/project.

| Param | Type | Description |
|-------|------|-------------|
| `to` | `string` | Target postbox ID |
| `msg` | `any` | Message payload (any JSON-serialisable value) |

```js
await p1.send({ to: 'postbox-2', msg: 'hello' });
```

---

### `postbox.listen(callback)`

Registers a callback for messages addressed to this postbox. Can be called multiple times to add multiple handlers.

```js
await p.listen(({ from, msg, ts }) => {
  console.log(`Message from ${from}:`, msg);
});
```

---

### `postbox.publish(topicName, message)`

Publishes a message to a named topic.

- Topic names must not contain `/`, `+`, `#`, or `--`.

```js
await p.publish('alerts', { level: 'warn', text: 'High temp' });
```

---

### `postbox.subscribe(topicName, callback)`

Subscribes to a named topic. Callback is called whenever a message is published to that topic.

```js
await p.subscribe('alerts', (topic, msg) => {
  console.log(topic, msg);
});
```

---

### `postbox.disconnect()`

Gracefully closes the MQTT connection.

```js
p.disconnect();
```

---

### `cpo.configure(options)`

Override SDK-level options. Call before creating any postboxes.

```js
cpo.configure({ baseUrl: 'https://cloudpostoffice.com' });
```

---

## Notes

- **Authentication tokens** are valid for 7 days. The SDK will automatically reconnect and refresh the token when it expires.
- Topic names must not contain `/`, `+`, `#`, or `--`.
- Two postboxes cannot share the same postbox ID and secret at the same time within a project.

---

## Links

- [Dashboard](https://cloudpostoffice.com/app)
- [Documentation](https://cloudpostoffice.com/docs)
- [Issues](https://github.com/CloudPostOffice/nodejs/issues)
- Email: [hi@cloudpostoffice.com](mailto:hi@cloudpostoffice.com)


### For tests
npm test