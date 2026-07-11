/* ========================================================================
   CAMPOS.JS
   Sistema de Inspecciones — Lectura genérica de campos de formulario
======================================================================== */

export function obtenerValorCampo(campo) {

    if (!campo) return null;

    switch (campo.type) {

        case "checkbox":
            return campo.checked;

        case "radio": {
            const seleccionado = document.querySelector(
                `[name="${campo.name}"]:checked`
            );
            return seleccionado ? seleccionado.value : null;
        }

        case "number":
            return campo.value === "" ? null : Number(campo.value);

        default:
            return campo.value;

    }

}

export function obtenerCamposValidables(contenedor) {

    return [...contenedor.querySelectorAll("input, select, textarea")]
        .filter(campo => !campo.disabled && campo.type !== "hidden");

}
