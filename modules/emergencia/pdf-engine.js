/*=========================================================
 PDF ENGINE
 Convierte el HTML del certificado (plantilla1.html ya
 diligenciada, misma vista que produce buildCertificateHTML
 en certificados.js) en un archivo PDF real, usando html2pdf
 (que internamente combina html2canvas + jsPDF).

 Por qué no se genera el PDF directamente desde plantilla1.docx:
 no existe una librería gratuita client-side que convierta un
 .docx a PDF con fidelidad visual real (eso requiere un motor
 de renderizado de Word — LibreOffice headless, Google Drive
 API, etc. — es decir, un servidor, y este proyecto no tiene
 uno desplegado para eso). plantilla1.html es la réplica A4 de
 la misma carta oficial, así que el PDF resultante es visualmente
 igual al que produciría el Word, pero generado 100% en el
 navegador con lo que ya está cargado en la página.

 Esta es la misma técnica que ya usaba app.js en
 generatePDFBase64() para adjuntar el PDF al guardar en
 Firestore — este archivo la generaliza para poder generar el
 PDF de CUALQUIER emergencia (no solo el formulario abierto) y
 devolver un Blob reutilizable para mostrar o descargar.
=========================================================*/

// Espera a que todas las imágenes dentro del contenedor (firmas, fotos
// adjuntas, QR de verificación) terminen de cargar antes de rasterizar.
// Si html2canvas captura la vista antes de que una imagen cargue, esa
// imagen sale en blanco en el PDF final — un bug silencioso y difícil
// de detectar en pruebas rápidas porque casi siempre carga a tiempo en
// conexiones rápidas.
function esperarImagenes(contenedor) {

    const imagenes = Array.from(contenedor.querySelectorAll('img'));

    if (!imagenes.length) return Promise.resolve();

    return Promise.all(imagenes.map(img => {

        if (img.complete) return Promise.resolve();

        return new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });

    }));

}

/**
 * Genera un PDF real a partir de un fragmento HTML.
 *
 * @param {string} html            HTML completo del certificado (con su
 *                                 propio <style> interno, tal como lo
 *                                 devuelve buildCertificateHTML).
 * @param {string} [nombreArchivo] Nombre sugerido para el archivo.
 * @returns {Promise<Blob>} el PDF como Blob (application/pdf).
 */
export async function generarPDFBlob(html, nombreArchivo = 'certificado.pdf') {

    if (typeof window.html2pdf !== 'function') {
        throw new Error('La librería html2pdf no está cargada en esta página.');
    }

    const contenedor = document.createElement('div');

    // Se renderiza fuera de la pantalla (no oculto con display:none,
    // que impediría que html2canvas mida el layout real) mientras se
    // genera el PDF, y se elimina del DOM al terminar.
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-99999px';
    contenedor.style.top = '0';
    contenedor.style.zIndex = '-1';
    contenedor.innerHTML = html;

    document.body.appendChild(contenedor);

    try {

        await esperarImagenes(contenedor);

        const blob = await window.html2pdf()
            .set({

                margin: 0,

                filename: nombreArchivo,

                image: { type: 'jpeg', quality: 1 },

                html2canvas: { scale: 2, useCORS: true },

                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }

            })
            .from(contenedor)
            .outputPdf('blob');

        return blob;

    } finally {

        contenedor.remove();

    }

}
