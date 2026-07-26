/*=========================================================
 DOCX ENGINE
 Similar a DocumentApp del Apps Script

 IMPORTANTE: plantilla1.docx usa marcadores con DOBLE llave
 ({{REPORTE_ID}}, {{FECHA}}, etc. — igual que plantilla1.html
 y que el patrón de Apps Script). docxtemplater por defecto
 espera llave simple ({REPORTE_ID}), así que hay que declarar
 los delimitadores explícitamente o el render lanza error de
 sintaxis contra la plantilla real.
=========================================================*/

import { cargarPlantillaDOCX } from "./template-loader.js";
import { crearContexto } from "./placeholder-engine.js";

let doc = null;

export async function abrirDocumento() {

    const zip = await cargarPlantillaDOCX();

    doc = new window.docxtemplater(zip, {

        paragraphLoop: true,

        linebreaks: true,

        delimiters: { start: "{{", end: "}}" }

    });

    return doc;

}

export function obtenerDocumento(){

    return doc;

}

export function cerrarDocumento(){

    doc = null;

}

/**
 * Genera el Word oficial (plantilla1.docx ya diligenciada) y devuelve
 * el Blob resultante, SIN descargarlo. Separado de la descarga para
 * poder reutilizar el mismo Blob tanto para mostrarlo en el modal
 * (docx-preview) como para el botón "Descargar Word" — antes cada uno
 * generaba su propio documento por separado (uno en HTML, otro en
 * Word real), lo cual es exactamente lo que se quería dejar de hacer:
 * ahora hay un solo documento generado, mostrado y descargado.
 *
 * @param {object} data     Mismos datos de la emergencia.
 * @param {string} [docNum] Identificador del reporte. Si no se pasa,
 *                          se genera uno nuevo.
 * @returns {Promise<{blob: Blob, nombreArchivo: string}>}
 */
export async function generarDocumentoWordBlob(data, docNum) {

    const contexto = crearContexto(data, docNum);

    const documento = await abrirDocumento();

    try {

        documento.render(contexto);

    } catch (error) {

        // docxtemplater agrupa varios errores de renderizado dentro de
        // error.properties.errors; sin desempacarlos, el mensaje por
        // defecto ("Multi error") no dice nada útil para depurar.
        const detalles = error.properties && Array.isArray(error.properties.errors)
            ? error.properties.errors
                .map(e => e.properties && e.properties.explanation)
                .filter(Boolean)
                .join('; ')
            : '';

        console.error('[docx-engine] Error generando el documento Word:', error, detalles);

        cerrarDocumento();

        throw new Error(
            'No fue posible generar el documento Word' + (detalles ? (': ' + detalles) : '.')
        );

    }

    // toBlob() está disponible desde docxtemplater@3.62.0; evita tener
    // que pasar por zip.generate() manualmente.
    const blob = documento.toBlob();

    const nombreArchivo = `Reporte_${contexto.REPORTE_ID}.docx`;

    cerrarDocumento();

    return { blob, nombreArchivo };

}

/**
 * Dispara la descarga de un Blob ya generado (por generarDocumentoWordBlob).
 */
export function descargarBlobWord(blob, nombreArchivo) {

    if (typeof window.saveAs === 'function') {
        window.saveAs(blob, nombreArchivo);
        return;
    }

    // Alternativa sin depender de FileSaver.js, por si esa librería no
    // llegó a cargar en la página.
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);

}

/**
 * Atajo de compatibilidad: genera Y descarga en un solo paso, por si
 * algo necesita el comportamiento anterior sin mostrar el documento
 * primero en pantalla.
 */
export async function generarDocumentoWord(data, docNum) {
    const { blob, nombreArchivo } = await generarDocumentoWordBlob(data, docNum);
    descargarBlobWord(blob, nombreArchivo);
    return nombreArchivo;
}

/**
 * Renderiza un Blob .docx dentro de un contenedor del DOM usando
 * docx-preview (librería externa, global `window.docx`). Esto es lo
 * que permite que el modal muestre el MISMO documento Word que se
 * descarga — no una réplica en HTML mantenida por separado.
 *
 * @param {Blob} blob
 * @param {HTMLElement} contenedor  Elemento donde se inserta el HTML
 *                                  generado a partir del .docx.
 */
/**
 * Prepara una COPIA del .docx exclusivamente para mostrarla con
 * docx-preview — nunca se usa para el archivo que se descarga.
 *
 * Por qué existe: al inspeccionar plantilla1.docx se confirmó que la
 * sección tiene tres referencias de encabezado/pie (default/first/even
 * — Word las escribe siempre) pero NO tiene activado <w:titlePg/> ni
 * <w:evenAndOddHeaders/>. Eso significa que Word, al abrir el archivo,
 * usa ÚNICAMENTE el encabezado/pie "default" (que además es el que
 * contiene los logos — su header2.xml pesa ~12 KB contra ~3 KB de los
 * otros dos). docx-preview no parece aplicar esa misma regla: puede
 * terminar usando el encabezado "first" (sin logos) y/o generando
 * páginas de más a partir de esas referencias que Word ignora.
 *
 * La solución es quitar las referencias "first" y "even" de esta copia
 * antes de pasarla a docx-preview, para que no quede ambigüedad posible
 * sobre qué encabezado usar — exactamente el comportamiento real de
 * Word para este documento. El .docx descargable NO se toca: conserva
 * las tres variantes intactas por si algún día se activa esa opción
 * en Word.
 *
 * @param {Blob} blob  El .docx ya generado (sin modificar).
 * @returns {Promise<Blob>} copia normalizada para la vista previa.
 */
export async function prepararBlobParaVistaPrevia(blob) {

    try {

        const buffer = await blob.arrayBuffer();
        const zip = new PizZip(buffer);

        const rutaDocumento = 'word/document.xml';
        const parte = zip.file(rutaDocumento);

        if (!parte) {
            // Estructura inesperada: se devuelve el original sin tocar
            // en vez de fallar la vista previa por completo.
            return blob;
        }

        let xml = parte.asText();

        xml = xml.replace(/<w:headerReference[^>]*w:type="(first|even)"[^>]*\/>/g, '');
        xml = xml.replace(/<w:footerReference[^>]*w:type="(first|even)"[^>]*\/>/g, '');

        zip.file(rutaDocumento, xml);

        return zip.generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error) {

        // Si algo sale mal normalizando, es mejor mostrar el original
        // (con el posible problema de encabezados) que no mostrar nada.
        console.error('[docx-engine] No se pudo normalizar el docx para la vista previa, se usa el original:', error);
        return blob;

    }

}

export async function renderizarDocxEnContenedor(blob, contenedor) {

    if (typeof window.docx === 'undefined' || typeof window.docx.renderAsync !== 'function') {
        throw new Error('La librería docx-preview no está cargada en esta página.');
    }

    contenedor.innerHTML = '';

    await window.docx.renderAsync(blob, contenedor, contenedor, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        experimental: true,
        useBase64URL: false,
        renderHeaders: true,
        renderFooters: true,
        // <w:lastRenderedPageBreak/> refleja cómo se veía el documento
        // la última vez que se abrió en Word, no cómo se ve aquí — si
        // se respeta, puede introducir saltos de página que no
        // corresponden a un salto real, generando páginas de más.
        ignoreLastRenderedPageBreak: true
    });

}
