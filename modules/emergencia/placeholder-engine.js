export function crearContexto(data){

    return{

        REPORTE_ID:data.id,

        FECHA:data.fecha,

        HORA_LLEGADA:data.horaLlegada,

        HORA_FINAL:data.horaFinal,

        LATITUD:data.latitud,

        LONGITUD:data.longitud,

        COORDENADAS:data.coordenadas,

        LUGAR:data.lugar,

        DIRECCION:data.direccion,

        EVENTO:data.evento,

        PERSONAL:data.personal,

        VEHICULOS:data.vehiculos,

        DESCRIPCION:data.descripcion,

        LESIONADOS:data.lesionados,

        VICTIMAS:data.victimas,

        AFECTADOS:data.afectados,

        NOVEDADES:data.novedades,

        FIRMAS_AFECTADOS:data.firmasAfectados,

        FIRMAS_BOMBEROS:data.firmasBomberos

    };

}
