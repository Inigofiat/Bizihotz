"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Types } = require("mongoose");

const Usuario = require("../models/usuarioModel");
const { permitirRoles, ROLES } = require("../middlewares/authorize");

const router = express.Router();

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchFilter = (
  term,
  { includeInactive = false, estado = "", rol = "", rolSistema = "" } = {}
) => {
  const baseFilter = {};

  if (!includeInactive) {
    baseFilter.activo = true;
  }

  const estadoNorm = estado.toString().toLowerCase();
  if (estadoNorm === "activo") {
    baseFilter.activo = true;
  } else if (estadoNorm === "inactivo") {
    baseFilter.activo = false;
  }

  if (rol) {
    baseFilter.rol = new RegExp(`^${escapeRegExp(rol.trim())}$`, "i");
  }
  if (rolSistema) {
    baseFilter.rolSistema = new RegExp(`^${escapeRegExp(rolSistema.trim())}$`, "i");
  }
  if (!term) {
    return baseFilter;
  }

  const normalized = term.trim().replace(/\s+/g, " ");
  const regex = new RegExp(escapeRegExp(normalized), "i");
  const tokens = normalized.split(" ").map((token) => new RegExp(escapeRegExp(token), "i"));

  const tokenConditions =
    tokens.length > 1
      ? {
          $and: tokens.map((token) => ({
            $or: [{ nombre: token }, { apellidos: token }]
          }))
        }
      : null;

  const conditions = [
    { nombreUsuario: regex },
    { email: regex },
    { nombre: regex },
    { apellidos: regex },
    tokenConditions
  ].filter(Boolean);

  return {
    ...baseFilter,
    ...(conditions.length > 0 ? { $or: conditions } : {})
  };
};

const isAdminRequest = (req) => {
  const rolSistema = req?.user?.rolSistema || "";
  return rolSistema.toLowerCase() === ROLES.ADMIN.toLowerCase();
};

const isSelfOrAdmin = (req, targetId) => {
  const isSelf = req.user && String(req.user.idUsuario || req.user.id) === String(targetId);
  return isSelf || isAdminRequest(req);
};

router.get("/", permitirRoles(ROLES.ADMIN, ROLES.PROFESIONAL, ROLES.RECEPCIONISTA), async (req, res, next) => {
  try {
    const { q = "", limit = "12", estado = "", rol = "", rolSistema = "" } = req.query;
    const search = String(q || "").trim();
    const hasSearch = search.length >= 2;
    const adminRequest = isAdminRequest(req);

    if (search && !hasSearch) {
      return res.status(400).json({
        mensaje: "Proporciona al menos 2 caracteres para buscar profesionales."
      });
    }

    const baseLimit = hasSearch ? Number(limit) || 12 : Number(limit) || (adminRequest ? 200 : 24);
    const maxLimit = Math.min(baseLimit, adminRequest ? 500 : 50);
    const filter = buildSearchFilter(hasSearch ? search : "", {
      includeInactive: adminRequest,
      estado,
      rol,
      rolSistema
    });

    const usuarios = await Usuario.find(filter)
      .sort({ nombre: 1, apellidos: 1, nombreUsuario: 1 })
      .limit(maxLimit)
      .select("nombre apellidos nombreUsuario email telefono rol rolSistema foto activo ultimoAcceso updatedAt");

    const data = usuarios
      .filter((usuario) => {
        const rol = (usuario.rolSistema || usuario.rol || "").toLowerCase();
        const esAdmin = rol === "administrador" || rol === "admin";
        const esRecep = rol === "recepcionista";

        // Los administradores nunca se listan.
        if (esAdmin) return false;
        // Si no es petición de admin, ocultamos recepcionistas.
        if (!adminRequest && esRecep) return false;
        return true;
      })
      .map((usuario) => {
        const nombre = usuario.nombre?.trim() || "";
        const apellidos = usuario.apellidos?.trim() || "";
        const nombreCompleto = `${nombre} ${apellidos}`.trim() || usuario.nombreUsuario;
        const activo = usuario.activo !== false;
        const ultimoAcceso = usuario.ultimoAcceso || usuario.updatedAt || null;

        return {
          idUsuario: usuario._id.toString(),
          nombre,
          apellidos,
          nombreCompleto,
          nombreUsuario: usuario.nombreUsuario,
          email: usuario.email,
          telefono: usuario.telefono ?? "",
          rol: usuario.rol,
          rolSistema: usuario.rolSistema || "",
          foto: usuario.foto ?? "",
          activo,
          ultimoAcceso
        };
      });

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
});

const buildUserResponse = (usuario) => {
  const plain =
    typeof usuario.toJSON === "function"
      ? usuario.toJSON()
      : usuario.toObject
        ? usuario.toObject()
        : usuario;

  const id =
    plain.idUsuario ||
    plain._id?.toString?.() ||
    plain._id ||
    plain.id ||
    null;

  return {
    idUsuario: id,
    nombreUsuario: plain.nombreUsuario,
    email: plain.email,
    rol: plain.rol,
    rolSistema: plain.rolSistema || ROLES.PROFESIONAL,
    nombre: plain.nombre ?? "",
    apellidos: plain.apellidos ?? "",
    telefono: plain.telefono ?? "",
    foto: plain.foto ?? "",
    debeActualizarPassword: plain.debeActualizarPassword ?? false,
    ultimoCambioPassword: plain.ultimoCambioPassword ?? null,
    ultimoAcceso: plain.ultimoAcceso ?? null
  };
};

// Crear profesional (solo admin).
router.post(
  "/",
  permitirRoles(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const {
        nombre,
        apellidos,
        telefono,
        email,
        nombreUsuario,
        password,
        rol,
        rolSistema,
        foto,
        activo
      } = req.body ?? {};

      if (!email || !nombreUsuario || !password) {
        return res.status(400).json({
          mensaje: "Nombre de usuario, email y contraseña son obligatorios."
        });
      }

      if (String(password).length < 8) {
        return res.status(400).json({
          mensaje: "La contraseña debe tener al menos 8 caracteres."
        });
      }

      const existing = await Usuario.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({ mensaje: "Ya existe un usuario con ese email." });
      }

      const passwordHash = await bcrypt.hash(String(password), 12);
      const usuario = new Usuario({
        nombre,
        apellidos,
        telefono,
        email: email.toLowerCase().trim(),
        nombreUsuario: nombreUsuario.trim(),
        passwordHash,
        rol: rol || "Nutricionista",
        rolSistema: rolSistema || ROLES.PROFESIONAL,
        foto: foto || "",
        activo: typeof activo === "boolean" ? activo : true,
        debeActualizarPassword: false
      });

      const creado = await usuario.save();
      return res.status(201).json({
        mensaje: "Usuario creado correctamente.",
        usuario: buildUserResponse(creado)
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: "Identificador de usuario no valido." });
    }

    const admin = isAdminRequest(req);
    const isSelf = req.user && String(req.user.idUsuario || req.user.id) === String(id);

    if (!req.user || (!isSelf && !admin)) {
      return res.status(403).json({ mensaje: "No puedes modificar este usuario." });
    }

    // El rol no se puede modificar desde la edicion de perfil.
    const {
      nombre,
      apellidos,
      telefono,
      email,
      nombreUsuario,
      rol,
      rolSistema,
      activo
    } = req.body ?? {};

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const applyIfPresent = (field, value, formatter) => {
      if (typeof value === "string" && value.trim().length > 0) {
        usuario[field] = formatter ? formatter(value) : value.trim();
      }
    };

    applyIfPresent("nombre", nombre);
    applyIfPresent("apellidos", apellidos);
    applyIfPresent("telefono", telefono);
    applyIfPresent("email", email, (val) => val.toLowerCase().trim());
    applyIfPresent("nombreUsuario", nombreUsuario);

    if (admin) {
      applyIfPresent("rol", rol);
      if (typeof rolSistema === "string" && rolSistema.trim().length > 0) {
        usuario.rolSistema = rolSistema.trim();
      }
      if (typeof activo === "boolean") {
        usuario.activo = activo;
      }
    }

    await usuario.save();

    return res.json({
      mensaje: "Perfil actualizado correctamente.",
      usuario: buildUserResponse(usuario)
    });
  } catch (error) {
    return next(error);
  }
});

// Activar/desactivar profesional (solo admin).
router.patch("/:id/estado", permitirRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activo } = req.body ?? {};

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: "Identificador de usuario no valido." });
    }
    if (typeof activo !== "boolean") {
      return res.status(400).json({ mensaje: "El campo 'activo' debe ser booleano." });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    usuario.activo = activo;
    await usuario.save();

    return res.json({
      mensaje: activo ? "Usuario activado." : "Usuario desactivado.",
      usuario: buildUserResponse(usuario)
    });
  } catch (error) {
    return next(error);
  }
});

// Resetear password (solo admin).
router.patch("/:id/password", permitirRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nuevaPassword } = req.body ?? {};

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: "Identificador de usuario no valido." });
    }

    if (!nuevaPassword || String(nuevaPassword).length < 8) {
      return res.status(400).json({ mensaje: "La nueva contrasena debe tener al menos 8 caracteres." });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    usuario.passwordHash = await bcrypt.hash(String(nuevaPassword), 12);
    usuario.debeActualizarPassword = true;
    usuario.ultimoCambioPassword = new Date();

    await usuario.save();

    return res.json({ mensaje: "Contrasena reseteada. El usuario debera actualizarla al iniciar sesion." });
  } catch (error) {
    return next(error);
  }
});

const uploadsBaseDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

const avatarsDir = path.join(uploadsBaseDir, "avatars");
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
  const withoutUploadsPrefix = sanitized.startsWith("uploads/")
    ? sanitized.slice("uploads/".length)
    : sanitized;
  return path.join(uploadsBaseDir, withoutUploadsPrefix);
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

    if (!isSelfOrAdmin(req, id)) {
      await deleteFileIfExists(req.file.path);
      return res.status(403).json({ mensaje: "No puedes modificar el avatar de otro usuario." });
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
    if (["EIO", "EACCES", "EROFS"].includes(error.code)) {
      return res.status(500).json({
        mensaje:
          "No se pudo guardar la imagen de perfil. Verifica que el servidor tenga permisos de escritura en la carpeta de avatares."
      });
    }
    return next(error);
  }
});

router.delete("/:id/avatar", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensaje: "Identificador de usuario no valido." });
    }

    if (!isSelfOrAdmin(req, id)) {
      return res.status(403).json({ mensaje: "No puedes eliminar el avatar de otro usuario." });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    if (usuario.foto && usuario.foto.startsWith("/uploads/avatars/")) {
      const previousPath = resolveUploadPath(usuario.foto);
      await deleteFileIfExists(previousPath);
    }

    usuario.foto = "";
    await usuario.save();

    return res.json({
      mensaje: "Avatar eliminado correctamente.",
      fotoUrl: ""
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
