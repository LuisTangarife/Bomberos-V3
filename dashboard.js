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
import {
    REGISTRO_CATALOGOS,
    listarCatalogo,
    sembrarCatalogo,
    agregarItemCatalogo,
    eliminarItemCatalogo
} from "./shared/catalogos.js";

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

    inicializarCatalogos();
    calcularAlertas();
    cargarBitacora();

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

    try {

        const [
            { listarEmergencias },
            { listarInspecciones },
            { listarCensosFirestore },
            { listarAyudasFirestore }
        ] = await Promise.all([
            import("./modules/emergencia/firebase.js"),
            import("./modules/inspecciones/firebase.js"),
            import("./modules/censos/firebase.js"),
            import("./modules/ayudas/firebase.js")
        ]);

        const [emergencias, inspecciones, censos, ayudas] = await Promise.all([
            listarEmergencias().catch(error => {
                console.error("[dashboard] No se pudieron cargar emergencias:", error);
                return null;
            }),
            listarInspecciones().catch(error => {
                console.error("[dashboard] No se pudieron cargar inspecciones:", error);
                return null;
            }),
            listarCensosFirestore().catch(error => {
                console.error("[dashboard] No se pudieron cargar censos:", error);
                return null;
            }),
            listarAyudasFirestore().catch(error => {
                console.error("[dashboard] No se pudieron cargar ayudas humanitarias:", error);
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

        if (Array.isArray(censos)) {

            document.getElementById("totalCensos").textContent = censos.length;

        } else {

            marcarSinDatos("totalCensos", "No se pudo cargar (revisa conexión)");

        }

        if (Array.isArray(ayudas)) {

            // "Entregadas" se refiere a kits entregados, no a número de
            // registros — una misma familia puede aparecer en varias
            // entregas (kit alimentario, kit aseo, etc.), así que el
            // conteo útil aquí es la suma de cantidadEntregada.
            const totalKits = ayudas.reduce(
                (suma, a) => suma + (Number(a.cantidadEntregada) || 0),
                0
            );

            document.getElementById("totalAyudas").textContent = totalKits;

        } else {

            marcarSinDatos("totalAyudas", "No se pudo cargar (revisa conexión)");

        }

    } catch (error) {

        console.error("[dashboard] Error cargando datos reales del panel:", error);

        marcarSinDatos("totalEmergencias", "No se pudo cargar (revisa conexión)");
        marcarSinDatos("totalInspecciones", "No se pudo cargar (revisa conexión)");
        marcarSinDatos("totalCensos", "No se pudo cargar (revisa conexión)");
        marcarSinDatos("totalAyudas", "No se pudo cargar (revisa conexión)");

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
        actualizarDialDisponibilidad(unidades);

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
 CATÁLOGOS DE LOS MÓDULOS (Panel General)
 Antes cada módulo tenía sus opciones de <select> escritas fijas en
 su propio HTML — agregar un tipo de evento nuevo significaba editar
 código. Ahora viven en Firestore ("catalogos") y este panel es la
 única pantalla para gestionarlos todos, sin importar el módulo.
=============================================*/

let catalogoActual = null; // { modulo, campo, etiqueta, agrupable }

function inicializarCatalogos() {

    const selector = document.getElementById("selectorCatalogo");
    if (!selector) return;

    selector.innerHTML = REGISTRO_CATALOGOS.map(c =>
        `<option value="${c.modulo}__${c.campo}">${escaparTexto(c.etiqueta)}</option>`
    ).join("");

    selector.addEventListener("change", () => seleccionarCatalogo(selector.value));

    const formNuevoItem = document.getElementById("formNuevoItemCatalogo");
    formNuevoItem?.addEventListener("submit", manejarAgregarItemCatalogo);

    document.getElementById("btnSembrarCatalogo")
        ?.addEventListener("click", manejarSembrarCatalogo);

    // Delegación: los botones de borrar se regeneran en cada render.
    document.getElementById("catalogoItemsLista")
        ?.addEventListener("click", manejarBorrarItemCatalogo);

    if (REGISTRO_CATALOGOS.length) {
        seleccionarCatalogo(`${REGISTRO_CATALOGOS[0].modulo}__${REGISTRO_CATALOGOS[0].campo}`);
    }

}

async function seleccionarCatalogo(claveCompuesta) {

    const [modulo, campo] = claveCompuesta.split("__");
    const info = REGISTRO_CATALOGOS.find(c => c.modulo === modulo && c.campo === campo);
    if (!info) return;

    catalogoActual = info;

    const inputGrupo = document.getElementById("nuevoItemGrupo");
    if (inputGrupo) inputGrupo.style.display = info.agrupable ? "block" : "none";

    const lista = document.getElementById("catalogoItemsLista");
    if (lista) lista.innerHTML = `<p class="unit-vacio">Cargando...</p>`;

    try {

        const items = await listarCatalogo(modulo, campo);
        renderizarCatalogoActual(items);

    } catch (error) {

        console.error("[dashboard] No se pudo cargar el catálogo:", error);
        if (lista) {
            lista.innerHTML = `<p class="unit-vacio">No se pudo cargar (revisa conexión).</p>`;
        }

    }

}

function renderizarCatalogoActual(items) {

    const lista = document.getElementById("catalogoItemsLista");
    const aviso = document.getElementById("catalogoVacioAviso");
    if (!lista || !catalogoActual) return;

    if (!items.length) {

        lista.innerHTML = `<p class="unit-vacio">Este catálogo está vacío.</p>`;
        if (aviso) aviso.style.display = "block";
        return;

    }

    if (aviso) aviso.style.display = "none";

    // Agrupar visualmente si el catálogo lo permite (ej: Tipo de
    // evento agrupado por INCENDIOS/RESCATE/...), plano si no.
    if (catalogoActual.agrupable) {

        const grupos = new Map();
        items.forEach(item => {
            const clave = item.grupo || "Sin grupo";
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(item);
        });

        lista.innerHTML = [...grupos.entries()].map(([grupo, itemsGrupo]) => `
            <div class="catalogo-grupo">
                <div class="catalogo-grupo-nombre">${escaparTexto(grupo)}</div>
                ${itemsGrupo.map(filaItemCatalogo).join("")}
            </div>
        `).join("");

    } else {

        lista.innerHTML = items.map(filaItemCatalogo).join("");

    }

}

function filaItemCatalogo(item) {
    return `
        <div class="unit-row">
            <i class="fa-solid fa-tag unit-icon"></i>
            <div class="unit-info">
                <div class="unit-name">${escaparTexto(item.valor)}</div>
            </div>
            <button type="button" class="unit-borrar" data-valor="${escaparTexto(item.valor)}" title="Quitar del catálogo">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
}

async function manejarSembrarCatalogo() {

    if (!catalogoActual) return;

    const boton = document.getElementById("btnSembrarCatalogo");
    if (boton) { boton.disabled = true; boton.textContent = "Cargando..."; }

    try {

        const items = await sembrarCatalogo(catalogoActual.modulo, catalogoActual.campo);
        renderizarCatalogoActual(items);

    } catch (error) {

        console.error("[dashboard] No se pudo cargar la semilla del catálogo:", error);
        alert("No se pudo cargar los valores actuales. Revisa tu conexión.");

    } finally {

        if (boton) {
            boton.disabled = false;
            boton.innerHTML = '<i class="fa-solid fa-download"></i> Cargar los valores actuales para poder editarlos';
        }

    }

}

async function manejarAgregarItemCatalogo(e) {

    e.preventDefault();
    if (!catalogoActual) return;

    const inputValor = document.getElementById("nuevoItemValor");
    const inputGrupo = document.getElementById("nuevoItemGrupo");

    const valor = inputValor?.value.trim();
    if (!valor) return;

    try {

        const items = await agregarItemCatalogo(
            catalogoActual.modulo,
            catalogoActual.campo,
            valor,
            catalogoActual.agrupable ? (inputGrupo?.value.trim() || "") : ""
        );

        renderizarCatalogoActual(items);
        document.getElementById("formNuevoItemCatalogo")?.reset();

    } catch (error) {

        alert(error.message || "No se pudo agregar la opción.");

    }

}

async function manejarBorrarItemCatalogo(e) {

    const boton = e.target.closest(".unit-borrar");
    if (!boton || !catalogoActual) return;

    const valor = boton.dataset.valor;
    if (!confirm(`¿Quitar "${valor}" del catálogo? Los registros que ya usan este valor no se modifican, solo deja de aparecer para elegir en formularios nuevos.`)) return;

    try {

        const items = await eliminarItemCatalogo(catalogoActual.modulo, catalogoActual.campo, valor);
        renderizarCatalogoActual(items);

    } catch (error) {

        console.error("[dashboard] No se pudo quitar el item del catálogo:", error);
        alert("No se pudo quitar la opción. Revisa tu conexión.");

    }

}

/*=============================================
 ALERTAS OPERATIVAS (Panel General)
 Conteo simple, no un modelo predictivo: cuántas emergencias y censos
 se registraron este mes por sector (campo "lugar" en Emergencia,
 "barrioVereda" en Censos), para ver de un vistazo dónde se ha
 concentrado la actividad. Como "lugar" es texto libre en Emergencia,
 dos formas distintas de escribir el mismo sector NO se combinan
 automáticamente (ej. "vereda cuervos" y "Cuervos" cuentan aparte) —
 es una limitación real de los datos de origen, no del cálculo.
=============================================*/

function normalizarSector(texto) {
    return (texto || "").trim().toLowerCase();
}

async function calcularAlertas() {

    const contenedor = document.getElementById("alertasLista");
    if (!contenedor) return;

    try {

        const [
            { listarEmergencias },
            { listarCensosFirestore }
        ] = await Promise.all([
            import("./modules/emergencia/firebase.js"),
            import("./modules/censos/firebase.js")
        ]);

        const [emergencias, censos] = await Promise.all([
            listarEmergencias().catch(() => null),
            listarCensosFirestore().catch(() => null)
        ]);

        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const esteMesEmergencia = (e) => {
            const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.fecha || "");
            if (!match) return false;
            const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return fecha >= inicioMes;
        };

        const esteMesCenso = (c) => {
            if (!c.fechaAnio || !c.fechaMes) return false;
            const fecha = new Date(Number(c.fechaAnio), Number(c.fechaMes) - 1, Number(c.fechaDia) || 1);
            return fecha >= inicioMes;
        };

        const conteoPorSector = new Map(); // clave normalizada -> { nombre, emergencias, censos }

        function sumar(nombreOriginal, tipo) {

            const nombre = (nombreOriginal || "").trim();
            if (!nombre) return;

            const clave = normalizarSector(nombre);
            if (!conteoPorSector.has(clave)) {
                conteoPorSector.set(clave, { nombre, emergencias: 0, censos: 0 });
            }

            conteoPorSector.get(clave)[tipo]++;

        }

        if (Array.isArray(emergencias)) {
            emergencias.filter(esteMesEmergencia).forEach(e => sumar(e.lugar, "emergencias"));
        }

        if (Array.isArray(censos)) {
            censos.filter(esteMesCenso).forEach(c => sumar(c.barrioVereda, "censos"));
        }

        const ranking = [...conteoPorSector.values()]
            .map(s => ({ ...s, total: s.emergencias + s.censos }))
            .filter(s => s.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);

        renderizarAlertas(ranking, Array.isArray(emergencias), Array.isArray(censos));

    } catch (error) {

        console.error("[dashboard] No se pudieron calcular las alertas:", error);
        contenedor.innerHTML = `<p class="unit-vacio">No se pudo calcular (revisa conexión).</p>`;

    }

}

function renderizarAlertas(ranking, emergenciasOk, censosOk) {

    const contenedor = document.getElementById("alertasLista");
    if (!contenedor) return;

    if (!emergenciasOk && !censosOk) {
        contenedor.innerHTML = `<p class="unit-vacio">No se pudo leer ni emergencias ni censos.</p>`;
        return;
    }

    if (!ranking.length) {
        contenedor.innerHTML = `<p class="unit-vacio">Sin emergencias ni censos registrados este mes todavía.</p>`;
        return;
    }

    const maximo = ranking[0].total;

    contenedor.innerHTML = ranking.map(s => {

        const intensidad = s.total / maximo; // 0 a 1, para el color de la barra
        const nivel = intensidad > 0.66 ? "alto" : intensidad > 0.33 ? "medio" : "bajo";

        return `
            <div class="alerta-row alerta-${nivel}">
                <div class="alerta-info">
                    <div class="alerta-nombre">${escaparTexto(s.nombre)}</div>
                    <div class="alerta-detalle">
                        ${s.emergencias ? `${s.emergencias} emergencia(s)` : ""}
                        ${s.emergencias && s.censos ? " · " : ""}
                        ${s.censos ? `${s.censos} censo(s)` : ""}
                    </div>
                </div>
                <div class="alerta-total">${s.total}</div>
            </div>
        `;

    }).join("");

}

/*=============================================
 MEDIDOR DE DISPONIBILIDAD (hero)
 Antes mostraba "4/5" escrito fijo en el HTML, sin relación con la
 flota real. Ahora se calcula sobre las mismas unidades que ya carga
 el panel de "Unidades en servicio" — no es una segunda consulta a
 Firestore, es el mismo dato reutilizado.
=============================================*/

const CIRCUNFERENCIA_DIAL = 565.5; // 2 * PI * r(90), ya viene así en el SVG

function actualizarDialDisponibilidad(unidades) {

    const valor = document.getElementById("dialValor");
    const progreso = document.getElementById("dialProgress");
    if (!valor || !progreso) return;

    const total = unidades.length;
    const disponibles = unidades.filter(u => u.estado === "Disponible").length;

    valor.textContent = total ? `${disponibles}/${total}` : "—/—";

    const fraccion = total ? disponibles / total : 0;
    progreso.style.strokeDashoffset = String(CIRCUNFERENCIA_DIAL * (1 - fraccion));

}

/*=============================================
 BITÁCORA DE EVENTOS (Panel General)
 Antes eran 4 líneas fijas ("Emergencia registrada correctamente",
 etc.) que nunca cambiaban, vinieran o no datos nuevos. Ahora se arma
 con los registros más recientes de verdad de los cuatro módulos
 (emergencia, ayudas, censos, inspecciones), ordenados por su fecha
 real de creación en Firestore.
=============================================*/

async function cargarBitacora() {

    const lista = document.querySelector(".activity");
    if (!lista) return;

    try {

        const [
            { listarEmergencias },
            { listarAyudasFirestore },
            { listarCensosFirestore },
            { listarInspecciones }
        ] = await Promise.all([
            import("./modules/emergencia/firebase.js"),
            import("./modules/ayudas/firebase.js"),
            import("./modules/censos/firebase.js"),
            import("./modules/inspecciones/firebase.js")
        ]);

        const [emergencias, ayudas, censos, inspecciones] = await Promise.all([
            listarEmergencias().catch(() => []),
            listarAyudasFirestore().catch(() => []),
            listarCensosFirestore().catch(() => []),
            listarInspecciones().catch(() => [])
        ]);

        const eventos = [
            ...(emergencias || []).map(e => ({
                fecha: fechaOrdenable(e),
                texto: `Emergencia registrada: ${e.evento || "sin tipo"} — ${e.lugar || "sin lugar"}.`,
                icono: "fa-fire-extinguisher"
            })),
            ...(ayudas || []).map(a => ({
                fecha: fechaOrdenable(a),
                texto: `Entrega de ayuda registrada para ${a.beneficiarioNombre || "beneficiario sin nombre"}.`,
                icono: "fa-box-open"
            })),
            ...(censos || []).map(c => ({
                fecha: fechaOrdenable(c),
                texto: `Censo registrado en ${c.barrioVereda || "sector sin especificar"}.`,
                icono: "fa-people-roof"
            })),
            ...(inspecciones || []).map(i => ({
                fecha: fechaOrdenable(i),
                texto: `Inspección ${i.tipoInspeccion || ""} registrada — estado: ${i.estado || "sin estado"}.`,
                icono: "fa-building-shield"
            }))
        ]
            .filter(ev => ev.fecha)
            .sort((a, b) => b.fecha - a.fecha)
            .slice(0, 8);

        renderizarBitacora(eventos);

    } catch (error) {

        console.error("[dashboard] No se pudo cargar la bitácora real:", error);
        lista.innerHTML = `<li class="unit-vacio">No se pudo cargar la actividad reciente.</li>`;

    }

}

// Los cuatro módulos guardan createdAt con serverTimestamp(): al leerlo
// de vuelta llega como Firestore Timestamp (tiene .toDate()), salvo
// que el registro se haya guardado sin conexión y aún no haya
// sincronizado — ahí puede venir undefined, por eso el chequeo.
function fechaOrdenable(registro) {

    const marca = registro?.createdAt;
    if (!marca) return null;

    if (typeof marca.toDate === "function") return marca.toDate();
    if (marca.seconds) return new Date(marca.seconds * 1000);

    return null;

}

function renderizarBitacora(eventos) {

    const lista = document.querySelector(".activity");
    if (!lista) return;

    if (!eventos.length) {
        lista.innerHTML = `<li class="unit-vacio">Sin actividad registrada todavía.</li>`;
        return;
    }

    lista.innerHTML = eventos.map(ev => `
        <li>
            <span class="log-time">${formatearHoraRelativa(ev.fecha)}</span>
            <i class="fa-solid ${ev.icono}"></i>
            ${escaparTexto(ev.texto)}
        </li>
    `).join("");

}

function formatearHoraRelativa(fecha) {

    const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);

    if (minutos < 1) return "ahora";
    if (minutos < 60) return `hace ${minutos} min`;

    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;

    return fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });

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
