/* ========================================================================
   PERSISTENCIA.JS
   Sistema de Inspecciones — CRUD, caché y sincronización remota
======================================================================== */

import { UI } from "./dom.js";
import { state, APP } from "./estado.js";
import { obtenerDatosFormulario, cargarFormulario, limpiarFormulario } from "./formulario.js";
import { validarFormularioCompleto } from "./validaciones.js";
import { eliminarBorrador, guardarAhora } from "./autoguardado.js";
import { renderizarFotos } from "./fotos.js";
import { restaurarFirma } from "./firmas.js";
import { mostrarPaso } from "./navegacion.js";
import { confirmar, mostrarToast } from "./utilidades.js";

import {
    guardarInspeccion as guardarInspeccionFirestore,
    listarInspecciones as listarInspeccionesFirestore,
    actualizarInspeccion as actualizarInspeccionFirestore,
    eliminarInspeccion as eliminarInspeccionFirestore,
    subirFotoStorage,
    eliminarFotoStorage
} from "./firebase.js";

/* ------------------------------------------------------------------------
   CRUD LOCAL — INSPECCIÓN ACTUAL
------------------------------------------------------------------------ */

export function nuevaInspeccion() {

    if (state.hayCambios) guardarAhora();

    limpiarFormulario();

    state.editando = false;
    state.inspeccionId = crypto.randomUUID();

    asignarNumeroInspeccion();

    mostrarPaso(0);

    document.dispatchEvent(new CustomEvent("inspection:new"));

}

function asignarNumeroInspeccion() {

    const campo = state.form?.elements?.namedItem("numeroInspeccion");
    if (!campo) return;

    campo.value = generarSiguienteConsecutivo();

}

function generarSiguienteConsecutivo() {

    let ultimo = 0;

    try {
        ultimo = Number(localStorage.getItem(APP.STORAGE_KEY_CONSECUTIVO)) || 0;
    } catch (error) {
        console.error("No se pudo leer el consecutivo de inspecciones", error);
    }

    ultimo++;

    try {
        localStorage.setItem(APP.STORAGE_KEY_CONSECUTIVO, String(ultimo));
    } catch (error) {
        console.error("No se pudo guardar el consecutivo de inspecciones", error);
    }

    return `INS-${String(ultimo).padStart(5, "0")}`;

}

export function obtenerInspeccionActual() {

    return {
        id: state.inspeccionId ?? crypto.randomUUID(),
        fechaCreacion:
            state.seleccionada?.fechaCreacion || new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        usuario: state.usuario,
        formulario: obtenerDatosFormulario(),
        // Solo se guardan los metadatos + URL de cada foto (nunca el
        // File original ni el base64), porque esto es lo que va directo
        // al documento de Firestore. subirFotosPendientes() debe haberse
        // ejecutado antes de llamar a esta función para que todas las
        // fotos ya tengan "url".
        fotos: state.fotos.map(foto => ({
            id: foto.id,
            nombre: foto.nombre,
            tipo: foto.tipo,
            peso: foto.peso,
            fecha: foto.fecha,
            orden: foto.orden,
            url: foto.url
        })),
        firmas: structuredClone(state.firmas)
    };

}

async function base64AFile(dataUrl, nombre, tipo) {
    const respuesta = await fetch(dataUrl);
    const blob = await respuesta.blob();
    return new File([blob], nombre, { type: tipo });
}

function obtenerConsecutivoActual() {
    return state.form?.elements?.namedItem("numeroInspeccion")?.value
        || state.inspeccionId;
}

// Cuántas fotos se suben al mismo tiempo. Subir las 50 fotos permitidas
// (APP.MAX_FOTOS) todas a la vez podría saturar la conexión del celular
// (sobre todo en 4G), así que se suben en tandas de este tamaño en vez
// de una por una (que era lo que hacía que guardar tardara minutos:
// antes el tiempo total era la SUMA de cada subida, ahora es más
// parecido al tiempo de la tanda más lenta).
const FOTOS_SUBIDA_CONCURRENTE = 4;

/**
 * Sube a Firebase Storage cualquier foto que todavía no tenga "url"
 * (fotos nuevas, recién elegidas de la cámara/galería) y actualiza
 * state.fotos con la URL resultante, en el mismo orden en que quedaron
 * en pantalla.
 *
 * Antes esto se hacía con un "for" que esperaba (await) cada foto
 * antes de empezar la siguiente, es decir, en serie. Con hasta 50
 * fotos permitidas (APP.MAX_FOTOS) y fotos de cámara sin comprimir
 * (varios MB cada una), eso podía sumar varios minutos. Ahora se suben
 * varias fotos EN PARALELO (Promise.all por tanda), manteniendo el
 * orden final en state.fotos.
 */
async function subirFotosPendientes(consecutivo) {

    const pendientes = [];

    for (let i = 0; i < state.fotos.length; i++) {
        if (!state.fotos[i].url) pendientes.push(i);
    }

    for (let inicio = 0; inicio < pendientes.length; inicio += FOTOS_SUBIDA_CONCURRENTE) {

        const tanda = pendientes.slice(inicio, inicio + FOTOS_SUBIDA_CONCURRENTE);

        await Promise.all(tanda.map(async i => {

            const foto = state.fotos[i];

            // Inspecciones guardadas ANTES de este arreglo tienen la foto
            // completa en base64 dentro de "imagen" y no tienen "archivo".
            // Si es el caso, se convierte a File aquí mismo para poder
            // subirla a Storage igual (así se "sanean" solas al editarlas).
            const archivo = foto.archivo || await base64AFile(foto.imagen, foto.nombre, foto.tipo);

            const subida = await subirFotoStorage(consecutivo, {
                ...foto,
                archivo,
                orden: i
            });

            state.fotos[i] = subida;

        }));

    }

    renderizarFotos();

}

/**
 * Borra de Firebase Storage las fotos que el usuario quitó del
 * formulario (y que ya estaban subidas). Si falla el borrado de alguna,
 * no se interrumpe el guardado: es preferible dejar un archivo huérfano
 * en Storage que perder la inspección completa.
 */
async function eliminarFotosPendientes(consecutivo) {

    const pendientes = state.fotosEliminadas;
    state.fotosEliminadas = [];

    for (const foto of pendientes) {

        try {
            await eliminarFotoStorage(consecutivo, foto);
        } catch (error) {
            console.error("No se pudo borrar la foto de Storage", foto.id, error);
        }

    }

}

export function abrirInspeccion(inspeccion) {

    if (!inspeccion) return;

    limpiarFormulario();

    state.editando = true;
    state.inspeccionId = inspeccion.id;
    state.seleccionada = inspeccion;

    cargarFormulario(inspeccion.formulario);

    state.fotos = structuredClone(inspeccion.fotos || []);
    state.firmas = structuredClone(inspeccion.firmas || {});

    requestAnimationFrame(() => {
        renderizarFotos();
        restaurarFirma("inspector");
        restaurarFirma("propietario");
    });

    mostrarPaso(0);

    document.dispatchEvent(
        new CustomEvent("inspection:opened", { detail: inspeccion })
    );

}

export function cerrarInspeccion() {

    limpiarFormulario();

    state.seleccionada = null;
    state.editando = false;
    state.inspeccionId = null;

}

export function duplicarInspeccion(inspeccion) {

    const copia = structuredClone(inspeccion);

    copia.id = crypto.randomUUID();
    copia.fechaCreacion = new Date().toISOString();
    copia.fechaActualizacion = copia.fechaCreacion;

    return copia;

}

export function hayInspeccionAbierta() {
    return state.inspeccionId !== null;
}

export function modoEdicion() {
    return state.editando;
}

export function modoCreacion() {
    return !state.editando;
}

document.addEventListener("inspection:new", () => {
    if (APP.DEBUG) console.log("Nueva inspección");
});

document.addEventListener("inspection:opened", e => {
    if (APP.DEBUG) console.log("Inspección abierta", e.detail.id);
});

/* ------------------------------------------------------------------------
   CACHÉ Y LISTADO EN MEMORIA
------------------------------------------------------------------------ */

export function obtenerInspeccion(id) {
    return state.cache.inspecciones.get(id);
}

function indiceInspeccion(id) {
    return state.inspecciones.findIndex(item => item.id === id);
}

function actualizarInspeccionMemoria(inspeccion) {

    const indice = indiceInspeccion(inspeccion.id);

    if (indice === -1) {
        state.inspecciones.push(inspeccion);
    } else {
        state.inspecciones[indice] = inspeccion;
    }

}

function eliminarInspeccionMemoria(id) {
    state.inspecciones = state.inspecciones.filter(item => item.id !== id);
}

function ordenarInspecciones() {

    state.inspecciones.sort((a, b) =>
        new Date(b.fechaActualizacion || b.fechaCreacion) -
        new Date(a.fechaActualizacion || a.fechaCreacion)
    );

}

export function totalInspecciones() {
    return state.inspecciones.length;
}

export function inspeccionesOrdenadas() {
    return [...state.inspecciones];
}

export function buscarInspecciones(texto) {

    texto = texto.toLowerCase();

    return state.inspecciones.filter(inspeccion =>
        JSON.stringify(inspeccion.formulario).toLowerCase().includes(texto)
    );

}

export function ultimaInspeccion() {
    return state.inspecciones[0] ?? null;
}

function construirCache() {

    state.cache.inspecciones.clear();

    state.inspecciones.forEach(inspeccion => {
        state.cache.inspecciones.set(inspeccion.id, inspeccion);
    });

}

function refrescarListado() {
    ordenarInspecciones();
    construirCache();
    renderizarListado();
}

function renderizarListado() {
    document.dispatchEvent(
        new CustomEvent("inspection:list", { detail: state.inspecciones })
    );
}

export function reiniciarEstado() {
    state.hayCambios = false;
    state.autosaveTimer = null;
}

/* ------------------------------------------------------------------------
   INDICADORES DE ACTIVIDAD
------------------------------------------------------------------------ */

function establecerEstadoCarga(valor) {

    state.estado.cargando = valor;
    document.body.classList.toggle("loading", valor);

    const contenedor = document.getElementById("inspectionCards");

    if (valor && contenedor) {
        contenedor.innerHTML = `
            <div class="photo-placeholder">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Cargando inspecciones...</span>
            </div>
        `;
    }

}

function establecerEstadoGuardando(valor) {

    state.estado.guardando = valor;
    document.body.classList.toggle("saving", valor);

    // El toggle de clase por sí solo no bastaba: no había ningún CSS
    // enganchado a "body.saving", así que el botón se veía igual todo
    // el tiempo y el usuario no tenía forma de saber si el guardado
    // seguía en curso. Deshabilitar el botón y cambiar su texto es la
    // señal explícita.
    if (UI.btnGuardar) {
        UI.btnGuardar.disabled = valor;
        UI.btnGuardar.innerHTML = valor
            ? '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'
            : '<i class="fa-solid fa-floppy-disk"></i> Guardar Inspección';
    }

}

function establecerEstadoSincronizacion(valor) {

    state.estado.sincronizando = valor;
    document.body.classList.toggle("syncing", valor);

    if (!valor) state.ultimaSincronizacion = new Date();

    actualizarEstadoSincronizacion();

}

function actualizarEstadoSincronizacion() {

    const span = document.getElementById("syncStatus");
    if (!span) return;

    if (state.estado.sincronizando) {
        span.textContent = "Sincronizando...";
        return;
    }

    if (!state.ultimaSincronizacion) {
        span.textContent = "";
        return;
    }

    span.textContent =
        "Última sincronización: " +
        state.ultimaSincronizacion.toLocaleTimeString();

}

/* ------------------------------------------------------------------------
   PERSISTENCIA REMOTA (FIREBASE)
------------------------------------------------------------------------ */

export async function guardarInspeccion() {

    if (!validarFormularioCompleto()) {
        irAlPrimerCampoInvalido();
        return false;
    }

    establecerEstadoGuardando(true);

    try {

        await guardarAhora();

        // Antes de construir el snapshot que se guarda en Firestore, se
        // suben las fotos nuevas a Firebase Storage y se borran las que
        // el usuario quitó. Así el documento de Firestore solo guarda
        // URLs de fotos (unos pocos bytes cada una) en vez de las fotos
        // completas en base64 (que podían pesar varios MB cada una y
        // eran las que hacían lentísimo tanto guardar como listar).
        const consecutivo = obtenerConsecutivoActual();
        await subirFotosPendientes(consecutivo);
        await eliminarFotosPendientes(consecutivo);

        const inspeccion = obtenerInspeccionActual();

        await guardarInspeccionRemota(inspeccion);

        actualizarInspeccionMemoria(inspeccion);
        ordenarInspecciones();
        eliminarBorrador();

        state.editando = true;
        state.inspeccionId = inspeccion.id;
        state.seleccionada = inspeccion;

        document.dispatchEvent(
            new CustomEvent("inspection:saved", { detail: inspeccion })
        );

        return true;

    } finally {
        establecerEstadoGuardando(false);
    }

}

/**
 * validarFormularioCompleto() revisa TODOS los pasos del wizard, no solo
 * el que se está viendo. Si el campo obligatorio que falta está en un
 * paso anterior (oculto con "hidden" mientras no es el activo), el
 * usuario nunca veía el error: el botón "Guardar" parecía no hacer
 * nada. Esta función lleva al wizard al paso correcto y enfoca el
 * campo con el problema.
 */
function irAlPrimerCampoInvalido() {

    const campo = UI.form?.querySelector(".is-invalid");
    if (!campo) return;

    const paso = campo.closest(".form-step");
    const indice = paso ? UI.pasos.indexOf(paso) : -1;

    if (indice !== -1 && indice !== state.pasoActual) {
        mostrarPaso(indice);
    }

    requestAnimationFrame(() => {
        campo.focus({ preventScroll: true });
        campo.scrollIntoView({ behavior: "smooth", block: "center" });
    });

}

async function guardarInspeccionRemota(inspeccion) {

    // Si ya era una inspección existente (se estaba editando), solo se
    // actualiza (no se toca su fecha de creación). Si es la primera vez
    // que se guarda, se crea el documento completo en Firestore.
    if (state.editando) {
        await actualizarInspeccionFirestore(inspeccion.id, inspeccion);
    } else {
        await guardarInspeccionFirestore(inspeccion.id, inspeccion);
    }

    // Copia local de respaldo: si el dispositivo pierde conexión más
    // adelante, el listado sigue disponible gracias a la caché de
    // Firestore, pero mantenemos también esta copia como respaldo extra.
    guardarListaLocal(actualizarEnListaLocal(leerListaLocal(), inspeccion));

}

function actualizarEnListaLocal(lista, inspeccion) {

    const indice = lista.findIndex(item => item.id === inspeccion.id);

    if (indice === -1) {
        lista.push(inspeccion);
    } else {
        lista[indice] = inspeccion;
    }

    return lista;

}

function leerListaLocal() {

    try {
        const texto = localStorage.getItem(APP.STORAGE_KEY_LISTA);
        return texto ? JSON.parse(texto) : [];
    } catch (error) {
        console.error("No se pudo leer el listado local de inspecciones", error);
        return [];
    }

}

function guardarListaLocal(lista) {

    try {
        localStorage.setItem(APP.STORAGE_KEY_LISTA, JSON.stringify(lista));
    } catch (error) {
        console.error("No se pudo guardar el listado local de inspecciones", error);
    }

}

export async function cargarInspecciones() {

    establecerEstadoCarga(true);

    try {

        const datos = await obtenerInspeccionesRemotas();

        state.inspecciones = datos;

        ordenarInspecciones();
        construirCache();
        renderizarListado();

    } finally {
        establecerEstadoCarga(false);
    }

}

async function obtenerInspeccionesRemotas() {

    try {

        const datos = await listarInspeccionesFirestore();

        // Se guarda una copia local por si más adelante se abre la app
        // sin conexión y todavía no hay caché de Firestore disponible.
        guardarListaLocal(datos);

        return datos;

    } catch (error) {

        // Antes esto fallaba en silencio y mostraba solo la copia local
        // de ESTE dispositivo (localStorage), lo que parecía "no veo las
        // inspecciones de otros dispositivos". Ahora se avisa
        // explícitamente para que quede claro que es un problema de
        // conexión/permmisos y no que faltan datos.
        console.error("No se pudo listar desde Firestore, usando copia local de este dispositivo", error);
        mostrarToast("No se pudo conectar con el servidor: mostrando solo lo guardado en este dispositivo", "error");
        return leerListaLocal();

    }

}

export async function eliminarInspeccion(id) {

    if (!id) return;
    if (!confirmar("¿Eliminar inspección?")) return;

    establecerEstadoSincronizacion(true);

    try {

        await eliminarInspeccionRemota(id);

        eliminarInspeccionMemoria(id);
        construirCache();
        renderizarListado();

        document.dispatchEvent(
            new CustomEvent("inspection:deleted", { detail: id })
        );

    } finally {
        establecerEstadoSincronizacion(false);
    }

}

async function eliminarInspeccionRemota(id) {

    await eliminarInspeccionFirestore(id);

    guardarListaLocal(leerListaLocal().filter(item => item.id !== id));

}

export async function actualizarInspeccion() {
    return guardarInspeccion();
}

document.addEventListener("inspection:saved", e => {
    if (APP.DEBUG) console.log("Guardada", e.detail.id);
});

document.addEventListener("inspection:saved", () => {
    refrescarListado();
});

document.addEventListener("inspection:deleted", e => {
    if (APP.DEBUG) console.log("Eliminada", e.detail);
});
