/* =========================================================
   FIREBASE - AYUDAS HUMANITARIAS

   CRUD contra Firestore, colección "ayudas_humanitarias".
   Documentos livianos (texto plano, sin fotos), mismo criterio
   que Censos.
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
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/* =========================================================
   CONSECUTIVO
========================================================= */

export async function generarConsecutivoAyuda() {

    const contadorRef = doc(db, "contadores", "ayudas_humanitarias");

    return await runTransaction(db, async (transaction) => {

        const contador = await transaction.get(contadorRef);

        let ultimo = 0;
        if (contador.exists()) {
            ultimo = contador.data().ultimo || 0;
        }

        ultimo++;

        transaction.set(contadorRef, { ultimo }, { merge: true });

        return `AYU-${String(ultimo).padStart(5, "0")}`;

    });

}

/* =========================================================
   CRUD AYUDAS HUMANITARIAS (FIRESTORE)
========================================================= */

export async function guardarAyudaFirestore(id, datos) {

    await setDoc(
        doc(db, "ayudas_humanitarias", id),
        {
            ...datos,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function actualizarAyudaFirestore(id, datos) {

    // setDoc con merge (no updateDoc): si el documento nunca llegó a
    // crearse en Firestore por una falla de red anterior, se crea solo
    // en vez de fallar con "No document to update".
    await setDoc(
        doc(db, "ayudas_humanitarias", id),
        {
            ...datos,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

}

export async function obtenerAyudaFirestore(id) {

    const documento = await getDoc(doc(db, "ayudas_humanitarias", id));

    if (!documento.exists()) return null;

    return { id: documento.id, ...documento.data() };

}

export async function listarAyudasFirestore() {

    const consulta = query(
        collection(db, "ayudas_humanitarias"),
        orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocs(consulta);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

}

export async function eliminarAyudaFirestore(id) {

    await deleteDoc(doc(db, "ayudas_humanitarias", id));

}
