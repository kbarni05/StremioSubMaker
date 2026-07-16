'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isInternalHost,
    isInternalIp,
    validateCustomBaseUrl
} = require('./ssrfProtection');

test('bracketed private IPv6 URL literals are rejected', async () => {
    for (const address of ['[fc00::1]', '[fd12:3456::1]', '[fe80::1]', '[::1]', '[::]']) {
        assert.equal(isInternalHost(address), true, `${address} should be classified as internal`);
        assert.equal(isInternalIp(address), true, `${address} should be classified as an internal IP`);

        const result = await validateCustomBaseUrl(`http://${address}`);
        assert.equal(result.valid, false, `${address} should not pass base URL validation`);
    }
});

test('IPv4-mapped private IPv6 literals are rejected', async () => {
    const address = '[::ffff:127.0.0.1]';
    assert.equal(isInternalIp(address), true);

    const result = await validateCustomBaseUrl(`http://${address}`);
    assert.equal(result.valid, false);
});

test('public IP literals remain valid custom provider endpoints', async () => {
    assert.equal(isInternalHost('8.8.8.8'), false);
    assert.equal(isInternalIp('8.8.8.8'), false);

    const result = await validateCustomBaseUrl('https://8.8.8.8/v1');
    assert.deepEqual(result, { valid: true, sanitized: 'https://8.8.8.8/v1' });
});
