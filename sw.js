/* ========================================================================
   SERVICE WORKER — APP Bomberos
   Cachea el "app shell" para que la aplicación funcione sin conexión
   y sea instalable como PWA.
======================================================================== */

const SW_VERSION = 'v29'; // v23 -> v24: Centro de Gestión de Emergencias como vista por defecto (con mapa de puntos críticos)
const STATIC_CACHE = `bomberos-static-${SW_VERSION}`;
const DYNAMIC_CACHE = `bomberos-dynamic-${SW_VERSION}`;
const CACHES_VIGENTES = [STATIC_CACHE, DYNAMIC_CACHE];

// Límite de entradas en la caché dinámica, para que no crezca sin control
// (fotos, PDFs generados, respuestas de CDNs, etc.).
const LIMITE_CACHE_DINAMICA = 80;

// Archivos que forman el "esqueleto" de la app y deben quedar disponibles
// sin conexión desde la primera visita. Deben existir realmente en el
// proyecto: si una sola URL falla, antes se perdía el precache completo.
const FILES = [
    "./",
    "./index.html",
    "./login.html",
    "./offline.html",

    "./dashboard.css",
    "./dashboard.js",

    "./manifest.json",

    "./shared/shared.css",
    "./shared/shared.js",
    "./shared/sidebar.js",
    "./shared/header.js",
    "./shared/pwa.js",
    "./shared/auth.js",

    "./firebase/config.js",

    "./modules/inspecciones/index.html",
    "./modules/inspecciones/styles.css",
    "./modules/inspecciones/app.js",
    "./modules/inspecciones/autoguardado.js",
    "./modules/inspecciones/campos.js",
    "./modules/inspecciones/dom.js",
    "./modules/inspecciones/estado.js",
    "./modules/inspecciones/firebase.js",
    "./modules/inspecciones/firmas.js",
    "./modules/inspecciones/formulario.js",
    "./modules/inspecciones/fotos.js",
    "./modules/inspecciones/listado.js",
    "./modules/inspecciones/navegacion.js",
    "./modules/inspecciones/pdf.js",
    "./modules/inspecciones/persistencia.js",
    "./modules/inspecciones/utilidades.js",
    "./modules/inspecciones/validaciones.js",

    "./icons/icon-192-v4.png",
    "./icons/icon-512-v4.png"
];

// Recursos externos (CDN). Se cachean aparte y en modo "no-cors" porque
// muchos de estos no responden con cabeceras CORS explícitas y eso
// haría fallar cache.addAll() para todo lo demás.
const EXTERNOS = [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Nunca cachear llamadas a Firebase (Firestore/Storage/Auth): deben ir
// siempre a la red para no servir datos desactualizados u ocultar errores
// de conexión que la app necesita saber manejar (ej. modo offline propio).
const HOSTS_SIN_CACHE = [
    "firestore.googleapis.com",
    "firebasestorage.googleapis.com",
    "identitytoolkit.googleapis.com",
    "www.googleapis.com"
];

/* ========================================================================
   INSTALACIÓN
======================================================================== */

self.addEventListener('install', event => {

    event.waitUntil(
        (async () => {

            const cache = await caches.open(STATIC_CACHE);

            // Precache resiliente: si un archivo falla (404, red, etc.) se
            // reporta en consola pero NO tumba la instalación completa,
            // a diferencia de cache.addAll().
            const resultados = await Promise.allSettled(
                FILES.map(url => cache.add(url))
            );

            resultados.forEach((resultado, i) => {
                if (resultado.status === 'rejected') {
                    console.warn(`[SW] No se pudo precachear: ${FILES[i]}`, resultado.reason);
                }
            });

            // Recursos externos, en modo no-cors (respuesta "opaca").
            await Promise.allSettled(
                EXTERNOS.map(url =>
                    fetch(url, { mode: 'no-cors' }).then(resp => cache.put(url, resp))
                )
            );

        })()
    );

    self.skipWaiting();

});

/* ========================================================================
   ACTIVACIÓN
======================================================================== */

self.addEventListener('activate', event => {

    event.waitUntil(
        (async () => {

            const keys = await caches.keys();

            await Promise.all(
                keys
                    .filter(key => !CACHES_VIGENTES.includes(key))
                    .map(key => caches.delete(key))
            );

            await self.clients.claim();

        })()
    );

});

/* ========================================================================
   FETCH
======================================================================== */

self.addEventListener('fetch', event => {

    const request = event.request;
    const url = new URL(request.url);

    // Solo cacheamos peticiones GET.
    if (request.method !== 'GET') return;

    // Nunca cachear ni interceptar Firebase: siempre red directa.
    if (HOSTS_SIN_CACHE.includes(url.hostname)) return;

    // Navegación / HTML → Network First (con fallback a caché y a offline.html)
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {

        event.respondWith(
            (async () => {
                try {

                    const response = await fetch(request);
                    const cache = await caches.open(DYNAMIC_CACHE);
                    cache.put(request, response.clone());
                    return response;

                } catch (error) {

                    const cached = await caches.match(request);
                    return cached || caches.match('./offline.html');

                }
            })()
        );

        return;
    }

    // CSS / JS / imágenes / fuentes → Stale-While-Revalidate:
    // responde de inmediato con lo cacheado (rápido y funciona offline),
    // y en paralelo actualiza la caché con la versión de red para la
    // próxima vez. Así las actualizaciones de código llegan solas, sin
    // necesitar que el usuario borre datos o reinstale la app.
    event.respondWith(
        (async () => {

            const cacheado = await caches.match(request);

            const actualizarEnSegundoPlano = fetch(request)
                .then(async response => {

                    if (response && response.ok) {
                        const cache = await caches.open(DYNAMIC_CACHE);
                        cache.put(request, response.clone());
                        limitarTamanoCache(DYNAMIC_CACHE, LIMITE_CACHE_DINAMICA);
                    }

                    return response;

                })
                .catch(() => null);

            return cacheado || actualizarEnSegundoPlano || fetch(request);

        })()
    );

});

/* ========================================================================
   UTILIDADES
======================================================================== */

async function limitarTamanoCache(nombreCache, maximo) {

    const cache = await caches.open(nombreCache);
    const claves = await cache.keys();

    if (claves.length <= maximo) return;

    // Elimina las entradas más antiguas (las primeras en entrar).
    const sobrantes = claves.length - maximo;

    for (let i = 0; i < sobrantes; i++) {
        await cache.delete(claves[i]);
    }

}

/* ========================================================================
   MENSAJES DESDE LA PÁGINA (ej. forzar actualización inmediata)
======================================================================== */

self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
