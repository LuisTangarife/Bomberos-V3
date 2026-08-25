/* =========================================================
   UNIDADES.JS
   CRUD de la flota de vehículos/unidades del Cuerpo de Bomberos
   contra Firestore (colección "unidades"). Se usa desde:
     - dashboard.js (Panel General): alta, edición de estado y borrado.
     - modules/emergencia/app.js: para poblar el selector de vehículos
       del formulario con la flota real en vez de la lista fija que
       traía el HTML (esa lista se conserva como respaldo sin conexión).
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

const COLECCION = "unidades";

// Mismo criterio visual que las etiquetas .unit-tag ya existentes en
// el Panel General (dashboard.css): cada estado tiene su clase de
// color. "fuera" es nueva (rojo institucional, --primary).
export const ESTADOS_UNIDAD = [
    { valor: "Disponible", clase: "disponible" },
    { valor: "En servicio", clase: "servicio" },
    { valor: "Mantenimiento", clase: "mantenimiento" },
    { valor: "Fuera de servicio", clase: "fuera" }
];

export function claseEstadoUnidad(estado) {
    return ESTADOS_UNIDAD.find(e => e.valor === estado)?.clase || "mantenimiento";
}

export async function listarUnidades() {

    const consulta = query(collection(db, COLECCION), orderBy("nombre"));
    const snapshot = await getDocs(consulta);

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

}

export async function crearUnidad({ nombre, tripulantes = 0, estado = "Disponible" }) {

    const ref = doc(collection(db, COLECCION));

    await setDoc(ref, {
        nombre: nombre.trim(),
        tripulantes: Number(tripulantes) || 0,
        estado,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return ref.id;

}

export async function actualizarUnidad(id, datos) {

    await updateDoc(doc(db, COLECCION, id), {
        ...datos,
        updatedAt: serverTimestamp()
    });

}

export async function eliminarUnidad(id) {

    await deleteDoc(doc(db, COLECCION, id));

}
