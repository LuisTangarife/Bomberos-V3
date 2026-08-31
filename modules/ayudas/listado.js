/* ========================================================================
   LISTADO.JS
   Módulo Ayudas Humanitarias — Tarjetas del listado (vista principal)
======================================================================== */

import { state } from "./estado.js";
import { UI } from "./dom.js";
import { cargarFormularioAyuda, nuevoFormularioAyuda, normalizarKits } from "./app.js";
import { eliminarAyuda } from "./persistencia.js";
import { generarPDFAyuda } from "./pdf.js";

const ICONOS_KIT = {
    "Kit Alimentario": "fa-solid fa-basket-shopping",
    "Kit Aseo": "fa-solid fa-pump-soap",
    "Kit Cocina": "fa-solid fa-utensils",
    "Kit Noche": "fa-solid fa-bed",
    "Kit Mascota": "fa-solid fa-paw"
};

function escapar(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

export function renderizarListado() {

    if (!UI.listadoContainer) return;

    if (state.estado.cargando) {
        UI.listadoContainer.innerHTML = `<p class="ayuda-vacio">Cargando entregas...</p>`;
        return;
    }

    const ayudas = state.ayudas;

    if (!ayudas.length) {
        UI.listadoContainer.innerHTML = `
            <p class="ayuda-vacio">
                Aún no hay entregas registradas${state.invitado ? " en este dispositivo" : ""}.
            </p>
        `;
        return;
    }

    UI.listadoContainer.innerHTML = ayudas.map(ayuda => {

        const kits = normalizarKits(ayuda);
        const totalKits = kits.reduce((total, k) => total + k.cantidad, 0);
        const beneficiario = ayuda.beneficiarioNombre || "Sin nombre";
        const lugar = ayuda.direccionSector || ayuda.lugar || "Sin ubicación";

        const badgesKits = kits.length
            ? kits.map(k => {
                const icono = ICONOS_KIT[k.tipo] || "fa-solid fa-box-open";
                return `<span class="ayuda-kit-badge"><i class="${icono}"></i> ${escapar(k.tipo)} × ${k.cantidad}</span>`;
            }).join("")
            : `<span class="ayuda-kit-badge"><i class="fa-solid fa-box-open"></i> Sin tipo</span>`;

        return `
            <article class="ayuda-card" data-id="${escapar(ayuda.id)}">

                <div class="ayuda-card-top">
                    <span class="ayuda-codigo">${escapar(ayuda.id)}</span>
                    ${ayuda.pending ? '<span class="ayuda-badge pendiente">Pendiente sync</span>' : ""}
                </div>

                <div class="ayuda-kits-lista">${badgesKits}</div>

                <h3>${escapar(beneficiario)}</h3>
                <p class="ayuda-sub"><i class="fa-solid fa-location-dot"></i> ${escapar(lugar)}</p>
                <p class="ayuda-sub"><i class="fa-solid fa-boxes-stacked"></i> ${totalKits} kit(s) entregado(s) en total</p>

                <div class="ayuda-card-actions">
                    <button type="button" class="btn-editar-ayuda" data-id="${escapar(ayuda.id)}">
                        <i class="fa-solid fa-pen"></i> Ver / Editar
                    </button>
                    <button type="button" class="btn-pdf-ayuda" data-id="${escapar(ayuda.id)}">
                        <i class="fa-solid fa-file-pdf"></i> Certificado
                    </button>
                    <button type="button" class="btn-borrar-ayuda" data-id="${escapar(ayuda.id)}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

            </article>
        `;

    }).join("");

    UI.listadoContainer.querySelectorAll(".btn-editar-ayuda").forEach(btn => {
        btn.addEventListener("click", () => cargarFormularioAyuda(btn.dataset.id));
    });

    UI.listadoContainer.querySelectorAll(".btn-pdf-ayuda").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const ayuda = state.ayudas.find(a => a.id === btn.dataset.id);
            generarPDFAyuda(ayuda);
        });
    });

    UI.listadoContainer.querySelectorAll(".btn-borrar-ayuda").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta entrega? Esta acción no se puede deshacer.")) return;
            await eliminarAyuda(btn.dataset.id);
        });
    });

}

export function filtrarListado(texto) {

    const t = (texto || "").trim().toLowerCase();

    if (!t) return renderizarListado();

    const filtradas = state.ayudas.filter(a =>
        (a.beneficiarioNombre || "").toLowerCase().includes(t) ||
        (a.beneficiarioCedula || "").toLowerCase().includes(t) ||
        (a.direccionSector || "").toLowerCase().includes(t) ||
        (a.tipoKit || "").toLowerCase().includes(t) ||
        (a.id || "").toLowerCase().includes(t)
    );

    const original = state.ayudas;
    state.ayudas = filtradas;
    renderizarListado();
    state.ayudas = original;

}
