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
import { actualizarClima } from "./clima.js";

import { renderCertificate, printCertificate, closeModal, descargarWord } from "./certificados.js";

window.renderCertificate = renderCertificate;
window.printCertificate = printCertificate;
window.closeModal = closeModal;
window.descargarWord = descargarWord;

let emergencias = [];
let cargando = false;

export function inicializarGestor() {

    inicializarMapa();

    cargarEmergencias();

    configurarBotones();

    actualizarClima();
    // Refresco periódico: el turno de un bombero dura horas, así que el
    // clima consultado al abrir la página quedaría desactualizado si no
    // se vuelve a pedir. 15 minutos es razonable para no saturar la API
    // gratuita ni mostrar datos con horas de atraso.
    setInterval(actualizarClima, 15 * 60 * 1000);

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
        actualizarEstadisticasDelDia();

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

function fechaISO(date) {
    // yyyy-mm-dd en hora local, para poder comparar contra emergencia.fecha
    // (que se guarda como string "yyyy-mm-dd", no como Date).
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/* ========================================================================
   ESTADÍSTICAS DEL DÍA (widget inferior "gestion-bottom-grid")
   A diferencia de actualizarEstadisticas() (las 4 tarjetas superiores,
   que respetan la búsqueda/filtros activos), este widget siempre usa el
   total de emergencias sin filtrar: es un resumen del día, no de la
   búsqueda actual, así que no debería cambiar mientras el usuario escribe
   en el buscador.

   Antes este bloque era HTML fijo (24 / 18 / 32 / 04 y una gráfica con
   alturas hardcodeadas) sin ningún dato real detrás.
======================================================================== */
function actualizarEstadisticasDelDia() {

    const statEmergencias = document.getElementById("miniStatEmergencias");
    const statVictimas = document.getElementById("miniStatVictimas");
    const statLesionados = document.getElementById("miniStatLesionados");
    const statSinVictimas = document.getElementById("miniStatSinVictimas");
    const chart = document.getElementById("diaChart");

    if (!statEmergencias && !chart) return; // widget no está en esta página

    const hoy = new Date();
    const hoyStr = fechaISO(hoy);
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = fechaISO(ayer);

    const emergenciasHoy = emergencias.filter(e => e.fecha === hoyStr);
    const emergenciasAyer = emergencias.filter(e => e.fecha === ayerStr);

    const totalHoy = emergenciasHoy.length;
    const criticasHoy = emergenciasHoy.filter(esCritica).length;
    const sinVictimasHoy = totalHoy - criticasHoy;
    const lesionadosHoy = emergenciasHoy.reduce(
        (suma, e) => suma + (parseInt(e.lesionados, 10) || 0),
        0
    );

    const totalAyer = emergenciasAyer.length;
    const criticasAyer = emergenciasAyer.filter(esCritica).length;
    const sinVictimasAyer = totalAyer - criticasAyer;
    const lesionadosAyer = emergenciasAyer.reduce(
        (suma, e) => suma + (parseInt(e.lesionados, 10) || 0),
        0
    );

    aplicarMiniStat(statEmergencias, totalHoy, totalAyer);
    aplicarMiniStat(statVictimas, criticasHoy, criticasAyer);
    aplicarMiniStat(statLesionados, lesionadosHoy, lesionadosAyer);
    // Para "Sin víctimas" un aumento no es necesariamente "bueno" ni
    // "malo" en el mismo sentido que las otras tres, pero se mantiene
    // la misma lógica de tendencia por consistencia visual del widget.
    aplicarMiniStat(statSinVictimas, sinVictimasHoy, sinVictimasAyer);

    actualizarGraficoUltimosDias(chart);

}

function aplicarMiniStat(elemento, valorHoy, valorAyer) {
    if (!elemento) return;

    const span = elemento.querySelector("span");
    if (span) span.textContent = valorHoy;

    elemento.classList.remove("up", "down");
    if (valorHoy > valorAyer) {
        elemento.classList.add("up");
    } else if (valorHoy < valorAyer) {
        elemento.classList.add("down");
    }
}

// Barras de los últimos 12 días (hoy = la última), cada una con el
// conteo real de emergencias de ese día. La altura se escala contra el
// día con más emergencias del rango para que la barra más alta llegue
// al tope visual, igual que hacía el diseño original con datos fijos.
function actualizarGraficoUltimosDias(chart) {
    if (!chart) return;

    const dias = [];
    const hoy = new Date();

    for (let i = 11; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - i);
        const iso = fechaISO(fecha);
        const total = emergencias.filter(e => e.fecha === iso).length;
        dias.push({ iso, total });
    }

    const maximo = Math.max(1, ...dias.map(d => d.total));

    chart.innerHTML = dias.map(({ iso, total }) => {
        // Altura mínima del 4% para que un día en 0 siga siendo visible
        // como barra (no desaparece del todo), igual que el resto de
        // barras "vacías" del diseño original.
        const alturaPct = total === 0 ? 4 : Math.max(8, Math.round((total / maximo) * 100));
        return `<span style="height:${alturaPct}%" title="${escaparHTML(iso)}: ${total} emergencia(s)"></span>`;
    }).join("");
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

/* Busca una foto usable en varios nombres de campo posibles, ya que
   este archivo no deja claro cuál usa el formulario. Acepta tanto un
   array de fotos como un string único. Si no encuentra nada, devuelve
   null y la tarjeta simplemente no muestra portada. */
function obtenerFotoPrincipal(emergencia) {

    const candidatos = [
        emergencia?.fotos,
        emergencia?.imagenes,
        emergencia?.fotoPrincipal,
        emergencia?.foto
    ];

    for (const candidato of candidatos) {

        if (!candidato) continue;

        if (Array.isArray(candidato) && candidato.length) {
            const primera = candidato[0];
            if (typeof primera === "string") return primera;
            if (primera?.url) return primera.url;
            if (primera?.dataUrl) return primera.dataUrl;
        }

        if (typeof candidato === "string") return candidato;

    }

    return null;

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
    const foto = obtenerFotoPrincipal(emergencia);

    // Sin un campo de prioridad explícito en los datos, se deriva de la
    // gravedad: con víctimas → Alta, sin víctimas → Media. Ajusta esto
    // si el formulario llega a tener un campo de prioridad propio.
    const prioridadNivel = critica ? "alta" : "media";
    const prioridadTexto = critica ? "Alta" : "Media";

    const card = document.createElement("article");
    card.className = "emergencia-card";

    card.innerHTML = `
        ${foto ? `
        <div class="emergencia-card-photo">
            <img src="${escaparHTML(foto)}" alt="">
        </div>` : ""}

        <div class="emergencia-card-header">
            <h3>${escaparHTML(lugar)}</h3>
            <span class="gravedad-badge ${critica ? "critica" : "controlada"}">
                <i class="fa-solid ${critica ? "fa-truck-medical" : "fa-circle-check"}"></i>
                ${critica ? "Con víctimas" : "Sin víctimas"}
            </span>
        </div>

        <div class="prioridad-row">
            <span>Prioridad:</span>
            <div class="prioridad-bar ${prioridadNivel}"><span></span></div>
            <span class="prioridad-label ${prioridadNivel}">${prioridadTexto}</span>
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
