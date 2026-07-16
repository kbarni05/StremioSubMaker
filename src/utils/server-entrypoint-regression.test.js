'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

function close(server) {
    return new Promise(resolve => server.close(resolve));
}

test('importing index exports the app without binding the configured port', async () => {
    const blocker = net.createServer();
    await listen(blocker);

    try {
        const port = blocker.address().port;
        const projectRoot = path.resolve(__dirname, '..', '..');
        const childSource = `
            const app = require('./index');
            if (typeof app !== 'function' || typeof app.startServer !== 'function') {
                process.exit(2);
            }
            setTimeout(() => {
                process.stdout.write('import-ok');
                process.exit(0);
            }, 250);
        `;

        const result = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, ['-e', childSource], {
                cwd: projectRoot,
                env: {
                    ...process.env,
                    PORT: String(port),
                    STORAGE_TYPE: 'filesystem',
                    ENCRYPTION_KEY: '0'.repeat(64),
                    LOG_LEVEL: 'error',
                    LOG_TO_FILE: 'false'
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', chunk => { stdout += chunk; });
            child.stderr.on('data', chunk => { stderr += chunk; });
            child.once('error', reject);
            child.once('close', code => resolve({ code, stdout, stderr }));
        });

        assert.equal(result.code, 0, result.stderr || result.stdout);
        assert.match(result.stdout, /import-ok/);
    } finally {
        await close(blocker);
    }
});
