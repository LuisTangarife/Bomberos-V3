/* ========================================================================
   FOTOS.JS
   Módulo Censos — Foto única de evidencia del censo

   Mismo mecanismo de compresión que modules/inspecciones/fotos.js, pero
   simplificado a UNA sola foto (no una galería reordenable): este
   formulario no usa Firebase Storage, todo viaja como base64 dentro
   del documento de Firestore (igual que las firmas), así que la
   compresión es obligatoria, no opcional.
======================================================================== */

import { state } from "./estado.js";

// Mismos valores que Inspecciones sin Storage (APP.USAR_STORAGE = false):
// 800px de ancho máximo y calidad 0.5. Con una sola foto en vez de hasta
// 50, hay más margen, pero el límite duro de 1 MiB por documento de
// Firestore sigue ahí — y ya comparte espacio con dos firmas.
const FOTO_ANCHO_MAXIMO = 800;
const FOTO_CALIDAD_JPEG = 0.5;

export function inicializarFotoCenso() {

    const input = document.getElementById("fotoCensoInput");
    if (!input) return;

    input.addEventListener("change", manejarSeleccionFotoCenso);

    const btnCamara = document.getElementById("btnFotoCensoCamara");
    const btnGaleria = document.getElementById("btnFotoCensoGaleria");

    if (btnCamara) {
        btnCamara.addEventListener("click", () => {
            input.setAttribute("capture", "environment");
            input.click();
        });
    }

    if (btnGaleria) {
        btnGaleria.addEventListener("click", () => {
            input.removeAttribute("capture");
            input.click();
        });
    }

    renderizarFotoCenso();

}

async function manejarSeleccionFotoCenso(e) {

    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después de quitarlo

    if (!archivo || !archivo.type.startsWith("image/")) return;

    try {

        const comprimida = await comprimirImagenCenso(archivo);
        state.foto = await convertirBase64Censo(comprimida);

    } catch (error) {
        console.error("No se pudo procesar la foto del censo:", error);
        alert("No se pudo cargar la foto. Intenta con otra imagen.");
        return;
    }

    renderizarFotoCenso();

}

async function comprimirImagenCenso(file) {

    try {

        const bitmap = await createImageBitmap(file);

        const escala = Math.min(1, FOTO_ANCHO_MAXIMO / bitmap.width);
        const ancho = Math.round(bitmap.width * escala);
        const alto = Math.round(bitmap.height * escala);

        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;

        canvas.getContext("2d").drawImage(bitmap, 0, 0, ancho, alto);

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/jpeg", FOTO_CALIDAD_JPEG)
        );

        if (!blob || blob.size >= file.size) return file; // no ganamos nada, usar el original

        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });

    } catch (error) {
        console.error("No se pudo comprimir la foto, se usará el archivo original:", error);
        return file;
    }

}

function convertirBase64Censo(file) {

    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(file);
    });

}

export function renderizarFotoCenso() {

    const contenedor = document.getElementById("fotoCensoPreview");
    if (!contenedor) return;

    if (!state.foto) {

        contenedor.classList.remove("tiene-foto");
        contenedor.innerHTML = `
            <div class="foto-censo-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>Aún no hay foto de este censo</span>
            </div>
        `;
        return;

    }

    contenedor.classList.add("tiene-foto");
    contenedor.innerHTML = `
        <img src="${state.foto}" alt="Foto de la entrega">
        <button type="button" class="foto-censo-quitar" title="Quitar foto">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    contenedor.querySelector(".foto-censo-quitar")
        .addEventListener("click", quitarFotoCenso);

}

export function quitarFotoCenso() {
    state.foto = null;
    renderizarFotoCenso();
}
