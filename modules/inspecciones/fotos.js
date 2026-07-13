/* ========================================================================
   FOTOS.JS
   Sistema de Inspecciones — Gestión de fotografías
======================================================================== */

import { UI } from "./dom.js";
import { state, APP } from "./estado.js";
import { programarAutoGuardado } from "./autoguardado.js";

export function inicializarFotos() {

    const input = document.getElementById("photoInput");
    if (!input) return;

    input.addEventListener("change", manejarSeleccionFotos);

    const btnCamera = document.getElementById("btnCamera");
    const btnGallery = document.getElementById("btnGallery");

    if (btnCamera) {
        btnCamera.addEventListener("click", () => {
            input.setAttribute("capture", "environment");
            input.click();
        });
    }

    if (btnGallery) {
        btnGallery.addEventListener("click", () => {
            input.removeAttribute("capture");
            input.click();
        });
    }

    renderizarFotos();

}

async function manejarSeleccionFotos(e) {

    const archivos = [...e.target.files];
    if (!archivos.length) return;

    for (const archivo of archivos) {
        if (state.fotos.length >= APP.MAX_FOTOS) break;
        await agregarFoto(archivo);
    }

    e.target.value = "";

    renderizarFotos();
    programarAutoGuardado();

}

async function agregarFoto(file) {

    if (!file.type.startsWith("image/")) return;

    // Las fotos de cámara pueden pesar varios MB cada una. Sin
    // comprimir, con hasta APP.MAX_FOTOS (50) fotos permitidas, eso
    // significaba: (a) subidas larguísimas a Firebase Storage al
    // guardar, y (b) un borrador en localStorage enorme (el autoguardado
    // serializa "imagen" en base64 en cada tanda), lo que podía incluso
    // llegar al límite de localStorage y volver lenta toda la pestaña.
    // Se comprime/redimensiona aquí, antes de guardar nada en el estado.
    const comprimida = await comprimirImagen(file);

    const base64 = await convertirBase64(comprimida);

    state.fotos.push({
        id: crypto.randomUUID(),
        nombre: file.name,
        tipo: comprimida.type,
        peso: comprimida.size,
        fecha: Date.now(),
        // "imagen" se usa para la vista previa mientras se edita el
        // formulario. Al guardar, persistencia.js sube "archivo" a
        // Firebase Storage y reemplaza "imagen" por la URL resultante,
        // para no meter fotos completas en base64 dentro del documento
        // de Firestore (eso es lo que hacía que guardar y listar fuera
        // lentísimo).
        imagen: base64,
        archivo: comprimida,
        url: null
    });

}

// Ancho máximo y calidad JPEG usados al comprimir. Con Storage
// deshabilitado (APP.USAR_STORAGE = false), las fotos viajan como
// base64 DENTRO del documento de Firestore, que tiene un límite duro
// de 1 MiB por documento. Por eso, sin Storage se comprime bastante
// más fuerte (800px / calidad 0.5) que con Storage habilitado (1600px
// / calidad 0.75), donde el tamaño del archivo casi no importa.
const FOTO_ANCHO_MAXIMO = APP.USAR_STORAGE ? 1600 : 800;
const FOTO_CALIDAD_JPEG = APP.USAR_STORAGE ? 0.75 : 0.5;

/**
 * Redimensiona (si hace falta) y comprime una foto a JPEG usando un
 * canvas. Si por algún motivo falla (formato no soportado, etc.), se
 * devuelve el archivo original para no bloquear al usuario.
 */
async function comprimirImagen(file) {

    try {

        const bitmap = await createImageBitmap(file);

        const escala = Math.min(1, FOTO_ANCHO_MAXIMO / bitmap.width);
        const ancho = Math.round(bitmap.width * escala);
        const alto = Math.round(bitmap.height * escala);

        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;

        const contexto = canvas.getContext("2d");
        contexto.drawImage(bitmap, 0, 0, ancho, alto);

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/jpeg", FOTO_CALIDAD_JPEG)
        );

        if (!blob || blob.size >= file.size) return file; // no ganamos nada, usar el original

        const nombreJpg = file.name.replace(/\.\w+$/, "") + ".jpg";
        return new File([blob], nombreJpg, { type: "image/jpeg" });

    } catch (error) {
        console.error("No se pudo comprimir la foto, se usará el archivo original", error);
        return file;
    }

}

function convertirBase64(file) {

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

}

export function renderizarFotos() {

    if (!UI.fotosContainer) return;

    UI.fotosContainer.innerHTML = "";

    if (!state.fotos.length) {

        UI.fotosContainer.innerHTML = `
            <div class="photo-placeholder">
                <i class="fa-solid fa-images"></i>
                <span>Aún no hay fotografías</span>
            </div>
        `;

        actualizarContadorFotos();
        return;

    }

    state.fotos.forEach(foto => {
        UI.fotosContainer.appendChild(crearCardFoto(foto));
    });

    actualizarContadorFotos();

}

function crearCardFoto(foto) {

    const card = document.createElement("div");
    card.className = "photo-card";

    card.innerHTML = `
        <img src="${foto.imagen}" alt="${foto.nombre}">
        <div class="photo-tools">
            <button type="button" class="photo-up">▲</button>
            <button type="button" class="photo-down">▼</button>
            <button type="button" class="photo-delete">🗑</button>
        </div>
    `;

    card.querySelector(".photo-up")
        .addEventListener("click", () => subirFoto(state.fotos.indexOf(foto)));

    card.querySelector(".photo-down")
        .addEventListener("click", () => bajarFoto(state.fotos.indexOf(foto)));

    card.querySelector("img")
        .addEventListener("click", () => verFoto(foto.id));

    card.querySelector(".photo-delete")
        .addEventListener("click", () => eliminarFoto(foto.id));

    return card;

}

export function subirFoto(indice) {

    if (indice <= 0) return;

    [state.fotos[indice - 1], state.fotos[indice]] =
        [state.fotos[indice], state.fotos[indice - 1]];

    renderizarFotos();
    programarAutoGuardado();

}

export function bajarFoto(indice) {

    if (indice >= state.fotos.length - 1) return;

    [state.fotos[indice + 1], state.fotos[indice]] =
        [state.fotos[indice], state.fotos[indice + 1]];

    renderizarFotos();
    programarAutoGuardado();

}

export function eliminarFoto(id) {

    const foto = state.fotos.find(item => item.id === id);

    // Si la foto ya estaba subida a Storage (tiene url), hay que borrarla
    // de ahí también cuando se guarde; si es una foto nueva que nunca se
    // subió, con quitarla del arreglo local basta.
    if (foto?.url) {
        state.fotosEliminadas.push(foto);
    }

    state.fotos = state.fotos.filter(foto => foto.id !== id);

    renderizarFotos();
    programarAutoGuardado();

}

export function obtenerFoto(id) {
    return state.fotos.find(foto => foto.id === id);
}

function verFoto(id) {

    const foto = obtenerFoto(id);
    if (!foto) return;

    const modal = document.getElementById("photoPreviewModal");
    const imagen = document.getElementById("photoPreviewImage");
    if (!modal || !imagen) return;

    imagen.src = foto.imagen;
    modal.classList.add("show");

}

export function cerrarVistaFoto() {

    const modal = document.getElementById("photoPreviewModal");
    if (!modal) return;

    modal.classList.remove("show");

}

export function actualizarContadorFotos() {

    const contador = document.getElementById("photoCounter");
    if (!contador) return;

    contador.textContent = `${state.fotos.length} / ${APP.MAX_FOTOS}`;

}

export function hayFotos() {
    return state.fotos.length > 0;
}

export function cantidadFotos() {
    return state.fotos.length;
}

export function limpiarFotos() {
    state.fotos = [];
    state.fotosEliminadas = [];
    renderizarFotos();
}
