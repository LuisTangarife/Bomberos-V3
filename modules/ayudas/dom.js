/* ========================================================================
   DOM.JS
   Módulo Ayudas Humanitarias — Referencias del DOM
======================================================================== */

export const UI = {

    vistaListado: null,
    vistaFormulario: null,
    listadoContainer: null,
    buscador: null,
    avisoInvitado: null,

    form: null,
    btnNuevo: null,
    btnGuardar: null,
    btnVolver: null,
    tituloFormulario: null

};

export function inicializarDOM() {

    UI.vistaListado = document.getElementById("vistaListado");
    UI.vistaFormulario = document.getElementById("vistaFormulario");
    UI.listadoContainer = document.getElementById("ayudasCards");
    UI.buscador = document.getElementById("buscarAyuda");
    UI.avisoInvitado = document.getElementById("avisoInvitadoAyudas");

    UI.form = document.getElementById("formAyuda");
    UI.btnNuevo = document.getElementById("btnNuevaAyuda");
    UI.btnGuardar = document.getElementById("btnGuardarAyuda");
    UI.btnVolver = document.getElementById("btnVolverListadoAyudas");
    UI.tituloFormulario = document.getElementById("tituloFormularioAyuda");

}
