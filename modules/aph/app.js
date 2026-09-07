/* ========================================================================
   APP.JS — Módulo APH (Atención Prehospitalaria)
======================================================================== */

import { state } from "./estado.js";
import { UI, inicializarDOM } from "./dom.js";
import { esperarEstadoAuth } from "../../shared/auth.js";
import { anunciar } from "../../shared/voz.js";
import {
    cargarAtenciones, guardarAtencion, eliminarAtencion,
    cargarConsentimientos, guardarConsentimiento, eliminarConsentimiento
} from "./persistencia.js";
import {
    registrarFirma, limpiarFirma, restaurarFirma,
    limpiarTodasLasFirmas, redimensionarCanvasFirmas
} from "./firmas.js";
import { inicializarCuerpo3D, TIPOS_LESION } from "./cuerpo3d.js";
import {
    renderizarListadoAtenciones, renderizarListadoConsentimientos,
    filtrarListadoAtenciones, filtrarListadoConsentimientos
} from "./listado.js";
import { generarPDFAtencion } from "./pdf-atencion.js";
import { generarPDFConsentimiento } from "./pdf-consentimiento.js";

const NUM_TOMAS = 3;
let cuerpo3dApi = null;

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

async function iniciarAplicacion() {

    inicializarDOM();
    construirTomasSignosVitales();

    const usuario = await esperarEstadoAuth();
    state.usuario = usuario.isAnonymous ? "invitado" : (usuario.email || usuario.uid);
    state.invitado = usuario.isAnonymous;
    state.uid = usuario.uid;

    if (UI.avisoInvitadoAtencion) UI.avisoInvitadoAtencion.style.display = state.invitado ? "flex" : "none";
    if (UI.avisoInvitadoConsentimiento) UI.avisoInvitadoConsentimiento.style.display = state.invitado ? "flex" : "none";

    if (typeof renderSidebar === "function") renderSidebar("aph", !state.invitado);
    if (typeof renderHeader === "function") renderHeader("APH");

    configurarEventos();
    configurarTema();

    registrarFirma("rechazoPaciente", "firmaRechazoPaciente", "firmas");
    registrarFirma("rechazoTestigo", "firmaRechazoTestigo", "firmas");
    registrarFirma("paciente1", "firmaPaciente1", "firmasConsentimiento", 0);
    registrarFirma("paciente2", "firmaPaciente2", "firmasConsentimiento", 1);
    registrarFirma("paciente3", "firmaPaciente3", "firmasConsentimiento", 2);

    await cargarAtenciones();
    await cargarConsentimientos();

}

/* ========================================================================
   SIGNOS VITALES — 3 tomas idénticas, generadas por plantilla en vez
   de repetir el mismo bloque de HTML 3 veces a mano.
======================================================================== */

function construirTomasSignosVitales() {

    const contenedor = document.getElementById("contenedorTomas");
    if (!contenedor) return;

    contenedor.innerHTML = Array.from({ length: NUM_TOMAS }, (_, i) => plantillaToma(i + 1)).join("");

}

function plantillaToma(n) {
    return `
        <div class="aph-toma">
            <p class="aph-toma-titulo">Toma ${n}</p>
            <div class="form-grid cols-6">
                <label>Hora<input type="time" id="toma${n}_hora"></label>
                <label>FR (resp/min)<input type="number" min="0" id="toma${n}_fr"></label>
                <label>FC (lat/min)<input type="number" min="0" id="toma${n}_fc"></label>
                <label>T.A. (mmHg)<input type="text" id="toma${n}_ta" placeholder="120/80"></label>
                <label>Glucometría (mg/dl)<input type="number" min="0" id="toma${n}_glucometria"></label>
                <label>Temp. (°C)<input type="number" step="0.1" id="toma${n}_temperatura"></label>
            </div>
            <div class="form-grid cols-4">
                <label>Respiración
                    <select id="toma${n}_respiracion">
                        <option value="">—</option><option>Regular</option><option>Irregular</option>
                    </select>
                </label>
                <label>Nivel de conciencia (AVDN)
                    <select id="toma${n}_conciencia">
                        <option value="">—</option><option>Alerta</option><option>Voz</option><option>Dolor</option><option>No responde</option>
                    </select>
                </label>
                <label>Pupila derecha
                    <select id="toma${n}_pupilaD">
                        <option value="">—</option><option>Normal</option><option>Dilatadas</option><option>Contraídas</option><option>Despacio</option><option>No reacción</option>
                    </select>
                </label>
                <label>Pupila izquierda
                    <select id="toma${n}_pupilaI">
                        <option value="">—</option><option>Normal</option><option>Dilatadas</option><option>Contraídas</option><option>Despacio</option><option>No reacción</option>
                    </select>
                </label>
            </div>
            <div class="form-grid cols-4">
                <label>GCS — Ocular<input type="number" min="1" max="4" id="toma${n}_gcsO"></label>
                <label>GCS — Verbal<input type="number" min="1" max="5" id="toma${n}_gcsV"></label>
                <label>GCS — Motor<input type="number" min="1" max="6" id="toma${n}_gcsL"></label>
                <label class="radio-inline" style="align-self:end;">
                    <input type="checkbox" id="toma${n}_noValorable"> No valorable
                </label>
            </div>
            <div class="form-grid cols-2">
                <label>Color de piel
                    <select id="toma${n}_pielColor">
                        <option value="">Sin comentario</option><option>Pálido</option><option>Cianótico</option><option>Eritematoso</option><option>Ictérica</option>
                    </select>
                </label>
                <label>Piel (textura/temperatura)
                    <select id="toma${n}_pielTemp">
                        <option value="">Sin comentario</option><option>Frío</option><option>Caliente</option><option>Húmedo</option><option>Seco</option>
                    </select>
                </label>
            </div>
        </div>
    `;
}

function recopilarToma(n) {
    return {
        hora: valorCampo(`toma${n}_hora`),
        fr: valorCampo(`toma${n}_fr`),
        fc: valorCampo(`toma${n}_fc`),
        ta: valorCampo(`toma${n}_ta`),
        respiracion: valorCampo(`toma${n}_respiracion`),
        conciencia: valorCampo(`toma${n}_conciencia`),
        gcsO: valorCampo(`toma${n}_gcsO`),
        gcsV: valorCampo(`toma${n}_gcsV`),
        gcsL: valorCampo(`toma${n}_gcsL`),
        gcsNoValorable: document.getElementById(`toma${n}_noValorable`)?.checked || false,
        glucometria: valorCampo(`toma${n}_glucometria`),
        pupilaD: valorCampo(`toma${n}_pupilaD`),
        pupilaI: valorCampo(`toma${n}_pupilaI`),
        pielColor: valorCampo(`toma${n}_pielColor`),
        pielTemp: valorCampo(`toma${n}_pielTemp`),
        temperatura: valorCampo(`toma${n}_temperatura`)
    };
}

function poblarToma(n, datos = {}) {
    asignar(`toma${n}_hora`, datos.hora);
    asignar(`toma${n}_fr`, datos.fr);
    asignar(`toma${n}_fc`, datos.fc);
    asignar(`toma${n}_ta`, datos.ta);
    asignar(`toma${n}_respiracion`, datos.respiracion);
    asignar(`toma${n}_conciencia`, datos.conciencia);
    asignar(`toma${n}_gcsO`, datos.gcsO);
    asignar(`toma${n}_gcsV`, datos.gcsV);
    asignar(`toma${n}_gcsL`, datos.gcsL);
    const chkNoValorable = document.getElementById(`toma${n}_noValorable`);
    if (chkNoValorable) chkNoValorable.checked = Boolean(datos.gcsNoValorable);
    asignar(`toma${n}_glucometria`, datos.glucometria);
    asignar(`toma${n}_pupilaD`, datos.pupilaD);
    asignar(`toma${n}_pupilaI`, datos.pupilaI);
    asignar(`toma${n}_pielColor`, datos.pielColor);
    asignar(`toma${n}_pielTemp`, datos.pielTemp);
    asignar(`toma${n}_temperatura`, datos.temperatura);
}

/* ========================================================================
   PESTAÑAS: Atención APH / Consentimiento Informado
======================================================================== */

function configurarEventos() {

    UI.tabAtencion?.addEventListener("click", () => cambiarPestana("atencion"));
    UI.tabConsentimiento?.addEventListener("click", () => cambiarPestana("consentimiento"));

    UI.btnNuevaAtencion?.addEventListener("click", () => nuevoFormularioAtencion());
    UI.btnVolverListadoAtencion?.addEventListener("click", mostrarVistaListadoAtencion);
    UI.formAtencion?.addEventListener("submit", manejarGuardarAtencion);
    UI.buscadorAtenciones?.addEventListener("input", () => filtrarListadoAtenciones(UI.buscadorAtenciones.value));

    UI.btnNuevoConsentimiento?.addEventListener("click", () => nuevoFormularioConsentimiento());
    UI.btnVolverListadoConsentimiento?.addEventListener("click", mostrarVistaListadoConsentimiento);
    UI.formConsentimiento?.addEventListener("submit", manejarGuardarConsentimiento);
    UI.buscadorConsentimientos?.addEventListener("input", () => filtrarListadoConsentimientos(UI.buscadorConsentimientos.value));

    document.getElementById("rechazaTraslado")?.addEventListener("change", actualizarBloqueRechazo);

    document.querySelectorAll(".clear-signature").forEach(boton => {
        boton.addEventListener("click", () => limpiarFirma(boton.dataset.firma));
    });

    document.getElementById("atencionesCards")?.addEventListener("click", manejarClickListadoAtenciones);
    document.getElementById("consentimientosCards")?.addEventListener("click", manejarClickListadoConsentimientos);

    window.addEventListener("resize", () => cuerpo3dApi?.redimensionar());

}

function cambiarPestana(vista) {

    state.vista = vista;

    UI.tabAtencion?.classList.toggle("activa", vista === "atencion");
    UI.tabConsentimiento?.classList.toggle("activa", vista === "consentimiento");
    UI.panelAtencion?.classList.toggle("activo", vista === "atencion");
    UI.panelConsentimiento?.classList.toggle("activo", vista === "consentimiento");

    window.scrollTo({ top: 0, behavior: "smooth" });

}

function actualizarBloqueRechazo() {
    const marcado = document.getElementById("rechazaTraslado")?.checked;
    if (UI.bloqueRechazo) UI.bloqueRechazo.style.display = marcado ? "grid" : "none";
}

/* ========================================================================
   VISTA ATENCIÓN — listado / formulario
======================================================================== */

function mostrarVistaFormularioAtencion() {

    UI.vistaListadoAtencion?.classList.remove("activa");
    UI.vistaFormularioAtencion?.classList.add("activa");
    window.scrollTo({ top: 0, behavior: "smooth" });

    requestAnimationFrame(() => {

        redimensionarCanvasFirmas();

        if (!cuerpo3dApi && UI.contenedorCuerpo3D) {
            cuerpo3dApi = inicializarCuerpo3D(UI.contenedorCuerpo3D, {
                onCambio: (lesiones) => {
                    state.lesiones = lesiones;
                    renderizarListaLesiones(lesiones);
                }
            });
        }

        cuerpo3dApi?.redimensionar();

    });

}

function mostrarVistaListadoAtencion() {
    UI.vistaFormularioAtencion?.classList.remove("activa");
    UI.vistaListadoAtencion?.classList.add("activa");
    renderizarListadoAtenciones();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderizarListaLesiones(lesiones) {

    if (!UI.listaLesiones) return;

    if (!lesiones.length) {
        UI.listaLesiones.innerHTML = `<p class="aph-vacio-mini">Ninguna todavía.</p>`;
        return;
    }

    UI.listaLesiones.innerHTML = lesiones.map((l, i) => {
        const info = TIPOS_LESION.find(t => t.codigo === l.codigo) || {};
        const color = `#${(info.color || 0).toString(16).padStart(6, "0")}`;
        return `
            <div class="aph-lesion-item">
                <span class="aph-lesion-punto" style="background:${color}"></span>
                <span class="aph-lesion-texto">${l.parte} — ${l.etiqueta} (${l.codigo})</span>
                <button type="button" class="aph-lesion-quitar" data-indice="${i}" title="Quitar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join("");

    UI.listaLesiones.querySelectorAll(".aph-lesion-quitar").forEach(boton => {
        boton.addEventListener("click", () => cuerpo3dApi?.quitarLesion(Number(boton.dataset.indice)));
    });

}

function nuevoFormularioAtencion() {

    state.atencionId = null;
    state.editandoAtencion = false;
    state.lesiones = [];

    UI.formAtencion?.reset();
    limpiarFirma("rechazoPaciente");
    limpiarFirma("rechazoTestigo");
    cuerpo3dApi?.limpiar();
    actualizarBloqueRechazo();

    if (UI.tituloFormularioAtencion) UI.tituloFormularioAtencion.textContent = "Nueva atención";

    mostrarVistaFormularioAtencion();

}

export function cargarFormularioAtencion(atencion) {

    state.atencionId = atencion.id;
    state.editandoAtencion = true;

    poblarFormularioAtencion(atencion);

    if (UI.tituloFormularioAtencion) UI.tituloFormularioAtencion.textContent = `Editar — ${atencion.id}`;

    mostrarVistaFormularioAtencion();

    requestAnimationFrame(() => {
        restaurarFirma("rechazoPaciente", atencion.firmaRechazoPaciente);
        restaurarFirma("rechazoTestigo", atencion.firmaRechazoTestigo);
        cuerpo3dApi?.cargarLesiones(atencion.lesiones || []);
    });

}

export async function manejarEliminarAtencion(id) {
    if (!confirm(`¿Eliminar la atención ${id}? Esta acción no se puede deshacer.`)) return;
    await eliminarAtencion(id);
    anunciar("Atención eliminada.");
}

export async function manejarGenerarPDFAtencion(id) {
    const atencion = state.atenciones.find(a => a.id === id);
    if (atencion) await generarPDFAtencion(atencion);
}

function poblarFormularioAtencion(a) {

    asignar("fechaServicio", a.fechaServicio);
    asignar("movilNumero", a.movilNumero);
    asignar("prioridad", a.prioridad);
    asignar("tipoServicio", a.tipoServicio || "TAB");

    asignar("pacienteNombre", a.pacienteNombre);
    asignar("pacienteEdad", a.pacienteEdad);
    asignar("pacienteDireccion", a.pacienteDireccion);
    asignar("pacienteFechaNacimiento", a.pacienteFechaNacimiento);
    asignar("pacienteTipoDoc", a.pacienteTipoDoc);
    asignar("pacienteDocumento", a.pacienteDocumento);
    asignar("pacienteTelefono1", a.pacienteTelefono1);
    asignar("pacienteTelefono2", a.pacienteTelefono2);
    asignar("pacienteEps", a.pacienteEps);
    asignar("pacienteSoat", a.pacienteSoat);

    asignar("informacionDespacho", a.informacionDespacho);
    asignar("transferidoDe", a.transferidoDe);
    marcarCheck("sinPrevioReporte", a.sinPrevioReporte);
    marcarCheck("seDesconoceReportePrevio", a.seDesconoceReportePrevio);
    asignar("numeroPrevioReporte", a.numeroPrevioReporte);
    asignar("tiempoSalida", a.tiempoSalida);
    asignar("tiempoLlegaSitio", a.tiempoLlegaSitio);
    asignar("tiempoSalidaSitio", a.tiempoSalidaSitio);
    asignar("tiempoLlegadaDestino", a.tiempoLlegadaDestino);
    asignar("tiempoEnServicio", a.tiempoEnServicio);
    asignar("tiempoEnSede", a.tiempoEnSede);

    asignar("motivoAtencion", a.motivoAtencion);
    asignar("evaluacionSubjetiva", a.evaluacionSubjetiva);

    document.querySelectorAll("#grupoProblemaPresentado input[type=checkbox]").forEach(chk => {
        chk.checked = (a.problemaPresentado || []).includes(chk.value);
    });

    for (let n = 1; n <= NUM_TOMAS; n++) {
        poblarToma(n, (a.signosVitales || [])[n - 1] || {});
    }

    asignar("antPatologicos", a.antPatologicos);
    asignar("antQuirurgicos", a.antQuirurgicos);
    asignar("antAlergicos", a.antAlergicos);
    asignar("antMedicamentos", a.antMedicamentos);

    asignar("evaluacionFisica", a.evaluacionFisica);
    asignar("manejo", a.manejo);
    asignar("observacionesAtencion", a.observacionesAtencion);

    asignar("recibeNombre", a.recibeNombre);
    asignar("recibeCargo", a.recibeCargo);
    asignar("recibeCodigo", a.recibeCodigo);

    marcarCheck("rechazaTraslado", a.rechazaTraslado);
    asignar("disposicion", a.disposicion);

    asignar("tripTipo", a.tripTipo);
    asignar("tripNombre", a.tripNombre);

    actualizarBloqueRechazo();

}

function recopilarDatosAtencion() {

    return {

        fechaServicio: valorCampo("fechaServicio"),
        movilNumero: valorCampo("movilNumero"),
        prioridad: valorCampo("prioridad"),
        tipoServicio: valorCampo("tipoServicio"),

        pacienteNombre: valorCampo("pacienteNombre"),
        pacienteEdad: valorCampo("pacienteEdad"),
        pacienteDireccion: valorCampo("pacienteDireccion"),
        pacienteFechaNacimiento: valorCampo("pacienteFechaNacimiento"),
        pacienteTipoDoc: valorCampo("pacienteTipoDoc"),
        pacienteDocumento: valorCampo("pacienteDocumento"),
        pacienteTelefono1: valorCampo("pacienteTelefono1"),
        pacienteTelefono2: valorCampo("pacienteTelefono2"),
        pacienteEps: valorCampo("pacienteEps"),
        pacienteSoat: valorCampo("pacienteSoat"),

        informacionDespacho: valorCampo("informacionDespacho"),
        transferidoDe: valorCampo("transferidoDe"),
        sinPrevioReporte: document.getElementById("sinPrevioReporte")?.checked || false,
        seDesconoceReportePrevio: document.getElementById("seDesconoceReportePrevio")?.checked || false,
        numeroPrevioReporte: valorCampo("numeroPrevioReporte"),
        tiempoSalida: valorCampo("tiempoSalida"),
        tiempoLlegaSitio: valorCampo("tiempoLlegaSitio"),
        tiempoSalidaSitio: valorCampo("tiempoSalidaSitio"),
        tiempoLlegadaDestino: valorCampo("tiempoLlegadaDestino"),
        tiempoEnServicio: valorCampo("tiempoEnServicio"),
        tiempoEnSede: valorCampo("tiempoEnSede"),

        motivoAtencion: valorCampo("motivoAtencion"),
        evaluacionSubjetiva: valorCampo("evaluacionSubjetiva"),

        problemaPresentado: [...document.querySelectorAll("#grupoProblemaPresentado input:checked")].map(el => el.value),

        signosVitales: Array.from({ length: NUM_TOMAS }, (_, i) => recopilarToma(i + 1)),

        antPatologicos: valorCampo("antPatologicos"),
        antQuirurgicos: valorCampo("antQuirurgicos"),
        antAlergicos: valorCampo("antAlergicos"),
        antMedicamentos: valorCampo("antMedicamentos"),

        evaluacionFisica: valorCampo("evaluacionFisica"),
        manejo: valorCampo("manejo"),

        lesiones: cuerpo3dApi?.obtenerLesiones() || [],

        observacionesAtencion: valorCampo("observacionesAtencion"),

        recibeNombre: valorCampo("recibeNombre"),
        recibeCargo: valorCampo("recibeCargo"),
        recibeCodigo: valorCampo("recibeCodigo"),

        rechazaTraslado: document.getElementById("rechazaTraslado")?.checked || false,
        firmaRechazoPaciente: state.firmas.rechazoPaciente || null,
        firmaRechazoTestigo: state.firmas.rechazoTestigo || null,
        disposicion: valorCampo("disposicion"),

        tripTipo: valorCampo("tripTipo"),
        tripNombre: valorCampo("tripNombre"),

        pending: !navigator.onLine,
        synced: navigator.onLine

    };

}

async function manejarGuardarAtencion(evento) {

    evento.preventDefault();
    if (state.estado.guardando) return;

    const datos = recopilarDatosAtencion();

    if (!datos.pacienteNombre) {
        alert("Escribe el nombre del paciente antes de guardar.");
        return;
    }

    try {

        const registro = await guardarAtencion(datos);
        anunciar(`Atención registrada para ${registro.pacienteNombre}.`);
        mostrarVistaListadoAtencion();

    } catch (err) {
        console.error(err);
        alert(mensajeError(err, "la atención"));
    }

}

/* ========================================================================
   VISTA CONSENTIMIENTO — listado / formulario
======================================================================== */

function mostrarVistaFormularioConsentimiento() {
    UI.vistaListadoConsentimiento?.classList.remove("activa");
    UI.vistaFormularioConsentimiento?.classList.add("activa");
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(redimensionarCanvasFirmas);
}

function mostrarVistaListadoConsentimiento() {
    UI.vistaFormularioConsentimiento?.classList.remove("activa");
    UI.vistaListadoConsentimiento?.classList.add("activa");
    renderizarListadoConsentimientos();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function nuevoFormularioConsentimiento() {

    state.consentimientoId = null;
    state.editandoConsentimiento = false;

    UI.formConsentimiento?.reset();
    limpiarTodasLasFirmasConsentimiento();

    if (UI.tituloFormularioConsentimiento) UI.tituloFormularioConsentimiento.textContent = "Nuevo consentimiento";

    asignar("consentimientoFecha", new Date().toISOString().split("T")[0]);

    mostrarVistaFormularioConsentimiento();

}

function limpiarTodasLasFirmasConsentimiento() {
    limpiarFirma("paciente1");
    limpiarFirma("paciente2");
    limpiarFirma("paciente3");
}

export function cargarFormularioConsentimiento(c) {

    state.consentimientoId = c.id;
    state.editandoConsentimiento = true;

    poblarFormularioConsentimiento(c);

    if (UI.tituloFormularioConsentimiento) UI.tituloFormularioConsentimiento.textContent = `Editar — ${c.id}`;

    mostrarVistaFormularioConsentimiento();

    requestAnimationFrame(() => {
        restaurarFirma("paciente1", c.firmaPaciente1);
        restaurarFirma("paciente2", c.firmaPaciente2);
        restaurarFirma("paciente3", c.firmaPaciente3);
    });

}

export async function manejarEliminarConsentimiento(id) {
    if (!confirm(`¿Eliminar el consentimiento ${id}? Esta acción no se puede deshacer.`)) return;
    await eliminarConsentimiento(id);
    anunciar("Consentimiento eliminado.");
}

export async function manejarGenerarPDFConsentimiento(id) {
    const c = state.consentimientos.find(c => c.id === id);
    if (c) await generarPDFConsentimiento(c);
}

function poblarFormularioConsentimiento(c) {

    asignar("consentimientoFecha", c.fecha);

    asignar("firmante1Nombre", c.firmante1Nombre);
    asignar("firmante1Tipo", c.firmante1Tipo);
    asignar("firmante1Documento", c.firmante1Documento);
    asignar("firmante1Telefono", c.firmante1Telefono);

    asignar("firmante2Nombre", c.firmante2Nombre);
    asignar("firmante2Tipo", c.firmante2Tipo);
    asignar("firmante2Documento", c.firmante2Documento);
    asignar("firmante2Telefono", c.firmante2Telefono);

    asignar("firmante3Nombre", c.firmante3Nombre);
    asignar("firmante3Tipo", c.firmante3Tipo);
    asignar("firmante3Documento", c.firmante3Documento);
    asignar("firmante3Telefono", c.firmante3Telefono);

    asignar("consentimientoObservaciones", c.consentimientoObservaciones);

}

function recopilarDatosConsentimiento() {

    return {

        fecha: valorCampo("consentimientoFecha"),

        firmante1Nombre: valorCampo("firmante1Nombre"),
        firmante1Tipo: valorCampo("firmante1Tipo"),
        firmante1Documento: valorCampo("firmante1Documento"),
        firmante1Telefono: valorCampo("firmante1Telefono"),
        firmaPaciente1: state.firmasConsentimiento[0] || null,

        firmante2Nombre: valorCampo("firmante2Nombre"),
        firmante2Tipo: valorCampo("firmante2Tipo"),
        firmante2Documento: valorCampo("firmante2Documento"),
        firmante2Telefono: valorCampo("firmante2Telefono"),
        firmaPaciente2: state.firmasConsentimiento[1] || null,

        firmante3Nombre: valorCampo("firmante3Nombre"),
        firmante3Tipo: valorCampo("firmante3Tipo"),
        firmante3Documento: valorCampo("firmante3Documento"),
        firmante3Telefono: valorCampo("firmante3Telefono"),
        firmaPaciente3: state.firmasConsentimiento[2] || null,

        consentimientoObservaciones: valorCampo("consentimientoObservaciones"),

        pending: !navigator.onLine,
        synced: navigator.onLine

    };

}

async function manejarGuardarConsentimiento(evento) {

    evento.preventDefault();
    if (state.estado.guardando) return;

    const datos = recopilarDatosConsentimiento();

    if (!datos.firmante1Nombre) {
        alert("Escribe el nombre del primer firmante antes de guardar.");
        return;
    }

    if (!datos.firmaPaciente1) {
        alert("Falta la firma del primer firmante.");
        return;
    }

    try {

        const registro = await guardarConsentimiento(datos);
        anunciar(`Consentimiento registrado para ${registro.firmante1Nombre}.`);
        mostrarVistaListadoConsentimiento();

    } catch (err) {
        console.error(err);
        alert(mensajeError(err, "el consentimiento"));
    }

}

/* ========================================================================
   DELEGACIÓN DE CLICS EN LOS LISTADOS
======================================================================== */

function manejarClickListadoAtenciones(e) {

    const btnEditar = e.target.closest(".btn-editar-aph");
    const btnPdf = e.target.closest(".btn-pdf-aph");
    const btnBorrar = e.target.closest(".btn-borrar-aph");

    if (btnEditar) {
        const atencion = state.atenciones.find(a => a.id === btnEditar.dataset.id);
        if (atencion) cargarFormularioAtencion(atencion);
    } else if (btnPdf) {
        manejarGenerarPDFAtencion(btnPdf.dataset.id);
    } else if (btnBorrar) {
        manejarEliminarAtencion(btnBorrar.dataset.id);
    }

}

function manejarClickListadoConsentimientos(e) {

    const btnEditar = e.target.closest(".btn-editar-aph");
    const btnPdf = e.target.closest(".btn-pdf-aph");
    const btnBorrar = e.target.closest(".btn-borrar-aph");

    if (btnEditar) {
        const c = state.consentimientos.find(c => c.id === btnEditar.dataset.id);
        if (c) cargarFormularioConsentimiento(c);
    } else if (btnPdf) {
        manejarGenerarPDFConsentimiento(btnPdf.dataset.id);
    } else if (btnBorrar) {
        manejarEliminarConsentimiento(btnBorrar.dataset.id);
    }

}

/* ========================================================================
   UTILIDADES
======================================================================== */

function valorCampo(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim?.() ?? el.value : "";
}

function asignar(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor ?? "";
}

function marcarCheck(id, valor) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(valor);
}

// Traduce errores técnicos a algo que el personal en campo entienda,
// mismo criterio que ya aplicamos en Ayudas y Censos tras el
// incidente de la cuota de localStorage.
function mensajeError(err, sujeto) {

    const detalle = `${err.code || err.name || ""} ${err.message || err}`.toLowerCase();

    if (detalle.includes("permission")) {
        return `No se pudo guardar ${sujeto}: sin permiso para hacerlo.\n\n` +
               "Si es la primera vez que lo guardas, revisa el listado — es posible que sí se haya guardado a pesar de este mensaje.\n\n" +
               "Si estás corrigiendo un registro que habías guardado antes sin haber iniciado sesión, eso requiere iniciar sesión con una cuenta para poder editarlo.";
    }

    if (detalle.includes("quota")) {
        return "El almacenamiento del navegador está lleno.\n\nEsto no debería impedir guardar — si ves este mensaje, avísale a soporte técnico.";
    }

    if (detalle.includes("network") || detalle.includes("unavailable") || detalle.includes("failed-precondition")) {
        return `No hay conexión a internet en este momento.\n\nEl registro puede quedar guardado en este dispositivo y sincronizar cuando vuelva la señal.`;
    }

    return `No se pudo guardar ${sujeto}.\n\nIntenta de nuevo. Si el problema sigue, avisa a soporte técnico con este detalle: ${err.code || err.name || "error desconocido"}.`;

}

function configurarTema() {

    const boton = document.getElementById("btnTema");
    const raiz = document.documentElement;

    boton?.addEventListener("click", () => {
        const actual = raiz.getAttribute("data-tema");
        const nuevo = actual === "oscuro" ? "claro" : "oscuro";
        raiz.setAttribute("data-tema", nuevo);
        localStorage.setItem("aph_tema", nuevo);
    });

}
