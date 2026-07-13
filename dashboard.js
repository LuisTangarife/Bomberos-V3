/*============================================
 PANEL GENERAL — CENTRO DE OPERACIONES
=============================================*/

import { protegerPagina } from "./shared/auth.js";

document.addEventListener("DOMContentLoaded", async () => {

    await protegerPagina();

    renderSidebar("dashboard");

    renderHeader("Panel General");

    iniciarSistema();

    cargarDashboard();

});

/*=============================================
 CARGAR DATOS
=============================================*/

function cargarDashboard(){

    // Temporal: mientras se conecta la fuente de datos real,
    // se anima hacia los valores ya presentes en el HTML.
    animarContadores();

}

/*=============================================
 ANIMACIÓN DE CONTADORES (efecto de telemetría)
=============================================*/

function animarContadores(){

    const contadores = document.querySelectorAll(".stat-card h2[id]");

    contadores.forEach((el) => {

        const destino = parseInt(el.textContent, 10);

        if (isNaN(destino)) return;

        const duracion = 900;
        const inicio = performance.now();

        function paso(ahora){
            const progreso = Math.min((ahora - inicio) / duracion, 1);
            const valor = Math.round(destino * progreso);
            el.textContent = valor;
            if (progreso < 1) requestAnimationFrame(paso);
        }

        el.textContent = "0";
        requestAnimationFrame(paso);

    });

}

/*=============================================
 NAVEGACIÓN
=============================================*/

function abrirEmergencias() {
    location.href = "modules/emergencia/index.html";
}

function abrirAPH(){

    alert("Próximamente");

}

function abrirAyudas(){

    alert("Próximamente");

}

function abrirInspecciones(){

    location.href = "modules/inspecciones/index.html";

}

function abrirEstadisticas(){

    alert("Próximamente");

}
