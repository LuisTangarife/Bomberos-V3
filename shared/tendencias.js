/* ========================================================================
   TENDENCIAS.JS
   Motor de estadísticas locales — sin IA, sin costo, sin conexión.

   Mismo criterio de acceso que el resto de la app: un invitado (sin
   sesión) solo ve las tendencias de lo que este dispositivo guardó
   (localStorage/IndexedDB). Con sesión, se consulta Firestore completo.
======================================================================== */

import { db, auth } from "../firebase/config.js";
import {
    collection, getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function leerLocalStorageLista(clave) {
    try {
        return JSON.parse(localStorage.getItem(clave)) || [];
    } catch {
        return [];
    }
}

function leerEmergenciasLocalesIDB() {

    return new Promise(resolve => {

        try {

            const req = indexedDB.open("BomberosDB", 1);

            req.onupgradeneeded = e => {
                // Base de datos nueva (nunca se ha guardado nada aquí
                // todavía) — crear el almacén vacío para no fallar, y
                // resolver con lista vacía.
                e.target.result.createObjectStore("reportes", { keyPath: "id", autoIncrement: true });
            };

            req.onsuccess = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("reportes")) return resolve([]);
                const tx = db.transaction("reportes", "readonly");
                const store = tx.objectStore("reportes");
                const getAll = store.getAll();
                getAll.onsuccess = () => resolve(getAll.result || []);
                getAll.onerror = () => resolve([]);
            };

            req.onerror = () => resolve([]);

        } catch {
            resolve([]);
        }

    });

}

async function esInvitado() {
    return new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(usuario => {
            unsub();
            resolve(!usuario);
        });
    });
}

async function listarFirestore(nombreColeccion) {
    try {
        const snapshot = await getDocs(collection(db, nombreColeccion));
        return snapshot.docs.map(d => d.data());
    } catch (err) {
        console.error(`No se pudo listar ${nombreColeccion} para tendencias:`, err);
        return [];
    }
}

/**
 * Reúne los tres tipos de registros (censos, inspecciones, emergencias),
 * respetando la regla invitado = solo local.
 */
export async function obtenerDatosParaTendencias() {

    const invitado = await esInvitado();

    if (invitado) {
        const emergenciasIDB = await leerEmergenciasLocalesIDB();
        return {
            invitado: true,
            censos: leerLocalStorageLista("censos_guardados"),
            inspecciones: leerLocalStorageLista("inspecciones_guardadas"),
            emergencias: emergenciasIDB
        };
    }

    const [censos, inspecciones, emergencias] = await Promise.all([
        listarFirestore("censos"),
        listarFirestore("inspecciones"),
        listarFirestore("emergencias")
    ]);

    return { invitado: false, censos, inspecciones, emergencias };

}

function contarPor(lista, obtenerClave) {

    const conteo = {};

    lista.forEach(item => {
        const clave = obtenerClave(item) || "Sin especificar";
        conteo[clave] = (conteo[clave] || 0) + 1;
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1]);

}

function mesDeFecha(fecha) {

    if (!fecha) return null;

    let d;
    if (typeof fecha === "number") d = new Date(fecha);
    else if (fecha?.toDate) d = fecha.toDate(); // Firestore Timestamp
    else d = new Date(fecha);

    if (isNaN(d.getTime())) return null;

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;

}

/**
 * Calcula tendencias simples a partir de los datos crudos. Nada de esto
 * llama a un modelo de lenguaje — es conteo y ordenamiento puro.
 */
export function calcularTendencias(datos) {

    const { censos, inspecciones, emergencias } = datos;

    return {

        totales: {
            censos: censos.length,
            inspecciones: inspecciones.length,
            emergencias: emergencias.length
        },

        emergenciasPorTipo: contarPor(emergencias, e => e.evento),
        emergenciasPorMes: contarPor(emergencias, e => mesDeFecha(e.fecha || e.createdAt)),
        emergenciasPorLugar: contarPor(emergencias, e => e.lugar),

        inspeccionesPorTipo: contarPor(inspecciones, i => i.formulario?.tipoInspeccion),
        inspeccionesPorMes: contarPor(inspecciones, i => mesDeFecha(i.fechaCreacion)),

        censosPorUbicacion: contarPor(censos, c => c.barrioVereda),
        censosConEvacuacion: censos.filter(c => c.recomendacionEvacuacion === "SI").length

    };

}

/**
 * Texto plano legible, listo para mostrar en el panel o para pasarle
 * como contexto a un chat con IA (sin exponer datos crudos innecesarios).
 */
export function resumenLegible(tendencias, invitado) {

    const lineas = [];

    lineas.push(invitado
        ? "Modo invitado — estas cifras son solo de este dispositivo."
        : "Cifras de todos los dispositivos (sesión iniciada).");

    lineas.push(`Emergencias registradas: ${tendencias.totales.emergencias}`);
    if (tendencias.emergenciasPorTipo.length) {
        const [top] = tendencias.emergenciasPorTipo;
        lineas.push(`  Tipo más frecuente: ${top[0]} (${top[1]})`);
    }
    if (tendencias.emergenciasPorLugar.length) {
        const [top] = tendencias.emergenciasPorLugar;
        lineas.push(`  Lugar más frecuente: ${top[0]} (${top[1]})`);
    }

    lineas.push(`Inspecciones registradas: ${tendencias.totales.inspecciones}`);
    if (tendencias.inspeccionesPorTipo.length) {
        const [top] = tendencias.inspeccionesPorTipo;
        lineas.push(`  Tipo más frecuente: ${top[0]} (${top[1]})`);
    }

    lineas.push(`Censos registrados: ${tendencias.totales.censos}`);
    if (tendencias.censosPorUbicacion.length) {
        const [top] = tendencias.censosPorUbicacion;
        lineas.push(`  Ubicación más frecuente: ${top[0]} (${top[1]})`);
    }
    if (tendencias.censosConEvacuacion > 0) {
        lineas.push(`  Con recomendación de evacuación: ${tendencias.censosConEvacuacion}`);
    }

    return lineas.join("\n");

}
