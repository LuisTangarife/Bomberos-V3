/* ========================================================================
   GESTOR.JS
   Módulo Emergencia — Gestor de Emergencias consolidado

   Muestra en una sola lista TODAS las emergencias guardadas desde
   cualquier dispositivo (Firestore), con búsqueda y filtro por tipo
   de evento. No reemplaza el listado "REPORTES GUARDADOS" (ese sigue
   mostrando solo lo que hay en este dispositivo/localStorage); este
   gestor es la vista consolidada entre dispositivos.

   No toca el formulario ni el diseño existente: reutiliza las clases
   .report-card / .btn-mini / .empty-msg ya definidas en styles.css, y
   para "Ver" reutiliza el modal de certificado que ya existe en la
   página (window.renderCertificate), así el botón "Imprimir / Guardar
   PDF" del modal funciona igual que con los reportes locales.
======================================================================== */

import { listarEmergencias, eliminarEmergencia } from "./firebase.js";

let emergencias = [];
let cargando = false;

export function inicializarGestor() {

    cargarEmergencias();

    const buscador = document.getElementById("buscarEmergenciaGestor");
    const filtro = document.getElementById("filtroEventoGestor");
    const btnRefrescar = document.getElementById("btnRefrescarGestor");

    if (buscador) buscador.addEventListener("input", renderizarTarjetas);
    if (filtro) filtro.addEventListener("change", renderizarTarjetas);
    if (btnRefrescar) btnRefrescar.addEventListener("click", cargarEmergencias);

    // app.js dispara este evento después de guardar (con éxito o no) una
    // emergencia hacia Firestore, para que el gestor se mantenga al día
    // sin que el usuario tenga que refrescar manualmente.
    document.addEventListener("emergencia:sincronizada", cargarEmergencias);

}

async function cargarEmergencias() {

    if (cargando) return;
    cargando = true;

    const contenedor = document.getElementById("gestorEmergenciasList");
    if (contenedor) {
        contenedor.innerHTML = `<div class="empty-msg">Cargando emergencias registradas...</div>`;
    }

    try {

        emergencias = await listarEmergencias();
        actualizarOpcionesFiltro();
        renderizarTarjetas();

    } catch (error) {

        console.error("[gestor emergencias] No se pudo listar desde Firestore", error);

        if (contenedor) {
            contenedor.innerHTML = `
                <div class="empty-msg">
                    ⚠️ No se pudo conectar con el servidor para traer el consolidado.
                    Revisa tu conexión a internet e intenta de nuevo.
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

function obtenerEmergenciasFiltradas() {

    const texto = (document.getElementById("buscarEmergenciaGestor")?.value || "")
        .trim()
        .toLowerCase();

    const evento = document.getElementById("filtroEventoGestor")?.value || "";

    return emergencias.filter(emergencia => {

        if (evento && emergencia.evento !== evento) return false;

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

function renderizarTarjetas() {

    const contenedor = document.getElementById("gestorEmergenciasList");
    if (!contenedor) return;

    const filtradas = obtenerEmergenciasFiltradas();

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

    div.className = "empty-msg";

    div.textContent = emergencias.length
        ? "Sin resultados para la búsqueda o el filtro seleccionado."
        : "Aún no hay emergencias registradas por ningún dispositivo.";

    return div;

}

function crearTarjeta(emergencia) {

    const lugar = emergencia.lugar?.trim() || "Lugar sin especificar";
    const evento = emergencia.evento || "Sin tipo de evento";

    const vehiculos = Array.isArray(emergencia.vehiculos)
        ? emergencia.vehiculos.map(v => v.vehiculo).filter(Boolean).join(", ")
        : "";

    const personal = Array.isArray(emergencia.personal)
        ? emergencia.personal.join(", ")
        : "";

    const fechaTexto = formatearFecha(emergencia.fecha);

    const card = document.createElement("div");
    card.className = "report-card";

    card.innerHTML = `
        <span class="report-tag">${escaparHTML(evento)}</span>
        <div class="report-info">
            <div class="report-title">${escaparHTML(lugar)}</div>
            <div class="report-meta">
                ${fechaTexto ? `${fechaTexto} · ` : ""}${escaparHTML(emergencia.horaReporte || "")}
                ${vehiculos ? ` · ${escaparHTML(vehiculos)}` : ""}
                ${personal ? ` · ${escaparHTML(personal)}` : ""}
            </div>
        </div>
        <div class="report-actions">
            <button type="button" class="btn-mini btn-ver-emergencia">📄 Ver</button>
            <button type="button" class="btn-mini btn-eliminar-emergencia">🗑</button>
        </div>
    `;

    card.querySelector(".btn-ver-emergencia")
        .addEventListener("click", () => {
            if (typeof window.renderCertificate === "function") {
                window.renderCertificate(emergencia);
            }
        });

    card.querySelector(".btn-eliminar-emergencia")
        .addEventListener("click", async () => {

            if (!confirm(`¿Eliminar del consolidado la emergencia en "${lugar}"?\n\nEsto solo la quita del Gestor de Emergencias, no borra copias guardadas en otros dispositivos.`)) {
                return;
            }

            try {
                await eliminarEmergencia(emergencia.id);
                emergencias = emergencias.filter(e => e.id !== emergencia.id);
                renderizarTarjetas();
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
