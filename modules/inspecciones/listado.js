/* ========================================================================
   LISTADO.JS
   Sistema de Inspecciones — Renderizado del listado de inspecciones
   (búsqueda, filtro por estado, y acciones ver/PDF/eliminar por tarjeta)
======================================================================== */

import { inspeccionesOrdenadas, abrirInspeccion, eliminarInspeccion } from "./persistencia.js";
import { generarPDF } from "./pdf.js";

const ESTADOS = {
    "Pendiente": { clase: "pendiente", icono: "fa-hourglass-half" },
    "En proceso": { clase: "en-proceso", icono: "fa-spinner" },
    "Finalizada": { clase: "finalizada", icono: "fa-circle-check" }
};

export function inicializarListado() {

    renderizarInspectionCards();

    document.addEventListener("inspection:list", renderizarInspectionCards);
    document.addEventListener("inspection:saved", renderizarInspectionCards);
    document.addEventListener("inspection:deleted", renderizarInspectionCards);

    const buscador = document.getElementById("buscarInspeccion");
    const filtro = document.getElementById("filtroEstado");

    if (buscador) buscador.addEventListener("input", renderizarInspectionCards);
    if (filtro) filtro.addEventListener("change", renderizarInspectionCards);

}

function obtenerInspeccionesFiltradas() {

    const texto = (document.getElementById("buscarInspeccion")?.value || "")
        .trim()
        .toLowerCase();

    const estado = document.getElementById("filtroEstado")?.value || "";

    return inspeccionesOrdenadas().filter(inspeccion => {

        const form = inspeccion.formulario || {};

        if (estado && form.estado !== estado) return false;

        if (texto) {
            const contenido = [
                form.establecimiento,
                form.propietario,
                form.inspector,
                form.numeroInspeccion,
                form.tipoInspeccion
            ].filter(Boolean).join(" ").toLowerCase();

            if (!contenido.includes(texto)) return false;
        }

        return true;

    });

}

export function renderizarInspectionCards() {

    const contenedor = document.getElementById("inspectionCards");
    if (!contenedor) return;

    const inspecciones = obtenerInspeccionesFiltradas();

    contenedor.innerHTML = "";

    if (!inspecciones.length) {
        contenedor.appendChild(crearEstadoVacio());
        return;
    }

    inspecciones.forEach(inspeccion => {
        contenedor.appendChild(crearTarjeta(inspeccion));
    });

}

function crearEstadoVacio() {

    const hayInspecciones = inspeccionesOrdenadas().length > 0;

    const div = document.createElement("div");
    div.className = "empty-cards";

    div.innerHTML = hayInspecciones
        ? `
            <i class="fa-solid fa-magnifying-glass"></i>
            <strong>Sin resultados</strong>
            <p>No hay inspecciones que coincidan con la búsqueda o el filtro seleccionado.</p>
        `
        : `
            <i class="fa-solid fa-building-shield"></i>
            <strong>Aún no hay inspecciones registradas</strong>
            <p>Presiona "Nueva inspección" para iniciar el registro de la primera visita.</p>
        `;

    return div;

}

function crearTarjeta(inspeccion) {

    const form = inspeccion.formulario || {};

    const nombre = form.establecimiento?.trim() || "Establecimiento sin nombre";
    const tipo = form.tipoInspeccion || "Sin tipo definido";
    const inspector = form.inspector?.trim() || "Sin asignar";
    const numero = form.numeroInspeccion || "—";
    const estadoInfo = ESTADOS[form.estado] || ESTADOS["Pendiente"];

    const fecha = new Date(inspeccion.fechaActualizacion || inspeccion.fechaCreacion);
    const fechaTexto = isNaN(fecha) ? "" : fecha.toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric"
    });

    const card = document.createElement("article");
    card.className = "inspection-card";

    card.innerHTML = `
        <div class="inspection-card-header">
            <div>
                <h3>${escaparHTML(nombre)}</h3>
            </div>
            <span class="estado-badge ${estadoInfo.clase}">
                <i class="fa-solid ${estadoInfo.icono}"></i>
                ${escaparHTML(form.estado || "Pendiente")}
            </span>
        </div>

        <div class="card-meta">
            <span><i class="fa-solid fa-hashtag"></i> ${escaparHTML(numero)}</span>
            <span><i class="fa-solid fa-building-shield"></i> ${escaparHTML(tipo)}</span>
            <span><i class="fa-solid fa-user"></i> ${escaparHTML(inspector)}</span>
            ${fechaTexto ? `<span><i class="fa-solid fa-calendar"></i> ${fechaTexto}</span>` : ""}
        </div>

        <div class="card-actions">
            <button type="button" class="action-ver">
                <i class="fa-solid fa-pen"></i> Ver / Editar
            </button>
            <button type="button" class="action-pdf">
                <i class="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button type="button" class="action-delete">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;

    card.querySelector(".action-ver")
        .addEventListener("click", () => abrirInspeccion(inspeccion));

    card.querySelector(".action-pdf")
        .addEventListener("click", (e) => {
            e.stopPropagation();
            generarPDF(inspeccion);
        });

    card.querySelector(".action-delete")
        .addEventListener("click", (e) => {
            e.stopPropagation();
            eliminarInspeccion(inspeccion.id);
        });

    return card;

}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}
