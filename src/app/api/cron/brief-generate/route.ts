import { NextRequest, NextResponse } from "next/server";
import { generarYGuardarBrief } from "@/lib/brief/generate-brief";
import { todayInLima } from "@/lib/brief/dates";

export const dynamic = "force-dynamic";

// Llamado por Vercel Cron (ver vercel.json) — no pasa por Clerk (excluido en
// proxy.ts), se autentica con el mismo CRON_SECRET que gmail-watch-renew.
//
// Con el pipeline de RSS + Haiku (ver generate-brief.ts, §2.12 del plan) esto
// corre en segundos, no minutos como el enfoque viejo con web_search — entra
// sin problema en el límite de 60s que ya da el plan Hobby de Vercel, sin
// necesitar Pro.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const date = todayInLima();
  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const resultado = await generarYGuardarBrief(date, force);
    return NextResponse.json({ ...resultado, date });
  } catch (error) {
    console.error(`brief-generate failed for ${date}:`, error);
    return NextResponse.json({ status: "error", date, message: (error as Error).message }, { status: 500 });
  }
}
