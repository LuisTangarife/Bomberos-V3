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
    state.usuario = usuario.isAnonymous ? "invitado" : (usuario.email || usuario.uid);
    state.invitado = usuario.isAnonymous;
    state.uid = usuario.uid;

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
    cargarCatalogoKits();

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

const ICONOS_KIT = {
    "Kit Alimentario": "fa-basket-shopping",
    "Kit Aseo": "fa-pump-soap",
    "Kit Cocina": "fa-utensils",
    "Kit Noche": "fa-bed",
    "Kit Mascota": "fa-paw"
};

// Igual que unidades/personal en el Panel General: si el catálogo
// "Tipo de kit" tiene contenido en Firestore, reemplaza las fichas
// fijas del HTML. Los 5 tipos originales conservan su ícono propio;
// cualquier tipo nuevo que se agregue desde el panel usa un ícono
// genérico de caja, porque no hay forma de que un administrador
// elija un ícono de FontAwesome desde un campo de texto simple.
async function cargarCatalogoKits() {

    try {

        const { listarCatalogo } = await import("../../shared/catalogos.js");
        const items = await listarCatalogo("ayudas", "tipoKit");

        if (!items.length) return; // sin catálogo propio todavía: se queda con las 5 fichas del HTML

        const contenedor = document.getElementById("kitSelector");
        if (!contenedor) return;

        contenedor.innerHTML = items.map(item => {

            const icono = ICONOS_KIT[item.valor] || "fa-box";
            const etiqueta = item.valor.replace(/^Kit\s+/i, "");

            return `
                <div class="kit-tile" data-valor="${item.valor.replace(/"/g, "&quot;")}">
                    <button type="button" class="kit-tile-toggle">
                        <i class="fa-solid ${icono}"></i>
                        <span>${etiqueta}</span>
                    </button>
                    <label class="kit-tile-cantidad">Cantidad
                        <input type="number" min="1" value="1" class="kit-cantidad-input">
                    </label>
                </div>
            `;

        }).join("");

        // Las fichas son elementos nuevos: hay que volver a engancharles
        // los eventos (los de las fichas viejas, que ya no existen en
        // el DOM, simplemente se pierden — no queda ningún listener
        // huérfano).
        configurarSelectorKit();

    } catch (error) {
        console.warn("[ayudas] No se pudo cargar el catálogo de tipos de kit, se usan las fichas fijas del HTML:", error);
    }

}

/* ========================================================================
   SELECTOR DE KIT (fichas tocables, selección múltiple con cantidad)
======================================================================== */

function configurarSelectorKit() {

    document.querySelectorAll("#kitSelector .kit-tile").forEach(tile => {

        const boton = tile.querySelector(".kit-tile-toggle");
        if (boton) {
            boton.addEventListener("click", () => alternarKit(tile));
        }

        // El input de cantidad no debe propagar el click hacia el toggle
        // (si no, tocar el número también des-seleccionaría el kit).
        const inputCantidad = tile.querySelector(".kit-cantidad-input");
        if (inputCantidad) {
            inputCantidad.addEventListener("click", e => e.stopPropagation());
            inputCantidad.addEventListener("change", () => {
                if (Number(inputCantidad.value) < 1) inputCantidad.value = 1;
            });
        }

    });

}

function alternarKit(tile) {

    const activo = tile.classList.toggle("activo");

    if (activo) {
        const inputCantidad = tile.querySelector(".kit-cantidad-input");
        if (inputCantidad) inputCantidad.focus();
    }

}

function obtenerKitsSeleccionados() {

    const kits = [];

    document.querySelectorAll("#kitSelector .kit-tile.activo").forEach(tile => {

        const tipo = tile.dataset.valor;
        const inputCantidad = tile.querySelector(".kit-cantidad-input");
        const cantidad = Math.max(1, parseInt(inputCantidad?.value, 10) || 1);

        kits.push({ tipo, cantidad });

    });

    return kits;

}

function establecerKitsSeleccionados(kits) {

    document.querySelectorAll("#kitSelector .kit-tile").forEach(tile => {

        const encontrado = (kits || []).find(k => k.tipo === tile.dataset.valor);
        const inputCantidad = tile.querySelector(".kit-cantidad-input");

        tile.classList.toggle("activo", Boolean(encontrado));
        if (inputCantidad) inputCantidad.value = encontrado?.cantidad || 1;

    });

}

// ayuda.kits es el formato actual (varios tipos con cantidad). Registros
// guardados antes de este cambio solo tienen ayuda.tipoKit + ayuda.
// cantidadEntregada (un único tipo) — se migran a un arreglo de un solo
// elemento para poder editarlos sin perder esos datos.
export function normalizarKits(ayuda) {

    if (Array.isArray(ayuda?.kits) && ayuda.kits.length > 0) return ayuda.kits;

    if (ayuda?.tipoKit) {
        return [{ tipo: ayuda.tipoKit, cantidad: Number(ayuda.cantidadEntregada) || 1 }];
    }

    return [];

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

    const kits = obtenerKitsSeleccionados();

    return {

        // Encabezado
        kits,
        // Resumen derivado, para no romper el listado ni la búsqueda de
        // registros antiguos que solo conocen tipoKit/cantidadEntregada.
        tipoKit: kits.map(k => k.tipo).join(", "),
        cantidadEntregada: String(kits.reduce((total, k) => total + k.cantidad, 0) || 0),
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

    establecerKitsSeleccionados(normalizarKits(ayuda));
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
    establecerKitsSeleccionados([]);
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

// Traduce errores técnicos del navegador/Firestore a algo que un
// bombero en medio de una entrega pueda entender y saber qué hacer,
// en vez de un mensaje en inglés con nombres de funciones internas
// (como pasó con el error de cuota de almacenamiento).
function mensajeErrorGuardado(err) {

    const detalleTecnico = `${err.code || err.name || ""} ${err.message || err}`.toLowerCase();

    if (detalleTecnico.includes("quota")) {
        return "El almacenamiento del navegador está lleno.\n\n" +
               "Esto no debería impedir guardar la entrega — si ves este mensaje, avísale a soporte técnico.";
    }

    if (detalleTecnico.includes("permission-denied") || detalleTecnico.includes("permission")) {
        return "No tienes permiso para guardar esta entrega.\n\n" +
               "Cierra sesión y vuelve a entrar, o avisa a soporte técnico si persiste.";
    }

    if (detalleTecnico.includes("network") || detalleTecnico.includes("unavailable") || detalleTecnico.includes("failed-precondition")) {
        return "No hay conexión a internet en este momento.\n\n" +
               "La entrega puede quedar guardada en este dispositivo y sincronizar cuando vuelva la señal.";
    }

    return "No se pudo guardar la entrega.\n\n" +
           "Intenta de nuevo. Si el problema sigue, avisa a soporte técnico con este detalle: " +
           `${err.code || err.name || "error desconocido"}.`;

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

        if (!datos.kits.length) {
            alert("Selecciona al menos un tipo de kit entregado.");
            return;
        }

        await guardarAyuda(datos);

        const resumenKits = datos.kits.map(k => `${k.cantidad} ${k.tipo}`).join(", ");
        anunciar(`Entrega registrada. ${resumenKits} para ${datos.beneficiarioNombre}.`);

        mostrarVistaListado();

    } catch (err) {

        console.error(err);
        alert(mensajeErrorGuardado(err));

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
