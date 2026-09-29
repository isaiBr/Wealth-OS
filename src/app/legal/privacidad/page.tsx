export const metadata = {
  title: "Política de privacidad — Wealth OS",
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Política de privacidad</div>
        <div className="screen-sub">Última actualización: 28 de septiembre de 2026</div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <section>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6 }}>
            Wealth OS es una aplicación personal de finanzas y organización de uso privado, operada
            por su dueño para su propio uso y el de un número reducido de personas invitadas
            directamente por él. No es un producto comercial ni está abierta al público general.
          </p>
        </section>

        <section>
          <div className="section-title">Qué datos recopila</div>
          <ul style={{ fontSize: "13.5px", lineHeight: 1.6, paddingLeft: "18px", marginTop: "6px" }}>
            <li>Datos de cuenta (nombre, correo) provistos por el proveedor de autenticación (Clerk) al iniciar sesión.</li>
            <li>Datos financieros que el usuario ingresa manualmente: cuentas, movimientos, presupuestos.</li>
            <li>
              Acceso de solo lectura a la bandeja de Gmail de la cuenta del dueño de la app (scope{" "}
              <code>gmail.readonly</code>), usado exclusivamente para leer las notificaciones
              automáticas de movimientos que envían BCP e Interbank y convertirlas en transacciones
              dentro de la app. La aplicación nunca envía, modifica ni elimina correos.
            </li>
          </ul>
        </section>

        <section>
          <div className="section-title">Cómo se usan los datos</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            Los datos se usan únicamente para generar el panel financiero y los resúmenes dentro de
            la propia app. No se usan con fines publicitarios, no se venden ni se comparten con
            terceros para ningún otro propósito.
          </p>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "8px" }}>
            El uso y la transferencia de información recibida de las APIs de Google por parte de
            Wealth OS cumplen con la{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-strong)" }}
            >
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de Uso Limitado.
          </p>
        </section>

        <section>
          <div className="section-title">Con quién se comparte</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            Solo con los proveedores de infraestructura necesarios para operar la app: hosting
            (Vercel), base de datos (Turso), autenticación (Clerk) y las APIs de Google usadas para
            leer Gmail. Ninguno de ellos usa estos datos para fines propios.
          </p>
        </section>

        <section>
          <div className="section-title">Cómo revocar el acceso</div>
          <p style={{ fontSize: "13.5px", lineHeight: 1.6, marginTop: "6px" }}>
            El acceso de Wealth OS a Gmail se puede revocar en cualquier momento desde{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-strong)" }}
            >
              myaccount.google.com/permissions
            </a>
            . Para pedir la eliminación de tus datos dentro de la app, escribe al correo de
            contacto abajo.
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
