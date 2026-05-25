'use strict';

const CloudPostOffice = require('../index');

const TEST_BASE_URL = 'https://test.cloudpostoffice.com';
const POSTBOX_ID = 'postbox-a8f3k';
const POSTBOX_SECRET = 'mysecret1234abcd';

function mockFetch(status, body, ok = status >= 200 && status < 300) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

describe('CloudPostOffice', () => {
  let client;

  beforeEach(() => {
    client = new CloudPostOffice({ baseUrl: TEST_BASE_URL });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('uses the default base URL when no options are passed', () => {
      const defaultClient = new CloudPostOffice();
      expect(defaultClient.baseUrl).toBe('https://cloudpostoffice.com');
    });

    it('uses a custom base URL when provided', () => {
      expect(client.baseUrl).toBe(TEST_BASE_URL);
    });
  });

  describe('authenticate()', () => {
    describe('input validation', () => {
      it('throws if postboxId is missing', async () => {
        await expect(client.authenticate('', POSTBOX_SECRET))
          .rejects.toThrow('postboxId and postboxSecret are required');
      });

      it('throws if postboxSecret is missing', async () => {
        await expect(client.authenticate(POSTBOX_ID, ''))
          .rejects.toThrow('postboxId and postboxSecret are required');
      });

      it('throws if both are missing', async () => {
        await expect(client.authenticate('', ''))
          .rejects.toThrow('postboxId and postboxSecret are required');
      });

      it('does not make a network request when validation fails', async () => {
        global.fetch = jest.fn();
        await client.authenticate('', '').catch(() => {});
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('successful authentication', () => {
      const successResponse = {
        token: 'eyJhbGciOiJIUzI1NiJ9.test.signature',
        broker: 'mqtt.cloudpostoffice.com',
        clientId: 'acc_x7k2p9:project-free:postbox-a8f3k',
      };

      beforeEach(() => mockFetch(200, successResponse));

      it('returns token, broker, and clientId', async () => {
        const result = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET);
        expect(result).toEqual(successResponse);
      });

      it('sends a POST request to /api/authenticate', async () => {
        await client.authenticate(POSTBOX_ID, POSTBOX_SECRET);
        expect(global.fetch).toHaveBeenCalledWith(
          `${TEST_BASE_URL}/api/authenticate`,
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('sends postboxId and postboxSecret in the JSON body', async () => {
        await client.authenticate(POSTBOX_ID, POSTBOX_SECRET);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ postboxId: POSTBOX_ID, postboxSecret: POSTBOX_SECRET }),
          })
        );
      });

      it('sets Content-Type to application/json', async () => {
        await client.authenticate(POSTBOX_ID, POSTBOX_SECRET);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          })
        );
      });
    });

    describe('error handling', () => {
      it('throws with status 401 on invalid credentials', async () => {
        mockFetch(401, { error: 'Invalid credentials' }, false);
        const err = await client.authenticate(POSTBOX_ID, 'wrong-secret').catch(e => e);
        expect(err.message).toBe('Invalid credentials');
        expect(err.status).toBe(401);
      });

      it('throws with status 429 on rate limit', async () => {
        mockFetch(429, { error: 'Too many requests' }, false);
        const err = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET).catch(e => e);
        expect(err.message).toBe('Too many requests');
        expect(err.status).toBe(429);
      });

      it('throws with status 400 when required fields are rejected server-side', async () => {
        mockFetch(400, { error: 'postboxId and postboxSecret are required' }, false);
        const err = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET).catch(e => e);
        expect(err.message).toBe('postboxId and postboxSecret are required');
        expect(err.status).toBe(400);
      });

      it('throws with status 500 on internal server error', async () => {
        mockFetch(500, { error: 'Internal server error' }, false);
        const err = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET).catch(e => e);
        expect(err.message).toBe('Internal server error');
        expect(err.status).toBe(500);
      });

      it('falls back to "Authentication failed" when server returns no error message', async () => {
        mockFetch(502, {}, false);
        const err = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET).catch(e => e);
        expect(err.message).toBe('Authentication failed');
        expect(err.status).toBe(502);
      });

      it('wraps network errors with a descriptive message', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const err = await client.authenticate(POSTBOX_ID, POSTBOX_SECRET).catch(e => e);
        expect(err.message).toMatch(/Network error/);
        expect(err.cause).toBeDefined();
      });
    });
  });
});
