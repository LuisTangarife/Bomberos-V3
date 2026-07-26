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
// Devuelve la ruta real (ej. "word/header2.xml") del header referenciado
// como w:type="default" en document.xml, resolviéndola contra
// word/_rels/document.xml.rels — así no se asume que siempre se llame
// header2.xml, por si la plantilla se vuelve a guardar en Word y los
// nombres de parte cambian.
function obtenerRutaHeaderPorDefecto(zip, xmlDocumento) {

    try {

        const matchRef = xmlDocumento.match(
            /<w:headerReference\b[^>]*w:type="default"[^>]*r:id="(rId\d+)"[^>]*\/>/
        ) || xmlDocumento.match(
            /<w:headerReference\b[^>]*r:id="(rId\d+)"[^>]*w:type="default"[^>]*\/>/
        );

        if (!matchRef) return null;

        const rId = matchRef[1];
        const parteRels = zip.file('word/_rels/document.xml.rels');

        if (!parteRels) return null;

        const xmlRels = parteRels.asText();
        const matchTarget = xmlRels.match(
            new RegExp(`<Relationship\\b[^>]*Id="${rId}"[^>]*Target="([^"]+)"`)
        ) || xmlRels.match(
            new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rId}"`)
        );

        if (!matchTarget) return null;

        return `word/${matchTarget[1]}`;

    } catch (error) {
        console.error('[docx-engine] No se pudo resolver el header por defecto:', error);
        return null;
    }

}

/* =========================================================
   DESAGRUPADO DE IMÁGENES AGRUPADAS (wpg:wgp)

   El banner del encabezado y el sello de la firma están guardados
   en plantilla1.docx como un GRUPO de imágenes (lo que en Word se ve
   como una sola selección al agrupar varios objetos). Word y
   LibreOffice lo muestran sin problema, pero se confirmó revisando
   el código fuente de docx-preview que la librería NO tiene ningún
   soporte para grupos (wpg:wgp/grpSp) — ninguna coincidencia en todo
   el bundle. Por eso esas imágenes no aparecían en el modal aunque sí
   existieran en el archivo.

   Estas funciones "desarman" cada grupo en esta copia de vista previa:
   calculan la posición absoluta real de cada imagen (hay hasta dos
   niveles de anidamiento, wpg:wgp dentro de wpg:wgp) y las reinsertan
   como imágenes sueltas — el mismo formato que las imágenes que SÍ
   se veían bien (el escudo de fondo, el sello). El texto que pudiera
   haber dentro de un cuadro de texto agrupado (como el nombre y NIT de
   la firma del comandante) se rescata como texto plano: se pierde el
   negrita/centrado de ese bloque puntual, pero deja de desaparecer.

   Validado renderizando plantilla1.docx antes/después con LibreOffice
   y comparando pixel a pixel: la diferencia en el banner del
   encabezado es prácticamente cero.
========================================================= */

// Extrae "<etiqueta>...</etiqueta>" respetando anidamiento (una etiqueta
// del mismo tipo puede aparecer dentro de sí misma, como wpg:grpSp
// dentro de wpg:grpSp). Devuelve null si no hay cierre correspondiente.
function extraerBloqueBalanceado(xml, indiceApertura, apertura, cierre) {

    let profundidad = 0;
    let i = indiceApertura;

    while (i < xml.length) {

        if (xml.startsWith(apertura, i)) {
            profundidad++;
            i += apertura.length;
        } else if (xml.startsWith(cierre, i)) {
            profundidad--;
            i += cierre.length;
            if (profundidad === 0) return xml.slice(indiceApertura, i);
        } else {
            i++;
        }

    }

    return null;

}

// Lee el <a:xfrm> de un grupo o figura: posición/tamaño propios
// (off/ext) y, si es un grupo, el sistema de coordenadas de sus hijos
// (chOff/chExt). Si no trae chOff/chExt (una figura/imagen suelta, no
// un grupo), se asume igual a off/ext (sin transformación adicional).
function leerXfrmDeBloque(bloque) {

    const m = bloque.match(
        /<a:xfrm>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>\s*(?:<a:chOff x="(-?\d+)" y="(-?\d+)"\/>\s*<a:chExt cx="(\d+)" cy="(\d+)"\/>)?/
    );

    if (!m) return null;

    const off = { x: Number(m[1]), y: Number(m[2]) };
    const ext = { cx: Number(m[3]), cy: Number(m[4]) };
    const chOff = m[5] !== undefined ? { x: Number(m[5]), y: Number(m[6]) } : { ...off };
    const chExt = m[7] !== undefined ? { cx: Number(m[7]), cy: Number(m[8]) } : { ...ext };

    return { off, ext, chOff, chExt };

}

// Traduce un punto (x,y) del sistema de coordenadas "hijo" de un grupo
// (chOff/chExt) al sistema de coordenadas de su padre (off/ext) —
// fórmula estándar de transformación de grupos en DrawingML.
function mapearPunto(xfrm, x, y) {

    const escalaX = xfrm.chExt.cx ? xfrm.ext.cx / xfrm.chExt.cx : 1;
    const escalaY = xfrm.chExt.cy ? xfrm.ext.cy / xfrm.chExt.cy : 1;

    return {
        x: xfrm.off.x + (x - xfrm.chOff.x) * escalaX,
        y: xfrm.off.y + (y - xfrm.chOff.y) * escalaY
    };

}

function mapearTamano(xfrm, cx, cy) {

    const escalaX = xfrm.chExt.cx ? xfrm.ext.cx / xfrm.chExt.cx : 1;
    const escalaY = xfrm.chExt.cy ? xfrm.ext.cy / xfrm.chExt.cy : 1;

    return { cx: cx * escalaX, cy: cy * escalaY };

}

// Recorre un grupo (wpg:wgp o wpg:grpSp, con sus etiquetas incluidas)
// y devuelve cada imagen (pic:pic) que encuentra dentro — recursivo,
// para soportar un grupo dentro de otro grupo — YA reubicada en el
// sistema de coordenadas que contiene a ESTE bloque (su padre
// inmediato). Ignora figuras sin imagen (cuadros de texto vacíos,
// formas decorativas sin relleno).
function extraerImagenesDeGrupo(bloque) {

    const xfrmPropio = leerXfrmDeBloque(bloque);
    if (!xfrmPropio) return [];

    const imagenes = [];

    // Se arranca DESPUÉS de la propia etiqueta de apertura del bloque;
    // si se empezara en 0 se volvería a encontrar a sí mismo como si
    // fuera un hijo, y la recursión nunca terminaría.
    let i = bloque.indexOf('>') + 1;

    while (i < bloque.length) {

        const idxGrpSp = bloque.indexOf('<wpg:grpSp>', i);
        const idxPic = bloque.indexOf('<pic:pic>', i);

        if (idxPic !== -1 && (idxGrpSp === -1 || idxPic < idxGrpSp)) {

            const bloquePic = extraerBloqueBalanceado(bloque, idxPic, '<pic:pic>', '</pic:pic>');
            if (!bloquePic) break;

            const rIdMatch = bloquePic.match(/<a:blip r:embed="(rId\d+)"/);
            const xfrmPic = leerXfrmDeBloque(bloquePic);

            if (rIdMatch && xfrmPic) {
                const punto = mapearPunto(xfrmPropio, xfrmPic.off.x, xfrmPic.off.y);
                const tamano = mapearTamano(xfrmPropio, xfrmPic.ext.cx, xfrmPic.ext.cy);
                imagenes.push({ rId: rIdMatch[1], x: punto.x, y: punto.y, cx: tamano.cx, cy: tamano.cy });
            }

            i = idxPic + bloquePic.length;

        } else if (idxGrpSp !== -1) {

            const bloqueGrpSp = extraerBloqueBalanceado(bloque, idxGrpSp, '<wpg:grpSp>', '</wpg:grpSp>');
            if (!bloqueGrpSp) break;

            extraerImagenesDeGrupo(bloqueGrpSp).forEach(img => {
                const punto = mapearPunto(xfrmPropio, img.x, img.y);
                const tamano = mapearTamano(xfrmPropio, img.cx, img.cy);
                imagenes.push({ rId: img.rId, x: punto.x, y: punto.y, cx: tamano.cx, cy: tamano.cy });
            });

            i = idxGrpSp + bloqueGrpSp.length;

        } else break;

    }

    return imagenes;

}

// Junta el texto plano (sin formato) de cualquier cuadro de texto
// dentro del grupo — para no perder por completo, por ejemplo, el
// nombre y NIT de la firma del comandante.
function textoDeGrupo(bloque) {

    const runs = [...bloque.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).filter(Boolean);
    return runs.join(' ').trim();

}

let contadorIdDesagrupado = 90000;

function nuevoDrawingAnchor({ x, y, cx, cy, rId, behindDoc }) {

    const id = contadorIdDesagrupado++;

    return `<w:drawing><wp:anchor behindDoc="${behindDoc}" distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${id}" locked="0" layoutInCell="1" allowOverlap="1" hidden="0"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${Math.round(x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${Math.round(y)}</wp:posOffset></wp:positionV><wp:extent cx="${Math.round(cx)}" cy="${Math.round(cy)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="img-desagrupada-${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img-desagrupada-${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`;

}

// Busca todos los <mc:AlternateContent> de esta parte (header o
// document.xml) que envuelvan un grupo real (wpg:wgp) y los reemplaza
// por imágenes sueltas ya posicionadas de forma absoluta. Cualquier
// <mc:AlternateContent> que no traiga un grupo real dentro (hay otros
// usos de esa envoltura sin relación con grupos) se deja intacto.
function desagruparImagenesWpg(xmlParte) {

    let resultado = xmlParte;
    let indiceBusqueda = 0;

    while (true) {

        const idxAC = resultado.indexOf('<mc:AlternateContent>', indiceBusqueda);
        if (idxAC === -1) break;

        const bloqueAC = extraerBloqueBalanceado(resultado, idxAC, '<mc:AlternateContent>', '</mc:AlternateContent>');

        if (!bloqueAC) { indiceBusqueda = idxAC + 20; continue; }

        if (!bloqueAC.includes('Requires="wpg"')) {
            indiceBusqueda = idxAC + bloqueAC.length;
            continue;
        }

        const esAnchor = bloqueAC.includes('<wp:anchor');
        const tagCierre = esAnchor ? '</wp:anchor>' : '</wp:inline>';
        const idxWpStart = bloqueAC.indexOf(esAnchor ? '<wp:anchor' : '<wp:inline');
        const idxWpEnd = bloqueAC.indexOf(tagCierre, idxWpStart) + tagCierre.length;
        const bloqueWp = bloqueAC.slice(idxWpStart, idxWpEnd);

        const behindDoc = (bloqueWp.match(/behindDoc="(\d)"/) || [, '0'])[1];

        let baseX = 0, baseY = 0;
        if (esAnchor) {
            const mH = bloqueWp.match(/<wp:positionH[^>]*><wp:posOffset>(-?\d+)<\/wp:posOffset>/);
            const mV = bloqueWp.match(/<wp:positionV[^>]*><wp:posOffset>(-?\d+)<\/wp:posOffset>/);
            baseX = mH ? Number(mH[1]) : 0;
            baseY = mV ? Number(mV[1]) : 0;
        }

        const mExt = bloqueWp.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
        const extentCx = mExt ? Number(mExt[1]) : null;
        const extentCy = mExt ? Number(mExt[2]) : null;

        const idxWgpStart = bloqueWp.indexOf('<wpg:wgp>');

        if (idxWgpStart === -1) {
            // Declara Requires="wpg" pero no trae un grupo de imágenes
            // real dentro — se deja intacto.
            indiceBusqueda = idxAC + bloqueAC.length;
            continue;
        }

        const bloqueWgp = extraerBloqueBalanceado(bloqueWp, idxWgpStart, '<wpg:wgp>', '</wpg:wgp>');

        if (!bloqueWgp) {
            indiceBusqueda = idxAC + bloqueAC.length;
            continue;
        }

        const xfrmOuter = leerXfrmDeBloque(bloqueWgp);

        if (!xfrmOuter) {
            indiceBusqueda = idxAC + bloqueAC.length;
            continue;
        }

        const imagenesInternas = extraerImagenesDeGrupo(bloqueWgp);

        // Último paso: del sistema de coordenadas propio del wpg:wgp
        // exterior al sistema real del ancla (posOffset/extent),
        // tratando su off/ext como si fueran el chOff/chExt de este
        // último nivel.
        const nivelFinal = {
            off: { x: baseX, y: baseY },
            ext: { cx: extentCx ?? xfrmOuter.ext.cx, cy: extentCy ?? xfrmOuter.ext.cy },
            chOff: xfrmOuter.off,
            chExt: xfrmOuter.ext
        };

        const drawings = imagenesInternas.map(img => {
            const punto = mapearPunto(nivelFinal, img.x, img.y);
            const tamano = mapearTamano(nivelFinal, img.cx, img.cy);
            return nuevoDrawingAnchor({ x: punto.x, y: punto.y, cx: tamano.cx, cy: tamano.cy, rId: img.rId, behindDoc });
        });

        const texto = textoDeGrupo(bloqueWgp);
        const parrafoTexto = texto
            ? `<w:p><w:r><w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`
            : '';

        const reemplazo = drawings.join('') + parrafoTexto;

        resultado = resultado.slice(0, idxAC) + reemplazo + resultado.slice(idxAC + bloqueAC.length);
        indiceBusqueda = idxAC + reemplazo.length;

    }

    return resultado;

}

// docx-preview no resuelve "positionH relativeFrom=column" igual que
// Word cuando el párrafo que ancla la imagen está centrado
// (<w:jc w:val="center"/>): en vez de medir desde el borde real de la
// columna, mide desde donde cae el flujo de ESE párrafo — que en uno
// centrado es el centro de la página, no el margen. Resultado: una
// imagen anclada para quedar en el margen izquierdo termina flotando
// sobre el contenido central (ej. la franja decorativa sobre la firma).
//
// Arreglo: en párrafos que SOLO contienen un ancla con
// positionH relativeFrom="column" (sin texto real alrededor), se fuerza
// su <w:jc> a "left" en esta copia de vista previa — no cambia nada
// visible porque no hay texto en ese párrafo, pero alinea el punto de
// referencia del ancla con lo que Word usa realmente.
function corregirAnclasEnParrafosCentrados(xmlParte) {

    return xmlParte.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (parrafo) => {

        if (!parrafo.includes('<wp:anchor') || !parrafo.includes('relativeFrom="column"')) {
            return parrafo;
        }

        const tieneTextoVisible = /<w:t[ >][^<]*[^\s<][^<]*<\/w:t>/.test(parrafo);
        if (tieneTextoVisible) return parrafo;

        return parrafo.replace(/<w:jc w:val="center"\/>/g, '<w:jc w:val="left"/>');

    });

}

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

        // Desagrupar los grupos de imágenes (wpg:wgp) del cuerpo del
        // documento — ej. el sello junto al nombre del comandante en
        // la firma — antes de guardar el documento, para que
        // docx-preview (que no soporta grupos) pueda mostrarlos.
        xml = desagruparImagenesWpg(xml);

        xml = corregirAnclasEnParrafosCentrados(xml);

        zip.file(rutaDocumento, xml);

        // El banner y el escudo grande del encabezado están anclados en
        // Word como "Detrás del texto" (behindDoc="1"). Word apila esa
        // capa sin problema, pero docx-preview termina pintando esas
        // imágenes por debajo del propio fondo del encabezado: quedan en
        // el DOM (se pueden seleccionar/inspeccionar) pero invisibles.
        // Se localiza el header "default" real vía document.xml.rels en
        // vez de asumir el nombre de archivo (que Word puede renumerar
        // si la plantilla se vuelve a guardar), y se le fuerza
        // behindDoc="0" SOLO en esta copia de vista previa.
        const rutaHeaderDefault = obtenerRutaHeaderPorDefecto(zip, xml);

        if (rutaHeaderDefault) {
            const parteHeader = zip.file(rutaHeaderDefault);
            if (parteHeader) {
                let headerXml = parteHeader.asText();
                // OJO: no todas las imágenes "detrás del texto" del
                // encabezado deben pasar a "delante" por igual. Se
                // detectó que el sello institucional pequeño tiene un
                // wp:positionV de ~685pt respecto a su párrafo — un
                // offset que solo tiene sentido en el modelo de anclaje
                // real de Word, no en la aproximación simple de
                // docx-preview (position:relative desde el punto de
                // flujo del párrafo). Forzarlo a "delante" no lo pone en
                // su sitio: lo vuelve visible pero mal ubicado, dejando
                // un hueco enorme donde antes solo había una imagen
                // invisible e inofensiva. Por eso el flip a
                // behindDoc="0" se aplica SOLO a anclas cuyo offset es
                // pequeño (dentro de ~50pt / 635000 EMU) — el rango en el
                // que la aproximación de docx-preview sigue siendo
                // razonablemente correcta.
                headerXml = headerXml.replace(/<wp:anchor\b[^>]*behindDoc="1"[\s\S]*?<\/wp:anchor>/g, (anchorXml) => {

                    const mH = anchorXml.match(/<wp:positionH[^>]*><wp:posOffset>(-?\d+)<\/wp:posOffset>/);
                    const mV = anchorXml.match(/<wp:positionV[^>]*><wp:posOffset>(-?\d+)<\/wp:posOffset>/);

                    const offH = mH ? Math.abs(Number(mH[1])) : 0;
                    const offV = mV ? Math.abs(Number(mV[1])) : 0;

                    const LIMITE_EMU = 2000000; // ~2.19in — separa el escudo (offset real ~1.17in) del sello descontrolado (~9.5in)

                    if (offH > LIMITE_EMU || offV > LIMITE_EMU) {
                        return anchorXml; // offset fuera de rango: se deja oculto tal cual
                    }

                    return anchorXml.replace('behindDoc="1"', 'behindDoc="0"');

                });
                // El banner y el logo institucional del encabezado
                // también vienen como un grupo (wpg:wgp) — mismo
                // problema y misma solución que en el cuerpo.
                headerXml = desagruparImagenesWpg(headerXml);
                zip.file(rutaHeaderDefault, headerXml);
            }
        }

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
