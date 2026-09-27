import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { briefs } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function BriefHistorialPage() {
  const rows = await db
    .select({ date: briefs.date })
    .from(briefs)
    .orderBy(desc(briefs.date));

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-title">Historial</div>
        <div className="screen-sub">Briefs anteriores</div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-note">Todavía no hay briefs generados.</p>
      ) : (
        <div className="brief-historial-list">
          {rows.map((r) => (
            <Link key={r.date} href={`/brief/historial/${r.date}`} className="brief-historial-item">
              {r.date}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
