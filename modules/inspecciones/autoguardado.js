/* ========================================================================
   AUTOGUARDADO.JS
   Sistema de Inspecciones — Borrador local (localStorage)
======================================================================== */

import { state, APP } from "./estado.js";
import { serializarFormulario, obtenerDatosFormulario, cargarFormulario } from "./formulario.js";
import { renderizarFotos, actualizarContadorFotos } from "./fotos.js";
import { restaurarFirma } from "./firmas.js";

export function iniciarAutoGuardado() {
    restaurarBorrador();
}

export function programarAutoGuardado() {

    state.hayCambios = true;
    clearTimeout(state.autosaveTimer);

    state.autosaveTimer = setTimeout(guardarBorrador, APP.AUTOSAVE_DELAY);

}

export async function guardarBorrador() {

    if (!state.form) return;

    const serializado = serializarFormulario();
    if (serializado === state.ultimaSerializacion) return;

    state.estado.guardando = true;

    const datos = {
        fecha: Date.now(),
        formulario: obtenerDatosFormulario(),
        fotos: state.fotos,
        firmas: state.firmas
    };

    localStorage.setItem(APP.STORAGE_KEY, JSON.stringify(datos));

    state.estado.guardando = false;
    state.hayCambios = false;
    state.ultimoGuardado = new Date();
    state.ultimaSerializacion = serializado;

    actualizarEstadoGuardado();

}

export function restaurarBorrador() {

    const texto = localStorage.getItem(APP.STORAGE_KEY);
    if (!texto) return;

    try {

        const datos = JSON.parse(texto);

        if (datos.formulario) cargarFormulario(datos.formulario);

        if (datos.fotos) state.fotos = datos.fotos;

        if (datos.firmas) {
            state.firmas = datos.firmas;
            requestAnimationFrame(() => {
                restaurarFirma("inspector");
                restaurarFirma("propietario");
            });
        }

        state.ultimaSerializacion = serializarFormulario();
        actualizarEstadoGuardado();

        renderizarFotos();
        actualizarContadorFotos();

    } catch (error) {
        console.error(error);
    }

}

export function eliminarBorrador() {

    localStorage.removeItem(APP.STORAGE_KEY);
    state.ultimaSerializacion = "";
    state.hayCambios = false;

}

export function actualizarEstadoGuardado() {

    const estado = document.getElementById("autosaveStatus");
    if (!estado) return;

    if (state.estado.guardando) {
        estado.textContent = "Guardando...";
        return;
    }

    if (!state.ultimoGuardado) {
        estado.textContent = "";
        return;
    }

    estado.textContent = "Guardado " + state.ultimoGuardado.toLocaleTimeString();

}

export async function guardarAhora() {

    clearTimeout(state.autosaveTimer);
    await guardarBorrador();

}

export function existeBorrador() {
    return localStorage.getItem(APP.STORAGE_KEY) !== null;
}

export function obtenerFechaBorrador() {

    const texto = localStorage.getItem(APP.STORAGE_KEY);
    if (!texto) return null;

    try {
        return new Date(JSON.parse(texto).fecha);
    } catch {
        return null;
    }

}

window.addEventListener("beforeunload", e => {

    if (!state.hayCambios) return;

    guardarAhora();
    e.preventDefault();
    e.returnValue = "";

});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.hayCambios) guardarAhora();
});
