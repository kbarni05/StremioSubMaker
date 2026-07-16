'use strict';

const { getStorageAdapter } = require('../storage/StorageFactory');
const { StorageAdapter } = require('../storage');

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
}

function registerHealthRoutes(app, options) {
    const {
        isSessionManagerReady,
        sessionManager,
        sentry,
        version,
        log
    } = options;

    if (!app || typeof app.get !== 'function') {
        throw new TypeError('registerHealthRoutes requires an Express app');
    }

    // Startup probes get a simple 200 while sessions are loading. Once ready,
    // storage failure changes the response to 503 for readiness monitoring.
    app.get('/health', async (req, res) => {
        try {
            if (!isSessionManagerReady()) {
                return res.status(200).json({
                    status: 'starting',
                    timestamp: new Date().toISOString(),
                    uptime: Math.floor(process.uptime()),
                    message: 'Server is alive, session manager still initializing'
                });
            }

            let storageHealthy = false;
            const storageType = process.env.STORAGE_TYPE || 'redis';

            try {
                const adapter = await getStorageAdapter();
                storageHealthy = await adapter.healthCheck();
            } catch (error) {
                log.warn(() => `[Health] Storage health check failed: ${error.message}`);
            }

            const cacheSizes = {};
            if (storageHealthy) {
                try {
                    const adapter = await getStorageAdapter();
                    for (const type of Object.values(StorageAdapter.CACHE_TYPES)) {
                        const sizeBytes = await adapter.size(type);
                        const limitBytes = StorageAdapter.SIZE_LIMITS[type];
                        cacheSizes[type] = {
                            current: sizeBytes,
                            currentMB: (sizeBytes / (1024 * 1024)).toFixed(2),
                            limit: limitBytes,
                            limitMB: limitBytes ? (limitBytes / (1024 * 1024)).toFixed(2) : 'unlimited',
                            utilizationPercent: limitBytes ? ((sizeBytes / limitBytes) * 100).toFixed(1) : 0
                        };
                    }
                } catch (error) {
                    log.warn(() => `[Health] Cache size check failed: ${error.message}`);
                }
            }

            const memUsage = process.memoryUsage();
            const memory = {
                rss: (memUsage.rss / (1024 * 1024)).toFixed(2) + ' MB',
                heapUsed: (memUsage.heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
                heapTotal: (memUsage.heapTotal / (1024 * 1024)).toFixed(2) + ' MB',
                external: (memUsage.external / (1024 * 1024)).toFixed(2) + ' MB'
            };

            const status = storageHealthy ? 'healthy' : 'unhealthy';
            res.status(storageHealthy ? 200 : 503).json({
                status,
                timestamp: new Date().toISOString(),
                uptime: Math.floor(process.uptime()),
                uptimeHuman: formatUptime(process.uptime()),
                version,
                storage: {
                    type: storageType,
                    healthy: storageHealthy,
                    caches: cacheSizes
                },
                memory,
                sessions: await sessionManager.getStats(),
                sentry: {
                    initialized: sentry.isInitialized(),
                    environment: process.env.SENTRY_ENVIRONMENT || 'production'
                }
            });
        } catch (error) {
            log.error(() => `[Health] Error: ${error.message}`);
            res.status(503).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = {
    formatUptime,
    registerHealthRoutes
};
