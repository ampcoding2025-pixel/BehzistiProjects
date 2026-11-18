/** Only these SQL procedures may ever be invoked by the worker. */
export const ALLOWED_SQL_PROCS = [
  "CalculateTransaction",
  "CalculateHadafmandi",
  "CalculateHaghParastariFamily",
  "CalculateHaghParastari",
  "CalculateEmdad",
  "CalculateMarakezYarane",
  /** یارانه list CSV → \\sqlcluster\...\Diskette + Key2 (same as Armaghan) */
  "ListExporMarakez",
  /** مستمری bank diskette → \\sqlcluster\...\Diskette + PayedTransaction.FileName (same as Armaghan) */
  "Export",
] as const;

export type AllowedSqlProc = (typeof ALLOWED_SQL_PROCS)[number];

/** Only these Armaghan HTTP operations may be invoked. */
export const ALLOWED_ARMAGHAN_OPS = [
  "MakeOver/GetPayedTransaction",
  "MakeOver/RegisterTransaction",
  "MakeOver/Calculate",
  "Diskette/GetListMakeover",
  "Diskette/GetMakeOver",
] as const;

export type AllowedArmaghanOp = (typeof ALLOWED_ARMAGHAN_OPS)[number];

export function assertSqlProc(name: string): asserts name is AllowedSqlProc {
  if (!(ALLOWED_SQL_PROCS as readonly string[]).includes(name)) {
    throw new Error(`SQL procedure not whitelisted: ${name}`);
  }
}

export function assertArmaghanOp(name: string): asserts name is AllowedArmaghanOp {
  if (!(ALLOWED_ARMAGHAN_OPS as readonly string[]).includes(name)) {
    throw new Error(`Armaghan op not whitelisted: ${name}`);
  }
}

export function isLiveMode() {
  return process.env.PAYDISK_LIVE === "true";
}
