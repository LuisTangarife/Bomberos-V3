/* ========================================================================
   MAPAS.JS
   Módulo Emergencia — Mapa de puntos críticos del Centro de Gestión

   Dibuja sobre un mapa (Leaflet + OpenStreetMap/CARTO) cada emergencia que
   tenga coordenadas válidas (capturadas con el botón "Usar mi ubicación"
   del formulario). Cada punto se colorea según su gravedad:

     - Rojo pulsante  → emergencia con víctimas o lesionados
     - Ámbar          → emergencia sin víctimas reportadas

   No depende de gestor.js para nada más que recibir la lista ya filtrada
   de emergencias a dibujar; toda la lógica de Firestore vive en firebase.js
   y toda la lógica de filtros/tarjetas vive en gestor.js.
======================================================================== */

// Villamaría, Caldas (sede del Cuerpo de Bomberos Voluntarios) — centro
// por defecto del mapa mientras no haya puntos que encuadrar.
const CENTRO_DEFECTO = [5.045, -75.515];
const ZOOM_DEFECTO = 13;

let mapa = null;
let capaMarcadores = null;
let indiceEmergencias = {};

/**
 * Crea el mapa una sola vez. Si Leaflet todavía no ha cargado (script
 * externo) o el contenedor no existe en el DOM, no hace nada; gestor.js
 * puede llamar a esta función con seguridad en cualquier momento.
 */
export function inicializarMapa() {

    if (mapa || typeof window.L === "undefined") return;

    const contenedor = document.getElementById("mapaEmergencias");
    if (!contenedor) return;

    mapa = window.L.map(contenedor, {
        zoomControl: true,
        attributionControl: true
    }).setView(CENTRO_DEFECTO, ZOOM_DEFECTO);

    window.L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: "abcd"
        }
    ).addTo(mapa);

    capaMarcadores = window.L.layerGroup().addTo(mapa);

    // El mapa se crea dentro de un contenedor que puede no tener su
    // tamaño final todavía (fuentes/CSS cargando). Forzamos un recálculo
    // corto después para que no se vea cortado o gris.
    setTimeout(() => mapa && mapa.invalidateSize(), 250);

}

/**
 * Vuelve a pintar todos los marcadores a partir de la lista de
 * emergencias ya filtrada (búsqueda + filtros de evento/gravedad).
 * Devuelve cuántas de esas emergencias tenían coordenadas válidas, para
 * que gestor.js pueda mostrarlo en las estadísticas.
 */
export function renderizarMapa(emergencias) {

    const mensaje = document.getElementById("mapaMensaje");

    if (!mapa || !capaMarcadores) {
        if (mensaje) {
            mensaje.textContent = "El mapa no se pudo cargar. Verifica tu conexión a internet.";
        }
        return 0;
    }

    // Si el panel del mapa estuvo oculto (se pasó a la vista de
    // formulario y se volvió), Leaflet puede haber calculado mal su
    // tamaño; esto lo corrige antes de reencuadrar los puntos.
    mapa.invalidateSize();

    capaMarcadores.clearLayers();
    indiceEmergencias = {};

    const puntos = (emergencias || []).filter(tieneCoordenadasValidas);

    puntos.forEach(emergencia => {

        indiceEmergencias[emergencia.id] = emergencia;

        const lat = parseFloat(emergencia.latitud);
        const lng = parseFloat(emergencia.longitud);
        const critica = esCritica(emergencia);

        const icono = window.L.divIcon({
            className: "",
            html: `<span class="marker-punto ${critica ? "marker-critica" : "marker-controlada"}"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -12]
        });

        window.L.marker([lat, lng], { icon: icono })
            .bindPopup(crearPopupHTML(emergencia, critica))
            .addTo(capaMarcadores);

    });

    if (puntos.length) {

        const bounds = window.L.latLngBounds(
            puntos.map(p => [parseFloat(p.latitud), parseFloat(p.longitud)])
        );

        mapa.fitBounds(bounds.pad(0.3), { maxZoom: 15 });

    } else {
        mapa.setView(CENTRO_DEFECTO, ZOOM_DEFECTO);
    }

    if (mensaje) {
        const sinUbicar = (emergencias || []).length - puntos.length;
        mensaje.textContent = sinUbicar > 0
            ? `${sinUbicar} emergencia${sinUbicar === 1 ? "" : "s"} sin coordenadas registradas no se muestra${sinUbicar === 1 ? "" : "n"} en el mapa.`
            : "";
    }

    return puntos.length;

}

function tieneCoordenadasValidas(emergencia) {

    const lat = parseFloat(emergencia?.latitud);
    const lng = parseFloat(emergencia?.longitud);

    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0);

}

function esCritica(emergencia) {
    const lesionados = parseInt(emergencia?.lesionados, 10) || 0;
    const victimas = parseInt(emergencia?.victimas, 10) || 0;
    return (lesionados + victimas) > 0;
}

function crearPopupHTML(emergencia, critica) {

    const lugar = emergencia.lugar?.trim() || "Lugar sin especificar";
    const evento = emergencia.evento || "Sin tipo de evento";
    const direccion = emergencia.direccion?.trim() || "";
    const fechaTexto = formatearFecha(emergencia.fecha);

    return `
        <div class="popup-emergencia">
            <span class="popup-badge ${critica ? "critica" : "controlada"}">
                ${critica ? "🚨 Con víctimas" : "✅ Sin víctimas"}
            </span>
            <h4>${escaparHTML(lugar)}</h4>
            <p class="popup-evento">${escaparHTML(evento)}</p>
            ${direccion ? `<p class="popup-direccion">${escaparHTML(direccion)}</p>` : ""}
            <p class="popup-fecha">${fechaTexto ? `${fechaTexto} · ` : ""}${escaparHTML(emergencia.horaReporte || "")}</p>
            <button type="button" class="popup-btn" data-ver-emergencia="${emergencia.id}">Ver reporte</button>
        </div>
    `;

}

// Delegado a nivel de documento porque los popups de Leaflet se insertan
// en el DOM dinámicamente (no existen todavía cuando se agrega el evento).
document.addEventListener("click", (evento) => {

    const boton = evento.target.closest("[data-ver-emergencia]");
    if (!boton) return;

    const emergencia = indiceEmergencias[boton.getAttribute("data-ver-emergencia")];

    if (emergencia && typeof window.renderCertificate === "function") {
        window.renderCertificate(emergencia);
    }

});

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
