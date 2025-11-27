const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  sendMessage,
  markMessageRead,
  updateMessage,
  destroyMessage,
} = require('../controllers/messageController');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();

router.post(
  '/',
  [
    body('senderId').trim().notEmpty().withMessage('senderId es obligatorio'),
    body('recipientId').trim().notEmpty().withMessage('recipientId es obligatorio'),
    body('content')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('El contenido no puede estar vacio'),
    body('attachments').optional().isArray().withMessage('attachments debe ser un arreglo'),
  ],
  validateRequest,
  sendMessage
);

router.patch(
  '/:messageId/read',
  [
    param('messageId').isMongoId().withMessage('messageId invalido'),
    body('readerId').trim().notEmpty().withMessage('readerId es obligatorio'),
  ],
  validateRequest,
  markMessageRead
);

router.patch(
  '/:messageId',
  [
    param('messageId').isMongoId().withMessage('messageId invalido'),
    body('editorId').trim().notEmpty().withMessage('editorId es obligatorio'),
    body('content')
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('El contenido editado no puede estar vacio'),
  ],
  validateRequest,
  updateMessage
);

router.delete(
  '/:messageId',
  [
    param('messageId').isMongoId().withMessage('messageId invalido'),
    body('requesterId').trim().notEmpty().withMessage('requesterId es obligatorio'),
  ],
  validateRequest,
  destroyMessage
);

module.exports = router;
