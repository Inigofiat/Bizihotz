const mongoose = require('mongoose');
const config = require('../config/env');

const healthCheck = async (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  return res.json({
    status: 'ok',
    service: config.serviceName,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  healthCheck,
};
