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

// Firmas y foto pueden pesar varios cientos de KB en base64 cada una.
// El navegador tiene una cuota de localStorage muchísimo más chica que
// el límite de 1 MiB por documento de Firestore (típicamente 5-10 MiB
// EN TOTAL para todo el sitio, no por registro) — guardar el listado
// completo con firmas y foto de cada entrega ahí revienta esa cuota
// después de relativamente pocos registros. Por eso el caché local
// solo guarda los datos livianos (para poder listar sin conexión);
// las firmas y la foto se piden a Firestore bajo demanda cuando de
// verdad se necesitan (editar un registro puntual o generar su PDF).
const CAMPOS_PESADOS = ["firmaBeneficiario", "firmaResponsable", "foto"];

function aligerarParaCache(ayuda) {
    const copia = { ...ayuda };
    CAMPOS_PESADOS.forEach(campo => delete copia[campo]);
    return copia;
}

function leerListaLocal() {
    try {
        return JSON.parse(localStorage.getItem(APP.STORAGE_KEY_LISTA)) || [];
    } catch {
        return [];
    }
}

function guardarListaLocal(lista) {
    localStorage.setItem(APP.STORAGE_KEY_LISTA, JSON.stringify(lista.map(aligerarParaCache)));
}

function actualizarEnListaLocal(ayuda) {

    try {

        const lista = leerListaLocal();
        const indice = lista.findIndex(a => a.id === ayuda.id);

        if (indice >= 0) {
            lista[indice] = ayuda;
        } else {
            lista.unshift(ayuda);
        }

        guardarListaLocal(lista);

    } catch (error) {
        // El registro YA se guardó en Firestore antes de llegar aquí
        // (esto se llama después, ver guardarAyuda). Si el caché local
        // falla — cuota de localStorage llena, modo privado del
        // navegador, etc. — no se debe interrumpir el flujo ni
        // mostrarle al usuario un error de "no se pudo guardar" que en
        // realidad es solo del espejo local, no de la entrega en sí.
        console.warn("[ayudas] No se pudo actualizar el caché local (el registro ya está guardado en Firestore):", error);
    }

}

function quitarDeListaLocal(id) {
    try {
        guardarListaLocal(leerListaLocal().filter(a => a.id !== id));
    } catch (error) {
        console.warn("[ayudas] No se pudo actualizar el caché local tras eliminar:", error);
    }
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
        try {
            guardarListaLocal(remotas);
        } catch (error) {
            console.warn("[ayudas] No se pudo actualizar el caché local del listado (no afecta los datos remotos):", error);
        }
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
            // uid solo se fija al crear — ver la misma nota en
            // censos/persistencia.js.
            registro.uid = state.uid || null;
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
