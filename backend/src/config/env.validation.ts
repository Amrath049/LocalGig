import * as Joi from 'joi';

/**
 * Joi schema validating process environment at boot.
 * Phase 1 essentials are required; vars used from later phases (JWT, SendGrid)
 * are optional with sensible defaults so the app still boots during scaffolding.
 */
export const envValidationSchema = Joi.object({
  // --- App ---
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // --- Database (Phase 1) ---
  DATABASE_URL: Joi.string().required(),

  // --- Redis (Phase 1 infra; used from Phase 2/4) ---
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),

  // --- Elasticsearch (Phase 1 infra; used from Phase 4) ---
  ELASTICSEARCH_NODE: Joi.string().uri().default('http://localhost:9200'),

  // --- Auth / JWT (Phase 2) — optional during scaffolding ---
  JWT_ACCESS_SECRET: Joi.string().optional(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // --- Mail / SendGrid (Phase 2) — optional during scaffolding ---
  SENDGRID_API_KEY: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().default('no-reply@localgig.local'),
});
