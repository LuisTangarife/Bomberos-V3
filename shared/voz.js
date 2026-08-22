/* ========================================================================
   VOZ.JS
   Anuncios por voz de eventos de la app (ej. "Nuevo reporte registrado")
   usando la Web Speech API del navegador — sin costo, sin API externa,
   sin conexión a internet (las voces del sistema son locales en la
   inmensa mayoría de navegadores/dispositivos).

   Uso:
       import { anunciar, vozHabilitada, alternarVoz } from "../../shared/voz.js";
       anunciar("Nuevo reporte de emergencia registrado. Incendio estructural en Llanitos.");

   Un solo archivo, sin dependencias, para poder importarlo desde
   cualquier módulo (censos, emergencia, inspecciones) sin duplicar
   lógica de síntesis de voz en cada uno.
======================================================================== */

const CLAVE_LOCALSTORAGE = "voz_habilitada";

let vozCache = null;

function obtenerVoz() {

    if (vozCache) return vozCache;
    if (!("speechSynthesis" in window)) return null;

    const voces = window.speechSynthesis.getVoices();

    // Prioriza una voz en español; si no hay ninguna (algunos
    // navegadores tardan en cargar la lista de voces), sigue sin voz
    // explícita y deja que el navegador use su idioma por defecto.
    vozCache = voces.find(v => v.lang?.toLowerCase().startsWith("es")) || null;

    return vozCache;

}

// Las voces del navegador se cargan de forma asíncrona la primera vez;
// este evento asegura que, apenas estén listas, la próxima llamada a
// anunciar() ya pueda usar una voz en español si existe.
if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => { vozCache = null; };
}

export function vozHabilitada() {
    return localStorage.getItem(CLAVE_LOCALSTORAGE) !== "no";
}

export function alternarVoz() {
    const nuevo = vozHabilitada() ? "no" : "si";
    localStorage.setItem(CLAVE_LOCALSTORAGE, nuevo);
    return nuevo === "si";
}

/**
 * Lee en voz alta el texto dado. No hace nada si:
 * - el navegador no soporta Web Speech API (raro, pero existe en
 *   algunos navegadores embebidos/webviews antiguos),
 * - el usuario apagó los anuncios por voz (alternarVoz()).
 */
export function anunciar(texto) {

    if (!vozHabilitada()) return;
    if (!("speechSynthesis" in window)) return;
    if (!texto) return;

    // Cancela cualquier anuncio en curso antes de empezar el nuevo,
    // para que dos guardados seguidos no se atropellen entre sí.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-CO";
    utterance.rate = 1;
    utterance.pitch = 1;

    const voz = obtenerVoz();
    if (voz) utterance.voice = voz;

    window.speechSynthesis.speak(utterance);

}
