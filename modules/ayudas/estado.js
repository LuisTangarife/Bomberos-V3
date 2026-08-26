/* ========================================================================
   ESTADO.JS
   Módulo Ayudas Humanitarias — Configuración y estado global

   Formato base: "Formato de Entrega de Kit — Emergencia por evento
   sísmico" (Alcaldía de Villamaría, Secretaría de Desarrollo Social).
   Mismo patrón de acceso que Censos/Inspecciones/Emergencia:
   formulario de una sola página, guardado local siempre, más
   sincronización a Firestore cuando hay conexión.
======================================================================== */

export const APP = {
    STORAGE_KEY_LISTA: "ayudas_guardadas",
    DEBUG: false
};

export const TIPOS_KIT = [
    "Kit Alimentario",
    "Kit Aseo",
    "Kit Cocina",
    "Kit Noche",
    "Kit Mascota"
];

export const state = {

    // Sesión / invitado (mismo patrón que los demás módulos): sin
    // cuenta, la entrega igual se guarda y sincroniza a Firestore,
    // pero el listado que ve este dispositivo es solo el propio.
    usuario: null,
    invitado: false,

    ayudaId: null,
    editando: false,

    // Listado local de entregas ya guardadas en este dispositivo
    ayudas: [],

    // Firmas digitales (canvas) — mismo mecanismo que Inspecciones
    canvas: {
        beneficiario: null,
        responsable: null
    },
    firmas: {
        beneficiario: null,
        responsable: null
    },

    // Foto única de evidencia de la entrega (base64), mismo mecanismo
    // que las firmas: sin Firebase Storage, viaja dentro del documento.
    foto: null,

    estado: {
        cargando: false,
        guardando: false
    }

};
