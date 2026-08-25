/* ========================================================================
   PERSISTENCIA.JS
   Módulo Ayudas Humanitarias — Guardado local + sincronización Firestore

   Mismo criterio que censos/persistencia.js: un invitado (sin sesión)
   sí puede registrar entregas y estas SÍ suben a Firestore, pero jamás
   se le pide a Firestore el listado completo — solo ve (y guarda) las
   entregas hechas en este dispositivo.
======================================================================== */

import { APP, state } from "./estado.js";
import {
    generarConsecutivoAyuda,
    guardarAyudaFirestore,
    actualizarAyudaFirestore,
    listarAyudasFirestore,
    eliminarAyudaFirestore
} from "./firebase.js";
import { renderizarListado } from "./listado.js";

function leerListaLocal() {
    try {
        return JSON.parse(localStorage.getItem(APP.STORAGE_KEY_LISTA)) || [];
    } catch {
        return [];
    }
}

function guardarListaLocal(lista) {
    localStorage.setItem(APP.STORAGE_KEY_LISTA, JSON.stringify(lista));
}

function actualizarEnListaLocal(ayuda) {

    const lista = leerListaLocal();
    const indice = lista.findIndex(a => a.id === ayuda.id);

    if (indice >= 0) {
        lista[indice] = ayuda;
    } else {
        lista.unshift(ayuda);
    }

    guardarListaLocal(lista);

}

function quitarDeListaLocal(id) {
    guardarListaLocal(leerListaLocal().filter(a => a.id !== id));
}

/* =========================================================
   CARGAR LISTADO
========================================================= */

export async function cargarAyudas() {

    state.estado.cargando = true;

    try {

        // Invitado: nunca se consulta el listado completo de Firestore,
        // solo lo que este dispositivo guardó.
        state.ayudas = state.invitado
            ? leerListaLocal()
            : await obtenerAyudasConFallback();

    } finally {
        state.estado.cargando = false;
        renderizarListado();
    }

}

async function obtenerAyudasConFallback() {
    try {
        const remotas = await listarAyudasFirestore();
        guardarListaLocal(remotas);
        return remotas;
    } catch (err) {
        console.error("No se pudo listar ayudas desde Firestore, usando copia local:", err);
        return leerListaLocal();
    }
}

/* =========================================================
   GUARDAR (crear o actualizar)
========================================================= */

export async function guardarAyuda(datos) {

    state.estado.guardando = true;

    try {

        let id = state.ayudaId;

        if (!id) {
            id = await generarConsecutivoAyuda().catch(() =>
                `AYU-LOCAL-${Date.now()}`
            );
        }

        const registro = {
            ...datos,
            id,
            usuario: state.usuario || "invitado"
        };

        if (state.editando) {
            await actualizarAyudaFirestore(id, registro);
        } else {
            await guardarAyudaFirestore(id, registro);
        }

        registro.updatedAt = new Date().toISOString();
        actualizarEnListaLocal(registro);

        state.ayudaId = id;
        state.editando = true;

        const indice = state.ayudas.findIndex(a => a.id === id);
        if (indice >= 0) {
            state.ayudas[indice] = registro;
        } else {
            state.ayudas.unshift(registro);
        }
        renderizarListado();

        return registro;

    } finally {
        state.estado.guardando = false;
    }

}

/* =========================================================
   ELIMINAR
========================================================= */

export async function eliminarAyuda(id) {

    await eliminarAyudaFirestore(id).catch(err =>
        console.error("No se pudo eliminar en Firestore (se elimina igual localmente):", err)
    );

    quitarDeListaLocal(id);
    state.ayudas = state.ayudas.filter(a => a.id !== id);
    renderizarListado();

}
