/*==========================================================
 APP BOMBEROS · CENTRO DE OPERACIONES
 HEADER COMPONENT — barra de estado
==========================================================*/

function renderHeader(title = "Panel General") {

    const container = document.getElementById("header");

    if (!container) return;

    container.innerHTML = `

        <header class="main-header">

            <div class="header-left">

                <button
                    class="menu-btn"
                    onclick="toggleSidebar()">

                    <i class="fa-solid fa-bars"></i>

                </button>

                <div>

                    <h2>${title}</h2>

                    <small>Sistema en línea</small>

                </div>

            </div>

            <div class="header-right">

                <button
                    id="btnInstalarApp"
                    class="btn-instalar-app"
                    type="button"
                    hidden>

                    <i class="fa-solid fa-download"></i>
                    Instalar app

                </button>

                <div id="clock"></div>

                <button
                    id="btnCerrarSesion"
                    class="btn-cerrar-sesion"
                    type="button"
                    title="Cerrar sesión"
                    onclick="typeof cerrarSesionApp === 'function' && cerrarSesionApp()">

                    <i class="fa-solid fa-arrow-right-from-bracket"></i>

                </button>

                <div class="header-avatar">

                    <i class="fa-solid fa-user"></i>

                </div>

            </div>

        </header>

    `;

    actualizarHora();

    if (typeof window.actualizarBotonInstalarSiCorresponde === "function") {
        window.actualizarBotonInstalarSiCorresponde();
    }

}
