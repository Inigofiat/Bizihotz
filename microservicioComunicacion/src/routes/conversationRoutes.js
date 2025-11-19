const { Router } = require('express');
const { query, param, body } = require('express-validator');
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
    body('requesterId').trim().notEmpty().withMessage('requesterId es obligatorio'),
    body('participantId').trim().notEmpty().withMessage('participantId es obligatorio'),
  ],
  validateRequest,
  createConversation
);

router.get(
  '/',
  [query('userId').trim().notEmpty().withMessage('userId es obligatorio')],
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
    body('readerId').trim().notEmpty().withMessage('readerId es obligatorio'),
  ],
  validateRequest,
  markConversationRead
);

router.delete(
  '/:conversationId',
  [
    param('conversationId').isMongoId().withMessage('conversationId invalido'),
    body('requesterId').trim().notEmpty().withMessage('requesterId es obligatorio'),
  ],
  validateRequest,
  removeConversation
);

module.exports = router;
