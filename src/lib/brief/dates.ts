const LIMA_TIME_ZONE = "America/Lima";

/** Fecha de "hoy" en horario de Lima, como "YYYY-MM-DD". Lima es UTC-5 sin horario de verano. */
export function todayInLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
