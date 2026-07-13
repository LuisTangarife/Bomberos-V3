/* =========================================================
   FIREBASE - INSPECCIONES
========================================================= */
import {
    db,
    storage
}
from "../../firebase/config.js";

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    orderBy,
    getDocs,
    runTransaction,
    serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


/* =========================================================
   CONSECUTIVO
========================================================= */

export async function generarConsecutivo(){

    const contadorRef = doc(

        db,

        "contadores",

        "inspecciones"

    );

    return await runTransaction(db, async(transaction)=>{

        const contador = await transaction.get(contadorRef);

        let ultimo = 0;

        if(contador.exists()){

            ultimo = contador.data().ultimo || 0;

        }

        ultimo++;

        transaction.set(

            contadorRef,

            {

                ultimo

            },

            {

                merge:true

            }

        );

        return `INS-${String(ultimo).padStart(5,"0")}`;

    });

}

/* =========================================================
   SUBIR FOTO
========================================================= */

export async function subirFotoStorage(consecutivo, foto){

    const extension = foto.nombre.split(".").pop();

    const nombreArchivo = `${foto.id}.${extension}`;

    const ruta = ref(

        storage,

        `inspecciones/${consecutivo}/${nombreArchivo}`

    );

    await uploadBytes(

        ruta,

        foto.archivo,

        {

            contentType: foto.tipo

        }

    );

    const url = await getDownloadURL(ruta);

    return{

        id: foto.id,

        nombre: foto.nombre,

        tipo: foto.tipo,

        orden: foto.orden,

        url,

        // Las tarjetas de foto en fotos.js usan "imagen" como src del
        // <img>. Al quedar igual a la URL de Storage, tanto las fotos
        // recién subidas como las que se cargan de vuelta desde
        // Firestore se muestran igual, sin tener que tocar fotos.js.
        imagen: url

    };

}

/* =========================================================
   ELIMINAR FOTO
========================================================= */

export async function eliminarFotoStorage(consecutivo,foto){

    const extension = foto.nombre.split(".").pop();

    const nombreArchivo = `${foto.id}.${extension}`;

    const ruta = ref(

        storage,

        `inspecciones/${consecutivo}/${nombreArchivo}`

    );

    await deleteObject(ruta);

}

/* =========================================================
   CRUD INSPECCIONES (FIRESTORE)
========================================================= */

export async function guardarInspeccion(id, datos){

    await setDoc(

        doc(db, "inspecciones", id),

        {

            ...datos,

            createdAt: serverTimestamp(),

            updatedAt: serverTimestamp()

        },

        {

            merge: true

        }

    );

}

export async function obtenerInspeccion(id){

    const documento = await getDoc(

        doc(db,"inspecciones",id)

    );

    if(!documento.exists()){

        return null;

    }

    return{

        id: documento.id,

        ...documento.data()

    };

}

export async function listarInspecciones(){

    const consulta = query(

        collection(db,"inspecciones"),

        orderBy("updatedAt","desc")

    );

    const snapshot = await getDocs(consulta);

    return snapshot.docs.map(doc=>({

        id:doc.id,

        ...doc.data()

    }));

}

export async function actualizarInspeccion(id,datos){

    await updateDoc(

        doc(db,"inspecciones",id),

        {

            ...datos,

            updatedAt:serverTimestamp()

        }

    );

}

export async function eliminarInspeccion(id){

    await deleteDoc(

        doc(db,"inspecciones",id)

    );

}

export {

    db,

    storage

};
