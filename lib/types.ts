export interface Empresa {
  razonSocial: string
  nombreFantasia: string
  rut: string
  giro: string
  direccion: string
  comuna: string
  emailFacturacion: string
  telefonoContacto: string
  sistema: string[]
  modulosAdicionales: string[]
  modulosAdicionalesOtro: string
  rubro: string
  grupos: Grupo[]
}

export interface Grupo {
  id: string
  nombre: string
}

export interface Admin {
  nombre: string
  apellido: string
  rut: string
  email: string
  telefono: string
  grupo: string
}

export interface Trabajador {
  nombre: string
  rut: string
  email: string
  grupo: string
}

export interface Turno {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  diasSemana: number[]
  color: string
}

export interface Planificacion {
  id: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  turnos: { turnoId: string; dias: string[] }[]
}

export interface Asignacion {
  trabajadorRut: string
  planificacionId: string
}

export interface FormData {
  empresa: Empresa
  admins: Admin[]
  trabajadores: Trabajador[]
  turnos: Turno[]
  planificaciones: Planificacion[]
  asignaciones: Asignacion[]
  configureNow: boolean
}
