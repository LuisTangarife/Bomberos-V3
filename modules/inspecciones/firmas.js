/* ========================================================================
   FIRMAS.JS
   Sistema de Inspecciones — Firmas digitales con canvas
======================================================================== */

import { state } from "./estado.js";
import { programarAutoGuardado } from "./autoguardado.js";

const CANVAS_A_TIPO = {
    firmaInspector: "inspector",
    firmaPropietario: "propietario"
};

export function inicializarFirmas() {

    inicializarCanvasFirma("firmaInspector", "inspector");
    inicializarCanvasFirma("firmaPropietario", "propietario");

    document.querySelectorAll(".clear-signature").forEach(boton => {

        const tipo = CANVAS_A_TIPO[boton.dataset.canvas];
        if (!tipo) return;

        boton.addEventListener("click", () => limpiarFirma(tipo));

    });

    // En móviles, girar la pantalla cambia el ancho disponible del canvas.
    window.addEventListener("resize", redimensionarCanvasFirmas);
    window.addEventListener("orientationchange", () => {
        setTimeout(redimensionarCanvasFirmas, 200);
    });

}

function inicializarCanvasFirma(idCanvas, tipo) {

    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ajustarCanvas(canvas);

    state.canvas[tipo] = { canvas, ctx, dibujando: false };

    registrarEventosFirma(tipo);

}

function ajustarCanvas(canvas) {

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    canvas.getContext("2d").scale(ratio, ratio);

}

function registrarEventosFirma(tipo) {

    const firma = state.canvas[tipo];
    const canvas = firma.canvas;

    canvas.addEventListener("mousedown", e => iniciarTrazo(e, tipo));
    canvas.addEventListener("mousemove", e => moverTrazo(e, tipo));
    canvas.addEventListener("mouseup", () => terminarTrazo(tipo));
    canvas.addEventListener("mouseleave", () => terminarTrazo(tipo));

    canvas.addEventListener("touchstart", e => iniciarTrazo(e, tipo), { passive: false });
    canvas.addEventListener("touchmove", e => moverTrazo(e, tipo), { passive: false });
    canvas.addEventListener("touchend", () => terminarTrazo(tipo));

}

function iniciarTrazo(e, tipo) {

    e.preventDefault();

    const firma = state.canvas[tipo];
    firma.dibujando = true;

    const punto = obtenerPosicionCanvas(e, firma.canvas);

    firma.ctx.beginPath();
    firma.ctx.moveTo(punto.x, punto.y);

}

function moverTrazo(e, tipo) {

    e.preventDefault();

    const firma = state.canvas[tipo];
    if (!firma.dibujando) return;

    const punto = obtenerPosicionCanvas(e, firma.canvas);

    firma.ctx.lineWidth = 2;
    firma.ctx.lineCap = "round";
    firma.ctx.lineJoin = "round";
    firma.ctx.lineTo(punto.x, punto.y);
    firma.ctx.stroke();

}

function terminarTrazo(tipo) {

    const firma = state.canvas[tipo];
    if (!firma.dibujando) return;

    firma.dibujando = false;
    guardarFirma(tipo);

}

function obtenerPosicionCanvas(e, canvas) {

    const rect = canvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;

    return {
        x: punto.clientX - rect.left,
        y: punto.clientY - rect.top
    };

}

function guardarFirma(tipo) {

    const canvas = state.canvas[tipo].canvas;
    state.firmas[tipo] = canvas.toDataURL("image/png");

    programarAutoGuardado();

}

export function restaurarFirma(tipo) {

    const imagen = state.firmas[tipo];
    if (!imagen) return;

    const firma = state.canvas[tipo];
    if (!firma) return;

    const img = new Image();

    img.onload = () => {
        firma.ctx.clearRect(0, 0, firma.canvas.width, firma.canvas.height);
        firma.ctx.drawImage(img, 0, 0, firma.canvas.width, firma.canvas.height);
    };

    img.src = imagen;

}

export function limpiarFirma(tipo) {

    const firma = state.canvas[tipo];
    if (!firma) return;

    firma.ctx.clearRect(0, 0, firma.canvas.width, firma.canvas.height);
    state.firmas[tipo] = null;

    programarAutoGuardado();

}

export function existeFirma(tipo) {
    return !!state.firmas[tipo];
}

/**
 * Vuelve a calcular el tamaño real (en píxeles) de los canvas de firma
 * y restaura el trazo guardado, si existía.
 *
 * Es necesario llamarla cada vez que la vista del formulario pasa de
 * oculta (display:none) a visible, porque al momento de la carga inicial
 * (inicializarFirmas) el contenedor puede estar oculto y
 * getBoundingClientRect() devuelve 0x0, dejando el canvas sin área de
 * dibujo de forma permanente.
 */
export function redimensionarCanvasFirmas() {

    ["inspector", "propietario"].forEach(tipo => {

        const firma = state.canvas[tipo];
        if (!firma) return;

        const rect = firma.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto

        ajustarCanvas(firma.canvas);
        restaurarFirma(tipo);

    });

}

export function limpiarTodasLasFirmas() {
    limpiarFirma("inspector");
    limpiarFirma("propietario");
}

export function exportarFirmas() {
    return {
        inspector: state.firmas.inspector,
        propietario: state.firmas.propietario
    };
}
