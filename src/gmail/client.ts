import { google } from "googleapis";

// Alcance de solo lectura — el pipeline solo necesita leer las notificaciones
// de BCP/Interbank, nunca modificar ni borrar correos.
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

/**
 * Cliente OAuth2 para la cuenta de Gmail única del usuario (Fase 1 del
 * roadmap — no es multi-tenant). El refresh token se obtiene una sola vez
 * vía /api/auth/gmail/start y se guarda a mano en .env.local.
 */
export function crearOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_OAUTH_REDIRECT_URI en el entorno");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Cliente ya autenticado con el refresh token guardado — para llamar a la Gmail API. */
export function crearGmailClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("Falta GOOGLE_REFRESH_TOKEN en el entorno — corre el flujo de /api/auth/gmail/start primero");
  }

  const oauth2Client = crearOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
