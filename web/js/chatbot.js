(function () {
  "use strict";

  if (window.BizihotzChatbotLoaded) return;
  window.BizihotzChatbotLoaded = true;

  const scriptEl =
    document.currentScript ||
    (document && document.querySelector('script[src$="chatbot.js"], script[src*="/chatbot.js"]'));
  const ASSETS_BASE = (() => {
    try {
      return scriptEl ? new URL("../images/", scriptEl.src).href : "images/";
    } catch (err) {
      return "images/";
    }
  })();
  const CHAT_LOGO = new URL("2.png", ASSETS_BASE).href;

const DEFAULT_ASSISTANT_GREETING =
  "Hola, soy tu asistente de nutrición clínica. Puedo ayudarte a calcular el IMC, ajustar calorías y macronutrientes, y ofrecerte recomendaciones personalizadas basadas en tu situación. " +
  "Si quieres, dime datos como edad, peso, altura, objetivo, patologías, síntomas, analítica, medicación, alergias o preferencias alimentarias, y te devolveré un plan estructurado y claro.";


  const DEFAULT_USER_NAME = "Tu";
  const BOT_NAME = "BizIA";

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem("bizihotzUsuario");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("No se pudo leer usuario local", err);
      return null;
    }
  };

  const resolveUserId = (user) => {
    if (!user) return null;
    return (
      user._id ||
      user.id ||
      user.idUsuario ||
      user.usuarioId ||
      user.userId ||
      user.uid ||
      user.ID ||
      null
    );
  };

  const dedupe = (items) => {
    const seen = new Set();
    return items
      .filter(Boolean)
      .map((val) => val.replace(/\/+$/, ""))
      .filter((val) => {
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
      });
  };

  const buildChatbotBases = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase();
    const port = window.location.port;
    const isLocal = !hostname || hostname === "localhost" || hostname === "127.0.0.1";
    const targetHost = isLocal ? "localhost" : hostname;

    const candidates = [
      `${protocol}//${targetHost}:5000/chatbot`, // via gateway (si existe)
      `${protocol}//${targetHost}:4701` // microservicio directo
    ];
    if (port && (port === "4701" || port === "5000")) {
      candidates.unshift(`${protocol}//${targetHost}:${port}${port === "4701" ? "" : "/chatbot"}`);
    }
    if (!port || port === "80" || port === "443") {
      candidates.push(`${protocol}//${targetHost}/chatbot`);
    }
    return dedupe(candidates);
  };

  const CHATBOT_BASES = buildChatbotBases().map((base) => `${base}/api`);

  const requestChatbot = async (path, options = {}) => {
    let lastError = null;
    for (const base of CHATBOT_BASES) {
      try {
        const res = await fetch(`${base}${path}`, options);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const contentType = res.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          return await res.json();
        }
        return await res.text();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo contactar con el microservicio de chatbot.");
  };

  const parseNumber = (text, regexp, transformFn) => {
    const match = text.match(regexp);
    if (!match) return null;
    const value = parseFloat(match[1].replace(",", "."));
    if (Number.isNaN(value)) return null;
    return typeof transformFn === "function" ? transformFn(value) : value;
  };

  const extractContextFromText = (text) => {
    const normalized = (text || "").toLowerCase();
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
      { key: "perder", words: ["perder", "bajar", "definir", "adelgazar", "reducir"] },
      { key: "ganar", words: ["subir", "ganar", "masa", "hipercalor", "recuperar"] },
      { key: "mantener", words: ["mantener", "estabilizar"] }
    ];
    for (const entry of goalMap) {
      if (entry.words.some((w) => normalized.includes(w))) {
        context.goal = entry.key;
        break;
      }
    }

    const activityMap = [
      { key: "sedentaria", words: ["sedent", "reposo", "cama", "hospital"] },
      { key: "ligera", words: ["ligera", "poco activo", "caminar", "oficina"] },
      { key: "moderada", words: ["moderada", "3-4", "gimnasio", "actividad media"] },
      { key: "intensa", words: ["intensa", "deport", "crossfit", "compet", "5-6"] }
    ];
    for (const entry of activityMap) {
      if (entry.words.some((w) => normalized.includes(w))) {
        context.activity = entry.key;
        break;
      }
    }

    const sexMap = [
      { key: "femenino", words: ["mujer", "femenina", "femenino"] },
      { key: "masculino", words: ["hombre", "varon", "masculino"] }
    ];
    for (const entry of sexMap) {
      if (entry.words.some((w) => normalized.includes(w))) {
        context.sex = entry.key;
        break;
      }
    }

    const conditions = [];
    const conditionCatalog = [
      { key: "diabetes", words: ["diabetes", "dm2", "dm1", "glucem", "hb1"] },
      { key: "erc", words: ["renal", "erc", "dialisis", "creatinina", "fg"] },
      { key: "hta", words: ["hta", "hipertension", "presion"] },
      { key: "dislipemia", words: ["dislip", "colesterol", "triglicer"] },
      { key: "oncologia", words: ["onco", "tumor", "quimio", "radio"] },
      { key: "fragilidad", words: ["fragil", "sarcopen", "caidas", "dependencia"] },
      { key: "tca", words: ["tca", "trastorno aliment", "anorex", "bulim"] },
      { key: "gestacion", words: ["embarazo", "gestante", "lactancia"] }
    ];
    conditionCatalog.forEach((cond) => {
      if (cond.words.some((w) => normalized.includes(w))) {
        conditions.push(cond.key);
      }
    });
    if (conditions.length) context.conditions = conditions;

    const allergies = [];
    const allergyWords = ["alerg", "intoler", "celia", "gluten", "lactosa", "fruto seco", "cacahu"];
    allergyWords.forEach((word) => {
      if (normalized.includes(word)) allergies.push(word);
    });
    if (allergies.length) context.allergies = allergies;

    const symptoms = [];
    const symptomMap = [
      "perdida de peso",
      "vomito",
      "nausea",
      "diarrea",
      "estrenimiento",
      "edema",
      "disfagia",
      "fiebre",
      "sarcopen"
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
      .filter((msg) => msg.role === "user")
      .map((msg) => extractContextFromText(msg.text))
      .reduce((acc, ctx) => Object.assign(acc, ctx), {});
    apply(previous);
    apply(latestContext);
    return combined;
  };

  const categorizeBmi = (bmi) => {
    if (!bmi || bmi <= 0) return { label: "IMC no calculado", risk: "sin datos" };
    if (bmi < 17) return { label: "IMC muy bajo", risk: "alto riesgo de desnutrición" };
    if (bmi < 18.5) return { label: "IMC bajo", risk: "riesgo de desnutrición" };
    if (bmi < 25) return { label: "IMC saludable", risk: "riesgo basal" };
    if (bmi < 30) return { label: "Sobrepeso", risk: "riesgo cardiometabolico moderado" };
    if (bmi < 35) return { label: "Obesidad grado I", risk: "riesgo cardiometabolico" };
    if (bmi < 40) return { label: "Obesidad grado II", risk: "riesgo alto" };
    return { label: "Obesidad grado III", risk: "riesgo muy alto" };
  };

  const estimateEnergy = (weight, bmi, goal, activity) => {
    if (!weight) return null;
    let kcalPerKg;
    if (bmi && bmi < 18.5) {
      kcalPerKg = [30, 35];
    } else if (goal === "ganar") {
      kcalPerKg = [30, 35];
    } else if (goal === "perder" && bmi && bmi >= 25) {
      kcalPerKg = [20, 25];
    } else {
      kcalPerKg = [23, 30];
    }

    const activityFactor =
      activity === "intensa"
        ? 1.15
        : activity === "moderada"
          ? 1.08
          : activity === "sedentaria"
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
      ["oncologia", "erc", "fragilidad", "tca"].includes(c)
    );
    const lower = Math.max(1.0, highNeed);
    const upper = riskCondition ? 1.6 : goal === "perder" ? 1.5 : 1.3;
    const gMin = Math.round(lower * weight);
    const gMax = Math.round(upper * weight);
    return { range: `${lower.toFixed(1)}-${upper.toFixed(1)} g/kg`, grams: `${gMin}-${gMax} g/dia` };
  };

  const buildResponse = (userInput, history) => {
    const latestContext = extractContextFromText(userInput);
    const context = mergeContexts(history, latestContext);

    const weight = context.weight;
    const height = context.height;
    let bmi = context.bmi;
    if (!bmi && weight && height) {
      bmi = +(weight / Math.pow(height, 2)).toFixed(1);
      context.bmi = bmi;
    }
    const bmiLabel = categorizeBmi(bmi);

    const missing = [];
    if (!weight || !height) missing.push("Peso y altura exactos para calcular IMC y necesidades");
    if (!context.goal) missing.push("Objetivo (ganar, mantener, perder peso o control sintomatologia)");
    if (!context.activity) missing.push("Nivel de actividad o movilidad");
    if (!context.age) missing.push("Edad (prioriza >65 anos)");
    if (!context.conditions?.length) missing.push("Patologias relevantes (diabetes, ERC, HTA, onco, etc.)");
    if (!context.allergies?.length) missing.push("Alergias/intolerancias y preferencias");
    if (!context.symptoms?.length) missing.push("Sintomas recientes (perdida peso, apetito, digestivos)");
    missing.push("Analitica relevante (HbA1c, alb/prealb, perfil lipidico, funcion renal/hepatica)");

    const energy = estimateEnergy(weight, bmi, context.goal, context.activity);
    const protein = estimateProtein(weight, bmi, context.age, context.goal, context.conditions || []);

    const assessment = [];
    if (bmi) {
      assessment.push(`IMC ${bmi.toFixed(1)} (${bmiLabel.label}; ${bmiLabel.risk}).`);
    } else {
      assessment.push("IMC sin calcular por falta de datos.");
    }
    if (context.goal) assessment.push(`Objetivo declarado: ${context.goal}.`);
    if (context.activity) assessment.push(`Actividad: ${context.activity}.`);
    if (context.conditions?.length) assessment.push(`Patologias a considerar: ${context.conditions.join(", ")}.`);
    if (context.symptoms?.length) assessment.push(`Sintomas referidos: ${context.symptoms.join(", ")}.`);
    if (context.allergies?.length) assessment.push(`Alergias/intolerancias: ${context.allergies.join(", ")}.`);

    const recommendation = [];
    if (energy) {
      recommendation.push(
        `Energía objetivo: ${energy.kcalMin}-${energy.kcalMax} kcal/día (${energy.kcalPerKg[0]}-${energy.kcalPerKg[1]} kcal/kg ajustado a actividad).`
      );
    } else {
      recommendation.push("Energía: aportar 25-30 kcal/kg/día y ajustar según apetito/objetivo.");
    }
    if (protein) {
      recommendation.push(`Proteína: ${protein.range} (${protein.grams}). Prioriza reparto 3-4 tomas ricas en proteína.`);
    } else {
      recommendation.push("Proteína: 1.0-1.3 g/kg/dia (sube a 1.4-1.6 g/kg si perdida de peso, sarcopenia o onco).");
    }
    recommendation.push(
      "Hidratos/fibra: 40-50% de kcal con grano integral si lo tolera; ajustar si hay control glucemico."
    );
    recommendation.push("Grasas: 30-35% priorizando AOVE, frutos secos y pescado azul 2-3/sem.");
    recommendation.push("Liquidos: 30-35 ml/kg/dia salvo restriccion. Reforzar en fiebre/diarrea.");

    const actions = [];
    if (bmi && bmi < 18.5) {
      actions.push("Anade 2-3 tomas hipercaloricas (batido con leche entera/proteina, frutos secos, AOVE) para lograr superavit suave.");
      actions.push("Fortifica platos: +1-2 cucharadas de AOVE o frutos secos molidos por racion; postre lacteo entero o yogur griego.");
    } else if (context.goal === "perder") {
      actions.push("Busca deficit moderado (~400-600 kcal/dia) manteniendo proteina alta y 25-30 g fibra/dia.");
      actions.push("Estructura 3 comidas + 1-2 colaciones de proteina (yogur griego, queso fresco batido, huevo).");
    } else {
      actions.push("Manten 3 comidas + 1-2 colaciones proteicas; planifica hidratos alrededor de actividad.");
      actions.push("Incluye plato saludable: 1/2 verdura, 1/4 proteina magra, 1/4 cereal/tuberculo + grasa saludable.");
    }
    actions.push("Revisa peso semanal y sintomas; ajusta 150-200 kcal segun tendencia (subida/bajada >0.5 kg/sem).");
    actions.push("Si hay diabetes: prioriza hidratos complejos, distribuye raciones y revisa hipoglucemias.");
    actions.push("Si ERC: controla proteina al rango bajo del objetivo y limita sodio/fosforo si aplica.");

    const alerts = [];
    if (bmi && bmi < 17) {
      alerts.push("IMC <17: valorar desnutrición severa; considerar derivación o soporte enteral/ONS.");
    }
    alerts.push("Pérdida >5% peso en 1 mes o >10% en 6 meses: requiere valoración completa.");
    alerts.push("Vómitos persistentes, diarrea >48h, disfagia, edemas generalizados o signos de TCA: derivar/coordinar con médico.");
    alerts.push("El asistente no sustituye valoración clínica; confirma con historial y exploración.");

    const blocks = [];
    blocks.push("Evaluación rápida:");
    assessment.forEach((line) => blocks.push("- " + line));
    blocks.push("");
    blocks.push("Datos que faltan / preguntas clave:");
    missing.forEach((item) => blocks.push("- " + item));
    blocks.push("");
    blocks.push("Recomendación principal:");
    recommendation.forEach((line) => blocks.push("- " + line));
    blocks.push("");
    blocks.push("Opciones prácticas:");
    actions.forEach((line) => blocks.push("- " + line));
    blocks.push("");
    blocks.push("Alertas / derivación:");
    alerts.forEach((line) => blocks.push("- " + line));

    return blocks.join("\n");
  };

  const createUI = () => {
    const container = document.createElement("div");
    container.className = "bh-chatbot";

    const launcher = document.createElement("button");
    launcher.className = "bh-chat-launcher";
    launcher.setAttribute("aria-label", "Abrir asistente de nutrición");
    launcher.setAttribute("title", "Abrir asistente de nutrición");
    launcher.innerHTML = `<img src="${CHAT_LOGO}" alt="Logo Bizihotz" class="bh-chat-launcher__logo" />`;

    const panel = document.createElement("section");
    panel.className = "bh-chat-panel";
    panel.hidden = true;

    const header = document.createElement("header");
    header.className = "bh-chat-panel__header";
    const brand = document.createElement("div");
    brand.className = "bh-chat-panel__brand";
    const brandImg = document.createElement("img");
    brandImg.src = CHAT_LOGO;
    brandImg.alt = "Bizihotz chatbot";
    brandImg.className = "bh-chat-brand__logo";
    brand.appendChild(brandImg);
    const titleWrap = document.createElement("div");
    const title = document.createElement("p");
    title.className = "bh-chat-panel__title";
    title.textContent = "BizIA";
    const subtitle = document.createElement("p");
    subtitle.className = "bh-chat-panel__subtitle";
    subtitle.textContent = "Asistente nutricional";
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    const actions = document.createElement("div");
    actions.className = "bh-chat-panel__actions";
    const closeBtn = document.createElement("button");
    closeBtn.className = "bh-chat-icon-btn";
    closeBtn.setAttribute("aria-label", "Cerrar asistente");
    closeBtn.innerHTML = "&times;";
    actions.appendChild(closeBtn);
    header.appendChild(brand);
    header.appendChild(titleWrap);
    header.appendChild(actions);

    const body = document.createElement("div");
    body.className = "bh-chat-panel__body";

    const status = document.createElement("div");
    status.className = "bh-chat-panel__status is-hidden";
    status.textContent = "";

    const threadbar = document.createElement("div");
    threadbar.className = "bh-chat-threadbar";
    const threadSelect = document.createElement("select");
    threadSelect.className = "bh-chat-select";
    threadSelect.setAttribute("aria-label", "Conversaciones");
    threadSelect.hidden = true;
    const threadButton = document.createElement("button");
    threadButton.type = "button";
    threadButton.className = "bh-chat-session-btn";
    threadButton.textContent = "Sesiones";
    const threadActions = document.createElement("div");
    threadActions.className = "bh-chat-thread-actions";
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "bh-chat-btn bh-chat-btn--icon";
    renameBtn.setAttribute("aria-label", "Renombrar conversacion");
    renameBtn.innerHTML =
      '<svg class="bh-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0 0-3l-1-1a2.12 2.12 0 0 0-3 0L4 16v4Z"/>' +
      '<path d="M13.5 6.5 17.5 10.5"/>' +
      "</svg>";
    const newThreadBtn = document.createElement("button");
    newThreadBtn.type = "button";
    newThreadBtn.className = "bh-chat-btn bh-chat-btn--icon";
    newThreadBtn.setAttribute("aria-label", "Nueva conversacion");
    newThreadBtn.innerHTML =
      '<svg class="bh-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="8"/>' +
      '<path d="M12 8v8M8 12h8"/>' +
      "</svg>";
    const deleteThreadBtn = document.createElement("button");
    deleteThreadBtn.type = "button";
    deleteThreadBtn.className = "bh-chat-btn bh-chat-btn--icon";
    deleteThreadBtn.setAttribute("aria-label", "Borrar conversacion");
    deleteThreadBtn.innerHTML =
      '<svg class="bh-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6h16"/>' +
      '<path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6"/>' +
      '<path d="M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/>' +
      '<path d="M10 10v6M14 10v6"/>' +
      "</svg>";
    threadActions.appendChild(renameBtn);
    threadActions.appendChild(newThreadBtn);
    threadActions.appendChild(deleteThreadBtn);
    threadbar.appendChild(threadButton);
    threadbar.appendChild(threadActions);

    const historyBox = document.createElement("div");
    historyBox.className = "bh-chat-history";
    const historyTitle = document.createElement("p");
    historyTitle.className = "bh-chat-history__title";
    historyTitle.textContent = "Historial de conversaciones";
    const historyList = document.createElement("div");
    historyList.className = "bh-chat-history__list";
    historyBox.appendChild(historyTitle);
    historyBox.appendChild(historyList);

    const historyModal = document.createElement("div");
    historyModal.className = "bh-chat-modal";
    historyModal.hidden = true;
    const historyModalCard = document.createElement("div");
    historyModalCard.className = "bh-chat-modal__card";
    const historyModalHeader = document.createElement("div");
    historyModalHeader.className = "bh-chat-modal__header";
    const historyModalTitle = document.createElement("p");
    historyModalTitle.className = "bh-chat-modal__title";
    historyModalTitle.textContent = "Historial de conversaciones";
    const historyModalClose = document.createElement("button");
    historyModalClose.type = "button";
    historyModalClose.className = "bh-chat-icon-btn bh-chat-modal__close";
    historyModalClose.innerHTML = "&times;";
    historyModalHeader.appendChild(historyModalTitle);
    historyModalHeader.appendChild(historyModalClose);
    const historyModalList = document.createElement("div");
    historyModalList.className = "bh-chat-history__list bh-chat-history__list--modal";
    historyModalCard.appendChild(historyModalHeader);
    historyModalCard.appendChild(historyModalList);
    historyModal.appendChild(historyModalCard);

    const renameModal = document.createElement("div");
    renameModal.className = "bh-chat-modal";
    renameModal.hidden = true;
    const renameCard = document.createElement("div");
    renameCard.className = "bh-chat-modal__card";
    const renameHeader = document.createElement("div");
    renameHeader.className = "bh-chat-modal__header";
    const renameTitle = document.createElement("p");
    renameTitle.className = "bh-chat-modal__title";
    renameTitle.textContent = "Renombrar sesión";
    const renameClose = document.createElement("button");
    renameClose.type = "button";
    renameClose.className = "bh-chat-icon-btn bh-chat-modal__close";
    renameClose.innerHTML = "&times;";
    renameHeader.appendChild(renameTitle);
    renameHeader.appendChild(renameClose);
    const renameBody = document.createElement("div");
    renameBody.className = "bh-chat-modal__body";
    const renameLabel = document.createElement("label");
    renameLabel.textContent = "Nuevo título";
    const renameInput = document.createElement("input");
    renameInput.type = "text";
    renameInput.className = "bh-chat-input__field";
    renameInput.placeholder = "Sesión chatbot";
    renameBody.appendChild(renameLabel);
    renameBody.appendChild(renameInput);
    const renameActions = document.createElement("div");
    renameActions.className = "bh-chat-modal__actions";
    const renameCancel = document.createElement("button");
    renameCancel.type = "button";
    renameCancel.className = "bh-chat-btn bh-chat-btn--ghost";
    renameCancel.textContent = "Cancelar";
    const renameSave = document.createElement("button");
    renameSave.type = "button";
    renameSave.className = "bh-chat-btn bh-chat-btn--primary";
    renameSave.textContent = "Guardar";
    renameActions.appendChild(renameCancel);
    renameActions.appendChild(renameSave);
    renameCard.appendChild(renameHeader);
    renameCard.appendChild(renameBody);
    renameCard.appendChild(renameActions);
    renameModal.appendChild(renameCard);

    const messagesList = document.createElement("div");
    messagesList.className = "bh-chat-messages";

    const inputWrap = document.createElement("div");
    inputWrap.className = "bh-chat-input";
    const textarea = document.createElement("textarea");
    textarea.placeholder = "Describe el caso (IMC, objetivo, sintomas, patologias)...";
    textarea.setAttribute("rows", "3");
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "bh-chat-send";
    sendBtn.textContent = "Enviar";
    inputWrap.appendChild(textarea);
    inputWrap.appendChild(sendBtn);

    const disclaimer = document.createElement("p");
    disclaimer.className = "bh-chat-disclaimer";
    disclaimer.textContent =
      "El asistente no sustituye la valoracion completa. Usa las recomendaciones como apoyo y confirma con historial, exploracion y analitica.";

    const mainLayout = document.createElement("div");
    mainLayout.className = "bh-chat-layout";

    const sidebar = document.createElement("div");
    sidebar.className = "bh-chat-layout__sidebar";
    sidebar.appendChild(historyBox);

    const conversation = document.createElement("div");
    conversation.className = "bh-chat-layout__main";
    conversation.appendChild(messagesList);
    conversation.appendChild(inputWrap);
    conversation.appendChild(disclaimer);

    mainLayout.appendChild(sidebar);
    mainLayout.appendChild(conversation);

    body.appendChild(status);
    body.appendChild(threadbar);
    body.appendChild(mainLayout);
    body.appendChild(historyModal);
    body.appendChild(renameModal);

    panel.appendChild(header);
    panel.appendChild(body);

    container.appendChild(panel);
    container.appendChild(launcher);

    return {
      container,
      launcher,
      panel,
      threadSelect,
      threadButton,
      historyModal,
      historyModalList,
      historyModalClose,
      historyTitle,
      renameBtn,
      newThreadBtn,
      deleteThreadBtn,
      historyList,
      messagesList,
      textarea,
      sendBtn,
      statusNode: status,
      renameModal,
      renameInput,
      renameSave,
      renameCancel,
      renameClose
    };
  };

  const bootstrap = () => {
    const ui = createUI();
    document.body.appendChild(ui.container);

    const user = getStoredUser();
    const resolveUserName = (u) => {
      const candidates = [
        u?.nombreCompleto,
        u?.nombre,
        u?.name,
        u?.username,
        u?.email,
        DEFAULT_USER_NAME
      ].filter(Boolean);
      const chosen = candidates[0] || DEFAULT_USER_NAME;
      return (chosen || DEFAULT_USER_NAME).trim() || DEFAULT_USER_NAME;
    };
    const userName = resolveUserName(user);
    const userInitial = (userName[0] || DEFAULT_USER_NAME[0] || "T").toUpperCase();
    const usuarioId = resolveUserId(user);
    if (!usuarioId) {
      ui.statusNode.textContent = "Inicia sesión para usar el asistente.";
      ui.sendBtn.disabled = true;
    }

    let state = {
      sessions: [],
      activeId: null,
      messages: new Map(), // sessionId -> [{role,text}]
      botBySession: new Map(),
      loading: false
    };

    const sanitizeText = (text = "") => (text || "").trim();
    const escapeHtml = (text = "") =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
  const formatMessageHtml = (text = "") => {
    const safe = escapeHtml(text);
    const withBold = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const lines = withBold.split(/\n/);
    let html = "";
    let currentList = null; // 'ul' | 'ol'
    const closeList = () => {
      if (currentList === "ul") html += "</ul>";
      if (currentList === "ol") html += "</ol>";
      currentList = null;
    };
    lines.forEach((line) => {
      const trimmed = line.trim();
      const headingMatch = /^#{1,6}\s+(.*)$/.exec(trimmed);
      if (headingMatch) {
        closeList();
        html += `<div class="bh-chat-heading">${headingMatch[1]}</div>`;
        return;
      }
      const isBullet = /^[-*]\s+/.test(trimmed);
      const isNumber = /^\d+\.\s+/.test(trimmed);
      if (isBullet || isNumber) {
        const targetList = isBullet ? "ul" : "ol";
        if (currentList !== targetList) {
          closeList();
          html += targetList === "ul" ? '<ul class="bh-chat-list">' : '<ol class="bh-chat-list">';
          currentList = targetList;
        }
        const clean = trimmed.replace(isBullet ? /^[-*]\s+/ : /^\d+\.\s+/, "");
        html += `<li>${clean}</li>`;
        return;
      }
      closeList();
      html += `${trimmed || "&nbsp;"}<br>`;
    });
    closeList();
    return html;
  };

    const renderMessages = (sessionId) => {
      const list = state.messages.get(sessionId) || [];
      ui.messagesList.innerHTML = "";
      list.forEach((message) => {
        const item = document.createElement("div");
        item.className = `bh-chat-msg bh-chat-msg--${message.role === "assistant" ? "assistant" : "user"}`;

        const avatar = document.createElement("div");
        avatar.className = `bh-chat-avatar bh-chat-avatar--${message.role === "assistant" ? "assistant" : "user"}`;
        avatar.textContent = message.role === "assistant" ? "AI" : userInitial;

        const bubble = document.createElement("div");
        bubble.className = "bh-chat-bubble";
        bubble.innerHTML = formatMessageHtml(message.text || "");

        const meta = document.createElement("div");
        meta.className = "bh-chat-meta";
        meta.textContent = message.role === "assistant" ? BOT_NAME : userName;
        bubble.appendChild(document.createElement("br"));
        bubble.appendChild(meta);

        item.appendChild(avatar);
        item.appendChild(bubble);
        ui.messagesList.appendChild(item);
      });
      ui.messagesList.scrollTop = ui.messagesList.scrollHeight;
    };

    const closeHistoryModal = () => {
      ui.historyModal.hidden = true;
    };

    const openHistoryModal = () => {
      ui.historyModal.hidden = false;
    };

    const renderHistory = () => {
      ui.historyList.innerHTML = "";
      ui.historyModalList.innerHTML = "";
      state.sessions.forEach((session) => {
        const item = document.createElement("div");
        item.className = "bh-chat-history__item";
        if (session.id === state.activeId) item.classList.add("is-active");
        const titleNode = document.createElement("div");
        titleNode.className = "bh-chat-history__title-text";
        titleNode.textContent = session.titulo || "Conversacion";
        const meta = document.createElement("div");
        meta.className = "bh-chat-history__meta";
        const last = state.messages.get(session.id);
        const lastMsg = last && last[last.length - 1];
        meta.textContent = lastMsg ? sanitizeText(lastMsg.text) : "Sin mensajes";
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "bh-chat-delete";
        deleteBtn.textContent = "x";
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          handleDeleteSession(session.id);
        });
        item.appendChild(titleNode);
        item.appendChild(meta);
        item.appendChild(deleteBtn);
        item.addEventListener("click", () => switchSession(session.id));
        ui.historyList.appendChild(item);

        const modalItem = item.cloneNode(true);
        const modalDelete = modalItem.querySelector(".bh-chat-delete");
        if (modalDelete) {
          modalDelete.addEventListener("click", (event) => {
            event.stopPropagation();
            handleDeleteSession(session.id);
          });
        }
        modalItem.addEventListener("click", () => {
          switchSession(session.id);
          closeHistoryModal();
        });
        ui.historyModalList.appendChild(modalItem);
      });
    };

    const renderThreadSelect = () => {
      ui.threadSelect.innerHTML = "";
      state.sessions.forEach((session, index) => {
        const opt = document.createElement("option");
        opt.value = session.id;
        opt.textContent = session.titulo || `Sesión ${index + 1}`;
        if (session.id === state.activeId) opt.selected = true;
        ui.threadSelect.appendChild(opt);
      });
      const active = state.sessions.find((s) => s.id === state.activeId);
      ui.threadButton.textContent = active?.titulo || "Sesiones";
    };

    const refreshUI = () => {
      renderThreadSelect();
      renderHistory();
      if (state.activeId) {
        setInputEnabled(true);
        renderMessages(state.activeId);
      } else {
        ui.messagesList.innerHTML = "";
        setStatus("Crea o selecciona una sesión para empezar a chatear.");
        setInputEnabled(false, "Crea o selecciona una sesión para empezar a chatear.");
      }
    };

    const closeRenameModal = () => {
      ui.renameModal.hidden = true;
    };

    const promptRenameSession = async () => {
      if (!state.activeId) return;
      const current = state.sessions.find((s) => s.id === state.activeId);
      const baseTitle = current?.titulo || "Sesión chatbot";
      ui.renameInput.value = baseTitle;
      ui.renameModal.hidden = false;
      ui.renameInput.focus();
    };

    const submitRename = async () => {
      if (!state.activeId) {
        closeRenameModal();
        return;
      }
      const nuevoTitulo = sanitizeText(ui.renameInput.value || "");
      const current = state.sessions.find((s) => s.id === state.activeId);
      const baseTitle = current?.titulo || "Sesión chatbot";
      if (!nuevoTitulo || nuevoTitulo === baseTitle) {
        closeRenameModal();
        return;
      }
      try {
        const res = await requestChatbot(`/sessions/${state.activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitanteId: usuarioId, titulo: nuevoTitulo })
        });
        const data = res?.data;
        if (data?.id) {
          state.sessions = state.sessions.map((s) =>
            s.id === data.id ? { ...s, titulo: data.titulo } : s
          );
          refreshUI();
        }
      } catch (error) {
        console.warn("No se pudo renombrar la sesión:", error);
      } finally {
        closeRenameModal();
      }
    };

    const resolveBotId = (session) => {
      if (!session) return null;
      return (
        session.metadatos?.botId ||
        (session.participantes || []).find((p) => typeof p === "string" && p.startsWith("assistant-bot")) ||
        null
      );
    };

    const setStatus = (text) => {
      ui.statusNode.textContent = text;
    };

    const setInputEnabled = (enabled, placeholder) => {
      ui.textarea.disabled = !enabled;
      ui.sendBtn.disabled = !enabled;
      ui.textarea.placeholder =
        placeholder || "Describe el caso (IMC, objetivo, sintomas, patologias)...";
      ui.textarea.classList.toggle("bh-chat-input--disabled", !enabled);
    };

    const fetchSessions = async () => {
      if (!usuarioId) return;
      try {
        const res = await requestChatbot(`/sessions?usuarioId=${encodeURIComponent(usuarioId)}`);
        const data = Array.isArray(res?.data) ? res.data : [];
        state.sessions = data;
        if (!state.sessions.length) {
          setStatus("No hay sesiones. Creando una nueva...");
          setInputEnabled(false, "Creando sesión...");
          await createSessionOnServer();
          return;
        }
        state.activeId = state.activeId || state.sessions[0].id;
        state.sessions.forEach((s) => {
          const botId = resolveBotId(s);
          if (botId) state.botBySession.set(s.id, botId);
        });
        await fetchMessages(state.activeId);
      } catch (error) {
        console.warn("No se pudieron cargar sesiones:", error);
        setStatus("No se pudieron cargar sesiones.");
      } finally {
        refreshUI();
      }
    };

    const fetchMessages = async (sessionId) => {
      if (!sessionId) return;
      try {
        const res = await requestChatbot(`/sessions/${sessionId}/messages`);
        const items = Array.isArray(res?.items) ? res.items : [];
        if (res?.session) {
          const botId = resolveBotId(res.session);
          if (botId) state.botBySession.set(sessionId, botId);
        }
        state.messages.set(
          sessionId,
          items.map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            text: msg.contenido || ""
          }))
        );
      } catch (error) {
        console.warn("No se pudieron cargar mensajes:", error);
        if (!state.messages.has(sessionId)) {
          state.messages.set(sessionId, []);
        }
      } finally {
        refreshUI();
      }
    };

    const createSessionOnServer = async () => {
      if (!usuarioId) return;
      try {
        setInputEnabled(false, "Creando sesión...");
        const res = await requestChatbot("/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuarioId, titulo: "Sesión chatbot" })
        });
        const session = res?.data;
        if (session?.id) {
          state.sessions.push(session);
          state.activeId = session.id;
          const botId = resolveBotId(session);
          if (botId) state.botBySession.set(session.id, botId);
          state.messages.set(session.id, []);
          await sendAssistantMessage(session.id, DEFAULT_ASSISTANT_GREETING);
          await fetchMessages(session.id);
          setStatus("Sesión creada. Puedes empezar a chatear.");
        }
      } catch (error) {
        console.warn("No se pudo crear la sesión:", error);
        setStatus("No se pudo crear la sesión de chatbot.");
      } finally {
        setInputEnabled(Boolean(state.activeId));
        refreshUI();
      }
    };

    const sendAssistantMessage = async (sessionId, text) => {
      const botId = state.botBySession.get(sessionId);
      const clean = sanitizeText(text);
      if (!botId || !clean) return;
      try {
        const payload = {
          remitenteId: botId,
          role: "assistant",
          contenido: clean
        };
        await requestChatbot(`/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const current = state.messages.get(sessionId) || [];
        current.push({ role: "assistant", text: clean });
        state.messages.set(sessionId, current.slice(-200));
      } catch (error) {
        console.warn("No se pudo guardar la respuesta del asistente:", error);
      }
    };

    let thinkingTimer = null;
    let thinkingStart = null;
    let thinkingNode = null;

    const startThinking = () => {
      stopThinking();
      thinkingStart = Date.now();
      thinkingNode = document.createElement("div");
      thinkingNode.className = "bh-chat-msg bh-chat-msg--assistant bh-chat-msg--thinking";
      const avatar = document.createElement("div");
      avatar.className = "bh-chat-avatar bh-chat-avatar--assistant";
      avatar.textContent = "AI";
      const bubble = document.createElement("div");
      bubble.className = "bh-chat-bubble";
      bubble.innerHTML = "Pensando... <span class=\"bh-chat-timer\">0s</span>";
      thinkingNode.appendChild(avatar);
      thinkingNode.appendChild(bubble);
      ui.messagesList.appendChild(thinkingNode);
      ui.messagesList.scrollTop = ui.messagesList.scrollHeight;
      thinkingTimer = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - thinkingStart) / 1000);
        const timer = thinkingNode.querySelector(".bh-chat-timer");
        if (timer) timer.textContent = `${elapsed}s`;
      }, 1000);
    };

    const stopThinking = () => {
      if (thinkingTimer) {
        window.clearInterval(thinkingTimer);
        thinkingTimer = null;
      }
      if (thinkingNode?.parentNode) {
        thinkingNode.parentNode.removeChild(thinkingNode);
      }
      thinkingNode = null;
      thinkingStart = null;
    };

    const sendUserMessage = async (text) => {
      const sessionId = state.activeId;
      if (!sessionId || !usuarioId) return;
      const clean = sanitizeText(text);
      if (!clean) return;
      const messages = state.messages.get(sessionId) || [];
      messages.push({ role: "user", text: clean });
      state.messages.set(sessionId, messages.slice(-200));
      refreshUI();
      try {
        startThinking();
        await requestChatbot(`/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remitenteId: usuarioId,
            role: "user",
            contenido: clean
          })
        });
      } catch (error) {
        console.warn("No se pudo guardar el mensaje de usuario:", error);
      }
      try {
        const res = await requestChatbot(`/sessions/${sessionId}/ai-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuarioId,
            contenido: clean
          })
        });
        const replyText = res?.data?.contenido || res?.data?.text || res?.data?.mensaje;
        const effectiveReply = sanitizeText(replyText || "");
        if (effectiveReply) {
          const current = state.messages.get(sessionId) || [];
          current.push({ role: "assistant", text: effectiveReply });
          state.messages.set(sessionId, current.slice(-200));
        } else {
          throw new Error("La IA no devolvio contenido");
        }
      } catch (error) {
        console.warn("Fallo la IA:", error);
        const current = state.messages.get(sessionId) || [];
        current.push({
          role: "assistant",
          text: "No se pudo obtener respuesta de IA en este momento."
        });
        state.messages.set(sessionId, current.slice(-200));
      }
      stopThinking();
      refreshUI();
    };

    const switchSession = async (sessionId) => {
      if (!sessionId || sessionId === state.activeId) return;
      state.activeId = sessionId;
      if (!state.messages.has(sessionId)) {
        await fetchMessages(sessionId);
      } else {
        refreshUI();
      }
    };

    const handleDeleteSession = async (sessionId) => {
      if (!sessionId) return;
      try {
        await requestChatbot(`/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitanteId: usuarioId })
        });
        state.sessions = state.sessions.filter((s) => s.id !== sessionId);
        state.messages.delete(sessionId);
        state.botBySession.delete(sessionId);
        if (state.sessions.length) {
          state.activeId = state.sessions[0].id;
          await fetchMessages(state.activeId);
        } else {
          state.activeId = null;
          setStatus("No hay sesiones. Creando una nueva...");
          setInputEnabled(false, "Creando sesión...");
          await createSessionOnServer();
        }
      } catch (error) {
        console.warn("No se pudo borrar la sesión:", error);
      } finally {
        refreshUI();
      }
    };

    ui.sendBtn.addEventListener("click", () => {
      sendUserMessage(ui.textarea.value);
      ui.textarea.value = "";
      ui.textarea.focus();
    });

    ui.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendUserMessage(ui.textarea.value);
        ui.textarea.value = "";
      }
    });

    ui.threadButton.addEventListener("click", openHistoryModal);
    ui.historyModalClose.addEventListener("click", closeHistoryModal);
    ui.historyModal.addEventListener("click", (event) => {
      if (event.target === ui.historyModal) closeHistoryModal();
    });
    ui.renameModal.addEventListener("click", (event) => {
      if (event.target === ui.renameModal) closeRenameModal();
    });
    ui.renameClose.addEventListener("click", closeRenameModal);
    ui.renameCancel.addEventListener("click", closeRenameModal);
    ui.renameSave.addEventListener("click", submitRename);
    ui.renameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitRename();
      } else if (event.key === "Escape") {
        closeRenameModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeHistoryModal();
    });
    ui.threadSelect.addEventListener("change", (event) => switchSession(event.target.value));
    ui.renameBtn.addEventListener("click", promptRenameSession);
    ui.newThreadBtn.addEventListener("click", createSessionOnServer);
    ui.deleteThreadBtn.addEventListener("click", () => handleDeleteSession(state.activeId));

    ui.launcher.addEventListener("click", () => {
      ui.panel.hidden = !ui.panel.hidden;
      if (!ui.panel.hidden) {
        ui.textarea.focus();
      }
    });
    ui.panel.querySelector(".bh-chat-icon-btn").addEventListener("click", () => {
      ui.panel.hidden = true;
    });

    fetchSessions();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
