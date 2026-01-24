const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : undefined;

dotenv.config(envFile ? { path: envFile } : undefined);

const parseArray = (value, fallback = []) => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 4100),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/comunicacion',
  serviceName: process.env.SERVICE_NAME || 'Bizihotz Comunicacion Interna',
  socketAllowedOrigins: parseArray(process.env.SOCKET_ALLOWED_ORIGINS, ['*']),
  defaultPageSize: parseNumber(process.env.DEFAULT_PAGE_SIZE, 25),
  maxPageSize: parseNumber(process.env.MAX_PAGE_SIZE, 100),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), 'uploads'),
  maxAttachmentSize: parseNumber(process.env.MAX_ATTACHMENT_SIZE_MB, 15) * 1024 * 1024,
};

module.exports = config;
