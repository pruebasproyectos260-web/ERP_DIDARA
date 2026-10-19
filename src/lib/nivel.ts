export const NIVEL = {
  SUPER_ADMIN: 0,
  ADMIN:       1,
  ESTANDAR:    2,
  RESTRINGIDO: 3,
} as const

export const esAdmin     = (nivel: number) => nivel <= 1
export const esEstandar  = (nivel: number) => nivel === 2
export const esRestringido = (nivel: number) => nivel >= 3
