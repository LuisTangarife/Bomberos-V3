/* ========================================================================
   GESTOR.JS
   Módulo Emergencia — Centro de Gestión de Emergencias

   Muestra en una sola vista TODAS las emergencias guardadas desde
   cualquier dispositivo (Firestore): estadísticas rápidas, mapa de
   puntos críticos y tarjetas con búsqueda + filtro por tipo de evento
   y por gravedad. No reemplaza el listado "REPORTES GUARDADOS" (ese
   sigue mostrando solo lo que hay en este dispositivo/localStorage);
   este gestor es la vista consolidada entre dispositivos.

   Para "Ver" y "PDF" reutiliza el modal de certificado que ya existe
   en la página (window.renderCertificate / window.printCertificate),
   así funcionan igual que con los reportes locales.
======================================================================== */

import { listarEmergencias, eliminarEmergencia } from "./firebase.js";
import { inicializarMapa, renderizarMapa } from "./mapas.js";

import { renderCertificate, printCertificate, closeModal } from "./certificados.js";

window.renderCertificate = renderCertificate;
window.printCertificate = printCertificate;
window.closeModal = closeModal;

let emergencias = [];
let cargando = false;

export function inicializarGestor() {

    inicializarMapa();

    cargarEmergencias();

    configurarBotones();

    const buscador = document.getElementById("buscarEmergenciaGestor");
    const filtroEvento = document.getElementById("filtroEventoGestor");
    const filtroGravedad = document.getElementById("filtroGravedadGestor");
    const btnRefrescar = document.getElementById("btnRefrescarGestor");

    if (buscador) buscador.addEventListener("input", actualizarVista);
    if (filtroEvento) filtroEvento.addEventListener("change", actualizarVista);
    if (filtroGravedad) filtroGravedad.addEventListener("change", actualizarVista);
    if (btnRefrescar) btnRefrescar.addEventListener("click", cargarEmergencias);

    // app.js dispara este evento después de guardar (con éxito o no) una
    // emergencia hacia Firestore, para que el gestor se mantenga al día
    // sin que el usuario tenga que refrescar manualmente.
    document.addEventListener("emergencia:sincronizada", cargarEmergencias);

}

/* ========================================================================
   NAVEGACIÓN ENTRE VISTAS
   El Centro de Gestión es la vista principal del módulo; el formulario
   de reporte (y la lista de "REPORTES GUARDADOS" local del dispositivo,
   que vive dentro del mismo bloque) solo se muestra cuando el usuario
   pide explícitamente registrar una emergencia nueva.
======================================================================== */

function configurarBotones() {

    const btnNueva = document.getElementById("btnNuevaEmergencia");

    if (!btnNueva) return;

    btnNueva.addEventListener("click", () => {

        window.location.href = "index.html";

    });

}

async function cargarEmergencias() {

    if (cargando) return;
    cargando = true;

    const contenedor = document.getElementById("gestorEmergenciasList");
    if (contenedor) {
        contenedor.innerHTML = `<div class="empty-cards-em">
            <i class="fa-solid fa-satellite-dish"></i>
            <strong>Cargando emergencias registradas...</strong>
        </div>`;
    }

    try {

        emergencias = await listarEmergencias();
        actualizarOpcionesFiltro();
        actualizarVista();

    } catch (error) {

        console.error("[gestor emergencias] No se pudo listar desde Firestore", error);

        if (contenedor) {
            contenedor.innerHTML = `
                <div class="empty-cards-em">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <strong>No se pudo conectar con el servidor</strong>
                    <p>Revisa tu conexión a internet e intenta de nuevo.</p>
                </div>
            `;
        }

    } finally {
        cargando = false;
    }

}

function actualizarOpcionesFiltro() {

    const filtro = document.getElementById("filtroEventoGestor");
    if (!filtro) return;

    const seleccionActual = filtro.value;

    const eventos = [...new Set(
        emergencias.map(e => e.evento).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    filtro.innerHTML = `<option value="">Todos los eventos</option>` +
        eventos.map(evento =>
            `<option value="${escaparHTML(evento)}">${escaparHTML(evento)}</option>`
        ).join("");

    if (eventos.includes(seleccionActual)) {
        filtro.value = seleccionActual;
    }

}

function esCritica(emergencia) {
    const lesionados = parseInt(emergencia?.lesionados, 10) || 0;
    const victimas = parseInt(emergencia?.victimas, 10) || 0;
    return (lesionados + victimas) > 0;
}

function obtenerEmergenciasFiltradas() {

    const texto = (document.getElementById("buscarEmergenciaGestor")?.value || "")
        .trim()
        .toLowerCase();

    const evento = document.getElementById("filtroEventoGestor")?.value || "";
    const gravedad = document.getElementById("filtroGravedadGestor")?.value || "";

    return emergencias.filter(emergencia => {

        if (evento && emergencia.evento !== evento) return false;

        if (gravedad === "critica" && !esCritica(emergencia)) return false;
        if (gravedad === "controlada" && esCritica(emergencia)) return false;

        if (texto) {
            const contenido = [
                emergencia.lugar,
                emergencia.direccion,
                emergencia.evento,
                emergencia.descripcion,
                ...(Array.isArray(emergencia.vehiculos)
                    ? emergencia.vehiculos.map(v => v.vehiculo)
                    : []),
                ...(Array.isArray(emergencia.personal) ? emergencia.personal : [])
            ].filter(Boolean).join(" ").toLowerCase();

            if (!contenido.includes(texto)) return false;
        }

        return true;

    });

}

function actualizarVista() {

    const filtradas = obtenerEmergenciasFiltradas();

    renderizarTarjetas(filtradas);
    renderizarMapa(filtradas);
    actualizarEstadisticas(filtradas);

}

function actualizarEstadisticas(filtradas) {

    const statTotal = document.getElementById("statTotal");
    const statCriticas = document.getElementById("statCriticas");
    const statMes = document.getElementById("statMes");
    const statUbicadas = document.getElementById("statUbicadas");

    if (statTotal) statTotal.textContent = filtradas.length;

    if (statCriticas) {
        statCriticas.textContent = filtradas.filter(esCritica).length;
    }

    if (statMes) {

        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();

        const delMes = filtradas.filter(e => {
            if (!e.fecha) return false;
            const [y, m] = e.fecha.split("-").map(Number);
            return y === anioActual && (m - 1) === mesActual;
        });

        statMes.textContent = delMes.length;

    }

    if (statUbicadas) {

        const ubicadas = filtradas.filter(e => {
            const lat = parseFloat(e.latitud);
            const lng = parseFloat(e.longitud);
            return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        });

        statUbicadas.textContent = ubicadas.length;

    }

}

function renderizarTarjetas(filtradas) {

    const contenedor = document.getElementById("gestorEmergenciasList");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (!filtradas.length) {
        contenedor.appendChild(crearEstadoVacio());
        return;
    }

    filtradas.forEach(emergencia => {
        contenedor.appendChild(crearTarjeta(emergencia));
    });

}

function crearEstadoVacio() {

    const div = document.createElement("div");

    div.className = "empty-cards-em";

    div.innerHTML = emergencias.length
        ? `
            <i class="fa-solid fa-magnifying-glass"></i>
            <strong>Sin resultados</strong>
            <p>No hay emergencias que coincidan con la búsqueda o los filtros seleccionados.</p>
        `
        : `
            <i class="fa-solid fa-fire-flame-curved"></i>
            <strong>Aún no hay emergencias registradas</strong>
            <p>Los reportes que se guarden desde cualquier dispositivo aparecerán aquí.</p>
        `;

    return div;

}

function crearTarjeta(emergencia) {

    const lugar = emergencia.lugar?.trim() || "Lugar sin especificar";
    const evento = emergencia.evento || "Sin tipo de evento";
    const direccion = emergencia.direccion?.trim() || "";
    const critica = esCritica(emergencia);

    const vehiculos = Array.isArray(emergencia.vehiculos)
        ? emergencia.vehiculos.map(v => v.vehiculo).filter(Boolean).join(", ")
        : "";

    const personal = Array.isArray(emergencia.personal)
        ? emergencia.personal.join(", ")
        : "";

    const fechaTexto = formatearFecha(emergencia.fecha);

    const card = document.createElement("article");
    card.className = "emergencia-card";

    card.innerHTML = `
        <div class="emergencia-card-header">
            <h3>${escaparHTML(lugar)}</h3>
            <span class="gravedad-badge ${critica ? "critica" : "controlada"}">
                <i class="fa-solid ${critica ? "fa-truck-medical" : "fa-circle-check"}"></i>
                ${critica ? "Con víctimas" : "Sin víctimas"}
            </span>
        </div>

        <div class="card-meta">
            <span><i class="fa-solid fa-fire"></i> ${escaparHTML(evento)}</span>
            ${direccion ? `<span><i class="fa-solid fa-location-dot"></i> ${escaparHTML(direccion)}</span>` : ""}
            ${fechaTexto || emergencia.horaReporte
                ? `<span><i class="fa-solid fa-clock"></i> ${fechaTexto}${fechaTexto && emergencia.horaReporte ? " · " : ""}${escaparHTML(emergencia.horaReporte || "")}</span>`
                : ""}
            ${vehiculos ? `<span><i class="fa-solid fa-truck"></i> ${escaparHTML(vehiculos)}</span>` : ""}
            ${personal ? `<span><i class="fa-solid fa-user-group"></i> ${escaparHTML(personal)}</span>` : ""}
        </div>

        <div class="card-actions">
            <button type="button" class="action-ver-em">
                <i class="fa-solid fa-eye"></i> Ver
            </button>
            <button type="button" class="action-pdf-em">
                <i class="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button type="button" class="action-delete-em">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;

    card.querySelector(".action-ver-em")
        .addEventListener("click", () => {
            if (typeof window.renderCertificate === "function") {
                window.renderCertificate(emergencia);
            }
        });

    card.querySelector(".action-pdf-em")
        .addEventListener("click", () => {
            if (typeof window.renderCertificate === "function") {
                window.renderCertificate(emergencia);
            }
            if (typeof window.printCertificate === "function") {
                setTimeout(() => window.printCertificate(), 150);
            }
        });

    card.querySelector(".action-delete-em")
        .addEventListener("click", async () => {

            if (!confirm(`¿Eliminar del consolidado la emergencia en "${lugar}"?\n\nEsto solo la quita del Centro de Gestión, no borra copias guardadas en otros dispositivos.`)) {
                return;
            }

            try {
                await eliminarEmergencia(emergencia.id);
                emergencias = emergencias.filter(e => e.id !== emergencia.id);
                actualizarVista();
            } catch (error) {
                console.error("[gestor emergencias] No se pudo eliminar", error);
                alert("No se pudo eliminar la emergencia del consolidado. Intenta de nuevo.");
            }

        });

    return card;

}

function formatearFecha(fecha) {

    if (!fecha) return "";

    const [y, m, d] = fecha.split("-");
    if (!y || !m || !d) return fecha;

    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const indice = parseInt(m, 10) - 1;

    return meses[indice] ? `${d} ${meses[indice]} ${y}` : fecha;

}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", inicializarGestor);
