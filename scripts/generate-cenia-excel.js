const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Datos del registro CENIA
const data = {
  empresa: {
    razonSocial: "CENTRO NACIONAL DE INTELIGENCIA ARTIFICIAL SOCIEDAD POR ACCIONES",
    nombreFantasia: "CENIA",
    rut: "77337607-4",
    direccion: "Beauchef 851, Edificio Norte, Piso 7",
    comuna: "Santiago",
    giro: "Investigación y desarrollo",
    emailFacturacion: "administracion@cenia.cl",
    telefonoContacto: "",
    sistema: ["GeoVictoria APP"],
    rubro: "5. Consultoría"
  },
  admins: [
    {
      nombre: "Constanza Vera",
      apellido: "Vera",
      rut: "",
      email: "constanza.vera@cenia.cl",
      telefono: "",
      grupo: ""
    }
  ],
  trabajadores: [],
  turnos: [
    { id: -1, nombre: "Libre", horaInicio: "", horaFin: "", colacionMinutos: 0 },
    { id: -2, nombre: "Descanso", horaInicio: "", horaFin: "", colacionMinutos: 0 }
  ],
  planificaciones: [],
  asignaciones: []
};

async function generateExcels() {
  // Crear directorio si no existe
  const outputDir = path.join(process.cwd(), 'public', 'downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ========== EXCEL DE USUARIOS ==========
  const usuariosData = [];
  
  // Agregar admin
  data.admins.forEach(admin => {
    usuariosData.push({
      'Tipo': 'Administrador',
      'Nombre': admin.nombre || '',
      'Apellido': admin.apellido || '',
      'RUT': admin.rut || '',
      'Email': admin.email || '',
      'Teléfono': admin.telefono || '',
      'Grupo': admin.grupo || ''
    });
  });

  // Agregar trabajadores (vacío en este caso)
  data.trabajadores.forEach(trab => {
    usuariosData.push({
      'Tipo': trab.tipo || 'Usuario',
      'Nombre': trab.nombre || '',
      'Apellido': trab.apellido || '',
      'RUT': trab.rut || '',
      'Email': trab.email || '',
      'Teléfono': trab.telefono1 || '',
      'Grupo': trab.grupoNombre || ''
    });
  });

  const usuariosWb = XLSX.utils.book_new();
  const usuariosWs = XLSX.utils.json_to_sheet(usuariosData);
  
  // Ajustar anchos de columna
  usuariosWs['!cols'] = [
    { wch: 15 }, // Tipo
    { wch: 25 }, // Nombre
    { wch: 25 }, // Apellido
    { wch: 15 }, // RUT
    { wch: 35 }, // Email
    { wch: 15 }, // Teléfono
    { wch: 20 }  // Grupo
  ];
  
  XLSX.utils.book_append_sheet(usuariosWb, usuariosWs, 'Usuarios');
  
  const usuariosPath = path.join(outputDir, 'usuarios-cenia-77337607.xlsx');
  XLSX.writeFile(usuariosWb, usuariosPath);
  console.log('Usuarios Excel creado:', usuariosPath);

  // ========== EXCEL DE PLANIFICACIONES ==========
  const workbook = new ExcelJS.Workbook();
  
  // Hoja de Turnos
  const turnosSheet = workbook.addWorksheet('Turnos');
  turnosSheet.columns = [
    { header: 'Nombre Turno', key: 'nombre', width: 20 },
    { header: 'Hora Inicio', key: 'horaInicio', width: 15 },
    { header: 'Hora Fin', key: 'horaFin', width: 15 },
    { header: 'Colación (min)', key: 'colacion', width: 15 }
  ];
  
  // Estilo de encabezado
  turnosSheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Agregar turnos
  data.turnos.forEach(turno => {
    if (turno.id > 0) { // Solo turnos reales, no Libre/Descanso
      turnosSheet.addRow({
        nombre: turno.nombre,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        colacion: turno.colacionMinutos
      });
    }
  });

  // Hoja de Planificaciones
  const planSheet = workbook.addWorksheet('Planificaciones');
  planSheet.columns = [
    { header: 'Nombre Planificación', key: 'nombre', width: 25 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Lunes', key: 'lunes', width: 12 },
    { header: 'Martes', key: 'martes', width: 12 },
    { header: 'Miércoles', key: 'miercoles', width: 12 },
    { header: 'Jueves', key: 'jueves', width: 12 },
    { header: 'Viernes', key: 'viernes', width: 12 },
    { header: 'Sábado', key: 'sabado', width: 12 },
    { header: 'Domingo', key: 'domingo', width: 12 }
  ];

  // Estilo de encabezado
  planSheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Agregar planificaciones (vacío en este caso)
  data.planificaciones.forEach(plan => {
    planSheet.addRow({
      nombre: plan.nombre,
      tipo: plan.tipo,
      lunes: plan.dias?.lunes || '',
      martes: plan.dias?.martes || '',
      miercoles: plan.dias?.miercoles || '',
      jueves: plan.dias?.jueves || '',
      viernes: plan.dias?.viernes || '',
      sabado: plan.dias?.sabado || '',
      domingo: plan.dias?.domingo || ''
    });
  });

  // Hoja de Asignaciones
  const asigSheet = workbook.addWorksheet('Asignaciones');
  asigSheet.columns = [
    { header: 'RUT Trabajador', key: 'rut', width: 15 },
    { header: 'Nombre Trabajador', key: 'nombre', width: 30 },
    { header: 'Grupo', key: 'grupo', width: 20 },
    { header: 'Planificación Asignada', key: 'planificacion', width: 25 }
  ];

  // Estilo de encabezado
  asigSheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFED7D31' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  const planPath = path.join(outputDir, 'planificaciones-cenia-77337607.xlsx');
  await workbook.xlsx.writeFile(planPath);
  console.log('Planificaciones Excel creado:', planPath);

  console.log('\n=== ARCHIVOS GENERADOS ===');
  console.log('1. /public/downloads/usuarios-cenia-77337607.xlsx');
  console.log('2. /public/downloads/planificaciones-cenia-77337607.xlsx');
  console.log('\nDescarga desde el preview de v0 o publica para acceder a:');
  console.log('- /downloads/usuarios-cenia-77337607.xlsx');
  console.log('- /downloads/planificaciones-cenia-77337607.xlsx');
}

generateExcels().catch(console.error);
