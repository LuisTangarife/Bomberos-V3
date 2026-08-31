/* =========================================================
   CATALOGOS.JS
   CRUD genérico de listas desplegables gestionables desde el Panel
   General, contra Firestore (colección "catalogos").

   Mismo patrón que unidades.js / personalCuerpo.js, pero genérico:
   un solo módulo sirve para "Tipo de evento" (Emergencia), "Tipo de
   kit" (Ayudas), "Barrio/Vereda" y "Actividad económica" (Censos),
   "Tipo de inspección" (Inspecciones) — y cualquier catálogo nuevo
   que se registre más adelante, sin escribir CRUD otra vez.

   Un documento por catálogo, id = "<modulo>__<campo>", con esta forma:
     {
       modulo: "emergencia",
       campo: "tipoEvento",
       items: [ { grupo: "INCENDIOS", valor: "Incendio Estructural" }, ... ]
     }
   "grupo" es opcional — catálogos sin agrupar (como Tipo de kit) lo
   dejan vacío.

   IMPORTANTE — por qué existe REGISTRO_CATALOGOS y las listas
   SEMILLA_*: cada módulo YA tenía estas opciones escritas fijas en su
   HTML. Si un catálogo en Firestore está vacío (nadie lo ha tocado
   todavía desde el panel), listarCatalogo() devuelve un arreglo
   vacío — cada módulo consumidor decide entonces si usa su propia
   lista fija de respaldo (mismo criterio que unidades.js). Las
   funciones "sembrarCatalogo" están para que, desde el Panel, un
   administrador cargue esos mismos valores iniciales a Firestore con
   un clic, en vez de tener que escribirlos todos a mano la primera
   vez.
========================================================= */

import { db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const COLECCION = "catalogos";

// Registro de todos los catálogos que existen en la plataforma. El
// Panel General lee esta lista para saber qué mostrar en el selector
// "¿Qué catálogo quieres editar?" — agregar un catálogo nuevo en el
// futuro es agregar una fila aquí, no escribir una pantalla nueva.
export const REGISTRO_CATALOGOS = [
    {
        modulo: "emergencia", campo: "tipoEvento",
        etiqueta: "Emergencia — Tipo de evento",
        agrupable: true
    },
    {
        modulo: "ayudas", campo: "tipoKit",
        etiqueta: "Ayudas — Tipo de kit",
        agrupable: false
    },
    {
        modulo: "censos", campo: "barrioVereda",
        etiqueta: "Censos — Barrio / Vereda",
        agrupable: true
    },
    {
        modulo: "censos", campo: "actividadEconomica",
        etiqueta: "Censos — Tipo de actividad económica",
        agrupable: false
    },
    {
        modulo: "inspecciones", campo: "tipoInspeccion",
        etiqueta: "Inspecciones — Tipo de inspección",
        agrupable: false
    }
];

// Valores que cada módulo ya traía fijos en su HTML. Sirven como
// "semilla" (botón "Cargar valores actuales" en el panel) y como
// respaldo si Firestore no responde — nunca se pierden las opciones
// que ya existían solo por construir este sistema.
const SEMILLAS = {

    "emergencia__tipoEvento": [
        { grupo: "INCENDIOS", valor: "Incendio Estructural" },
        { grupo: "INCENDIOS", valor: "Incendio Forestal" },
        { grupo: "INCENDIOS", valor: "Incendio Vehicular" },
        { grupo: "INCENDIOS", valor: "Incendio Incipiente" },
        { grupo: "INCENDIOS", valor: "Incendio Industrial" },
        { grupo: "INCENDIOS", valor: "Quemas" },
        { grupo: "RESCATE", valor: "Rescate Vehicular" },
        { grupo: "RESCATE", valor: "Rescate en Altura" },
        { grupo: "RESCATE", valor: "Rescate Acuático" },
        { grupo: "RESCATE", valor: "Rescate Industrial" },
        { grupo: "RESCATE", valor: "Rescate Urbano" },
        { grupo: "RESCATE", valor: "Caso suicida" },
        { grupo: "RESCATE", valor: "Rescate en Montaña" },
        { grupo: "RESCATE", valor: "Rescate en Espacios Confinados" },
        { grupo: "RESCATE", valor: "Rescate de Personas Atrapadas" },
        { grupo: "RESCATE", valor: "Rescate Animal" },
        { grupo: "RESCATE", valor: "Control de Abejas" },
        { grupo: "RESCATE", valor: "Control de Enjambre de Avispas" },
        { grupo: "RESCATE", valor: "Recuperación de Cadáver" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Atención Prehospitalaria" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Accidente de Tránsito" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Lesiones por Explosión" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Evento Másivo" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Acompañamiento de Eventos" },
        { grupo: "EMERGENCIAS MÉDICAS", valor: "Accidentes Múltiples" },
        { grupo: "MATERIALES PELIGROSOS", valor: "Derrame de Sustancias Químicas" },
        { grupo: "MATERIALES PELIGROSOS", valor: "Fuga de Gas" },
        { grupo: "MATERIALES PELIGROSOS", valor: "Derrame de Hidrocarburos" },
        { grupo: "RIESGO TECNOLÓGICO Y AMBIENTAL", valor: "Explosión" },
        { grupo: "RIESGO TECNOLÓGICO Y AMBIENTAL", valor: "Colapso Estructural" },
        { grupo: "RIESGO TECNOLÓGICO Y AMBIENTAL", valor: "Emergencia en Instalación Eléctrica" },
        { grupo: "RIESGO TECNOLÓGICO Y AMBIENTAL", valor: "Emergencias Ambientales" },
        { grupo: "OTROS", valor: "Falsa Alarma" },
        { grupo: "OTROS", valor: "Apoyo Interinstitucional" },
        { grupo: "OTROS", valor: "Prevención y Seguridad" },
        { grupo: "OTROS", valor: "Servicio Social a la Comunidad" },
        { grupo: "OTROS", valor: "Capacitación" },
        { grupo: "OTROS", valor: "Salida sin Intervención" },
        { grupo: "OTROS", valor: "Otro Evento" },
        { grupo: "OTROS", valor: "Revisión de terreno" },
        { grupo: "OTROS", valor: "Revisión de Hidrantes" },
        { grupo: "OTROS", valor: "Fuga de Agua" },
        { grupo: "OTROS", valor: "Ruptura de Tubería" },
        { grupo: "OTROS", valor: "Inundación" }
    ],

    "ayudas__tipoKit": [
        { grupo: "", valor: "Kit Alimentario" },
        { grupo: "", valor: "Kit Aseo" },
        { grupo: "", valor: "Kit Cocina" },
        { grupo: "", valor: "Kit Noche" },
        { grupo: "", valor: "Kit Mascota" }
    ],

    "censos__barrioVereda": [
        { grupo: "Veredas", valor: "Alto Arroyo" },
        { grupo: "Veredas", valor: "Alto Castillo" },
        { grupo: "Veredas", valor: "Bajo Arroyo" },
        { grupo: "Veredas", valor: "Bajo Castillo" },
        { grupo: "Veredas", valor: "Corozal" },
        { grupo: "Veredas", valor: "Cuervos" },
        { grupo: "Veredas", valor: "El Avión" },
        { grupo: "Veredas", valor: "El Pindo" },
        { grupo: "Veredas", valor: "El Yarumo" },
        { grupo: "Veredas", valor: "Frailes" },
        { grupo: "Veredas", valor: "Gallinazo" },
        { grupo: "Veredas", valor: "Guayana" },
        { grupo: "Veredas", valor: "La Batea" },
        { grupo: "Veredas", valor: "La Floresta" },
        { grupo: "Veredas", valor: "La Florida" },
        { grupo: "Veredas", valor: "La Laguna" },
        { grupo: "Veredas", valor: "Laguna Alta" },
        { grupo: "Veredas", valor: "Llanitos" },
        { grupo: "Veredas", valor: "Miraflores" },
        { grupo: "Veredas", valor: "Montaño" },
        { grupo: "Veredas", valor: "Nueva Primavera" },
        { grupo: "Veredas", valor: "Papayal" },
        { grupo: "Veredas", valor: "Páramo" },
        { grupo: "Veredas", valor: "Partidas" },
        { grupo: "Veredas", valor: "Playa Larga" },
        { grupo: "Veredas", valor: "Rincón Santo" },
        { grupo: "Veredas", valor: "Romeral" },
        { grupo: "Veredas", valor: "San Julián" },
        { grupo: "Veredas", valor: "Santo Domingo" },
        { grupo: "Veredas", valor: "Tejares" },
        { grupo: "Veredas", valor: "Termales" },
        { grupo: "Veredas", valor: "Valles" },
        { grupo: "Veredas", valor: "Villarazo" },
        { grupo: "Barrios (casco urbano)", valor: "Centro / Sector Tradicional" },
        { grupo: "Barrios (casco urbano)", valor: "La Pradera" },
        { grupo: "Barrios (casco urbano)", valor: "Turín" },
        { grupo: "Barrios (casco urbano)", valor: "San Diego" },
        { grupo: "Barrios (casco urbano)", valor: "Monserrate" },
        { grupo: "Barrios (casco urbano)", valor: "Urapanes" }
    ],

    "censos__actividadEconomica": [
        { grupo: "", valor: "Comercio (tienda, ferretería, misceláneo)" },
        { grupo: "", valor: "Alimentos y bebidas (restaurante, panadería, tienda de barrio)" },
        { grupo: "", valor: "Servicios (peluquería, taller, oficina)" },
        { grupo: "", valor: "Industrial / manufactura" },
        { grupo: "", valor: "Agropecuario" },
        { grupo: "", valor: "Otro" }
    ],

    "inspecciones__tipoInspeccion": [
        { grupo: "", valor: "Comercial" },
        { grupo: "", valor: "Industrial" },
        { grupo: "", valor: "Residencial" },
        { grupo: "", valor: "Institucional" },
        { grupo: "", valor: "Educativa" },
        { grupo: "", valor: "Hospitalaria" },
        { grupo: "", valor: "Bodega" },
        { grupo: "", valor: "Otra" }
    ]

};

function idDocumento(modulo, campo) {
    return `${modulo}__${campo}`;
}

/**
 * Devuelve los items del catálogo, o un arreglo vacío si todavía no
 * existe en Firestore (nadie lo ha sembrado/editado). No lanza si hay
 * error de red — los módulos que consumen esto deben tratarlo igual
 * que unidades.js: si falla o vuelve vacío, usan su propia lista fija
 * de respaldo, nunca dejan el campo sin opciones.
 */
export async function listarCatalogo(modulo, campo) {

    try {

        const ref = doc(db, COLECCION, idDocumento(modulo, campo));
        const snap = await getDoc(ref);

        if (!snap.exists()) return [];

        const items = snap.data()?.items;
        return Array.isArray(items) ? items : [];

    } catch (error) {

        console.error(`[catalogos] No se pudo leer ${modulo}/${campo}:`, error);
        return [];

    }

}

export function obtenerSemilla(modulo, campo) {
    return SEMILLAS[idDocumento(modulo, campo)] || [];
}

/** Sobrescribe el catálogo completo con este arreglo de items. */
export async function guardarCatalogo(modulo, campo, items) {

    const ref = doc(db, COLECCION, idDocumento(modulo, campo));

    await setDoc(ref, {
        modulo,
        campo,
        items,
        updatedAt: serverTimestamp()
    });

}

/** Carga los valores originales (los que traía el HTML) a Firestore. */
export async function sembrarCatalogo(modulo, campo) {

    const semilla = obtenerSemilla(modulo, campo);
    await guardarCatalogo(modulo, campo, semilla);
    return semilla;

}

export async function agregarItemCatalogo(modulo, campo, valor, grupo = "") {

    const actual = await listarCatalogo(modulo, campo);

    const valorLimpio = valor.trim();
    if (!valorLimpio) throw new Error("El valor no puede estar vacío.");

    if (actual.some(i => i.valor.toLowerCase() === valorLimpio.toLowerCase())) {
        throw new Error("Ese valor ya existe en el catálogo.");
    }

    const nuevo = [...actual, { grupo: grupo.trim(), valor: valorLimpio }];
    await guardarCatalogo(modulo, campo, nuevo);

    return nuevo;

}

export async function eliminarItemCatalogo(modulo, campo, valor) {

    const actual = await listarCatalogo(modulo, campo);
    const nuevo = actual.filter(i => i.valor !== valor);

    await guardarCatalogo(modulo, campo, nuevo);

    return nuevo;

}

export async function eliminarCatalogoCompleto(modulo, campo) {
    await deleteDoc(doc(db, COLECCION, idDocumento(modulo, campo)));
}

/**
 * Reconstruye las <option>/<optgroup> de un <select> nativo a partir
 * de un catálogo, respetando el mismo patrón de "usa lo real si hay,
 * si no deja lo que ya traía el HTML" que unidades.js. Pensado para
 * selects simples (evento, actividadEconomica, tipoInspeccion,
 * barrioVereda) — Ayudas usa su propio render porque son fichas
 * tocables, no un <select>.
 *
 * opciones.placeholder: texto de la opción vacía inicial (si aplica)
 * opciones.extra: opciones fijas a mantener al final (ej. "Otro")
 */
export function reconstruirSelectDesdeCatalogo(select, items, opciones = {}) {

    if (!select || !items.length) return false;

    const { placeholder, extra = [] } = opciones;

    const valorPrevio = select.value;

    select.innerHTML = "";

    if (placeholder) {
        const optPlaceholder = document.createElement("option");
        optPlaceholder.value = "";
        optPlaceholder.textContent = placeholder;
        select.appendChild(optPlaceholder);
    }

    const grupos = new Map();

    items.forEach(item => {

        const clave = item.grupo || "";

        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(item.valor);

    });

    grupos.forEach((valores, grupo) => {

        const contenedor = grupo
            ? document.createElement("optgroup")
            : select;

        if (grupo) contenedor.label = grupo;

        valores.forEach(valor => {
            const opt = document.createElement("option");
            opt.textContent = valor;
            contenedor.appendChild(opt);
        });

        if (grupo) select.appendChild(contenedor);

    });

    extra.forEach(({ valor, texto }) => {
        const opt = document.createElement("option");
        opt.value = valor;
        opt.textContent = texto;
        select.appendChild(opt);
    });

    // Si el valor que tenía antes de reconstruir sigue existiendo en
    // la lista nueva, se conserva (relevante al editar un registro
    // existente, para no perder la selección ya guardada).
    if (valorPrevio && [...select.options].some(o => o.value === valorPrevio || o.textContent === valorPrevio)) {
        select.value = valorPrevio;
    }

    return true;

}
