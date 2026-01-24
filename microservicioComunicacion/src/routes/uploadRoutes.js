const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const multer = require('multer');
const createError = require('http-errors');
const config = require('../config/env');

const router = Router();

const uploadsRoot = config.uploadsDir || path.join(process.cwd(), 'uploads');
const attachmentsDir = path.join(uploadsRoot, 'adjuntos');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(uploadsRoot);
ensureDir(attachmentsDir);

const sanitizeFilename = (name = '') => {
  const normalized = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const base = normalized || 'adjunto';
  const ext = path.extname(base) || '.bin';
  return {
    base: path.basename(base, ext) || 'adjunto',
    ext,
  };
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, attachmentsDir),
  filename: (_req, file, cb) => {
    const { base, ext } = sanitizeFilename(file.originalname || 'adjunto');
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxAttachmentSize || 15 * 1024 * 1024,
    files: 5,
  },
});

const buildAttachmentPayload = (file) => {
  const isImage = (file.mimetype || '').startsWith('image/');
  return {
    tipo: isImage ? 'image' : 'file',
    url: `/uploads/adjuntos/${file.filename}`,
    nombre: file.originalname || file.filename,
    tamano: file.size,
    metadatos: {
      mimetype: file.mimetype,
      almacenadoComo: file.filename,
    },
  };
};

router.post('/attachments', (req, res, next) => {
  ensureDir(attachmentsDir);
  upload.array('files', 5)(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(createError(413, 'El archivo supera el tamaño maximo permitido'));
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return next(createError(400, 'Demasiados archivos en la misma solicitud'));
        }
      }
      return next(createError(400, error.message || 'No se pudo procesar los adjuntos'));
    }
    if (!req.files || !req.files.length) {
      return next(createError(400, 'No se recibieron archivos para adjuntar'));
    }

    const payload = req.files.map(buildAttachmentPayload);
    return res.status(201).json({ data: payload });
  });
});

module.exports = router;
