/* ========================================================================
   NAVEGACION.JS
   Sistema de Inspecciones — Wizard, progreso y menú lateral
======================================================================== */

import { UI } from "./dom.js";
import { state, APP } from "./estado.js";
import { validarPasoActual } from "./validaciones.js";

/* ------------------------------------------------------------------------
   NAVEGACIÓN DEL WIZARD
------------------------------------------------------------------------ */

export function mostrarPaso(indice) {

    if (!UI.pasos.length) return;

    if (indice < 0) indice = 0;
    if (indice >= state.totalPasos) indice = state.totalPasos - 1;

    state.pasoActual = indice;

    UI.pasos.forEach((paso, i) => {
        paso.classList.toggle("active", i === indice);
        paso.hidden = i !== indice;
    });

    actualizarBotones();
    actualizarProgreso();
    actualizarMenu();

    window.scrollTo({ top: 0, behavior: "smooth" });

    document.dispatchEvent(
        new CustomEvent("stepChanged", { detail: obtenerPasoActual() })
    );

}

export function siguientePaso() {

    if (!validarPasoActual()) return;
    if (state.pasoActual >= state.totalPasos - 1) return;

    mostrarPaso(state.pasoActual + 1);

}

export function pasoAnterior() {

    if (state.pasoActual <= 0) return;
    mostrarPaso(state.pasoActual - 1);

}

export function irAPaso(indice) {

    if (indice === state.pasoActual) return;

    mostrarPaso(indice);
    cerrarSidebarResponsive();

}

function actualizarBotones() {

    if (UI.btnAnterior) {
        UI.btnAnterior.disabled = state.pasoActual === 0;
    }

    if (UI.btnSiguiente) {
        UI.btnSiguiente.style.display =
            state.pasoActual === state.totalPasos - 1 ? "none" : "";
    }

    if (UI.btnGuardar) {
        UI.btnGuardar.style.display =
            state.pasoActual === state.totalPasos - 1 ? "" : "none";
    }

}

document.addEventListener("keydown", e => {

    if (e.target.matches("input, textarea, select")) return;

    switch (e.key) {
        case "ArrowRight":
            siguientePaso();
            break;
        case "ArrowLeft":
            pasoAnterior();
            break;
    }

});

document.addEventListener("stepChanged", e => {
    if (APP.DEBUG) console.log("Paso cambiado:", e.detail);
});

/* ------------------------------------------------------------------------
   PROGRESO
------------------------------------------------------------------------ */

export function inicializarProgreso() {

    actualizarProgreso();

    document.addEventListener("input", actualizarProgreso);

    document.addEventListener("change", actualizarProgreso);

}

export function actualizarProgreso() {

    const porcentaje = obtenerPorcentajeProgreso();

    console.log("Progreso:", porcentaje);

    actualizarBarraProgreso(porcentaje);
    actualizarTextoProgreso();
    actualizarIndicadores();

}

function actualizarBarraProgreso(porcentaje) {

    if (!UI.progressBar) return;

    UI.progressBar.style.transition = "width .35s ease";

    UI.progressBar.style.width = porcentaje + "%";

    UI.progressBar.setAttribute("aria-valuenow", porcentaje);

}
function actualizarTextoProgreso() {

    if (!UI.progressText) return;

    const paso = UI.pasos[state.pasoActual];
    let titulo = "";

    const heading = paso.querySelector(
        "h1,h2,h3,h4,.step-title,.section-title"
    );

    if (heading) titulo = heading.textContent.trim();

    const porcentaje = obtenerPorcentajeProgreso();

   UI.progressText.textContent =
       `${porcentaje}% completado` +
       (titulo ? ` • ${titulo}` : "");

}

function actualizarIndicadores() {

    document.querySelectorAll("[data-step]").forEach(item => {

        const indice = Number(item.dataset.step);

        item.classList.remove("completed", "active", "pending");

        if (indice < state.pasoActual) {
            item.classList.add("completed");
        } else if (indice === state.pasoActual) {
            item.classList.add("active");
        } else {
            item.classList.add("pending");
        }

    });

}

export function obtenerPorcentajeProgreso() {

    if (!UI.form) return 0;

    const campos = UI.form.querySelectorAll(
        "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']), select, textarea"
    );

    let total = 0;
    let completos = 0;

    campos.forEach(campo => {

        // Ignorar campos ocultos por CSS
        if (campo.offsetParent === null) return;

        // Ignorar deshabilitados
        if (campo.disabled) return;

        total++;

        if (campo.type === "checkbox" || campo.type === "radio") {

            if (campo.checked) completos++;

        } else {

            if (campo.value.trim() !== "") completos++;

        }

    });

    return total ? Math.round((completos / total) * 100) : 0;

}

export function obtenerPasoActual() {

    return {
        indice: state.pasoActual,
        numero: state.pasoActual + 1,
        total: state.totalPasos,
        porcentaje: obtenerPorcentajeProgreso()
    };

}

/* ------------------------------------------------------------------------
   MENÚ LATERAL
------------------------------------------------------------------------ */

export function inicializarMenu() {
    configurarEventosMenu();
    actualizarMenu();
}

function configurarEventosMenu() {

    document.querySelectorAll("[data-step]").forEach(item => {

        item.addEventListener("click", e => {
            e.preventDefault();
            const indice = Number(item.dataset.step);
            irAPaso(indice);
            cerrarSidebar();
        });

    });

    const btnMenu = document.getElementById("menuToggle");
    if (btnMenu) btnMenu.addEventListener("click", alternarSidebar);

    if (UI.overlay) UI.overlay.addEventListener("click", cerrarSidebar);

}

export function actualizarMenu() {

    document.querySelectorAll("[data-step]").forEach(item => {

        const indice = Number(item.dataset.step);

        item.classList.remove("active", "completed");

        if (indice < state.pasoActual) {
            item.classList.add("completed");
        }

        if (indice === state.pasoActual) {
            item.classList.add("active");
            item.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }

    });

}

export function abrirSidebar() {

    if (!UI.sidebar) return;

    UI.sidebar.classList.add("open");
    UI.overlay?.classList.add("show");
    document.body.classList.add("sidebar-open");

}

export function cerrarSidebar() {

    if (!UI.sidebar) return;

    UI.sidebar.classList.remove("open");
    UI.overlay?.classList.remove("show");
    document.body.classList.remove("sidebar-open");

}

export function alternarSidebar() {

    if (!UI.sidebar) return;

    UI.sidebar.classList.contains("open") ? cerrarSidebar() : abrirSidebar();

}

function cerrarSidebarResponsive() {
    if (window.innerWidth < 992) cerrarSidebar();
}

export function obtenerItemActivoMenu() {
    return document.querySelector("[data-step].active");
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") cerrarSidebar();
});

window.addEventListener("resize", () => {
    if (window.innerWidth >= 992) UI.overlay?.classList.remove("show");
});
