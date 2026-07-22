const CACHE = {};

export async function cargarPlantillaDOCX(nombre="plantilla1.docx"){

    if(CACHE[nombre]){

        return CACHE[nombre];

    }

    const response = await fetch(

        `./plantillas/${nombre}`

    );

    if(!response.ok){

        throw new Error(

            "No fue posible cargar la plantilla."

        );

    }

    const buffer = await response.arrayBuffer();

    const zip = new PizZip(buffer);

    CACHE[nombre]=zip;

    return zip;

}
