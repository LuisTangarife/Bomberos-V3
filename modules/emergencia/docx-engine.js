/*=========================================================
 DOCX ENGINE
 Similar a DocumentApp del Apps Script
=========================================================*/

import { cargarPlantillaDOCX } from "./template-loader.js";

let doc = null;

export async function abrirDocumento() {

    const zip = await cargarPlantillaDOCX();

    doc = new window.docxtemplater(zip, {

        paragraphLoop: true,

        linebreaks: true

    });

    return doc;

}

export function obtenerDocumento(){

    return doc;

}

export function cerrarDocumento(){

    doc = null;

}
