/*==========================================================
 APP BOMBEROS · CENTRO DE OPERACIONES
 SIDEBAR COMPONENT — consola de navegación
==========================================================*/

// sidebar.js se incluye desde páginas en distinto nivel de carpetas
// (index.html en la raíz, modules/inspecciones/index.html dos niveles
// abajo). Los enlaces del menú deben apuntar SIEMPRE al index.html
// principal (raíz), sin importar desde qué página se esté viendo el
// sidebar. Por eso calculamos la raíz a partir de la URL de este mismo
// script en vez de usar rutas relativas fijas como "index.html", que
// resolvían distinto según la página que las incluyera.
/*==========================================================
 RUTA BASE DE LA APLICACIÓN
 Funciona tanto en:
 - GitHub Pages
 - Localhost
 - Otros servidores
==========================================================*/

const BASE_PATH = window.location.pathname.includes("/Bomberos-V3/")
    ? "/Bomberos-V3/"
    : "/";

const RAIZ_SITIO = `${window.location.origin}${BASE_PATH}`;

// Enlaces que llevan a datos de TODOS los dispositivos/usuarios (no
// solo del que está viendo el sidebar): Panel General, Gestor de
// Emergencias consolidado y Reportes y Estadísticas. Se marcan con
// data-restringido para poder ocultarlos cuando quien ve el sidebar
// no tiene sesión (ver parámetro "autenticado" de renderSidebar).
function renderSidebar(active = "", autenticado = true) {

    const container = document.getElementById("sidebar");

    if (!container) return;

    container.className = "sidebar";

    container.innerHTML = `

        <div class="sidebar-header">

            <div class="sidebar-logo">
                <i class="fa-solid fa-fire"></i>
            </div>

            <div>

                <div class="sidebar-title">
                    Bomberos
                </div>

                <div class="sidebar-subtitle">
                    Centro de Operaciones
                </div>

            </div>

        </div>

        <nav>

            <a
                data-restringido="true"
                href="${RAIZ_SITIO}index.html"
                class="${active === "dashboard" ? "active" : ""}">

                <i class="fa-solid fa-gauge-high"></i>

                <span>Panel General</span>

            </a>

            <a
                data-restringido="true"
                href="${RAIZ_SITIO}modules/emergencia/gestor.html"
                class="${active === "emergencia" ? "active" : ""}">

                <i class="fa-solid fa-fire-extinguisher"></i>

                <span>Emergencias</span>

            </a>

            <a
                href="#"
                onclick="abrirAPH(); return false;">

                <i class="fa-solid fa-truck-medical"></i>

                <span>APH</span>

            </a>

            <a
                href="#"
                onclick="abrirAyudas(); return false;">

                <i class="fa-solid fa-box-open"></i>

                <span>Ayudas Humanitarias</span>

            </a>

            <a
                href="${RAIZ_SITIO}modules/inspecciones/index.html"
                class="${active === "inspecciones" ? "active" : ""}">

                <i class="fa-solid fa-building-shield"></i>

                <span>Inspecciones</span>

            </a>

            <a
                href="${RAIZ_SITIO}modules/censos/index.html"
                class="${active === "censos" ? "active" : ""}">

                <i class="fa-solid fa-people-roof"></i>

                <span>Censos</span>

            </a>

            <a
                data-restringido="true"
                href="${RAIZ_SITIO}modules/estadisticas/index.html"
                class="${active === "estadisticas" ? "active" : ""}">

                <i class="fa-solid fa-chart-column"></i>

                <span>Reportes y Estadísticas</span>

            </a>

        </nav>

        <div class="sidebar-footer">

            <div class="status-line">
                <span class="dot"></span>
                Sistema en línea
            </div>

            <div class="meta">
                Estación Villamaría<br>
                Build 2.0
            </div>

        </div>

    `;

    // autenticado = false (invitado sin sesión): se ocultan los
    // enlaces a vistas con datos de todos los usuarios/dispositivos.
    // autenticado = true (default, retrocompatible): páginas que ya
    // exigen login con protegerPagina() no necesitan pasar este
    // parámetro y siguen mostrando el menú completo, como siempre.
    if (!autenticado) {
        container
            .querySelectorAll('[data-restringido="true"]')
            .forEach(enlace => enlace.remove());
    }

}

// Funciones "Próximamente" para las secciones sin desarrollar todavía.
// Se definen aquí (no en dashboard.js) para que el sidebar funcione
// igual sin importar en qué página/módulo se esté renderizando.
if (typeof window.abrirAPH !== "function") {
    window.abrirAPH = function () {
        alert("Próximamente");
    };
}

if (typeof window.abrirAyudas !== "function") {
    window.abrirAyudas = function () {
        alert("Próximamente");
    };
}
