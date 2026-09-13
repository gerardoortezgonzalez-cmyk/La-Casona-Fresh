/* ============================================================
   MOTOR DE FERTILIZACIÓN — La Casona Fresh
   Portado IDÉNTICO del motor de OG Fresh Export (app hermana).
   Lógica pura de cálculo agronómico — sin UI, sin cambios en las cifras.
   Los valores de extracción de okra son un modelo estimado (ver avisos
   de confianza en las pestañas); no se han alterado.
   ============================================================ */

const NUTRIENTES = ["N", "P2O5", "K2O", "CaO", "MgO", "S", "B", "Zn"];
const NUTRIENTE_CORTO = { N: "N", P2O5: "P₂O₅", K2O: "K₂O", CaO: "CaO", MgO: "MgO", S: "S", B: "B", Zn: "Zn" };
const NUTRIENTE_NOMBRE = { N: "Nitrógeno", P2O5: "Fósforo", K2O: "Potasio", CaO: "Calcio", MgO: "Magnesio", S: "Azufre", B: "Boro", Zn: "Zinc" };
// Micronutrientes y silicio: SOLO informativos, para comparar el valor de distintos productos
// comerciales (garantías vs. precio). No forman parte del cálculo automático de dosis del plan
// de fertirriego — eso requeriría valores de extracción de referencia calibrados para okra que
// no tenemos con certeza; agregarlos ahí sería adivinar, y podría hacer aplicar de más o de menos.
const NUTRIENTES_REFERENCIA = ["Fe", "Mn", "Cu", "Mo", "Si"];
const NUTRIENTE_REF_NOMBRE = { Fe: "Hierro", Mn: "Manganeso", Cu: "Cobre", Mo: "Molibdeno", Si: "Silicio" };

const ETAPAS = [
  { id: "I", nombre: "Etapa I", rango: "0–20 días", foco: "Establecimiento y desarrollo radicular" },
  { id: "II", nombre: "Etapa II", rango: "21–40 días", foco: "Crecimiento acelerado y pre-floración" },
  { id: "III", nombre: "Etapa III", rango: "41–70 días", foco: "Floración e inicio de cosecha" },
  { id: "IV", nombre: "Etapa IV", rango: "71–110+ días", foco: "Cosecha pico y sostenida" },
];

const DEFAULT_EXTRACCION = { N: 140, P2O5: 55, K2O: 170, CaO: 95, MgO: 38, S: 28, B: 2.0, Zn: 1.5 };

const DEFAULT_DISTRIBUCION = {
  N: { I: 10, II: 30, III: 35, IV: 25 },
  P2O5: { I: 25, II: 30, III: 30, IV: 15 },
  K2O: { I: 5, II: 20, III: 40, IV: 35 },
  CaO: { I: 10, II: 20, III: 40, IV: 30 },
  MgO: { I: 10, II: 25, III: 35, IV: 30 },
  S: { I: 10, II: 25, III: 35, IV: 30 },
  B: { I: 15, II: 30, III: 35, IV: 20 },
  Zn: { I: 20, II: 30, III: 30, IV: 20 },
};

const DEFAULT_APORTE_FACTOR = { N: 0.6, P2O5: 0.3, K2O: 0.3, CaO: 0.2, MgO: 0.2, S: 0.2 };
const OXIDO_FACTOR = { P2O5: 2.29, K2O: 1.205, CaO: 1.399, MgO: 1.658 };

const DEFAULT_DURACION = { I: 20, II: 20, III: 30, IV: 40 };
const DEFAULT_FRECUENCIA = { I: 6, II: 4, III: 3, IV: 3 };
const STAGE_START = { I: 1, II: 21, III: 41, IV: 71 };
const DEFAULT_FRECUENCIA_MONITOREO = { I: 5, II: 4, III: 3, IV: 3 };

/* Programa preventivo fitosanitario de referencia para okra, por etapa fenológica.
   Basado en literatura agronómica general (IPM en malváceas) — calibrar con la presión
   real de plagas de la zona y con el técnico de campo o SENASA Honduras. No sustituye
   el criterio del entomólogo/fitopatólogo en campo. */
const PROGRAMA_PREVENTIVO = {
  I: [
    { nombre: "Damping-off (Rhizoctonia / Pythium)", tipo: "enfermedad", sintoma: "Estrangulamiento del tallo a nivel del suelo, marchitez y caída de plántula.", umbral: "Más de 5% de plántulas afectadas — revisar drenaje y tratamiento de semilla en el próximo ciclo." },
    { nombre: "Gusano trozador / tierrero (Agrotis, Spodoptera)", tipo: "plaga", sintoma: "Plántulas cortadas a nivel del suelo, especialmente de noche.", umbral: "Más de 2% de plántulas cortadas por muestreo, o larvas visibles al escarbar cerca del daño." },
  ],
  II: [
    { nombre: "Áfidos (Aphis gossypii)", tipo: "plaga", sintoma: "Colonias en brotes tiernos y envés de hojas; mielecilla y fumagina.", umbral: "Más de 5 áfidos por hoja joven en el 20% de las plantas muestreadas." },
    { nombre: "Mosca blanca (Bemisia tabaci)", tipo: "plaga", sintoma: "Adultos en el envés de la hoja, vector de geminivirus.", umbral: "Más de 3 adultos por hoja en el 30% de las plantas muestreadas." },
    { nombre: "Ácaros (Tetranychus spp.)", tipo: "plaga", sintoma: "Punteado amarillo y bronceado foliar, telarañas finas.", umbral: "Presencia visible de telaraña y bronceado en más del 10% de las plantas." },
  ],
  III: [
    { nombre: "Barrenador del fruto (Earias / Helicoverpa)", tipo: "plaga", sintoma: "Perfora botones florales y frutos jóvenes.", umbral: "Más de 5% de frutos u órganos florales con orificio de entrada — crítico para calidad de exportación." },
    { nombre: "Oídium / Cenicilla (Erysiphe cichoracearum)", tipo: "enfermedad", sintoma: "Polvillo blanco en hojas, favorecido por humedad alta y exceso de follaje.", umbral: "Presencia visible en más del 15% del área foliar de la planta." },
    { nombre: "Deformación de fruto (deficiencia Ca/B)", tipo: "fisiológico", sintoma: "Fruto curvo, corto o con necrosis apical.", umbral: "Cualquier fruto deforme detectado — revisar de inmediato el refuerzo foliar Ca–B." },
  ],
  IV: [
    { nombre: "Antracnosis / pudriciones de fruto (Colletotrichum, Rhizopus)", tipo: "enfermedad", sintoma: "Manchas hundidas y pudrición blanda en fruto, típicamente post-cosecha.", umbral: "Tolerancia cero para exportación — descartar cualquier fruto con síntomas; si supera 5% del lote, revisar manejo poscosecha." },
    { nombre: "Mosca blanca persistente / resurgencia de áfidos", tipo: "plaga", sintoma: "Igual que Etapa II, con planta en senescencia.", umbral: "Mismo umbral que Etapa II — mayor tolerancia solo si el lote está por finalizar su ciclo productivo." },
  ],
};


const DEFAULT_FOLIAR = { frecuencia: 7, concentracion: "2 – 3 g/L", producto: "Quelato Ca–B foliar", costoPorAplicacion: 6 };
const KC_ETAPA = { I: 0.5, II: 0.75, III: 1.05, IV: 0.9 };
const DEFAULT_ETO_SEMANAL = 5.0;
const DEFAULT_REMOCION = { K2O: 0.55, CaO: 0.20 }; // lb de nutriente por quintal (100 lb) de fruta cosechada

const DEFAULT_SOIL = {
  pH: 6.3, CE: 1.2, MO: 2.8, textura: "franco-arenosa",
  N_NO3: 14, metodoP: "olsen", P_disp: 18, K: 0.35, Ca: 5.5, Mg: 1.8, S: 12, Na: 0.8, B: 0.6, Zn: 1.8, CIC: 9,
  Cu: 0, Fe: 0, Mn: 0,
  fechaAnalisis: "", laboratorio: "",
};

let fid = 0;
// Campos comerciales por defecto para cada insumo del catálogo:
//   comercial    → nombre comercial del saco/bulto (lo que lee el colaborador). Si queda vacío, se usa `nombre`.
//   presentacionLb → tamaño del saco en libras (para convertir la dosis a "X sacos").
//   existenciaLb → libras en existencia en bodega (0 = sin stock).
//   disponible   → true si se puede usar en el optimizador de mezcla (aunque exista, se puede desactivar).
const nf = (n) => ({ comercial: "", presentacionLb: 100, existenciaLb: 0, disponible: true, Fe: 0, Mn: 0, Cu: 0, Mo: 0, Si: 0, ...n, _id: `f${fid++}` });
const DEFAULT_FERTILIZANTES = [
  nf({ nombre: "Urea", comercial: "Urea 46%", N: 46, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 0, costo: 0.9, presentacionLb: 100 }),
  nf({ nombre: "MAP (11-52-0)", comercial: "MAP 11-52-0", N: 11, P2O5: 52, K2O: 0, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 0, costo: 1.1, presentacionLb: 100 }),
  nf({ nombre: "Nitrato de Calcio", comercial: "Nitrato de Calcio", N: 15.5, P2O5: 0, K2O: 0, CaO: 19, MgO: 0, S: 0, B: 0, Zn: 0, costo: 1.0, presentacionLb: 55 }),
  nf({ nombre: "Cloruro de Potasio", comercial: "Muriato de Potasio (KCl 60%)", N: 0, P2O5: 0, K2O: 60, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 0, costo: 0.85, presentacionLb: 100 }),
  nf({ nombre: "Sulfato de Potasio", comercial: "Sulfato de Potasio (0-0-50)", N: 0, P2O5: 0, K2O: 50, CaO: 0, MgO: 0, S: 18, B: 0, Zn: 0, costo: 1.3, presentacionLb: 55 }),
  nf({ nombre: "Nitrato de Potasio", comercial: "Nitrato de Potasio (13-0-44)", N: 13, P2O5: 0, K2O: 44, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 0, costo: 1.6, presentacionLb: 55 }),
  nf({ nombre: "Sulfato de Magnesio", comercial: "Sulfato de Magnesio (Sal Epsom)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 16, S: 13, B: 0, Zn: 0, costo: 0.7, presentacionLb: 55 }),
  nf({ nombre: "Solubor", comercial: "Solubor (Boro 20%)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, S: 0, B: 20, Zn: 0, costo: 2.5, presentacionLb: 25 }),
  nf({ nombre: "Sulfato de Zinc", comercial: "Sulfato de Zinc (Zn 35%)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 35, costo: 2.0, presentacionLb: 25 }),
];

let loteCounter = 0;
function nuevoLote(nombre) {
  loteCounter += 1;
  return {
    id: `lote_${Date.now()}_${loteCounter}`,
    nombre: nombre || `Lote ${loteCounter}`,
    areaMz: 1,
    variedad: "Clemson Spineless",
    fechaSiembra: "",
    soil: { ...DEFAULT_SOIL },
    extraccion: { ...DEFAULT_EXTRACCION },
    distribucion: JSON.parse(JSON.stringify(DEFAULT_DISTRIBUCION)),
    aporteFactor: { ...DEFAULT_APORTE_FACTOR },
    seleccion: {},
    ajustePct: {},
    duracion: { ...DEFAULT_DURACION },
    frecuencia: { ...DEFAULT_FRECUENCIA },
    foliarCfg: { ...DEFAULT_FOLIAR },
    semanasRiego: {},
    remocion: { ...DEFAULT_REMOCION },
    // Fertilización de BASE aplicada como mezcla física al emplasticar (fondo de cama).
    // dosisLbMz: lb/mz de cada producto granulado. descontarDeFertirriego: si su aporte
    // se resta del requerimiento que luego pide el fertirriego (decisión por lote).
    baseEmplasticado: {
      productos: [
        { nombre: "18-46-0 (DAP)", N: 18, P2O5: 46, K2O: 0, dosisLbMz: 0, costoLb: 1.1 },
        { nombre: "12-24-12", N: 12, P2O5: 24, K2O: 12, dosisLbMz: 0, costoLb: 1.0 },
      ],
      descontarDeFertirriego: false,
    },
    // Encalado en preparación de suelo. satObjetivo: % saturación de bases meta.
    // prnt: calidad de la cal (% efectivo). costoLb: precio de la cal.
    encalado: { satObjetivo: 80, prnt: 90, costoLb: 0.15 },
  };
}

/* ============================================================
   FUNCIONES PURAS DE INTERPRETACIÓN Y CÁLCULO (sección 1-4 de la guía)
   ============================================================ */
function rango(val, bajo, alto) {
  if (val < bajo) return "bajo";
  if (val > alto) return "alto";
  return "optimo";
}
function interpretarSuelo(soil) {
  const bray = soil.metodoP === "bray";
  const mehlich3 = soil.metodoP === "mehlich3";
  // Rango P Mehlich-3 (13–30 mg/kg "medio"): citado directamente del Laboratorio de Suelos
  // Zamorano (informe LSZ-MC-F31, acreditado ISO/IEC 17025) — no es un valor genérico importado.
  const rangoP = mehlich3 ? [13, 30] : bray ? [20, 40] : [15, 30];
  return {
    pH: rango(soil.pH, 5.5, 7.5),
    CE: rango(soil.CE, 1.0, 3.0),
    MO: rango(soil.MO, 2.0, 4.0),
    N_NO3: rango(soil.N_NO3, 10, 25),
    P_disp: rango(soil.P_disp, rangoP[0], rangoP[1]),
    K: rango(soil.K, 0.3, 0.6),
    Ca: rango(soil.Ca, 4.0, 8.0),
    Mg: rango(soil.Mg, 1.0, 3.0),
    S: rango(soil.S, 10, 20),
    Na: rango(soil.Na, 1.0, 3.0),
    B: rango(soil.B, 0.4, 1.0),
    Zn: rango(soil.Zn, 1.0, 3.0),
  };
}
const CAT_LABEL = { bajo: "Bajo", optimo: "Óptimo", alto: "Alto" };

function textGroup(t) {
  if (t === "arenosa" || t === "franco-arenosa") return "arenosa";
  if (t === "franca") return "franca";
  return "arcillosa";
}
function phGroup(ph) {
  if (ph < 5.5) return "acido";
  if (ph > 7.5) return "alcalino";
  return "medio";
}
const TABLA_EFIC_N = {
  arenosa: { acido: 0.5, medio: 0.6, alcalino: 0.55 },
  franca: { acido: 0.6, medio: 0.72, alcalino: 0.65 },
  arcillosa: { acido: 0.55, medio: 0.68, alcalino: 0.6 },
};
const TABLA_EFIC_P = { acido: 0.35, medio: 0.75, alcalino: 0.45 };
const TABLA_EFIC_K = { arenosa: 0.65, franca: 0.8, arcillosa: 0.75 };

function eficienciaNutriente(nutriente, soil) {
  const tg = textGroup(soil.textura);
  const pg = phGroup(soil.pH);
  if (nutriente === "N") return TABLA_EFIC_N[tg][pg];
  if (nutriente === "P2O5") return TABLA_EFIC_P[pg];
  if (nutriente === "K2O") return TABLA_EFIC_K[tg];
  if (nutriente === "CaO" || nutriente === "MgO" || nutriente === "S") return soil.CE > 2.0 ? 0.6 : 0.7;
  if (nutriente === "B") return 0.5;
  if (nutriente === "Zn") return soil.pH > 7.3 ? 0.35 : 0.5;
  return 0.6;
}
/* Suaviza el crédito de aporte de suelo cerca del umbral "bajo": en vez de 0% justo
   debajo y 100% justo encima (salto brusco), sube en rampa entre el 80% y el 120% del
   umbral, para que dos lotes con análisis casi iguales no reciban dosis muy distintas
   solo por caer a un lado u otro de la línea. */
function factorSuavizado(valor, umbralBajo) {
  if (!umbralBajo) return 1;
  const inicio = umbralBajo * 0.8;
  const fin = umbralBajo * 1.2;
  if (valor <= inicio) return 0;
  if (valor >= fin) return 1;
  return (valor - inicio) / (fin - inicio);
}
function aporteSueloTotal(soil, interp, factores) {
  const kgha = (ppm) => ppm * 2.24;
  const umbralP = soil.metodoP === "bray" ? 20 : 15;
  const out = {};
  out.N = kgha(soil.N_NO3) * factores.N * factorSuavizado(soil.N_NO3, 10);
  out.P2O5 = kgha(soil.P_disp) * OXIDO_FACTOR.P2O5 * factores.P2O5 * factorSuavizado(soil.P_disp, umbralP);
  out.K2O = kgha(soil.K * 390) * OXIDO_FACTOR.K2O * factores.K2O * factorSuavizado(soil.K, 0.3);
  out.CaO = kgha(soil.Ca * 200) * OXIDO_FACTOR.CaO * factores.CaO * factorSuavizado(soil.Ca, 4.0);
  out.MgO = kgha(soil.Mg * 120) * OXIDO_FACTOR.MgO * factores.MgO * factorSuavizado(soil.Mg, 1.0);
  out.S = kgha(soil.S) * factores.S * factorSuavizado(soil.S, 10);
  out.B = 0;
  out.Zn = 0;
  return out;
}
/* Hallazgos fitosanitarios de severidad alta (y media) convertidos en alertas descriptivas
   — antes solo se contaban como número en el Dashboard, sin decir de qué se trataba, así
   que el Administrador no tenía forma de ver el detalle sin entrar lote por lote. */
function alertasFitosanitarias(lote) {
  return (lote.fitosanitarioRegistros || [])
    .filter((r) => r.severidad === "alta" || r.severidad === "media")
    .map((r) => ({
      nivel: r.severidad === "alta" ? "critico" : "medio",
      texto: `Fitosanitario (${r.fecha}): ${r.tipo === "plaga" ? "Plaga" : "Enfermedad"} "${r.nombre}" severidad ${r.severidad}${r.accionTomada ? ` — acción: ${r.accionTomada}` : " — sin acción registrada todavía"}.`,
    }));
}
/* Necesidad de encalado estimada por SATURACIÓN DE BASES.
   Método: cuánto Ca (en meq/100g) hay que subir para llevar la saturación de bases actual
   al objetivo, y de ahí la dosis de cal. Es una ESTIMACIÓN orientativa — la dosis fina real
   la da el laboratorio con el requerimiento de cal (buffer/SMP), que aquí no se captura.
     satObjetivo: % de saturación de bases deseado (ej. 80).
     Devuelve dosis en lb/mz de CaCO3 equivalente, o 0 si no hace falta.
   Factor: 1 meq Ca/100g ≈ 400 kg CaCO3/ha en los ~20 cm de suelo (regla práctica de campo). */
/* Solver de programación lineal (símplex de dos fases con Big-M), puro JS, sin dependencias.
   Minimiza costos·x sujeto a restricciones {coefs, op, rhs} con op ">=", "<=" o "=", y x>=0.
   Es el motor del balance de fertilización: permite resolver TODAS las fuentes a la vez
   (no una por una), de modo que si un producto aporta un nutriente secundario, el modelo
   reduce las otras fuentes de ese nutriente y equilibra la mezcla al menor costo total.
   Devuelve { ok, x, costo }. Validado contra casos de balance K+S y N+S compartido. */
function resolverLP(costos, restricciones) {
  const n = costos.length;
  const M = 1e7;
  let slackCount = 0, artCount = 0;
  restricciones.forEach((r) => {
    if (r.op === "<=") slackCount++;
    else if (r.op === ">=") { slackCount++; artCount++; }
    else artCount++;
  });
  const totalCols = n + slackCount + artCount;
  let slackIdx = n, artIdx = n + slackCount;
  const c = new Array(totalCols).fill(0);
  for (let i = 0; i < n; i++) c[i] = costos[i];
  const filas = [], baseVars = [];
  restricciones.forEach((r0) => {
    let r = r0, rhs = r0.rhs;
    const row = new Array(totalCols + 1).fill(0);
    for (let i = 0; i < n; i++) row[i] = r.coefs[i];
    if (rhs < 0) { for (let i = 0; i < totalCols; i++) row[i] = -row[i]; rhs = -rhs; r = { ...r, op: r.op === "<=" ? ">=" : r.op === ">=" ? "<=" : "=" }; }
    if (r.op === "<=") { row[slackIdx] = 1; baseVars.push(slackIdx); slackIdx++; }
    else if (r.op === ">=") { row[slackIdx] = -1; slackIdx++; row[artIdx] = 1; c[artIdx] = M; baseVars.push(artIdx); artIdx++; }
    else { row[artIdx] = 1; c[artIdx] = M; baseVars.push(artIdx); artIdx++; }
    row[totalCols] = rhs;
    filas.push(row);
  });
  const m = filas.length, W = totalCols + 1;
  let acotado = true;
  for (let s = 0; s < 800; s++) {
    const zc = new Array(totalCols).fill(0);
    for (let j = 0; j < totalCols; j++) {
      let z = 0;
      for (let i = 0; i < m; i++) z += c[baseVars[i]] * filas[i][j];
      zc[j] = z - c[j];
    }
    let piv = -1, best = 1e-7;
    for (let j = 0; j < totalCols; j++) if (zc[j] > best) { best = zc[j]; piv = j; }
    if (piv === -1) break;
    let leave = -1, minR = Infinity;
    for (let i = 0; i < m; i++) if (filas[i][piv] > 1e-9) {
      const ratio = filas[i][totalCols] / filas[i][piv];
      if (ratio < minR - 1e-12) { minR = ratio; leave = i; }
    }
    if (leave === -1) { acotado = false; break; }
    const pv = filas[leave][piv];
    for (let j = 0; j < W; j++) filas[leave][j] /= pv;
    for (let i = 0; i < m; i++) if (i !== leave) {
      const f = filas[i][piv];
      if (Math.abs(f) > 1e-12) for (let j = 0; j < W; j++) filas[i][j] -= f * filas[leave][j];
    }
    baseVars[leave] = piv;
  }
  if (!acotado) return { ok: false };
  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (baseVars[i] < n) x[baseVars[i]] = filas[i][totalCols];
  for (let i = 0; i < m; i++) if (baseVars[i] >= n + slackCount && filas[i][totalCols] > 1e-4) return { ok: false };
  let costo = 0; for (let i = 0; i < n; i++) costo += x[i] * costos[i];
  return { ok: true, x, costo };
}

function necesidadCal(soil, satObjetivo, prnt) {
  const cic = soil.CIC || 0;
  if (cic <= 0) return { requiere: false, dosisLbMz: 0, satActual: 0, motivo: "Falta la CIC del análisis para estimar." };
  const bases = (soil.Ca || 0) + (soil.Mg || 0) + (soil.K || 0) + (soil.Na || 0);
  const satActual = (bases / cic) * 100;
  if (satActual >= satObjetivo) return { requiere: false, dosisLbMz: 0, satActual, motivo: "La saturación de bases ya alcanza el objetivo." };
  // meq de Ca a subir para cerrar la brecha de saturación
  const meqSubir = ((satObjetivo - satActual) / 100) * cic;
  const kgHaCaCO3 = meqSubir * 400; // regla práctica ~20 cm
  // ajuste por calidad de la cal (PRNT/poder relativo de neutralización total, % efectivo)
  const efic = (prnt || 100) / 100;
  const kgHaAjustado = efic > 0 ? kgHaCaCO3 / efic : kgHaCaCO3;
  return { requiere: true, dosisLbMz: kgHaToLbMz(kgHaAjustado), satActual, meqSubir };
}
function relacionesCationicas(soil) {
  const caMg = soil.Mg > 0 ? soil.Ca / soil.Mg : 0;
  const mgK = soil.K > 0 ? soil.Mg / soil.K : 0;
  const caK = soil.K > 0 ? soil.Ca / soil.K : 0;
  const satCa = soil.CIC > 0 ? (soil.Ca / soil.CIC) * 100 : 0;
  const satMg = soil.CIC > 0 ? (soil.Mg / soil.CIC) * 100 : 0;
  const satK = soil.CIC > 0 ? (soil.K / soil.CIC) * 100 : 0;
  const satNa = soil.CIC > 0 ? (soil.Na / soil.CIC) * 100 : 0;
  const alertas = [];
  // Los umbrales antiguos (Mg/K>4, Ca/Mg<3) no coinciden con los rangos "medio" que reportan
  // laboratorios acreditados (ej. Zamorano: Mg/K medio 8-10, Ca/Mg medio 3-6) y no tienen
  // respaldo científico como criterio de decisión (ver nota en el módulo de Suelo). Se quitaron
  // para no generar falsas alertas. Se conserva la de sodio, que sí es un criterio establecido.
  if (satNa > 15) alertas.push("Riesgo sódico (PSI > 15%): revise drenaje antes de fertirrigar.");
  return { caMg, mgK, caK, satCa, satMg, satK, satNa, alertas };
}
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const HA_TO_MZ = 0.6989; // 1 mz = 0.6989 ha
const KG_TO_LB = 2.20462;
const KGHA_TO_LBMZ = HA_TO_MZ * KG_TO_LB; // kg/ha -> lb/mz ≈ 1.5407
const kgHaToLbMz = (v) => (v || 0) * KGHA_TO_LBMZ;
const lbMzToKgHa = (v) => (v || 0) / KGHA_TO_LBMZ;
const kgToLb = (v) => (v || 0) * KG_TO_LB;
const lbToKg = (v) => (v || 0) / KG_TO_LB;
const MONEDA = "L"; // Lempiras
const money = (n, d = 2) => `${MONEDA} ${fmt(n, d)}`;
const dollar = (n, d = 2) => `$ ${fmt(n, d)}`;
const TIPO_CAMBIO_DEFAULT = 24.7; // Lempiras por USD — aproximado, verificar y ajustar por el usuario

function etapaEnDia(day, duracion) {
  let acumulado = 0;
  for (const et of ETAPAS) {
    const fin = acumulado + duracion[et.id];
    if (day <= fin) return { id: et.id, inicio: acumulado + 1, fin, fraccion: (day - acumulado) / duracion[et.id] };
    acumulado = fin;
  }
  const last = ETAPAS[ETAPAS.length - 1];
  return { id: last.id, inicio: acumulado - duracion[last.id] + 1, fin: acumulado, fraccion: 1 };
}
function duracionTotal(duracion) {
  return ETAPAS.reduce((s, et) => s + duracion[et.id], 0);
}
const claveEtapaNutriente = (etapaId, nu) => `${etapaId}__${nu}`;

/* ============================================================
   FUNCIÓN PURA: calcula todo el plan de UN lote (sin hooks)
   ============================================================ */
function deriveLotData(lote, fertilizantes) {
  const { soil, extraccion, distribucion, aporteFactor, seleccion, ajustePct, duracion, frecuencia, foliarCfg, semanasRiego, remocion, cosechaRegistros, pesoPromedioCaja, fechaSiembra, frecuenciaMonitoreo } = lote;

  const interp = interpretarSuelo(soil);
  const cationes = relacionesCationicas(soil);
  const aporte = aporteSueloTotal(soil, interp, aporteFactor);

  // Aporte de la fertilización de BASE (mezcla física al emplasticar), en kg/ha, para
  // descontarlo del requerimiento del ciclo si el lote lo tiene activado. Se reparte
  // proporcional a la distribución por etapa igual que el aporte del suelo.
  const baseCfg = lote.baseEmplasticado || { productos: [], descontarDeFertirriego: false };
  const aporteBase = { N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, S: 0, B: 0, Zn: 0 };
  if (baseCfg.descontarDeFertirriego) {
    (baseCfg.productos || []).forEach((p) => {
      const dosisKgHa = lbMzToKgHa(p.dosisLbMz || 0);
      aporteBase.N += dosisKgHa * ((p.N || 0) / 100);
      aporteBase.P2O5 += dosisKgHa * ((p.P2O5 || 0) / 100);
      aporteBase.K2O += dosisKgHa * ((p.K2O || 0) / 100);
    });
  }

  const kgEtapa = {}, aporteEtapa = {}, requerimientoNeto = {}, dosisAplicada = {};
  NUTRIENTES.forEach((nu) => {
    kgEtapa[nu] = {}; aporteEtapa[nu] = {}; requerimientoNeto[nu] = {}; dosisAplicada[nu] = {};
    ETAPAS.forEach((et) => {
      kgEtapa[nu][et.id] = (extraccion[nu] * (distribucion[nu][et.id] || 0)) / 100;
      aporteEtapa[nu][et.id] = ((aporte[nu] || 0) * (distribucion[nu][et.id] || 0)) / 100;
      // el aporte de la base también se reparte por etapa según la curva del nutriente
      const aporteBaseEtapa = ((aporteBase[nu] || 0) * (distribucion[nu][et.id] || 0)) / 100;
      requerimientoNeto[nu][et.id] = Math.max(0, kgEtapa[nu][et.id] - aporteEtapa[nu][et.id] - aporteBaseEtapa);
      const pct = ajustePct[claveEtapaNutriente(et.id, nu)] ?? 100;
      dosisAplicada[nu][et.id] = (requerimientoNeto[nu][et.id] * pct) / 100;
    });
  });

  const eficiencias = {};
  NUTRIENTES.forEach((nu) => (eficiencias[nu] = eficienciaNutriente(nu, soil)));

  const fertilizanteDefault = (nu) => { const idx = fertilizantes.findIndex((f) => f[nu] > 0); return idx >= 0 ? idx : 0; };

  const calculo = [];
  ETAPAS.forEach((et) => {
    NUTRIENTES.forEach((nu) => {
      const dosis = dosisAplicada[nu][et.id];
      const fIdx = seleccion[claveEtapaNutriente(et.id, nu)] ?? fertilizanteDefault(nu);
      const fert = fertilizantes[fIdx];
      const conc = fert ? fert[nu] : 0;
      const efic = eficiencias[nu];
      const kgProducto = conc > 0 ? dosis / (conc / 100) / efic : 0;
      const costo = fert ? kgProducto * (fert.costo || 0) : 0;
      calculo.push({ etapa: et.id, nutriente: nu, dosis, fIdx, fert, kgProducto, costo });
    });
  });

  const costoPorEtapa = {};
  ETAPAS.forEach((et) => (costoPorEtapa[et.id] = calculo.filter((r) => r.etapa === et.id).reduce((s, r) => s + r.costo, 0)));
  const costoFertirriego = Object.values(costoPorEtapa).reduce((a, b) => a + b, 0);

  const calendario = {};
  const cumplFert = lote.cumplimientoFert || {};
  ETAPAS.forEach((et) => {
    const dur = duracion[et.id];
    const freq = Math.max(1, frecuencia[et.id]);
    const nApps = Math.max(1, Math.round(dur / freq));
    const dias = [];
    for (let i = 1; i <= nApps; i++) dias.push(STAGE_START[et.id] - 1 + Math.min(i * freq, dur));
    const dosisPorAplicacion = {};
    NUTRIENTES.forEach((nu) => (dosisPorAplicacion[nu] = dosisAplicada[nu][et.id] / nApps));
    const cumplimiento = dias.map((dia) => {
      const key = `${et.id}_${dia}`;
      const realizado = !!cumplFert[key]?.realizado;
      const fecha = fechaDelDia(lote.fechaSiembra, dia);
      return { dia, key, fecha, realizado, atrasado: esAtrasado(fecha, realizado) };
    });
    calendario[et.id] = { nApps, dias, dosisPorAplicacion, cumplimiento };
  });

  const totalDias = duracionTotal(duracion);

  const foliarCalendar = [];
  for (let d = STAGE_START.III; d <= totalDias; d += Math.max(1, foliarCfg.frecuencia)) foliarCalendar.push(d);
  const cumplFoliar = lote.cumplimientoFoliar || {};
  const foliarCumplimiento = foliarCalendar.map((dia) => {
    const realizado = !!cumplFoliar[dia]?.realizado;
    const fecha = fechaDelDia(lote.fechaSiembra, dia);
    return { dia, fecha, realizado, atrasado: esAtrasado(fecha, realizado) };
  });

  const costoFoliar = foliarCalendar.length * (foliarCfg.costoPorAplicacion || 0);
  const costoTotal = costoFertirriego + costoFoliar;

  /* Calendario de monitoreo fitosanitario preventivo: una visita de campo cada N días por
     etapa (frecuencia editable), con fecha real y cumplimiento — misma lógica que el
     fertirriego, para que el monitoreo sea un hábito programado y no algo que se hace "cuando
     se acuerdan". */
  const frecMonitoreo = frecuenciaMonitoreo || DEFAULT_FRECUENCIA_MONITOREO;
  const cumplMonitoreo = lote.cumplimientoMonitoreo || {};
  const calendarioMonitoreo = {};
  ETAPAS.forEach((et) => {
    const dur = duracion[et.id];
    const freq = Math.max(1, frecMonitoreo[et.id] || DEFAULT_FRECUENCIA_MONITOREO[et.id]);
    const nApps = Math.max(1, Math.round(dur / freq));
    const dias = [];
    for (let i = 1; i <= nApps; i++) dias.push(STAGE_START[et.id] - 1 + Math.min(i * freq, dur));
    const cumplimiento = dias.map((dia) => {
      const key = `${et.id}_${dia}`;
      const realizado = !!cumplMonitoreo[key]?.realizado;
      const fecha = fechaDelDia(lote.fechaSiembra, dia);
      return { dia, key, fecha, realizado, atrasado: esAtrasado(fecha, realizado) };
    });
    calendarioMonitoreo[et.id] = { nApps, dias, cumplimiento };
  });


  const acumuladoAplicadoHastaDia = (nutriente, day) => {
    const et = etapaEnDia(day, duracion);
    let total = 0;
    for (const e of ETAPAS) {
      if (e.id === et.id) { total += dosisAplicada[nutriente][e.id] * et.fraccion; break; }
      total += dosisAplicada[nutriente][e.id];
    }
    return total; // kg/ha acumulado
  };

  /* Remoción nutricional real: usa los registros de cosecha (libras reales, fecha real) del
     módulo Cosecha, Precios & P&L — ya no una entrada manual aparte. Requiere fecha de siembra
     para poder ubicar cada cosecha en su día del ciclo y comparar contra lo aplicado a esa fecha. */
  const pesoCaja = pesoPromedioCaja || 25;
  const areaHaPrevia = (lote.areaMz || 0) * HA_TO_MZ;
  const registrosCosecha = [...(cosechaRegistros || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const cosechaSemanal = [];
  if (fechaSiembra) {
    let acumLibras = 0;
    registrosCosecha.forEach((r) => {
      const libras = (r.cajasExportables || 0) * pesoCaja;
      acumLibras += libras;
      const diaCiclo = Math.round((new Date(r.fecha + "T00:00:00") - new Date(fechaSiembra + "T00:00:00")) / 86400000) + 1;
      const quintalesAcum = acumLibras / 100;
      const removidoK2O = quintalesAcum * remocion.K2O;
      const removidoCaO = quintalesAcum * remocion.CaO;
      const aplicadoK2O = acumuladoAplicadoHastaDia("K2O", diaCiclo) * areaHaPrevia * KG_TO_LB;
      const aplicadoCaO = acumuladoAplicadoHastaDia("CaO", diaCiclo) * areaHaPrevia * KG_TO_LB;
      cosechaSemanal.push({
        fecha: r.fecha, diaCiclo, libras, acumLibras, removidoK2O, removidoCaO, aplicadoK2O, aplicadoCaO,
        deficitK2O: removidoK2O > aplicadoK2O, deficitCaO: removidoCaO > aplicadoCaO,
      });
    });
  }
  const librasTotalesCiclo = registrosCosecha.reduce((s, r) => s + (r.cajasExportables || 0) * pesoCaja, 0);

  const numSemanas = Math.ceil(totalDias / 7);
  const riegoSemanal = [];
  for (let s = 1; s <= numSemanas; s++) {
    const diaMedio = Math.min(totalDias, s * 7 - 3);
    const et = etapaEnDia(diaMedio, duracion);
    const kc = KC_ETAPA[et.id];
    const cfg = semanasRiego[s] || { eto: DEFAULT_ETO_SEMANAL, riegoReal: null };
    const eto = cfg.eto ?? DEFAULT_ETO_SEMANAL;
    const etcTeorico = eto * kc * 7;
    const riegoReal = cfg.riegoReal ?? etcTeorico;
    const factor = etcTeorico > 0 ? riegoReal / etcTeorico : 1;
    riegoSemanal.push({ semana: s, etapa: et.id, kc, eto, etcTeorico, riegoReal, factor });
  }

  const alertas = [];
  const teoN_II = requerimientoNeto.N.II, N_II = dosisAplicada.N.II;
  const teoN_III = requerimientoNeto.N.III, N_III = dosisAplicada.N.III;
  if (teoN_II > 0 && N_II > teoN_II * 1.2) alertas.push({ nivel: "alto", texto: "Exceso de N en Etapa II (pre-floración): follaje suculento — riesgo de Áfidos, Mosca blanca y Oídium." });
  if (teoN_III > 0 && N_III > teoN_III * 1.2) alertas.push({ nivel: "alto", texto: "Exceso de N en Etapa III (floración/cosecha): riesgo de Verticillium y retraso de cuaje." });
  const teoCa_III = requerimientoNeto.CaO.III, Ca_III = dosisAplicada.CaO.III;
  if (teoCa_III > 0 && Ca_III < teoCa_III * 0.8) alertas.push({ nivel: "critico", texto: "Déficit de Ca en Etapa III: riesgo de deformación de fruto y necrosis apical — afecta clasificación de exportación." });
  const teoB_III = requerimientoNeto.B.III, B_III = dosisAplicada.B.III;
  if (teoB_III > 0 && B_III < teoB_III * 0.8) alertas.push({ nivel: "critico", texto: "Déficit de B en Etapa III: aborto floral y fruto corto — reduce % categoría Extra Fine, ↑ susceptibilidad a Botrytis post-cosecha." });
  const ratioNK = dosisAplicada.K2O.III > 0 ? dosisAplicada.N.III / dosisAplicada.K2O.III : 0;
  if (ratioNK > 1.3) alertas.push({ nivel: "medio", texto: "Desbalance N:K en Etapa III — tejido con pared celular débil, menor resistencia a patógenos foliares." });
  cationes.alertas.forEach((a) => alertas.push({ nivel: "medio", texto: a }));

  NUTRIENTES.forEach((nu) => {
    const suma = ETAPAS.reduce((s, et) => s + (distribucion[nu][et.id] || 0), 0);
    if (Math.abs(suma - 100) > 0.5) {
      alertas.push({ nivel: "alto", texto: `La distribución por etapa de ${NUTRIENTE_CORTO[nu]} suma ${fmt(suma, 0)}% en vez de 100% — revisar en Plan por Etapa antes de confiar en las dosis calculadas.` });
    }
  });

  let alertasCumplimiento = 0;
  if (lote.fechaSiembra) {
    ETAPAS.forEach((et) => {
      calendario[et.id].cumplimiento.forEach((c) => {
        if (c.atrasado) {
          alertasCumplimiento += 1;
          alertas.push({ nivel: "critico", texto: `Fertirriego de ${et.nombre} programado para el ${formatFecha(c.fecha)} (día ${c.dia} del ciclo) no está marcado como realizado.` });
        }
      });
    });
    foliarCumplimiento.forEach((c) => {
      if (c.atrasado) {
        alertasCumplimiento += 1;
        alertas.push({ nivel: "alto", texto: `Aplicación foliar Ca–B programada para el ${formatFecha(c.fecha)} (día ${c.dia} del ciclo) no está marcada como realizada.` });
      }
    });
    ETAPAS.forEach((et) => {
      calendarioMonitoreo[et.id].cumplimiento.forEach((c) => {
        if (c.atrasado) {
          alertasCumplimiento += 1;
          alertas.push({ nivel: "alto", texto: `Monitoreo fitosanitario preventivo de ${et.nombre} programado para el ${formatFecha(c.fecha)} (día ${c.dia} del ciclo) no está marcado como realizado.` });
        }
      });
    });
  }

  const areaHa = (lote.areaMz || 0) * HA_TO_MZ;
  const costoTotalFinca = costoTotal * areaHa;

  return {
    interp, cationes, aporte, kgEtapa, aporteEtapa, requerimientoNeto, dosisAplicada, eficiencias,
    calculo, costoPorEtapa, costoFertirriego, costoFoliar, costoTotal, calendario, totalDias, foliarCalendar, foliarCumplimiento, riegoSemanal,
    cosechaSemanal, librasTotalesCiclo, alertas, alertasCumplimiento, areaHa, costoTotalFinca, calendarioMonitoreo,
  };
}

/* ============================================================
   HELPERS DE LA SUITE (semana ISO, nómina, normalización de lotes)
   ============================================================ */
function getISOWeek(fechaStr) {
  if (!fechaStr) return "s/f";
  const d = new Date(fechaStr + "T00:00:00");
  if (isNaN(d.getTime())) return "s/f";
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const semana = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/* Fecha real (calendario) de un día del ciclo, a partir de la fecha de siembra del lote.
   Devuelve null si el lote todavía no tiene fecha de siembra registrada. */
function fechaDelDia(fechaSiembra, diaCiclo) {
  if (!fechaSiembra) return null;
  const d = new Date(fechaSiembra + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (diaCiclo - 1));
  return d;
}
function formatFecha(d) {
  if (!d) return "—";
  return d.toLocaleDateString("es-HN", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function esAtrasado(fechaProgramada, realizado) {
  if (!fechaProgramada || realizado) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return fechaProgramada < hoy;
}


// ============================================================
// EXPORTS — lo que la interfaz necesita del motor
// ============================================================
export {
  NUTRIENTES, NUTRIENTE_CORTO, NUTRIENTE_NOMBRE, NUTRIENTES_REFERENCIA, NUTRIENTE_REF_NOMBRE,
  ETAPAS, DEFAULT_EXTRACCION, DEFAULT_DISTRIBUCION, DEFAULT_APORTE_FACTOR, OXIDO_FACTOR,
  DEFAULT_DURACION, DEFAULT_FRECUENCIA, STAGE_START, DEFAULT_FRECUENCIA_MONITOREO,
  DEFAULT_REMOCION, KC_ETAPA, DEFAULT_ETO_SEMANAL,
  HA_TO_MZ, KG_TO_LB, KGHA_TO_LBMZ, kgHaToLbMz, lbMzToKgHa, kgToLb, lbToKg,
  MONEDA, money, dollar, fmt, TIPO_CAMBIO_DEFAULT,
  factorSuavizado, aporteSueloTotal, interpretarSuelo, eficienciaNutriente,
  relacionesCationicas, necesidadCal, resolverLP, alertasFitosanitarias,
  etapaEnDia, duracionTotal, claveEtapaNutriente, fechaDelDia, formatFecha, esAtrasado,
  deriveLotData,
};
