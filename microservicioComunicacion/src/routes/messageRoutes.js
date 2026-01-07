const { Router } = require('express');
const { body, param, oneOf } = require('express-validator');
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
    oneOf(
      [body('remitenteId').trim().notEmpty(), body('senderId').trim().notEmpty()],
      'remitenteId o senderId es obligatorio'
    ),
    oneOf(
      [body('destinatarioId').trim().notEmpty(), body('recipientId').trim().notEmpty()],
      'destinatarioId o recipientId es obligatorio'
    ),
    body('contenido')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('El contenido no puede estar vacio'),
    body('adjuntos').optional().isArray().withMessage('adjuntos debe ser un arreglo'),
  ],
  validateRequest,
  sendMessage
);

router.patch(
  '/:messageId/read',
  [
    param('messageId').isMongoId().withMessage('messageId invalido'),
    oneOf(
      [body('lectorId').trim().notEmpty(), body('readerId').trim().notEmpty()],
      'lectorId o readerId es obligatorio'
    ),
  ],
  validateRequest,
  markMessageRead
);

router.patch(
  '/:messageId',
  [
    param('messageId').isMongoId().withMessage('messageId invalido'),
    body('editorId').trim().notEmpty().withMessage('editorId es obligatorio'),
    body('contenido')
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
    oneOf(
      [body('solicitanteId').trim().notEmpty(), body('requesterId').trim().notEmpty()],
      'solicitanteId o requesterId es obligatorio'
    ),
  ],
  validateRequest,
  destroyMessage
);

module.exports = router;
