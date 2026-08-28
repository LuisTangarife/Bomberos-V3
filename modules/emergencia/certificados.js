/* ========================================================================
   CERTIFICADOS.JS
   Módulo Emergencia — Reporte de intervención basado en plantilla externa

   La plantilla vive en modules/emergencia/plantillas/plantilla1.html
   (más sus imágenes en modules/emergencia/plantillas/assets/) y contiene
   el diseño de la carta oficial con marcadores {{PLACEHOLDER}} — el
   mismo patrón que ya usa el Apps Script (body.replaceText), aplicado
   en el cliente.

   Requiere que la página tenga, con ESTOS ids exactos, el modal de
   certificado: #certModal (contenedor) y #certContent (donde se
   inyecta el HTML). Ver index.html o gestor.html.
======================================================================== */

import {
  formatDate,
  calcularCoordenadas,
  personalTexto as personalTextoHelper,
  vehiculosTexto as vehiculosTextoHelper,
  renderAfectadosTexto,
  generarDocNum
} from "./report-helpers.js";

import { generarDocumentoWordBlob, descargarBlobWord, renderizarDocxEnContenedor, prepararBlobParaVistaPrevia } from "./docx-engine.js";

const RUTA_PLANTILLA = "./plantillas/plantilla1.html";

let _plantillaCache = null;
let currentPrintHTML = "";

// Datos y docNum del último certificado renderizado en pantalla.
let _ultimaCertData = null;
let _ultimoDocNum = null;

// Blob del Word real (plantilla1.docx ya diligenciada) que se muestra
// en el modal vía docx-preview Y que se descarga con "Descargar Word".
// Es la fuente de la descarga ("Descargar Word") y, salvo una
// normalización de encabezados/pies (ver prepararBlobParaVistaPrevia
// en docx-engine.js), también de lo que se muestra en el modal — antes
// había un PDF generado por
// separado (desde plantilla1.html) para la vista previa, y un Word
// aparte para la descarga; ahora solo existe un documento.
let _ultimoWordBlob = null;
let _ultimoWordNombre = null;

async function cargarPlantilla() {
  if (_plantillaCache) return _plantillaCache;
  const respuesta = await fetch(RUTA_PLANTILLA);
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${RUTA_PLANTILLA} (HTTP ${respuesta.status})`);
  }
  _plantillaCache = await respuesta.text();
  return _plantillaCache;
}

// Precarga apenas se evalúa el módulo, para que el primer certificado
// del turno no espere el fetch completo.
cargarPlantilla().catch(err =>
  console.error("[certificados] No se pudo precargar la plantilla:", err)
);

// Reemplaza {{CLAVE}} → valor. Si una clave no está en `valores`, la
// deja intacta a propósito — así un nombre mal escrito en la plantilla
// se nota (queda visible el {{...}}) en vez de desaparecer en silencio.
function reemplazarPlaceholders(html, valores) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, clave) =>
    Object.prototype.hasOwnProperty.call(valores, clave)
      ? String(valores[clave])
      : match
  );
}

// Conserva o borra un bloque <!--SECCION:X-->...<!--FIN:X--> completo
// según si hay datos. mostrar=false borra el bloque entero (comentarios
// incluidos); mostrar=true deja el contenido y quita solo los comentarios.
function aplicarSeccion(html, nombre, mostrar) {
  const patron = new RegExp(`<!--SECCION:${nombre}-->([\\s\\S]*?)<!--FIN:${nombre}-->`, "g");
  return html.replace(patron, (_, contenido) => (mostrar ? contenido : ""));
}

// Bloque HTML por afectado (nombre, datos, firma si tiene) para
// {{FIRMAS_AFECTADOS}} — separado de {{AFECTADOS}} porque ese es solo
// el resumen en texto.
function renderFirmasAfectadosHTML(afectados) {
  if (!afectados?.length) return '';
  return afectados.map(a => `
    <div class="firma-afectado">
      <strong>${a.nombre || ''}</strong><br>
      DNI: ${a.dni || ''} · Edad: ${a.edad || ''} · Género: ${a.genero || ''}<br>
      ${a.lesionado ? `Lesionado: ${a.lesionado}<br>` : ''}
      ${a.telefono ? `Tel: ${a.telefono}<br>` : ''}
      ${a.correo ? `Correo: ${a.correo}<br>` : ''}
      ${a.firma && a.firma !== 'Sin firma' ? `<img src="${a.firma}" alt="Firma ${a.nombre || ''}">` : ''}
    </div>
  `).join('');
}

// Bloque HTML por bombero firmante — mismo criterio que el Apps Script
// (omite a quien no tenga firma real).
function renderFirmasBomberosHTML(firmasBomberos) {
  if (!firmasBomberos?.length) return '';
  return firmasBomberos
    .filter(b => b.firma && b.firma !== 'Sin firma')
    .map(b => `
      <div class="firma-bombero">
        <img src="${b.firma}" alt="Firma ${b.nombre || ''}">
        <div class="linea"></div>
        ${b.nombre || ''}
      </div>
    `).join('');
}

// ⚠️ OJO: buildCertificateHTML y sus helpers (cargarPlantilla,
// reemplazarPlaceholders, aplicarSeccion, renderFirmasAfectadosHTML,
// renderFirmasBomberosHTML) YA NO alimentan el modal de certificado —
// eso ahora usa docx-preview sobre el .docx real (ver renderCertificate
// más abajo). Se mantienen aquí sin tocar porque app.js todavía las usa
// para armar el PDF que adjunta a Firestore al guardar un reporte
// (generatePDFBase64 → buildHiddenCertificate → buildCertificateHTML).
// Si algún día esa función también se migra al Word real, esto se
// puede eliminar.
export async function buildCertificateHTML(data, docNum) {

  let plantilla = await cargarPlantilla();
  // CORREGIR RUTAS DE LAS IMÁGENES
  plantilla = plantilla.replaceAll(
      './assets/',
      './plantillas/assets/'
  );

  const numeroReporte = docNum || generarDocNum();

  let html = reemplazarPlaceholders(plantilla, {
    REPORTE_ID: numeroReporte,
    FECHA: formatDate(data.fecha),
    HORA_LLEGADA: data.horaLlegada || '',
    HORA_FINAL: data.horaFinal || '',
    LATITUD: data.latitud || '',
    LONGITUD: data.longitud || '',
    COORDENADAS: calcularCoordenadas(data),
    LUGAR: data.lugar || '',
    DIRECCION: data.direccion || '',
    EVENTO: data.evento || '',
    PERSONAL: personalTextoHelper(data.personal),
    VEHICULOS: vehiculosTextoHelper(data.vehiculos),
    DESCRIPCION: data.descripcion || '',
    LESIONADOS: data.lesionados || 0,
    VICTIMAS: data.victimas || 0,
    AFECTADOS: renderAfectadosTexto(data.afectados),
    FIRMAS_AFECTADOS: renderFirmasAfectadosHTML(data.afectados),
    NOVEDADES: data.novedades || '',
    FIRMAS_BOMBEROS: renderFirmasBomberosHTML(data.firmasBomberos)
  });

  html = aplicarSeccion(html, 'FIRMAS_AFECTADOS', Boolean(data.afectados?.length));
  html = aplicarSeccion(html, 'NOVEDADES', Boolean(data.novedades));

  return html;

}

// docx-preview no soporta bien un ancla flotante que comparte párrafo
// con texto centrado ("codigo-verificacion" junto al nombre del
// comandante): la deja posicionada con transformaciones relativas
// (position:relative + left/top) que dependen de dónde cayó en el
// flujo de línea centrado, no del margen real. En vez de intentar
// predecir esa matemática interna (dos intentos previos a nivel de
// XML fallaron), se reposiciona en el DOM YA renderizado: se saca el
// envoltorio de su flujo (position:absolute) y se centra respecto al
// propio párrafo del nombre, que es la referencia visual que de
// verdad importa.
function corregirPosicionCodigoVerificacion(contenedor) {

    const parrafos = contenedor.querySelectorAll('p');

    for (const p of parrafos) {

        if (!/JUAN\s+CAMILO\s+OCAMPO/i.test(p.textContent)) continue;

        const img = p.querySelector('img');
        if (!img) continue;

        const envoltorio = img.parentElement;
        if (!envoltorio) continue;

        // El <p> debe ser el contenedor de referencia para el
        // posicionamiento absoluto del ancla.
        p.style.position = 'relative';

        const ancho = img.style.width || `${img.width}px`;
        const alto = img.style.height || `${img.height}px`;

        envoltorio.style.position = 'absolute';
        envoltorio.style.width = ancho;
        envoltorio.style.height = alto;
        envoltorio.style.left = '50%';
        envoltorio.style.marginLeft = `-${parseFloat(ancho) / 2}${ancho.replace(/[\d.]/g, '')}`;
        envoltorio.style.top = 'auto';
        // 6pt de separación entre el borde inferior de la imagen y el
        // inicio del texto; punto de partida a calibrar con captura.
        envoltorio.style.bottom = 'calc(100% + 6pt)';

        img.style.position = 'relative';
        img.style.left = '0';
        img.style.top = '0';

    }

}

export async function renderCertificate(data, id = null) {

  // Un solo docNum para todo el ciclo de vida de este reporte en
  // pantalla: la vista en el modal y el archivo que se descargue con
  // "Descargar Word" son AHORA el mismo documento, así que solo hace
  // falta un docNum, generado una vez.
  const docNum = generarDocNum();

  const contenido = document.getElementById('certContent');
  const modal = document.getElementById('certModal');

  contenido.innerHTML = `
    <div style="padding:40px;text-align:center;color:inherit;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;"></i>
      <p style="margin-top:12px;">Generando el documento oficial...</p>
    </div>
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  _ultimaCertData = data;
  _ultimoDocNum = docNum;

  try {

    // Genera el Word real (plantilla1.docx diligenciada) UNA sola vez;
    // el mismo Blob es el que se descarga con "Descargar Word" — no se
    // toca para nada.
    const { blob, nombreArchivo } = await generarDocumentoWordBlob(data, docNum);

    _ultimoWordBlob = blob;
    _ultimoWordNombre = nombreArchivo;

    contenido.innerHTML = '';

    // La plantilla trae encabezados/pies "first" y "even" que Word
    // escribe siempre pero que este documento en particular no usa
    // (no tiene activado "primera página diferente" ni "pares e
    // impares diferentes"). docx-preview no distingue eso y puede
    // mostrar el encabezado equivocado (sin logos) o páginas de más.
    // Se genera una copia SOLO para mostrar aquí; el archivo que se
    // descarga sigue siendo el original completo.
    const blobParaVista = await prepararBlobParaVistaPrevia(blob);

    // docx-preview convierte el .docx real a HTML dentro de #certContent
    // — es el documento oficial, no una réplica en HTML mantenida aparte.
    await renderizarDocxEnContenedor(blobParaVista, contenido);

    // Corrige en el DOM ya renderizado la posición del código de
    // verificación junto al nombre del comandante (ver función arriba).
    corregirPosicionCodigoVerificacion(contenido);

  } catch (error) {

    console.error('[certificados] No se pudo generar el documento del reporte:', error);

    _ultimoWordBlob = null;
    _ultimoWordNombre = null;

    contenido.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:1.4rem;color:#e67e22;"></i>
        <p style="margin-top:12px;">No fue posible generar el documento del reporte.</p>
        <p style="opacity:.7;font-size:.85rem;">${error && error.message ? error.message : ''}</p>
      </div>
    `;

  }

}

/**
 * Descarga el Word real del reporte actualmente abierto en el modal.
 * Reutiliza el Blob que ya se generó para mostrarlo — no vuelve a
 * renderizar el documento.
 * Requiere haber llamado antes a renderCertificate/window.renderCertificate.
 */
export function descargarWord() {

  if (!_ultimoWordBlob) {
    alert('Primero genera el certificado.');
    return;
  }

  descargarBlobWord(_ultimoWordBlob, _ultimoWordNombre || 'certificado.docx');

}

/**
 * Genera y descarga el Word del reporte SIN abrir el modal de vista
 * previa. Reutiliza exactamente el mismo generador que usa el modal
 * (generarDocumentoWordBlob) y la misma rutina de descarga que usa
 * "Descargar Word" en el gestor (descargarBlobWord) — es el mismo
 * documento, solo que aquí se descarga de una vez, sin mostrarlo antes
 * en pantalla.
 * Pensada para el botón "Descargar Reporte" del formulario de registro,
 * justo después de guardar.
 */
export async function descargarReporteDirecto(data) {

  const docNum = generarDocNum();

  const { blob, nombreArchivo } = await generarDocumentoWordBlob(data, docNum);

  descargarBlobWord(blob, nombreArchivo);

}

export function closeModal() {
  document.getElementById('certModal').style.display = 'none';
  document.body.style.overflow = '';
}

/**
 * Imprime el documento actualmente mostrado en el modal. #certContent
 * ya contiene el Word real renderizado por docx-preview, así que basta
 * con usar window.print() apoyado en una regla @media print (ver
 * styles.css/gestor.css) que oculta todo lo demás de la página y deja
 * visible solo ese contenedor — más simple y confiable que abrir una
 * ventana nueva o depender de un iframe con un PDF aparte.
 */
export function printCertificate() {

    if (!_ultimoWordBlob) {
        alert("Primero genera el certificado.");
        return;
    }

    window.print();

}

const _certModalEl = document.getElementById('certModal');

if (_certModalEl) {
  _certModalEl.addEventListener('click', (e) => {
    if (e.target === _certModalEl) closeModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
