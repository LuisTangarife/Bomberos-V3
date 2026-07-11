/* ========================================================================
   DOM.JS
   Sistema de Inspecciones — Referencias del DOM
======================================================================== */

import { state } from "./estado.js";

export const UI = {
    body: document.body,
    form: null,
    pasos: [],
    progressBar: null,
    progressText: null,
    btnAnterior: null,
    btnSiguiente: null,
    btnGuardar: null,
    btnPDF: null,
    btnNuevo: null,
    btnCancelar: null,
    btnVolver: null,
    menu: null,
    overlay: null,
    sidebar: null,
    fotosContainer: null,
    firmaInspector: null,
    firmaPropietario: null,
    dashboard: null,
    vistaListado: null,
    vistaFormulario: null,
    wizard: null
};

export function inicializarDOM() {

    UI.form = document.getElementById("inspectionForm");
    UI.pasos = [...document.querySelectorAll(".form-step")];

    UI.progressBar = document.querySelector(".progress-bar");
    UI.progressText = document.querySelector(".progress-text");

    UI.btnAnterior = document.getElementById("prevBtn");
    UI.btnSiguiente = document.getElementById("nextBtn");
    UI.btnGuardar = document.getElementById("saveBtn");
    UI.btnPDF = document.getElementById("btnPdf");
    UI.btnNuevo = document.getElementById("btnNuevaInspeccion");
    UI.btnCancelar = document.getElementById("cancelBtn");
    UI.btnVolver = document.getElementById("btnVolverListado");

    UI.menu = document.getElementById("stepMenu");
    UI.overlay = document.getElementById("overlay");
    UI.sidebar = document.getElementById("sidebar");

    UI.dashboard = document.getElementById("inspectionDashboard");
    UI.vistaListado = document.getElementById("vistaListado");
    UI.vistaFormulario = document.getElementById("vistaFormulario");
    UI.wizard = document.getElementById("inspectionWizard");

    UI.fotosContainer = document.getElementById("photoPreview");

    UI.firmaInspector = document.getElementById("firmaInspector");
    UI.firmaPropietario = document.getElementById("firmaPropietario");

    state.form = UI.form;
    state.totalPasos = UI.pasos.length;

}
