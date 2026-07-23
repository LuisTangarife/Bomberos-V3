// Se cachea el ArrayBuffer crudo, NO el objeto PizZip. docxtemplater
// escribe el documento renderizado de vuelta dentro del mismo zip con el
// que se le construye, así que si reutilizáramos un PizZip ya usado, la
// segunda generación de un Word partiría de un documento que ya perdió
// sus placeholders {{...}} (fueron reemplazados en el primer render).
// Con el buffer inmutable en caché, cada llamada arma un PizZip nuevo
// y evita esa corrupción, sin tener que volver a descargar el archivo.
const CACHE_BUFFERS = {};

export async function cargarPlantillaDOCX(nombre = "plantilla1.docx") {

    if (!CACHE_BUFFERS[nombre]) {

        const response = await fetch(

            `./plantillas/${nombre}`

        );

        if (!response.ok) {

            throw new Error(

                "No fue posible cargar la plantilla."

            );

        }

        CACHE_BUFFERS[nombre] = await response.arrayBuffer();

    }

    return new PizZip(CACHE_BUFFERS[nombre]);

}
