/*=========================================================
 PLACEHOLDER ENGINE
 Construye el contexto de datos que docxtemplater usa para
 rellenar plantilla1.docx.

 OJO con dos diferencias respecto a la vista HTML (certificados.js):

 1. FIRMAS_AFECTADOS y FIRMAS_BOMBEROS aquí son texto plano (solo
    nombres), no bloques con <img>. Un documento .docx no puede
    recibir HTML crudo en un tag de texto — docxtemplater lo
    insertaría literalmente como la cadena "<img src=...>" visible
    en el Word, no como una imagen real. Insertar las firmas como
    imágenes de verdad requeriría el módulo de imágenes de
    docxtemplater con un resolver de base64 a ArrayBuffer, que no
    está incluido en este proyecto.
 2. El valor anterior de este archivo pasaba los campos "en crudo"
    (sin formatear fecha, sin calcular coordenadas, sin convertir
    arrays a texto), por lo que el Word generado habría mostrado
    fechas ISO sin formato y "[object Object]" en personal/vehículos.
=========================================================*/

import {
    formatDate,
    calcularCoordenadas,
    personalTexto,
    vehiculosTexto,
    renderAfectadosTexto,
    generarDocNum
} from "./report-helpers.js";

function nombresAfectadosTexto(afectados) {
    if (!afectados?.length) return 'Ninguno';
    const nombres = afectados.map(a => a.nombre).filter(Boolean);
    return nombres.length ? nombres.join(', ') : 'Ninguno';
}

// Mismo criterio que renderFirmasBomberosHTML en certificados.js: solo
// se listan bomberos que efectivamente firmaron.
function nombresBomberosFirmantesTexto(firmasBomberos) {
    if (!firmasBomberos?.length) return 'Sin firmas registradas';
    const nombres = firmasBomberos
        .filter(b => b.firma && b.firma !== 'Sin firma')
        .map(b => b.nombre)
        .filter(Boolean);
    return nombres.length ? nombres.join(', ') : 'Sin firmas registradas';
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

        FIRMAS_AFECTADOS: nombresAfectadosTexto(data.afectados),

        FIRMAS_BOMBEROS: nombresBomberosFirmantesTexto(data.firmasBomberos)

    };

}
