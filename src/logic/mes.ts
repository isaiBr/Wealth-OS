const REGEX_MES = /^\d{4}-\d{2}$/;

export function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Valida "YYYY-MM" tal cual llega de un searchParam — cualquier otra cosa cae al mes actual. */
export function normalizarMes(valor: string | undefined): string {
  if (valor && REGEX_MES.test(valor)) return valor;
  return mesActual();
}

export function mesAnteriorDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Nombre del mes capitalizado, sin año (ej. "Septiembre") — el año se agrega aparte donde haga falta. */
export function nombreMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombre = new Intl.DateTimeFormat("es-PE", { month: "long" }).format(new Date(anio, m - 1, 1));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
