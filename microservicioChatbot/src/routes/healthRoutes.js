const { Router } = require('express');
const mongoose = require('mongoose');
const config = require('../config/env');

const router = Router();

router.get('/', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    service: config.serviceName,
    env: config.env,
    db,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
