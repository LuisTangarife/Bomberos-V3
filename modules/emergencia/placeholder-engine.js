/*=========================================================
 PLACEHOLDER ENGINE
 Construye el contexto de datos que docxtemplater usa para
 rellenar plantilla1.docx.

 FIRMAS_AFECTADOS y FIRMAS_BOMBEROS ya NO son texto plano: plantilla1.docx
 ahora tiene, en su lugar, un bucle real por persona ({{#afectados}} /
 {{#firmasBomberos}}) con un tag de imagen ({{%firma}}) dentro. Eso lo
 procesa el módulo de imágenes de docxtemplater conectado en
 docx-engine.js (ver ese archivo para el porqué de cada detalle).

 Ojo con el saneo de `firma` en sanearFirmantes(): el módulo de
 imágenes NO comprueba si getImage() devolvió algo válido — solo
 comprueba si el valor del campo en sí (antes de llamar a getImage)
 es "verdadero". Si aquí llega el string literal "Sin firma" (que es
 lo que guardaba el formulario cuando no había firma), docxtemplater
 SÍ intenta renderizarlo como imagen y el documento entero falla al
 generarse. Por eso cualquier valor que no sea una firma real en
 base64 se convierte aquí en '' (cadena vacía), que es lo único que
 el bucle de la plantilla reconoce como "sin firma" y omite.
=========================================================*/

import {
    formatDate,
    calcularCoordenadas,
    personalTexto,
    vehiculosTexto,
    renderAfectadosTexto,
    generarDocNum
} from "./report-helpers.js";

function esFirmaValida(firma) {
    return typeof firma === 'string' && firma.startsWith('data:image');
}

// Deja pasar nombre/dni/etc. tal cual, pero normaliza `firma` a '' en
// cualquier caso que no sea una imagen real (undefined, '', 'Sin firma').
// Un canvas vacío exportado con toDataURL() también genera un
// data:image/png válido (un PNG transparente de 1x1) — eso SÍ pasa el
// filtro de esFirmaValida() y se insertará como una imagen vacía en el
// Word. No se intenta filtrar ese caso aquí para no depender de
// decodificar el PNG; si llega a ser un problema real en uso, se
// resuelve mejor en el origen (no generar ese dataURL cuando el canvas
// nunca se tocó — ver limpiarFirma()/guardarFirma() en el módulo de
// inspecciones como referencia de ese patrón).
function sanearFirmantes(lista) {
    if (!lista?.length) return [];
    return lista.map(item => ({
        ...item,
        firma: esFirmaValida(item.firma) ? item.firma : ''
    }));
}

export function crearContexto(data, docNum) {

    return {

        REPORTE_ID: docNum || generarDocNum(),

        FECHA: formatDate(data.fecha),

        HORA_LLEGADA: data.horaLlegada || '',

        HORA_FINAL: data.horaFinal || '',

        LATITUD: data.latitud || '',

        LONGITUD: data.longitud || '',

        COORDENADAS: calcularCoordenadas(data),

        LUGAR: data.lugar || '',

        DIRECCION: data.direccion || '',

        EVENTO: data.evento || '',

        PERSONAL: personalTexto(data.personal),

        VEHICULOS: vehiculosTexto(data.vehiculos),

        DESCRIPCION: data.descripcion || '',

        LESIONADOS: data.lesionados || 0,

        VICTIMAS: data.victimas || 0,

        AFECTADOS: renderAfectadosTexto(data.afectados).replace(/<br>/g, '\n'),

        NOVEDADES: data.novedades || '',

        // Arreglos para los bucles {{#afectados}} / {{#firmasBomberos}}
        // de plantilla1.docx — ya no texto plano, ver comentario arriba.
        afectados: sanearFirmantes(data.afectados),

        firmasBomberos: sanearFirmantes(data.firmasBomberos)

    };

}
