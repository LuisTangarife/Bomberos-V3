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
 * Por qué existe: los logos están en el encabezado (header2.xml, el de
 * tipo "default") con SUS PROPIAS imágenes, distintas a las del cuerpo
 * (image2.png/image3.jpg/image7.png/image8.png en el encabezado, contra
 * image1.png/image9.png/image4.png en el cuerpo — solo image4.png se
 * repite). docx-preview no dibuja de forma confiable imágenes que vienen
 * de un encabezado, sin importar cuál esté activo — es una limitación
 * conocida de la librería, no un problema de "encabezado equivocado".
 *
 * La solución: tomar el contenido del encabezado "default" (los
 * párrafos con los logos) y copiarlo al PRINCIPIO del cuerpo de esta
 * copia, remapeando las relaciones r:embed a nuevos ids agregados a
 * document.xml.rels — así docx-preview las trata como imágenes
 * normales del cuerpo, que sí renderiza bien. El .docx que se descarga
 * NO se toca: sigue teniendo el encabezado real de Word, repetido en
 * cada página, tal como debe ser un documento oficial.
 *
 * Limitación conocida: si el encabezado usa imágenes ancladas con
 * posición absoluta pensada para la zona de encabezado, puede que en
 * el cuerpo no queden centradas exactamente igual. Es una vista previa
 * aproximada, no un reemplazo pixel-perfecto del Word real.
 *
 * @param {Blob} blob  El .docx ya generado (sin modificar).
 * @returns {Promise<Blob>} copia con los logos movidos al cuerpo, para
 *                          usar SOLO en la vista previa.
 */
export async function prepararBlobParaVistaPrevia(blob) {

    try {

        const buffer = await blob.arrayBuffer();
        const zip = new PizZip(buffer);

        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const rutaDocumento = 'word/document.xml';
        const rutaRelsDocumento = 'word/_rels/document.xml.rels';

        const parteDocumento = zip.file(rutaDocumento);
        const parteRelsDocumento = zip.file(rutaRelsDocumento);

        if (!parteDocumento || !parteRelsDocumento) {
            return blob; // estructura inesperada: mostrar el original tal cual
        }

        const xmlDocumento = parser.parseFromString(parteDocumento.asText(), 'application/xml');
        const xmlRelsDocumento = parser.parseFromString(parteRelsDocumento.asText(), 'application/xml');

        // 1) Encontrar el r:id del encabezado "default" en la sección.
        const refEncabezadoDefault = Array.from(
            xmlDocumento.getElementsByTagNameNS('*', 'headerReference')
        ).find(ref => ref.getAttributeNS(
            'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'type'
        ) === 'default');

        if (!refEncabezadoDefault) {
            return blob; // no hay encabezado default: nada que mover
        }

        const rIdEncabezado = refEncabezadoDefault.getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'
        );

        // 2) De document.xml.rels, sacar a qué archivo (headerN.xml)
        // apunta ese r:id.
        const relEncabezado = Array.from(xmlRelsDocumento.getElementsByTagName('Relationship'))
            .find(r => r.getAttribute('Id') === rIdEncabezado);

        if (!relEncabezado) return blob;

        const archivoEncabezado = 'word/' + relEncabezado.getAttribute('Target');
        const nombreEncabezado = archivoEncabezado.split('/').pop();
        const rutaRelsEncabezado = 'word/_rels/' + nombreEncabezado + '.rels';

        const parteEncabezado = zip.file(archivoEncabezado);
        const parteRelsEncabezado = zip.file(rutaRelsEncabezado);

        if (!parteEncabezado) return blob;

        const xmlEncabezado = parser.parseFromString(parteEncabezado.asText(), 'application/xml');

        // 3) Mapa de relaciones DEL encabezado (rId local -> Target),
        // para poder remapearlas a nuevas relaciones del documento.
        const relsEncabezadoPorId = {};
        if (parteRelsEncabezado) {
            const xmlRelsEncabezado = parser.parseFromString(parteRelsEncabezado.asText(), 'application/xml');
            Array.from(xmlRelsEncabezado.getElementsByTagName('Relationship')).forEach(r => {
                relsEncabezadoPorId[r.getAttribute('Id')] = r;
            });
        }

        // 4) Por cada imagen que use el encabezado, agregar una nueva
        // relación en document.xml.rels con un id que no exista ya, y
        // reescribir el r:embed correspondiente en los nodos clonados.
        const idsYaUsados = new Set(
            Array.from(xmlRelsDocumento.getElementsByTagName('Relationship'))
                .map(r => r.getAttribute('Id'))
        );

        let siguienteId = 9001;
        const mapaRemapeoIds = {}; // rId del encabezado -> rId nuevo en el documento

        const nsRelationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const embeds = xmlEncabezado.getElementsByTagNameNS('*', 'blip');

        Array.from(embeds).forEach(blip => {
            const rIdOriginal = blip.getAttributeNS(nsRelationships, 'embed');
            if (!rIdOriginal || mapaRemapeoIds[rIdOriginal]) return;

            const relOriginal = relsEncabezadoPorId[rIdOriginal];
            if (!relOriginal) return;

            let nuevoId = 'rId' + siguienteId;
            while (idsYaUsados.has(nuevoId)) {
                siguienteId++;
                nuevoId = 'rId' + siguienteId;
            }
            idsYaUsados.add(nuevoId);
            siguienteId++;

            mapaRemapeoIds[rIdOriginal] = nuevoId;

            const nuevaRelacion = xmlRelsDocumento.createElement('Relationship');
            nuevaRelacion.setAttribute('Id', nuevoId);
            nuevaRelacion.setAttribute('Type', relOriginal.getAttribute('Type'));
            nuevaRelacion.setAttribute('Target', relOriginal.getAttribute('Target'));
            xmlRelsDocumento.documentElement.appendChild(nuevaRelacion);
        });

        // 5) Aplicar el remapeo de ids sobre los <a:blip r:embed="..."/>
        // sacados del encabezado.
        Array.from(embeds).forEach(blip => {
            const rIdOriginal = blip.getAttributeNS(nsRelationships, 'embed');
            if (rIdOriginal && mapaRemapeoIds[rIdOriginal]) {
                blip.setAttributeNS(nsRelationships, 'r:embed', mapaRemapeoIds[rIdOriginal]);
            }
        });

        // 6) Clonar los párrafos del encabezado (con los logos ya
        // remapeados) e insertarlos al principio del cuerpo del
        // documento, antes del primer párrafo existente.
        const parrafosEncabezado = Array.from(xmlEncabezado.documentElement.childNodes)
            .filter(nodo => nodo.nodeType === 1); // solo elementos, sin texto/comentarios sueltos

        if (parrafosEncabezado.length > 0) {
            const cuerpo = xmlDocumento.getElementsByTagNameNS('*', 'body')[0];
            const primerHijo = cuerpo.firstChild;

            parrafosEncabezado.forEach(parrafo => {
                const clon = xmlDocumento.importNode(parrafo, true);
                cuerpo.insertBefore(clon, primerHijo);
            });
        }

        // 7) Volver a guardar document.xml y document.xml.rels en el zip.
        zip.file(rutaDocumento, serializer.serializeToString(xmlDocumento));
        zip.file(rutaRelsDocumento, serializer.serializeToString(xmlRelsDocumento));

        return zip.generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

    } catch (error) {

        // Si algo sale mal moviendo los logos, es mejor mostrar el
        // original (sin logos) que no mostrar nada.
        console.error('[docx-engine] No se pudo mover el encabezado al cuerpo para la vista previa, se usa el original:', error);
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
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true,
        // <w:lastRenderedPageBreak/> refleja cómo se veía el documento
        // la última vez que se abrió en Word, no cómo se ve aquí — si
        // se respeta, puede introducir saltos de página que no
        // corresponden a un salto real, generando páginas de más.
        ignoreLastRenderedPageBreak: true
    });

    // Diagnóstico: cuántas "páginas" quedaron realmente en el DOM.
    // Si esto marca más de 1 para un certificado que debería ser de una
    // sola página, el problema está en el render (o en la plantilla),
    // no en la impresión — revisar en la consola del navegador.
    const paginasRenderizadas = contenedor.querySelectorAll('.docx-preview > section, .docx-preview > .docx-page, [class*="page"]').length;
    console.log('[docx-engine] Páginas renderizadas por docx-preview:', paginasRenderizadas);

}
