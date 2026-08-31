/* ========================================================================
   PDF.JS
   Módulo Censos — Generación del informe en PDF de un censo individual
   Usa jsPDF (cargado por CDN, ver index.html), mismo criterio visual y
   de dibujo manual (sin autotable) que modules/inspecciones/pdf.js.
======================================================================== */

const MARGEN = 14;
const ANCHO_PAGINA = 210;   // A4 mm
const ALTO_PAGINA = 297;    // A4 mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

function texto(valor) {
    if (valor === null || valor === undefined || valor === "") return "—";
    return String(valor);
}

function textoLista(lista) {
    if (!Array.isArray(lista) || !lista.length) return "—";
    return lista.join(", ");
}

/* ------------------------------------------------------------------------
   GENERACIÓN DEL PDF
------------------------------------------------------------------------ */

export async function generarPDFCenso(censo) {

    if (!censo) return;

    if (!window.jspdf) {
        alert("No se pudo cargar la librería de generación de PDF (jsPDF). Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let y = dibujarEncabezado(doc, censo);

    y = dibujarTituloSeccion(doc, "1. Datos de la vivienda", y);
    y = dibujarFilaEtiquetaValor(doc, "Código UDEGER", texto(censo.codigoUdeger), y);
    y = dibujarFilaEtiquetaValor(doc, "Municipio", texto(censo.municipio), y);
    y = dibujarFilaEtiquetaValor(doc, "Corregimiento", texto(censo.corregimiento), y);
    y = dibujarFilaEtiquetaValor(doc, "Barrio / Vereda", texto(censo.barrioVereda), y);
    y = dibujarFilaEtiquetaValor(doc, "Núcleo #", texto(censo.nucleo), y);
    y = dibujarFilaEtiquetaValor(doc, "Dirección", texto(censo.direccion), y);
    if (censo.latitud && censo.longitud) {
        y = dibujarFilaEtiquetaValor(doc, "Coordenadas GPS", `${censo.latitud}, ${censo.longitud}`, y);
    }
    y = dibujarFilaEtiquetaValor(doc, "Tipo de predio", texto(censo.tipoPredio), y);
    if (censo.tipoPredio && censo.tipoPredio !== "Vivienda") {
        y = dibujarFilaEtiquetaValor(doc, "Nombre del establecimiento", texto(censo.nombreEstablecimiento), y);
        y = dibujarFilaEtiquetaValor(doc, "Actividad económica", texto(censo.tipoActividadEconomica), y);
    }
    y += 2;

    y = asegurarEspacio(doc, y, 20);
    y = dibujarTituloSeccion(doc, "2. Jefe de núcleo familiar", y);
    y = dibujarFilaEtiquetaValor(doc, "Cédula", texto(censo.jefeCedula), y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre completo", texto(censo.jefeNombre), y);
    y = dibujarFilaEtiquetaValor(doc, "Teléfono", texto(censo.jefeTelefono), y);
    y = dibujarFilaEtiquetaValor(doc, "Fecha de nacimiento", texto(censo.jefeFechaNacimiento), y);
    y = dibujarFilaEtiquetaValor(doc, "Edad", texto(censo.jefeEdad), y);
    y = dibujarFilaEtiquetaValor(doc, "Tipo de ocupante", texto(censo.tipoOcupante), y);
    if (censo.tipoOcupante && censo.tipoOcupante !== "propietario") {
        y = dibujarFilaEtiquetaValor(doc, "Propietario — cédula", texto(censo.propietarioCedula), y);
        y = dibujarFilaEtiquetaValor(doc, "Propietario — nombre", texto(censo.propietarioNombre), y);
        y = dibujarFilaEtiquetaValor(doc, "Propietario — dirección", texto(censo.propietarioDireccion), y);
        y = dibujarFilaEtiquetaValor(doc, "Propietario — teléfono", texto(censo.propietarioTelefono), y);
    }
    y += 2;

    const integrantes = censo.integrantes || [];
    y = asegurarEspacio(doc, y, 20);
    y = dibujarTituloSeccion(doc, `3. Núcleo familiar (${integrantes.length})`, y);

    if (!integrantes.length) {
        y = dibujarLineaTabla(doc, "Sin integrantes registrados.", y);
    } else {
        integrantes.forEach((persona, i) => {
            const linea =
                `${i + 1}. ${persona.nombreCompleto || "Sin nombre"} — ` +
                `${persona.tipoDocumento || "—"} ${persona.numeroDocumento || "—"} · ` +
                `${persona.parentesco || "—"} · ${persona.sexo || "—"} · ` +
                `Edad: ${persona.edad || "—"} · ` +
                `Discapacidad: ${persona.discapacidad === "Si" ? "Sí" : "No"}`;
            y = dibujarLineaTabla(doc, linea, y);
        });
    }
    y += 2;

    const mascotas = censo.mascotas || [];
    if (mascotas.length) {
        y = asegurarEspacio(doc, y, 16);
        y = dibujarTituloSeccion(doc, `Mascotas (${mascotas.length})`, y);
        mascotas.forEach((mascota, i) => {
            const linea =
                `${i + 1}. ${mascota.especie || "—"} × ${mascota.cantidad || "1"}` +
                (mascota.nombre ? ` — ${mascota.nombre}` : "") +
                (mascota.estado ? ` · ${mascota.estado}` : "");
            y = dibujarLineaTabla(doc, linea, y);
        });
        y += 2;
    }

    y = asegurarEspacio(doc, y, 16);
    y = dibujarTituloSeccion(doc, "4. Acceso a servicios públicos", y);
    y = dibujarLineaTabla(doc, textoLista(censo.servicios), y);
    y += 2;

    y = asegurarEspacio(doc, y, 16);
    y = dibujarTituloSeccion(doc, "5. Subsidios recibidos", y);
    y = dibujarLineaTabla(doc, textoLista(censo.subsidios), y);
    y += 2;

    y = asegurarEspacio(doc, y, 24);
    y = dibujarTituloSeccion(doc, "6. Fenómeno amenazante", y);
    y = dibujarFilaEtiquetaValor(doc, "Situación", texto(censo.situacionFenomeno), y);
    y = dibujarFilaEtiquetaValor(doc, "Origen", textoLista(censo.origenFenomeno), y);
    y += 2;

    y = asegurarEspacio(doc, y, 30);
    y = dibujarTituloSeccion(doc, "7. Afectación", y);
    y = dibujarFilaEtiquetaValor(doc, "Infraestructura afectada", textoLista(censo.infraestructuraAfectada), y);
    y = dibujarFilaEtiquetaValor(doc, "Área afectada (m²)", texto(censo.areaAfectadaM2), y);
    y = dibujarFilaEtiquetaValor(doc, "Pérdida de bienes/enseres", censo.perdidaBienes === "SI" ? "Sí" : censo.perdidaBienes === "NO" ? "No" : "—", y);
    if (censo.perdidaBienes === "SI") {
        y = dibujarFilaEtiquetaValor(doc, "Descripción bienes perdidos", texto(censo.descripcionBienesPerdidos), y);
    }
    y = dibujarFilaEtiquetaValor(doc, "Pérdida agropecuaria", texto(censo.perdidaAgropecuaria), y);
    y = dibujarFilaEtiquetaValor(doc, "Daño en edificación", texto(censo.danoEdificacion), y);
    y = dibujarFilaEtiquetaValor(doc, "Porcentaje de daño", texto(censo.porcentajeDano), y);
    y += 2;

    y = asegurarEspacio(doc, y, 16);
    y = dibujarTituloSeccion(doc, "8. Recomendación de evacuación", y);
    y = dibujarFilaEtiquetaValor(
        doc, "¿Se recomienda evacuar?",
        censo.recomendacionEvacuacion === "SI" ? "Sí" : censo.recomendacionEvacuacion === "NO" ? "No" : "—",
        y
    );
    y += 2;

    const fechaTexto = [censo.fechaDia, censo.fechaMes, censo.fechaAnio].filter(Boolean).join("/") +
        (censo.fechaHora ? `  ${censo.fechaHora}:${censo.fechaMinutos || "00"} ${censo.fechaAmPm || ""}` : "");

    y = asegurarEspacio(doc, y, 16);
    y = dibujarTituloSeccion(doc, "9. Fecha de elaboración", y);
    y = dibujarFilaEtiquetaValor(doc, "Fecha y hora", fechaTexto.trim() || "—", y);
    y += 2;

    y = dibujarFotoCenso(doc, censo.foto, y);

    if (censo.observaciones) {
        y = asegurarEspacio(doc, y, 20);
        y = dibujarTituloSeccion(doc, "11. Observaciones generales", y);
        y = dibujarLineaTabla(doc, texto(censo.observaciones), y);
        y += 2;
    }

    y = dibujarBloqueFirmas(doc, censo, y);

    dibujarPiePagina(doc);

    const fechaArchivo = [censo.fechaAnio, censo.fechaMes, censo.fechaDia].filter(Boolean).join("-")
        || new Date().toISOString().split("T")[0];

    doc.save(`Censo_${censo.id || "SN"}_${fechaArchivo}.pdf`);

}

/* ------------------------------------------------------------------------
   BLOQUES DE DIBUJO (mismo criterio visual que inspecciones/pdf.js)
------------------------------------------------------------------------ */

function dibujarEncabezado(doc, censo) {

    doc.setFillColor(180, 20, 12);
    doc.rect(0, 0, ANCHO_PAGINA, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Cuerpo de Bomberos Voluntarios de Villamaría", MARGEN, 12);

    doc.setFontSize(11);
    doc.text("Censo para Damnificados", MARGEN, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Código: ${censo.id || "—"}`, ANCHO_PAGINA - MARGEN, 12, { align: "right" });
    doc.text(`Jefe de hogar: ${censo.jefeNombre || "—"}`, ANCHO_PAGINA - MARGEN, 18, { align: "right" });
    doc.text(`Ubicación: ${censo.barrioVereda || censo.municipio || "—"}`, ANCHO_PAGINA - MARGEN, 24, { align: "right" });

    doc.setTextColor(30, 30, 30);

    return 38;

}

function dibujarTituloSeccion(doc, titulo, y) {

    doc.setFillColor(235, 238, 244);
    doc.rect(MARGEN, y, ANCHO_UTIL, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 40);
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

function dibujarLineaTabla(doc, texto, y) {

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(30, 30, 30);

    const lineas = doc.splitTextToSize(texto, ANCHO_UTIL - 4);
    doc.text(lineas, MARGEN + 2, y);

    y += Math.max(4.6, lineas.length * 4.2);

    return asegurarEspacio(doc, y, 8);

}

function dibujarBloqueFirmas(doc, censo, y) {

    const ALTURA_TITULO = 11;

    // Igual que en Ayudas: título + ambas firmas se miden como UN bloque
    // antes de dibujar nada, para que nunca quede una firma sola al
    // principio de una página sin nada que la acompañe (título, nombre,
    // cédula) — el mismo criterio de "firma nunca sola" que ya se aplicó
    // en el certificado de Ayudas.
    const alturaFuncionario = censo.funcionarioNombre ? 40 : 35;
    const alturaEncuestado = censo.encuestadoNombre ? 40 : 35;
    const alturaTotal = ALTURA_TITULO + alturaFuncionario + alturaEncuestado;

    y = asegurarEspacio(doc, y, alturaTotal);

    y = dibujarTituloSeccion(doc, "12. Firmas", y);
    y = dibujarBloqueFirma(doc, "Firma del funcionario", censo.firmaFuncionario, texto(censo.funcionarioCedula), y, censo.funcionarioNombre);
    y = dibujarBloqueFirma(doc, "Firma del encuestado", censo.firmaEncuestado, texto(censo.encuestadoCedula), y, censo.encuestadoNombre);

    return y;

}

function dibujarBloqueFirma(doc, etiqueta, firmaDataUrl, cedula, y, nombreImpreso = "") {

    doc.setFont("helvetica", "normal");
    doc.setDrawColor(150, 150, 150);
    doc.line(MARGEN + 2, y + 18, MARGEN + 82, y + 18);

    if (firmaDataUrl) {
        try {
            doc.addImage(firmaDataUrl, "PNG", MARGEN + 4, y, 60, 17);
        } catch (error) {
            console.warn(`[censos/pdf] No se pudo dibujar la firma "${etiqueta}":`, error);
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

function dibujarFotoCenso(doc, fotoDataUrl, y) {

    if (!fotoDataUrl) return y;

    const ALTO_MAXIMO = 65;
    const ALTURA_TITULO = 11;

    // Título + foto se miden juntos y se saltan de página como un solo
    // bloque — mismo criterio que en Ayudas: que el título "10. Evidencia
    // fotográfica" nunca quede en una página y la imagen en la siguiente.
    let alturaFoto = ALTO_MAXIMO;
    try {
        const propiedades = doc.getImageProperties(fotoDataUrl);
        alturaFoto = Math.min(ALTO_MAXIMO, ANCHO_UTIL / (propiedades.width / propiedades.height));
    } catch (error) {
        console.warn("[censos/pdf] No se pudo leer la proporción de la foto:", error);
    }

    y = asegurarEspacio(doc, y, ALTURA_TITULO + alturaFoto + 10);

    y = dibujarTituloSeccion(doc, "10. Evidencia fotográfica", y);

    try {

        const propiedades = doc.getImageProperties(fotoDataUrl);
        const ratio = propiedades.width / propiedades.height;

        let ancho = ANCHO_UTIL;
        let alto = ancho / ratio;

        if (alto > ALTO_MAXIMO) {
            alto = ALTO_MAXIMO;
            ancho = alto * ratio;
        }

        const x = MARGEN + (ANCHO_UTIL - ancho) / 2;

        doc.setDrawColor(18, 29, 31);
        doc.setLineWidth(0.3);
        doc.rect(x - 0.5, y - 0.5, ancho + 1, alto + 1);

        const coincidenciaFormato = /^data:image\/(\w+);/.exec(fotoDataUrl);
        const formato = (coincidenciaFormato?.[1] || "jpeg").toUpperCase();

        doc.addImage(fotoDataUrl, formato, x, y, ancho, alto);

        y += alto + 7;

    } catch (error) {
        console.warn("[censos/pdf] No se pudo dibujar la foto del censo:", error);
    }

    return y;

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
