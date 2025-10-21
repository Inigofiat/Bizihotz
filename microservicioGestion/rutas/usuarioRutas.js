"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Types } = require("mongoose");

const Usuario = require("../data/usuarioModel");

const router = express.Router();

const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const resolveUploadPath = (filePath = "") => {
  const sanitized = filePath.replace(/^\/+/, "");
  return path.join(__dirname, "..", sanitized);
};

const deleteFileIfExists = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("[Avatar] No se pudo eliminar el archivo anterior:", error.message);
    }
  }
};

router.post("/:id/avatar", upload.single("avatar"), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      if (req.file) {
        await deleteFileIfExists(req.file.path);
      }
      return res.status(400).json({ mensaje: "Identificador de usuario no valido." });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: "No se recibio ninguna imagen." });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      await deleteFileIfExists(req.file.path);
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`;

    if (usuario.foto && usuario.foto.startsWith("/uploads/avatars/")) {
      const previousPath = resolveUploadPath(usuario.foto);
      await deleteFileIfExists(previousPath);
    }

    usuario.foto = relativePath;
    await usuario.save();

    return res.json({
      mensaje: "Avatar actualizado correctamente.",
      fotoUrl: relativePath
    });
  } catch (error) {
    if (req.file) {
      await deleteFileIfExists(req.file.path);
    }
    return next(error);
  }
});

module.exports = router;
