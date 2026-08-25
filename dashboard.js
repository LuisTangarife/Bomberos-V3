/*============================================
 PANEL GENERAL — CENTRO DE OPERACIONES
=============================================*/

import { protegerPagina } from "./shared/auth.js";
import {
    listarUnidades,
    crearUnidad,
    actualizarUnidad,
    eliminarUnidad,
    ESTADOS_UNIDAD,
    claseEstadoUnidad
} from "./shared/unidades.js";
import {
    listarPersonalCuerpo,
    crearPersonaCuerpo,
    actualizarPersonaCuerpo,
    eliminarPersonaCuerpo,
    ESTADOS_PERSONAL,
    claseEstadoPersonal
} from "./shared/personalCuerpo.js";

document.addEventListener("DOMContentLoaded", async () => {

    await protegerPagina();

    renderSidebar("dashboard");

    renderHeader("Panel General");

    iniciarSistema();

    cargarDashboard();

    cargarUnidades();
    cargarPersonalCuerpo();
    configurarFormulariosRecursos();
    configurarAccionesRecursos();

});

/*=============================================
 CARGAR DATOS
=============================================*/

// APH, Ayudas y Censos no tienen todavía una colección real en
// Firestore (los botones de esas secciones en el sidebar solo abren
// un alert "Próximamente") — así que sus tarjetas se marcan como
// "sin módulo activo" en vez de mostrar un número, real o inventado.
// Antes esas tres tarjetas (y las otras dos) mostraban un número fijo
// escrito directo en el HTML — nunca venía de ningún dato real.
function marcarSinDatos(idContador, mensaje = "Módulo sin datos aún") {

    const el = document.getElementById(idContador);
    if (!el) return;

    el.textContent = "—";

    const nota = el.parentElement?.querySelector("span");
    if (nota) nota.textContent = mensaje;

}

async function cargarDashboard(){

    marcarSinDatos("totalAPH");
    marcarSinDatos("totalAyudas");
    marcarSinDatos("totalCensos");

    try {

        const [{ listarEmergencias }, { listarInspecciones }] = await Promise.all([
            import("./modules/emergencia/firebase.js"),
            import("./modules/inspecciones/firebase.js")
        ]);

        const [emergencias, inspecciones] = await Promise.all([
            listarEmergencias().catch(error => {
                console.error("[dashboard] No se pudieron cargar emergencias:", error);
                return null;
            }),
            listarInspecciones().catch(error => {
                console.error("[dashboard] No se pudieron cargar inspecciones:", error);
                return null;
            })
        ]);

        if (Array.isArray(emergencias)) {

            const inicioMes = new Date();
            inicioMes.setDate(1);
            inicioMes.setHours(0, 0, 0, 0);

            const esteMes = emergencias.filter(e => {
                const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.fecha || "");
                if (!match) return false;
                const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
                return fecha >= inicioMes;
            }).length;

            document.getElementById("totalEmergencias").textContent = esteMes;

        } else {

            marcarSinDatos("totalEmergencias", "No se pudo cargar (revisa conexión)");

        }

        if (Array.isArray(inspecciones)) {

            document.getElementById("totalInspecciones").textContent = inspecciones.length;

        } else {

            marcarSinDatos("totalInspecciones", "No se pudo cargar (revisa conexión)");

        }

    } catch (error) {

        console.error("[dashboard] Error cargando datos reales del panel:", error);

    }

    // Anima SOLO los contadores que sí quedaron con un número real
    // ("—" no es numérico, así que animarContadores() ya lo ignora).
    animarContadores();

}

/*=============================================
 ANIMACIÓN DE CONTADORES (efecto de telemetría)
=============================================*/

function animarContadores(){

    const contadores = document.querySelectorAll(".stat-card h2[id]");

    contadores.forEach((el) => {

        const destino = parseInt(el.textContent, 10);

        if (isNaN(destino)) return;

        const duracion = 900;
        const inicio = performance.now();

        function paso(ahora){
            const progreso = Math.min((ahora - inicio) / duracion, 1);
            const valor = Math.round(destino * progreso);
            el.textContent = valor;
            if (progreso < 1) requestAnimationFrame(paso);
        }

        el.textContent = "0";
        requestAnimationFrame(paso);

    });

}

/*=============================================
 NAVEGACIÓN
=============================================*/

function abrirEmergencias() {
    location.href = "modules/emergencia/gestor.html";
}

function abrirAPH(){

    alert("Próximamente");

}

function abrirAyudas(){

    alert("Próximamente");

}

function abrirInspecciones(){

    location.href = "modules/inspecciones/index.html";

}

function abrirEstadisticas(){

    location.href = "modules/estadisticas/index.html";

}

/*=============================================
 UNIDADES Y PERSONAL (Panel General)
 Antes eran 4 tarjetas de unidades escritas fijas en el HTML, sin
 ninguna base de datos detrás: no se podían agregar, editar ni
 borrar, y el formulario de Emergencia tampoco las veía (tenía su
 propia lista fija, por separado). Ahora ambas viven en Firestore
 ("unidades" y "personal_cuerpo") y las lee también el formulario de
 Emergencia (ver modules/emergencia/app.js), así que agregar/borrar/
 cambiar el estado de una unidad o de una persona aquí se refleja
 allá.
=============================================*/

function escaparTexto(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

// Envuelve una promesa con un límite de tiempo. Sin esto, en datos
// móviles con señal débil una lectura de Firestore puede quedar
// "esperando" varios minutos sin dar éxito NI error — la pantalla se
// queda en "Cargando..." para siempre porque la promesa nunca se
// resuelve ni se rechaza. Con el timeout, a los 10s se rechaza igual
// y el catch de cargarUnidades()/cargarPersonalCuerpo() puede mostrar
// un mensaje útil ("revisa tu conexión" + reintentar) en vez de dejar
// al usuario mirando un "Cargando..." que nunca cambia.
function conTimeout(promesa, ms = 10000) {
    return Promise.race([
        promesa,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms)
        )
    ]);
}

async function cargarUnidades() {

    const contenedor = document.getElementById("unidadesLista");
    if (!contenedor) return;

    try {

        const unidades = await conTimeout(listarUnidades());
        renderizarUnidades(unidades);

    } catch (error) {

        console.error("[dashboard] No se pudieron cargar las unidades:", error);
        contenedor.innerHTML = `
            <p class="unit-vacio">
                No se pudo cargar la flota (conexión lenta o sin internet).
                <a href="#" class="unit-reintentar" data-tipo="unidad">Reintentar</a>
            </p>
        `;

    }

}

function renderizarUnidades(unidades) {

    const contenedor = document.getElementById("unidadesLista");
    if (!contenedor) return;

    if (!unidades.length) {
        contenedor.innerHTML = `<p class="unit-vacio">Aún no hay unidades registradas. Agrega la primera abajo.</p>`;
        return;
    }

    contenedor.innerHTML = unidades.map(u => `
        <div class="unit-row" data-id="${u.id}">
            <i class="fa-solid fa-truck-medical unit-icon"></i>
            <div class="unit-info">
                <div class="unit-name">${escaparTexto(u.nombre)}</div>
                <div class="unit-crew">${Number(u.tripulantes) || 0} tripulantes</div>
            </div>
            <select class="unit-estado-select ${claseEstadoUnidad(u.estado)}" data-id="${u.id}" data-tipo="unidad">
                ${ESTADOS_UNIDAD.map(e => `<option value="${e.valor}" ${e.valor === u.estado ? "selected" : ""}>${e.valor}</option>`).join("")}
            </select>
            <button type="button" class="unit-borrar" data-id="${u.id}" data-tipo="unidad" title="Eliminar unidad">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join("");

}

async function cargarPersonalCuerpo() {

    const contenedor = document.getElementById("personalLista");
    if (!contenedor) return;

    try {

        const personal = await conTimeout(listarPersonalCuerpo());
        renderizarPersonalCuerpo(personal);

    } catch (error) {

        console.error("[dashboard] No se pudo cargar el personal:", error);
        contenedor.innerHTML = `
            <p class="unit-vacio">
                No se pudo cargar el personal (conexión lenta o sin internet).
                <a href="#" class="unit-reintentar" data-tipo="persona">Reintentar</a>
            </p>
        `;

    }

}

function renderizarPersonalCuerpo(personal) {

    const contenedor = document.getElementById("personalLista");
    if (!contenedor) return;

    if (!personal.length) {
        contenedor.innerHTML = `<p class="unit-vacio">Aún no hay personal registrado. Agrega el primero abajo.</p>`;
        return;
    }

    contenedor.innerHTML = personal.map(p => `
        <div class="unit-row" data-id="${p.id}">
            <i class="fa-solid fa-user unit-icon"></i>
            <div class="unit-info">
                <div class="unit-name">${escaparTexto(p.nombre)}</div>
            </div>
            <select class="unit-estado-select ${claseEstadoPersonal(p.estado)}" data-id="${p.id}" data-tipo="persona">
                ${ESTADOS_PERSONAL.map(e => `<option value="${e.valor}" ${e.valor === p.estado ? "selected" : ""}>${e.valor}</option>`).join("")}
            </select>
            <button type="button" class="unit-borrar" data-id="${p.id}" data-tipo="persona" title="Eliminar persona">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join("");

}

function configurarFormulariosRecursos() {

    const formUnidad = document.getElementById("formNuevaUnidad");

    formUnidad?.addEventListener("submit", async (e) => {

        e.preventDefault();

        const nombre = document.getElementById("nuevaUnidadNombre").value.trim();
        const tripulantes = document.getElementById("nuevaUnidadTripulantes").value;

        if (!nombre) return;

        try {

            await crearUnidad({ nombre, tripulantes });
            formUnidad.reset();
            cargarUnidades();

        } catch (error) {

            console.error("[dashboard] No se pudo guardar la unidad:", error);
            alert("No se pudo guardar la unidad. Revisa tu conexión.");

        }

    });

    const formPersona = document.getElementById("formNuevaPersona");

    formPersona?.addEventListener("submit", async (e) => {

        e.preventDefault();

        const nombre = document.getElementById("nuevaPersonaNombre").value.trim();

        if (!nombre) return;

        try {

            await crearPersonaCuerpo({ nombre });
            formPersona.reset();
            cargarPersonalCuerpo();

        } catch (error) {

            console.error("[dashboard] No se pudo guardar la persona:", error);
            alert("No se pudo guardar la persona. Revisa tu conexión.");

        }

    });

}

// Delegación de eventos: los selects de estado y los botones de
// borrar se regeneran cada vez que se recarga la lista, así que se
// enganchan una sola vez sobre "document" en vez de reenlazarlos
// cada render.
function configurarAccionesRecursos() {

    document.addEventListener("click", async (e) => {

        const reintentar = e.target.closest(".unit-reintentar");
        if (reintentar) {
            e.preventDefault();
            if (reintentar.dataset.tipo === "unidad") {
                cargarUnidades();
            } else {
                cargarPersonalCuerpo();
            }
            return;
        }

    });

    document.addEventListener("change", async (e) => {

        const select = e.target.closest(".unit-estado-select");
        if (!select) return;

        const { id, tipo } = select.dataset;
        const nuevoEstado = select.value;

        try {

            if (tipo === "unidad") {
                await actualizarUnidad(id, { estado: nuevoEstado });
                select.className = `unit-estado-select ${claseEstadoUnidad(nuevoEstado)}`;
            } else {
                await actualizarPersonaCuerpo(id, { estado: nuevoEstado });
                select.className = `unit-estado-select ${claseEstadoPersonal(nuevoEstado)}`;
            }

        } catch (error) {

            console.error("[dashboard] No se pudo actualizar el estado:", error);
            alert("No se pudo actualizar el estado. Revisa tu conexión.");

        }

    });

    document.addEventListener("click", async (e) => {

        const boton = e.target.closest(".unit-borrar");
        if (!boton) return;

        const { id, tipo } = boton.dataset;
        const etiqueta = tipo === "unidad" ? "esta unidad" : "esta persona";

        if (!confirm(`¿Eliminar ${etiqueta}? Esta acción no se puede deshacer.`)) return;

        try {

            if (tipo === "unidad") {
                await eliminarUnidad(id);
                cargarUnidades();
            } else {
                await eliminarPersonaCuerpo(id);
                cargarPersonalCuerpo();
            }

        } catch (error) {

            console.error("[dashboard] No se pudo eliminar:", error);
            alert("No se pudo eliminar. Revisa tu conexión.");

        }

    });

}

/*=============================================
 EXPOSICIÓN GLOBAL (necesaria por el atributo
 "onclick" de index.html)
=============================================*/
// dashboard.js se carga como <script type="module">, así que las
// funciones declaradas arriba viven en el scope del módulo, NO en
// "window". Los "onclick" en HTML solo pueden llamar funciones que
// existan en el scope global (window), así que sin estas líneas
// "abrirInspecciones()" (y las demás) fallan con
// "ReferenceError: abrirInspecciones is not defined" y el botón no
// hace nada. Por eso solo funcionaban los botones que tenían la
// navegación escrita directo en el onclick (ej:
// onclick="location.href='...'"), y no los que llamaban a una función.
window.abrirEmergencias = abrirEmergencias;
window.abrirAPH = abrirAPH;
window.abrirAyudas = abrirAyudas;
window.abrirInspecciones = abrirInspecciones;
window.abrirEstadisticas = abrirEstadisticas;
