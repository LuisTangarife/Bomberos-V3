/* ========================================================================
   LISTADO.JS — Módulo APH
======================================================================== */

import { state } from "./estado.js";

function escapar(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

/* =========================================================
   LISTADO — ATENCIONES
========================================================= */

export function renderizarListadoAtenciones(lista = state.atenciones) {

    const contenedor = document.getElementById("atencionesCards");
    if (!contenedor) return;

    if (!lista.length) {
        contenedor.innerHTML = `<p class="aph-vacio">Aún no hay atenciones registradas${state.invitado ? " en este dispositivo" : ""}.</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(a => {

        const prioridadClase = { R: "roja", A: "amarilla", V: "verde", N: "negra" }[a.prioridad] || "";

        return `
            <article class="aph-card" data-id="${escapar(a.id)}">

                <div class="aph-card-top">
                    <span class="aph-codigo">${escapar(a.id)}</span>
                    ${a.prioridad ? `<span class="aph-prioridad aph-prioridad-${prioridadClase}">${escapar(a.prioridad)}</span>` : ""}
                    ${a.pending ? '<span class="aph-badge-pendiente">Pendiente sync</span>' : ""}
                </div>

                <h3>${escapar(a.pacienteNombre || "Sin nombre")}</h3>
                <p class="aph-sub"><i class="fa-solid fa-id-card"></i> ${escapar(a.pacienteTipoDoc || "")} ${escapar(a.pacienteDocumento || "—")}</p>
                <p class="aph-sub"><i class="fa-solid fa-truck-medical"></i> ${escapar(a.movilNumero || "Sin móvil")} — ${escapar(a.fechaServicio || "sin fecha")}</p>
                ${a.lesiones?.length ? `<p class="aph-sub"><i class="fa-solid fa-notes-medical"></i> ${a.lesiones.length} lesión(es) marcada(s)</p>` : ""}

                <div class="aph-card-actions">
                    <button type="button" class="btn-editar-aph" data-id="${escapar(a.id)}">
                        <i class="fa-solid fa-pen"></i> Ver / Editar
                    </button>
                    <button type="button" class="btn-pdf-aph" data-id="${escapar(a.id)}">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </button>
                    <button type="button" class="btn-borrar-aph" data-id="${escapar(a.id)}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

            </article>
        `;

    }).join("");

}

export function filtrarListadoAtenciones(texto) {

    const buscado = texto.trim().toLowerCase();

    if (!buscado) {
        renderizarListadoAtenciones();
        return;
    }

    const filtradas = state.atenciones.filter(a =>
        [a.pacienteNombre, a.pacienteDocumento, a.id, a.movilNumero]
            .some(campo => (campo || "").toLowerCase().includes(buscado))
    );

    renderizarListadoAtenciones(filtradas);

}

/* =========================================================
   LISTADO — CONSENTIMIENTOS
========================================================= */

export function renderizarListadoConsentimientos(lista = state.consentimientos) {

    const contenedor = document.getElementById("consentimientosCards");
    if (!contenedor) return;

    if (!lista.length) {
        contenedor.innerHTML = `<p class="aph-vacio">Aún no hay consentimientos registrados${state.invitado ? " en este dispositivo" : ""}.</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(c => `
        <article class="aph-card" data-id="${escapar(c.id)}">

            <div class="aph-card-top">
                <span class="aph-codigo">${escapar(c.id)}</span>
                ${c.pending ? '<span class="aph-badge-pendiente">Pendiente sync</span>' : ""}
            </div>

            <h3>${escapar(c.firmante1Nombre || "Sin nombre")}</h3>
            <p class="aph-sub"><i class="fa-solid fa-id-card"></i> ${escapar(c.firmante1Tipo || "")} ${escapar(c.firmante1Documento || "—")}</p>
            <p class="aph-sub"><i class="fa-solid fa-calendar"></i> ${escapar(c.fecha || "sin fecha")}</p>

            <div class="aph-card-actions">
                <button type="button" class="btn-editar-aph" data-id="${escapar(c.id)}">
                    <i class="fa-solid fa-pen"></i> Ver / Editar
                </button>
                <button type="button" class="btn-pdf-aph" data-id="${escapar(c.id)}">
                    <i class="fa-solid fa-file-pdf"></i> PDF
                </button>
                <button type="button" class="btn-borrar-aph" data-id="${escapar(c.id)}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>

        </article>
    `).join("");

}

export function filtrarListadoConsentimientos(texto) {

    const buscado = texto.trim().toLowerCase();

    if (!buscado) {
        renderizarListadoConsentimientos();
        return;
    }

    const filtrados = state.consentimientos.filter(c =>
        [c.firmante1Nombre, c.firmante1Documento, c.id]
            .some(campo => (campo || "").toLowerCase().includes(buscado))
    );

    renderizarListadoConsentimientos(filtrados);

}
