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

 NOTA: tras varias vueltas intentando ocultar el contenedor
 (fixed con z-index negativo, offsets negativos enormes,
 posicionarlo fuera del viewport con scroll) descubrimos que
 html2canvas calcula mal la región a capturar en TODOS esos
 casos (compensación de scroll interna, límites de canvas,
 etc.), produciendo capturas en blanco o con contenido mal
 recortado. La única forma que realmente funciona de manera
 confiable es renderizar el contenedor en (0,0), dentro del
 viewport real, por encima incluso del modal — a costa de un
 parpadeo visual breve mientras se captura.
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

    // Se renderiza EN (0,0), dentro del viewport real, con un z-index
    // por encima del modal (#certModal usa z-index:1000) para que
    // html2canvas lo capture sin ningún cálculo especial de scroll u
    // offset — es el único posicionamiento con el que html2canvas
    // captura el contenido real de forma confiable. El costo es un
    // parpadeo visual breve del certificado antes de que se muestre
    // el modal con el PDF ya listo.
    contenedor.style.position = 'fixed';
    contenedor.style.top = '0';
    contenedor.style.left = '0';
    contenedor.style.zIndex = '2147483647'; // por encima de TODO, incluido el modal
    contenedor.style.background = '#fff';
    contenedor.style.pointerEvents = 'none';
    contenedor.innerHTML = html;

    document.body.appendChild(contenedor);

    const canvas = await window.html2canvas(contenedor, { scale: 2, useCORS: true });
   
    try {
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        console.log('[debug] toDataURL OK, longitud:', dataUrl.length);
    } catch (err) {
        console.error('[debug] toDataURL FALLÓ (canvas contaminado):', err);
    }

    try {

        await esperarImagenes(contenedor);

        const blob = await window.html2pdf()
            .set({

                margin: 0,
                filename: nombreArchivo,
                image: { type: 'jpeg', quality: 1 },

                html2canvas: {
                    scale: 2,
                    useCORS: true
                    // sin x/y/windowWidth/windowHeight manuales: al estar
                    // en (0,0) dentro del viewport real, html2canvas mide
                    // y captura el contenedor correctamente por sí solo.
                },

                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }

            })
            .from(contenedor)
            .outputPdf('blob');

        console.log('[debug] blob size/type:', blob.size, blob.type);
        return blob;

    } finally {

        contenedor.remove();

    }

}
