import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { briefs } from "@/db/schema";
import { briefSchema } from "@/lib/brief/brief-schema";
import { todayInLima } from "@/lib/brief/dates";
import { BriefView } from "./BriefView";

export const dynamic = "force-dynamic";

export default async function BriefHoyPage() {
  const date = todayInLima();

  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.date, date))
    .limit(1);

  const [latest] = row
    ? []
    : await db
        .select({ date: briefs.date })
        .from(briefs)
        .orderBy(desc(briefs.date))
        .limit(1);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Hoy</div>
        <div className="screen-sub">Brief del {date}</div>
      </div>

      {row ? (
        <BriefView brief={briefSchema.parse(JSON.parse(row.rawJson))} />
      ) : (
        <div className="card">
          <p className="brief-story-title">Aún no hay brief para hoy ({date})</p>
          <p className="brief-story-summary">
            El brief se genera todos los días a las 6:00 a.m. hora de Lima. Vuelve a
            revisar en un rato.
          </p>
          {latest && (
            <p className="brief-story-summary">
              Mientras tanto, puedes ver el{" "}
              <Link href={`/brief/historial/${latest.date}`} className="text-link">
                último brief disponible ({latest.date})
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
