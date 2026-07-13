/*==========================================================
 APP BOMBEROS
 AUTH.JS — Login, sesión y protección de páginas (Firebase Auth)
==========================================================*/

import { app } from "../firebase/config.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const auth = getAuth(app);

// auth.js se incluye desde páginas en distinto nivel de carpetas, igual
// que pwa.js y sidebar.js: calculamos la raíz real del sitio a partir de
// la URL de este mismo script para que "login.html" siempre apunte al
// login de la raíz, sin importar desde qué página se use.
const URL_ESTE_SCRIPT = document.currentScript?.src
    || new URL('auth.js', document.baseURI).href;

const RAIZ_SITIO = new URL('../', URL_ESTE_SCRIPT);
const URL_LOGIN = new URL('login.html', RAIZ_SITIO).href;
const URL_DASHBOARD = new URL('index.html', RAIZ_SITIO).href;

/**
 * Inicia sesión con correo y contraseña. Lanza el error de Firebase si
 * las credenciales son inválidas (para que la pantalla de login lo
 * muestre al usuario).
 */
export function iniciarSesion(correo, clave) {
    return signInWithEmailAndPassword(auth, correo, clave);
}

export async function cerrarSesion() {
    await signOut(auth);
    window.location.href = URL_LOGIN;
}

/**
 * Debe llamarse al principio de cada página protegida (dashboard,
 * inspecciones, etc.). Si no hay sesión activa, redirige a login.html.
 * Si la hay, resuelve con el usuario autenticado.
 */
export function protegerPagina() {

    return new Promise(resolve => {

        onAuthStateChanged(auth, usuario => {

            if (!usuario) {
                window.location.href = `${URL_LOGIN}?volver=${encodeURIComponent(window.location.href)}`;
                return;
            }

            resolve(usuario);

        });

    });

}

export function obtenerUsuarioActual() {
    return auth.currentUser;
}

// Disponible globalmente para el botón "Cerrar sesión" del header
// (ver shared/header.js), sin necesidad de importar este módulo ahí.
window.cerrarSesionApp = cerrarSesion;

export { URL_LOGIN, URL_DASHBOARD };
