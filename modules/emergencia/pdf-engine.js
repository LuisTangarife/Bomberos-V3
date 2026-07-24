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

 === DIAGNÓSTICO TEMPORAL ===
 Mientras depuramos el bug del PDF en blanco, esta versión NO
 genera el PDF final: captura con html2canvas y muestra el
 canvas resultante directamente en pantalla (borde rojo), para
 ver a simple vista si html2canvas está capturando el contenido
 real o algo en blanco. Una vez resuelto, hay que restaurar el
 flujo normal con html2pdf().
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

    contenedor.style.position = 'absolute';
    contenedor.style.left = '0';
    contenedor.style.top = document.documentElement.scrollHeight + 'px'; // debajo de todo el contenido actual
    contenedor.style.pointerEvents = 'none';
    contenedor.innerHTML = html;

    document.body.appendChild(contenedor);

    console.log('[debug] contenedor width/height:', contenedor.offsetWidth, contenedor.offsetHeight);
    console.log('[debug] contenedor rect JSON:', JSON.stringify(contenedor.getBoundingClientRect()));

    try {

        await esperarImagenes(contenedor);

        const rect = contenedor.getBoundingClientRect();

        // ===== BLOQUE DE DIAGNÓSTICO TEMPORAL =====
        // html2canvas está disponible como window.html2canvas porque
        // html2pdf.js lo trae empaquetado internamente.
        const canvas = await window.html2canvas(contenedor, {
            scale: 2,
            useCORS: true,
            x: 0,
            y: rect.top,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: rect.bottom + 50
        });

        console.log('[debug] canvas capturado:', canvas.width, canvas.height);

        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '999999';
        canvas.style.border = '5px solid red';
        canvas.style.maxWidth = '90vw';
        canvas.style.maxHeight = '90vh';
        canvas.style.background = '#fff';

        document.body.appendChild(canvas);

        return null; // corta aquí temporalmente — no se genera el PDF final todavía
        // ===== FIN BLOQUE DE DIAGNÓSTICO =====

        /* ===== FLUJO NORMAL (restaurar cuando terminemos el diagnóstico) =====
        const blob = await window.html2pdf()
            .set({

                margin: 0,
                filename: nombreArchivo,
                image: { type: 'jpeg', quality: 1 },

                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    x: 0,
                    y: rect.top,
                    windowWidth: document.documentElement.scrollWidth,
                    windowHeight: rect.bottom + 50
                },

                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }

            })
            .from(contenedor)
            .outputPdf('blob');

        return blob;
        ===== FIN FLUJO NORMAL ===== */

    } finally {

        contenedor.remove();

    }

}
