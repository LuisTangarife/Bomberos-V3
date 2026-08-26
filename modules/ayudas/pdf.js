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

const MARGEN = 30;
const ANCHO_PAGINA = 215.9;   // Letter mm (igual al membrete original)
const ALTO_PAGINA = 279.4;    // Letter mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

const cacheImagenes = {};

async function cargarImagenBase64(ruta) {

    if (cacheImagenes[ruta]) return cacheImagenes[ruta];

    try {

        const respuesta = await fetch(ruta);
        const blob = await respuesta.blob();

        cacheImagenes[ruta] = await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(blob);
        });

        return cacheImagenes[ruta];

    } catch (error) {
        console.warn(`[ayudas/pdf] No se pudo cargar la imagen ${ruta}, se genera el PDF sin ella:`, error);
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
    const doc = new jsPDF({ unit: "mm", format: "letter" });

    const [fondoMembrete, bannerSuperior, escudoColombia, franjaEsquina] = await Promise.all([
        cargarImagenBase64("./assets/membrete-fondo.jpg"),
        cargarImagenBase64("./assets/banner-superior.png"),
        cargarImagenBase64("./assets/escudo-bomberos-colombia.png"),
        cargarImagenBase64("./assets/franja-esquina.png")
    ]);

    let y = dibujarEncabezado(doc, ayuda, fondoMembrete, bannerSuperior, escudoColombia, franjaEsquina);

    y = dibujarTitulo(doc, `FORMATO DE ENTREGA DE ${(ayuda.tipoKit || "KIT").toUpperCase()}`, y);
    y = dibujarSubtitulo(doc, "Emergencia por evento sísmico — Cuerpo de Bomberos Voluntarios de Villamaría", y);

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

    y = dibujarFotoEntrega(doc, ayuda.foto, y);
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

const NIT_BOMBEROS = "NIT. 890.804.607-05";

function dibujarEncabezado(doc, ayuda, fondoMembrete, bannerSuperior, escudoColombia, franjaEsquina) {

    // Fondo: marca de agua + bloques amarillos, todo horneado en una sola imagen
    // (image3.jpg en el docx original), anclada casi en la esquina superior
    // izquierda de la página (x≈0.4mm, y≈0.3mm), cubriendo 215.4 x 221.4mm.
    if (fondoMembrete) {
        try {
            doc.addImage(fondoMembrete, "JPEG", 0.4, 0.3, 215.4, 221.4);
        } catch (error) {
            console.warn("[ayudas/pdf] No se pudo dibujar el fondo del membrete:", error);
        }
    }

    // Banner superior (escudo + texto "Benemérito Cuerpo de Bomberos
    // Voluntarios / Villamaría, Caldas"), imagen única, 83.1 x 23.5mm.
    if (bannerSuperior) {
        try {
            doc.addImage(bannerSuperior, "PNG", 24.6, 11, 83.1, 23.5);
        } catch (error) {
            console.warn("[ayudas/pdf] No se pudo dibujar el banner superior:", error);
        }
    }

    // Escudo Bomberos Colombia, 21.1 x 23.5mm, más NIT debajo alineado a la derecha.
    if (escudoColombia) {
        try {
            doc.addImage(escudoColombia, "PNG", 164.5, 11, 21.1, 23.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(19, 29, 31);
            doc.text(NIT_BOMBEROS, ANCHO_PAGINA - MARGEN, 11 + 23.5 + 4, { align: "right" });
        } catch (error) {
            console.warn("[ayudas/pdf] No se pudo dibujar el escudo de Bomberos Colombia:", error);
        }
    }

    // Franja amarilla adicional en la esquina inferior izquierda, igual al
    // "franja-esquina" del footer original (refuerza el bloque que ya trae
    // el fondo, por si el fondo no alcanza a cubrir hasta el borde).
    if (franjaEsquina) {
        try {
            doc.addImage(franjaEsquina, "PNG", 0, 215.5, 12.4, 64.4);
        } catch (error) {
            console.warn("[ayudas/pdf] No se pudo dibujar la franja de esquina:", error);
        }
    }

    return 11 + 23.5 + 9;

}

function dibujarFotoEntrega(doc, fotoDataUrl, y) {

    if (!fotoDataUrl) return y;

    const ALTO_MAXIMO = 65;
    const ANCHO_MAXIMO = ANCHO_UTIL;

    y = asegurarEspacio(doc, y, ALTO_MAXIMO + 12);

    try {

        // A diferencia de los logos institucionales (proporción fija y
        // conocida de antemano), esta foto la toma el usuario con su
        // cámara: puede llegar vertical, horizontal o cuadrada. Hay que
        // preguntarle a jsPDF la proporción real en vez de asumir una.
        const propiedades = doc.getImageProperties(fotoDataUrl);
        const ratio = propiedades.width / propiedades.height;

        let ancho = ANCHO_MAXIMO;
        let alto = ancho / ratio;

        if (alto > ALTO_MAXIMO) {
            alto = ALTO_MAXIMO;
            ancho = alto * ratio;
        }

        const x = MARGEN + (ANCHO_UTIL - ancho) / 2;

        doc.setDrawColor(18, 29, 31);
        doc.setLineWidth(0.3);
        doc.rect(x - 0.5, y - 0.5, ancho + 1, alto + 1);

        // fotos.js comprime a JPEG cuando puede, pero si la compresión
        // falla (formato no soportado, etc.) conserva el archivo
        // original con su mime type real — hay que leerlo del propio
        // data URL en vez de asumir JPEG siempre, o jsPDF puede fallar
        // al decodificar.
        const coincidenciaFormato = /^data:image\/(\w+);/.exec(fotoDataUrl);
        const formato = (coincidenciaFormato?.[1] || "jpeg").toUpperCase();

        doc.addImage(fotoDataUrl, formato, x, y, ancho, alto);

        y += alto + 5;

    } catch (error) {
        console.warn("[ayudas/pdf] No se pudo dibujar la foto de la entrega:", error);
    }

    return y;

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
            "Cuerpo de Bomberos Voluntarios de Villamaría",
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
