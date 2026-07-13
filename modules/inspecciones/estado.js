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
    DEBUG: false
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
