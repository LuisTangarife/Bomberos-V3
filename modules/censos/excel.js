/* ========================================================================
   EXCEL.JS
   Módulo Censos — Exportación a Excel de TODOS los censos cargados en
   memoria (state.censos), no solo el que esté abierto en el formulario.

   Usa SheetJS (window.XLSX, cargado por CDN — ver index.html). Genera
   tres hojas para no perder información al aplanar los datos:
     - "Censos": una fila por censo, con los campos generales.
     - "Integrantes": una fila por integrante de cada censo.
     - "Mascotas": una fila por mascota de cada censo.
======================================================================== */

function unir(lista) {
    return Array.isArray(lista) ? lista.join(", ") : "";
}

export function exportarCensosExcel(censos) {

    if (!window.XLSX) {
        alert("No se pudo cargar la librería de exportación a Excel (SheetJS). Verifica tu conexión a internet.");
        return;
    }

    if (!Array.isArray(censos) || !censos.length) {
        alert("No hay censos para exportar.");
        return;
    }

    const filasCensos = censos.map(censo => ({
        "Código": censo.id || "",
        "Municipio": censo.municipio || "",
        "Corregimiento": censo.corregimiento || "",
        "Barrio / Vereda": censo.barrioVereda || "",
        "Código UDEGER": censo.codigoUdeger || "",
        "Núcleo #": censo.nucleo || "",
        "Dirección": censo.direccion || "",
        "Tipo de predio": censo.tipoPredio || "",
        "Nombre establecimiento": censo.nombreEstablecimiento || "",
        "Actividad económica": censo.tipoActividadEconomica || "",
        "¿Tiene póliza o seguro?": censo.tienePoliza === "Si" ? "Sí" : "No",
        "Compañía aseguradora": censo.companiaSeguro || "",

        "Jefe — Cédula": censo.jefeCedula || "",
        "Jefe — Nombre": censo.jefeNombre || "",
        "Jefe — Teléfono": censo.jefeTelefono || "",
        "Jefe — Fecha nacimiento": censo.jefeFechaNacimiento || "",
        "Jefe — Edad": censo.jefeEdad || "",
        "Tipo de ocupante": censo.tipoOcupante || "",
        "Propietario — Cédula": censo.propietarioCedula || "",
        "Propietario — Nombre": censo.propietarioNombre || "",
        "Propietario — Dirección": censo.propietarioDireccion || "",
        "Propietario — Teléfono": censo.propietarioTelefono || "",

        "N.° Integrantes": (censo.integrantes || []).length,
        "N.° Mascotas": (censo.mascotas || []).length,

        "Servicios públicos": unir(censo.servicios),
        "Subsidios recibidos": unir(censo.subsidios),

        "Situación fenómeno": censo.situacionFenomeno || "",
        "Origen fenómeno": unir(censo.origenFenomeno),

        "Infraestructura afectada": unir(censo.infraestructuraAfectada),
        "Área afectada (m²)": censo.areaAfectadaM2 || "",
        "Pérdida bienes/enseres": censo.perdidaBienes || "",
        "Descripción bienes perdidos": censo.descripcionBienesPerdidos || "",
        "Pérdida agropecuaria": censo.perdidaAgropecuaria || "",
        "Daño en edificación": censo.danoEdificacion || "",
        "Porcentaje de daño": censo.porcentajeDano || "",

        "Recomendación evacuación": censo.recomendacionEvacuacion || "",

        "Fecha elaboración": [censo.fechaDia, censo.fechaMes, censo.fechaAnio].filter(Boolean).join("/"),
        "Hora elaboración": censo.fechaHora ? `${censo.fechaHora}:${censo.fechaMinutos || "00"} ${censo.fechaAmPm || ""}` : "",

        "Observaciones": censo.observaciones || "",

        "Funcionario — Cédula": censo.funcionarioCedula || "",
        "Funcionario — Nombre": censo.funcionarioNombre || "",
        "Encuestado — Cédula": censo.encuestadoCedula || "",
        "Encuestado — Nombre": censo.encuestadoNombre || "",

        "Pendiente de sincronizar": censo.pending ? "Sí" : "No",
        "Última actualización": censo.updatedAt || ""
    }));

    const filasIntegrantes = [];
    censos.forEach(censo => {
        (censo.integrantes || []).forEach(persona => {
            filasIntegrantes.push({
                "Código Censo": censo.id || "",
                "Jefe de hogar": censo.jefeNombre || "",
                "Tipo documento": persona.tipoDocumento || "",
                "Número documento": persona.numeroDocumento || "",
                "Nombre completo": persona.nombreCompleto || "",
                "Fecha nacimiento": persona.fechaNacimiento || "",
                "Edad": persona.edad || "",
                "Sexo": persona.sexo || "",
                "Parentesco": persona.parentesco || "",
                "Discapacidad": persona.discapacidad === "Si" ? "Sí" : "No"
            });
        });
    });

    const filasMascotas = [];
    censos.forEach(censo => {
        (censo.mascotas || []).forEach(mascota => {
            filasMascotas.push({
                "Código Censo": censo.id || "",
                "Jefe de hogar": censo.jefeNombre || "",
                "Especie": mascota.especie || "",
                "Cantidad": mascota.cantidad || "",
                "Nombre": mascota.nombre || "",
                "Estado / observación": mascota.estado || ""
            });
        });
    });

    const libro = window.XLSX.utils.book_new();

    window.XLSX.utils.book_append_sheet(
        libro, window.XLSX.utils.json_to_sheet(filasCensos), "Censos"
    );

    window.XLSX.utils.book_append_sheet(
        libro,
        window.XLSX.utils.json_to_sheet(
            filasIntegrantes.length ? filasIntegrantes : [{ "Aviso": "Ningún censo tiene integrantes registrados" }]
        ),
        "Integrantes"
    );

    window.XLSX.utils.book_append_sheet(
        libro,
        window.XLSX.utils.json_to_sheet(
            filasMascotas.length ? filasMascotas : [{ "Aviso": "Ningún censo tiene mascotas registradas" }]
        ),
        "Mascotas"
    );

    const fechaHoy = new Date().toISOString().split("T")[0];
    window.XLSX.writeFile(libro, `Censos_${fechaHoy}.xlsx`);

}
