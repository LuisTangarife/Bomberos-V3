/* ========================================================================
   DOM.JS
   Módulo Censos — Referencias del DOM
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
    tituloFormulario: null,

    // Núcleo familiar (tabla dinámica)
    tablaIntegrantes: null,
    btnAgregarIntegrante: null,

    // Mascotas (tabla dinámica)
    tablaMascotas: null,
    btnAgregarMascota: null,

    // Bloque "propietario" (solo si el jefe es inquilino/otro)
    bloquePropietario: null

};

export function inicializarDOM() {

    UI.vistaListado = document.getElementById("vistaListado");
    UI.vistaFormulario = document.getElementById("vistaFormulario");
    UI.listadoContainer = document.getElementById("censosCards");
    UI.buscador = document.getElementById("buscarCenso");
    UI.avisoInvitado = document.getElementById("avisoInvitadoCensos");

    UI.form = document.getElementById("formCenso");
    UI.btnNuevo = document.getElementById("btnNuevoCenso");
    UI.btnGuardar = document.getElementById("btnGuardarCenso");
    UI.btnVolver = document.getElementById("btnVolverListadoCensos");
    UI.tituloFormulario = document.getElementById("tituloFormularioCenso");

    UI.tablaIntegrantes = document.getElementById("tablaIntegrantesBody");
    UI.btnAgregarIntegrante = document.getElementById("btnAgregarIntegrante");

    UI.tablaMascotas = document.getElementById("tablaMascotasBody");
    UI.btnAgregarMascota = document.getElementById("btnAgregarMascota");

    UI.bloquePropietario = document.getElementById("bloquePropietario");

}
