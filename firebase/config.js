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
    persistentMultipleTabManager
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
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
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
