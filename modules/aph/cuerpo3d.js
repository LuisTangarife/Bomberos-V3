/* ========================================================================
   CUERPO3D.JS
   Módulo APH — Localización de lesiones sobre un cuerpo humano 3D

   Reemplaza las 5 siluetas estáticas (frente, espalda, dos perfiles,
   caras) del formato en papel por UN solo cuerpo que se gira con el
   mouse/dedo. Al tocar una parte, se elige el tipo de lesión de un
   menú (mismos códigos que el formato original: C, H, L, Deformidad,
   Dolor, Quemadura, Hemorragia, Amputación, Arma de fuego, Corto
   punzante) y queda marcada en el punto exacto donde se tocó.

   Probado con Playwright antes de integrarlo aquí: 19 partes
   detectables, el click coloca el marcador en el punto real de
   intersección (no en el centro de la parte), y frente/espalda se
   distinguen gracias a la nariz y los ojos — sin esos rasgos, todas
   las partes son cilindros/esferas simétricos y se ven idénticos
   desde cualquier ángulo.
======================================================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export const TIPOS_LESION = [
    { codigo: "C",   etiqueta: "Confusión",              color: 0x8b5cf6 },
    { codigo: "H",   etiqueta: "Hematoma",                color: 0x6b21a8 },
    { codigo: "L",   etiqueta: "Laceración",              color: 0xff3b30 },
    { codigo: "DEF", etiqueta: "Deformidad",              color: 0xff9500 },
    { codigo: "DOL", etiqueta: "Dolor",                   color: 0xffcc00 },
    { codigo: "Q",   etiqueta: "Quemadura",                color: 0xff5e00 },
    { codigo: "HE",  etiqueta: "Hemorragia",               color: 0xb91c1c },
    { codigo: "AMP", etiqueta: "Amputación",                color: 0x111111 },
    { codigo: "LAF", etiqueta: "Lesión arma de fuego",      color: 0x374151 },
    { codigo: "LCP", etiqueta: "Lesión corto punzante",     color: 0x1d4ed8 }
];

function colorDeCodigo(codigo) {
    return (TIPOS_LESION.find(t => t.codigo === codigo) || TIPOS_LESION[0]).color;
}

/**
 * Crea el cuerpo 3D dentro de `contenedor` (un <div>). Devuelve una
 * API para usarlo desde app.js:
 *   - obtenerLesiones()      -> arreglo de lesiones marcadas
 *   - cargarLesiones(arr)    -> repuebla marcadores (modo edición)
 *   - limpiar()              -> quita todas las marcas (censo nuevo)
 *   - redimensionar()        -> recalcula tamaño si el contenedor cambia
 */
export function inicializarCuerpo3D(contenedor, { onCambio } = {}) {

    const ANCHO = contenedor.clientWidth || 500;
    const ALTO = contenedor.clientHeight || 560;

    const escena = new THREE.Scene();
    escena.background = null;

    const camara = new THREE.PerspectiveCamera(35, ANCHO / ALTO, 0.1, 100);
    camara.position.set(0, 0.82, 3.5);
    camara.lookAt(0, 0.82, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ANCHO, ALTO);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    contenedor.appendChild(renderer.domElement);

    escena.add(new THREE.AmbientLight(0xffffff, 0.7));
    const luzDir = new THREE.DirectionalLight(0xffffff, 0.85);
    luzDir.position.set(2, 4, 3);
    escena.add(luzDir);
    const luzRelleno = new THREE.DirectionalLight(0x88aaff, 0.25);
    luzRelleno.position.set(-2, 1, -3);
    escena.add(luzRelleno);

    const MATERIAL_PIEL = new THREE.MeshStandardMaterial({ color: 0xd8a888, roughness: 0.6 });

    const cuerpo = new THREE.Group();
    escena.add(cuerpo);

    const partes = [];
    const partesPorNombre = new Map();

    function agregarParte(nombre, geometria, x, y, z, rotZ = 0) {
        const mesh = new THREE.Mesh(geometria, MATERIAL_PIEL.clone());
        mesh.position.set(x, y, z);
        if (rotZ) mesh.rotation.z = rotZ;
        mesh.userData.nombre = nombre;
        cuerpo.add(mesh);
        partes.push(mesh);
        partesPorNombre.set(nombre, mesh);
        return mesh;
    }

    function cil(radioSup, radioInf, alto, segmentos = 16) {
        return new THREE.CylinderGeometry(radioSup, radioInf, alto, segmentos);
    }

    // ---- Cabeza + rasgos que distinguen frente/espalda ----
    agregarParte("Cabeza", new THREE.SphereGeometry(0.115, 20, 20), 0, 1.62, 0);

    const nariz = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.045, 10),
        new THREE.MeshStandardMaterial({ color: 0xc79070, roughness: 0.6 })
    );
    nariz.position.set(0, 1.605, 0.113);
    nariz.rotation.x = Math.PI / 2;
    cuerpo.add(nariz);

    [-1, 1].forEach(lado => {
        const ojo = new THREE.Mesh(
            new THREE.SphereGeometry(0.013, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x2a2018 })
        );
        ojo.position.set(lado * 0.045, 1.635, 0.098);
        cuerpo.add(ojo);
    });

    const boca = new THREE.Mesh(
        new THREE.TorusGeometry(0.02, 0.004, 6, 10, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x8a4a42 })
    );
    boca.rotation.z = Math.PI;
    boca.position.set(0, 1.575, 0.108);
    cuerpo.add(boca);

    [-1, 1].forEach(lado => {
        const oreja = new THREE.Mesh(
            new THREE.SphereGeometry(0.018, 10, 10),
            MATERIAL_PIEL.clone()
        );
        oreja.scale.set(0.6, 1, 0.8);
        oreja.position.set(lado * 0.112, 1.615, 0.01);
        cuerpo.add(oreja);
    });

    agregarParte("Cuello", cil(0.045, 0.055, 0.09), 0, 1.47, 0);
    agregarParte("Tórax", cil(0.165, 0.145, 0.34), 0, 1.24, 0);
    agregarParte("Abdomen", cil(0.145, 0.155, 0.20), 0, 0.98, 0);
    agregarParte("Pelvis", cil(0.155, 0.14, 0.18), 0, 0.80, 0);

    [1, -1].forEach(lado => {
        const t = lado > 0 ? "derecho" : "izquierdo";
        agregarParte(`Hombro ${t}`, new THREE.SphereGeometry(0.075, 16, 16), lado * 0.22, 1.36, 0);
        agregarParte(`Brazo ${t}`, cil(0.052, 0.045, 0.30), lado * 0.245, 1.14, 0, lado * 0.06);
        agregarParte(`Antebrazo ${t}`, cil(0.042, 0.038, 0.27), lado * 0.26, 0.85, 0, lado * 0.04);
        agregarMano(t, lado);
    });

    [1, -1].forEach(lado => {
        const t = lado > 0 ? "derecha" : "izquierda";
        agregarParte(`Pierna superior ${t}`, cil(0.095, 0.08, 0.44), lado * 0.09, 0.48, 0);
        agregarParte(`Pierna inferior ${t}`, cil(0.075, 0.055, 0.40), lado * 0.09, 0.06, 0);
        agregarPie(t, lado);
    });

    // Mano con palma aplanada (no una esfera lisa) + 5 dedos, para que
    // al inclinar el cuerpo hacia arriba/abajo se distinga la palma
    // (cara frontal, +z) del dorso (cara trasera). El nombre clickeable
    // sigue siendo uno solo por mano — los dedos son visuales, no
    // partes seleccionables aparte, para no fragmentar demasiado la
    // localización de lesiones.
    function agregarMano(ladoTxt, lado) {

        const mano = agregarParte(
            `Mano ${ladoTxt}`,
            new THREE.BoxGeometry(0.062, 0.075, 0.024),
            lado * 0.265, 0.655, 0
        );

        const NUM_DEDOS = 5;
        for (let i = 0; i < NUM_DEDOS; i++) {

            const offsetX = (i - (NUM_DEDOS - 1) / 2) * 0.0115;
            // El pulgar (dedo de los extremos hacia el cuerpo) va más
            // corto y rotado, como en una mano real.
            const esPulgar = (lado > 0 && i === NUM_DEDOS - 1) || (lado < 0 && i === 0);

            const dedo = new THREE.Mesh(
                cil(0.006, 0.007, esPulgar ? 0.028 : 0.038),
                MATERIAL_PIEL.clone()
            );
            if (esPulgar) dedo.rotation.z = lado * Math.PI / 3.2; // el pulgar sale hacia el costado, no recto
            dedo.position.set(
                esPulgar ? offsetX * 1.3 : offsetX,
                esPulgar ? 0.018 : 0.055,
                esPulgar ? 0.01 : 0
            );
            mano.add(dedo);

        }

    }

    // Pie con empeine curvo arriba y planta plana abajo (antes era una
    // caja lisa, indistinguible arriba/abajo) + dedos marcados al
    // frente, para que "arriba del pie" y "planta" se puedan
    // diferenciar al inclinar el cuerpo.
    function agregarPie(ladoTxt, lado) {

        const pie = agregarParte(
            `Pie ${ladoTxt}`,
            new THREE.BoxGeometry(0.09, 0.05, 0.21),
            lado * 0.09, -0.175, 0.045
        );

        // Empeine: medio cilindro pegado arriba, da la curva que
        // distingue "arriba del pie" de la planta (plana, sin nada).
        const empeine = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 0.09, 12, 1, false, 0, Math.PI),
            MATERIAL_PIEL.clone()
        );
        empeine.rotation.z = Math.PI / 2;
        empeine.rotation.y = Math.PI / 2;
        empeine.position.set(0, 0.025, -0.02);
        pie.add(empeine);

        // 5 dedos pequeños en la punta.
        for (let i = 0; i < 5; i++) {
            const dedo = new THREE.Mesh(
                new THREE.SphereGeometry(0.011, 8, 8),
                MATERIAL_PIEL.clone()
            );
            dedo.position.set((i - 2) * 0.016, 0.005, 0.1);
            pie.add(dedo);
        }

    }

    // ---- Rotación por arrastre (mouse y dedo) — dos ejes: horizontal
    // (girar de lado, como ya había) y vertical (inclinar hacia arriba
    // o hacia abajo, para poder ver la coronilla o la planta de los
    // pies, que antes era imposible con un solo eje de giro).
    let arrastrando = false;
    let anguloInicialY = 0;
    let anguloInicialX = 0;
    let xInicial = 0;
    let yInicial = 0;
    let distanciaArrastre = 0;

    const LIMITE_INCLINACION = Math.PI / 2.1; // ~85°, evita que se voltee de cabeza sin control

    function posXY(evento) {
        const p = evento.touches ? evento.touches[0] : evento;
        return { x: p.clientX, y: p.clientY };
    }

    function iniciarArrastre(e) {
        arrastrando = true;
        const p = posXY(e);
        xInicial = p.x;
        yInicial = p.y;
        anguloInicialY = cuerpo.rotation.y;
        anguloInicialX = cuerpo.rotation.x;
        distanciaArrastre = 0;
    }

    function moverArrastre(e) {
        if (!arrastrando) return;
        const p = posXY(e);
        const deltaX = p.x - xInicial;
        const deltaY = p.y - yInicial;
        distanciaArrastre = Math.max(Math.abs(deltaX), Math.abs(deltaY));

        cuerpo.rotation.y = anguloInicialY + deltaX * 0.01;

        const nuevaInclinacion = anguloInicialX + deltaY * 0.01;
        cuerpo.rotation.x = Math.max(-LIMITE_INCLINACION, Math.min(LIMITE_INCLINACION, nuevaInclinacion));
    }

    function terminarArrastre(e) {
        if (!arrastrando) return;
        arrastrando = false;
        if (distanciaArrastre < 4) manejarSeleccion(e);
    }

    renderer.domElement.addEventListener("mousedown", iniciarArrastre);
    window.addEventListener("mousemove", moverArrastre);
    window.addEventListener("mouseup", terminarArrastre);

    renderer.domElement.addEventListener("touchstart", e => iniciarArrastre(e.touches[0]), { passive: true });
    window.addEventListener("touchmove", e => moverArrastre(e.touches[0]), { passive: true });
    window.addEventListener("touchend", e => terminarArrastre(e.changedTouches[0]));

    // ---- Selección + menú de tipo de lesión ----
    const raycaster = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    const lesiones = []; // { parte, codigo, etiqueta, x, y, z, marcador }

    const menu = document.createElement("div");
    menu.className = "cuerpo3d-menu";
    menu.style.display = "none";
    contenedor.style.position = "relative";
    contenedor.appendChild(menu);

    function manejarSeleccion(e) {

        const rect = renderer.domElement.getBoundingClientRect();
        const cx = (e.clientX ?? posX(e)) - rect.left;
        const cy = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;

        puntero.x = (cx / rect.width) * 2 - 1;
        puntero.y = -(cy / rect.height) * 2 + 1;

        raycaster.setFromCamera(puntero, camara);
        const hits = raycaster.intersectObjects(partes, false);

        if (!hits.length) return;

        mostrarMenu(hits[0], cx, cy);

    }

    function mostrarMenu(hit, cx, cy) {

        menu.innerHTML = `
            <div class="cuerpo3d-menu-titulo">${hit.object.userData.nombre}</div>
            ${TIPOS_LESION.map(t => `
                <button type="button" data-codigo="${t.codigo}">
                    <span class="cuerpo3d-punto" style="background:#${t.color.toString(16).padStart(6, "0")}"></span>
                    ${t.etiqueta} (${t.codigo})
                </button>
            `).join("")}
            <button type="button" class="cuerpo3d-menu-cancelar">Cancelar</button>
        `;

        const maxX = contenedor.clientWidth - 200;
        const maxY = contenedor.clientHeight - 320;
        menu.style.left = `${Math.max(4, Math.min(cx, maxX))}px`;
        menu.style.top = `${Math.max(4, Math.min(cy, maxY))}px`;
        menu.style.display = "block";

        menu.querySelectorAll("button[data-codigo]").forEach(boton => {
            boton.addEventListener("click", () => {
                confirmarLesion(hit, boton.dataset.codigo);
                menu.style.display = "none";
            });
        });

        menu.querySelector(".cuerpo3d-menu-cancelar").addEventListener("click", () => {
            menu.style.display = "none";
        });

    }

    function confirmarLesion(hit, codigo) {

        const info = TIPOS_LESION.find(t => t.codigo === codigo);
        const local = hit.object.worldToLocal(hit.point.clone());

        const marcador = new THREE.Mesh(
            new THREE.SphereGeometry(0.015, 10, 10),
            new THREE.MeshBasicMaterial({ color: info.color })
        );
        marcador.position.copy(local);
        hit.object.add(marcador);

        const lesion = {
            parte: hit.object.userData.nombre,
            codigo: info.codigo,
            etiqueta: info.etiqueta,
            x: local.x, y: local.y, z: local.z,
            marcador
        };

        lesiones.push(lesion);
        onCambio?.(lesionesPublicas());

    }

    function lesionesPublicas() {
        return lesiones.map(({ marcador, ...resto }) => resto);
    }

    function quitarLesion(indice) {
        const [lesion] = lesiones.splice(indice, 1);
        lesion?.marcador?.removeFromParent();
        onCambio?.(lesionesPublicas());
    }

    function limpiar() {
        while (lesiones.length) quitarLesion(0);
    }

    function cargarLesiones(guardadas = []) {

        limpiar();

        guardadas.forEach(g => {

            const mesh = partesPorNombre.get(g.parte);
            if (!mesh) return; // parte de una versión anterior del modelo, se ignora

            const info = TIPOS_LESION.find(t => t.codigo === g.codigo) || TIPOS_LESION[0];

            const marcador = new THREE.Mesh(
                new THREE.SphereGeometry(0.015, 10, 10),
                new THREE.MeshBasicMaterial({ color: info.color })
            );
            marcador.position.set(g.x, g.y, g.z);
            mesh.add(marcador);

            lesiones.push({ ...g, marcador });

        });

        onCambio?.(lesionesPublicas());

    }

    function redimensionar() {
        const w = contenedor.clientWidth || ANCHO;
        const h = contenedor.clientHeight || ALTO;
        camara.aspect = w / h;
        camara.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    let activo = true;
    function animar() {
        if (!activo) return;
        requestAnimationFrame(animar);
        renderer.render(escena, camara);
    }
    animar();

    function destruir() {
        activo = false;
        window.removeEventListener("mousemove", moverArrastre);
        window.removeEventListener("mouseup", terminarArrastre);
        renderer.dispose();
    }

    return {
        obtenerLesiones: lesionesPublicas,
        cargarLesiones,
        quitarLesion,
        limpiar,
        redimensionar,
        destruir
    };

}
