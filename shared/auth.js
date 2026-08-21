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
// Detecta automáticamente si la app está en GitHub Pages o en localhost
const BASE_PATH = window.location.pathname.includes("/Bomberos-V3/")
    ? "/Bomberos-V3/"
    : "/";

const URL_LOGIN = `${window.location.origin}${BASE_PATH}login.html`;
const URL_DASHBOARD = `${window.location.origin}${BASE_PATH}index.html`;

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

/**
 * Igual que protegerPagina(), pero para páginas que SÍ deben abrir sin
 * sesión (ej. formularios de Inspecciones/Emergencia). Nunca redirige:
 * resuelve con el usuario de Firebase si hay sesión, o con `null` si no
 * la hay. Quien llama esta función es responsable de restringir lo que
 * un usuario `null` puede ver (normalmente: solo sus registros locales,
 * nunca el listado completo remoto).
 */
export function esperarEstadoAuth() {

    return new Promise(resolve => {
        onAuthStateChanged(auth, usuario => resolve(usuario || null));
    });

}

/**
 * Suscribe un callback a cambios de sesión sin redirigir nunca. Pensado
 * para piezas de UI compartidas (ej. sidebar.js) que necesitan
 * mostrar/ocultar enlaces según haya o no sesión activa, en cualquier
 * página, sin acoplarse a protegerPagina() ni a esperarEstadoAuth().
 */
export function escucharEstadoAuth(callback) {
    return onAuthStateChanged(auth, usuario => callback(usuario || null));
}

export function obtenerUsuarioActual() {
    return auth.currentUser;
}

// Disponible globalmente para el botón "Cerrar sesión" del header
// (ver shared/header.js), sin necesidad de importar este módulo ahí.
window.cerrarSesionApp = cerrarSesion;

export { URL_LOGIN, URL_DASHBOARD };
