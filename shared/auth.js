/*==========================================================
 APP BOMBEROS
 AUTH.JS — Login, sesión y protección de páginas (Firebase Auth)
==========================================================*/

import { app } from "../firebase/config.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInAnonymously,
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

            // isAnonymous existe desde que agregamos signInAnonymously()
            // más abajo: una sesión anónima (invitado) NUNCA debe contar
            // como "sesión real" para páginas protegidas como el
            // dashboard — solo personal con cuenta de verdad entra aquí.
            if (!usuario || usuario.isAnonymous) {
                window.location.href = `${URL_LOGIN}?volver=${encodeURIComponent(window.location.href)}`;
                return;
            }

            resolve(usuario);

        });

    });

}

/**
 * Igual que antes, pero ahora NUNCA resuelve con `null`: si no hay
 * sesión real, inicia sesión anónima automáticamente y resuelve con
 * ese usuario anónimo. Esto le da a cada invitado un uid estable con
 * el que Firestore SÍ puede identificarlo (antes, request.auth era
 * null y no había forma de distinguir "invitado A" de "invitado B",
 * ni de permitirle editar después SU PROPIO registro sin abrirle la
 * puerta a editar el de cualquier otro).
 *
 * Quien llama debe distinguir invitado de personal real con
 * `usuario.isAnonymous`, YA NO con `!usuario` (eso dejó de funcionar,
 * usuario nunca es null).
 */
export function esperarEstadoAuth() {

    return new Promise((resolve, reject) => {

        const cancelar = onAuthStateChanged(auth, async usuario => {

            if (usuario) {
                cancelar();
                resolve(usuario);
                return;
            }

            try {
                const credencial = await signInAnonymously(auth);
                cancelar();
                resolve(credencial.user);
            } catch (error) {
                cancelar();
                console.error("[auth] No se pudo iniciar sesión anónima (revisa que 'Anonymous' esté habilitado en Firebase Auth):", error);
                reject(error);
            }

        });

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
