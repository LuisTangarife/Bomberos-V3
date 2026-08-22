/* ========================================================================
   ASISTENTE-ESCRITURA.JS
   Fase 2 del asistente — el chat puede PROPONER un censo nuevo, nunca
   guardarlo directo. La escritura real solo ocurre cuando la persona
   hace clic en "Confirmar" sobre la tarjeta que muestra exactamente
   los campos que se van a guardar.

   Alcance de esta entrega, a propósito limitado:
   - Solo CREAR censos nuevos. No edita registros existentes (eso
     necesita buscar y desambiguar entre varios, es una pieza aparte).
   - No toca Inspecciones ni Emergencia — Emergencia en particular
     maneja datos operativos con horas exactas que no deberían salir
     de una inferencia de lenguaje natural sin más controles.

   Reutiliza directo las funciones de modules/censos/firebase.js (no
   pasan por el estado del módulo Censos ni por el DOM), así que se
   puede importar desde cualquier página sin arrastrar todo el módulo.
======================================================================== */

import { generarConsecutivoCenso, guardarCensoFirestore } from "../modules/censos/firebase.js";

/**
 * Declaración de la única función que Gemini puede "llamar". Llamarla
 * no ejecuta nada por sí sola — solo hace que preguntarGemini() en
 * asistente.js devuelva estos datos para que la interfaz los muestre
 * como propuesta, nunca como hecho consumado.
 */
export const HERRAMIENTAS_ESCRITURA = [{
    functionDeclarations: [{
        name: "proponer_censo",
        description:
            "Prepara un nuevo registro de censo de damnificados a partir de lo que la persona describió en el chat. " +
            "Esto NO guarda nada — solo arma una propuesta que un humano debe confirmar explícitamente antes de que se escriba en la base de datos. " +
            "Úsala solo cuando la persona te haya dado, como mínimo, el nombre del jefe de hogar y describa que quiere REGISTRAR o CREAR un censo nuevo. " +
            "Si falta información importante, primero pregúntale a la persona en vez de inventar datos.",
        parameters: {
            type: "OBJECT",
            properties: {
                jefeNombre: { type: "STRING", description: "Nombre completo del jefe del núcleo familiar. Obligatorio." },
                jefeCedula: { type: "STRING", description: "Número de cédula del jefe de hogar, si se mencionó." },
                barrioVereda: { type: "STRING", description: "Barrio o vereda de Villamaría donde está la vivienda." },
                direccion: { type: "STRING", description: "Dirección del predio, si se mencionó." },
                tipoPredio: {
                    type: "STRING",
                    enum: ["Vivienda", "Comercial", "Mixto", "Otro"],
                    description: "Tipo de predio. Si no se menciona, asume 'Vivienda'."
                },
                recomendacionEvacuacion: {
                    type: "STRING",
                    enum: ["SI", "NO"],
                    description: "Si la persona indica que hay riesgo y se recomienda evacuar, usa 'SI'. Si no se menciona nada de esto, usa 'NO'."
                },
                observaciones: { type: "STRING", description: "Cualquier detalle adicional relevante que la persona haya mencionado." }
            },
            required: ["jefeNombre"]
        }
    }]
}];

/**
 * Traduce los argumentos de la función a etiquetas legibles, para la
 * tarjeta de confirmación. Si un campo no vino, no se muestra —  nunca
 * se rellena con un valor inventado que la persona no dijo.
 */
export function describirPropuestaCenso(args) {

    const etiquetas = {
        jefeNombre: "Jefe de hogar",
        jefeCedula: "Cédula",
        barrioVereda: "Barrio / Vereda",
        direccion: "Dirección",
        tipoPredio: "Tipo de predio",
        recomendacionEvacuacion: "Recomendación de evacuación",
        observaciones: "Observaciones"
    };

    return Object.entries(etiquetas)
        .filter(([clave]) => args[clave])
        .map(([clave, etiqueta]) => ({ etiqueta, valor: args[clave] }));

}

/**
 * Ejecuta la escritura real. Solo se debe llamar después de que la
 * persona hizo clic en "Confirmar" — nunca automáticamente.
 */
export async function confirmarYGuardarCenso(args, usuarioActual) {

    const id = await generarConsecutivoCenso().catch(() => `CEN-ASISTENTE-${Date.now()}`);

    const registro = {
        id,
        jefeNombre: args.jefeNombre || "",
        jefeCedula: args.jefeCedula || "",
        barrioVereda: args.barrioVereda || "",
        direccion: args.direccion || "",
        tipoPredio: args.tipoPredio || "Vivienda",
        recomendacionEvacuacion: args.recomendacionEvacuacion || "NO",
        observaciones: args.observaciones || "",
        integrantes: [],
        usuario: usuarioActual || "invitado",
        // Marca de trazabilidad: para que el equipo pueda distinguir
        // después qué registros se crearon por el asistente de IA en
        // vez del formulario normal.
        creadoPorAsistenteIA: true
    };

    await guardarCensoFirestore(id, registro);

    return registro;

}
