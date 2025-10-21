"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";
  const serviceBase = "http://localhost:4002";

  if (window.location.protocol == "file:") {
    return serviceBase;
  }

  const host = window.location.hostname || "localhost";
  if (host === "localhost" || host === "127.0.0.1") {
    return serviceBase;
  }
  return `${window.location.protocol}//${window.location.host}/gestion`;
})();

const API_FALLBACK_URL =
  window.location.protocol === "file:" || window.location.hostname === "localhost"
    ? "http://localhost:5000/gestion"
    : null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = API_FALLBACK_URL ? `${API_FALLBACK_URL}/api` : null;
const LOGIN_PAGE = "login.html";

let usuarioActual = null;

const SLOT_DURATION_MINUTES = 45;
const HORARIO_BLOQUES = [
  { inicio: { horas: 9, minutos: 0 }, fin: { horas: 14, minutos: 0 } },
  { inicio: { horas: 15, minutos: 0 }, fin: { horas: 20, minutos: 0 } }
];

const DOW_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const agendaState = {
  selectedDate: new Date(),
  monthAnchor: null,
  professionalId: null,
  citas: [],
  citasPorDia: new Map(),
  searchTerm: "",
  loading: false,
  panelOpen: false,
  pacientes: [],
  slotSeleccionado: null,
  pacienteResultados: [],
  pacienteResultadoIndex: -1
};

const agendaElements = {
  professionalSelect: null,
  todayBtn: null,
  prevBtn: null,
  nextBtn: null,
  monthLabel: null,
  searchInput: null,
  dow: null,
  days: null,
  prettyDate: null,
  appointments: null,
  proBadge: null,
  totalBadge: null,
  sidePanel: null,
  closePanelBtn: null,
  panelBackdrop: null
};

const addAppointmentElements = {
  modal: null,
  form: null,
  pacientePicker: null,
  pacienteSearch: null,
  pacienteResults: null,
  pacienteIdInput: null,
  tipoInput: null,
  notasInput: null,
  dateInput: null,
  horaInput: null,
  feedback: null,
  cancelBtn: null,
  closeBtn: null
};

const capitalizar = (texto = "") => {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const normalizarIdentificador = (valor = "") =>
  valor
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const normalizarTextoPaciente = (texto = "") => normalizarIdentificador(texto);

const actualizarUsuarioLocal = (parciales = {}) => {
  if (!usuarioActual) {
    return;
  }
  usuarioActual = { ...usuarioActual, ...parciales };
  localStorage.setItem("bizihotzUsuario", JSON.stringify(usuarioActual));
};

const formatearNombrePaciente = (paciente = {}) =>
  `${paciente.nombrePaciente || ""} ${paciente.apellidos || ""}`.replace(/\s+/g, " ").trim();

