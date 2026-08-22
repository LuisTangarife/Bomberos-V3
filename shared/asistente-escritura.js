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
import { generarConsecutivo as generarConsecutivoInspeccion, guardarInspeccion as guardarInspeccionFirestore } from "../modules/inspecciones/firebase.js";
import { guardarEmergencia as guardarEmergenciaFirestore } from "../modules/emergencia/firebase.js";

/**
 * Declaración de la única función que Gemini puede "llamar". Llamarla
 * no ejecuta nada por sí sola — solo hace que preguntarGemini() en
 * asistente.js devuelva estos datos para que la interfaz los muestre
 * como propuesta, nunca como hecho consumado.
 */
export const HERRAMIENTAS_ESCRITURA = [{
    functionDeclarations: [
        {
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
                    mascotas: {
                        type: "STRING",
                        description: "Descripción breve de mascotas mencionadas (especie y cantidad), si se dijo algo. Ej: '1 perro'."
                    },
                    observaciones: { type: "STRING", description: "Cualquier detalle adicional relevante que la persona haya mencionado." }
                },
                required: ["jefeNombre"]
            }
        },
        {
            name: "proponer_inspeccion",
            description:
                "Prepara un nuevo registro de INSPECCIÓN a partir de lo que la persona describió. NO guarda nada por sí sola. " +
                "IMPORTANTE — limitación real: una inspección de verdad requiere fotos y firma digital, y esta función no puede generar ninguna de las dos. " +
                "Lo que propone es solo el registro de datos (establecimiento, dirección, tipo), que queda marcado como 'Pendiente' y sin evidencia — el equipo debe completarlo después desde el formulario normal si necesita fotos o firma. " +
                "Úsala solo cuando la persona te haya dado, como mínimo, el nombre del establecimiento a inspeccionar.",
            parameters: {
                type: "OBJECT",
                properties: {
                    establecimiento: { type: "STRING", description: "Nombre del establecimiento o predio a inspeccionar. Obligatorio." },
                    tipoInspeccion: { type: "STRING", description: "Tipo de inspección (ej: comercial, residencial, industrial), si se mencionó." },
                    direccion: { type: "STRING" },
                    barrio: { type: "STRING" },
                    municipio: { type: "STRING", description: "Si no se menciona, asume 'Villamaría'." },
                    propietario: { type: "STRING" },
                    telefono: { type: "STRING" },
                    observaciones: { type: "STRING", description: "Cualquier detalle adicional relevante que la persona haya mencionado." }
                },
                required: ["establecimiento"]
            }
        },
        {
            name: "proponer_emergencia",
            description:
                "Prepara un nuevo reporte de EMERGENCIA a partir de lo que la persona describió. NO guarda nada por sí sola. " +
                "REGLA ABSOLUTA E INNEGOCIABLE: horaReporte, horaLlegada y horaFinal son datos operativos reales que pueden tener peso legal. " +
                "NUNCA los inventes, calcules ni asumas un valor razonable — si la persona no dijo las tres horas explícitamente, NO llames a esta función: " +
                "en su lugar, respóndele en texto pidiéndole las horas exactas que falten. Lo mismo aplica a 'vehiculos' (qué máquina/vehículo respondió): " +
                "si no se mencionó, pregúntalo, no lo adivines.",
            parameters: {
                type: "OBJECT",
                properties: {
                    evento: { type: "STRING", description: "Tipo de evento/incidente (ej: incendio estructural, accidente de tránsito). Obligatorio." },
                    lugar: { type: "STRING", description: "Lugar o referencia general del incidente. Obligatorio." },
                    direccion: { type: "STRING", description: "Dirección exacta, si se mencionó." },
                    fecha: { type: "STRING", description: "Fecha del incidente en formato AAAA-MM-DD. Si no se menciona, usa la fecha de hoy." },
                    horaReporte: { type: "STRING", description: "Hora exacta en que se reportó, en formato HH:MM (24h). SOLO si la persona la dijo explícitamente." },
                    horaLlegada: { type: "STRING", description: "Hora exacta de llegada al lugar, en formato HH:MM (24h). SOLO si la persona la dijo explícitamente." },
                    horaFinal: { type: "STRING", description: "Hora exacta de finalización, en formato HH:MM (24h). SOLO si la persona la dijo explícitamente." },
                    vehiculos: { type: "STRING", description: "Vehículo(s) o máquina(s) que respondieron. SOLO si la persona lo dijo explícitamente." },
                    descripcion: { type: "STRING", description: "Descripción de lo ocurrido. Obligatorio." }
                },
                required: ["evento", "lugar", "horaReporte", "horaLlegada", "horaFinal", "vehiculos", "descripcion"]
            }
        }
    ]
}];

function construirDescriptor(etiquetas) {
    return args => Object.entries(etiquetas)
        .filter(([clave]) => args[clave])
        .map(([clave, etiqueta]) => ({ etiqueta, valor: args[clave] }));
}

/**
 * Traduce los argumentos de cada función a etiquetas legibles, para la
 * tarjeta de confirmación. Si un campo no vino, no se muestra — nunca
 * se rellena con un valor inventado que la persona no dijo.
 */
export const describirPropuestaCenso = construirDescriptor({
    jefeNombre: "Jefe de hogar",
    jefeCedula: "Cédula",
    barrioVereda: "Barrio / Vereda",
    direccion: "Dirección",
    tipoPredio: "Tipo de predio",
    recomendacionEvacuacion: "Recomendación de evacuación",
    mascotas: "Mascotas",
    observaciones: "Observaciones"
});

export const describirPropuestaInspeccion = construirDescriptor({
    establecimiento: "Establecimiento",
    tipoInspeccion: "Tipo de inspección",
    direccion: "Dirección",
    barrio: "Barrio",
    municipio: "Municipio",
    propietario: "Propietario",
    telefono: "Teléfono",
    observaciones: "Observaciones"
});

export const describirPropuestaEmergencia = construirDescriptor({
    evento: "Evento",
    lugar: "Lugar",
    direccion: "Dirección",
    fecha: "Fecha",
    horaReporte: "Hora de reporte",
    horaLlegada: "Hora de llegada",
    horaFinal: "Hora final",
    vehiculos: "Vehículo(s)",
    descripcion: "Descripción"
});

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
        observaciones: [args.mascotas ? `Mascotas: ${args.mascotas}.` : "", args.observaciones || ""].join(" ").trim(),
        integrantes: [],
        mascotas: [],
        usuario: usuarioActual || "invitado",
        // Marca de trazabilidad: para que el equipo pueda distinguir
        // después qué registros se crearon por el asistente de IA en
        // vez del formulario normal.
        creadoPorAsistenteIA: true
    };

    await guardarCensoFirestore(id, registro);

    return registro;

}

export async function confirmarYGuardarInspeccion(args, usuarioActual) {

    const id = await generarConsecutivoInspeccion().catch(() => `INS-ASISTENTE-${Date.now()}`);

    const registro = {
        id,
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        usuario: usuarioActual || "invitado",
        formulario: {
            numeroInspeccion: id,
            // Nunca "Finalizada" — sin fotos ni firma, esto no es una
            // inspección terminada, es un borrador de datos que el
            // equipo debe completar desde el formulario normal.
            estado: "Pendiente",
            tipoInspeccion: args.tipoInspeccion || "",
            municipio: args.municipio || "Villamaría",
            establecimiento: args.establecimiento || "",
            direccion: args.direccion || "",
            barrio: args.barrio || "",
            propietario: args.propietario || "",
            telefono: args.telefono || "",
            observaciones: args.observaciones || ""
        },
        fotos: [],
        firmas: null,
        creadoPorAsistenteIA: true
    };

    await guardarInspeccionFirestore(id, registro);

    return registro;

}

export async function confirmarYGuardarEmergencia(args, usuarioActual) {

    const id = crypto.randomUUID();

    const registro = {
        evento: args.evento || "",
        lugar: args.lugar || "",
        direccion: args.direccion || "",
        fecha: args.fecha || new Date().toISOString().slice(0, 10),
        horaReporte: args.horaReporte || "",
        horaLlegada: args.horaLlegada || "",
        horaFinal: args.horaFinal || "",
        vehiculos: args.vehiculos || "",
        descripcion: args.descripcion || "",
        numFotos: 0,
        usuario: usuarioActual || "invitado",
        creadoPorAsistenteIA: true
    };

    await guardarEmergenciaFirestore(id, registro);

    return { ...registro, id };

}
