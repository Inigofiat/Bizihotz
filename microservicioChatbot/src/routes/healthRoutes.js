const { Router } = require('express');
const config = require('../config/env');

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: config.serviceName,
    env: config.env,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
