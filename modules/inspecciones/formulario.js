/* ========================================================================
   FORMULARIO.JS
   Sistema de Inspecciones — Datos del formulario principal
======================================================================== */

import { UI } from "./dom.js";
import { state, APP } from "./estado.js";
import { obtenerValorCampo } from "./campos.js";
import { validarCampo } from "./validaciones.js";
import { mostrarPaso } from "./navegacion.js";
import { limpiarFotos } from "./fotos.js";
import { limpiarTodasLasFirmas } from "./firmas.js";
import { eliminarBorrador, actualizarEstadoGuardado, programarAutoGuardado } from "./autoguardado.js";

export function inicializarFormulario() {
    mostrarPaso(0);
    registrarEventosFormulario();
}

export function establecerFechaHora() {

    const fecha = document.getElementById("fecha");
    const hora = document.getElementById("hora");

    if (!fecha || !hora) return;

    const ahora = new Date();

    if (!fecha.value) {
        fecha.value = ahora.toISOString().split("T")[0];
    }

    if (!hora.value) {
        hora.value = ahora.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

}

function registrarEventosFormulario() {

    if (!state.form) return;

    state.form.addEventListener("input", manejarCambioFormulario);
    state.form.addEventListener("change", manejarCambioFormulario);

}

function manejarCambioFormulario(e) {

    const campo = e.target;
    if (!campo.name) return;

    validarCampo(campo);
    programarAutoGuardado();

    document.dispatchEvent(
        new CustomEvent("fieldChanged", {
            detail: {
                campo: campo.name,
                valor: obtenerValorCampo(campo)
            }
        })
    );

}

document.addEventListener("fieldChanged", e => {
    if (APP.DEBUG) console.log("Campo actualizado", e.detail);
});

document.addEventListener("fieldChanged", () => {
    state.hayCambios = true;
});

export function obtenerDatosFormulario() {

    const datos = {};
    if (!state.form) return datos;

    for (const campo of state.form.elements) {
        if (!campo.name) continue;
        datos[campo.name] = obtenerValorCampo(campo);
    }

    return datos;

}

export function cargarFormulario(datos = {}) {

    if (!state.form) return;

    Object.entries(datos).forEach(([nombre, valor]) => {

        const campos = state.form.querySelectorAll(`[name="${nombre}"]`);
        if (!campos.length) return;

        campos.forEach(campo => {
            switch (campo.type) {
                case "checkbox":
                    campo.checked = Boolean(valor);
                    break;
                case "radio":
                    campo.checked = campo.value == valor;
                    break;
                default:
                    campo.value = valor ?? "";
            }
        });

    });

}

export function limpiarFormulario() {

    if (!state.form) return;

    state.form.reset();

    limpiarFotos();
    limpiarTodasLasFirmas();

    state.editando = false;
    state.inspeccionId = null;

    mostrarPaso(0);
    eliminarBorrador();
    actualizarEstadoGuardado();
    establecerFechaHora();

}

export function serializarFormulario() {
    return JSON.stringify(obtenerDatosFormulario());
}

export function clonarFormulario() {
    return structuredClone(obtenerDatosFormulario());
}
