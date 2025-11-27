const ESTADOS_MAP = {
  pendiente: { estado: "Pendiente", atendida: false },
  atendida: { estado: "Atendida", atendida: true },
  cancelada: { estado: "Cancelada", atendida: false }
};

const ESTADOS_VALIDOS = Object.values(ESTADOS_MAP).map((entry) => entry.estado);

const ESTADO_ERROR_MESSAGE = 'El campo estado debe ser "Pendiente", "Atendida" o "Cancelada"';

const coerceEstado = (valor) => {
  if (typeof valor !== "string") {
    return null;
  }

  const normalizado = valor.trim().toLowerCase();
  if (!normalizado) {
    return null;
  }

  return ESTADOS_MAP[normalizado] || null;
};

const ensureEstadoValido = (valor) => {
  const resultado = coerceEstado(valor);
  if (!resultado) {
    const error = new Error(ESTADO_ERROR_MESSAGE);
    error.status = 400;
    throw error;
  }

  return resultado;
};

const deriveEstadoDesdeAtendida = (atendida, estadoActual) => {
  if (typeof estadoActual === "string") {
    const resultado = coerceEstado(estadoActual);
    if (resultado) {
      return resultado.estado;
    }
  }

  return atendida ? ESTADOS_MAP.atendida.estado : ESTADOS_MAP.pendiente.estado;
};

module.exports = {
  ESTADOS_VALIDOS,
  ESTADO_ERROR_MESSAGE,
  coerceEstado,
  ensureEstadoValido,
  deriveEstadoDesdeAtendida
};
