/* =========================================================
   FIREBASE CONFIG

   Configuración de Firebase para el proyecto
   Bomberos Villamaría
========================================================= */

import { initializeApp } from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
    initializeFirestore,
    persistentLocalCache,
    persistentSingleTabManager
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
    getStorage
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

import {
    getAuth
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

/* =========================================================
   CONFIGURACIÓN DE FIREBASE
========================================================= */

const firebaseConfig = {

    apiKey: "AIzaSyAfzmdBE0Y-NHOnn-2bv2Oahio8NPxd4uo",

    authDomain: "bomberos-villamaria.firebaseapp.com",

    projectId: "bomberos-villamaria",

    storageBucket: "bomberos-villamaria.firebasestorage.app",

    messagingSenderId: "842979154285",

    appId: "1:842979154285:web:2f96d9079da84e8a2b2264"

};

/* =========================================================
   INICIALIZAR FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);

/* =========================================================
   FIRESTORE CON CACHÉ PERSISTENTE
========================================================= */

const db = initializeFirestore(app, {

    // persistentMultipleTabManager() espera pestañas REALES abiertas al
    // mismo tiempo y se coordina entre ellas con un "lease" (turno) en
    // IndexedDB. El problema: esta es una app multi-página (dashboard,
    // inspecciones, emergencia, etc. son navegaciones normales, no una
    // SPA), y varios navegadores/PWAs mantienen la página anterior viva
    // un momento (bfcache) al navegar. Eso hace que, al entrar a
    // "Centro de Gestión de Inspecciones", la página nueva a veces tenga
    // que ESPERAR a que la anterior libere el turno — de ahí la demora
    // y que recargar (que sí fuerza a soltar todo) lo arreglara.
    //
    // persistentSingleTabManager({ forceOwnership: true }) evita esa
    // espera: la pestaña/página activa toma el control de una vez, sin
    // negociar con nadie. Como en la práctica solo hay una página de
    // esta app abierta a la vez por usuario, no hay ninguna
    // funcionalidad real que se pierda.
    localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({ forceOwnership: true })
    })

});

/* =========================================================
   STORAGE
========================================================= */

const storage = getStorage(app);

/* =========================================================
   AUTH
========================================================= */

const auth = getAuth(app);

/* =========================================================
   EXPORTAR INSTANCIAS
========================================================= */

export {

    app,

    db,

    storage,

    auth

};
