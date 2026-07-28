/* ========================================================================
   APP.JS — Módulo Estadísticas
   Orquesta: carga de datos reales (datos.js) → agregaciones → render
   (Chart.js para gráficas, Leaflet para el mapa).
======================================================================== */

import { protegerPagina } from "../../shared/auth.js";
import {
    cargarDatos,
    serieMensual,
    proyeccionLineal,
    analizarEmergencias,
    analizarInspecciones,
    indiceRiesgoPorBarrio
} from "./datos.js";

const COLORES = {
    primary: '#FF3B30', secondary: '#FF6A00', amber: '#FFB300',
    blue: '#2F81F7', green: '#00C874', violet: '#8B5CF6', cyan: '#22D3EE',
    textLight: '#8A93A8'
};

const PALETA = [COLORES.primary, COLORES.blue, COLORES.green, COLORES.amber, COLORES.violet, COLORES.cyan, COLORES.secondary, '#EC4899', '#64748B', '#F59E0B'];

// Instancias de Chart.js activas, para poder destruirlas antes de
// volver a dibujar (evita el memory-leak/"canvas ya en uso" clásico
// de Chart.js si el módulo se recarga sin refrescar la página).
const graficas = {};

function dibujar(idCanvas, config) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return null;
    if (graficas[idCanvas]) graficas[idCanvas].destroy();
    graficas[idCanvas] = new window.Chart(canvas, config);
    return graficas[idCanvas];
}

// Cuando no hay datos suficientes para una gráfica puntual, se
// reemplaza el <canvas> por un mensaje — un Chart.js vacío se ve como
// un error visual, no como "sin datos".
function marcarVacio(idCanvas, mensaje) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    const contenedor = canvas.closest('.lienzo');
    if (contenedor) {
        contenedor.outerHTML = `<div class="vacio">${mensaje}</div>`;
    }
}

const OPCIONES_BASE = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: COLORES.textLight, boxWidth: 12, font: { size: 11 } } },
        tooltip: { padding: 10 }
    },
    scales: {
        x: { ticks: { color: COLORES.textLight }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: COLORES.textLight }, grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }
    }
};

/* =========================================================
   ARRANQUE
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    await protegerPagina();

    renderSidebar("estadisticas");
    renderHeader("Reportes y Estadísticas");

    const { emergencias, inspecciones, errores } = await cargarDatos();

    mostrarAvisoFuente(emergencias, inspecciones, errores);

    const anE = analizarEmergencias(emergencias);
    const anI = analizarInspecciones(inspecciones);
    const serieEmergencias = serieMensual(emergencias, 'fecha');
    const serieInspecciones = serieMensual(inspecciones, 'fecha');
    const proyeccion = proyeccionLineal(serieEmergencias, 3);
    const riesgoBarrios = indiceRiesgoPorBarrio(inspecciones);

    renderVistaGeneral(anE, anI, serieEmergencias, serieInspecciones);
    renderVistaEmergencias(anE);
    renderVistaInspecciones(anI, riesgoBarrios);
    renderVistaPredictivo(serieEmergencias, proyeccion);

});

function mostrarAvisoFuente(emergencias, inspecciones, errores) {

    const aviso = document.getElementById('avisoFuente');
    const texto = document.getElementById('avisoFuenteTexto');

    if (errores.emergencias || errores.inspecciones) {
        aviso.classList.add('alerta');
        texto.textContent =
            'No se pudieron cargar todos los datos (revisa la conexión o los permisos de Firestore). ' +
            'Lo que se muestra abajo es parcial.';
        return;
    }

    if (!emergencias.length && !inspecciones.length) {
        aviso.classList.add('alerta');
        texto.textContent =
            'Todavía no hay reportes guardados en "emergencias" ni en "inspecciones" — en cuanto se registre ' +
            'el primero, esta pantalla se llena sola.';
        return;
    }

    texto.textContent =
        `${emergencias.length} emergencia(s) y ${inspecciones.length} inspección(es) reales, ` +
        `tomadas en vivo de Firestore.`;

}

/* =========================================================
   NAVEGACIÓN ENTRE PESTAÑAS
========================================================= */

window.cambiarVista = function (vista) {

    document.querySelectorAll('.vista').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.tabs-modulo button').forEach(b => b.classList.remove('activo'));

    document.getElementById(`vista${vista.charAt(0).toUpperCase()}${vista.slice(1)}`).style.display = '';
    document.querySelector(`.tabs-modulo button[data-vista="${vista}"]`)?.classList.add('activo');

    // Los mapas de Leaflet no calculan bien su tamaño si se crean
    // dentro de un contenedor que estaba en display:none — se corrige
    // al volver a la pestaña "General", donde vive el mapa.
    if (vista === 'general' && window._mapaEstadisticas) {
        setTimeout(() => window._mapaEstadisticas.invalidateSize(), 50);
    }

};

/* =========================================================
   KPI (tarjetas)
========================================================= */

function renderKPI(idContenedor, items) {

    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    contenedor.innerHTML = items.map(({ clase, icono, etiqueta, valor, nota }) => `
        <article class="stat-card ${clase}">
            <div class="stat-icon"><i class="fa-solid ${icono}"></i></div>
            <div>
                <small>${etiqueta}</small>
                <h2>${valor}</h2>
                <span>${nota}</span>
            </div>
        </article>
    `).join('');

}

/* =========================================================
   VISTA GENERAL
========================================================= */

function renderVistaGeneral(anE, anI, serieEmergencias, serieInspecciones) {

    renderKPI('kpiGeneral', [
        { clase: 'emergency', icono: 'fa-fire-extinguisher', etiqueta: 'Emergencias', valor: anE.total, nota: 'Total histórico' },
        { clase: 'inspection', icono: 'fa-building-shield', etiqueta: 'Inspecciones', valor: anI.total, nota: 'Total histórico' },
        { clase: 'help', icono: 'fa-user-injured', etiqueta: 'Víctimas + lesionados', valor: anE.totalVictimas + anE.totalLesionados, nota: `${anE.conVictimas} emergencia(s) con personas afectadas` },
        { clase: 'census', icono: 'fa-percent', etiqueta: 'Cumplimiento inspecciones', valor: anI.tasaCumplimiento !== null ? anI.tasaCumplimiento + '%' : '—', nota: 'No "No cumple" / total' }
    ]);

    // Serie combinada: emergencias e inspecciones no comparten
    // necesariamente los mismos meses, así que se unifica el eje X
    // sobre la unión de ambas series antes de graficar.
    const claves = [...new Set([...serieEmergencias.map(p => p.clave), ...serieInspecciones.map(p => p.clave)])].sort();

    if (!claves.length) {
        marcarVacio('chartSerieMensual', 'Todavía no hay reportes con fecha para graficar.');
    } else {
        const mapaE = new Map(serieEmergencias.map(p => [p.clave, p.total]));
        const mapaI = new Map(serieInspecciones.map(p => [p.clave, p.total]));
        const etiquetas = claves.map(c => {
            const [a, m] = c.split('-');
            return `${m}/${a.slice(2)}`;
        });

        dibujar('chartSerieMensual', {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [
                    {
                        label: 'Emergencias', data: claves.map(c => mapaE.get(c) || 0),
                        borderColor: COLORES.primary, backgroundColor: 'rgba(255,59,48,.15)',
                        tension: .3, fill: true, pointRadius: 3
                    },
                    {
                        label: 'Inspecciones', data: claves.map(c => mapaI.get(c) || 0),
                        borderColor: COLORES.green, backgroundColor: 'rgba(0,200,116,.12)',
                        tension: .3, fill: true, pointRadius: 3
                    }
                ]
            },
            options: OPCIONES_BASE
        });
    }

    renderMapaGeneral(anE.ubicaciones);

    const subtitulo = document.getElementById('subtituloMapa');
    subtitulo.textContent = anE.ubicaciones.length
        ? `${anE.ubicaciones.length} de ${anE.total} emergencia(s) tienen coordenadas registradas`
        : 'Ninguna emergencia registrada tiene coordenadas GPS todavía';

    renderCobertura(anE.cobertura);

}

function renderMapaGeneral(ubicaciones) {

    const contenedor = document.getElementById('mapaEmergencias');
    if (!contenedor) return;

    if (!ubicaciones.length) {
        contenedor.outerHTML = '<div class="vacio">Sin coordenadas registradas todavía — el mapa aparece en cuanto una emergencia se guarde con GPS.</div>';
        return;
    }

    const mapa = window._mapaEstadisticas || L.map('mapaEmergencias');
    window._mapaEstadisticas = mapa;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(mapa);

    const grupo = L.featureGroup();

    ubicaciones.forEach(u => {
        L.circleMarker([u.lat, u.lng], {
            radius: 7,
            color: COLORES.primary,
            fillColor: COLORES.primary,
            fillOpacity: .55,
            weight: 1
        })
            .bindPopup(`<strong>${u.evento}</strong><br>${u.lugar || 'Sin lugar registrado'}<br>${u.fecha || ''}`)
            .addTo(grupo);
    });

    grupo.addTo(mapa);
    mapa.fitBounds(grupo.getBounds(), { padding: [30, 30], maxZoom: 15 });

    setTimeout(() => mapa.invalidateSize(), 80);

}

function renderCobertura({ afectadosTotal, afectadosConFirma, porcentajeAfectados, emergenciasConBombero, emergenciasConFirmaBombero, porcentajeBomberos }) {

    if (!afectadosTotal && !emergenciasConBombero) {
        marcarVacio('chartCobertura', 'Aún no hay afectados ni personal registrado para medir cobertura de firmas.');
        return;
    }

    dibujar('chartCobertura', {
        type: 'bar',
        data: {
            labels: ['Afectados con firma', 'Emergencias con firma de comandante'],
            datasets: [{
                data: [porcentajeAfectados ?? 0, porcentajeBomberos ?? 0],
                backgroundColor: [COLORES.blue, COLORES.violet],
                borderRadius: 8
            }]
        },
        options: {
            ...OPCIONES_BASE,
            indexAxis: 'y',
            plugins: {
                ...OPCIONES_BASE.plugins,
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.label === 'Afectados con firma'
                            ? `${afectadosConFirma} de ${afectadosTotal} afectados (${porcentajeAfectados}%)`
                            : `${emergenciasConFirmaBombero} de ${emergenciasConBombero} emergencias (${porcentajeBomberos}%)`
                    }
                }
            },
            scales: { x: { ...OPCIONES_BASE.scales.x, max: 100 }, y: OPCIONES_BASE.scales.y }
        }
    });

}

/* =========================================================
   VISTA EMERGENCIAS
========================================================= */

function renderVistaEmergencias(anE) {

    renderKPI('kpiEmergencias', [
        { clase: 'emergency', icono: 'fa-list', etiqueta: 'Total registradas', valor: anE.total, nota: 'Histórico completo' },
        { clase: 'aph', icono: 'fa-stopwatch', etiqueta: 'Duración promedio', valor: anE.duracionPromedio !== null ? `${anE.duracionPromedio} min` : '—', nota: 'Llegada → cierre del servicio' },
        { clase: 'help', icono: 'fa-user-injured', etiqueta: 'Víctimas totales', valor: anE.totalVictimas, nota: `en ${anE.conVictimas} emergencia(s)` },
        { clase: 'census', icono: 'fa-truck', etiqueta: 'Vehículo más usado', valor: anE.rankingVehiculos[0]?.clave || '—', nota: anE.rankingVehiculos[0] ? `${anE.rankingVehiculos[0].total} salida(s)` : 'Sin datos' }
    ]);

    if (!anE.total) {
        ['chartCategoria', 'chartTopEvento', 'chartDiaSemana', 'chartHora'].forEach(id =>
            marcarVacio(id, 'Sin emergencias registradas todavía.'));
        document.getElementById('tablaPersonal').innerHTML = '<div class="vacio">Sin datos</div>';
        document.getElementById('tablaVehiculos').innerHTML = '<div class="vacio">Sin datos</div>';
        return;
    }

    // Categoría de evento (dona)
    if (anE.porCategoria.length) {
        dibujar('chartCategoria', {
            type: 'doughnut',
            data: {
                labels: anE.porCategoria.map(p => p.clave),
                datasets: [{ data: anE.porCategoria.map(p => p.total), backgroundColor: PALETA, borderWidth: 0 }]
            },
            options: { ...OPCIONES_BASE, scales: undefined, cutout: '62%' }
        });
    } else {
        marcarVacio('chartCategoria', 'Ninguna emergencia tiene tipo de evento registrado.');
    }

    // Top 10 eventos específicos (barra horizontal)
    if (anE.porEvento.length) {
        dibujar('chartTopEvento', {
            type: 'bar',
            data: {
                labels: anE.porEvento.map(p => p.clave),
                datasets: [{ data: anE.porEvento.map(p => p.total), backgroundColor: COLORES.primary, borderRadius: 6 }]
            },
            options: { ...OPCIONES_BASE, indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    } else {
        marcarVacio('chartTopEvento', 'Sin datos.');
    }

    // Día de la semana
    dibujar('chartDiaSemana', {
        type: 'bar',
        data: {
            labels: anE.porDiaSemana.map(p => p.clave.slice(0, 3)),
            datasets: [{ data: anE.porDiaSemana.map(p => p.total), backgroundColor: COLORES.blue, borderRadius: 6 }]
        },
        options: { ...OPCIONES_BASE, plugins: { legend: { display: false } } }
    });

    // Hora del día
    dibujar('chartHora', {
        type: 'bar',
        data: {
            labels: anE.porHora.map(p => p.clave),
            datasets: [{ data: anE.porHora.map(p => p.total), backgroundColor: COLORES.amber, borderRadius: 4 }]
        },
        options: {
            ...OPCIONES_BASE,
            plugins: { legend: { display: false } },
            scales: { ...OPCIONES_BASE.scales, x: { ...OPCIONES_BASE.scales.x, ticks: { color: COLORES.textLight, maxRotation: 0, autoSkip: true } } }
        }
    });

    renderTablaRanking('tablaPersonal', anE.rankingPersonal, 'Bombero');
    renderTablaRanking('tablaVehiculos', anE.rankingVehiculos, 'Vehículo');

}

function renderTablaRanking(idContenedor, items, etiquetaColumna) {

    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    if (!items.length) {
        contenedor.innerHTML = '<div class="vacio">Sin datos suficientes.</div>';
        return;
    }

    const max = Math.max(...items.map(i => i.total));

    contenedor.innerHTML = `
        <table class="tabla-ranking">
            <thead><tr><th>${etiquetaColumna}</th><th>Intervenciones</th><th></th></tr></thead>
            <tbody>
                ${items.map(i => `
                    <tr>
                        <td>${i.clave}</td>
                        <td>${i.total}</td>
                        <td style="width:40%">
                            <div class="barra-mini" style="width:${Math.max(6, (i.total / max) * 100)}%"></div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

}

/* =========================================================
   VISTA INSPECCIONES
========================================================= */

function renderVistaInspecciones(anI, riesgoBarrios) {

    renderKPI('kpiInspecciones', [
        { clase: 'inspection', icono: 'fa-list', etiqueta: 'Total inspecciones', valor: anI.total, nota: 'Histórico completo' },
        { clase: 'census', icono: 'fa-check', etiqueta: 'Cumplimiento', valor: anI.tasaCumplimiento !== null ? anI.tasaCumplimiento + '%' : '—', nota: 'No "No cumple" / total' },
        { clase: 'help', icono: 'fa-fire-extinguisher', etiqueta: 'Extintores deficientes', valor: anI.extintores.porcentajeDeficiente !== null ? anI.extintores.porcentajeDeficiente + '%' : '—', nota: `${anI.extintores.deficientes} de ${anI.extintores.revisados} revisados` },
        { clase: 'aph', icono: 'fa-calendar-xmark', etiqueta: 'Reinspecciones vencidas', valor: anI.reinspeccionesVencidas, nota: 'Estimado por fecha' }
    ]);

    if (!anI.total) {
        ['chartResultado', 'chartHallazgos', 'chartExtintores'].forEach(id =>
            marcarVacio(id, 'Sin inspecciones registradas todavía.'));
        document.getElementById('listaRiesgoBarrio').innerHTML = '<div class="vacio">Sin datos</div>';
        return;
    }

    if (anI.porResultado.length) {
        dibujar('chartResultado', {
            type: 'doughnut',
            data: {
                labels: anI.porResultado.map(p => p.clave),
                datasets: [{
                    data: anI.porResultado.map(p => p.total),
                    backgroundColor: anI.porResultado.map(p =>
                        p.clave === 'No cumple' ? COLORES.primary :
                            p.clave === 'Cumple con observaciones' ? COLORES.amber : COLORES.green
                    ),
                    borderWidth: 0
                }]
            },
            options: { ...OPCIONES_BASE, scales: undefined, cutout: '62%' }
        });
    } else {
        marcarVacio('chartResultado', 'Ninguna inspección tiene resultado registrado.');
    }

    dibujar('chartHallazgos', {
        type: 'bar',
        data: {
            labels: anI.hallazgos.map(h => h.clave),
            datasets: [{ data: anI.hallazgos.map(h => h.porcentaje), backgroundColor: COLORES.secondary, borderRadius: 6 }]
        },
        options: {
            ...OPCIONES_BASE, indexAxis: 'y', plugins: { legend: { display: false } },
            scales: { x: { ...OPCIONES_BASE.scales.x, max: 100 }, y: OPCIONES_BASE.scales.y }
        }
    });

    if (anI.extintores.revisados) {
        dibujar('chartExtintores', {
            type: 'doughnut',
            data: {
                labels: ['En buen estado', 'Deficientes (regular/malo)'],
                datasets: [{
                    data: [anI.extintores.revisados - anI.extintores.deficientes, anI.extintores.deficientes],
                    backgroundColor: [COLORES.green, COLORES.primary], borderWidth: 0
                }]
            },
            options: { ...OPCIONES_BASE, scales: undefined, cutout: '62%' }
        });
    } else {
        marcarVacio('chartExtintores', 'Ninguna inspección registró estado de extintores.');
    }

    renderRiesgoBarrio(riesgoBarrios);

}

function renderRiesgoBarrio(items) {

    const contenedor = document.getElementById('listaRiesgoBarrio');
    if (!contenedor) return;

    if (!items.length) {
        contenedor.innerHTML = '<div class="vacio">Ninguna inspección tiene barrio registrado.</div>';
        return;
    }

    const max = Math.max(...items.map(i => i.indice), 1);

    contenedor.innerHTML = items.map(i => `
        <div class="riesgo-barrio">
            <div class="nombre">${i.barrio}</div>
            <div class="track"><div class="fill" style="width:${(i.indice / max) * 100}%"></div></div>
            <div class="valor">${i.indice}</div>
        </div>
    `).join('') + `
        <div class="nota-metodologica">
            ${items.map(i => `${i.barrio}: ${i.inspecciones} inspección(es), ${i.noCumple} "No cumple", ${i.hallazgos} hallazgo(s) de riesgo.`).join(' · ')}
        </div>
    `;

}

/* =========================================================
   VISTA PREDICTIVA
========================================================= */

function renderVistaPredictivo(serieEmergencias, proyeccion) {

    const badge = document.getElementById('badgeTendencia');

    if (!proyeccion) {
        marcarVacio('chartProyeccion', 'Se necesitan al menos 4 meses con emergencias registradas para proyectar una tendencia. Por ahora no hay suficiente historia — esto no es una limitación técnica, es que con menos datos cualquier proyección sería inventada.');
        badge.innerHTML = '';
        return;
    }

    const iconoTendencia = proyeccion.tendencia === 'subiendo' ? 'fa-arrow-trend-up'
        : proyeccion.tendencia === 'bajando' ? 'fa-arrow-trend-down' : 'fa-arrows-left-right';

    badge.innerHTML = `
        <span class="proyeccion-badge ${proyeccion.tendencia}">
            <i class="fa-solid ${iconoTendencia}"></i>
            Tendencia ${proyeccion.tendencia} · ajuste de la recta (r²) ${(proyeccion.r2 * 100).toFixed(0)}%
        </span>
    `;

    const etiquetasHist = serieEmergencias.map(p => p.etiqueta);
    const etiquetasProy = proyeccion.proyeccion.map(p => p.etiqueta);
    const todasEtiquetas = [...etiquetasHist, ...etiquetasProy];

    const datosHist = serieEmergencias.map(p => p.total);
    const datosProy = new Array(datosHist.length - 1).fill(null)
        .concat([datosHist[datosHist.length - 1]])
        .concat(proyeccion.proyeccion.map(p => p.total));

    const bandaMin = new Array(datosHist.length).fill(null).concat(proyeccion.proyeccion.map(p => p.min));
    const bandaMax = new Array(datosHist.length).fill(null).concat(proyeccion.proyeccion.map(p => p.max));

    dibujar('chartProyeccion', {
        type: 'line',
        data: {
            labels: todasEtiquetas,
            datasets: [
                {
                    label: 'Histórico real', data: datosHist,
                    borderColor: COLORES.blue, backgroundColor: 'rgba(47,129,247,.15)',
                    tension: .25, fill: true, pointRadius: 3
                },
                {
                    label: 'Proyección (regresión lineal)', data: datosProy,
                    borderColor: COLORES.primary, borderDash: [6, 4],
                    backgroundColor: 'transparent', tension: .25, pointRadius: 3
                },
                {
                    label: 'Banda de incertidumbre (± 1 desv.)', data: bandaMax,
                    borderColor: 'transparent', backgroundColor: 'rgba(255,59,48,.08)',
                    pointRadius: 0, fill: '+1'
                },
                {
                    label: '_min', data: bandaMin,
                    borderColor: 'transparent', backgroundColor: 'transparent',
                    pointRadius: 0, fill: false
                }
            ]
        },
        options: {
            ...OPCIONES_BASE,
            plugins: {
                ...OPCIONES_BASE.plugins,
                legend: {
                    labels: {
                        color: COLORES.textLight, boxWidth: 12, font: { size: 11 },
                        filter: (item) => item.text !== '_min'
                    }
                }
            }
        }
    });

}
