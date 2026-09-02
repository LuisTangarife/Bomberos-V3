/* ========================================================================
   PERSISTENCIA.JS
   Módulo Censos — Guardado local + sincronización con Firestore

   Mismo criterio que inspecciones/persistencia.js: un invitado (sin
   sesión) sí puede guardar censos y estos SÍ suben a Firestore, pero
   jamás se le pide a Firestore el listado completo — solo ve (y
   guarda) los censos hechos en este dispositivo.
======================================================================== */

import { APP, state } from "./estado.js";
import {
    generarConsecutivoCenso,
    guardarCensoFirestore,
    actualizarCensoFirestore,
    listarCensosFirestore,
    eliminarCensoFirestore
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

function actualizarEnListaLocal(censo) {

    const lista = leerListaLocal();
    const indice = lista.findIndex(c => c.id === censo.id);

    if (indice >= 0) {
        lista[indice] = censo;
    } else {
        lista.unshift(censo);
    }

    guardarListaLocal(lista);

}

function quitarDeListaLocal(id) {
    guardarListaLocal(leerListaLocal().filter(c => c.id !== id));
}

/* =========================================================
   CARGAR LISTADO
========================================================= */

export async function cargarCensos() {

    state.estado.cargando = true;

    try {

        // Invitado: nunca se consulta el listado completo de Firestore,
        // solo lo que este dispositivo guardó.
        state.censos = state.invitado
            ? leerListaLocal()
            : await obtenerCensosConFallback();

    } finally {
        state.estado.cargando = false;
        renderizarListado();
    }

}

async function obtenerCensosConFallback() {
    try {
        const remotos = await listarCensosFirestore();
        guardarListaLocal(remotos);
        return remotos;
    } catch (err) {
        console.error("No se pudo listar censos desde Firestore, usando copia local:", err);
        return leerListaLocal();
    }
}

/* =========================================================
   GUARDAR (crear o actualizar)
========================================================= */

export async function guardarCenso(datos) {

    state.estado.guardando = true;

    try {

        let id = state.censoId;

        if (!id) {
            id = await generarConsecutivoCenso().catch(() =>
                `CEN-LOCAL-${Date.now()}`
            );
        }

        const registro = {
            ...datos,
            id,
            usuario: state.usuario || "invitado"
        };

        if (state.editando) {
            await actualizarCensoFirestore(id, registro);
        } else {
            // uid solo se fija al crear. Si luego alguien con cuenta
            // real corrige este censo, NO debe pisar el uid del
            // invitado que lo creó — eso es lo que permite que su
            // dueño original lo siga pudiendo editar después.
            registro.uid = state.uid || null;
            await guardarCensoFirestore(id, registro);
        }

        registro.updatedAt = new Date().toISOString();
        actualizarEnListaLocal(registro);

        state.censoId = id;
        state.editando = true;

        // Refresca el listado en memoria sin depender de Firestore
        // (importa sobre todo para el invitado, que nunca lo consulta).
        const indice = state.censos.findIndex(c => c.id === id);
        if (indice >= 0) {
            state.censos[indice] = registro;
        } else {
            state.censos.unshift(registro);
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

export async function eliminarCenso(id) {

    await eliminarCensoFirestore(id).catch(err =>
        console.error("No se pudo eliminar en Firestore (se elimina igual localmente):", err)
    );

    quitarDeListaLocal(id);
    state.censos = state.censos.filter(c => c.id !== id);
    renderizarListado();

}
