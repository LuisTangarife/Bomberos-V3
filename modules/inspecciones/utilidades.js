/* ========================================================================
   UTILIDADES.JS
   Sistema de Inspecciones — Utilidades genéricas de interfaz
======================================================================== */

export function confirmar(mensaje) {
    return window.confirm(mensaje);
}

/* ------------------------------------------------------------------------
   NOTIFICACIONES TIPO TOAST
------------------------------------------------------------------------ */

let toastTimer = null;

export function mostrarToast(mensaje, tipo = "success") {

    let toast = document.getElementById("appToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        document.body.appendChild(toast);
    }

    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <i class="fa-solid ${tipo === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i>
        <span>${mensaje}</span>
    `;

    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);

}

/* ------------------------------------------------------------------------
   BOTÓN "VOLVER ARRIBA"
------------------------------------------------------------------------ */

export function inicializarScrollTop() {

    const boton = document.getElementById("scrollTop");
    if (!boton) return;

    window.addEventListener("scroll", actualizarScrollTop);
    boton.addEventListener("click", scrollAlInicio);

}

function actualizarScrollTop() {

    const boton = document.getElementById("scrollTop");
    if (!boton) return;

    boton.classList.toggle("visible", window.scrollY > 250);

}

function scrollAlInicio() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}
