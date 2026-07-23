/* ========================================================================
   CLIMA.JS
   Módulo Emergencia — Clima actual real para el widget del Gestor.

   Antes este widget tenía "22°C / Lluvia ligera / 78% humedad" fijo en
   el HTML, sin ningún JS detrás. Se usa Open-Meteo (https://open-meteo.com)
   porque es gratuita, no requiere API key y no tiene límite de peticiones
   para este volumen de uso.

   Coordenadas: Villamaría, Caldas (sede del Cuerpo de Bomberos según el
   pie de página del certificado oficial). Si la estación cambia de
   ubicación, solo hay que actualizar LAT/LON.
======================================================================== */

const LAT = 5.045;
const LON = -75.515;

const URL_CLIMA =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility` +
    `&timezone=America%2FBogota`;

// Traducción de los códigos WMO que devuelve weather_code a texto e
// icono de Font Awesome. La tabla completa tiene ~30 códigos; se cubren
// los que realísticamente aplican al clima de Caldas (no hay nieve ni
// tormentas de arena en Villamaría).
const CODIGOS_CLIMA = {
    0:  { texto: 'Cielo despejado',        icono: 'fa-sun' },
    1:  { texto: 'Mayormente despejado',   icono: 'fa-sun' },
    2:  { texto: 'Parcialmente nublado',   icono: 'fa-cloud-sun' },
    3:  { texto: 'Nublado',                icono: 'fa-cloud' },
    45: { texto: 'Niebla',                 icono: 'fa-smog' },
    48: { texto: 'Niebla con escarcha',    icono: 'fa-smog' },
    51: { texto: 'Llovizna ligera',        icono: 'fa-cloud-rain' },
    53: { texto: 'Llovizna moderada',      icono: 'fa-cloud-rain' },
    55: { texto: 'Llovizna intensa',       icono: 'fa-cloud-rain' },
    56: { texto: 'Llovizna helada',        icono: 'fa-cloud-rain' },
    57: { texto: 'Llovizna helada intensa',icono: 'fa-cloud-rain' },
    61: { texto: 'Lluvia ligera',          icono: 'fa-cloud-rain' },
    63: { texto: 'Lluvia moderada',        icono: 'fa-cloud-showers-heavy' },
    65: { texto: 'Lluvia intensa',         icono: 'fa-cloud-showers-heavy' },
    66: { texto: 'Lluvia helada ligera',   icono: 'fa-cloud-rain' },
    67: { texto: 'Lluvia helada intensa',  icono: 'fa-cloud-showers-heavy' },
    71: { texto: 'Nevada ligera',          icono: 'fa-snowflake' },
    73: { texto: 'Nevada moderada',        icono: 'fa-snowflake' },
    75: { texto: 'Nevada intensa',         icono: 'fa-snowflake' },
    80: { texto: 'Chubascos ligeros',      icono: 'fa-cloud-rain' },
    81: { texto: 'Chubascos moderados',    icono: 'fa-cloud-showers-heavy' },
    82: { texto: 'Chubascos violentos',    icono: 'fa-cloud-showers-heavy' },
    95: { texto: 'Tormenta eléctrica',     icono: 'fa-bolt' },
    96: { texto: 'Tormenta con granizo',   icono: 'fa-cloud-bolt' },
    99: { texto: 'Tormenta con granizo fuerte', icono: 'fa-cloud-bolt' }
};

function describirCodigo(codigo) {
    return CODIGOS_CLIMA[codigo] || { texto: 'Condición desconocida', icono: 'fa-cloud-question' };
}

/**
 * Consulta el clima actual y actualiza el widget "Clima actual" del
 * Gestor de Emergencias. Si la petición falla (sin internet, API caída),
 * deja un mensaje de error en el widget en vez de dejar el spinner
 * girando indefinidamente o, peor, un dato viejo sin avisar.
 */
export async function actualizarClima() {

    const elIcono = document.getElementById('climaIcono');
    const elTemp = document.getElementById('climaTemp');
    const elCondicion = document.getElementById('climaCondicion');
    const elHumedad = document.getElementById('climaHumedad');
    const elViento = document.getElementById('climaViento');
    const elVisibilidad = document.getElementById('climaVisibilidad');

    if (!elTemp) return; // el widget no está en esta página

    try {

        const respuesta = await fetch(URL_CLIMA);

        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }

        const datos = await respuesta.json();
        const actual = datos.current;

        if (!actual) {
            throw new Error('Respuesta sin datos "current"');
        }

        const { texto, icono } = describirCodigo(actual.weather_code);

        elTemp.textContent = `${Math.round(actual.temperature_2m)}°C`;
        elCondicion.textContent = texto;
        elHumedad.textContent = `${Math.round(actual.relative_humidity_2m)}%`;
        elViento.textContent = `${Math.round(actual.wind_speed_10m)} km/h`;

        // Open-Meteo devuelve visibilidad en metros; el widget la muestra
        // en km. Si el modelo no trae ese dato para esta ubicación, se
        // deja "-- km" en vez de mostrar "NaN km".
        if (typeof actual.visibility === 'number') {
            elVisibilidad.textContent = `${(actual.visibility / 1000).toFixed(1)} km`;
        } else {
            elVisibilidad.textContent = '-- km';
        }

        if (elIcono) {
            elIcono.className = `fa-solid ${icono} clima-icono`;
        }

    } catch (error) {

        console.error('[clima] No se pudo obtener el clima actual:', error);

        elCondicion.textContent = 'No disponible';
        elTemp.textContent = '--°C';
        elHumedad.textContent = '--%';
        elViento.textContent = '-- km/h';
        elVisibilidad.textContent = '-- km';

        if (elIcono) {
            elIcono.className = 'fa-solid fa-triangle-exclamation clima-icono';
        }

    }

}
