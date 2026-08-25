/* =========================================================
   PERSONAL-CUERPO.JS
   CRUD del personal del Cuerpo de Bomberos contra Firestore
   (colección "personal_cuerpo"). Mismo criterio que unidades.js:
     - dashboard.js (Panel General): alta, edición de estado y borrado.
     - modules/emergencia/app.js: para poblar el selector de personal
       del formulario con la nómina real en vez de la lista fija que
       traía el HTML (esa lista se conserva como respaldo sin conexión).

   Nombre de archivo/colección distinto de "personal" a propósito,
   para no chocar con el <select id="personal"> oculto que ya existe
   en modules/emergencia/index.html (ese es HTML, esto es Firestore;
   viven en espacios distintos, pero se evita la confusión).
========================================================= */

import { db } from "../firebase/config.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const COLECCION = "personal_cuerpo";

export const ESTADOS_PERSONAL = [
    { valor: "Disponible", clase: "disponible" },
    { valor: "En servicio", clase: "servicio" },
    { valor: "Franco", clase: "mantenimiento" },
    { valor: "Fuera de servicio", clase: "fuera" }
];

export function claseEstadoPersonal(estado) {
    return ESTADOS_PERSONAL.find(e => e.valor === estado)?.clase || "mantenimiento";
}

export async function listarPersonalCuerpo() {

    const consulta = query(collection(db, COLECCION), orderBy("nombre"));
    const snapshot = await getDocs(consulta);

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

}

export async function crearPersonaCuerpo({ nombre, estado = "Disponible" }) {

    const ref = doc(collection(db, COLECCION));

    await setDoc(ref, {
        nombre: nombre.trim().toUpperCase(),
        estado,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return ref.id;

}

export async function actualizarPersonaCuerpo(id, datos) {

    await updateDoc(doc(db, COLECCION, id), {
        ...datos,
        updatedAt: serverTimestamp()
    });

}

export async function eliminarPersonaCuerpo(id) {

    await deleteDoc(doc(db, COLECCION, id));

}
