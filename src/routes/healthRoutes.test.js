'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { formatUptime, registerHealthRoutes } = require('./healthRoutes');

test('formatUptime renders compact day, hour, minute, and second values', () => {
    assert.equal(formatUptime(0), '0s');
    assert.equal(formatUptime(90061), '1d 1h 1m 1s');
});

test('health endpoint reports starting without touching storage', async () => {
    let handler;
    const app = {
        get(path, candidate) {
            assert.equal(path, '/health');
            handler = candidate;
        }
    };

    registerHealthRoutes(app, {
        isSessionManagerReady: () => false,
        sessionManager: null,
        sentry: null,
        version: 'test',
        log: null
    });

    let statusCode;
    let body;
    const res = {
        status(value) {
            statusCode = value;
            return this;
        },
        json(value) {
            body = value;
            return this;
        }
    };

    await handler({}, res);
    assert.equal(statusCode, 200);
    assert.equal(body.status, 'starting');
});
