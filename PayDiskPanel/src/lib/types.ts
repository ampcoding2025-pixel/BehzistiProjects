export type DiskFamily = "mostamari" | "yarane";

export type RequestStatus =
  | "queued"
  | "running"
  | "ready"
  | "handed_to_finance"
  | "failed"
  | "cancelled";

/** Mirrors Armaghan makeover pipeline progress inside PayDiskPanel. */
export type PipelineStage =
  | "draft"
  | "registered"
  | "calculated"
  | "listed"
  | "excel_ready"
  | "handed_to_finance"
  | "done";

export type UserRole = "operator" | "finance_viewer" | "admin";

export type CalcKind =
  | "CalculateTransaction"
  | "CalculateHadafmandi"
  | "CalculateHaghParastariFamily"
  | "CalculateHaghParastari"
  | "CalculateEmdad"
  | "CalculateMarakezYarane"
  | "MakeOver.Calculate"
  | "MakeOver.GetListMakeover"
  | "MakeOver.GetMakeOver";

export type MakeOverUiType =
  | "shabane"
  | "roozane"
  | "moraghebat"
  | "visit"
  | "etiad"
  | "list"
  | "diskette";

export interface DiskType {
  id: string;
  family: DiskFamily;
  titleFa: string;
  description: string;
  /** Armaghan calc.html «نوع محاسبه» value */
  makeOverType?: MakeOverUiType;
  /** SQL SupplyLocationId for CalculateMarakezYarane */
  supplyLocationIds?: number[];
  calcProcs: CalcKind[];
  /** Ordered steps shown in the new-request UI */
  scriptSteps: string[];
  /** Existing Armaghan TrId required (list / diskette / re-run) */
  requiresExistingTransaction?: boolean;
  /** What the panel delivers to the requester */
  output: "excel_download" | "finance_handoff" | "person_list_csv";
  notes?: string;
  groupFa?: string;
}

export interface DiskRequest {
  id: string;
  diskTypeId: string;
  title: string;
  periodLabel: string;
  requestedBy: string;
  requestedAt: string;
  status: RequestStatus;
  armaghanTransactionId?: number;
  /** Chosen Armaghan calc.html Type for this run */
  makeOverType?: MakeOverUiType;
  /** Chosen MakeOverSupplyLocationId for CalculateMarakezYarane */
  supplyLocationId?: number;
  pipelineStage?: PipelineStage;
  fileName?: string;
  errorMessage?: string;
  logTail?: string[];
}

export interface GapItem {
  id: string;
  severity: "blocker" | "needed" | "nice";
  title: string;
  detail: string;
}
