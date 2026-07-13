/* =========================================================
   FIREBASE CONFIG

   1) Pega aquí abajo, en "firebaseConfig", las llaves reales que te
      da Firebase Console → Configuración del proyecto → Tus apps → Web.
   2) No necesitas nada más: Firestore, Storage y Auth ya quedan listos
      para usarse desde el resto de la app (firebase.js, auth.js).
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
   ⚠️ REEMPLAZA ESTOS VALORES POR LOS DE TU PROYECTO REAL
========================================================= */
const firebaseConfig = {

    apiKey: "...",

    authDomain: "...",

    projectId: "...",

    storageBucket: "...",

    messagingSenderId: "...",

    appId: "..."

};

const app = initializeApp(firebaseConfig);

// Firestore con caché local persistente: los datos quedan disponibles
// sin conexión (igual que antes con localStorage) y se sincronizan
// solos apenas vuelve la señal. "persistentMultipleTabManager" permite
// tener la app abierta en varias pestañas/dispositivos a la vez.
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const storage = getStorage(app);

const auth = getAuth(app);

export {

    app,

    db,

    storage,

    auth

};
