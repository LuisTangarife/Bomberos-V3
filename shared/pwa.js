/*==========================================================
 APP BOMBEROS
 PWA.JS — Registro del Service Worker + botón "Instalar app"
==========================================================*/

let eventoInstalacionDiferido = null;

// document.currentScript solo es válido mientras este script se ejecuta
// de forma síncrona; hay que guardarlo ya, no dentro del callback de 'load'.
const URL_ESTE_SCRIPT = document.currentScript?.src
    || new URL('pwa.js', document.baseURI).href;

/* ----------------------------------------------------------
   1) REGISTRO DEL SERVICE WORKER

   pwa.js se incluye desde páginas en distintos niveles
   (index.html en la raíz, modules/inspecciones/index.html
   dos niveles abajo). En vez de asumir una ruta relativa fija,
   calculamos la ubicación real de sw.js a partir de la URL de
   este mismo script: sw.js siempre vive un nivel arriba de
   /shared/, es decir, en la raíz del proyecto.
---------------------------------------------------------- */

if ('serviceWorker' in navigator) {

    window.addEventListener('load', () => {

        const raizProyecto = new URL('../', URL_ESTE_SCRIPT);
        const urlSW = new URL('sw.js', raizProyecto).href;

        navigator.serviceWorker.register(urlSW)
            .then(registro => {

                // Si ya hay un SW nuevo esperando (descargado en una
                // visita anterior), avisamos para poder actualizar.
                if (registro.waiting) {
                    notificarActualizacionDisponible(registro);
                }

                registro.addEventListener('updatefound', () => {

                    const nuevoSW = registro.installing;
                    if (!nuevoSW) return;

                    nuevoSW.addEventListener('statechange', () => {
                        if (nuevoSW.state === 'installed' && navigator.serviceWorker.controller) {
                            notificarActualizacionDisponible(registro);
                        }
                    });

                });

            })
            .catch(error => {
                console.error('[PWA] No se pudo registrar el Service Worker:', error);
            });

        // Cuando el nuevo SW toma el control, recargamos una sola vez
        // para servir los archivos actualizados.
        let recargando = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (recargando) return;
            recargando = true;
            window.location.reload();
        });

    });

}

function notificarActualizacionDisponible(registro) {

    mostrarBannerPWA(
        'Hay una actualización disponible.',
        'Actualizar',
        () => registro.waiting?.postMessage('SKIP_WAITING')
    );

}

/* ----------------------------------------------------------
   2) BOTÓN "INSTALAR APP"

   Chrome/Android disparan 'beforeinstallprompt' cuando la app
   cumple los criterios de instalación (manifest + SW + HTTPS).
   Guardamos ese evento para poder mostrarlo cuando el usuario
   toque nuestro propio botón, en vez del mini-infobar del navegador.
---------------------------------------------------------- */

window.addEventListener('beforeinstallprompt', evento => {

    evento.preventDefault();
    eventoInstalacionDiferido = evento;

    mostrarBotonInstalar();

});

window.addEventListener('appinstalled', () => {

    eventoInstalacionDiferido = null;
    ocultarBotonInstalar();

    mostrarBannerPWA('App instalada correctamente.');

});

/* ----------------------------------------------------------
   3) BANNER PROPIO (independiente del sistema de toasts)

   pwa.js se carga tanto en el dashboard raíz (sin sistema de
   notificaciones) como dentro de inspecciones (que sí tiene
   mostrarToast, pero como export de módulo, no global). Para no
   depender de eso, este banner trae sus propios estilos.
---------------------------------------------------------- */

function mostrarBannerPWA(mensaje, textoBoton, accion) {

    document.getElementById('bannerPWA')?.remove();

    const banner = document.createElement('div');
    banner.id = 'bannerPWA';
    banner.className = 'banner-pwa';

    banner.innerHTML = `
        <span class="banner-pwa__texto">${mensaje}</span>
        ${textoBoton ? `<button class="banner-pwa__boton" type="button">${textoBoton}</button>` : ''}
        <button class="banner-pwa__cerrar" type="button" aria-label="Cerrar">&times;</button>
    `;

    document.body.appendChild(banner);

    if (textoBoton && accion) {
        banner.querySelector('.banner-pwa__boton').addEventListener('click', () => {
            accion();
            banner.remove();
        });
    }

    banner.querySelector('.banner-pwa__cerrar').addEventListener('click', () => banner.remove());

    // Auto-cierre si es solo informativo (sin acción pendiente).
    if (!textoBoton) setTimeout(() => banner.remove(), 6000);

}

function estaCorriendoInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true; // Safari iOS
}

function mostrarBotonInstalar() {

    if (estaCorriendoInstalada()) return;

    const boton = document.getElementById('btnInstalarApp');
    if (boton) boton.hidden = false;

}

function ocultarBotonInstalar() {

    const boton = document.getElementById('btnInstalarApp');
    if (boton) boton.hidden = true;

}

// El header se renderiza dinámicamente (ver shared/header.js), así que
// puede aparecer en el DOM después de que 'beforeinstallprompt' ya se
// haya disparado. header.js llama a esta función cada vez que dibuja
// el botón, para reflejar el estado real en ese momento.
window.actualizarBotonInstalarSiCorresponde = function () {

    if (estaCorriendoInstalada()) {
        ocultarBotonInstalar();
        return;
    }

    if (eventoInstalacionDiferido) mostrarBotonInstalar();

};

document.addEventListener('click', async e => {

    const boton = e.target.closest('#btnInstalarApp');
    if (!boton) return;

    // iOS/Safari no soportan beforeinstallprompt: se instala manualmente
    // desde el botón "Compartir" → "Agregar a inicio".
    if (!eventoInstalacionDiferido) {

        mostrarBannerPWA('En iPhone: toca Compartir y luego "Agregar a inicio".');
        return;
    }

    boton.disabled = true;

    eventoInstalacionDiferido.prompt();
    await eventoInstalacionDiferido.userChoice;

    eventoInstalacionDiferido = null;
    boton.disabled = false;
    ocultarBotonInstalar();

});
