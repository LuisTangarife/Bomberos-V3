/* ========================================================================
   APP.JS
   Módulo Ayudas Humanitarias — Lógica principal

   Formulario de una sola página, calcado del "Formato de Entrega de
   Kit — Emergencia por evento sísmico" (Alcaldía de Villamaría,
   Secretaría de Desarrollo Social). Mismo criterio de acceso que los
   demás módulos: sin cuenta, el formulario funciona igual y sí
   sincroniza a Firestore, pero el listado que ve este dispositivo es
   solo el que este dispositivo creó.
======================================================================== */

import { state } from "./estado.js";
import { UI, inicializarDOM } from "./dom.js";
import { esperarEstadoAuth } from "../../shared/auth.js";
import { cargarAyudas, guardarAyuda } from "./persistencia.js";
import { renderizarListado, filtrarListado } from "./listado.js";
import { anunciar } from "../../shared/voz.js";
import {
    inicializarFirmas,
    limpiarTodasLasFirmas,
    restaurarFirma,
    redimensionarCanvasFirmas
} from "./firmas.js";
import {
    inicializarFotoEntrega,
    renderizarFotoEntrega,
    quitarFotoEntrega
} from "./fotos.js";

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

async function iniciarAplicacion() {

    inicializarDOM();

    const usuario = await esperarEstadoAuth();
    state.usuario = usuario ? (usuario.email || usuario.uid) : "invitado";
    state.invitado = !usuario;

    if (UI.avisoInvitado) {
        UI.avisoInvitado.style.display = state.invitado ? "flex" : "none";
    }

    if (typeof renderSidebar === "function") {
        renderSidebar("ayudas", !state.invitado);
    }
    if (typeof renderHeader === "function") {
        renderHeader("Ayudas Humanitarias");
    }

    configurarEventos();
    configurarTema();
    inicializarFirmas();
    inicializarFotoEntrega();

    await cargarAyudas();

}

/* ========================================================================
   TEMA DÍA / NOCHE
======================================================================== */

function configurarTema() {

    const btn = document.getElementById("btnTemaAyuda");
    if (!btn) return;

    actualizarIconoTema();

    btn.addEventListener("click", () => {

        const actual = document.documentElement.getAttribute("data-tema") === "claro"
            ? "claro" : "oscuro";
        const nuevo = actual === "claro" ? "oscuro" : "claro";

        document.documentElement.setAttribute("data-tema", nuevo);
        localStorage.setItem("ayudas_tema", nuevo);

        actualizarIconoTema();

    });

}

function actualizarIconoTema() {

    const btn = document.getElementById("btnTemaAyuda");
    if (!btn) return;

    const esClaro = document.documentElement.getAttribute("data-tema") === "claro";

    btn.innerHTML = esClaro
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';

    btn.title = esClaro ? "Cambiar a tema oscuro" : "Cambiar a tema claro";

}

/* ========================================================================
   EVENTOS
======================================================================== */

function configurarEventos() {

    if (UI.btnNuevo) {
        UI.btnNuevo.addEventListener("click", () => nuevoFormularioAyuda());
    }

    if (UI.btnVolver) {
        UI.btnVolver.addEventListener("click", mostrarVistaListado);
    }

    if (UI.buscador) {
        UI.buscador.addEventListener("input", () => filtrarListado(UI.buscador.value));
    }

    if (UI.form) {
        UI.form.addEventListener("submit", manejarGuardar);
    }

    document.querySelectorAll("input[name='censado']").forEach(radio => {
        radio.addEventListener("change", actualizarCampoNumCenso);
    });

    configurarSelectorKit();

}

/* ========================================================================
   SELECTOR DE KIT (fichas tocables)
======================================================================== */

function configurarSelectorKit() {

    document.querySelectorAll("#kitSelector .kit-tile").forEach(ficha => {
        ficha.addEventListener("click", () => seleccionarKit(ficha.dataset.valor));
    });

}

function seleccionarKit(valor) {

    const input = document.getElementById("tipoKit");
    if (input) input.value = valor;

    document.querySelectorAll("#kitSelector .kit-tile").forEach(ficha => {
        ficha.classList.toggle("activo", ficha.dataset.valor === valor);
    });

}

function actualizarCampoNumCenso() {

    const marcado = UI.form?.querySelector("input[name='censado']:checked");
    const bloque = document.getElementById("bloqueNumCenso");
    if (bloque) bloque.style.display = marcado?.value === "Sí" ? "flex" : "none";

}

/* ========================================================================
   HELPERS DE LECTURA
======================================================================== */

function valorCampo(id) {
    return document.getElementById(id)?.value.trim() || "";
}

function valorRadio(nombreGrupo) {
    return document.querySelector(`input[name='${nombreGrupo}']:checked`)?.value || "";
}

function asignar(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor ?? "";
}

function marcarRadio(nombre, valor) {
    const el = document.querySelector(`input[name='${nombre}'][value='${valor}']`);
    if (el) el.checked = true;
}

/* ========================================================================
   RECOPILAR / POBLAR FORMULARIO
======================================================================== */

function recopilarDatosFormulario() {

    return {

        // Encabezado
        tipoKit: valorCampo("tipoKit"),
        fecha: valorCampo("fecha"),
        lugar: valorCampo("lugar"),

        // Datos del beneficiario
        beneficiarioNombre: valorCampo("beneficiarioNombre"),
        beneficiarioCedula: valorCampo("beneficiarioCedula"),
        beneficiarioTelefono: valorCampo("beneficiarioTelefono"),
        direccionSector: valorCampo("direccionSector"),
        numIntegrantesHogar: valorCampo("numIntegrantesHogar"),
        censado: valorRadio("censado"),
        numCenso: valorCampo("numCenso"),

        // Entrega
        cantidadEntregada: valorCampo("cantidadEntregada") || "1",
        observaciones: valorCampo("observaciones"),

        // Constancia
        responsableNombre: valorCampo("responsableNombre"),
        responsableCedula: valorCampo("responsableCedula"),

        firmaBeneficiario: state.firmas.beneficiario || null,
        firmaResponsable: state.firmas.responsable || null,

        foto: state.foto || null,

        pending: !navigator.onLine,
        synced: navigator.onLine

    };

}

function poblarFormulario(ayuda) {

    asignar("tipoKit", ayuda.tipoKit);
    seleccionarKit(ayuda.tipoKit || "");
    asignar("fecha", ayuda.fecha);
    asignar("lugar", ayuda.lugar);

    asignar("beneficiarioNombre", ayuda.beneficiarioNombre);
    asignar("beneficiarioCedula", ayuda.beneficiarioCedula);
    asignar("beneficiarioTelefono", ayuda.beneficiarioTelefono);
    asignar("direccionSector", ayuda.direccionSector);
    asignar("numIntegrantesHogar", ayuda.numIntegrantesHogar);
    marcarRadio("censado", ayuda.censado || "No");
    asignar("numCenso", ayuda.numCenso);
    actualizarCampoNumCenso();

    asignar("cantidadEntregada", ayuda.cantidadEntregada || "1");
    asignar("observaciones", ayuda.observaciones);

    asignar("responsableNombre", ayuda.responsableNombre);
    asignar("responsableCedula", ayuda.responsableCedula);

    state.firmas.beneficiario = ayuda.firmaBeneficiario || null;
    state.firmas.responsable = ayuda.firmaResponsable || null;

    state.foto = ayuda.foto || null;
    renderizarFotoEntrega();

    requestAnimationFrame(() => {
        redimensionarCanvasFirmas();
        restaurarFirma("beneficiario");
        restaurarFirma("responsable");
    });

}

function fechaHoyPorDefecto() {
    const hoy = new Date();
    document.getElementById("fecha").value = hoy.toISOString().split("T")[0];
}

/* ========================================================================
   NUEVO / EDITAR / GUARDAR
======================================================================== */

export function nuevoFormularioAyuda() {

    state.ayudaId = null;
    state.editando = false;

    if (UI.form) UI.form.reset();
    limpiarTodasLasFirmas();
    quitarFotoEntrega();
    seleccionarKit("");
    marcarRadio("censado", "No");
    actualizarCampoNumCenso();
    fechaHoyPorDefecto();

    if (UI.tituloFormulario) UI.tituloFormulario.textContent = "Nueva entrega de kit";

    mostrarVistaFormulario();

}

export function cargarFormularioAyuda(id) {

    const ayuda = state.ayudas.find(a => a.id === id);
    if (!ayuda) return;

    state.ayudaId = ayuda.id;
    state.editando = true;

    if (UI.form) UI.form.reset();
    poblarFormulario(ayuda);

    if (UI.tituloFormulario) {
        UI.tituloFormulario.textContent = `Entrega ${ayuda.id}`;
    }

    mostrarVistaFormulario();

}

async function manejarGuardar(evento) {

    evento.preventDefault();

    if (UI.btnGuardar) {
        UI.btnGuardar.disabled = true;
        UI.btnGuardar.textContent = "Guardando...";
    }

    try {

        const datos = recopilarDatosFormulario();

        if (!datos.beneficiarioNombre) {
            alert("El nombre del beneficiario es obligatorio.");
            return;
        }

        if (!datos.tipoKit) {
            alert("Selecciona el tipo de kit entregado.");
            return;
        }

        await guardarAyuda(datos);

        anunciar(`Entrega registrada. ${datos.tipoKit} para ${datos.beneficiarioNombre}.`);

        mostrarVistaListado();

    } catch (err) {

        console.error(err);

        alert(
            "No se pudo guardar la entrega.\n\n" +
            `Detalle: ${err.code || err.name || "error desconocido"} — ${err.message || err}`
        );

    } finally {

        if (UI.btnGuardar) {
            UI.btnGuardar.disabled = false;
            UI.btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Entrega';
        }

    }

}

/* ========================================================================
   CAMBIO ENTRE VISTAS
======================================================================== */

function mostrarVistaFormulario() {
    if (UI.vistaListado) UI.vistaListado.classList.remove("activa");
    if (UI.vistaFormulario) UI.vistaFormulario.classList.add("activa");
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(redimensionarCanvasFirmas);
}

function mostrarVistaListado() {
    if (UI.vistaFormulario) UI.vistaFormulario.classList.remove("activa");
    if (UI.vistaListado) UI.vistaListado.classList.add("activa");
    renderizarListado();
    window.scrollTo({ top: 0, behavior: "smooth" });
}
