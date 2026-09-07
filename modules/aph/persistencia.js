/* ========================================================================
   PERSISTENCIA.JS — Módulo APH

   Mismo criterio que Ayudas/Censos/Inspecciones: invitados (sin
   sesión) pueden crear pero nunca listan el remoto completo, solo lo
   que este dispositivo guardó. Y aplicado DESDE EL PRIMER DÍA, no
   como parche posterior (ya nos costó tres módulos aprenderlo):

     1) El caché local nunca guarda firmas ni fotos completas — solo
        campos livianos. Firmas/fotos se piden a Firestore cuando de
        verdad se necesitan.
     2) Un fallo al escribir el caché local (localStorage lleno) NUNCA
        debe hacer pensar que "no se pudo guardar/listar" cuando la
        operación real contra Firestore sí funcionó.
======================================================================== */

import { APP, state } from "./estado.js";
import {
    generarConsecutivoAtencion,
    guardarAtencionFirestore,
    actualizarAtencionFirestore,
    listarAtencionesFirestore,
    eliminarAtencionFirestore,
    generarConsecutivoConsentimiento,
    guardarConsentimientoFirestore,
    actualizarConsentimientoFirestore,
    listarConsentimientosFirestore,
    eliminarConsentimientoFirestore
} from "./firebase.js";
import { renderizarListadoAtenciones, renderizarListadoConsentimientos } from "./listado.js";

const CAMPOS_PESADOS_ATENCION = ["firmaRechazoPaciente", "firmaRechazoTestigo"];
const CAMPOS_PESADOS_CONSENTIMIENTO = ["firmaPaciente1", "firmaPaciente2", "firmaPaciente3"];

function aligerar(registro, camposPesados) {
    const copia = { ...registro };
    camposPesados.forEach(campo => delete copia[campo]);
    return copia;
}

/* =========================================================
   CACHÉ LOCAL — genérico para ambas colecciones
========================================================= */

function leerListaLocal(clave) {
    try {
        return JSON.parse(localStorage.getItem(clave)) || [];
    } catch {
        return [];
    }
}

function guardarListaLocal(clave, lista, camposPesados) {
    localStorage.setItem(clave, JSON.stringify(lista.map(r => aligerar(r, camposPesados))));
}

function actualizarEnListaLocal(clave, registro, camposPesados) {

    try {

        const lista = leerListaLocal(clave);
        const indice = lista.findIndex(r => r.id === registro.id);

        if (indice >= 0) {
            lista[indice] = registro;
        } else {
            lista.unshift(registro);
        }

        guardarListaLocal(clave, lista, camposPesados);

    } catch (error) {
        // El registro YA se guardó en Firestore antes de llegar aquí.
        // Un fallo de caché local (cuota llena, modo privado, etc.) no
        // debe interrumpir el flujo ni parecer un error de guardado.
        console.warn(`[aph] No se pudo actualizar el caché local (${clave}), el registro ya está guardado en Firestore:`, error);
    }

}

function quitarDeListaLocal(clave, id, camposPesados) {
    try {
        guardarListaLocal(clave, leerListaLocal(clave).filter(r => r.id !== id), camposPesados);
    } catch (error) {
        console.warn(`[aph] No se pudo actualizar el caché local tras eliminar (${clave}):`, error);
    }
}

/* =========================================================
   ATENCIÓN (historia clínica del traslado)
========================================================= */

export async function cargarAtenciones() {

    state.estado.cargando = true;

    try {

        state.atenciones = state.invitado
            ? leerListaLocal(APP.STORAGE_KEY_ATENCIONES)
            : await obtenerAtencionesConFallback();

    } finally {
        state.estado.cargando = false;
        renderizarListadoAtenciones();
    }

}

async function obtenerAtencionesConFallback() {
    try {

        const remotas = await listarAtencionesFirestore();

        try {
            guardarListaLocal(APP.STORAGE_KEY_ATENCIONES, remotas, CAMPOS_PESADOS_ATENCION);
        } catch (error) {
            console.warn("[aph] No se pudo actualizar el caché local de atenciones (no afecta los datos remotos):", error);
        }

        return remotas;

    } catch (err) {
        console.error("No se pudo listar atenciones desde Firestore, usando copia local:", err);
        return leerListaLocal(APP.STORAGE_KEY_ATENCIONES);
    }
}

export async function guardarAtencion(datos) {

    state.estado.guardando = true;

    try {

        let id = state.atencionId;

        if (!id) {
            id = await generarConsecutivoAtencion().catch(() =>
                `APH-LOCAL-${Date.now()}`
            );
        }

        const registro = {
            ...datos,
            id,
            usuario: state.usuario || "invitado"
        };

        if (state.editandoAtencion) {
            await actualizarAtencionFirestore(id, registro);
        } else {
            registro.uid = state.uid || null;
            await guardarAtencionFirestore(id, registro);
        }

        registro.updatedAt = new Date().toISOString();
        actualizarEnListaLocal(APP.STORAGE_KEY_ATENCIONES, registro, CAMPOS_PESADOS_ATENCION);

        state.atencionId = id;
        state.editandoAtencion = true;

        const indice = state.atenciones.findIndex(a => a.id === id);
        if (indice >= 0) {
            state.atenciones[indice] = registro;
        } else {
            state.atenciones.unshift(registro);
        }
        renderizarListadoAtenciones();

        return registro;

    } finally {
        state.estado.guardando = false;
    }

}

export async function eliminarAtencion(id) {

    await eliminarAtencionFirestore(id).catch(err =>
        console.error("No se pudo eliminar en Firestore (se elimina igual localmente):", err)
    );

    quitarDeListaLocal(APP.STORAGE_KEY_ATENCIONES, id, CAMPOS_PESADOS_ATENCION);
    state.atenciones = state.atenciones.filter(a => a.id !== id);
    renderizarListadoAtenciones();

}

/* =========================================================
   CONSENTIMIENTO INFORMADO
========================================================= */

export async function cargarConsentimientos() {

    state.estado.cargando = true;

    try {

        state.consentimientos = state.invitado
            ? leerListaLocal(APP.STORAGE_KEY_CONSENTIMIENTOS)
            : await obtenerConsentimientosConFallback();

    } finally {
        state.estado.cargando = false;
        renderizarListadoConsentimientos();
    }

}

async function obtenerConsentimientosConFallback() {
    try {

        const remotos = await listarConsentimientosFirestore();

        try {
            guardarListaLocal(APP.STORAGE_KEY_CONSENTIMIENTOS, remotos, CAMPOS_PESADOS_CONSENTIMIENTO);
        } catch (error) {
            console.warn("[aph] No se pudo actualizar el caché local de consentimientos (no afecta los datos remotos):", error);
        }

        return remotos;

    } catch (err) {
        console.error("No se pudo listar consentimientos desde Firestore, usando copia local:", err);
        return leerListaLocal(APP.STORAGE_KEY_CONSENTIMIENTOS);
    }
}

export async function guardarConsentimiento(datos) {

    state.estado.guardando = true;

    try {

        let id = state.consentimientoId;

        if (!id) {
            id = await generarConsecutivoConsentimiento().catch(() =>
                `CONS-LOCAL-${Date.now()}`
            );
        }

        const registro = {
            ...datos,
            id,
            usuario: state.usuario || "invitado"
        };

        if (state.editandoConsentimiento) {
            await actualizarConsentimientoFirestore(id, registro);
        } else {
            registro.uid = state.uid || null;
            await guardarConsentimientoFirestore(id, registro);
        }

        registro.updatedAt = new Date().toISOString();
        actualizarEnListaLocal(APP.STORAGE_KEY_CONSENTIMIENTOS, registro, CAMPOS_PESADOS_CONSENTIMIENTO);

        state.consentimientoId = id;
        state.editandoConsentimiento = true;

        const indice = state.consentimientos.findIndex(c => c.id === id);
        if (indice >= 0) {
            state.consentimientos[indice] = registro;
        } else {
            state.consentimientos.unshift(registro);
        }
        renderizarListadoConsentimientos();

        return registro;

    } finally {
        state.estado.guardando = false;
    }

}

export async function eliminarConsentimiento(id) {

    await eliminarConsentimientoFirestore(id).catch(err =>
        console.error("No se pudo eliminar en Firestore (se elimina igual localmente):", err)
    );

    quitarDeListaLocal(APP.STORAGE_KEY_CONSENTIMIENTOS, id, CAMPOS_PESADOS_CONSENTIMIENTO);
    state.consentimientos = state.consentimientos.filter(c => c.id !== id);
    renderizarListadoConsentimientos();

}
