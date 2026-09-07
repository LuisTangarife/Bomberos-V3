/* ========================================================================
   PDF-ATENCION.JS
   Módulo APH — Genera la historia clínica del traslado (FT-AMB) en PDF.
   Mismo criterio de dibujo manual (sin autotable) que Censos/Inspecciones.
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

export async function generarPDFAtencion(atencion) {

    if (!atencion) return;

    if (!window.jspdf) {
        alert("No se pudo cargar la librería de generación de PDF (jsPDF). Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let y = dibujarEncabezado(doc, atencion);

    y = dibujarTituloSeccion(doc, "1. Datos del servicio", y);
    y = dibujarFilaEtiquetaValor(doc, "Fecha de servicio", texto(atencion.fechaServicio), y);
    y = dibujarFilaEtiquetaValor(doc, "Móvil número", texto(atencion.movilNumero), y);
    y = dibujarFilaEtiquetaValor(doc, "Prioridad", texto(atencion.prioridad), y);
    y = dibujarFilaEtiquetaValor(doc, "Tipo de servicio", texto(atencion.tipoServicio), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "2. Datos del paciente", y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre", texto(atencion.pacienteNombre), y);
    y = dibujarFilaEtiquetaValor(doc, "Edad", texto(atencion.pacienteEdad), y);
    y = dibujarFilaEtiquetaValor(doc, "Fecha de nacimiento", texto(atencion.pacienteFechaNacimiento), y);
    y = dibujarFilaEtiquetaValor(doc, "Documento", `${texto(atencion.pacienteTipoDoc)} ${texto(atencion.pacienteDocumento)}`, y);
    y = dibujarFilaEtiquetaValor(doc, "Dirección", texto(atencion.pacienteDireccion), y);
    y = dibujarFilaEtiquetaValor(doc, "Teléfonos", `${texto(atencion.pacienteTelefono1)} / ${texto(atencion.pacienteTelefono2)}`, y);
    y = dibujarFilaEtiquetaValor(doc, "Seguridad social (EPS)", texto(atencion.pacienteEps), y);
    y = dibujarFilaEtiquetaValor(doc, "SOAT", texto(atencion.pacienteSoat), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "3. Despacho y tiempos", y);
    y = dibujarFilaEtiquetaValor(doc, "Información de despacho", texto(atencion.informacionDespacho), y);
    y = dibujarFilaEtiquetaValor(doc, "Transferido de", texto(atencion.transferidoDe), y);
    y = dibujarFilaEtiquetaValor(doc, "Reporte previo", atencion.sinPrevioReporte ? "Sin previo reporte" : (atencion.seDesconoceReportePrevio ? "Se desconoce si hay previo" : texto(atencion.numeroPrevioReporte)), y);
    y = dibujarFilaEtiquetaValor(
        doc, "Tiempos",
        `Salida ${texto(atencion.tiempoSalida)} · Llega sitio ${texto(atencion.tiempoLlegaSitio)} · Sale sitio ${texto(atencion.tiempoSalidaSitio)} · Llega destino ${texto(atencion.tiempoLlegadaDestino)} · En servicio ${texto(atencion.tiempoEnServicio)} · En sede ${texto(atencion.tiempoEnSede)}`,
        y
    );
    y += 2;

    y = dibujarTituloSeccion(doc, "4. Motivo de atención", y);
    y = dibujarFilaEtiquetaValor(doc, "Motivo", texto(atencion.motivoAtencion), y);
    y = dibujarFilaEtiquetaValor(doc, "Evaluación subjetiva", texto(atencion.evaluacionSubjetiva), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "5. Problema presentado", y);
    y = dibujarLineaTabla(doc, textoLista(atencion.problemaPresentado), y);
    y += 2;

    y = dibujarSeccionSignosVitales(doc, atencion.signosVitales || [], y);

    y = dibujarTituloSeccion(doc, "7. Antecedentes personales", y);
    y = dibujarFilaEtiquetaValor(doc, "Patológicos", texto(atencion.antPatologicos), y);
    y = dibujarFilaEtiquetaValor(doc, "Quirúrgicos", texto(atencion.antQuirurgicos), y);
    y = dibujarFilaEtiquetaValor(doc, "Alérgicos", texto(atencion.antAlergicos), y);
    y = dibujarFilaEtiquetaValor(doc, "Medicamentos", texto(atencion.antMedicamentos), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "8. Evaluación física objetiva", y);
    y = dibujarLineaTabla(doc, texto(atencion.evaluacionFisica), y);
    y += 2;

    y = dibujarTituloSeccion(doc, "9. Manejo", y);
    y = dibujarLineaTabla(doc, texto(atencion.manejo), y);
    y += 2;

    y = dibujarSeccionLesiones(doc, atencion.lesiones || [], y);

    if (atencion.observacionesAtencion) {
        y = dibujarTituloSeccion(doc, "11. Observaciones", y);
        y = dibujarLineaTabla(doc, texto(atencion.observacionesAtencion), y);
        y += 2;
    }

    y = dibujarTituloSeccion(doc, "12. Persona que recibe el paciente", y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre", texto(atencion.recibeNombre), y);
    y = dibujarFilaEtiquetaValor(doc, "Cargo", texto(atencion.recibeCargo), y);
    y = dibujarFilaEtiquetaValor(doc, "Código", texto(atencion.recibeCodigo), y);
    y += 2;

    if (atencion.rechazaTraslado) {
        y = dibujarSeccionRechazo(doc, atencion, y);
    }

    y = dibujarTituloSeccion(doc, "14. TRIP — Personal que atendió", y);
    y = dibujarFilaEtiquetaValor(doc, "Tipo de personal", texto(atencion.tripTipo), y);
    y = dibujarFilaEtiquetaValor(doc, "Nombre", texto(atencion.tripNombre), y);

    dibujarPiePagina(doc);

    const fechaArchivo = atencion.fechaServicio || new Date().toISOString().split("T")[0];
    doc.save(`APH_${(atencion.pacienteNombre || "Atencion").replace(/\s+/g, "_")}_${atencion.id || "SN"}_${fechaArchivo}.pdf`);

}

/* ------------------------------------------------------------------------
   SIGNOS VITALES — tabla compacta, una fila por toma
------------------------------------------------------------------------ */

function dibujarSeccionSignosVitales(doc, tomas, y) {

    y = asegurarEspacio(doc, y, 30);
    y = dibujarTituloSeccion(doc, "6. Signos vitales", y);

    if (!tomas.some(t => Object.values(t || {}).some(v => v))) {
        y = dibujarLineaTabla(doc, "Sin registro.", y);
        return y + 2;
    }

    tomas.forEach((t, i) => {

        if (!t || !Object.values(t).some(v => v)) return;

        y = asegurarEspacio(doc, y, 20);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(13, 116, 144);
        doc.text(`Toma ${i + 1}${t.hora ? " — " + t.hora : ""}`, MARGEN + 2, y);
        y += 5;

        y = dibujarLineaTabla(
            doc,
            `FR: ${texto(t.fr)}  ·  FC: ${texto(t.fc)}  ·  T.A.: ${texto(t.ta)}  ·  Glucometría: ${texto(t.glucometria)} mg/dl  ·  Temp.: ${texto(t.temperatura)} °C  ·  Respiración: ${texto(t.respiracion)}`,
            y
        );
        y = dibujarLineaTabla(
            doc,
            `Conciencia (AVDN): ${texto(t.conciencia)}  ·  GCS: ${t.gcsNoValorable ? "No valorable" : `O${texto(t.gcsO)} V${texto(t.gcsV)} M${texto(t.gcsL)}`}  ·  Pupilas D/I: ${texto(t.pupilaD)} / ${texto(t.pupilaI)}`,
            y
        );
        y = dibujarLineaTabla(
            doc,
            `Piel: ${texto(t.pielColor)}, ${texto(t.pielTemp)}`,
            y
        );
        y += 2;

    });

    return y;

}

/* ------------------------------------------------------------------------
   LOCALIZACIÓN DE LESIONES — lista de texto (no se intenta capturar
   una imagen del cuerpo 3D; es frágil y esto es más legible impreso)
------------------------------------------------------------------------ */

function dibujarSeccionLesiones(doc, lesiones, y) {

    y = asegurarEspacio(doc, y, 20);
    y = dibujarTituloSeccion(doc, "10. Localización de lesiones", y);

    if (!lesiones.length) {
        y = dibujarLineaTabla(doc, "Sin lesiones marcadas.", y);
        return y + 2;
    }

    lesiones.forEach(l => {
        y = dibujarLineaTabla(doc, `•  ${l.parte} — ${l.etiqueta} (${l.codigo})`, y);
    });

    return y + 2;

}

/* ------------------------------------------------------------------------
   EXONERACIÓN DE RESPONSABILIDADES (solo si el paciente rechaza)
------------------------------------------------------------------------ */

function dibujarSeccionRechazo(doc, atencion, y) {

    const ALTURA_TITULO = 11;
    const alturaFirmas = 35 + 35;
    const alturaTexto = 14;

    y = asegurarEspacio(doc, y, ALTURA_TITULO + alturaTexto + alturaFirmas);

    y = dibujarTituloSeccion(doc, "13. Exoneración de responsabilidades", y);
    y = dibujarLineaTabla(
        doc,
        "El paciente rechaza el tratamiento/traslado y reconoce que el personal de la ambulancia se lo recomendó, " +
        "eximiendo a dicho personal de toda responsabilidad por haber respetado sus deseos expresos.",
        y
    );
    if (atencion.disposicion) {
        y = dibujarFilaEtiquetaValor(doc, "Disposición", texto(atencion.disposicion), y);
    }
    y += 4;

    y = dibujarBloqueFirma(doc, "Firma del paciente", atencion.firmaRechazoPaciente, "", y);
    y = dibujarBloqueFirma(doc, "Firma del testigo", atencion.firmaRechazoTestigo, "", y);

    return y + 2;

}

function dibujarBloqueFirma(doc, etiqueta, firmaDataUrl, cedula, y) {

    doc.setDrawColor(150, 150, 150);
    doc.line(MARGEN + 2, y + 18, MARGEN + 82, y + 18);

    if (firmaDataUrl) {
        try {
            doc.addImage(firmaDataUrl, "PNG", MARGEN + 4, y, 60, 17);
        } catch (error) {
            console.warn(`[aph/pdf] No se pudo dibujar la firma "${etiqueta}":`, error);
        }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(etiqueta, MARGEN + 2, y + 23);

    if (cedula) {
        doc.setFontSize(8.5);
        doc.setTextColor(90, 90, 90);
        doc.text(`C.C.: ${texto(cedula)}`, MARGEN + 2, y + 28);
    }

    return y + 35;

}

/* ------------------------------------------------------------------------
   ENCABEZADO / PIE / AUXILIARES DE LAYOUT
------------------------------------------------------------------------ */

function dibujarEncabezado(doc, atencion) {

    doc.setFillColor(13, 116, 144); // teal médico, el color diferenciador de APH
    doc.rect(0, 0, ANCHO_PAGINA, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Cuerpo de Bomberos Voluntarios de Villamaría", MARGEN, 12);

    doc.setFontSize(11);
    doc.text("Atención Prehospitalaria — Historia Clínica del Traslado (FT-AMB)", MARGEN, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Código: ${atencion.id || "—"}`, ANCHO_PAGINA - MARGEN, 12, { align: "right" });
    doc.text(`Paciente: ${atencion.pacienteNombre || "—"}`, ANCHO_PAGINA - MARGEN, 18, { align: "right" });
    doc.text(`Fecha: ${atencion.fechaServicio || "—"}`, ANCHO_PAGINA - MARGEN, 24, { align: "right" });

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
