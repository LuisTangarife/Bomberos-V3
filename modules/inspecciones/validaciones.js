/* ========================================================================
   VALIDACIONES.JS
   Sistema de Inspecciones — Validación de campos y pasos
======================================================================== */

import { UI } from "./dom.js";
import { state } from "./estado.js";
import { obtenerValorCampo, obtenerCamposValidables } from "./campos.js";

export function validarPasoActual() {

    const paso = UI.pasos[state.pasoActual];
    if (!paso) return true;

    limpiarErroresPaso(paso);

    const campos = obtenerCamposValidables(paso);
    let valido = true;

    campos.forEach(campo => {
        if (!validarCampo(campo)) valido = false;
    });

    if (!valido) enfocarPrimerError(paso);

    return valido;

}

export function validarCampo(campo) {

    limpiarErrorCampo(campo);

    if (campo.required) {

        const valor = obtenerValorCampo(campo);
        const vacio = valor === null || valor === "" || valor === false;

        if (vacio) {
            mostrarErrorCampo(campo, "Este campo es obligatorio.");
            return false;
        }

    }

    if (campo.type === "email" && campo.value.trim() !== "") {
        if (!campo.checkValidity()) {
            mostrarErrorCampo(campo, "Correo electrónico inválido.");
            return false;
        }
    }

    if (campo.pattern && campo.value.trim()) {
        if (!campo.checkValidity()) {
            mostrarErrorCampo(campo, "Formato inválido.");
            return false;
        }
    }

    return true;

}

export function mostrarErrorCampo(campo, mensaje) {

    campo.classList.add("is-invalid");

    let error = campo.parentNode.querySelector(".field-error");

    if (!error) {
        error = document.createElement("div");
        error.className = "field-error";
        campo.parentNode.appendChild(error);
    }

    error.textContent = mensaje;

}

export function limpiarErrorCampo(campo) {

    campo.classList.remove("is-invalid");

    const error = campo.parentNode.querySelector(".field-error");
    if (error) error.remove();

}

export function limpiarErroresPaso(paso) {

    paso.querySelectorAll(".is-invalid").forEach(campo => {
        campo.classList.remove("is-invalid");
    });

    paso.querySelectorAll(".field-error").forEach(error => {
        error.remove();
    });

}

export function enfocarPrimerError(paso) {

    const campo = paso.querySelector(".is-invalid");
    if (!campo) return;

    campo.focus({ preventScroll: true });
    campo.scrollIntoView({ behavior: "smooth", block: "center" });

}

export function validarFormularioCompleto() {

    let valido = true;

    UI.pasos.forEach(paso => {
        limpiarErroresPaso(paso);
        obtenerCamposValidables(paso).forEach(campo => {
            if (!validarCampo(campo)) valido = false;
        });
    });

    return valido;

}

export function formularioTieneErrores() {
    return state.form.querySelector(".is-invalid") !== null;
}

export function contarErroresFormulario() {
    return state.form.querySelectorAll(".is-invalid").length;
}

export function obtenerCamposObligatorios() {
    return [...state.form.querySelectorAll("[required]")];
}
