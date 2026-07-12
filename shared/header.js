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
