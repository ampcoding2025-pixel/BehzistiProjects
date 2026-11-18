import { getDiskType } from "@/lib/catalog";
import type { DiskRequest } from "@/lib/types";
import { callArmaghan, execWhitelistedProc } from "./clients";
import { isLiveMode } from "./whitelist";

function pushLog(req: DiskRequest, line: string) {
  req.logTail = [...(req.logTail ?? []), `${new Date().toISOString()} ${line}`].slice(-40);
}

export async function runDiskJob(req: DiskRequest): Promise<DiskRequest> {
  const disk = getDiskType(req.diskTypeId);
  if (!disk) {
    req.status = "failed";
    req.errorMessage = `Unknown disk type: ${req.diskTypeId}`;
    pushLog(req, req.errorMessage);
    return req;
  }

  req.status = "running";
  req.errorMessage = undefined;
  pushLog(req, `Worker start · mode=${isLiveMode() ? "LIVE" : "dry-run"} · family=${disk.family}`);

  try {
    if (disk.family === "mostamari") {
      for (const proc of disk.calcProcs) {
        if (!proc.startsWith("Calculate")) continue;
        const res = await execWhitelistedProc(proc as "CalculateTransaction", {
          TrId: req.armaghanTransactionId ?? 0,
          period: req.periodLabel,
        });
        pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
        if (!res.ok) {
          req.status = "failed";
          req.errorMessage = res.message;
          return req;
        }
      }
      req.fileName = req.fileName ?? `${req.id}-${disk.id}.xlsx`;
      req.status = "ready";
      pushLog(req, `Excel ready (stub): ${req.fileName}`);
      return req;
    }

    // یارانه — mirrors Armaghan: جدید=title, then نوع محاسبه
    if (disk.requiresExistingTransaction && !req.armaghanTransactionId) {
      req.status = "failed";
      req.errorMessage = "این نوع به شناسه تراکنش موجود نیاز دارد";
      pushLog(req, req.errorMessage);
      return req;
    }

    if (!req.armaghanTransactionId) {
      const reg = await callArmaghan("MakeOver/RegisterTransaction", { title: req.title });
      pushLog(req, `${reg.message}${reg.detail ? ` · ${reg.detail}` : ""}`);
      if (!reg.ok) {
        req.status = "failed";
        req.errorMessage = reg.message;
        return req;
      }
      req.armaghanTransactionId =
        req.armaghanTransactionId ?? Math.floor(900000 + Math.random() * 999);
      pushLog(req, `Assigned stub TransactionId=${req.armaghanTransactionId}`);
    } else {
      pushLog(req, `Using existing TransactionId=${req.armaghanTransactionId}`);
    }

    const uiType = disk.makeOverType;

    if (uiType === "diskette") {
      const res = await callArmaghan("Diskette/GetMakeOver", {
        id: req.armaghanTransactionId,
      });
      pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
      if (!res.ok) {
        req.status = "failed";
        req.errorMessage = res.message;
        return req;
      }
      req.status = "handed_to_finance";
      pushLog(req, "Bank diskette requested — finance owns final file");
      return req;
    }

    if (uiType === "list") {
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
      req.status = "ready";
      pushLog(req, `CSV ready (stub): ${req.fileName}`);
      return req;
    }

    if (disk.calcProcs.includes("CalculateMarakezYarane")) {
      const supply = disk.supplyLocationIds?.[0] ?? -100;
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

    if (disk.calcProcs.includes("MakeOver.Calculate") || uiType) {
      const res = await callArmaghan("MakeOver/Calculate", {
        Id: req.armaghanTransactionId,
        TransactionId: req.armaghanTransactionId,
        Title: req.title,
        Type: uiType ?? "list",
        SupplyLocationId: disk.supplyLocationIds?.length
          ? disk.supplyLocationIds
          : [-100],
      });
      pushLog(req, `${res.message}${res.detail ? ` · ${res.detail}` : ""}`);
      if (!res.ok) {
        req.status = "failed";
        req.errorMessage = res.message;
        return req;
      }
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

    if (disk.output === "person_list_csv") {
      req.fileName =
        req.fileName ?? `stub-Marakez-CSV-Zihesab-${req.armaghanTransactionId}.csv`;
      req.status = "ready";
      pushLog(req, `CSV ready (stub): ${req.fileName}`);
      return req;
    }

    req.status = "handed_to_finance";
    pushLog(req, "Handed to finance — bank diskette stays outside this panel");
    return req;
  } catch (err) {
    req.status = "failed";
    req.errorMessage = err instanceof Error ? err.message : String(err);
    pushLog(req, `ERROR ${req.errorMessage}`);
    return req;
  }
}
