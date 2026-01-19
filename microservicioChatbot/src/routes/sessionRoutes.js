const { Router } = require('express');
const { body, query, param } = require('express-validator');
const {
  createSession,
  listUserSessions,
  getSessionMessages,
  postMessage,
  destroySession,
  getSession,
  aiReply,
  updateSessionTitle,
} = require('../controllers/sessionController');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();

router.post(
  '/sessions',
  [body('usuarioId').trim().notEmpty().withMessage('usuarioId es obligatorio')],
  validateRequest,
  createSession
);

router.get(
  '/sessions',
  [query('usuarioId').trim().notEmpty().withMessage('usuarioId es obligatorio')],
  validateRequest,
  listUserSessions
);

router.get(
  '/sessions/:sessionId',
  [param('sessionId').isMongoId().withMessage('sessionId invalido')],
  validateRequest,
  getSession
);

router.get(
  '/sessions/:sessionId/messages',
  [param('sessionId').isMongoId().withMessage('sessionId invalido')],
  validateRequest,
  getSessionMessages
);

router.post(
  '/sessions/:sessionId/messages',
  [
    param('sessionId').isMongoId().withMessage('sessionId invalido'),
    body('remitenteId').trim().notEmpty().withMessage('remitenteId es obligatorio'),
    body('contenido').isString().isLength({ min: 1 }).withMessage('contenido no puede estar vacio'),
  ],
  validateRequest,
  postMessage
);

router.delete(
  '/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('sessionId invalido'),
    body('solicitanteId').trim().notEmpty().withMessage('solicitanteId es obligatorio'),
  ],
  validateRequest,
  destroySession
);

router.patch(
  '/sessions/:sessionId',
  [
    param('sessionId').isMongoId().withMessage('sessionId invalido'),
    body('solicitanteId').optional().trim(),
    body('usuarioId').optional().trim(),
    body('titulo').isString().isLength({ min: 1 }).withMessage('titulo es obligatorio'),
  ],
  validateRequest,
  updateSessionTitle
);

router.post(
  '/sessions/:sessionId/ai-reply',
  [
    param('sessionId').isMongoId().withMessage('sessionId invalido'),
    body('usuarioId').trim().notEmpty().withMessage('usuarioId es obligatorio'),
    body('contenido').isString().isLength({ min: 1 }).withMessage('contenido no puede estar vacio'),
  ],
  validateRequest,
  aiReply
);

module.exports = router;
