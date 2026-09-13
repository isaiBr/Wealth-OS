import { crearGmailClient } from "@/gmail/client";
import { db } from "@/db/client";
import { gmailSyncState } from "@/db/schema";

const GMAIL_LABEL_IDS = ["INBOX"];

/**
 * Arranca (o renueva) el watch() de Gmail Push — expira cada 7 días, por
 * eso el cron semanal lo vuelve a llamar. Guarda el historyId devuelto como
 * nuevo punto de partida para el webhook.
 */
export async function iniciarOrRenovarWatch() {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) throw new Error("Falta GMAIL_PUBSUB_TOPIC en el entorno");

  const gmail = crearGmailClient();
  const { data } = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName, labelIds: GMAIL_LABEL_IDS },
  });

  if (data.historyId) {
    await db.insert(gmailSyncState).values({ historyId: data.historyId });
  }

  return { historyId: data.historyId ?? null, expiration: data.expiration ?? null };
}
