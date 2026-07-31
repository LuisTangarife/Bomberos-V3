/*=========================================================
 PLACEHOLDER ENGINE
 Construye el contexto de datos que docxtemplater usa para
 rellenar plantilla1.docx.

 CAMBIO IMPORTANTE: las firmas ya NO se insertan vía un módulo de
 imágenes de docxtemplater. Se probó docxtemplater-image-module-free
 y resultó tener un bug real, sin resolver desde 2019, en navegadores
 reales (intenta reasignar `namespaceURI` de un elemento del DOM, algo
 que el propio estándar no permite -- confirmado en el issue tracker
 de esa librería, afecta a Chrome y Firefox por igual).

 El reemplazo: plantilla1.docx tiene, en el lugar de cada firma, un
 tag de TEXTO plano ({{marcadorFirma}}) con un valor único por persona
 (ej. "__FIRMA_0__"). docxtemplater solo pone ese texto ahí, sin tocar
 imágenes en absoluto. Después, docx-engine.js (fuera de docxtemplater
 por completo) busca cada uno de esos marcadores directamente en el
 XML ya generado y los reemplaza por el XML de una imagen real -- pura
 manipulación de texto/ZIP, nunca del DOM, así que el bug de
 namespaceURI ni siquiera puede ocurrir.

 crearContexto() ahora devuelve { contexto, marcadores }:
   - contexto: lo que se le pasa a doc.render() (igual que antes).
   - marcadores: mapa marcador -> dataURL (o '' si no hay firma real),
     que docx-engine.js usa DESPUÉS del render para incrustar las
     imágenes.
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

// Le pone a cada firmante un marcador único ("__FIRMA_0__", "__FIRMA_1__",
// ...) y registra en `marcadores` a qué dataURL corresponde (o '' si
// no hay firma real) -- el contador es compartido entre afectados y
// bomberos para que nunca se repita un marcador entre los dos grupos.
function asignarMarcadores(lista, marcadores, contadorRef) {
    if (!lista?.length) return [];
    return lista.map(item => {
        const marcador = `__FIRMA_${contadorRef.valor++}__`;
        marcadores[marcador] = esFirmaValida(item.firma) ? item.firma : '';
        return { ...item, marcadorFirma: marcador };
    });
}

export function crearContexto(data, docNum) {

    const marcadores = {};
    const contadorRef = { valor: 0 };

    const contexto = {

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
        // de plantilla1.docx. `marcadorFirma` es el único campo nuevo
        // -- todo lo demás sigue igual que antes.
        afectados: asignarMarcadores(data.afectados, marcadores, contadorRef),

        firmasBomberos: asignarMarcadores(data.firmasBomberos, marcadores, contadorRef)

    };

    return { contexto, marcadores };

}
