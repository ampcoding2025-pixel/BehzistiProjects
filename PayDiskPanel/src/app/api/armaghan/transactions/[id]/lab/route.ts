import { NextResponse } from "next/server";
import { canRunWorker } from "@/lib/auth/users";
import { forbidden, getSessionUser, unauthorized } from "@/lib/auth/http";
import { getDbMode, getDbTarget, isLabDb } from "@/lib/db/pool";
import {
  defaultLabBankFile,
  defaultLabListFile,
  labCalculateYarane,
  labUpdateKey2,
  labUpdateKey3,
  labWritesEnabled,
} from "@/lib/lab/writes";

type Body = {
  action?: string;
  supplyLocationId?: number;
  key2?: string | null;
  key3?: string | null;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({
    ok: true,
    labWrites: labWritesEnabled(),
    dbMode: getDbMode(),
    db: getDbTarget(),
    note: labWritesEnabled()
      ? isLabDb()
        ? "Lab: CalculateMarakezYarane + UPDATE Key2/Key3 مجاز است"
        : "تولید (155): نوشتن/محاسبه با حساب write فعال است"
      : "اتصال فعلی فقط خواندنی است — lab را انتخاب کنید یا PAYDISK_HQ_WRITES را برای 155 روشن کنید",
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canRunWorker(user.role)) return forbidden("فقط اپراتور/ادمین");

  if (!labWritesEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Write/EXEC روی این دیتابیس فعال نیست — lab یا تولید (155) با دسترسی نوشتن",
        db: getDbTarget(),
      },
      { status: 403 },
    );
  }

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "شناسه نامعتبر" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const action = body.action || "";
  try {
    let result;
    switch (action) {
      case "calculate_yarane": {
        const supply = Number(body.supplyLocationId);
        result = await labCalculateYarane(id, supply);
        break;
      }
      case "mark_list": {
        const key2 =
          body.key2 === null
            ? null
            : (body.key2 && String(body.key2).trim()) || defaultLabListFile(id);
        result = await labUpdateKey2(id, key2);
        break;
      }
      case "clear_list":
        result = await labUpdateKey2(id, null);
        break;
      case "mark_bank": {
        const key3 =
          body.key3 === null
            ? null
            : (body.key3 && String(body.key3).trim()) || defaultLabBankFile(id);
        result = await labUpdateKey3(id, key3);
        break;
      }
      case "clear_bank":
        result = await labUpdateKey3(id, null);
        break;
      default:
        return NextResponse.json(
          {
            ok: false,
            message:
              "action نامعتبر — یکی از: calculate_yarane | mark_list | clear_list | mark_bank | clear_bank",
          },
          { status: 400 },
        );
    }

    return NextResponse.json({
      ok: true,
      db: getDbTarget(),
      dbMode: getDbMode(),
      by: user.username,
      result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        db: getDbTarget(),
      },
      { status: 500 },
    );
  }
}
