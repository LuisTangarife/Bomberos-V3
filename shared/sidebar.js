/*==========================================================
 APP BOMBEROS · CENTRO DE OPERACIONES
 SIDEBAR COMPONENT — consola de navegación
==========================================================*/

function renderSidebar(active = "") {

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
                href="index.html"
                class="${active === "dashboard" ? "active" : ""}">

                <i class="fa-solid fa-gauge-high"></i>

                <span>Panel General</span>

            </a>

            <a
                href="modules/emergencia/index.html"
                class="${active === "emergencia" ? "active" : ""}">

                <i class="fa-solid fa-fire-extinguisher"></i>

                <span>Emergencias</span>

            </a>

            <a
                href="#"
                onclick="abrirAPH()">

                <i class="fa-solid fa-truck-medical"></i>

                <span>APH</span>

            </a>

            <a
                href="#"
                onclick="abrirAyudas()">

                <i class="fa-solid fa-box-open"></i>

                <span>Ayudas Humanitarias</span>

            </a>

            <a
                href="#"
                onclick="abrirInspecciones()"
                class="${active === "inspecciones" ? "active" : ""}">

                <i class="fa-solid fa-building-shield"></i>

                <span>Inspecciones</span>

            </a>

            <a
                href="#"
                onclick="abrirEstadisticas()">

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

}
