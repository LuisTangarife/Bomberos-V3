/* ========================================================================
   FOTOS.JS
   Módulo Ayudas Humanitarias — Foto única de evidencia de la entrega

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

export function inicializarFotoEntrega() {

    const input = document.getElementById("fotoEntregaInput");
    if (!input) return;

    input.addEventListener("change", manejarSeleccionFoto);

    const btnCamara = document.getElementById("btnFotoCamara");
    const btnGaleria = document.getElementById("btnFotoGaleria");

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

    renderizarFotoEntrega();

}

async function manejarSeleccionFoto(e) {

    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después de quitarlo

    if (!archivo || !archivo.type.startsWith("image/")) return;

    try {

        const comprimida = await comprimirImagen(archivo);
        state.foto = await convertirBase64(comprimida);

    } catch (error) {
        console.error("No se pudo procesar la foto de la entrega:", error);
        alert("No se pudo cargar la foto. Intenta con otra imagen.");
        return;
    }

    renderizarFotoEntrega();

}

async function comprimirImagen(file) {

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

function convertirBase64(file) {

    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(file);
    });

}

export function renderizarFotoEntrega() {

    const contenedor = document.getElementById("fotoEntregaPreview");
    if (!contenedor) return;

    if (!state.foto) {

        contenedor.classList.remove("tiene-foto");
        contenedor.innerHTML = `
            <div class="foto-entrega-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>Aún no hay foto de esta entrega</span>
            </div>
        `;
        return;

    }

    contenedor.classList.add("tiene-foto");
    contenedor.innerHTML = `
        <img src="${state.foto}" alt="Foto de la entrega">
        <button type="button" class="foto-entrega-quitar" title="Quitar foto">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    contenedor.querySelector(".foto-entrega-quitar")
        .addEventListener("click", quitarFotoEntrega);

}

export function quitarFotoEntrega() {
    state.foto = null;
    renderizarFotoEntrega();
}
