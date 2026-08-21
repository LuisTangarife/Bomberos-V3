/* ========================================================================
   ESTADO.JS
   Sistema de Inspecciones — Configuración y estado global
======================================================================== */

export const APP = {
    VERSION: "3.1.0",
    AUTOSAVE_DELAY: 1200,
    MAX_FOTOS: 50,
    STORAGE_KEY: "inspeccion_borrador",
    STORAGE_KEY_LISTA: "inspecciones_guardadas",
    STORAGE_KEY_CONSECUTIVO: "inspecciones_consecutivo",
    SCROLL_OFFSET: 80,
    DEBUG: false,

    // Firebase Storage requiere el plan de pago (Blaze) del proyecto.
    // Mientras el proyecto siga en el plan gratuito (Spark), Storage no
    // está habilitado y cualquier intento de subir algo ahí se queda
    // reintentando varios segundos/minutos antes de fallar; eso es lo
    // que hacía sentir colgado el botón "Guardar Inspección". Con esto
    // en false, las fotos se guardan directo como base64 dentro del
    // documento de Firestore (persistencia.js y fotos.js respetan este
    // flag). El día que se habilite Storage (facturación activada),
    // basta con volver a poner esto en true.
    USAR_STORAGE: false
};

export const state = {

    // Autoguardado
    ultimoGuardado: null,
    hayCambios: false,
    ultimaSerializacion: "",
    autosaveTimer: null,

    // Wizard
    pasoActual: 0,
    totalPasos: 0,
    form: null,

    // Sesión / inspección actual
    usuario: null,

    // true si nadie inició sesión en este dispositivo (ver app.js). El
    // formulario funciona igual, pero persistencia.js usa esta bandera
    // para no pedirle nunca a Firestore el listado completo — solo
    // muestra (y guarda) lo que este dispositivo creó.
    invitado: false,
    inspeccionId: null,
    editando: false,
    seleccionada: null,

    // Listado de inspecciones
    inspecciones: [],

    // Fotografías
    fotos: [],

    // Fotos que el usuario quitó del formulario y que, si ya estaban
    // subidas a Storage (tienen "url"), hay que borrar de Storage al
    // guardar. Se vacía después de cada guardado exitoso.
    fotosEliminadas: [],

    // Firmas
    firmas: {
        inspector: null,
        propietario: null
    },

    // Canvas de firmas
    canvas: {
        inspector: null,
        propietario: null
    },

    // Indicadores de actividad
    estado: {
        cargando: false,
        guardando: false,
        sincronizando: false
    },

    ultimaSincronizacion: null,

    // Caché de inspecciones por id
    cache: {
        inspecciones: new Map()
    }

};
