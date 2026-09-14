import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailSyncState } from "@/db/schema";
import { crearGmailClient } from "@/gmail/client";
import { mensajeARawEmail } from "@/gmail/mensaje";
import { procesarCorreo } from "@/gmail/procesar";
import { ejecutarMotorTransferencias } from "@/db/queries";

interface PubSubPushBody {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
}

async function obtenerUltimoHistoryId(): Promise<string | null> {
  const fila = await db.select().from(gmailSyncState).orderBy(desc(gmailSyncState.id)).limit(1).get();
  return fila?.historyId ?? null;
}

// No hay soporte multi-moneda ni multi-mes especial acá — solo se recorre
// lo nuevo desde el último historyId conocido, se inserta, y se corre el
// motor de matching del mes actual (roadmap §4) sobre lo recién insertado.
export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== process.env.GMAIL_WEBHOOK_SECRET) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const body = (await request.json()) as PubSubPushBody;
  const dataB64 = body.message?.data;
  if (!dataB64) return NextResponse.json({ ok: true, nota: "sin data" });

  const payload = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8")) as {
    emailAddress: string;
    historyId: string | number;
  };
  const historyIdNuevo = String(payload.historyId);

  const historyIdAnterior = await obtenerUltimoHistoryId();
  if (!historyIdAnterior) {
    // Primera notificación desde que se llamó watch() por primera vez — no
    // hay punto de partida para comparar, solo se guarda como base.
    await db.insert(gmailSyncState).values({ historyId: historyIdNuevo });
    return NextResponse.json({ ok: true, nota: "primera sincronización, sin correos por procesar todavía" });
  }

  const gmail = crearGmailClient();
  const idsVistos = new Set<string>();
  const resultados = { insertadas: 0, omitidas: 0, duplicadas: 0 };

  // El historyId de la notificación push puede ir por delante de lo que
  // history.list ya tiene indexado (retraso de propagación de Gmail) — si
  // guardáramos ese valor como nuevo punto de partida, un correo que llegó
  // casi al mismo tiempo (p.ej. dos consumos seguidos con la tarjeta) podría
  // no aparecer todavía en este list() y quedaría saltado para siempre. Por
  // eso el nuevo checkpoint se toma del propio historyId que devuelve
  // history.list (lo que realmente se procesó), no del payload.
  let historyIdProcesado: string | null = null;

  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyIdAnterior,
      historyTypes: ["messageAdded"],
      pageToken,
    });

    if (data.historyId) historyIdProcesado = data.historyId;

    for (const registro of data.history ?? []) {
      for (const agregado of registro.messagesAdded ?? []) {
        const id = agregado.message?.id;
        if (!id || idsVistos.has(id)) continue;
        idsVistos.add(id);

        const { data: mensaje } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const rawEmail = mensajeARawEmail(mensaje);
        if (!rawEmail) {
          resultados.omitidas++;
          continue;
        }

        const resultado = await procesarCorreo(rawEmail, id);
        if (resultado.estado === "insertada") resultados.insertadas++;
        else if (resultado.estado === "duplicada") resultados.duplicadas++;
        else resultados.omitidas++;
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  if (resultados.insertadas > 0) {
    const mesActual = new Date().toISOString().slice(0, 7);
    await ejecutarMotorTransferencias(mesActual);
  }

  await db.insert(gmailSyncState).values({ historyId: historyIdProcesado ?? historyIdNuevo });

  return NextResponse.json({ ok: true, ...resultados });
}
