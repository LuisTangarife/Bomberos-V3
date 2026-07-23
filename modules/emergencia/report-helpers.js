/* ========================================================================
   REPORT-HELPERS.JS
   Funciones de formateo de datos de una emergencia, compartidas entre
   certificados.js (vista HTML / impresión) y docx-engine.js (generación
   del Word real desde plantilla1.docx). Antes estaban duplicadas dentro
   de certificados.js; se extraen aquí para que ambos generadores usen
   exactamente la misma lógica y no se desincronicen con el tiempo.
======================================================================== */

export function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${day} ${months[parseInt(m) - 1]} ${y}`;
}

export function calcularCoordenadas(data) {
  return data.latitud && data.longitud
    ? `${data.latitud}, ${data.longitud}`
    : 'No disponibles';
}

export function personalTexto(personal) {
  return Array.isArray(personal) && personal.length
    ? personal.join(', ')
    : 'No reportado';
}

export function vehiculosTexto(vehiculos) {
  return Array.isArray(vehiculos) && vehiculos.length
    ? vehiculos.map(v => v.vehiculo).filter(Boolean).join(', ')
    : 'No reportados';
}

// Mismo formato que afectadosTexto en el Apps Script — una línea por
// afectado, unida con salto de línea (el CSS de la plantilla HTML usa
// white-space:pre-line en .reporte-descripcion-texto, pero el destino
// ahí es un <p> normal, así que esa vista une con <br> en vez de \n).
export function renderAfectadosTexto(afectados) {
  if (!afectados?.length) return 'Ninguno reportado';
  return afectados
    .map(a => `${a.nombre || ''} | DNI: ${a.dni || ''} | Edad: ${a.edad || ''} | Género: ${a.genero || ''} | Tel: ${a.telefono || ''}`)
    .join('<br>');
}

// Genera un identificador de reporte consistente para usarlo tanto en
// la vista HTML como en el documento Word del mismo reporte.
export function generarDocNum() {
  return `CB-${Date.now()}`;
}
