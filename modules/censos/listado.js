/* ========================================================================
   LISTADO.JS
   Módulo Censos — Tarjetas del listado (vista principal)
======================================================================== */

import { state } from "./estado.js";
import { UI } from "./dom.js";
import { cargarFormularioCenso, nuevoFormularioCenso } from "./app.js";
import { eliminarCenso } from "./persistencia.js";
import { generarPDFCenso } from "./pdf.js";

function escapar(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

export function renderizarListado() {

    if (!UI.listadoContainer) return;

    if (state.estado.cargando) {
        UI.listadoContainer.innerHTML = `<p class="censo-vacio">Cargando censos...</p>`;
        return;
    }

    const censos = state.censos;

    if (!censos.length) {
        UI.listadoContainer.innerHTML = `
            <p class="censo-vacio">
                Aún no hay censos registrados${state.invitado ? " en este dispositivo" : ""}.
            </p>
        `;
        return;
    }

    UI.listadoContainer.innerHTML = censos.map(censo => {

        const nucleo = censo.integrantes?.length ?? 0;
        const jefe = censo.jefeNombre || "Sin nombre";
        const barrio = censo.barrioVereda || censo.municipio || "Sin ubicación";
        const evacuar = censo.recomendacionEvacuacion === "SI";

        return `
            <article class="censo-card" data-id="${escapar(censo.id)}">

                <div class="censo-card-top">
                    <span class="censo-codigo">${escapar(censo.id)}</span>
                    ${evacuar ? '<span class="censo-badge alerta"><i class="fa-solid fa-triangle-exclamation"></i> Evacuar</span>' : ""}
                    ${censo.pending ? '<span class="censo-badge pendiente">Pendiente sync</span>' : ""}
                </div>

                <h3>${escapar(jefe)}</h3>
                <p class="censo-sub"><i class="fa-solid fa-location-dot"></i> ${escapar(barrio)}</p>
                <p class="censo-sub"><i class="fa-solid fa-people-roof"></i> ${nucleo} integrante(s)</p>

                <div class="censo-card-actions">
                    <button type="button" class="btn-editar-censo" data-id="${escapar(censo.id)}">
                        <i class="fa-solid fa-pen"></i> Ver / Editar
                    </button>
                    <button type="button" class="btn-pdf-censo" data-id="${escapar(censo.id)}">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </button>
                    <button type="button" class="btn-borrar-censo" data-id="${escapar(censo.id)}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

            </article>
        `;

    }).join("");

    UI.listadoContainer.querySelectorAll(".btn-editar-censo").forEach(btn => {
        btn.addEventListener("click", () => cargarFormularioCenso(btn.dataset.id));
    });

    UI.listadoContainer.querySelectorAll(".btn-pdf-censo").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const censo = state.censos.find(c => c.id === btn.dataset.id);
            generarPDFCenso(censo);
        });
    });

    UI.listadoContainer.querySelectorAll(".btn-borrar-censo").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar este censo? Esta acción no se puede deshacer.")) return;
            await eliminarCenso(btn.dataset.id);
        });
    });

}

export function filtrarListado(texto) {

    const t = (texto || "").trim().toLowerCase();

    if (!t) return renderizarListado();

    const filtrados = state.censos.filter(c =>
        (c.jefeNombre || "").toLowerCase().includes(t) ||
        (c.jefeCedula || "").toLowerCase().includes(t) ||
        (c.barrioVereda || "").toLowerCase().includes(t) ||
        (c.municipio || "").toLowerCase().includes(t) ||
        (c.id || "").toLowerCase().includes(t)
    );

    const original = state.censos;
    state.censos = filtrados;
    renderizarListado();
    state.censos = original;

}
