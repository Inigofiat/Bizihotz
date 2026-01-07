const { Router } = require('express');
const { query, param, body, oneOf } = require('express-validator');
const {
  createConversation,
  listConversations,
  fetchConversationMessages,
  markConversationRead,
  removeConversation,
} = require('../controllers/conversationController');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();

router.post(
  '/',
  [
    oneOf(
      [body('solicitanteId').trim().notEmpty(), body('requesterId').trim().notEmpty()],
      'solicitanteId o requesterId es obligatorio'
    ),
    oneOf(
      [body('participanteId').trim().notEmpty(), body('participantId').trim().notEmpty()],
      'participanteId o participantId es obligatorio'
    ),
  ],
  validateRequest,
  createConversation
);

router.get(
  '/',
  [
    oneOf(
      [query('usuarioId').trim().notEmpty(), query('userId').trim().notEmpty()],
      'usuarioId o userId es obligatorio'
    ),
  ],
  validateRequest,
  listConversations
);

router.get(
  '/:conversationId/messages',
  [
    param('conversationId').isMongoId().withMessage('conversationId invalido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit fuera de rango'),
  ],
  validateRequest,
  fetchConversationMessages
);

router.patch(
  '/:conversationId/read',
  [
    param('conversationId').isMongoId().withMessage('conversationId invalido'),
    oneOf(
      [body('lectorId').trim().notEmpty(), body('readerId').trim().notEmpty()],
      'lectorId o readerId es obligatorio'
    ),
  ],
  validateRequest,
  markConversationRead
);

router.delete(
  '/:conversationId',
  [
    param('conversationId').isMongoId().withMessage('conversationId invalido'),
    oneOf(
      [body('solicitanteId').trim().notEmpty(), body('requesterId').trim().notEmpty()],
      'solicitanteId o requesterId es obligatorio'
    ),
  ],
  validateRequest,
  removeConversation
);

module.exports = router;
