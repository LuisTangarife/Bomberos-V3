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
import { confirmar } from "./utilidades.js";

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
        fotos: structuredClone(state.fotos),
        firmas: structuredClone(state.firmas)
    };

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
}

function establecerEstadoGuardando(valor) {
    state.estado.guardando = valor;
    document.body.classList.toggle("saving", valor);
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

    /*
        NOTA: Firebase aún no está configurado (firebase/config.js tiene
        llaves vacías), así que por ahora esto persiste localmente en
        localStorage. Cuando tengas tu proyecto de Firebase listo, este
        es el lugar para reemplazarlo por, por ejemplo:

        import { guardarInspeccion as guardarEnFirestore } from "./firebase.js";
        await guardarEnFirestore(inspeccion.id, inspeccion);
    */

    const lista = leerListaLocal();
    const indice = lista.findIndex(item => item.id === inspeccion.id);

    if (indice === -1) {
        lista.push(inspeccion);
    } else {
        lista[indice] = inspeccion;
    }

    guardarListaLocal(lista);

    return Promise.resolve(inspeccion);

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

    /*
        NOTA: mientras Firebase no esté configurado, el listado se lee
        de localStorage. Cuando tengas tu proyecto de Firebase listo:

        import { listarInspecciones } from "./firebase.js";
        return await listarInspecciones();
    */

    return leerListaLocal();

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

    /*
        NOTA: mientras Firebase no esté configurado, la eliminación se
        hace en localStorage. Cuando tengas tu proyecto de Firebase listo:

        import { eliminarInspeccion as eliminarEnFirestore } from "./firebase.js";
        await eliminarEnFirestore(id);
    */

    guardarListaLocal(leerListaLocal().filter(item => item.id !== id));

    return Promise.resolve();

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
