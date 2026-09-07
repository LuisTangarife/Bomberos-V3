/* ========================================================================
   FIRMAS.JS — Módulo APH

   Mismo mecanismo de canvas que Ayudas/Censos/Inspecciones, pero
   generalizado: aquí hay 5 firmas posibles, no 2 —
     - rechazoPaciente / rechazoTestigo  (vista Atención, sección
       "Exoneración de responsabilidades", solo si el paciente rechaza
       el traslado)
     - paciente1 / paciente2 / paciente3 (vista Consentimiento, hasta
       3 firmantes como en el formato en papel)
   En vez de repetir la misma función para cada par de firmas (como
   hacían los demás módulos, escritos antes de que APH necesitara 5),
   se registran por un identificador (tipo) y un elemento <canvas>.
======================================================================== */

import { state } from "./estado.js";

const registro = new Map(); // tipo -> { canvas, ctx, dibujando, destino: "firmas" | "firmasConsentimiento", indice? }

export function registrarFirma(tipo, idCanvas, destino, indice = null) {

    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ajustarCanvas(canvas);

    registro.set(tipo, { canvas, ctx, dibujando: false, destino, indice });

    canvas.addEventListener("mousedown", e => iniciarTrazo(e, tipo));
    canvas.addEventListener("mousemove", e => moverTrazo(e, tipo));
    canvas.addEventListener("mouseup", () => terminarTrazo(tipo));
    canvas.addEventListener("mouseleave", () => terminarTrazo(tipo));

    canvas.addEventListener("touchstart", e => iniciarTrazo(e, tipo), { passive: false });
    canvas.addEventListener("touchmove", e => moverTrazo(e, tipo), { passive: false });
    canvas.addEventListener("touchend", () => terminarTrazo(tipo));

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

function obtenerPosicionCanvas(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return { x: punto.clientX - rect.left, y: punto.clientY - rect.top };
}

function iniciarTrazo(e, tipo) {
    e.preventDefault();
    const f = registro.get(tipo);
    f.dibujando = true;
    const p = obtenerPosicionCanvas(e, f.canvas);
    f.ctx.beginPath();
    f.ctx.moveTo(p.x, p.y);
}

function moverTrazo(e, tipo) {
    e.preventDefault();
    const f = registro.get(tipo);
    if (!f.dibujando) return;
    const p = obtenerPosicionCanvas(e, f.canvas);
    f.ctx.lineWidth = 2;
    f.ctx.lineCap = "round";
    f.ctx.lineJoin = "round";
    f.ctx.lineTo(p.x, p.y);
    f.ctx.stroke();
}

function terminarTrazo(tipo) {
    const f = registro.get(tipo);
    if (!f.dibujando) return;
    f.dibujando = false;
    guardarFirma(tipo);
}

function guardarFirma(tipo) {

    const f = registro.get(tipo);
    const dataUrl = f.canvas.toDataURL("image/png");

    if (f.destino === "firmasConsentimiento") {
        state.firmasConsentimiento[f.indice] = dataUrl;
    } else {
        state.firmas[tipo] = dataUrl;
    }

}

export function limpiarFirma(tipo) {

    const f = registro.get(tipo);
    if (!f) return;

    f.ctx.save();
    f.ctx.setTransform(1, 0, 0, 1, 0, 0);
    f.ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
    f.ctx.restore();

    if (f.destino === "firmasConsentimiento") {
        state.firmasConsentimiento[f.indice] = null;
    } else {
        state.firmas[tipo] = null;
    }

}

export function restaurarFirma(tipo, dataUrl) {

    const f = registro.get(tipo);
    if (!f || !dataUrl) return;

    const img = new Image();
    img.onload = () => {
        f.ctx.save();
        f.ctx.setTransform(1, 0, 0, 1, 0, 0);
        f.ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
        f.ctx.drawImage(img, 0, 0, f.canvas.width, f.canvas.height);
        f.ctx.restore();
    };
    img.src = dataUrl;

}

export function limpiarTodasLasFirmas() {
    registro.forEach((_, tipo) => limpiarFirma(tipo));
}

export function redimensionarCanvasFirmas() {

    registro.forEach((f, tipo) => {

        const rect = f.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto

        const dataUrlPrevio = f.destino === "firmasConsentimiento"
            ? state.firmasConsentimiento[f.indice]
            : state.firmas[tipo];

        ajustarCanvas(f.canvas);
        if (dataUrlPrevio) restaurarFirma(tipo, dataUrlPrevio);

    });

}
