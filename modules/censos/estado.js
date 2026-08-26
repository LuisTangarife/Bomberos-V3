/* ========================================================================
   ESTADO.JS
   Módulo Censos — Configuración y estado global

   Formato base: "Censo para Damnificados" (Sistema Nacional de Gestión
   del Riesgo de Desastres — Gobernación de Caldas). Sigue el mismo
   patrón de Emergencias: formulario de una sola página (sin wizard por
   pasos), guardado local (localStorage) siempre, más sincronización a
   Firestore cuando hay conexión.
======================================================================== */

export const APP = {
    STORAGE_KEY_LISTA: "censos_guardados",
    DEBUG: false
};

export const state = {

    // Sesión / invitado (mismo patrón que Inspecciones y Emergencia):
    // sin cuenta, el censo igual se guarda y sincroniza a Firestore,
    // pero el listado que ve este dispositivo es solo el propio, nunca
    // el consolidado de todos los usuarios.
    usuario: null,
    invitado: false,

    censoId: null,
    editando: false,

    // Filas dinámicas del núcleo familiar (tabla del punto 3 del PDF)
    integrantes: [],

    // Listado local de censos ya guardados en este dispositivo
    censos: [],

    // Firmas digitales (canvas) — mismo mecanismo que Ayudas/Inspecciones
    canvas: {
        funcionario: null,
        encuestado: null
    },
    firmas: {
        funcionario: null,
        encuestado: null
    },

    estado: {
        cargando: false,
        guardando: false
    }

};
