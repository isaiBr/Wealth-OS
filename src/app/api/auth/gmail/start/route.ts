import { NextResponse } from "next/server";
import { crearOAuthClient, GMAIL_SCOPES } from "@/gmail/client";

// Arranca el flujo de autorización de Gmail — se visita a mano, una sola
// vez, desde el navegador ya logueado con la cuenta de Gmail a conectar.
export async function GET() {
  const oauth2Client = crearOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // fuerza a Google a emitir refresh_token siempre, no solo la primera vez
    scope: GMAIL_SCOPES,
  });
  return NextResponse.redirect(url);
}
