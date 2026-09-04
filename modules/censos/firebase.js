/* =========================================================
   FIREBASE - CENSOS

   CRUD contra Firestore, colección "censos". Documentos
   livianos (texto plano, sin fotos), muy por debajo del
   límite de 1MB por documento — no requiere Firebase Storage
   ni subcolecciones, a diferencia de Inspecciones/Emergencia.
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
    getDocs,
    getDocsFromServer,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/* =========================================================
   CONSECUTIVO
========================================================= */

export async function generarConsecutivoCenso() {

    const contadorRef = doc(db, "contadores", "censos");

    return await runTransaction(db, async (transaction) => {

        const contador = await transaction.get(contadorRef);

        let ultimo = 0;
        if (contador.exists()) {
            ultimo = contador.data().ultimo || 0;
        }

        ultimo++;

        transaction.set(contadorRef, { ultimo }, { merge: true });

        return `CEN-${String(ultimo).padStart(5, "0")}`;

    });

}

/* =========================================================
   CRUD CENSOS (FIRESTORE)
========================================================= */

export async function guardarCensoFirestore(id, datos) {

    await setDoc(
        doc(db, "censos", id),
        {
            ...datos,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function actualizarCensoFirestore(id, datos) {

    // setDoc con merge (no updateDoc): si el documento nunca llegó a
    // crearse en Firestore por una falla de red anterior, se crea solo
    // en vez de fallar con "No document to update" — mismo criterio
    // que actualizarInspeccion() en inspecciones/firebase.js.
    await setDoc(
        doc(db, "censos", id),
        {
            ...datos,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function obtenerCensoFirestore(id) {

    const documento = await getDoc(doc(db, "censos", id));

    if (!documento.exists()) return null;

    return { id: documento.id, ...documento.data() };

}

export async function listarCensosFirestore() {

    const consulta = query(
        collection(db, "censos"),
        orderBy("updatedAt", "desc")
    );

    // getDocsFromServer (no getDocs): mismo motivo que en
    // modules/ayudas/firebase.js. Con persistentSingleTabManager({
    // forceOwnership: true }) (ver firebase/config.js), la página que
    // se acaba de abrir puede tomar el control del caché local antes
    // de que termine de sincronizar con el servidor, y una consulta
    // normal puede devolver "0 resultados" aunque sí existan datos.
    const snapshot = await getDocsFromServer(consulta);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

}

export async function eliminarCensoFirestore(id) {

    await deleteDoc(doc(db, "censos", id));

}
