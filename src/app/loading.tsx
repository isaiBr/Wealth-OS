// Se muestra automáticamente (React Suspense) mientras el Server Component
// de la ruta nueva busca datos — la demora real es la ida y vuelta a Turso
// en producción (en dev:test, con SQLite local, es instantánea y por eso
// nunca se nota ahí). Cubre toda navegación entre pantallas (Movimientos,
// Presupuesto, Cuentas, Configuración, Inicio); el cambio de pill dentro de
// una pantalla es 100% client-side y no pasa por acá.
export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-spinner" aria-hidden="true" />
      <span>Cargando...</span>
    </div>
  );
}
