/* ========================================================================
   FIRMAS.JS
   Módulo Censos — Firmas digitales con canvas

   Mismo mecanismo que modules/ayudas/firmas.js (y modules/inspecciones/
   firmas.js), adaptado a los dos firmantes de este formato: el
   funcionario que levanta el censo y la persona encuestada.
======================================================================== */

import { state } from "./estado.js";

const CANVAS_A_TIPO = {
    firmaFuncionario: "funcionario",
    firmaEncuestado: "encuestado"
};

export function inicializarFirmas() {

    inicializarCanvasFirma("firmaFuncionario", "funcionario");
    inicializarCanvasFirma("firmaEncuestado", "encuestado");

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

    const ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);

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

}

export function restaurarFirma(tipo) {

    const imagen = state.firmas[tipo];
    if (!imagen) return;

    const firma = state.canvas[tipo];
    if (!firma) return;

    const img = new Image();

    img.onload = () => {

        const { ctx, canvas } = firma;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();

    };

    img.src = imagen;

}

export function limpiarFirma(tipo) {

    const firma = state.canvas[tipo];
    if (!firma) return;

    const { ctx, canvas } = firma;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    state.firmas[tipo] = null;

}

export function redimensionarCanvasFirmas() {

    ["funcionario", "encuestado"].forEach(tipo => {

        const firma = state.canvas[tipo];
        if (!firma) return;

        const rect = firma.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto

        ajustarCanvas(firma.canvas);
        restaurarFirma(tipo);

    });

}

export function limpiarTodasLasFirmas() {
    limpiarFirma("funcionario");
    limpiarFirma("encuestado");
}
