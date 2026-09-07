/* ========================================================================
   DOM.JS — Módulo APH — Referencias del DOM
======================================================================== */

export const UI = {

    // Pestañas (vista = "atencion" | "consentimiento")
    tabAtencion: null,
    tabConsentimiento: null,
    panelAtencion: null,
    panelConsentimiento: null,

    // ---- Vista Atención ----
    vistaListadoAtencion: null,
    vistaFormularioAtencion: null,
    listadoAtenciones: null,
    buscadorAtenciones: null,
    avisoInvitadoAtencion: null,

    formAtencion: null,
    btnNuevaAtencion: null,
    btnGuardarAtencion: null,
    btnVolverListadoAtencion: null,
    tituloFormularioAtencion: null,

    contenedorCuerpo3D: null,
    listaLesiones: null,

    bloqueRechazo: null,

    // ---- Vista Consentimiento ----
    vistaListadoConsentimiento: null,
    vistaFormularioConsentimiento: null,
    listadoConsentimientos: null,
    buscadorConsentimientos: null,
    avisoInvitadoConsentimiento: null,

    formConsentimiento: null,
    btnNuevoConsentimiento: null,
    btnGuardarConsentimiento: null,
    btnVolverListadoConsentimiento: null,
    tituloFormularioConsentimiento: null

};

export function inicializarDOM() {

    UI.tabAtencion = document.getElementById("tabAtencion");
    UI.tabConsentimiento = document.getElementById("tabConsentimiento");
    UI.panelAtencion = document.getElementById("panelAtencion");
    UI.panelConsentimiento = document.getElementById("panelConsentimiento");

    UI.vistaListadoAtencion = document.getElementById("vistaListadoAtencion");
    UI.vistaFormularioAtencion = document.getElementById("vistaFormularioAtencion");
    UI.listadoAtenciones = document.getElementById("atencionesCards");
    UI.buscadorAtenciones = document.getElementById("buscarAtencion");
    UI.avisoInvitadoAtencion = document.getElementById("avisoInvitadoAtencion");

    UI.formAtencion = document.getElementById("formAtencion");
    UI.btnNuevaAtencion = document.getElementById("btnNuevaAtencion");
    UI.btnGuardarAtencion = document.getElementById("btnGuardarAtencion");
    UI.btnVolverListadoAtencion = document.getElementById("btnVolverListadoAtencion");
    UI.tituloFormularioAtencion = document.getElementById("tituloFormularioAtencion");

    UI.contenedorCuerpo3D = document.getElementById("contenedorCuerpo3D");
    UI.listaLesiones = document.getElementById("listaLesiones");

    UI.bloqueRechazo = document.getElementById("bloqueRechazo");

    UI.vistaListadoConsentimiento = document.getElementById("vistaListadoConsentimiento");
    UI.vistaFormularioConsentimiento = document.getElementById("vistaFormularioConsentimiento");
    UI.listadoConsentimientos = document.getElementById("consentimientosCards");
    UI.buscadorConsentimientos = document.getElementById("buscarConsentimiento");
    UI.avisoInvitadoConsentimiento = document.getElementById("avisoInvitadoConsentimiento");

    UI.formConsentimiento = document.getElementById("formConsentimiento");
    UI.btnNuevoConsentimiento = document.getElementById("btnNuevoConsentimiento");
    UI.btnGuardarConsentimiento = document.getElementById("btnGuardarConsentimiento");
    UI.btnVolverListadoConsentimiento = document.getElementById("btnVolverListadoConsentimiento");
    UI.tituloFormularioConsentimiento = document.getElementById("tituloFormularioConsentimiento");

}
