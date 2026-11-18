import { getDiskType } from "@/lib/catalog";
import type { DiskRequest, MakeOverUiType, PipelineStage } from "@/lib/types";
import { callArmaghan, execWhitelistedProc } from "./clients";
import { isLiveMode } from "./whitelist";

function pushLog(req: DiskRequest, line: string) {
  req.logTail = [...(req.logTail ?? []), `${new Date().toISOString()} ${line}`].slice(-60);
}

export type PipelineAction =
  | "register"
  | "calculate"
  | "list"
  | "excel"
  | "diskette"
  | "handoff_finance"
  | "mark_ready";

const STAGE_ORDER: PipelineStage[] = [
  "draft",
  "registered",
  "calculated",
  "listed",
  "excel_ready",
  "handed_to_finance",
  "done",
];

export function stageIndex(stage: PipelineStage | undefined) {
  return STAGE_ORDER.indexOf(stage || "draft");
}

export async function runPipelineAction(
  req: DiskRequest,
  action: PipelineAction,
): Promise<DiskRequest> {
  const disk = getDiskType(req.diskTypeId);
  if (!disk) {
    req.status = "failed";
    req.errorMessage = `Unknown disk type: ${req.diskTypeId}`;
    pushLog(req, req.errorMessage);
    return req;
  }

  req.status = "running";
  req.errorMessage = undefined;
  pushLog(req, `Pipeline ${action} · mode=${isLiveMode() ? "LIVE" : "dry-run"}`);

  try {
    if (action === "register") {
      if (req.armaghanTransactionId) {
        pushLog(req, `Skip register — using existing TrId=${req.armaghanTransactionId}`);
        req.pipelineStage = "registered";
        req.status = "queued";
        return req;
      }
      const reg = await callArmaghan("MakeOver/RegisterTransaction", { title: req.title });
      pushLog(req, `${reg.message}${reg.detail ? ` · ${reg.detail}` : ""}`);
      if (!reg.ok) {
        req.status = "failed";
        req.errorMessage = reg.message;
        return req;
      }
      req.armaghanTransactionId = Math.floor(900000 + Math.random() * 999);
      pushLog(req, `Assigned stub TransactionId=${req.armaghanTransactionId} (Armaghan جدید)`);
      req.pipelineStage = "registered";
      req.status = "queued";
      return req;
    }

    if (action === "calculate") {
      if (!req.armaghanTransactionId) {
        req.status = "failed";
        req.errorMessage = "ابتدا مرحله تراکنش (جدید) را انجام دهید";
        pushLog(req, req.errorMessage);
        return req;
      }

      if (disk.family === "mostamari") {
        for (const proc of disk.calcProcs) {
          if (!proc.startsWith("Calculate")) continue;
          const res = await execWhitelistedProc(proc as "CalculateTransaction", {
            TrId: req.armaghanTransactionId,
            period: req.periodLabel,
          });
          pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
          if (!res.ok) {
            req.status = "failed";
            req.errorMessage = res.message;
            return req;
          }
        }
        req.pipelineStage = "calculated";
        req.status = "queued";
        return req;
      }

      const uiType = (req.makeOverType || disk.makeOverType || "roozane") as MakeOverUiType;
      const supply =
        req.supplyLocationId ??
        disk.supplyLocationIds?.[0] ??
        -100;

      if (disk.calcProcs.includes("CalculateMarakezYarane") || supply > 0) {
        const res = await execWhitelistedProc("CalculateMarakezYarane", {
          TransactionId: req.armaghanTransactionId,
          SupplyLocationId: supply,
        });
        pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
        if (!res.ok) {
          req.status = "failed";
          req.errorMessage = res.message;
          return req;
        }
      }

      const calc = await callArmaghan("MakeOver/Calculate", {
        Id: req.armaghanTransactionId,
        TransactionId: req.armaghanTransactionId,
        Title: req.title,
        Type: uiType,
        SupplyLocationId: supply > 0 ? [supply] : [-100],
      });
      pushLog(req, `${calc.message}${calc.detail ? ` · ${calc.detail}` : ""}`);
      if (!calc.ok) {
        req.status = "failed";
        req.errorMessage = calc.message;
        return req;
      }
      req.pipelineStage = "calculated";
      req.status = "queued";
      return req;
    }

    if (action === "list") {
      if (!req.armaghanTransactionId) {
        req.status = "failed";
        req.errorMessage = "شناسه تراکنش لازم است";
        return req;
      }
      const list = await callArmaghan("Diskette/GetListMakeover", {
        id: req.armaghanTransactionId,
      });
      pushLog(req, `${list.message}${list.detail ? ` · ${list.detail}` : ""}`);
      if (!list.ok) {
        req.status = "failed";
        req.errorMessage = list.message;
        return req;
      }
      req.fileName =
        req.fileName ?? `stub-Marakez-CSV-Zihesab-${req.armaghanTransactionId}.csv`;
      req.pipelineStage = "listed";
      req.status = "ready";
      pushLog(req, `لیست افراد آماده (Key2 stub): ${req.fileName}`);
      return req;
    }

    if (action === "excel") {
      if (!req.armaghanTransactionId) {
        req.status = "failed";
        req.errorMessage = "شناسه تراکنش لازم است";
        return req;
      }
      req.fileName = req.fileName ?? `${req.id}-${disk.id}.xlsx`;
      req.pipelineStage = "excel_ready";
      req.status = "ready";
      pushLog(req, `Excel ready (stub): ${req.fileName}`);
      return req;
    }

    if (action === "diskette") {
      if (!req.armaghanTransactionId) {
        req.status = "failed";
        req.errorMessage = "شناسه تراکنش لازم است";
        return req;
      }
      const res = await callArmaghan("Diskette/GetMakeOver", {
        id: req.armaghanTransactionId,
      });
      pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
      if (!res.ok) {
        req.status = "failed";
        req.errorMessage = res.message;
        return req;
      }
      pushLog(req, "دیسکت بانک درخواست شد (معمولاً ادامه با مالی)");
      req.pipelineStage = "done";
      req.status = "handed_to_finance";
      return req;
    }

    if (action === "handoff_finance") {
      req.pipelineStage = "handed_to_finance";
      req.status = "handed_to_finance";
      pushLog(req, "تحویل به واحد مالی — مطابق خواسته مدیر برای یارانه");
      return req;
    }

    if (action === "mark_ready") {
      req.pipelineStage = "done";
      req.status = "ready";
      pushLog(req, "وضعیت آماده ثبت شد");
      return req;
    }

    req.status = "failed";
    req.errorMessage = `Unknown pipeline action: ${action}`;
    return req;
  } catch (err) {
    req.status = "failed";
    req.errorMessage = err instanceof Error ? err.message : String(err);
    pushLog(req, `ERROR ${req.errorMessage}`);
    return req;
  }
}
