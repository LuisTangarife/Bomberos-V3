/* ========================================================================
   ESTADO.JS — Módulo APH (Atención Prehospitalaria)

   Dos tipos de registro conviven en este módulo, cada uno con su
   propio listado y su propia colección en Firestore:
     - "atencion"      -> Historia clínica del traslado (FT-AMB)
     - "consentimiento" -> Consentimiento informado (FT-AMB-001)

   Es la misma decisión que ya tomamos juntos: "dentro de APH debe
   estar otra opción para el consentimiento informado" — una pestaña
   dentro del mismo módulo, con su propio listado independiente, no un
   campo más del formulario de atención.
======================================================================== */

export const APP = {
    STORAGE_KEY_ATENCIONES: "aph_atenciones_guardadas",
    STORAGE_KEY_CONSENTIMIENTOS: "aph_consentimientos_guardados"
};

export const state = {

    usuario: null,
    invitado: true,
    uid: null,

    // Cuál pestaña está activa: "atencion" | "consentimiento"
    vista: "atencion",

    // ---- Atención (historia clínica del traslado) ----
    atenciones: [],
    atencionId: null,
    editandoAtencion: false,

    // Firmas de la atención: solo aplica si el paciente rechaza el
    // traslado (sección "Exoneración de responsabilidades").
    firmas: {
        rechazoPaciente: null,
        rechazoTestigo: null,
        recibe: null
    },

    // Lesiones marcadas en el cuerpo 3D — ver modules/aph/cuerpo3d.js
    lesiones: [],

    // ---- Consentimiento informado ----
    consentimientos: [],
    consentimientoId: null,
    editandoConsentimiento: false,

    // Hasta 3 firmantes, igual que el formato en papel (todos
    // etiquetados "Firma del paciente" ahí, aunque en la práctica
    // suele ser paciente + acompañante/testigo).
    firmasConsentimiento: [null, null, null],

    estado: {
        cargando: false,
        guardando: false
    }

};
