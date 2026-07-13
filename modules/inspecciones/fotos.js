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

    const base64 = await convertirBase64(file);

    state.fotos.push({
        id: crypto.randomUUID(),
        nombre: file.name,
        tipo: file.type,
        peso: file.size,
        fecha: Date.now(),
        // "imagen" se usa para la vista previa mientras se edita el
        // formulario. Al guardar, persistencia.js sube "archivo" a
        // Firebase Storage y reemplaza "imagen" por la URL resultante,
        // para no meter fotos completas en base64 dentro del documento
        // de Firestore (eso es lo que hacía que guardar y listar fuera
        // lentísimo).
        imagen: base64,
        archivo: file,
        url: null
    });

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
