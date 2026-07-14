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
   consolidado. Por eso el documento que se guarda aquí es
   liviano (sin fotos ni el PDF en base64): eso evita chocar
   con el límite de 1MB por documento de Firestore y hace que
   listar el consolidado sea rápido en cualquier dispositivo.
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
    serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const COLECCION = "emergencias";

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

    await deleteDoc(
        doc(db, COLECCION, id)
    );

}

export {
    db
};
