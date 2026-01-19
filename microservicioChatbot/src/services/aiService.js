const createError = require('http-errors');
const config = require('../config/env');

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

const MIN_AI_TIMEOUT_MS = 5000;
const MAX_AI_TIMEOUT_MS = 90000;

const parseNumber = (text, regexp, transformFn) => {
  const match = text.match(regexp);
  if (!match) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  if (Number.isNaN(value)) return null;
  return typeof transformFn === 'function' ? transformFn(value) : value;
};

const extractContextFromText = (text) => {
  const normalized = (text || '').toLowerCase();
  const context = {};
  context.weight = parseNumber(normalized, /(?:peso|pesa|kg)\D{0,6}(\d{2,3}(?:[\\.,]\d{1,2})?)/);
  context.height =
    parseNumber(normalized, /(?:altura|mide|talla)\D{0,6}(\d(?:[\\.,]\d{1,2})?)/, (val) =>
      val > 3 ? val / 100 : val
    ) ||
    parseNumber(normalized, /(\d{3})\s?cm/, (val) => val / 100);
  context.bmi = parseNumber(normalized, /imc\D{0,5}(\d{1,2}(?:[\\.,]\d{1,2})?)/);
  context.age = parseNumber(normalized, /(\d{1,3})\s?(?:a(?:n|\u00f1)os|edad)/);

  const goalMap = [
    { key: 'perder', words: ['perder', 'bajar', 'definir', 'adelgazar', 'reducir'] },
    { key: 'ganar', words: ['subir', 'ganar', 'masa', 'hipercalor', 'recuperar'] },
    { key: 'mantener', words: ['mantener', 'estabilizar'] },
  ];
  for (const entry of goalMap) {
    if (entry.words.some((w) => normalized.includes(w))) {
      context.goal = entry.key;
      break;
    }
  }

  const activityMap = [
    { key: 'sedentaria', words: ['sedent', 'reposo', 'cama', 'hospital'] },
    { key: 'ligera', words: ['ligera', 'poco activo', 'caminar', 'oficina'] },
    { key: 'moderada', words: ['moderada', '3-4', 'gimnasio', 'actividad media'] },
    { key: 'intensa', words: ['intensa', 'deport', 'crossfit', 'compet', '5-6'] },
  ];
  for (const entry of activityMap) {
    if (entry.words.some((w) => normalized.includes(w))) {
      context.activity = entry.key;
      break;
    }
  }

  const conditions = [];
  const conditionCatalog = [
    { key: 'diabetes', words: ['diabetes', 'dm2', 'dm1', 'glucem', 'hb1'] },
    { key: 'erc', words: ['renal', 'erc', 'dialisis', 'creatinina', 'fg'] },
    { key: 'hta', words: ['hta', 'hipertension', 'presion'] },
    { key: 'dislipemia', words: ['dislip', 'colesterol', 'triglicer'] },
    { key: 'oncologia', words: ['onco', 'tumor', 'quimio', 'radio'] },
    { key: 'fragilidad', words: ['fragil', 'sarcopen', 'caidas', 'dependencia'] },
    { key: 'tca', words: ['tca', 'trastorno aliment', 'anorex', 'bulim'] },
    { key: 'gestacion', words: ['embarazo', 'gestante', 'lactancia'] },
  ];
  conditionCatalog.forEach((cond) => {
    if (cond.words.some((w) => normalized.includes(w))) {
      conditions.push(cond.key);
    }
  });
  if (conditions.length) context.conditions = conditions;

  const allergies = [];
  const allergyWords = ['alerg', 'intoler', 'celia', 'gluten', 'lactosa', 'fruto seco', 'cacahu'];
  allergyWords.forEach((word) => {
    if (normalized.includes(word)) allergies.push(word);
  });
  if (allergies.length) context.allergies = allergies;

  const symptoms = [];
  const symptomMap = [
    'perdida de peso',
    'vomito',
    'nausea',
    'diarrea',
    'estrenimiento',
    'edema',
    'disfagia',
    'fiebre',
    'sarcopen',
  ];
  symptomMap.forEach((word) => {
    if (normalized.includes(word)) symptoms.push(word);
  });
  if (symptoms.length) context.symptoms = symptoms;

  return context;
};

const mergeContexts = (history, latestContext) => {
  const combined = {};
  const apply = (ctx) => {
    if (!ctx) return;
    Object.entries(ctx).forEach(([key, value]) => {
      if (value !== undefined && value !== null && (!Array.isArray(value) || value.length)) {
        combined[key] = value;
      }
    });
  };
  const previous = history
    .filter((msg) => msg.role === 'user')
    .map((msg) => extractContextFromText(msg.text))
    .reduce((acc, ctx) => Object.assign(acc, ctx), {});
  apply(previous);
  apply(latestContext);
  return combined;
};

const categorizeBmi = (bmi) => {
  if (!bmi || bmi <= 0) return { label: 'IMC no calculado', risk: 'sin datos' };
  if (bmi < 17) return { label: 'IMC muy bajo', risk: 'alto riesgo de desnutricion' };
  if (bmi < 18.5) return { label: 'IMC bajo', risk: 'riesgo de desnutricion' };
  if (bmi < 25) return { label: 'IMC saludable', risk: 'riesgo basal' };
  if (bmi < 30) return { label: 'Sobrepeso', risk: 'riesgo cardiometabolico moderado' };
  if (bmi < 35) return { label: 'Obesidad grado I', risk: 'riesgo cardiometabolico' };
  if (bmi < 40) return { label: 'Obesidad grado II', risk: 'riesgo alto' };
  return { label: 'Obesidad grado III', risk: 'riesgo muy alto' };
};

const estimateEnergy = (weight, bmi, goal, activity) => {
  if (!weight) return null;
  let kcalPerKg;
  if (bmi && bmi < 18.5) {
    kcalPerKg = [30, 35];
  } else if (goal === 'ganar') {
    kcalPerKg = [30, 35];
  } else if (goal === 'perder' && bmi && bmi >= 25) {
    kcalPerKg = [20, 25];
  } else {
    kcalPerKg = [23, 30];
  }

  const activityFactor =
    activity === 'intensa'
      ? 1.15
      : activity === 'moderada'
        ? 1.08
        : activity === 'sedentaria'
          ? 0.97
          : 1;

  const kcalMin = Math.round(kcalPerKg[0] * weight * activityFactor);
  const kcalMax = Math.round(kcalPerKg[1] * weight * activityFactor);

  return { kcalMin, kcalMax, kcalPerKg };
};

const estimateProtein = (weight, bmi, age, goal, conditions = []) => {
  if (!weight) return null;
  const highNeed = bmi && bmi < 20 ? 1.2 : 1.0;
  const riskCondition = conditions.some((c) =>
    ['oncologia', 'erc', 'fragilidad', 'tca'].includes(c)
  );
  const lower = Math.max(1.0, highNeed);
  const upper = riskCondition ? 1.6 : goal === 'perder' ? 1.5 : 1.3;
  const gMin = Math.round(lower * weight);
  const gMax = Math.round(upper * weight);
  return { range: `${lower.toFixed(1)}-${upper.toFixed(1)} g/kg`, grams: `${gMin}-${gMax} g/dia` };
};

const buildHeuristicReply = (userInput, history) => {
  const latestContext = extractContextFromText(userInput);
  const context = mergeContexts(history || [], latestContext);

  const weight = context.weight;
  const height = context.height;
  let bmi = context.bmi;
  if (!bmi && weight && height) {
    bmi = +(weight / Math.pow(height, 2)).toFixed(1);
    context.bmi = bmi;
  }
  const bmiLabel = categorizeBmi(bmi);

  const missing = [];
  if (!weight || !height) missing.push('Peso y altura exactos para calcular IMC y necesidades');
  if (!context.goal) missing.push('Objetivo (ganar, mantener, perder peso o control sintomatologia)');
  if (!context.activity) missing.push('Nivel de actividad o movilidad');
  if (!context.age) missing.push('Edad (prioriza >65 anos)');
  if (!context.conditions?.length) missing.push('Patologias relevantes (diabetes, ERC, HTA, onco, etc.)');
  if (!context.allergies?.length) missing.push('Alergias/intolerancias y preferencias');
  if (!context.symptoms?.length) missing.push('Sintomas recientes (perdida peso, apetito, digestivos)');
  missing.push('Analitica relevante (HbA1c, alb/prealb, perfil lipidico, funcion renal/hepatica)');

  const energy = estimateEnergy(weight, bmi, context.goal, context.activity);
  const protein = estimateProtein(weight, bmi, context.age, context.goal, context.conditions || []);

  const assessment = [];
  if (bmi) {
    assessment.push(`IMC ${bmi.toFixed(1)} (${bmiLabel.label}; ${bmiLabel.risk}).`);
  } else {
    assessment.push('IMC sin calcular por falta de datos.');
  }
  if (context.goal) assessment.push(`Objetivo declarado: ${context.goal}.`);
  if (context.activity) assessment.push(`Actividad: ${context.activity}.`);
  if (context.conditions?.length) assessment.push(`Patologias a considerar: ${context.conditions.join(', ')}.`);
  if (context.symptoms?.length) assessment.push(`Sintomas referidos: ${context.symptoms.join(', ')}.`);
  if (context.allergies?.length) assessment.push(`Alergias/intolerancias: ${context.allergies.join(', ')}.`);

  const recommendation = [];
  if (energy) {
    recommendation.push(
      `Energia objetivo: ${energy.kcalMin}-${energy.kcalMax} kcal/dia (${energy.kcalPerKg[0]}-${energy.kcalPerKg[1]} kcal/kg ajustado a actividad).`
    );
  } else {
    recommendation.push('Energia: aportar 25-30 kcal/kg/dia y ajustar segun apetito/objetivo.');
  }
  if (protein) {
    recommendation.push(`Proteina: ${protein.range} (${protein.grams}). Prioriza reparto 3-4 tomas ricas en proteina.`);
  } else {
    recommendation.push('Proteina: 1.0-1.3 g/kg/dia (sube a 1.4-1.6 g/kg si perdida de peso, sarcopenia o onco).');
  }
  recommendation.push(
    'Hidratos/fibra: 40-50% de kcal con grano integral si lo tolera; ajustar si hay control glucemico.'
  );
  recommendation.push('Grasas: 30-35% priorizando AOVE, frutos secos y pescado azul 2-3/sem.');
  recommendation.push('Liquidos: 30-35 ml/kg/dia salvo restriccion. Reforzar en fiebre/diarrea.');

  const actions = [];
  if (bmi && bmi < 18.5) {
    actions.push(
      'Anade 2-3 tomas hipercaloricas (batido con leche entera/proteina, frutos secos, AOVE) para lograr superavit suave.'
    );
    actions.push(
      'Fortifica platos: +1-2 cucharadas de AOVE o frutos secos molidos por racion; postre lacteo entero o yogur griego.'
    );
  } else if (context.goal === 'perder') {
    actions.push('Busca deficit moderado (~400-600 kcal/dia) manteniendo proteina alta y 25-30 g fibra/dia.');
    actions.push('Estructura 3 comidas + 1-2 colaciones de proteina (yogur griego, queso fresco batido, huevo).');
  } else {
    actions.push('Manten 3 comidas + 1-2 colaciones proteicas; planifica hidratos alrededor de actividad.');
    actions.push('Incluye plato saludable: 1/2 verdura, 1/4 proteina magra, 1/4 cereal/tuberculo + grasa saludable.');
  }
  actions.push('Revisa peso semanal y sintomas; ajusta 150-200 kcal segun tendencia (subida/bajada >0.5 kg/sem).');
  actions.push('Si hay diabetes: prioriza hidratos complejos, distribuye raciones y revisa hipoglucemias.');
  actions.push('Si ERC: controla proteina al rango bajo del objetivo y limita sodio/fosforo si aplica.');

  const alerts = [];
  if (bmi && bmi < 17) {
    alerts.push('IMC <17: valorar desnutricion severa; considerar derivacion o soporte enteral/ONS.');
  }
  alerts.push('Perdida >5% peso en 1 mes o >10% en 6 meses: requiere valoracion completa.');
  alerts.push('Vomitos persistentes, diarrea >48h, disfagia, edemas generalizados o signos de TCA: derivar/coordinar con medico.');
  alerts.push('El asistente no sustituye valoracion clinica; confirma con historial y exploracion.');

  const blocks = [];
  blocks.push('Evaluacion rapida:');
  assessment.forEach((line) => blocks.push(`- ${line}`));
  blocks.push('');
  blocks.push('Datos que faltan / preguntas clave:');
  missing.forEach((item) => blocks.push(`- ${item}`));
  blocks.push('');
  blocks.push('Recomendacion principal:');
  recommendation.forEach((line) => blocks.push(`- ${line}`));
  blocks.push('');
  blocks.push('Opciones practicas:');
  actions.forEach((line) => blocks.push(`- ${line}`));
  blocks.push('');
  blocks.push('Alertas / derivacion:');
  alerts.forEach((line) => blocks.push(`- ${line}`));

  return blocks.join('\n');
};

const isChatCompletionsUrl = (url = '') => /\/chat\/completions\/?$/.test(url);

const clampTimeout = (timeout) => {
  const numeric = Number(timeout) || 0;
  if (!Number.isFinite(numeric) || numeric <= 0) return 15000;
  return Math.min(Math.max(numeric, MIN_AI_TIMEOUT_MS), MAX_AI_TIMEOUT_MS);
};

const normalizeAiError = (err, fallbackStatus = 503) => {
  if (err?.status && err.status >= 400 && err.status < 600) return err;
  const message =
    err?.message && typeof err.message === 'string'
      ? `No se pudo contactar con el proveedor de IA: ${err.message}`
      : 'No se pudo contactar con el proveedor de IA';
  return createError(fallbackStatus, message);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildChatMessages = (input = []) =>
  input.map((msg) => ({
    role: msg.role,
    content: (msg.content || [])
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n'),
  }));

const buildAiTargets = () => {
  const raw = process.env.AI_API_URLS || config.aiApiUrl || '';
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
    )
  );
};

const extractTextFromResponse = (data) => {
  if (!data) return '';
  if (typeof data.output_text === 'string') return data.output_text;

  const texts = [];
  const outputArray = Array.isArray(data.output) ? data.output : [];

  outputArray.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      texts.push(item);
      return;
    }
    if (typeof item.output_text === 'string') {
      texts.push(item.output_text);
    }
    if (typeof item.text === 'string') {
      texts.push(item.text);
    }
    if (item?.type === 'output_text' && typeof item.text === 'string') {
      texts.push(item.text);
    }
    const contentArray = Array.isArray(item?.content) ? item.content : [];
    contentArray.forEach((content) => {
      if (
        (content?.type === 'output_text' || content?.type === 'text') &&
        typeof content.text === 'string'
      ) {
        texts.push(content.text);
      }
    });
  });

  if (texts.length) return texts.join('\n').trim();

  const choiceText =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text;
  if (choiceText) return choiceText;

  if (typeof data.text === 'string') return data.text;
  if (typeof data.message === 'string') return data.message;

  return '';
};

const callExternalAI = async (userText, session) => {
  const targets = buildAiTargets();
  if (!targets.length) {
    throw createError(400, 'AI_API_URL no configurado');
  }
  const timeoutMs = clampTimeout(config.aiTimeoutMs);

const defaultPrompt =
  'Eres un asistente de nutricion clinica. Responde con recomendaciones claras, estructuradas y prudentes.';

const systemPrompt = (config.aiSystemPrompt && String(config.aiSystemPrompt).trim()
  ? String(config.aiSystemPrompt)
  : defaultPrompt
)
  .replace(/\\n/g, '\n')
  .trim();
  const contextPrompt = session
    ? `Contexto: sesion ${session.id || ''}; participantes: ${(session.participantes || []).join(', ')}.`
    : null;

  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: systemPrompt }],
    },
  ];

  if (contextPrompt) {
    input.push({
      role: 'system',
      content: [{ type: 'input_text', text: contextPrompt }],
    });
  }

  input.push({
    role: 'user',
    content: [{ type: 'input_text', text: userText }],
  });

  const headers = { 'Content-Type': 'application/json' };
  if (config.aiApiKey) {
    headers.Authorization = `Bearer ${config.aiApiKey}`;
  }

  let lastError = null;
  const retries = Math.max(1, Number(config.aiRetries) || 1);

  for (const target of targets) {
    const useChatCompletions = isChatCompletionsUrl(target);
    const maxTokens =
      Number.isFinite(config.aiMaxTokens) && config.aiMaxTokens > 0 ? config.aiMaxTokens : undefined;
    const temperature =
      Number.isFinite(config.aiTemperature) && config.aiTemperature >= 0 ? config.aiTemperature : undefined;
    const payload = useChatCompletions
      ? {
          model: config.aiModel || 'default',
          messages: buildChatMessages(input),
          stream: false,
          ...(config.aiMaxTokens ? { max_tokens: config.aiMaxTokens } : {}),
          ...(typeof config.aiTemperature === 'number' ? { temperature: config.aiTemperature } : {}),
        }
      : { model: config.aiModel || 'default', input };

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const res = await fetchWithTimeout(
          target,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
          timeoutMs
        );

        if (!res.ok) {
          const text = await res.text();
          // Para errores de cliente, no intentamos siguientes targets.
          if (res.status >= 400 && res.status < 500) {
            throw createError(res.status, text || 'AI provider rejected request');
          }
          lastError = createError(res.status, text || 'AI provider rejected request');
          if (attempt < retries) {
            await sleep(300 * attempt);
            continue;
          }
          break;
        }

        const data = await res.json().catch(() => ({}));
        const text = extractTextFromResponse(data) || JSON.stringify(data);

        if (!text) {
          throw createError(502, 'AI provider returned empty response');
        }
        return text.toString();
      } catch (err) {
        // Guardamos y probamos siguiente intento o target en caso de fallo de red/servidor.
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }
        lastError = err;
        if (attempt < retries) {
          await sleep(300 * attempt);
          continue;
        }
      }
    }
  }

  const errorToThrow = lastError || createError(502, 'No se pudo contactar con el proveedor de IA');
  throw normalizeAiError(errorToThrow, 502);
};

const generateReply = async (userText, _history = [], session = null) => {
  const buildFallback = () => buildHeuristicReply(userText, _history);
  const fallbackEnabled = Boolean(config.aiFallbackEnabled);

  if (!config.aiApiUrl) {
    if (fallbackEnabled) return buildFallback();
    throw createError(500, 'AI_API_URL no configurado');
  }

  try {
    return await callExternalAI(userText, session);
  } catch (err) {
    if (fallbackEnabled) {
      console.warn('[aiService] Fallback heuristico por fallo de IA:', err?.message || err);
      return buildFallback();
    }
    throw normalizeAiError(err);
  }
};

module.exports = {
  generateReply,
};
