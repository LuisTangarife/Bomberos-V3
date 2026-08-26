/* ========================================================================
   PDF.JS
   Módulo Ayudas Humanitarias — Certificado de entrega en PDF

   Replica el texto y estructura del "Formato de Entrega de Kit —
   Emergencia por evento sísmico" (Alcaldía de Villamaría, Secretaría
   de Desarrollo Social), usando jsPDF (cargado por CDN, ver index.html)
   con el mismo criterio de dibujo manual que censos/pdf.js e
   inspecciones/pdf.js, más el logo real y las firmas digitales
   capturadas en el formulario cuando existen.
======================================================================== */

const MARGEN = 16;
const ANCHO_PAGINA = 210;   // A4 mm
const ALTO_PAGINA = 297;    // A4 mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

let logoBase64Cache = null;

async function cargarLogoBase64() {

    if (logoBase64Cache) return logoBase64Cache;

    try {

        const respuesta = await fetch("./assets/logo-bomberos-villamaria.png");
        const blob = await respuesta.blob();

        logoBase64Cache = await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(blob);
        });

        return logoBase64Cache;

    } catch (error) {
        console.warn("[ayudas/pdf] No se pudo cargar el logo, se genera el PDF sin él:", error);
        return null;
    }

}

function texto(valor) {
    if (valor === null || valor === undefined || valor === "") return "—";
    return String(valor);
}

/* ------------------------------------------------------------------------
   GENERACIÓN DEL PDF
------------------------------------------------------------------------ */

export async function generarPDFAyuda(ayuda) {

    if (!ayuda) return;

    if (!window.jspdf) {
        alert("No se pudo cargar la librería de generación de PDF (jsPDF). Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const logo = await cargarLogoBase64();

    let y = dibujarEncabezado(doc, ayuda, logo);

    y = dibujarTitulo(doc, `FORMATO DE ENTREGA DE ${(ayuda.tipoKit || "KIT").toUpperCase()}`, y);
    y = dibujarSubtitulo(doc, "Emergencia por evento sísmico — Alcaldía de Villamaría", y);

    y += 4;
    y = dibujarFilaEtiquetaValor(doc, "Fecha", texto(ayuda.fecha), y);
    y = dibujarFilaEtiquetaValor(doc, "Lugar", texto(ayuda.lugar), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "Datos del beneficiario", y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre", texto(ayuda.beneficiarioNombre), y);
    y = dibujarFilaEtiquetaValor(doc, "C.C.", texto(ayuda.beneficiarioCedula), y);
    y = dibujarFilaEtiquetaValor(doc, "Teléfono", texto(ayuda.beneficiarioTelefono), y);
    y = dibujarFilaEtiquetaValor(doc, "Dirección / Sector", texto(ayuda.direccionSector), y);
    y = dibujarFilaEtiquetaValor(doc, "N.º de integrantes del hogar", texto(ayuda.numIntegrantesHogar), y);
    y = dibujarFilaEtiquetaValor(doc, "¿Está censado como afectado?", texto(ayuda.censado), y);
    if (ayuda.censado === "Sí") {
        y = dibujarFilaEtiquetaValor(doc, "N.º de censo o registro", texto(ayuda.numCenso), y);
    }
    y += 2;

    y = asegurarEspacio(doc, y, 30);
    y = dibujarTituloSeccion(doc, "Entrega", y);
    y = dibujarLineaTabla(
        doc,
        `Se hace entrega de ${texto(ayuda.cantidadEntregada || "1")} ${(ayuda.tipoKit || "kit").toUpperCase()} como ayuda humanitaria para la atención de la emergencia ocasionada por el evento sísmico.`,
        y
    );
    y = dibujarFilaEtiquetaValor(doc, "Cantidad entregada", `${texto(ayuda.cantidadEntregada || "1")} kit(s)`, y);
    if (ayuda.observaciones) {
        y = dibujarFilaEtiquetaValor(doc, "Observaciones", texto(ayuda.observaciones), y);
    }
    y += 2;

    y = asegurarEspacio(doc, y, 24);
    y = dibujarTituloSeccion(doc, "Constancia", y);
    y = dibujarLineaTabla(
        doc,
        `Declaro que recibí a satisfacción ${(ayuda.tipoKit || "el kit").toLowerCase()} entregado por la Alcaldía de Villamaría — Secretaría de Desarrollo Social, en el marco de la atención humanitaria por la emergencia.`,
        y
    );
    y += 4;

    y = asegurarEspacio(doc, y, 55);
    y = dibujarBloqueFirma(doc, "Firma beneficiario", ayuda.firmaBeneficiario, texto(ayuda.beneficiarioCedula), y);
    y = dibujarBloqueFirma(doc, "Firma responsable entrega", ayuda.firmaResponsable, texto(ayuda.responsableCedula), y, ayuda.responsableNombre);

    dibujarPiePagina(doc);

    const fechaArchivo = ayuda.fecha || new Date().toISOString().split("T")[0];

    doc.save(`${(ayuda.tipoKit || "Ayuda").replace(/\s+/g, "_")}_${ayuda.id || "SN"}_${fechaArchivo}.pdf`);

}

/* ------------------------------------------------------------------------
   BLOQUES DE DIBUJO
------------------------------------------------------------------------ */

function dibujarEncabezado(doc, ayuda, logo) {

    if (logo) {
        try {
            // Logo nuevo (Bomberos Villamaría) mide 2046x579 px (relación ~3.53:1).
            doc.addImage(logo, "PNG", 0, 0, ANCHO_PAGINA, ANCHO_PAGINA / 3.53);
        } catch (error) {
            console.warn("[ayudas/pdf] No se pudo dibujar el logo en el PDF:", error);
        }
    }

    return logo ? 67 : 20;

}

function dibujarTitulo(doc, titulo, y) {

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);

    const lineas = doc.splitTextToSize(titulo, ANCHO_UTIL);
    doc.text(lineas, ANCHO_PAGINA / 2, y, { align: "center" });

    return y + lineas.length * 6 + 2;

}

function dibujarSubtitulo(doc, subtitulo, y) {

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);

    doc.text(subtitulo, ANCHO_PAGINA / 2, y, { align: "center" });

    return y + 8;

}

function dibujarTituloSeccion(doc, titulo, y) {

    doc.setFillColor(255, 247, 199); // amarillo institucional muy claro (logo Bomberos)
    doc.rect(MARGEN, y, ANCHO_UTIL, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(18, 29, 31); // navy del logo Bomberos
    doc.text(titulo, MARGEN + 2, y + 5);

    return y + 11;

}

function dibujarFilaEtiquetaValor(doc, label, valor, y) {

    const COL_VALOR_MIN = MARGEN + 62;

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

function dibujarLineaTabla(doc, cadena, y) {

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);

    const lineas = doc.splitTextToSize(cadena, ANCHO_UTIL - 4);
    doc.text(lineas, MARGEN + 2, y);

    y += Math.max(4.6, lineas.length * 4.2);

    return asegurarEspacio(doc, y, 8);

}

function dibujarBloqueFirma(doc, etiqueta, firmaDataUrl, cedula, y, nombreImpreso = "") {

    doc.setFont("helvetica", "normal");
    doc.setDrawColor(150, 150, 150);
    doc.line(MARGEN + 2, y + 18, MARGEN + 82, y + 18);

    if (firmaDataUrl) {
        try {
            doc.addImage(firmaDataUrl, "PNG", MARGEN + 4, y, 60, 17);
        } catch (error) {
            console.warn(`[ayudas/pdf] No se pudo dibujar la firma "${etiqueta}":`, error);
        }
    }

    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(etiqueta, MARGEN + 2, y + 23);

    if (nombreImpreso) {
        doc.setFont("helvetica", "bold");
        doc.text(texto(nombreImpreso), MARGEN + 2, y + 28);
        doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`C.C.: ${texto(cedula)}`, MARGEN + 2, y + (nombreImpreso ? 33 : 28));

    return y + (nombreImpreso ? 40 : 35);

}

function dibujarPiePagina(doc) {

    const totalPaginas = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPaginas; i++) {

        doc.setPage(i);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);

        doc.text(
            "Secretaría de Desarrollo Social — Alcaldía de Villamaría",
            ANCHO_PAGINA / 2,
            ALTO_PAGINA - 10,
            { align: "center" }
        );

        doc.text(
            `Página ${i} de ${totalPaginas}`,
            ANCHO_PAGINA - MARGEN,
            ALTO_PAGINA - 10,
            { align: "right" }
        );

    }

}

function asegurarEspacio(doc, y, alturaNecesaria) {

    if (y + alturaNecesaria <= ALTO_PAGINA - 16) return y;

    doc.addPage();
    return MARGEN;

}
