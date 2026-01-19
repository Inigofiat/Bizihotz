require('dotenv').config();

const numberFromEnv = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const booleanFromEnv = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const rawOrigins = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: numberFromEnv(process.env.PORT, 4700),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatbot',
  serviceName: process.env.SERVICE_NAME || 'Bizihotz Chatbot',
  allowedOrigins,
  aiApiUrl: process.env.AI_API_URL || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || '',
  aiTimeoutMs: numberFromEnv(process.env.AI_TIMEOUT_MS, 15000),
  aiFallbackEnabled: booleanFromEnv(process.env.AI_FALLBACK_HEURISTIC, false),
  aiRetries: numberFromEnv(process.env.AI_RETRIES, 2),
  aiMaxTokens: numberFromEnv(process.env.AI_MAX_TOKENS, 0),
  aiTemperature: numberFromEnv(process.env.AI_TEMPERATURE, 0.2),
  aiSystemPrompt: process.env.AI_SYSTEM_PROMPT || '',
};
