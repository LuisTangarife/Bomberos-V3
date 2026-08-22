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

const CLAVE_API = "asistente_gemini_key";
const MODELO_GEMINI = "gemini-2.0-flash";

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
            body.innerHTML = `<pre>Pregúntame algo sobre los reportes registrados. Solo leo datos — nunca creo ni modifico nada.</pre>`;
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
        fila.innerHTML = `<b>Tú:</b> ${escaparHTML(pregunta)}<br><b>Asistente:</b> ${escaparHTML(respuesta)}`;

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
        "SOLO puedes leer y comentar los datos agregados que te doy abajo. NUNCA sugieras comandos, código, ni instrucciones para crear, editar o borrar registros — no tienes esa capacidad.",
        "Responde en español, en pocas frases, directo al punto.",
        "",
        "Datos agregados actuales:",
        contexto,
        "",
        `Pregunta: ${pregunta}`
    ].join("\n");

    const respuesta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => "");
        throw new Error(`HTTP ${respuesta.status} ${detalle.slice(0, 120)}`);
    }

    const datos = await respuesta.json();
    const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) throw new Error("Respuesta vacía del modelo.");

    return texto.trim();

}

document.addEventListener("DOMContentLoaded", inyectarUI);
