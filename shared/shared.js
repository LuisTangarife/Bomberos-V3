/*==========================================================
 APP BOMBEROS
 Funciones Globales
==========================================================*/

function toggleSidebar(){

    const sidebar=document.getElementById("sidebar");

    if(!sidebar)return;

    sidebar.classList.toggle("show");

}

/*==========================================================*/

function cerrarSidebar(){

    const sidebar=document.getElementById("sidebar");

    if(!sidebar)return;

    sidebar.classList.remove("show");

}

/*==========================================================*/

function actualizarHora(){

    const reloj=document.getElementById("clock");

    if(!reloj)return;

    const fecha=new Date();

    reloj.innerHTML=fecha.toLocaleString("es-CO",{

        weekday:"long",

        year:"numeric",

        month:"long",

        day:"numeric",

        hour:"2-digit",

        minute:"2-digit"

    });

}

/*==========================================================*/

function iniciarSistema(){

    actualizarHora();

    setInterval(actualizarHora,60000);

}

/*==========================================================*/

window.addEventListener("resize",()=>{

    if(window.innerWidth>900){

        cerrarSidebar();

    }

});

/*==========================================================*/

document.addEventListener("DOMContentLoaded",()=>{

    iniciarSistema();

});
