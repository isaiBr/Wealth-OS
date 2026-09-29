export const metadata = {
  title: "Términos del servicio — Wealth OS",
};

export default function TerminosServicioPage() {
  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Términos del servicio</div>
        <div className="screen-sub">Última actualización: 28 de septiembre de 2026</div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <section>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6 }}>
            Wealth OS es una herramienta personal de finanzas y organización, operada de forma
            privada por su dueño. El acceso es solo por invitación directa: no es un servicio
            comercial ni está disponible para el público.
          </p>
        </section>

        <section>
          <div className="section-title">Uso del servicio</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            El acceso se otorga a criterio del dueño de la app y puede revocarse en cualquier
            momento y sin previo aviso. Cada usuario es responsable de mantener segura su sesión y
            de no compartir su acceso con terceros.
          </p>
        </section>

        <section>
          <div className="section-title">Sin garantías</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            La app se ofrece "tal cual", sin garantía de disponibilidad continua ni de exactitud
            absoluta de los datos. Los movimientos importados automáticamente desde correos de BCP
            e Interbank pueden contener errores de interpretación; siempre conviene contrastar
            contra el estado de cuenta oficial del banco antes de tomar decisiones importantes con
            esa información.
          </p>
        </section>

        <section>
          <div className="section-title">Limitación de responsabilidad</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            El dueño de la app no se hace responsable por pérdidas o decisiones tomadas a partir de
            la información mostrada en Wealth OS. La app es un apoyo de organización personal, no
            asesoría financiera.
          </p>
        </section>

        <section>
          <div className="section-title">Cambios</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            Estos términos pueden actualizarse en cualquier momento a medida que la app evoluciona.
            El uso continuado del servicio implica la aceptación de la versión vigente.
          </p>
        </section>

        <section>
          <div className="section-title">Contacto</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            <a href="mailto:iebs.1403@gmail.com" style={{ color: "var(--accent-strong)" }}>
              iebs.1403@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
