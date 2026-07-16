'use strict';

const Joi = require('joi');
const { generateCacheKeys } = require('../utils/cacheKeys');
const { configStringSchema, fileIdSchema, languageCodeSchema } = require('../utils/validation');
const { toPublicTranslationJobStatus } = require('../utils/translationJobStatus');

const requestSchema = Joi.object({
  configStr: configStringSchema,
  sourceFileId: fileIdSchema,
  targetLanguage: languageCodeSchema
}).required();

function registerTranslationStatusRoutes(app, options) {
  const {
    limiter,
    resolveConfigGuarded,
    translationStatus,
    isSharedTranslationInFlight,
    hasCachedTranslation,
    setNoStore,
    log
  } = options;

  if (!app || typeof app.post !== 'function') {
    throw new TypeError('registerTranslationStatusRoutes requires an Express app');
  }

  app.post('/api/translation-status', limiter, async (req, res) => {
    setNoStore(res);
    const { error, value } = requestSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: 'Invalid translation status request' });
    }

    try {
      const config = await resolveConfigGuarded(value.configStr, req, res, '[API] translation-status config');
      if (!config) return undefined;

      const { baseKey, runtimeKey, bypass, allowPermanent } = generateCacheKeys(
        config,
        value.sourceFileId,
        value.targetLanguage
      );
      const sharedKey = (!bypass && allowPermanent) ? baseKey : runtimeKey;
      const localStatus = translationStatus.get(runtimeKey) || translationStatus.get(sharedKey);

      if (localStatus) {
        return res.json(toPublicTranslationJobStatus(localStatus));
      }

      const sharedStatus = await isSharedTranslationInFlight(sharedKey);
      if (sharedStatus && sharedStatus.inProgress !== false) {
        return res.json(toPublicTranslationJobStatus({
          status: 'running',
          stage: 'translating',
          inProgress: true,
          startedAt: sharedStatus.startedAt,
          updatedAt: sharedStatus.startedAt
        }));
      }

      if (await hasCachedTranslation(value.sourceFileId, value.targetLanguage, config)) {
        return res.json(toPublicTranslationJobStatus({
          status: 'completed',
          stage: 'completed',
          inProgress: false,
          completedAt: Date.now(),
          updatedAt: Date.now()
        }));
      }

      return res.json(toPublicTranslationJobStatus(null));
    } catch (error) {
      log.warn(() => `[Translation Status] Lookup failed: ${error.message}`);
      return res.status(503).json({ error: 'Translation status is temporarily unavailable' });
    }
  });
}

module.exports = {
  registerTranslationStatusRoutes,
  requestSchema
};
