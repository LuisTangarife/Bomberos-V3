/* ========================================================================
   APP.JS
   Sistema de Inspecciones
   Cuerpo Oficial de Bomberos

   Punto de entrada. La lógica está dividida en módulos por
   responsabilidad; este archivo únicamente inicializa y conecta
   las piezas al cargar la página.

   Módulos:

   - estado.js         Configuración (APP) y estado global (state)
   - dom.js            Referencias del DOM (UI)
   - campos.js         Lectura genérica de campos de formulario
   - validaciones.js   Validación de campos y pasos
   - navegacion.js     Wizard, progreso y menú lateral
   - formulario.js      Datos del formulario, carga y limpieza
   - autoguardado.js   Borrador local (localStorage)
   - fotos.js          Fotografías
   - firmas.js         Firmas digitales (canvas)
   - persistencia.js   CRUD y sincronización con Firebase
   - utilidades.js     Utilidades varias de interfaz
======================================================================== */

import { APP, state } from "./estado.js";
import { UI, inicializarDOM } from "./dom.js";
import { protegerPagina } from "../../shared/auth.js";

import { siguientePaso, pasoAnterior, inicializarMenu, inicializarProgreso } from "./navegacion.js";
import { inicializarFormulario, establecerFechaHora } from "./formulario.js";
import { inicializarFirmas, redimensionarCanvasFirmas } from "./firmas.js";
import { inicializarFotos } from "./fotos.js";
import { iniciarAutoGuardado } from "./autoguardado.js";
import { inicializarScrollTop, mostrarToast } from "./utilidades.js";
import { inicializarListado } from "./listado.js";
import { generarPDF } from "./pdf.js";

import {
    nuevaInspeccion,
    guardarInspeccion,
    cerrarInspeccion,
    cargarInspecciones,
    obtenerInspeccionActual
} from "./persistencia.js";

/* ========================================================================
   INICIO
======================================================================== */

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

async function iniciarAplicacion() {

    const usuario = await protegerPagina();
    state.usuario = usuario.email || usuario.uid;

    console.log(
        `%cSistema de Inspecciones v${APP.VERSION}`,
        "color:#ff6b00;font-weight:bold;font-size:13px;"
    );

    if (typeof renderSidebar === "function") renderSidebar("inspecciones");
    if (typeof renderHeader === "function") renderHeader("Inspecciones");

    inicializarDOM();
    inicializarEventos();
    inicializarFormulario();

    establecerFechaHora();

    inicializarMenu();
    inicializarProgreso();
    inicializarFirmas();
    inicializarFotos();

    iniciarAutoGuardado();
    await cargarInspecciones();

    inicializarListado();
    inicializarScrollTop();

}

/* ========================================================================
   EVENTOS PRINCIPALES
======================================================================== */

function inicializarEventos() {

    if (UI.btnSiguiente) UI.btnSiguiente.addEventListener("click", siguientePaso);
    if (UI.btnAnterior) UI.btnAnterior.addEventListener("click", pasoAnterior);

    if (UI.btnNuevo) {
        UI.btnNuevo.addEventListener("click", () => {
            nuevaInspeccion();
            mostrarVistaFormulario();
        });
    }

    if (UI.btnCancelar) {
        UI.btnCancelar.addEventListener("click", () => {
            cerrarInspeccion();
            mostrarVistaListado();
        });
    }

    if (UI.btnVolver) {
        UI.btnVolver.addEventListener("click", () => {
            cerrarInspeccion();
            mostrarVistaListado();
        });
    }

    if (UI.btnPDF) UI.btnPDF.addEventListener("click", generarPDFInspeccion);

    if (UI.form) {
        UI.form.addEventListener("submit", async e => {
            e.preventDefault();

            const guardada = await guardarInspeccion();

            if (guardada) {
                mostrarToast("Inspección guardada correctamente");
                mostrarVistaListado();
            } else {
                mostrarToast("Revisa los campos obligatorios antes de guardar", "error");
            }
        });
    }

    // Cuando se abre una inspección existente desde el listado (listado.js),
    // cambiar a la vista de formulario.
    document.addEventListener("inspection:opened", mostrarVistaFormulario);

}

/* ========================================================================
   CAMBIO ENTRE VISTA DE LISTADO Y VISTA DE FORMULARIO
======================================================================== */

function mostrarVistaFormulario() {

    if (UI.dashboard) UI.dashboard.hidden = true;

    if (UI.vistaListado) UI.vistaListado.classList.remove("activa");
    if (UI.vistaFormulario) UI.vistaFormulario.classList.add("activa");

    if (UI.wizard) UI.wizard.style.display = "";

    // El canvas de firmas se inicializa con el DOM aún oculto (display:none),
    // por lo que su área de dibujo queda en 0x0. Una vez que esta vista es
    // visible y el navegador recalculó el layout, volvemos a ajustar el
    // tamaño real de los canvas para que las firmas funcionen.
    requestAnimationFrame(redimensionarCanvasFirmas);

    window.scrollTo({ top: 0, behavior: "smooth" });

}

function mostrarVistaListado() {

    if (UI.dashboard) UI.dashboard.hidden = false;

    if (UI.vistaFormulario) UI.vistaFormulario.classList.remove("activa");
    if (UI.vistaListado) UI.vistaListado.classList.add("activa");

    if (UI.wizard) UI.wizard.style.display = "none";

    window.scrollTo({ top: 0, behavior: "smooth" });

}

async function generarPDFInspeccion() {

    await generarPDF(obtenerInspeccionActual());

}
