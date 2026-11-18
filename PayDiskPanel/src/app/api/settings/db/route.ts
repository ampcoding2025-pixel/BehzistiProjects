import { NextResponse } from "next/server";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import {
  AMAR_DB,
  DB_TARGETS,
  TEST_DB,
  type DbTargetId,
  getActiveDbLabel,
  getDbMode,
  isLabDb,
  preloadSqlDrivers,
  reloadActiveTargetFromDisk,
  resolveSchemaCaps,
  switchDbTarget,
  warmTargetInBackground,
} from "@/lib/db/pool";
import { labWritesEnabled } from "@/lib/lab/writes";
import { hqWritesEnabled, targetAllowsWrites } from "@/lib/db/config";

function warmPeers(active: DbTargetId) {
  // Only tedious peers — background ODBC/lab opens caused hung connects in the list
  for (const id of ["prod", "replica"] as DbTargetId[]) {
    if (id !== active) warmTargetInBackground(id);
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Kick native driver load early so lab switch is not charged for cold start
  preloadSqlDrivers();

  // Re-read disk so a stuck in-memory "test" can't freeze settings forever.
  // Never await a live SQL connect here.
  const target = await reloadActiveTargetFromDisk();
  const meta = DB_TARGETS[target];
  const schema = resolveSchemaCaps(target);
  warmPeers(target);

  const schemaNote =
    schema.hasMakeOverDefinitions && schema.hasTxnDefinitionId
      ? "اسکیما: کامل (MakeOverDefinitions)"
      : "اسکیما: AmarDB کلاسیک — نوع از PayedMakeOvers (بدون MakeOverDefinitions)";

  return NextResponse.json({
    ok: true,
    target,
    mode: getDbMode(),
    activeLabel: getActiveDbLabel(),
    labWrites: labWritesEnabled(),
    canSwitch: user.role === "admin",
    schema,
    targets: (Object.keys(DB_TARGETS) as DbTargetId[]).map((id) => {
      const t = DB_TARGETS[id];
      return {
        id: t.id,
        labelFa: t.labelFa,
        host: t.host,
        database: t.database,
        port: t.port,
        auth: t.auth,
        user: t.user,
        writable: t.writable,
        active: id === target,
      };
    }),
    amar: {
      host: AMAR_DB.host,
      database: AMAR_DB.database,
      port: AMAR_DB.port,
      user: AMAR_DB.user,
    },
    replica: {
      host: DB_TARGETS.replica.host,
      database: DB_TARGETS.replica.database,
      port: DB_TARGETS.replica.port,
      user: DB_TARGETS.replica.user,
    },
    test: {
      host: TEST_DB.host,
      database: TEST_DB.database,
    },
    note: [
      targetAllowsWrites(target)
        ? isLabDb(target)
          ? "اتصال فعلی: آزمایشی — نوشتن و محاسبه مجاز است."
          : `اتصال فعلی: ${meta.labelFa} — نوشتن/محاسبه فعال (HQ).`
        : target === "replica"
          ? "اتصال فعلی: رپلیکا — فقط خواندنی. برای نوشتن به تولید (155) سوییچ کنید."
          : hqWritesEnabled()
            ? `اتصال فعلی: ${meta.labelFa}.`
            : `اتصال فعلی: ${meta.labelFa} — فقط خواندنی (PAYDISK_HQ_WRITES خاموش است).`,
      schemaNote,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") {
    return forbidden("فقط ادمین می‌تواند دیتابیس فعال را عوض کند");
  }

  const body = (await req.json().catch(() => null)) as {
    target?: string;
  } | null;
  const raw = String(body?.target || "").toLowerCase();
  if (raw !== "prod" && raw !== "replica" && raw !== "test") {
    return NextResponse.json(
      { ok: false, message: "target باید prod | replica | test باشد" },
      { status: 400 },
    );
  }

  try {
    const result = await switchDbTarget(raw);
    warmPeers(result.target);
    const writes = targetAllowsWrites(result.target);
    return NextResponse.json({
      ok: true,
      target: result.target,
      activeLabel: result.label,
      mode: result.target,
      labWrites: writes,
      meta: result.meta,
      schema: result.schema,
      reused: !!result.reused,
      message: result.reused
        ? `فعال شد: ${result.meta.labelFa} · ${result.label}${writes ? " · نوشتن مجاز" : " · فقط خواندن"}`
        : `اتصال به ${result.meta.labelFa} برقرار شد · ${result.label}${writes ? " · نوشتن مجاز" : " · فقط خواندن"}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
