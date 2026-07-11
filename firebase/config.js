/* =========================================================
   FIREBASE CONFIG
========================================================= */

import { initializeApp } from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
    getFirestore
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
    getStorage
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

const firebaseConfig = {

    apiKey: "...",

    authDomain: "...",

    projectId: "...",

    storageBucket: "...",

    messagingSenderId: "...",

    appId: "..."

};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const storage = getStorage(app);

export {

    app,

    db,

    storage

};
