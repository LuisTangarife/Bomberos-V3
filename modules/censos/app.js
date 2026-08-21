/* ========================================================================
   APP.JS
   Módulo Censos — Lógica principal

   Formulario de una sola página (sin wizard), calcado del "Formato
   Censo para Damnificados" (Sistema Nacional de Gestión del Riesgo de
   Desastres — Gobernación de Caldas). Mismo criterio de acceso que
   Inspecciones/Emergencia: sin cuenta, el formulario funciona igual y
   sí sincroniza a Firestore, pero el listado que ve este dispositivo
   es solo el que este dispositivo creó.
======================================================================== */

import { state } from "./estado.js";
import { UI, inicializarDOM } from "./dom.js";
import { esperarEstadoAuth } from "../../shared/auth.js";
import { cargarCensos, guardarCenso } from "./persistencia.js";
import { renderizarListado, filtrarListado } from "./listado.js";

let contadorIntegrantes = 0;

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
        renderSidebar("censos", !state.invitado);
    }
    if (typeof renderHeader === "function") {
        renderHeader("Censos");
    }

    configurarEventos();
    agregarFilaIntegrante();

    await cargarCensos();

}

/* ========================================================================
   EVENTOS
======================================================================== */

function configurarEventos() {

    if (UI.btnNuevo) {
        UI.btnNuevo.addEventListener("click", () => nuevoFormularioCenso());
    }

    if (UI.btnVolver) {
        UI.btnVolver.addEventListener("click", mostrarVistaListado);
    }

    if (UI.buscador) {
        UI.buscador.addEventListener("input", () => filtrarListado(UI.buscador.value));
    }

    if (UI.btnAgregarIntegrante) {
        UI.btnAgregarIntegrante.addEventListener("click", () => agregarFilaIntegrante());
    }

    if (UI.form) {
        UI.form.addEventListener("submit", manejarGuardar);
    }

    // Mostrar/ocultar datos del propietario según el tipo de ocupante
    document.querySelectorAll("input[name='tipoOcupante']").forEach(radio => {
        radio.addEventListener("change", actualizarBloquePropietario);
    });

}

function actualizarBloquePropietario() {

    const seleccionado = UI.form?.querySelector("input[name='tipoOcupante']:checked");
    const esPropietario = seleccionado?.value === "propietario";

    if (UI.bloquePropietario) {
        UI.bloquePropietario.style.display = esPropietario ? "none" : "block";
    }

}

/* ========================================================================
   NÚCLEO FAMILIAR — FILAS DINÁMICAS
======================================================================== */

function agregarFilaIntegrante(datos = {}) {

    if (!UI.tablaIntegrantes) return;

    const idFila = `integrante-${contadorIntegrantes++}`;
    const fila = document.createElement("tr");
    fila.dataset.filaId = idFila;

    fila.innerHTML = `
        <td>
            <select class="ci-tipoDoc">
                <option value="CC" ${datos.tipoDocumento === "CC" ? "selected" : ""}>CC</option>
                <option value="TI" ${datos.tipoDocumento === "TI" ? "selected" : ""}>TI</option>
                <option value="RC" ${datos.tipoDocumento === "RC" ? "selected" : ""}>RC</option>
                <option value="CE" ${datos.tipoDocumento === "CE" ? "selected" : ""}>CE</option>
                <option value="PPT" ${datos.tipoDocumento === "PPT" ? "selected" : ""}>PPT</option>
            </select>
        </td>
        <td><input type="text" class="ci-numeroDoc" value="${datos.numeroDocumento || ""}"></td>
        <td><input type="text" class="ci-nombre" value="${datos.nombreCompleto || ""}" placeholder="Nombre completo"></td>
        <td><input type="date" class="ci-fechaNacimiento" value="${datos.fechaNacimiento || ""}"></td>
        <td><input type="number" min="0" class="ci-edad" value="${datos.edad ?? ""}" style="width:60px"></td>
        <td>
            <select class="ci-sexo">
                <option value="F" ${datos.sexo === "F" ? "selected" : ""}>F</option>
                <option value="M" ${datos.sexo === "M" ? "selected" : ""}>M</option>
                <option value="Otro" ${datos.sexo === "Otro" ? "selected" : ""}>Otro</option>
            </select>
        </td>
        <td><input type="text" class="ci-parentesco" value="${datos.parentesco || ""}" placeholder="Ej: Jefe(a)"></td>
        <td>
            <select class="ci-discapacidad">
                <option value="No" ${datos.discapacidad !== "Si" ? "selected" : ""}>No</option>
                <option value="Si" ${datos.discapacidad === "Si" ? "selected" : ""}>Sí</option>
            </select>
        </td>
        <td>
            <button type="button" class="btn-quitar-integrante" title="Quitar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </td>
    `;

    fila.querySelector(".btn-quitar-integrante").addEventListener("click", () => fila.remove());

    UI.tablaIntegrantes.appendChild(fila);

}

function recopilarIntegrantes() {

    if (!UI.tablaIntegrantes) return [];

    return [...UI.tablaIntegrantes.querySelectorAll("tr")].map(fila => ({
        tipoDocumento: fila.querySelector(".ci-tipoDoc")?.value || "",
        numeroDocumento: fila.querySelector(".ci-numeroDoc")?.value.trim() || "",
        nombreCompleto: fila.querySelector(".ci-nombre")?.value.trim() || "",
        fechaNacimiento: fila.querySelector(".ci-fechaNacimiento")?.value || "",
        edad: fila.querySelector(".ci-edad")?.value || "",
        sexo: fila.querySelector(".ci-sexo")?.value || "",
        parentesco: fila.querySelector(".ci-parentesco")?.value.trim() || "",
        discapacidad: fila.querySelector(".ci-discapacidad")?.value || "No"
    })).filter(i => i.nombreCompleto || i.numeroDocumento);

}

/* ========================================================================
   CHECKBOXES MARCADOS (helper genérico)
======================================================================== */

function marcados(nombreGrupo) {
    return [...document.querySelectorAll(`input[name='${nombreGrupo}']:checked`)]
        .map(el => el.value);
}

function valorRadio(nombreGrupo) {
    return document.querySelector(`input[name='${nombreGrupo}']:checked`)?.value || "";
}

function valorCampo(id) {
    return document.getElementById(id)?.value.trim() || "";
}

/* ========================================================================
   RECOPILAR / POBLAR FORMULARIO
======================================================================== */

function recopilarDatosFormulario() {

    return {

        // 1. Datos vivienda
        codigoUdeger: valorCampo("codigoUdeger"),
        municipio: valorCampo("municipio"),
        corregimiento: valorCampo("corregimiento"),
        barrioVereda: valorCampo("barrioVereda"),
        direccion: valorCampo("direccion"),
        nucleo: valorCampo("nucleo"),

        // 2. Jefe de núcleo familiar
        jefeCedula: valorCampo("jefeCedula"),
        jefeNombre: valorCampo("jefeNombre"),
        jefeTelefono: valorCampo("jefeTelefono"),
        jefeFechaNacimiento: valorCampo("jefeFechaNacimiento"),
        jefeEdad: valorCampo("jefeEdad"),
        tipoOcupante: valorRadio("tipoOcupante"),
        propietarioCedula: valorCampo("propietarioCedula"),
        propietarioNombre: valorCampo("propietarioNombre"),
        propietarioDireccion: valorCampo("propietarioDireccion"),
        propietarioTelefono: valorCampo("propietarioTelefono"),

        // 3. Núcleo familiar
        integrantes: recopilarIntegrantes(),

        // 4. Servicios públicos
        servicios: marcados("servicios"),

        // 5. Subsidios
        subsidios: marcados("subsidios"),

        // 6. Fenómeno amenazante
        situacionFenomeno: valorRadio("situacionFenomeno"),
        origenFenomeno: marcados("origenFenomeno"),

        // 7. Afectación
        infraestructuraAfectada: marcados("infraestructuraAfectada"),
        areaAfectadaM2: valorCampo("areaAfectadaM2"),
        perdidaBienes: valorRadio("perdidaBienes"),
        descripcionBienesPerdidos: valorCampo("descripcionBienesPerdidos"),
        perdidaAgropecuaria: valorCampo("perdidaAgropecuaria"),
        danoEdificacion: valorRadio("danoEdificacion"),
        porcentajeDano: valorCampo("porcentajeDano"),

        // 8. Recomendación de evacuación
        recomendacionEvacuacion: valorRadio("recomendacionEvacuacion"),

        // 9. Fecha de elaboración
        fechaDia: valorCampo("fechaDia"),
        fechaMes: valorCampo("fechaMes"),
        fechaAnio: valorCampo("fechaAnio"),
        fechaHora: valorCampo("fechaHora"),
        fechaMinutos: valorCampo("fechaMinutos"),
        fechaAmPm: valorRadio("fechaAmPm"),

        // 10. Observaciones
        observaciones: valorCampo("observaciones"),

        // 11. Firmas
        funcionarioCedula: valorCampo("funcionarioCedula"),
        funcionarioNombre: valorCampo("funcionarioNombre"),
        encuestadoCedula: valorCampo("encuestadoCedula"),
        encuestadoNombre: valorCampo("encuestadoNombre"),

        pending: !navigator.onLine,
        synced: navigator.onLine

    };

}

function poblarFormulario(censo) {

    const asignar = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor ?? "";
    };
    const marcarRadio = (nombre, valor) => {
        const el = document.querySelector(`input[name='${nombre}'][value='${valor}']`);
        if (el) el.checked = true;
    };
    const marcarChecks = (nombre, valores = []) => {
        document.querySelectorAll(`input[name='${nombre}']`).forEach(el => {
            el.checked = valores.includes(el.value);
        });
    };

    asignar("codigoUdeger", censo.codigoUdeger);
    asignar("municipio", censo.municipio);
    asignar("corregimiento", censo.corregimiento);
    asignar("barrioVereda", censo.barrioVereda);
    asignar("direccion", censo.direccion);
    asignar("nucleo", censo.nucleo);

    asignar("jefeCedula", censo.jefeCedula);
    asignar("jefeNombre", censo.jefeNombre);
    asignar("jefeTelefono", censo.jefeTelefono);
    asignar("jefeFechaNacimiento", censo.jefeFechaNacimiento);
    asignar("jefeEdad", censo.jefeEdad);
    marcarRadio("tipoOcupante", censo.tipoOcupante);
    asignar("propietarioCedula", censo.propietarioCedula);
    asignar("propietarioNombre", censo.propietarioNombre);
    asignar("propietarioDireccion", censo.propietarioDireccion);
    asignar("propietarioTelefono", censo.propietarioTelefono);
    actualizarBloquePropietario();

    UI.tablaIntegrantes.innerHTML = "";
    (censo.integrantes?.length ? censo.integrantes : [{}]).forEach(agregarFilaIntegrante);

    marcarChecks("servicios", censo.servicios);
    marcarChecks("subsidios", censo.subsidios);

    marcarRadio("situacionFenomeno", censo.situacionFenomeno);
    marcarChecks("origenFenomeno", censo.origenFenomeno);

    marcarChecks("infraestructuraAfectada", censo.infraestructuraAfectada);
    asignar("areaAfectadaM2", censo.areaAfectadaM2);
    marcarRadio("perdidaBienes", censo.perdidaBienes);
    asignar("descripcionBienesPerdidos", censo.descripcionBienesPerdidos);
    asignar("perdidaAgropecuaria", censo.perdidaAgropecuaria);
    marcarRadio("danoEdificacion", censo.danoEdificacion);
    asignar("porcentajeDano", censo.porcentajeDano);

    marcarRadio("recomendacionEvacuacion", censo.recomendacionEvacuacion);

    asignar("fechaDia", censo.fechaDia);
    asignar("fechaMes", censo.fechaMes);
    asignar("fechaAnio", censo.fechaAnio);
    asignar("fechaHora", censo.fechaHora);
    asignar("fechaMinutos", censo.fechaMinutos);
    marcarRadio("fechaAmPm", censo.fechaAmPm);

    asignar("observaciones", censo.observaciones);

    asignar("funcionarioCedula", censo.funcionarioCedula);
    asignar("funcionarioNombre", censo.funcionarioNombre);
    asignar("encuestadoCedula", censo.encuestadoCedula);
    asignar("encuestadoNombre", censo.encuestadoNombre);

}

function fechaHoyPorDefecto() {
    const hoy = new Date();
    document.getElementById("fechaDia").value = String(hoy.getDate()).padStart(2, "0");
    document.getElementById("fechaMes").value = String(hoy.getMonth() + 1).padStart(2, "0");
    document.getElementById("fechaAnio").value = String(hoy.getFullYear());
    document.getElementById("fechaHora").value = String(hoy.getHours() % 12 || 12).padStart(2, "0");
    document.getElementById("fechaMinutos").value = String(hoy.getMinutes()).padStart(2, "0");
    marcarRadioAmPm(hoy.getHours());
}

function marcarRadioAmPm(hora24) {
    const valor = hora24 < 12 ? "AM" : "PM";
    const el = document.querySelector(`input[name='fechaAmPm'][value='${valor}']`);
    if (el) el.checked = true;
}

/* ========================================================================
   NUEVO / EDITAR / GUARDAR
======================================================================== */

export function nuevoFormularioCenso() {

    state.censoId = null;
    state.editando = false;

    if (UI.form) UI.form.reset();
    if (UI.tablaIntegrantes) UI.tablaIntegrantes.innerHTML = "";
    agregarFilaIntegrante();
    actualizarBloquePropietario();
    fechaHoyPorDefecto();

    if (UI.tituloFormulario) UI.tituloFormulario.textContent = "Nuevo Censo";

    mostrarVistaFormulario();

}

export function cargarFormularioCenso(id) {

    const censo = state.censos.find(c => c.id === id);
    if (!censo) return;

    state.censoId = censo.id;
    state.editando = true;

    if (UI.form) UI.form.reset();
    poblarFormulario(censo);

    if (UI.tituloFormulario) {
        UI.tituloFormulario.textContent = `Censo ${censo.id}`;
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

        if (!datos.jefeNombre) {
            alert("El nombre del jefe de núcleo familiar es obligatorio.");
            return;
        }

        await guardarCenso(datos);

        mostrarVistaListado();

    } catch (err) {

        console.error(err);

        // Antes decía siempre lo mismo sin importar la causa real. Con
        // el código y mensaje del error (ej. "permission-denied" si son
        // las reglas de Firestore) puedes ver la causa exacta sin abrir
        // la consola del navegador.
        alert(
            "No se pudo guardar el censo.\n\n" +
            `Detalle: ${err.code || err.name || "error desconocido"} — ${err.message || err}`
        );

    } finally {

        if (UI.btnGuardar) {
            UI.btnGuardar.disabled = false;
            UI.btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Censo';
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
}

function mostrarVistaListado() {
    if (UI.vistaFormulario) UI.vistaFormulario.classList.remove("activa");
    if (UI.vistaListado) UI.vistaListado.classList.add("activa");
    renderizarListado();
    window.scrollTo({ top: 0, behavior: "smooth" });
}
