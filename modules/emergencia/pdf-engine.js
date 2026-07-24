/*=========================================================
 PDF ENGINE
 Convierte el HTML del certificado en un PDF real usando
 html2canvas + jsPDF DIRECTAMENTE (no a través del pipeline
 .outputPdf() de html2pdf.js).

 POR QUÉ: html2pdf.js v0.10.1 (la versión cargada en
 gestor.html/index.html vía cdnjs) tiene un bug conocido y
 reconocido por los propios mantenedores («There have been
 several issues reported in v0.10») donde .outputPdf('blob')
 devuelve un PDF vacío pese a que html2canvas capturó todo
 correctamente — lo confirmamos: canvas.toDataURL() daba
 ~940KB de imagen real, pero el blob final de html2pdf
 siempre salía en 3058 bytes (una página en blanco).

 html2canvas y jsPDF SÍ vienen empaquetados dentro de
 html2pdf.bundle.min.js y quedan disponibles globalmente
 (window.html2canvas y window.jspdf.jsPDF), así que no hace
 falta agregar ningún <script> nuevo — solo dejamos de pasar
 por el método roto de html2pdf.
=========================================================*/

// Espera a que todas las imágenes dentro del contenedor (firmas, fotos
// adjuntas, QR de verificación) terminen de cargar antes de rasterizar.
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
 * @param {string} html            HTML completo del certificado.
 * @param {string} [nombreArchivo] Nombre sugerido para el archivo.
 * @returns {Promise<Blob>} el PDF como Blob (application/pdf).
 */
export async function generarPDFBlob(html, nombreArchivo = 'certificado.pdf') {

    if (typeof window.html2canvas !== 'function') {
        throw new Error('La librería html2canvas no está cargada en esta página.');
    }

    const JsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

    if (typeof JsPDFCtor !== 'function') {
        throw new Error('No se encontró el constructor de jsPDF en esta página.');
    }

    const contenedor = document.createElement('div');

    // (0,0), dentro del viewport real — la única forma con la que
    // html2canvas capturó el contenido de manera confiable en nuestras
    // pruebas. Implica un parpadeo visual breve del certificado.
    contenedor.style.position = 'fixed';
    contenedor.style.top = '0';
    contenedor.style.left = '0';
    contenedor.style.zIndex = '2147483647';
    contenedor.style.background = '#fff';
    contenedor.style.pointerEvents = 'none';
    contenedor.innerHTML = html;

    document.body.appendChild(contenedor);

    try {

        await esperarImagenes(contenedor);

        const canvas = await window.html2canvas(contenedor, {
            scale: 2,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        const pdf = new JsPDFCtor({
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidthMM = pageWidth;
        const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;

        let alturaRestante = imgHeightMM;
        let posicionY = 0;

        // Primera página
        pdf.addImage(imgData, 'JPEG', 0, posicionY, imgWidthMM, imgHeightMM);
        alturaRestante -= pageHeight;

        // Páginas adicionales si el certificado es más largo que una A4
        while (alturaRestante > 0) {
            posicionY = alturaRestante - imgHeightMM;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, posicionY, imgWidthMM, imgHeightMM);
            alturaRestante -= pageHeight;
        }

        return pdf.output('blob');

    } finally {

        contenedor.remove();

    }

}
