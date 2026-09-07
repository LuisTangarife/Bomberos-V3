/* ========================================================================
   PDF-CONSENTIMIENTO.JS
   Módulo APH — Genera el consentimiento informado (FT-AMB-001) en PDF.
======================================================================== */

const MARGEN = 14;
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

function texto(valor) {
    if (valor === null || valor === undefined || valor === "") return "—";
    return String(valor);
}

const TEXTO_LEGAL = [
    "Yo, identificado con el documento que registro abajo, declaro que he sido informado por el personal del " +
    "Cuerpo de Bomberos Voluntarios Villamaría - Caldas sobre los procedimientos y el traslado en ambulancia " +
    "que debo tener en cuenta:",
    "1. El traslado se hace en ambulancia de transporte asistencial básico (T.A.B), acompañado por personal calificado.",
    "2. El vehículo dispone del material necesario para la atención inicial de las funciones vitales del paciente, " +
    "en situaciones críticas como alteración cardíaca, presión arterial, dificultad respiratoria, incontinencia " +
    "o traumatismo, entre otros.",
    "3. Debo tener un acompañante mayor de edad durante el desplazamiento.",
    "4. Me han explicado los posibles riesgos para mi salud: durante el traslado pueden surgir complicaciones que " +
    "conlleven a detener la ambulancia momentáneamente hasta solucionarlas mediante las técnicas necesarias. " +
    "Aunque la conducción se hace acorde a la patología del paciente, existen riesgos propios del transporte " +
    "(vibraciones, aceleración, desaceleración, accidente, avería, etc.)",
    "Aclaro que he comprendido la información y los procedimientos que realice el personal de salud del Cuerpo " +
    "de Bomberos Voluntarios Villamaría - Caldas, basados en la Resolución 3100 de 2019. Autorizo al personal " +
    "de salud del Cuerpo al traslado asistencial a donde sea requerido.",
    "Autorización de tratamiento de datos personales: con base en la Constitución Política de Colombia y las " +
    "Leyes 1266 de 2008 y 1581 de 2012, declaro que he leído los términos y condiciones de la política de " +
    "seguridad de la información y habeas data del Cuerpo de Bomberos Voluntarios Villamaría - Caldas, y " +
    "autorizo la recolección, almacenamiento, uso y circulación de mis datos personales para la prestación de " +
    "sus servicios."
];

export async function generarPDFConsentimiento(c) {

    if (!c) return;

    if (!window.jspdf) {
        alert("No se pudo cargar la librería de generación de PDF (jsPDF). Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let y = dibujarEncabezado(doc, c);

    y = dibujarFilaEtiquetaValor(doc, "Fecha", texto(c.fecha), y);
    y += 4;

    y = dibujarTituloSeccion(doc, "Consentimiento informado", y);
    TEXTO_LEGAL.forEach(parrafo => {
        y = dibujarLineaTabla(doc, parrafo, y);
        y += 2;
    });
    y += 2;

    y = dibujarBloqueFirmante(doc, c, 1, y);
    y = dibujarBloqueFirmante(doc, c, 2, y);
    y = dibujarBloqueFirmante(doc, c, 3, y);

    if (c.consentimientoObservaciones) {
        y = dibujarTituloSeccion(doc, "Observaciones", y);
        y = dibujarLineaTabla(doc, texto(c.consentimientoObservaciones), y);
    }

    dibujarPiePagina(doc);

    doc.save(`Consentimiento_${(c.firmante1Nombre || "Paciente").replace(/\s+/g, "_")}_${c.id || "SN"}_${c.fecha || ""}.pdf`);

}

function dibujarBloqueFirmante(doc, c, n, y) {

    const nombre = c[`firmante${n}Nombre`];
    const firma = c[`firmaPaciente${n}`];

    // El 1° firmante es obligatorio; el 2° y 3° solo se imprimen si de
    // verdad se diligenciaron — no tiene sentido mostrar dos bloques de
    // firma vacíos cuando el formato en papel solo se usó uno.
    if (n > 1 && !nombre && !firma) return y;

    const ALTURA_BLOQUE = 45;
    y = asegurarEspacio(doc, y, ALTURA_BLOQUE);

    y = dibujarTituloSeccion(doc, `Firmante ${n}`, y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre", texto(nombre), y);
    y = dibujarFilaEtiquetaValor(doc, "Documento", `${texto(c[`firmante${n}Tipo`])} ${texto(c[`firmante${n}Documento`])}`, y);
    y = dibujarFilaEtiquetaValor(doc, "Teléfono", texto(c[`firmante${n}Telefono`]), y);

    doc.setDrawColor(150, 150, 150);
    doc.line(MARGEN + 2, y + 18, MARGEN + 82, y + 18);

    if (firma) {
        try {
            doc.addImage(firma, "PNG", MARGEN + 4, y, 60, 17);
        } catch (error) {
            console.warn(`[aph/pdf] No se pudo dibujar la firma del firmante ${n}:`, error);
        }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text("Firma", MARGEN + 2, y + 23);

    return y + 30;

}

/* ------------------------------------------------------------------------
   ENCABEZADO / PIE / AUXILIARES (mismos que pdf-atencion.js)
------------------------------------------------------------------------ */

function dibujarEncabezado(doc, c) {

    doc.setFillColor(13, 116, 144);
    doc.rect(0, 0, ANCHO_PAGINA, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Cuerpo de Bomberos Voluntarios de Villamaría", MARGEN, 12);

    doc.setFontSize(11);
    doc.text("Consentimiento Informado (FT-AMB-001)", MARGEN, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Código: ${c.id || "—"}`, ANCHO_PAGINA - MARGEN, 12, { align: "right" });
    doc.text(`Firmante: ${c.firmante1Nombre || "—"}`, ANCHO_PAGINA - MARGEN, 18, { align: "right" });
    doc.text(`Fecha: ${c.fecha || "—"}`, ANCHO_PAGINA - MARGEN, 24, { align: "right" });

    doc.setTextColor(30, 30, 30);

    return 38;

}

function dibujarTituloSeccion(doc, titulo, y) {

    y = asegurarEspacio(doc, y, 11);

    doc.setFillColor(224, 246, 250);
    doc.rect(MARGEN, y, ANCHO_UTIL, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(13, 90, 110);
    doc.text(titulo, MARGEN + 2, y + 5);

    return y + 11;

}

function dibujarFilaEtiquetaValor(doc, label, valor, y) {

    const COL_VALOR_MIN = MARGEN + 58;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);

    const etiqueta = `${label}:`;
    doc.text(etiqueta, MARGEN + 2, y);

    const finEtiqueta = MARGEN + 2 + doc.getTextWidth(etiqueta) + 3;
    const inicioValor = Math.max(COL_VALOR_MIN, finEtiqueta);
    const espacioRestante = ANCHO_PAGINA - MARGEN - inicioValor;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);

    if (espacioRestante >= 40) {

        const lineasValor = doc.splitTextToSize(String(valor), espacioRestante);
        doc.text(lineasValor, inicioValor, y);
        y += Math.max(5, lineasValor.length * 4.2);

    } else {

        y += 4.6;
        const lineasValor = doc.splitTextToSize(String(valor), ANCHO_UTIL - 8);
        doc.text(lineasValor, MARGEN + 6, y);
        y += lineasValor.length * 4.2;

    }

    return asegurarEspacio(doc, y, 8);

}

function dibujarLineaTabla(doc, textoLinea, y) {

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(30, 30, 30);

    const lineas = doc.splitTextToSize(textoLinea, ANCHO_UTIL - 4);
    doc.text(lineas, MARGEN + 2, y);

    y += Math.max(4.6, lineas.length * 4.2);

    return asegurarEspacio(doc, y, 8);

}

function dibujarPiePagina(doc) {

    const totalPaginas = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPaginas; i++) {

        doc.setPage(i);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);

        doc.text(
            "Cuerpo de Bomberos Voluntarios de Villamaría — Documento generado automáticamente",
            MARGEN,
            ALTO_PAGINA - 8
        );

        doc.text(
            `Página ${i} de ${totalPaginas}`,
            ANCHO_PAGINA - MARGEN,
            ALTO_PAGINA - 8,
            { align: "right" }
        );

    }

}

function asegurarEspacio(doc, y, alturaNecesaria) {

    if (y + alturaNecesaria <= ALTO_PAGINA - 16) return y;

    doc.addPage();
    return MARGEN;

}
