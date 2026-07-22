/* ========================================================================
   CERTIFICADOS.JS
   Módulo Emergencia — Certificado basado en plantilla externa

   La plantilla vive en modules/emergencia/plantillas/plantilla1.html y
   contiene el diseño estático (logo, firma del comandante, layout) con
   marcadores {{PLACEHOLDER}}. Este módulo solo carga esa plantilla y
   reemplaza los marcadores con los datos del reporte — el mismo patrón
   que ya usa el Apps Script (body.replaceText), aplicado en el cliente.

   Requiere que la página tenga, con ESTOS ids exactos, el modal de
   certificado: #certModal (contenedor) y #certContent (donde se
   inyecta el HTML). Ver index.html o gestor.html.
======================================================================== */

const RUTA_PLANTILLA = "./plantillas/plantilla1.html";

let _plantillaCache = null;

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

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${day} ${months[parseInt(m)-1]} ${y}`;
}

function generateQRCode(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
}

// HTML por persona afectada — mismo contenido que ya tenías, incluida
// la firma individual si existe. A diferencia del .gs, esto es HTML
// real, no una línea de texto.
function renderAfectadosHTML(afectados) {
  if (!afectados?.length) return "";
  return afectados.map(a => `
    <div class="affected-row">
      <div><b>Nombre:</b> ${a.nombre}</div>
      <div><b>DNI:</b> ${a.dni}</div>
      <div><b>Edad:</b> ${a.edad}</div>
      <div><b>Género:</b> ${a.genero}</div>
      <div><b>Lesionado:</b> ${a.lesionado || 'No'}</div>
      <div><b>Teléfono:</b> ${a.telefono}</div>
      <div><b>Correo:</b> ${a.correo}</div>
      ${a.firma ? `<img src="${a.firma}" class="affected-signature">` : ''}
    </div>
  `).join('');
}

function renderFotosHTML(photos) {
  if (!photos?.length) return "";
  return photos.map(photo => `<div class="cert-photo-card"><img src="${photo}"></div>`).join('');
}

export async function buildCertificateHTML(data) {

  const plantilla = await cargarPlantilla();

  const emitted = new Date().toLocaleString('es-CO');
  const docNum = `CB-${Date.now()}`;
  const coords = data.latitud && data.longitud
    ? `${data.latitud}, ${data.longitud}`
    : 'No disponibles';

  const personalTexto = Array.isArray(data.personal) ? data.personal.join(', ') : '';
  const vehiculosTexto = Array.isArray(data.vehiculos)
    ? data.vehiculos.map(v => v.vehiculo).filter(Boolean).join(', ')
    : '';

  let html = reemplazarPlaceholders(plantilla, {
    REPORTE_ID: docNum,
    EMITIDO: emitted,
    FECHA: formatDate(data.fecha),
    HORA_REPORTE: data.horaReporte || '',
    HORA_LLEGADA: data.horaLlegada || '',
    HORA_FINAL: data.horaFinal || '',
    LUGAR: data.lugar || '',
    DIRECCION: data.direccion || '',
    COORDENADAS: coords,
    EVENTO: data.evento || '',
    PERSONAL: personalTexto,
    VEHICULOS: vehiculosTexto,
    DESCRIPCION: data.descripcion || '',
    LESIONADOS: data.lesionados || 0,
    VICTIMAS: data.victimas || 0,
    NOVEDADES: data.novedades || '',
    AFECTADOS: renderAfectadosHTML(data.afectados),
    FOTOS: renderFotosHTML(data.photos),
    QR: generateQRCode(docNum),
    FIRMA_OFICIAL_NOMBRE: data.firmasBomberos?.[0]?.nombre || 'Oficial de Turno',
    FIRMA_OFICIAL_IMG: data.firmasBomberos?.length && data.firmasBomberos[0]?.firma
      ? `<img src="${data.firmasBomberos[0].firma}" class="cert-firma-bombero">`
      : ''
  });

  html = aplicarSeccion(html, 'NOVEDADES', Boolean(data.novedades));
  html = aplicarSeccion(html, 'AFECTADOS', Boolean(data.afectados?.length));
  html = aplicarSeccion(html, 'FOTOS', Boolean(data.photos?.length));

  return html;

}

let currentPrintHTML = '';

export async function renderCertificate(data, id = null) {

  const certHTML = await buildCertificateHTML(data);

  document.getElementById('certContent').innerHTML = certHTML;

  const styles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
      } catch (e) {
        return '';
      }
    })
    .join('');

  currentPrintHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Bomberos</title>
      <style>${styles}</style>
    </head>
    <body class="print-mode">
      ${certHTML}
    </body>
    </html>
  `;

  document.getElementById('certModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

}

export function closeModal() {
  document.getElementById('certModal').style.display = 'none';
  document.body.style.overflow = '';
}

export function printCertificate() {

  if (!currentPrintHTML) {
    alert('Primero genera el certificado.');
    return;
  }

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('El navegador bloqueó la ventana emergente.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(currentPrintHTML);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
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
