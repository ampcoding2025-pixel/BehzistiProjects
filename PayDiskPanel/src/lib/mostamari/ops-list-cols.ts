/** Client-safe ops list column catalog (no DB imports). */

/**
 * Ops-doc «تهیه لیست مستمری بگیران» — Excel/CSV column aliases (exact names).
 */
export const MOSTAMARI_OPS_LIST_COLS = [
  "NIDMadadjo",
  "BirthDate",
  "FirstName",
  "LastName",
  "IsIranian",
  "Bank",
  "ProvinceTitle",
  "CityTitle",
  "CenterTitle",
  "AccountNumber",
  "sheba",
  "NIDSahebHesab",
  "Money",
  "Marhale",
  "mobile",
  "madadjotype",
  "khanevar_dim",
  "PersonId",
] as const;

export type MostamariOpsListCol = (typeof MOSTAMARI_OPS_LIST_COLS)[number];

export const MOSTAMARI_OPS_LIST_COL_FA: Record<MostamariOpsListCol, string> = {
  NIDMadadjo: "کد ملی مددجو",
  BirthDate: "تاریخ تولد",
  FirstName: "نام",
  LastName: "نام خانوادگی",
  IsIranian: "ایرانی",
  Bank: "بانک",
  ProvinceTitle: "استان",
  CityTitle: "شهر",
  CenterTitle: "مرکز",
  AccountNumber: "شماره حساب",
  sheba: "شبا",
  NIDSahebHesab: "کد ملی صاحب حساب",
  Money: "مبلغ",
  Marhale: "مرحله",
  mobile: "موبایل",
  madadjotype: "نوع مددجو",
  khanevar_dim: "بعد خانوار",
  PersonId: "شناسه شخص",
};
