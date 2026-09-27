import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { briefs } from "@/db/schema";
import { briefSchema } from "@/lib/brief/brief-schema";
import { BriefView } from "../../BriefView";

export const dynamic = "force-dynamic";

export default async function BriefHistorialDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.date, date))
    .limit(1);

  if (!row) {
    notFound();
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <Link href="/brief/historial" className="text-link">
          ← Historial
        </Link>
        <div className="screen-title" style={{ marginTop: 10 }}>
          Brief del {date}
        </div>
      </div>
      <BriefView brief={briefSchema.parse(JSON.parse(row.rawJson))} />
    </div>
  );
}
