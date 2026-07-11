/* ========================================================================
   PDF.JS
   Sistema de Inspecciones — Generación del informe en PDF
   Usa jsPDF (cargado por CDN, ver index.html). No depende de autotable:
   las "tablas" se dibujan a mano para no arrastrar una segunda librería.
======================================================================== */

const MARGEN = 14;
const ANCHO_PAGINA = 210;   // A4 mm
const ALTO_PAGINA = 297;    // A4 mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

// Las fuentes base de jsPDF (Helvetica/WinAnsi) no rendericen de forma fiable
// subíndices ni superíndices Unicode (p. ej. "₂" en "CO₂", o "²" en "m²").
// Sin esto, esos caracteres se pierden o corrompen el texto en el PDF.
const SUBINDICES = { "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9" };
const SUPERINDICES = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9" };
const MAPA_SANEADO = { ...SUBINDICES, ...SUPERINDICES };

function limpiarTextoPDF(texto) {
    return String(texto ?? "").replace(/[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => MAPA_SANEADO[ch] || ch);
}

/* ------------------------------------------------------------------------
   ESQUEMA DEL FORMULARIO (se construye una sola vez a partir del DOM)
------------------------------------------------------------------------ */

let esquemaCache = null;

function construirEsquema() {

    if (esquemaCache) return esquemaCache;

    const pasos = [...document.querySelectorAll("#inspectionForm .form-step")];

    esquemaCache = pasos.map(paso => {

        const heading = paso.querySelector("h2");
        const titulo = limpiarTextoPDF(heading ? heading.textContent.trim() : paso.id);

        const items = [];

        // Grupos simples (label + un campo), evitando los que están dentro de tablas
        paso.querySelectorAll(".form-group").forEach(grupo => {

            if (grupo.closest("table")) return;

            const campo = grupo.querySelector("input, select, textarea");
            const label = grupo.querySelector("label");

            if (!campo || !campo.name) return;

            items.push({
                tipo: "campo",
                label: limpiarTextoPDF(label ? label.textContent.trim() : campo.name),
                nombre: campo.name,
                esCheckbox: campo.type === "checkbox"
            });

        });

        // Tablas de chequeo (una fila por elemento inspeccionado)
        paso.querySelectorAll("table.inspection-table").forEach(tabla => {

            const encabezados = [...tabla.querySelectorAll("thead th")]
                .map(th => limpiarTextoPDF(th.textContent.trim()));

            const filas = [...tabla.querySelectorAll("tbody tr")].map(fila => {

                const celdas = [...fila.querySelectorAll("td")];
                const etiqueta = limpiarTextoPDF(celdas[0]?.textContent.trim() || "");

                const columnas = [];
                const nombresRadio = new Set();

                celdas.slice(1).forEach((celda, i) => {

                    const campo = celda.querySelector("input, select");
                    if (!campo) return;

                    const encabezado = encabezados[i + 1] || "";

                    if (campo.type === "radio") {
                        if (nombresRadio.has(campo.name)) return;
                        nombresRadio.add(campo.name);
                        columnas.push({ tipo: "radio", nombre: campo.name, encabezado });
                    } else if (campo.type === "checkbox") {
                        columnas.push({ tipo: "checkbox", nombre: campo.name, encabezado });
                    } else {
                        columnas.push({ tipo: "texto", nombre: campo.name, encabezado });
                    }

                });

                return { etiqueta, columnas };

            }).filter(fila => fila.columnas.length);

            if (filas.length) {
                items.push({ tipo: "tabla", filas });
            }

        });

        return { titulo, items };

    }).filter(paso => paso.items.length);

    return esquemaCache;

}

/* ------------------------------------------------------------------------
   LECTURA DE VALORES
------------------------------------------------------------------------ */

function valorTexto(datos, nombre) {
    const valor = datos ? datos[nombre] : undefined;
    if (valor === null || valor === undefined || valor === "") return "—";
    return limpiarTextoPDF(valor);
}

function resolverFilaTabla(datos, fila) {

    const columnaRadio = fila.columnas.find(c => c.tipo === "radio");
    const soloRadioYObs = fila.columnas.every(
        c => c.tipo === "radio" || c.nombre.endsWith("_obs")
    );

    // Fila tipo checklist con radios (Sí/No/N.A.): una sola respuesta combinada
    if (columnaRadio && soloRadioYObs) {

        const valorGuardado = datos ? datos[columnaRadio.nombre] : null;

        const respuesta =
            valorGuardado === "Si" ? "Sí" :
            valorGuardado === "No" ? "No" :
            valorGuardado === "NA" ? "N.A." : "—";

        const obsCampo = fila.columnas.find(c => c.nombre.endsWith("_obs"));
        const obs = obsCampo ? valorTexto(datos, obsCampo.nombre) : null;

        return `${fila.etiqueta}: ${respuesta}` + (obs && obs !== "—" ? ` — Obs.: ${obs}` : "");
    }

    // Fila tipo mixto (checkbox/número/texto/select): pares "Encabezado: valor"
    const partes = fila.columnas.map(col => {

        let valor;

        if (col.tipo === "checkbox") {
            valor = datos && datos[col.nombre] ? "Sí" : "No";
        } else {
            valor = valorTexto(datos, col.nombre);
        }

        return `${col.encabezado}: ${valor}`;

    });

    return `${fila.etiqueta} — ${partes.join(" · ")}`;

}

/* ------------------------------------------------------------------------
   GENERACIÓN DEL PDF
------------------------------------------------------------------------ */

export async function generarPDF(inspeccion) {

    if (!inspeccion) return;

    if (!window.jspdf) {
        alert("No se pudo cargar la librería de generación de PDF (jsPDF). Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const datos = inspeccion.formulario || {};
    const esquema = construirEsquema();

    let y = MARGEN;

    y = dibujarEncabezado(doc, datos);

    esquema.forEach(seccion => {

        y = asegurarEspacio(doc, y, 20);
        y = dibujarTituloSeccion(doc, seccion.titulo, y);

        seccion.items.forEach(item => {

            if (item.tipo === "campo") {

                const valor = item.esCheckbox
                    ? (datos[item.nombre] ? "Sí" : "No")
                    : valorTexto(datos, item.nombre);

                y = dibujarFilaEtiquetaValor(doc, item.label, valor, y);

            } else if (item.tipo === "tabla") {

                item.filas.forEach(fila => {
                    y = dibujarLineaTabla(doc, resolverFilaTabla(datos, fila), y);
                });

            }

        });

        y += 3;

    });

    y = dibujarFotos(doc, inspeccion.fotos || [], y);

    dibujarFirmas(doc, inspeccion.firmas || {}, y);

    dibujarPiePagina(doc);

    const numero = datos.numeroInspeccion || "SN";
    const fecha = datos.fecha || new Date().toISOString().split("T")[0];

    doc.save(`Inspeccion_${numero}_${fecha}.pdf`);

}

/* ------------------------------------------------------------------------
   BLOQUES DE DIBUJO
------------------------------------------------------------------------ */

function dibujarEncabezado(doc, datos) {

    doc.setFillColor(180, 20, 12);
    doc.rect(0, 0, ANCHO_PAGINA, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Cuerpo de Bomberos Voluntarios de Villamaría", MARGEN, 12);

    doc.setFontSize(11);
    doc.text("Informe de Inspección de Seguridad", MARGEN, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`N.° ${datos.numeroInspeccion || "—"}`, ANCHO_PAGINA - MARGEN, 12, { align: "right" });
    doc.text(`Fecha: ${datos.fecha || "—"}  ${datos.hora || ""}`, ANCHO_PAGINA - MARGEN, 18, { align: "right" });
    doc.text(`Estado: ${datos.estado || "Pendiente"}`, ANCHO_PAGINA - MARGEN, 24, { align: "right" });

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

function dibujarFotos(doc, fotos, y) {

    if (!fotos.length) return y;

    y = asegurarEspacio(doc, y, 20);
    y = dibujarTituloSeccion(doc, `Evidencias Fotográficas (${fotos.length})`, y);

    const columnas = 3;
    const espacio = 4;
    const anchoImg = (ANCHO_UTIL - espacio * (columnas - 1)) / columnas;
    const altoImg = anchoImg * 0.75;

    let col = 0;

    fotos.forEach(foto => {

        if (col === 0) {
            y = asegurarEspacio(doc, y, altoImg + 6);
        }

        const x = MARGEN + col * (anchoImg + espacio);

        try {
            doc.addImage(foto.imagen, "JPEG", x, y, anchoImg, altoImg, undefined, "FAST");
        } catch (error) {
            doc.setDrawColor(200);
            doc.rect(x, y, anchoImg, altoImg);
        }

        col++;

        if (col >= columnas) {
            col = 0;
            y += altoImg + espacio + 2;
        }

    });

    if (col !== 0) y += altoImg + espacio + 2;

    return y + 4;

}

function dibujarFirmas(doc, firmas, y) {

    y = asegurarEspacio(doc, y, 60);
    y = dibujarTituloSeccion(doc, "Firmas", y);

    const anchoFirma = (ANCHO_UTIL - 10) / 2;
    const altoFirma = 30;

    [
        { titulo: "Inspector", imagen: firmas.inspector, x: MARGEN },
        { titulo: "Propietario / Responsable", imagen: firmas.propietario, x: MARGEN + anchoFirma + 10 }
    ].forEach(({ titulo, imagen, x }) => {

        doc.setDrawColor(210);
        doc.rect(x, y, anchoFirma, altoFirma);

        if (imagen) {
            try {
                doc.addImage(imagen, "PNG", x + 2, y + 2, anchoFirma - 4, altoFirma - 4, undefined, "FAST");
            } catch (error) {
                // Si la firma no se puede insertar, se deja el recuadro vacío
            }
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(titulo, x, y + altoFirma + 5);

    });

    return y + altoFirma + 10;

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
