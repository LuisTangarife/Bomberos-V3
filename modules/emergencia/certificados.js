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

// Mismo formato que afectadosTexto en el Apps Script — una línea por
// afectado, unida con salto de línea (el CSS de la plantilla usa
// white-space:pre-line en .reporte-descripcion-texto, pero aquí el
// destino es un <p> normal, así que unimos con <br> en vez de \n).
function renderAfectadosTexto(afectados) {
  if (!afectados?.length) return 'Ninguno reportado';
  return afectados
    .map(a => `${a.nombre || ''} | DNI: ${a.dni || ''} | Edad: ${a.edad || ''} | Género: ${a.genero || ''} | Tel: ${a.telefono || ''}`)
    .join('<br>');
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

export async function buildCertificateHTML(data) {

  const plantilla = await cargarPlantilla();
  // CORREGIR RUTAS DE LAS IMÁGENES
  plantilla = plantilla.replaceAll(
      './assets/',
      './plantillas/assets/'
  );

  const docNum = `CB-${Date.now()}`;

  const coords = data.latitud && data.longitud
    ? `${data.latitud}, ${data.longitud}`
    : 'No disponibles';

  const personalTexto = Array.isArray(data.personal) && data.personal.length
    ? data.personal.join(', ')
    : 'No reportado';

  const vehiculosTexto = Array.isArray(data.vehiculos) && data.vehiculos.length
    ? data.vehiculos.map(v => v.vehiculo).filter(Boolean).join(', ')
    : 'No reportados';

  let html = reemplazarPlaceholders(plantilla, {
    REPORTE_ID: docNum,
    FECHA: formatDate(data.fecha),
    HORA_LLEGADA: data.horaLlegada || '',
    HORA_FINAL: data.horaFinal || '',
    LATITUD: data.latitud || '',
    LONGITUD: data.longitud || '',
    COORDENADAS: coords,
    LUGAR: data.lugar || '',
    DIRECCION: data.direccion || '',
    EVENTO: data.evento || '',
    PERSONAL: personalTexto,
    VEHICULOS: vehiculosTexto,
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
