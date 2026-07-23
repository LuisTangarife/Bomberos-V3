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

import { generarDocumentoWord } from "./docx-engine.js";

const RUTA_PLANTILLA = "./plantillas/plantilla1.html";

let _plantillaCache = null;
let currentPrintHTML = "";

// Datos y docNum del último certificado renderizado en pantalla, para
// que "Descargar Word" pueda generar exactamente el mismo reporte sin
// necesidad de que el usuario vuelva a diligenciar nada. Si se genera
// un Word nuevo con un docNum distinto al que ve el usuario en la
// pantalla, los dos documentos quedarían con números de reporte
// distintos para la misma emergencia — por eso se reutiliza el mismo.
let _ultimaCertData = null;
let _ultimoDocNum = null;

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

export async function renderCertificate(data, id = null) {

  // Un solo docNum para todo el ciclo de vida de este reporte en
  // pantalla: la vista HTML y el Word que se descargue después (si el
  // usuario hace clic en "Descargar Word") deben mostrar el mismo
  // número, no uno nuevo generado por separado en cada acción.
  const docNum = generarDocNum();

  const certHTML = await buildCertificateHTML(data, docNum);

  document.getElementById('certContent').innerHTML = certHTML;
  // Guardamos exactamente el HTML de la plantilla
  // (incluye su propio CSS interno)

  currentPrintHTML = certHTML;
  _ultimaCertData = data;
  _ultimoDocNum = docNum;

  document.getElementById('certModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

}

/**
 * Genera y descarga el Word oficial (plantilla1.docx diligenciada) del
 * reporte que está actualmente abierto en el modal de certificado.
 * Requiere haber llamado antes a renderCertificate/window.renderCertificate.
 */
export async function descargarWord() {

  if (!_ultimaCertData) {
    alert('Primero genera el certificado.');
    return;
  }

  try {

    await generarDocumentoWord(_ultimaCertData, _ultimoDocNum);

  } catch (error) {

    console.error('[certificados] No se pudo generar el Word:', error);
    alert(error.message || 'No fue posible generar el documento Word.');

  }

}

export function closeModal() {
  document.getElementById('certModal').style.display = 'none';
  document.body.style.overflow = '';
}

export function printCertificate() {

    if (!currentPrintHTML) {

        alert("Primero genera el certificado.");

        return;

    }

    const ventana = window.open("", "_blank");

    if (!ventana) {

        alert("El navegador bloqueó la ventana.");

        return;

    }

    ventana.document.open();

    ventana.document.write(currentPrintHTML);

    ventana.document.close();

    ventana.focus();

    ventana.onload = () => {

        setTimeout(() => {

            ventana.print();

        }, 300);

    };

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
