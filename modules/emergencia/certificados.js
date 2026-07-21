/* ========================================================================
   CERTIFICADOS.JS
   Módulo Emergencia — Generación y despliegue del certificado

   Única fuente real de buildCertificateHTML / renderCertificate /
   closeModal / printCertificate. Antes vivían duplicadas dentro de
   app.js; ahora tanto index.html (vía el import() dinámico que ya
   existe en app.js) como gestor.html (vía import estático en gestor.js)
   cargan este mismo módulo.

   Requiere que la página que lo use tenga, con ESTOS ids exactos, el
   modal de certificado: #certModal (contenedor) y #certContent (donde
   se inyecta el HTML). Ver index.html o gestor.html.
======================================================================== */

// Pega aquí el string base64 COMPLETO que cortaste de index.html
// (la constante IMG_LOGO).
const IMG_LOGO = "PEGAR_AQUI_EL_BASE64_COMPLETO_DE_IMG_LOGO";

// Pega aquí el string base64 COMPLETO que vas a cortar de app.js
// en la Parte 3 (la constante IMG_FIRMA, línea 34).
const IMG_FIRMA = "PEGAR_AQUI_EL_BASE64_COMPLETO_DE_IMG_FIRMA";

let currentPrintHTML = '';

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${day} ${months[parseInt(m)-1]} ${y}`;
}

function generateQRCode(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
}

export function buildCertificateHTML(data){

  const emitted = new Date().toLocaleString('es-CO');
  const docNum = `CB-${Date.now()}`;
  const coords = data.latitud && data.longitud
    ? `${data.latitud}, ${data.longitud}`
    : 'No disponibles';

  return `

<div class="cert-preview-wrapper">
<div class="page">

<img src="${IMG_LOGO}" class="watermark">

<!-- BARRA SUPERIOR -->
<div class="top-bar">
  <span class="top-bar-text">BENEMÉRITO CUERPO DE BOMBEROS VOLUNTARIOS</span>
</div>

<!-- CABECERA -->
<div class="cert-header">
  <div class="cert-top">
    <img src="${IMG_LOGO}" class="cert-logo-center">
    <div class="cert-inst-name">
      <h1>BENEMÉRITO CUERPO DE BOMBEROS VOLUNTARIOS<br>VILLAMARÍA CALDAS</h1>
      <p>NIT. 890.804.607-0</p>
    </div>
    <div class="cert-doc-info">
      <div class="cert-doc-num">DOC: ${docNum}</div>
      <div class="cert-doc-date">Emitido: ${emitted}</div>
    </div>
  </div>
</div>

<!-- CUERPO -->
<div class="cert-body">
  <div class="cert-body-title">REPORTE DE INTERVENCIÓN</div>

  <div class="cert-grid">
    <div class="cert-field">
      <span class="cert-label">Fecha</span>
      <span class="cert-value">${formatDate(data.fecha)}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Hora Reporte</span>
      <span class="cert-value">${data.horaReporte || ''}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Hora Llegada</span>
      <span class="cert-value">${data.horaLlegada || ''}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Hora Final</span>
      <span class="cert-value">${data.horaFinal || ''}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Lugar</span>
      <span class="cert-value">${data.lugar || ''}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Dirección</span>
      <span class="cert-value">${data.direccion || ''}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Coordenadas GPS</span>
      <span class="cert-value">${coords}</span>
    </div>
    <div class="cert-field">
      <span class="cert-label">Evento</span>
      <span class="cert-value">${data.evento || ''}</span>
    </div>
  </div>

  <div class="cert-field full">
    <div class="cert-label">Descripción del incidente</div>
    <div class="cert-desc-box">${data.descripcion || ''}</div>
  </div>

  <div class="cert-victims-bar">
    <div class="cert-victim-box">
      <div class="cert-victim-num">${data.lesionados || 0}</div>
      <div class="cert-victim-label">Lesionados</div>
    </div>
    <div class="cert-victim-box">
      <div class="cert-victim-num">${data.victimas || 0}</div>
      <div class="cert-victim-label">Víctimas fatales</div>
    </div>
  </div>

  ${data.novedades ? `
  <div class="cert-field full">
    <div class="cert-label">Novedades</div>
    <div class="cert-desc-box">${data.novedades}</div>
  </div>
  ` : ''}

  ${data.afectados?.length ? `
  <div class="cert-affected-section">
    <h2>Personas Afectadas</h2>
    ${data.afectados.map(a => `
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
    `).join('')}
  </div>
  ` : ''}

  ${data.photos?.length ? `
  <div class="cert-photo-section">
    <div class="cert-photo-title">Evidencia Fotográfica</div>
    <div class="cert-photo-grid">
      ${data.photos.map(photo => `
        <div class="cert-photo-card"><img src="${photo}"></div>
      `).join('')}
    </div>
  </div>
  ` : ''}

</div>

<!-- FIRMAS -->
<div class="cert-footer">
  <div class="cert-footer-left">
    <div class="cert-signature">
      <div class="cert-signature-img-wrap">
        <img src="${IMG_FIRMA}" class="cert-firma-img">
      </div>
      <div class="cert-signature-line"></div>
      <div class="cert-signature-role">Comandante de Unidad</div>
    </div>
    <div class="cert-signature">
      <div class="cert-signature-img-wrap">
        ${data.firmasBomberos?.length && data.firmasBomberos[0]?.firma
          ? `<img src="${data.firmasBomberos[0].firma}" class="cert-firma-bombero">`
          : ''}
      </div>
      <div class="cert-signature-line"></div>
      <div class="cert-signature-role">${data.firmasBomberos?.[0]?.nombre || 'Oficial de Turno'}</div>
    </div>
  </div>

  <div class="cert-footer-right">
    <img src="${generateQRCode(docNum)}" class="cert-qr-img">
    <div class="cert-qr-text">Verificación Digital<br>${docNum}</div>
  </div>
</div>

<div class="cert-contact-footer">
  Calle 19 N.° 9-52 • Villamaría, Caldas • Tel: (606) 8740000 • bomberosvvm@gmail.com • NIT. 890.804.607-0
</div>

</div>
</div>

`;
}

export function renderCertificate(data, id = null) {

  const certHTML = buildCertificateHTML(data);

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

// Cerrar con click fuera del modal o con Escape. Se registra una sola
// vez al evaluarse este módulo — funciona igual sin importar si quien
// lo cargó fue app.js (import() dinámico) o gestor.js (import estático),
// porque cada página tiene su propia instancia del módulo.
const _certModalEl = document.getElementById('certModal');

if (_certModalEl) {
  _certModalEl.addEventListener('click', (e) => {
    if (e.target === _certModalEl) closeModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
