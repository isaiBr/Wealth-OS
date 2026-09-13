import { NextResponse } from "next/server";
import { iniciarOrRenovarWatch } from "@/gmail/watch";

// Se visita a mano UNA vez para arrancar Gmail Push (protegido por Clerk,
// como el resto del dashboard). El cron semanal usa la misma lógica pero
// por /api/cron/gmail-watch-renew, con su propio secreto.
export async function GET() {
  const resultado = await iniciarOrRenovarWatch();
  return NextResponse.json(resultado);
}
