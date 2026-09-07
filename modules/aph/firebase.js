/* =========================================================
   FIREBASE - APH (Atención Prehospitalaria)

   Dos colecciones independientes:
     - "aph_atenciones"       (historia clínica del traslado)
     - "aph_consentimientos"  (consentimiento informado)

   getDocsFromServer (no getDocs) desde el primer día en ambos
   listados: con persistentSingleTabManager({ forceOwnership: true })
   (ver firebase/config.js), la página que se acaba de abrir puede
   tomar el control del caché local antes de que termine de
   sincronizar con el servidor, y una consulta normal puede devolver
   "0 resultados" aunque sí existan datos — nos costó tres módulos
   distintos aprenderlo, esta vez se aplica de entrada.
========================================================= */

import { db } from "../../firebase/config.js";

import {
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    collection,
    query,
    orderBy,
    getDocsFromServer,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/* =========================================================
   CONSECUTIVOS
========================================================= */

async function generarConsecutivo(nombreContador, prefijo) {

    const contadorRef = doc(db, "contadores", nombreContador);

    return await runTransaction(db, async (transaction) => {

        const contador = await transaction.get(contadorRef);

        let ultimo = 0;
        if (contador.exists()) {
            ultimo = contador.data().ultimo || 0;
        }

        ultimo++;

        transaction.set(contadorRef, { ultimo }, { merge: true });

        return `${prefijo}-${String(ultimo).padStart(5, "0")}`;

    });

}

export function generarConsecutivoAtencion() {
    return generarConsecutivo("aph_atenciones", "APH");
}

export function generarConsecutivoConsentimiento() {
    return generarConsecutivo("aph_consentimientos", "CONS");
}

/* =========================================================
   CRUD — ATENCIÓN (historia clínica del traslado)
========================================================= */

export async function guardarAtencionFirestore(id, datos) {

    await setDoc(
        doc(db, "aph_atenciones", id),
        {
            ...datos,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function actualizarAtencionFirestore(id, datos) {

    await setDoc(
        doc(db, "aph_atenciones", id),
        {
            ...datos,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function obtenerAtencionFirestore(id) {

    const documento = await getDoc(doc(db, "aph_atenciones", id));

    if (!documento.exists()) return null;

    return { id: documento.id, ...documento.data() };

}

export async function listarAtencionesFirestore() {

    const consulta = query(
        collection(db, "aph_atenciones"),
        orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocsFromServer(consulta);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

}

export async function eliminarAtencionFirestore(id) {

    await deleteDoc(doc(db, "aph_atenciones", id));

}

/* =========================================================
   CRUD — CONSENTIMIENTO INFORMADO
========================================================= */

export async function guardarConsentimientoFirestore(id, datos) {

    await setDoc(
        doc(db, "aph_consentimientos", id),
        {
            ...datos,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function actualizarConsentimientoFirestore(id, datos) {

    await setDoc(
        doc(db, "aph_consentimientos", id),
        {
            ...datos,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function obtenerConsentimientoFirestore(id) {

    const documento = await getDoc(doc(db, "aph_consentimientos", id));

    if (!documento.exists()) return null;

    return { id: documento.id, ...documento.data() };

}

export async function listarConsentimientosFirestore() {

    const consulta = query(
        collection(db, "aph_consentimientos"),
        orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocsFromServer(consulta);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

}

export async function eliminarConsentimientoFirestore(id) {

    await deleteDoc(doc(db, "aph_consentimientos", id));

}
