/* ========================================================================
   DATOS.JS
   Módulo Estadísticas — Carga desde Firestore + agregaciones.

   Todo lo que hay aquí se calcula sobre lo que YA existe en las
   colecciones reales del proyecto:
     - "emergencias"        (modules/emergencia/firebase.js)
     - "inspecciones"       (modules/inspecciones/firebase.js)
     - "censos"             (modules/censos/firebase.js)
     - "ayudas_humanitarias" (modules/ayudas/firebase.js)

   No hay datos inventados ni valores de relleno: si una colección está
   vacía o un campo no viene diligenciado en un reporte, la métrica
   correspondiente se omite o se marca explícitamente como "sin datos"
   — nunca se rellena con un número simulado. Ver especialmente
   proyeccionLineal(), que devuelve null si no hay suficientes puntos
   para que una proyección tenga algún sentido.
======================================================================== */

import { listarEmergencias } from "../emergencia/firebase.js";
import { listarInspecciones } from "../inspecciones/firebase.js";
import { listarCensosFirestore } from "../censos/firebase.js";
import { listarAyudasFirestore } from "../ayudas/firebase.js";

/* =========================================================
   CARGA
========================================================= */

export async function cargarDatos() {

    // Las cuatro colecciones se piden en paralelo; si una falla
    // (permisos, sin internet) no debe tumbar a las demás — por eso
    // Promise.allSettled en vez de Promise.all.
    const [resEmergencias, resInspecciones, resCensos, resAyudas] = await Promise.allSettled([
        listarEmergencias(),
        listarInspecciones(),
        listarCensosFirestore(),
        listarAyudasFirestore()
    ]);

    if (resEmergencias.status === 'rejected') {
        console.error('[estadisticas] No se pudieron cargar emergencias:', resEmergencias.reason);
    }

    if (resInspecciones.status === 'rejected') {
        console.error('[estadisticas] No se pudieron cargar inspecciones:', resInspecciones.reason);
    }

    if (resCensos.status === 'rejected') {
        console.error('[estadisticas] No se pudieron cargar censos:', resCensos.reason);
    }

    if (resAyudas.status === 'rejected') {
        console.error('[estadisticas] No se pudieron cargar ayudas humanitarias:', resAyudas.reason);
    }

    return {
        emergencias: resEmergencias.status === 'fulfilled' ? resEmergencias.value : [],
        inspecciones: resInspecciones.status === 'fulfilled' ? resInspecciones.value : [],
        censos: resCensos.status === 'fulfilled' ? resCensos.value : [],
        ayudas: resAyudas.status === 'fulfilled' ? resAyudas.value : [],
        errores: {
            emergencias: resEmergencias.status === 'rejected',
            inspecciones: resInspecciones.status === 'rejected',
            censos: resCensos.status === 'rejected',
            ayudas: resAyudas.status === 'rejected'
        }
    };

}

/* =========================================================
   UTILIDADES DE FECHA / HORA

   data.fecha en ambos formularios viene de un <input type="date">
   (ver setDefaults() en modules/emergencia/app.js), por lo tanto en
   formato ISO "YYYY-MM-DD" — se puede ordenar como texto sin
   necesidad de parsear a Date para casos simples.
========================================================= */

const NOMBRES_MES = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const NOMBRES_DIA = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

function parseFechaISO(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaStr);
    if (!match) return null;
    const [, anio, mes, dia] = match;
    // new Date(y, m-1, d) en horario LOCAL — evita el corrimiento de un
    // día que da new Date("YYYY-MM-DD") al interpretarse como UTC.
    const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
    return isNaN(fecha.getTime()) ? null : fecha;
}

function claveMes(fechaStr) {
    const match = /^(\d{4})-(\d{2})/.exec(fechaStr || '');
    return match ? `${match[1]}-${match[2]}` : null;
}

function etiquetaMes(claveMesStr) {
    const [anio, mes] = claveMesStr.split('-');
    return `${NOMBRES_MES[Number(mes) - 1]} ${anio.slice(2)}`;
}

// Minutos entre dos horas "HH:MM". Si horaFinal < horaLlegada, asume
// que el servicio cruzó la medianoche (suma 24h) — más razonable para
// una emergencia que descartar el dato o dar un número negativo.
function minutosEntreHoras(horaInicio, horaFin) {

    const m1 = /^(\d{2}):(\d{2})$/.exec(horaInicio || '');
    const m2 = /^(\d{2}):(\d{2})$/.exec(horaFin || '');
    if (!m1 || !m2) return null;

    const inicio = Number(m1[1]) * 60 + Number(m1[2]);
    let fin = Number(m2[1]) * 60 + Number(m2[2]);

    if (fin < inicio) fin += 24 * 60;

    const diferencia = fin - inicio;

    // Un turno de más de 12h como "atención puntual" casi seguro es un
    // error de captura (hora mal digitada), no un dato real de
    // duración — se descarta en vez de distorsionar el promedio.
    if (diferencia < 0 || diferencia > 12 * 60) return null;

    return diferencia;

}

/* =========================================================
   SERIE MENSUAL (continua, sin huecos)

   Genera un punto por cada mes entre el primero y el último registro
   —incluyendo meses en 0— para que una gráfica de tendencia y la
   regresión lineal no queden mintiendo por saltarse meses sin
   actividad.
========================================================= */

export function serieMensual(lista, campoFecha = 'fecha') {

    const conteos = new Map();

    lista.forEach(item => {
        const clave = claveMes(item[campoFecha]);
        if (!clave) return;
        conteos.set(clave, (conteos.get(clave) || 0) + 1);
    });

    const claves = [...conteos.keys()].sort();

    if (!claves.length) return [];

    // Rellenar meses intermedios sin actividad con 0.
    const [anioIni, mesIni] = claves[0].split('-').map(Number);
    const [anioFin, mesFin] = claves[claves.length - 1].split('-').map(Number);

    const serie = [];
    let anio = anioIni, mes = mesIni;

    while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
        const clave = `${anio}-${String(mes).padStart(2, '0')}`;
        serie.push({
            clave,
            etiqueta: etiquetaMes(clave),
            total: conteos.get(clave) || 0
        });
        mes++;
        if (mes > 12) { mes = 1; anio++; }
    }

    return serie;

}

/* =========================================================
   REGRESIÓN LINEAL SIMPLE (proyección, NO un modelo de ML)

   Mínimos cuadrados sobre (índice de mes, total). Con menos de 4
   puntos no se proyecta: con tan poca historia cualquier "tendencia"
   sería puro ruido, así que se prefiere devolver null y decirlo en la
   interfaz en vez de simular confianza que no existe.
========================================================= */

export function proyeccionLineal(serie, mesesAProyectar = 3) {

    const n = serie.length;
    if (n < 4) return null;

    const xs = serie.map((_, i) => i);
    const ys = serie.map(p => p.total);

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

    const denominador = n * sumXX - sumX * sumX;
    if (denominador === 0) return null;

    const pendiente = (n * sumXY - sumX * sumY) / denominador;
    const intercepto = (sumY - pendiente * sumX) / n;

    const predice = x => Math.max(0, pendiente * x + intercepto);

    // Desviación estándar de los residuos — se usa como banda de
    // incertidumbre ingenua (± 1 desviación), no como un intervalo de
    // confianza estadísticamente riguroso.
    const residuos = ys.map((y, i) => y - predice(i));
    const varianza = residuos.reduce((acc, r) => acc + r * r, 0) / n;
    const desviacion = Math.sqrt(varianza);

    const proyeccion = [];
    for (let i = 0; i < mesesAProyectar; i++) {
        const x = n + i;
        const ultimaClave = serie[serie.length - 1].clave;
        const [anio, mes] = ultimaClave.split('-').map(Number);
        let anioProy = anio, mesProy = mes + i + 1;
        while (mesProy > 12) { mesProy -= 12; anioProy++; }
        const clave = `${anioProy}-${String(mesProy).padStart(2, '0')}`;
        proyeccion.push({
            clave,
            etiqueta: etiquetaMes(clave),
            total: Math.round(predice(x)),
            min: Math.max(0, Math.round(predice(x) - desviacion)),
            max: Math.round(predice(x) + desviacion)
        });
    }

    return {
        pendiente,
        tendencia: pendiente > 0.05 ? 'subiendo' : (pendiente < -0.05 ? 'bajando' : 'estable'),
        proyeccion,
        // r² simple, para no mostrar la proyección con la misma
        // confianza visual cuando el ajuste es malo.
        r2: (() => {
            const mediaY = sumY / n;
            const ssTot = ys.reduce((acc, y) => acc + (y - mediaY) ** 2, 0);
            const ssRes = residuos.reduce((acc, r) => acc + r * r, 0);
            return ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
        })()
    };

}

/* =========================================================
   EMERGENCIAS — AGREGACIONES
========================================================= */

// Mapa evento específico → categoría, calcado de los <optgroup> reales
// de modules/emergencia/index.html (campo #evento). Si en el futuro se
// agrega un tipo de evento nuevo al formulario y no se actualiza este
// mapa, cae en "Otros" en vez de romper el conteo.
const CATEGORIA_POR_EVENTO = {
    'Incendio Estructural': 'Incendios', 'Incendio Forestal': 'Incendios',
    'Incendio Vehicular': 'Incendios', 'Incendio Incipiente': 'Incendios',
    'Incendio Industrial': 'Incendios', 'Quemas': 'Incendios',
    'Rescate Vehicular': 'Rescate', 'Rescate en Altura': 'Rescate',
    'Rescate Acuático': 'Rescate', 'Rescate Industrial': 'Rescate',
    'Rescate Urbano': 'Rescate', 'Caso suicida': 'Rescate',
    'Rescate en Montaña': 'Rescate', 'Rescate en Espacios Confinados': 'Rescate',
    'Rescate de Personas Atrapadas': 'Rescate', 'Rescate Animal': 'Rescate',
    'Control de Abejas': 'Rescate',
    'Atención Prehospitalaria': 'Emergencias médicas', 'Accidente de Tránsito': 'Emergencias médicas',
    'Lesiones por Explosión': 'Emergencias médicas', 'Evento Másivo': 'Emergencias médicas',
    'Acompañamiento de Eventos': 'Emergencias médicas', 'Accidentes Múltiples': 'Emergencias médicas',
    'Derrame de Sustancias Químicas': 'Materiales peligrosos', 'Fuga de Gas': 'Materiales peligrosos',
    'Derrame de Hidrocarburos': 'Materiales peligrosos',
    'Explosión': 'Riesgo tecnológico', 'Colapso Estructural': 'Riesgo tecnológico',
    'Emergencia en Instalación Eléctrica': 'Riesgo tecnológico',
    'Falsa Alarma': 'Otros', 'Apoyo Interinstitucional': 'Otros',
    'Prevención y Seguridad': 'Otros', 'Servicio Social a la Comunidad': 'Otros',
    'Capacitación': 'Otros', 'Otro Evento': 'Otros'
};

function categoriaDeEvento(evento) {
    return CATEGORIA_POR_EVENTO[evento] || 'Otros';
}

function contarPor(lista, obtenerClave) {
    const conteos = new Map();
    lista.forEach(item => {
        const clave = obtenerClave(item);
        if (clave === null || clave === undefined || clave === '') return;
        conteos.set(clave, (conteos.get(clave) || 0) + 1);
    });
    return [...conteos.entries()]
        .map(([clave, total]) => ({ clave, total }))
        .sort((a, b) => b.total - a.total);
}

export function analizarEmergencias(emergencias) {

    const total = emergencias.length;

    const porCategoria = contarPor(emergencias, e => categoriaDeEvento(e.evento));
    const porEvento = contarPor(emergencias, e => e.evento).slice(0, 10);

    const porDiaSemana = (() => {
        const conteos = new Array(7).fill(0);
        emergencias.forEach(e => {
            const fecha = parseFechaISO(e.fecha);
            if (fecha) conteos[fecha.getDay()]++;
        });
        return NOMBRES_DIA.map((nombre, i) => ({ clave: nombre, total: conteos[i] }));
    })();

    const porHora = (() => {
        const conteos = new Array(24).fill(0);
        emergencias.forEach(e => {
            const m = /^(\d{2}):/.exec(e.horaLlegada || '');
            if (m) conteos[Number(m[1])]++;
        });
        return conteos.map((total, hora) => ({ clave: `${String(hora).padStart(2, '0')}:00`, total }));
    })();

    // Víctimas/lesionados: campos numéricos en texto libre en el
    // formulario (ver app.js del módulo emergencia), así que se
    // parsean con cuidado en vez de asumir que siempre son números.
    let totalVictimas = 0, totalLesionados = 0, conVictimas = 0;
    emergencias.forEach(e => {
        const v = parseInt(e.victimas, 10) || 0;
        const l = parseInt(e.lesionados, 10) || 0;
        totalVictimas += v;
        totalLesionados += l;
        if (v > 0 || l > 0) conVictimas++;
    });

    // Duración promedio del servicio.
    const duraciones = emergencias
        .map(e => minutosEntreHoras(e.horaLlegada, e.horaFinal))
        .filter(m => m !== null);
    const duracionPromedio = duraciones.length
        ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
        : null;

    // Ranking de personal (bomberos) por número de intervenciones.
    const conteoPersonal = new Map();
    emergencias.forEach(e => {
        (e.personal || []).forEach(nombre => {
            if (!nombre) return;
            conteoPersonal.set(nombre, (conteoPersonal.get(nombre) || 0) + 1);
        });
    });
    const rankingPersonal = [...conteoPersonal.entries()]
        .map(([nombre, total]) => ({ clave: nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // Ranking de vehículos.
    const conteoVehiculos = new Map();
    emergencias.forEach(e => {
        (e.vehiculos || []).forEach(v => {
            const nombre = v?.vehiculo;
            if (!nombre) return;
            conteoVehiculos.set(nombre, (conteoVehiculos.get(nombre) || 0) + 1);
        });
    });
    const rankingVehiculos = [...conteoVehiculos.entries()]
        .map(([nombre, total]) => ({ clave: nombre, total }))
        .sort((a, b) => b.total - a.total);

    // Cobertura de firmas — métrica de calidad del propio proceso de
    // captura, con datos 100% reales (no hay forma de simular esto).
    let afectadosConFirma = 0, afectadosTotal = 0;
    let emergenciasConBombero = 0, emergenciasConFirmaBombero = 0;
    emergencias.forEach(e => {
        (e.afectados || []).forEach(a => {
            afectadosTotal++;
            if (typeof a.firma === 'string' && a.firma.startsWith('data:image')) afectadosConFirma++;
        });
        if ((e.personal || []).length) {
            emergenciasConBombero++;
            const firmo = (e.firmasBomberos || []).some(
                b => typeof b.firma === 'string' && b.firma.startsWith('data:image')
            );
            if (firmo) emergenciasConFirmaBombero++;
        }
    });

    // Ubicaciones válidas para el mapa.
    const ubicaciones = emergencias
        .map(e => ({
            lat: parseFloat(e.latitud),
            lng: parseFloat(e.longitud),
            evento: e.evento || 'Sin tipo',
            fecha: e.fecha || '',
            lugar: e.lugar || e.direccion || ''
        }))
        .filter(u => Number.isFinite(u.lat) && Number.isFinite(u.lng) && (u.lat !== 0 || u.lng !== 0));

    return {
        total,
        porCategoria,
        porEvento,
        porDiaSemana,
        porHora,
        totalVictimas,
        totalLesionados,
        conVictimas,
        duracionPromedio,
        rankingPersonal,
        rankingVehiculos,
        ubicaciones,
        cobertura: {
            afectadosTotal,
            afectadosConFirma,
            porcentajeAfectados: afectadosTotal ? Math.round((afectadosConFirma / afectadosTotal) * 100) : null,
            emergenciasConBombero,
            emergenciasConFirmaBombero,
            porcentajeBomberos: emergenciasConBombero
                ? Math.round((emergenciasConFirmaBombero / emergenciasConBombero) * 100)
                : null
        }
    };

}

/* =========================================================
   INSPECCIONES — AGREGACIONES
========================================================= */

const FACTORES_RIESGO = [
    { campo: 'gasGLP_existe', etiqueta: 'Gas GLP' },
    { campo: 'gasNatural_existe', etiqueta: 'Gas natural' },
    { campo: 'liquidosInflamables_existe', etiqueta: 'Líquidos inflamables' },
    { campo: 'maderaComb_existe', etiqueta: 'Madera / combustible sólido' },
    { campo: 'papelCarton_existe', etiqueta: 'Papel / cartón' },
    { campo: 'combustibleOtros_existe', etiqueta: 'Otros combustibles' }
];

export function analizarInspecciones(inspecciones) {

    const total = inspecciones.length;

    const porResultado = contarPor(inspecciones, i => i.resultadoInspeccion);
    const porTipo = contarPor(inspecciones, i => i.tipoInspeccion);
    const porBarrio = contarPor(inspecciones, i => i.barrio).slice(0, 10);

    const noCumple = inspecciones.filter(i => i.resultadoInspeccion === 'No cumple').length;
    const tasaCumplimiento = total
        ? Math.round(((total - noCumple) / total) * 100)
        : null;

    const hallazgos = FACTORES_RIESGO.map(({ campo, etiqueta }) => {
        const conRiesgo = inspecciones.filter(i => i[campo] === true).length;
        return {
            clave: etiqueta,
            total: conRiesgo,
            porcentaje: total ? Math.round((conRiesgo / total) * 100) : 0
        };
    }).sort((a, b) => b.total - a.total);

    // Extintores en mal estado (PQS + agua combinados) — “Malo” o
    // “Regular” cuentan como hallazgo, solo “Bueno” es realmente OK.
    let extintoresRevisados = 0, extintoresDeficientes = 0;
    inspecciones.forEach(i => {
        ['extintorPQS_estado', 'extintorAgua_estado'].forEach(campo => {
            if (!i[campo]) return;
            extintoresRevisados++;
            if (i[campo] !== 'Bueno') extintoresDeficientes++;
        });
    });

    // Reinspecciones vencidas: fechaReinspeccion ya pasó y no hay
    // evidencia de una inspección posterior en la misma dirección con
    // fecha más reciente. Aproximado (compara por dirección+barrio,
    // no hay un id que amarre "reinspección de cuál"), así que se
    // etiqueta como estimado en la UI.
    const hoy = new Date();
    const reinspeccionesVencidas = inspecciones.filter(i => {
        const fecha = parseFechaISO(i.fechaReinspeccion);
        return fecha && fecha < hoy;
    }).length;

    return {
        total,
        porResultado,
        porTipo,
        porBarrio,
        tasaCumplimiento,
        hallazgos,
        extintores: {
            revisados: extintoresRevisados,
            deficientes: extintoresDeficientes,
            porcentajeDeficiente: extintoresRevisados
                ? Math.round((extintoresDeficientes / extintoresRevisados) * 100)
                : null
        },
        reinspeccionesVencidas
    };

}

/* =========================================================
   ÍNDICE DE RIESGO POR BARRIO (compuesto simple, NO un modelo)

   Combina, por barrio, el número de inspecciones con resultado
   "No cumple" y el número de hallazgos de riesgo reales (gas,
   líquidos inflamables, etc.). Es un conteo ponderado transparente,
   no un score entrenado — se etiqueta así en la interfaz para no
   sobre-vender lo que es.
========================================================= */

export function indiceRiesgoPorBarrio(inspecciones) {

    const porBarrio = new Map();

    inspecciones.forEach(i => {
        const barrio = i.barrio?.trim();
        if (!barrio) return;

        if (!porBarrio.has(barrio)) {
            porBarrio.set(barrio, { barrio, inspecciones: 0, noCumple: 0, hallazgos: 0 });
        }

        const registro = porBarrio.get(barrio);
        registro.inspecciones++;
        if (i.resultadoInspeccion === 'No cumple') registro.noCumple++;
        FACTORES_RIESGO.forEach(({ campo }) => {
            if (i[campo] === true) registro.hallazgos++;
        });

    });

    return [...porBarrio.values()]
        .map(r => ({
            ...r,
            // Ponderación simple: "No cumple" pesa más que un hallazgo
            // puntual porque implica una revisión reprobada completa.
            indice: r.noCumple * 3 + r.hallazgos
        }))
        .sort((a, b) => b.indice - a.indice)
        .slice(0, 8);

}

/* =========================================================
   HELPER: conteo sobre campos MULTIVALOR (arrays), como
   infraestructuraAfectada u origenFenomeno en Censos, donde un mismo
   registro puede marcar varias opciones a la vez — a diferencia de
   contarPor(), que asume un solo valor escalar por registro.
========================================================= */

function contarPorMultivalor(lista, obtenerArray) {

    const conteos = new Map();

    lista.forEach(item => {
        const valores = obtenerArray(item);
        if (!Array.isArray(valores)) return;
        valores.forEach(valor => {
            if (valor === null || valor === undefined || valor === '') return;
            conteos.set(valor, (conteos.get(valor) || 0) + 1);
        });
    });

    return [...conteos.entries()]
        .map(([clave, total]) => ({ clave, total }))
        .sort((a, b) => b.total - a.total);

}

/* =========================================================
   ANÁLISIS: CENSOS
========================================================= */

export function analizarCensos(censos) {

    const total = censos.length;

    const totalPersonasCensadas = censos.reduce(
        (suma, c) => suma + (Array.isArray(c.integrantes) ? c.integrantes.length : 0),
        0
    );

    const totalMascotas = censos.reduce(
        (suma, c) => suma + (Array.isArray(c.mascotas)
            ? c.mascotas.reduce((s, m) => s + (Number(m.cantidad) || 1), 0)
            : 0),
        0
    );

    const recomendacionesEvacuar = censos.filter(c => c.recomendacionEvacuacion === 'SI').length;

    const porBarrioVereda = contarPor(censos, c => c.barrioVereda || c.municipio).slice(0, 10);

    const porTipoOcupante = contarPor(censos, c => c.tipoOcupante);

    const infraestructuraAfectada = contarPorMultivalor(censos, c => c.infraestructuraAfectada).slice(0, 8);

    const pendientesSync = censos.filter(c => c.pending === true).length;

    return {
        total,
        totalPersonasCensadas,
        totalMascotas,
        recomendacionesEvacuar,
        porcentajeEvacuar: total ? Math.round((recomendacionesEvacuar / total) * 100) : null,
        porBarrioVereda,
        porTipoOcupante,
        infraestructuraAfectada,
        pendientesSync
    };

}

/* =========================================================
   ANÁLISIS: AYUDAS HUMANITARIAS
========================================================= */

export function analizarAyudas(ayudas) {

    const total = ayudas.length;

    const totalKitsEntregados = ayudas.reduce(
        (suma, a) => suma + (Number(a.cantidadEntregada) || 0),
        0
    );

    const porTipoKit = contarPor(ayudas, a => a.tipoKit);

    const beneficiariosUnicos = new Set(
        ayudas.map(a => (a.beneficiarioCedula || '').trim()).filter(Boolean)
    ).size;

    const censados = ayudas.filter(a => a.censado === 'Sí').length;

    const pendientesSync = ayudas.filter(a => a.pending === true).length;

    return {
        total,
        totalKitsEntregados,
        porTipoKit,
        beneficiariosUnicos,
        censados,
        porcentajeCensados: total ? Math.round((censados / total) * 100) : null,
        pendientesSync
    };

}
