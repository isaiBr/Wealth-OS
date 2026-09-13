import { NextRequest, NextResponse } from "next/server";
import { crearOAuthClient } from "@/gmail/client";

// Recibe el "code" de Google, lo cambia por tokens, y muestra el
// refresh_token en pantalla para copiarlo a mano a GOOGLE_REFRESH_TOKEN en
// .env.local. No se guarda nada acá — es un paso manual de una sola vez.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`Google devolvió un error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Falta el parámetro 'code' en la URL", { status: 400 });
  }

  const oauth2Client = crearOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    return new NextResponse(
      "No se recibió refresh_token (Google solo lo emite en la primera autorización " +
        "de esta app). Ve a https://myaccount.google.com/permissions, quita el acceso " +
        "de 'Wealth OS' y vuelve a visitar /api/auth/gmail/start.",
      { status: 400 }
    );
  }

  return new NextResponse(
    `Listo. Copia este valor a GOOGLE_REFRESH_TOKEN en .env.local:\n\n${tokens.refresh_token}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
