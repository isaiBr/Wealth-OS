import { NextRequest, NextResponse } from "next/server";
import { iniciarOrRenovarWatch } from "@/gmail/watch";

// Llamado por Vercel Cron (ver vercel.json) — no pasa por Clerk (excluido
// en proxy.ts), se autentica con el header que Vercel agrega automáticamente
// cuando CRON_SECRET está configurado.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const resultado = await iniciarOrRenovarWatch();
  return NextResponse.json(resultado);
}
