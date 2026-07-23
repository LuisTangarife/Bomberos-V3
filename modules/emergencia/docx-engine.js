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
 * Genera el Word oficial (plantilla1.docx ya diligenciada) y dispara
 * su descarga en el navegador.
 *
 * @param {object} data    Mismos datos de la emergencia que usa el
 *                         certificado HTML (buildCertificateHTML).
 * @param {string} [docNum] Identificador del reporte. Si no se pasa,
 *                         se genera uno nuevo — pero para que el número
 *                         que ve el usuario en pantalla coincida con el
 *                         del archivo descargado, quien llama a esta
 *                         función debería reutilizar el mismo docNum
 *                         que ya se usó para el certificado en HTML.
 * @returns {Promise<string>} el nombre de archivo generado.
 */
export async function generarDocumentoWord(data, docNum) {

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

    if (typeof window.saveAs === 'function') {
        window.saveAs(blob, nombreArchivo);
    } else {
        // Alternativa sin depender de FileSaver.js, por si esa librería
        // no llegó a cargar en la página.
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    cerrarDocumento();

    return nombreArchivo;

}
