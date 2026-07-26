/* =========================================================
   FIREBASE - EMERGENCIAS

   CRUD contra Firestore para el "Gestor de Emergencias":
   permite que las emergencias registradas desde cualquier
   dispositivo (celular, tablet, PC de la estación, etc.)
   aparezcan consolidadas en un solo listado, en vez de quedar
   encerradas en el localStorage/IndexedDB de cada equipo.

   Este archivo NO reemplaza el guardado local (IndexedDB) ni
   el envío al Google Apps Script existente: se suma como una
   tercera copia, pensada solo para alimentar el listado
   consolidado. Por eso el documento principal que se guarda
   aquí es liviano (sin fotos ni el PDF en base64): eso evita
   chocar con el límite de 1MB por documento de Firestore y
   hace que listar el consolidado sea rápido en cualquier
   dispositivo.
========================================================= */

import {
    db
}
from "../../firebase/config.js";

import {
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    collection,
    query,
    orderBy,
    getDocs,
    writeBatch,
    serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const COLECCION = "emergencias";

/* =========================================================
   FOTOS DE EVIDENCIA (SUBCOLECCIÓN DE FIRESTORE)

   No se usa Firebase Storage: en el plan gratuito (Spark) de
   Firebase, Storage requiere pasar a plan de pago (Blaze) para
   habilitar el bucket. Firestore sí funciona en el plan
   gratuito, así que cada foto se guarda como un documento
   aparte en emergencias/{id}/fotos/{n} — así el documento
   principal (el que lista el Gestor) sigue liviano, y cada
   foto individual queda muy por debajo del límite de 1MB por
   documento de Firestore.

   Las fotos se comprimen en el navegador (ver comprimirFoto()
   en app.js) antes de llegar aquí, así que ya vienen livianas;
   aun así cada una va en su propio documento por seguridad.
========================================================= */

/**
 * Guarda el arreglo de fotos (data URLs base64, ya comprimidas)
 * de una emergencia en la subcolección emergencias/{id}/fotos.
 * Best-effort por foto: si una puntual falla (por peso u otra
 * razón), se omite en vez de tumbar el guardado completo del
 * reporte.
 */
export async function guardarFotosEmergencia(id, fotos) {

    if (!Array.isArray(fotos) || !fotos.length) return;

    const lote = writeBatch(db);

    fotos.forEach((fotoDataUrl, indice) => {

        lote.set(
            doc(db, COLECCION, id, "fotos", String(indice)),
            {
                data: fotoDataUrl,
                orden: indice
            }
        );

    });

    try {

        await lote.commit();

    } catch (error) {

        console.error(
            "[emergencias] No se pudieron guardar las fotos en Firestore:",
            error
        );

    }

}

/**
 * Trae las fotos de evidencia de una emergencia (se usa al abrir
 * la galería desde el Gestor, no al listar — así el listado
 * general no se pone lento cargando imágenes de reportes que
 * nadie está mirando).
 */
export async function obtenerFotosEmergencia(id) {

    const consulta = query(
        collection(db, COLECCION, id, "fotos"),
        orderBy("orden", "asc")
    );

    const snapshot = await getDocs(consulta);

    return snapshot.docs
        .map(documento => documento.data().data)
        .filter(Boolean);

}

/**
 * Borra todas las fotos de evidencia de una emergencia. Se usa
 * al eliminar la emergencia del consolidado para no dejar
 * documentos huérfanos en la subcolección.
 */
export async function eliminarFotosEmergencia(id) {

    const snapshot = await getDocs(
        collection(db, COLECCION, id, "fotos")
    );

    if (snapshot.empty) return;

    const lote = writeBatch(db);

    snapshot.docs.forEach(documento => lote.delete(documento.ref));

    await lote.commit();

}

/* =========================================================
   CRUD EMERGENCIAS (FIRESTORE)
========================================================= */

/**
 * Crea (o sobreescribe) el documento de una emergencia en
 * Firestore. Al usar setDoc({merge:true}) con un id ya
 * conocido, si por alguna razón el documento ya existiera
 * (reintento tras un corte de conexión, por ejemplo) no se
 * duplica ni se pierde información: simplemente se completa.
 */
export async function guardarEmergencia(id, datos) {

    await setDoc(

        doc(db, COLECCION, id),

        {

            ...datos,

            createdAt: serverTimestamp(),

            updatedAt: serverTimestamp()

        },

        {

            merge: true

        }

    );

}

/**
 * Igual que guardarEmergencia(), pero sin tocar createdAt: se
 * usa cuando la emergencia ya existía y solo se está
 * actualizando (por ejemplo, al reintentar la sincronización
 * de un reporte que había quedado pendiente).
 */
export async function actualizarEmergencia(id, datos) {

    await setDoc(

        doc(db, COLECCION, id),

        {

            ...datos,

            updatedAt: serverTimestamp()

        },

        {

            merge: true

        }

    );

}

export async function obtenerEmergencia(id) {

    const documento = await getDoc(
        doc(db, COLECCION, id)
    );

    if (!documento.exists()) return null;

    return {
        id: documento.id,
        ...documento.data()
    };

}

/**
 * Trae TODAS las emergencias registradas por cualquier
 * dispositivo, ordenadas de la más reciente a la más antigua.
 * Esto es lo que consolida el "Gestor de Emergencias": no
 * importa desde qué celular/computador se haya guardado cada
 * reporte, todas quedan en la misma colección de Firestore.
 *
 * OJO: esto NO trae las fotos (viven en la subcolección
 * emergencias/{id}/fotos) — solo numFotos, para poder mostrar
 * el botón "Fotos (n)" sin tener que descargar imágenes de
 * todos los reportes con cada carga del listado.
 */
export async function listarEmergencias() {

    const consulta = query(
        collection(db, COLECCION),
        orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocs(consulta);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

}

export async function eliminarEmergencia(id) {

    // Se intenta borrar primero las fotos (subcolección); si eso
    // falla no se bloquea el borrado del documento principal.
    try {

        await eliminarFotosEmergencia(id);

    } catch (error) {

        console.error(
            "[emergencias] No se pudieron borrar las fotos:",
            error
        );

    }

    await deleteDoc(
        doc(db, COLECCION, id)
    );

}

export {
    db
};
