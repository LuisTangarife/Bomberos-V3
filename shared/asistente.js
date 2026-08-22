/* ========================================================================
   ASISTENTE.JS
   Asistente flotante, disponible en todas las páginas del sitio.

   Fase 1 (esta entrega):
   - Pestaña "Tendencias": estadísticas locales, gratis, sin IA.
   - Pestaña "Chat IA": preguntas en lenguaje natural a Gemini, usando
     las tendencias como contexto. SOLO LECTURA — no crea, edita ni
     borra nada. Requiere que la persona pegue su propia clave de API
     de Google AI Studio, guardada solo en el localStorage de ESTE
     navegador (nunca en el código, nunca compartida entre usuarios).

   Fase 2 (pendiente, a propósito no incluida aquí):
   - Que el chat pueda proponer creación/corrección de registros, con
     una pantalla de confirmación explícita antes de escribir nada.
======================================================================== */

import { obtenerDatosParaTendencias, calcularTendencias, resumenLegible } from "./tendencias.js";
import { escucharEstadoAuth } from "./auth.js";
import {
    HERRAMIENTAS_ESCRITURA,
    describirPropuestaCenso,
    confirmarYGuardarCenso,
    describirPropuestaInspeccion,
    confirmarYGuardarInspeccion,
    describirPropuestaEmergencia,
    confirmarYGuardarEmergencia
} from "./asistente-escritura.js";
import { anunciar } from "./voz.js";

const CLAVE_API = "asistente_gemini_key";
// "gemini-flash-latest" es un alias que Google mantiene apuntando
// siempre al modelo Flash vigente — evita que el asistente se rompa
// de nuevo cada vez que retiran una versión fija (como pasó con
// "gemini-2.0-flash", que dejó de existir el 1 de junio de 2026). El
// costo es que la versión exacta puede cambiar sin aviso previo; para
// un asistente de consulta interna como este, es la opción correcta.
const MODELO_GEMINI = "gemini-flash-latest";

let panelAbierto = false;
let ultimasTendencias = null;
let ultimoInvitado = null;

function inyectarUI() {

    if (document.getElementById("asistenteFlotante")) return;

    const contenedor = document.createElement("div");
    contenedor.id = "asistenteFlotante";
    contenedor.innerHTML = `
        <style>
            #asistenteFlotante{position:fixed;bottom:22px;right:22px;z-index:9999;font-family:inherit;}
            #btnAsistente{
                width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;
                background:linear-gradient(145deg,#8E0000,#FF3B30);color:#fff;font-size:1.4rem;
                box-shadow:0 10px 25px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;
            }
            #panelAsistente{
                position:fixed;bottom:88px;right:22px;width:340px;max-width:92vw;max-height:70vh;
                background:#12151f;border:1px solid rgba(255,255,255,.12);border-radius:16px;
                box-shadow:0 20px 50px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;
                color:#F4F6FB;font-size:.85rem;
            }
            #panelAsistente.abierto{display:flex;}
            .asist-header{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center;}
            .asist-header b{font-size:.95rem;}
            .asist-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.1);}
            .asist-tab{flex:1;padding:10px;text-align:center;cursor:pointer;color:#8A93A8;background:none;border:none;font-size:.8rem;font-weight:600;}
            .asist-tab.activa{color:#fff;border-bottom:2px solid #FF3B30;}
            .asist-body{padding:14px 16px;overflow-y:auto;flex:1;}
            .asist-body pre{white-space:pre-wrap;font-family:inherit;font-size:.8rem;line-height:1.5;color:#B7BECD;}
            .asist-body .fila-chat{margin-bottom:10px;}
            .asist-body .fila-chat b{color:#FF8A7A;}
            .asist-footer{padding:10px 12px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:6px;}
            .asist-footer input{flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:.8rem;}
            .asist-footer button{padding:8px 12px;border-radius:8px;border:none;background:#FF3B30;color:#fff;cursor:pointer;font-weight:700;}
            .asist-btn-icono{background:none;border:none;color:#8A93A8;cursor:pointer;font-size:.85rem;}
            .asist-aviso{background:#3A2E00;color:#FFD54A;padding:8px 10px;border-radius:8px;font-size:.75rem;margin-bottom:10px;}
            .asist-ajustes label{display:block;font-size:.75rem;color:#B7BECD;margin-bottom:6px;}
            .asist-ajustes input{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;margin-bottom:10px;}
        </style>

        <button id="btnAsistente" title="Asistente"><i class="fa-solid fa-robot"></i></button>

        <div id="panelAsistente">
            <div class="asist-header">
                <b>Asistente</b>
                <div>
                    <button class="asist-btn-icono" id="btnAjustesAsistente" title="Configurar clave de IA"><i class="fa-solid fa-gear"></i></button>
                    <button class="asist-btn-icono" id="btnCerrarAsistente" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="asist-tabs">
                <button class="asist-tab activa" data-tab="tendencias">Tendencias</button>
                <button class="asist-tab" data-tab="chat">Chat IA</button>
            </div>
            <div class="asist-body" id="asistBody"></div>
            <div class="asist-footer" id="asistFooter" style="display:none;">
                <input id="asistInputChat" type="text" placeholder="Pregunta algo...">
                <button id="asistBtnEnviar">Enviar</button>
            </div>
        </div>
    `;

    document.body.appendChild(contenedor);

    document.getElementById("btnAsistente").addEventListener("click", alternarPanel);
    document.getElementById("btnCerrarAsistente").addEventListener("click", () => alternarPanel(false));
    document.getElementById("btnAjustesAsistente").addEventListener("click", mostrarAjustes);

    contenedor.querySelectorAll(".asist-tab").forEach(tab => {
        tab.addEventListener("click", () => cambiarTab(tab.dataset.tab));
    });

    document.getElementById("asistBtnEnviar").addEventListener("click", enviarPregunta);
    document.getElementById("asistInputChat").addEventListener("keydown", e => {
        if (e.key === "Enter") enviarPregunta();
    });

}

function alternarPanel(forzar) {
    panelAbierto = typeof forzar === "boolean" ? forzar : !panelAbierto;
    document.getElementById("panelAsistente").classList.toggle("abierto", panelAbierto);
    if (panelAbierto) cambiarTab("tendencias");
}

async function cambiarTab(nombre) {

    document.querySelectorAll(".asist-tab").forEach(t =>
        t.classList.toggle("activa", t.dataset.tab === nombre)
    );

    const footer = document.getElementById("asistFooter");
    const body = document.getElementById("asistBody");

    if (nombre === "tendencias") {

        footer.style.display = "none";
        body.innerHTML = `<pre>Calculando...</pre>`;

        const datos = await obtenerDatosParaTendencias();
        ultimasTendencias = calcularTendencias(datos);
        ultimoInvitado = datos.invitado;

        body.innerHTML = `<pre>${escaparHTML(resumenLegible(ultimasTendencias, datos.invitado))}</pre>`;

    } else {

        footer.style.display = "flex";

        if (!localStorage.getItem(CLAVE_API)) {
            body.innerHTML = `
                <div class="asist-aviso">
                    <i class="fa-solid fa-circle-info"></i>
                    Para usar el chat necesitas tu propia clave de Google AI Studio
                    (gratis). Haz clic en el engranaje arriba para configurarla.
                </div>
                <pre>Mientras tanto, la pestaña "Tendencias" funciona sin ninguna clave.</pre>
            `;
        } else if (!body.dataset.chatIniciado) {
            body.innerHTML = `<pre>Pregúntame algo sobre los reportes registrados, o pídeme que registre un censo, una inspección o una emergencia. Nunca guardo nada sin que confirmes cada dato en pantalla primero.</pre>`;
            body.dataset.chatIniciado = "1";
        }

    }

}

function mostrarAjustes() {

    const body = document.getElementById("asistBody");
    const footer = document.getElementById("asistFooter");
    footer.style.display = "none";

    document.querySelectorAll(".asist-tab").forEach(t => t.classList.remove("activa"));

    const claveActual = localStorage.getItem(CLAVE_API) || "";

    body.innerHTML = `
        <div class="asist-ajustes">
            <div class="asist-aviso">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Esta clave se guarda SOLO en este navegador, en este
                dispositivo. Nunca se envía a Anthropic ni se comparte
                con nadie más — se usa directo desde tu navegador hacia
                Google. Cualquiera con acceso físico a este dispositivo
                podría verla. Consíguela gratis en
                <b>aistudio.google.com</b> → "Get API key".
            </div>
            <label>Clave de API de Google AI Studio</label>
            <input type="password" id="inputClaveApi" value="${escaparHTML(claveActual)}" placeholder="AIza...">
            <button id="btnGuardarClave" style="width:100%;padding:10px;border-radius:8px;border:none;background:#FF3B30;color:#fff;font-weight:700;cursor:pointer;">
                Guardar
            </button>
            ${claveActual ? '<button id="btnBorrarClave" style="width:100%;padding:10px;margin-top:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:none;color:#B7BECD;cursor:pointer;">Borrar clave guardada</button>' : ""}
        </div>
    `;

    document.getElementById("btnGuardarClave").addEventListener("click", () => {
        const valor = document.getElementById("inputClaveApi").value.trim();
        if (valor) localStorage.setItem(CLAVE_API, valor);
        cambiarTab("chat");
    });

    const btnBorrar = document.getElementById("btnBorrarClave");
    if (btnBorrar) {
        btnBorrar.addEventListener("click", () => {
            localStorage.removeItem(CLAVE_API);
            cambiarTab("chat");
        });
    }

}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

async function enviarPregunta() {

    const input = document.getElementById("asistInputChat");
    const pregunta = input.value.trim();
    if (!pregunta) return;

    const clave = localStorage.getItem(CLAVE_API);
    if (!clave) {
        mostrarAjustes();
        return;
    }

    const body = document.getElementById("asistBody");
    if (body.querySelector("pre") && !body.querySelector(".fila-chat")) body.innerHTML = "";

    const fila = document.createElement("div");
    fila.className = "fila-chat";
    fila.innerHTML = `<b>Tú:</b> ${escaparHTML(pregunta)}<br><i>Pensando...</i>`;
    body.appendChild(fila);
    body.scrollTop = body.scrollHeight;
    input.value = "";
    input.disabled = true;

    try {

        // Siempre recalcula tendencias frescas como contexto — el chat
        // responde SOLO con base en estos datos agregados, nunca con
        // acceso de escritura ni con instrucciones para modificar nada.
        const datos = await obtenerDatosParaTendencias();
        const tendencias = calcularTendencias(datos);
        const contexto = resumenLegible(tendencias, datos.invitado);

        const respuesta = await preguntarGemini(clave, contexto, pregunta);

        if (CONFIG_PROPUESTAS[respuesta.tipo]) {

            fila.innerHTML = `<b>Tú:</b> ${escaparHTML(pregunta)}<br><b>Asistente:</b> ${escaparHTML(respuesta.texto || "Preparé esta propuesta:")}`;
            renderizarTarjetaPropuesta(respuesta.tipo, respuesta.args, body);

        } else {
            fila.innerHTML = `<b>Tú:</b> ${escaparHTML(pregunta)}<br><b>Asistente:</b> ${escaparHTML(respuesta.texto)}`;
        }

    } catch (err) {

        console.error("[asistente] Error al consultar Gemini:", err);
        fila.innerHTML = `<b>Tú:</b> ${escaparHTML(pregunta)}<br><b>Asistente:</b> No pude responder (${escaparHTML(err.message || "error desconocido")}).`;

    } finally {
        input.disabled = false;
        body.scrollTop = body.scrollHeight;
    }

}

async function preguntarGemini(clave, contexto, pregunta) {

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent?key=${encodeURIComponent(clave)}`;

    const prompt = [
        "Eres un asistente de datos para una estación de bomberos voluntarios en Villamaría, Caldas, Colombia.",
        "Puedes leer y comentar los datos agregados que te doy abajo, y opcionalmente proponer un registro nuevo con una de estas funciones: proponer_censo, proponer_inspeccion, proponer_emergencia — solo si la persona te pide explícitamente registrar o crear uno.",
        "IMPORTANTE: llamar a cualquiera de esas funciones NUNCA guarda nada — solo arma una propuesta que un humano debe confirmar aparte. Nunca digas que \"ya lo registraste\" o \"ya quedó guardado\"; di que dejaste la propuesta lista para confirmar.",
        "Para proponer_emergencia en particular: NUNCA inventes horaReporte, horaLlegada, horaFinal ni vehiculos. Si la persona no los dijo explícitamente, no llames a la función — pídeselos primero en texto.",
        "Para proponer_inspeccion: recuerda que el registro queda sin fotos ni firma (esta función no puede generarlas), es solo un borrador de datos.",
        "No tienes acceso a internet ni puedes buscar información externa (clima, noticias, normativa, nada fuera de estos datos). Si te preguntan algo así, dilo claramente en vez de inventar una respuesta.",
        "Responde en español, en pocas frases, directo al punto.",
        "",
        "Datos agregados actuales:",
        contexto,
        "",
        `Pregunta: ${pregunta}`
    ].join("\n");

    const cuerpo = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: HERRAMIENTAS_ESCRITURA
    });

    // Google satura seguido su capa gratuita de Flash en horas pico
    // (error 503 "high demand" o 429 "rate limit") — son errores
    // pasajeros del lado de Google, no un problema del código ni de la
    // clave. Antes esto se rendía a la primera y mostraba el JSON
    // crudo del error. Ahora reintenta unas pocas veces con espera
    // creciente antes de darse por vencido, y solo para ESTOS dos
    // códigos — un error real (clave inválida, cuota agotada del todo)
    // no se reintenta, se informa de una vez.
    const INTENTOS = 3;
    const ESPERA_BASE_MS = 1200;

    let ultimoError = null;

    for (let intento = 1; intento <= INTENTOS; intento++) {

        let respuesta;

        try {
            respuesta = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: cuerpo
            });
        } catch (errorRed) {
            // Sin conexión u otro fallo de red: no tiene caso reintentar
            // en bucle, el chat necesita internet sí o sí.
            throw new Error("Sin conexión a internet — el chat con IA no funciona sin conexión (a diferencia de Tendencias).");
        }

        if (respuesta.ok) {
            return procesarRespuestaGemini(await respuesta.json());
        }

        const esSaturacion = respuesta.status === 503 || respuesta.status === 429;

        if (!esSaturacion || intento === INTENTOS) {
            const detalle = await respuesta.text().catch(() => "");
            ultimoError = esSaturacion
                ? new Error("Google tiene su servicio de IA saturado en este momento. Intenta de nuevo en un minuto.")
                : new Error(`HTTP ${respuesta.status} ${detalle.slice(0, 120)}`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, ESPERA_BASE_MS * intento));

    }

    throw ultimoError;

}

function procesarRespuestaGemini(datos) {

    const partes = datos?.candidates?.[0]?.content?.parts || [];

    const parteFuncion = partes.find(p => p.functionCall);
    const parteTexto = partes.find(p => p.text)?.text;

    if (parteFuncion) {
        return {
            tipo: parteFuncion.functionCall.name,
            args: parteFuncion.functionCall.args || {},
            texto: parteTexto || ""
        };
    }

    if (!parteTexto) throw new Error("Respuesta vacía del modelo.");

    return { tipo: "texto", texto: parteTexto.trim() };

}

/* ========================================================================
   PROPUESTAS DE REGISTRO — tarjeta de confirmación (genérica)

   Nada de lo que hay aquí escribe en Firestore por sí solo. Solo el
   clic explícito en "Confirmar y guardar" ejecuta la función real de
   guardado del tipo correspondiente.
======================================================================== */

const CONFIG_PROPUESTAS = {

    proponer_censo: {
        titulo: "Propuesta de censo nuevo (sin guardar)",
        icono: "fa-file-circle-plus",
        describir: describirPropuestaCenso,
        confirmar: confirmarYGuardarCenso,
        anuncio: r => `Censo registrado por el asistente. Jefe de hogar: ${r.jefeNombre}.`,
        mensajeExito: r => `Censo <b>${escaparHTML(r.id)}</b> guardado correctamente.`
    },

    proponer_inspeccion: {
        titulo: "Propuesta de inspección nueva (sin fotos ni firma — sin guardar)",
        icono: "fa-building-shield",
        describir: describirPropuestaInspeccion,
        confirmar: confirmarYGuardarInspeccion,
        anuncio: r => `Inspección registrada por el asistente. Establecimiento: ${r.formulario.establecimiento}.`,
        mensajeExito: r => `Inspección <b>${escaparHTML(r.id)}</b> guardada como Pendiente. Complétala con fotos y firma desde el formulario normal cuando puedas.`
    },

    proponer_emergencia: {
        titulo: "Propuesta de reporte de emergencia (sin guardar)",
        icono: "fa-fire-extinguisher",
        describir: describirPropuestaEmergencia,
        confirmar: confirmarYGuardarEmergencia,
        anuncio: r => `Reporte de emergencia registrado por el asistente. Evento: ${r.evento}.`,
        mensajeExito: r => `Emergencia guardada correctamente.`,
        // Este es el único tipo con datos de tiempo operativo real —
        // se le agrega una advertencia extra en la tarjeta para que se
        // revisen las horas con cuidado antes de confirmar, aunque el
        // modelo ya tiene instrucción de no inventarlas.
        avisoExtra: "Revisa que las horas sean exactamente las que dio la persona. El asistente no debería haber inventado ninguna — si algo se ve mal, cancela y regístralo desde el formulario normal."
    }

};

function renderizarTarjetaPropuesta(tipo, args, contenedor) {

    const config = CONFIG_PROPUESTAS[tipo];
    const campos = config.describir(args);

    if (!campos.length) {
        contenedor.innerHTML += `<div class="asist-aviso">El asistente intentó proponer un registro pero no trajo ningún dato utilizable. Intenta describirlo de nuevo con más detalle.</div>`;
        return;
    }

    const tarjeta = document.createElement("div");
    tarjeta.style.cssText = "border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;margin:8px 0;background:rgba(255,255,255,.03);";

    tarjeta.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;color:#FF8A7A;">
            <i class="fa-solid ${config.icono}"></i> ${escaparHTML(config.titulo)}
        </div>
        ${config.avisoExtra ? `<div class="asist-aviso" style="margin-bottom:8px;">${escaparHTML(config.avisoExtra)}</div>` : ""}
        ${campos.map(c => `<div style="font-size:.78rem;margin-bottom:3px;"><b>${escaparHTML(c.etiqueta)}:</b> ${escaparHTML(c.valor)}</div>`).join("")}
        <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn-confirmar-propuesta" style="flex:1;padding:8px;border-radius:8px;border:none;background:#00C874;color:#062;font-weight:700;cursor:pointer;">
                Confirmar y guardar
            </button>
            <button class="btn-cancelar-propuesta" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:none;color:#B7BECD;cursor:pointer;">
                Cancelar
            </button>
        </div>
    `;

    contenedor.appendChild(tarjeta);

    tarjeta.querySelector(".btn-confirmar-propuesta").addEventListener("click", async () => {

        const btn = tarjeta.querySelector(".btn-confirmar-propuesta");
        btn.disabled = true;
        btn.textContent = "Guardando...";

        try {

            const usuario = await new Promise(resolve => {
                const unsub = escucharEstadoAuth(u => { unsub(); resolve(u); });
            });

            const registro = await config.confirmar(args, usuario ? (usuario.email || usuario.uid) : "invitado");

            tarjeta.innerHTML = `<div style="color:#7CFFB2;"><i class="fa-solid fa-circle-check"></i> ${config.mensajeExito(registro)}</div>`;
            anunciar(config.anuncio(registro));

        } catch (err) {
            console.error("[asistente] Error al guardar propuesta confirmada:", err);
            btn.disabled = false;
            btn.textContent = "Confirmar y guardar";
            tarjeta.insertAdjacentHTML("beforeend", `<div style="color:#FF8A7A;font-size:.75rem;margin-top:6px;">No se pudo guardar: ${escaparHTML(err.message || "error desconocido")}</div>`);
        }

    });

    tarjeta.querySelector(".btn-cancelar-propuesta").addEventListener("click", () => {
        tarjeta.innerHTML = `<div style="color:#8A93A8;"><i class="fa-solid fa-ban"></i> Propuesta descartada. No se guardó nada.</div>`;
    });

}

document.addEventListener("DOMContentLoaded", inyectarUI);
