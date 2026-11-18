/**
 * Active MakeOverSupplyLocation rows from AmarDB (read 2026-11-14).
 * Used as selectable یارانه subtypes when running CalculateMarakezYarane.
 */
export type SupplyLocation = {
  id: number;
  titleFa: string;
  keyword: string | null;
  groupId: number;
  budget: number;
};

const RAW: SupplyLocation[] = [
  { id: 2, titleFa: "یارانه مراکز غیر دولتی شبانه روزی توانبخشی", keyword: "YaraneShabane", groupId: 1, budget: 7950457000000 },
  { id: 3, titleFa: "یارانه فرزندان نگهداری شده در مراکز کودکان و نوجوانان", keyword: "YaraneKoodakan", groupId: 2, budget: 534115000000 },
  { id: 4, titleFa: "یارانه مراکز غیر دولتی همکار با دفتر زنان", keyword: "zanan", groupId: 3, budget: 32746500000 },
  { id: 5, titleFa: "یارانه مراکز درمان اعتیاد ماده 16", keyword: "ETIAD-MADE16", groupId: 0, budget: 0 },
  { id: 7, titleFa: "یارانه مراکز ارائه خدمات توانبخشی در منزل", keyword: "KhadamatDarManzel", groupId: 4, budget: 784680000000 },
  { id: 8, titleFa: "یارانه مراکز مراقبت در منزل", keyword: "MoraghebatDarManzel", groupId: 5, budget: 735600000000 },
  { id: 9, titleFa: "یارانه مراکز غیر دولتی روزانه توانبخشی", keyword: "rozaneh", groupId: 0, budget: 65365000000000 },
  { id: 10, titleFa: "یک وعده غذای گرم روستا مهدها و مهدهای حاشیه شهر", keyword: "GhazaGharm", groupId: 7, budget: 231685146000 },
  { id: 12, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی معلولان ذهنی", keyword: "rozaneh-zehni", groupId: 12, budget: 50221554000 },
  { id: 13, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی چند معلولیتی", keyword: "rozaneh-gandmalolyat", groupId: 13, budget: 3019350000 },
  { id: 14, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی معلولان جسمی حرکتی", keyword: "rozaneh-jecmikarekati", groupId: 14, budget: 18912001000 },
  { id: 15, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی معلولان ضایعه نخاعی", keyword: "rozaneh-zaenokhai", groupId: 15, budget: 4316400000 },
  { id: 16, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی معلولان کم‌بینا/نابینا", keyword: "rozaneh-kambena", groupId: 16, budget: 1926710000 },
  { id: 17, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی معلولان کم‌شنوا/ناشنوا", keyword: "rozaneh-shenava", groupId: 17, budget: 1628616000 },
  { id: 18, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی سالمندان", keyword: "rozaneh-salmand", groupId: 18, budget: 25266415000 },
  { id: 19, titleFa: "یارانه مراکز روزانه آموزشی و توانبخشی بیماران روانی مزمن", keyword: "rozaneh-ravan", groupId: 19, budget: 1426716000 },
  { id: 20, titleFa: "یارانه مراکز روزانه حرفه‌آموزی معلولین", keyword: "rozaneh-herfeh", groupId: 20, budget: 59542872000 },
  { id: 21, titleFa: "یارانه مراکز روزانه آموزش توانبخشی اختلالات طیف اتیسم", keyword: "rozaneh-otesm", groupId: 21, budget: 19191900000 },
  { id: 22, titleFa: "یارانه مراکز روزانه حرفه‌ای معلولین و کارگاه تولیدی", keyword: "rozaneh-kargah", groupId: 22, budget: 21593280000 },
  { id: 23, titleFa: "یارانه مراکز همکار با دفتر کودکان و نوجوانان", keyword: "hamkar-mahd", groupId: 0, budget: 4380000000 },
  { id: 25, titleFa: "یارانه خانه‌های حمایتی توانبخشی سالمندان", keyword: "Hemayati-salmand", groupId: 23, budget: 92400000000 },
  { id: 27, titleFa: "یارانه مرکز کاهش آسیب گذری (DIC)", keyword: "etyad-DIC", groupId: 25, budget: 162200000000 },
  { id: 28, titleFa: "یارانه مرکز کاهش آسیب اعتیاد سیار (موبایل)", keyword: "etyad-mobael", groupId: 26, budget: 289000000000 },
  { id: 29, titleFa: "یارانه مرکز سرپناه شبانه اعتیاد (shelter)", keyword: "etyad-shelter", groupId: 27, budget: 196000000000 },
  { id: 30, titleFa: "یارانه مرکز ایستگاه کاهش آسیب (کانکس)", keyword: "etyad-kaneks", groupId: 28, budget: 313000000000 },
  { id: 31, titleFa: "یارانه تیم سیار مستقل", keyword: "etyad - sayarMobel", groupId: 29, budget: 20000000000 },
  { id: 32, titleFa: "یارانه مرکز کاهش آسیب گذری همراه با سرپناه شبانه", keyword: "etyad-mostaghel", groupId: 30, budget: 280500000000 },
  { id: 35, titleFa: "یارانه خانه‌های حمایتی بیماران روانی مزمن", keyword: "Hemayati - Mozmen", groupId: 33, budget: 123900000000 },
  { id: 36, titleFa: "یارانه مراکز اقامتی بهبود و بازتوانی اختلال مصرف مواد", keyword: "etyad-eghamatiBehbod", groupId: 35, budget: 3079666667 },
  { id: 37, titleFa: "یارانه مراکز اقامتی بلندمدت اجتماع درمان‌مدار (TC)", keyword: "etyad-TC", groupId: 36, budget: 1038000000 },
  { id: 38, titleFa: "یارانه مرکز درمان سرپایی وابستگی به مواد", keyword: "etyad-darmanCarepaei", groupId: 37, budget: 521000000 },
  { id: 39, titleFa: "یارانه مراکز توانمندسازی و صیانت اجتماعی بهبودیافتگان اعتیاد", keyword: "etyad-cyanat", groupId: 38, budget: 822000000000 },
  { id: 40, titleFa: "یارانه مرکز جامع درمان و بازتوانی اعتیاد", keyword: "etyad-jameEtyad", groupId: 39, budget: 7750000000 },
  { id: 41, titleFa: "یارانه مرکز مادر و کودک", keyword: "etyad-madarVaKodak", groupId: 40, budget: 333333333 },
  { id: 43, titleFa: "یارانه مرکز مدیریت مورد", keyword: "etyad-modryatMored", groupId: 42, budget: 878000000000 },
  { id: 44, titleFa: "یارانه باشگاه مثبت (ایدز)", keyword: "etyad-ayds", groupId: 43, budget: 230000000000 },
  { id: 45, titleFa: "یارانه مرکز دهان، بلع و تغذیه", keyword: "DahanVaBale", groupId: 44, budget: 2946900000 },
  { id: 46, titleFa: "مراکز پشتیبانی شغلی (SE)", keyword: "SE", groupId: 745, budget: 3449600000 },
  { id: 47, titleFa: "یارانه مراکز غیر اقامتی اجتماع درمان‌مدار (TC)", keyword: "etyad_tc_g", groupId: 45, budget: 400000000 },
  { id: 50, titleFa: "برنامه توانبخشی مبتنی بر جامعه شهری (CBR)", keyword: "CBR", groupId: 46, budget: 660000000000 },
  { id: 51, titleFa: "برنامه توانبخشی مبتنی بر جامعه (CBR) روستایی", keyword: "CBR_ Village", groupId: 46, budget: 2430000000000 },
  { id: 52, titleFa: "برنامه توانبخشی مبتنی بر جامعه (CBR) — اتباع", keyword: "CBR-Foreigners", groupId: 46, budget: 0 },
  { id: 60, titleFa: "یارانه کمک‌هزینه ایاب و ذهاب به مراکز غیردولتی روزانه", keyword: "rozaneh_ayabZahab", groupId: 0, budget: 24674314460000 },
  { id: 65, titleFa: "یارانه مرکز ارائه خدمات توانبخشی و مراقبتی در منزل", keyword: "KhadamatVaMoraghebatDarManzel", groupId: 1005, budget: 84000000000 },
  { id: 66, titleFa: "یارانه کمک‌هزینه بهبود تغذیه خدمت‌گیرندگان مراکز روزانه", keyword: "rozaneh_behboodTaghzieh", groupId: 0, budget: 24674314460000 },
  { id: 94, titleFa: "تیم سیار وابسته", keyword: "GET.BUDGET.timesayarvabaste", groupId: 0, budget: 164400000000 },
  { id: 95, titleFa: "پیشگیری از اچ‌آی‌وی در گروه تراجنسیتی", keyword: "GET.BUDGET.pishgirihivgorohetarajensiyati", groupId: 0, budget: 20000000000 },
  { id: 96, titleFa: "طرح اچ‌آی‌وی در کودکان کار و خیابان", keyword: "GET.BUDGET.HIVkodakankarvakheyaban", groupId: 0, budget: 10000000000 },
  { id: 98, titleFa: "حمایت اجتماعی-توانمندسازی زنان با رفتار پرخطر", keyword: "GET.BUDGET.zananbaraftareporkhatar", groupId: 0, budget: 20000000000 },
  { id: 100, titleFa: "واحد گذری همراه با متادون", keyword: "GET.BUDGET.Metadon", groupId: 0, budget: 132200000000 },
  { id: 101, titleFa: "واحد گذری/سرپناه شبانه همراه با متادون", keyword: "GET.BUDGET.ShelterMetadon", groupId: 0, budget: 82700000000 },
  { id: 104, titleFa: "یارانه ماهیانه نگهداری از فرزندان کمتر از ۱۲ سال", keyword: "farzandanKamtaraz12", groupId: 1001, budget: 5871840000000 },
  { id: 106, titleFa: "یارانه نگهداری از فرزندان دارای معلولیت کمتر از ۱۲ سال", keyword: "farzanadaMalolkamtaraz12", groupId: 1001, budget: 560160000000 },
  { id: 108, titleFa: "یارانه ماهیانه نگهداری از فرزندان ۱۲ سال و بالاتر", keyword: "farzandanBishaz12", groupId: 1001, budget: 5097000000000 },
  { id: 110, titleFa: "یارانه نگهداری از فرزندان دارای معلولیت ۱۲ سال و بالاتر", keyword: "farzandanDisabilityBishaz12", groupId: 1001, budget: 531000000000 },
  { id: 111, titleFa: "طرح تسهیلگری مدیریت مورد", keyword: "etyad_tashilgary", groupId: 0, budget: 50000000000 },
];

/** Active / budgeted locations suitable for monthly disk requests. */
export const ACTIVE_SUPPLY_LOCATIONS = RAW.filter(
  (s) => s.keyword && (s.budget > 0 || [5, 52].includes(s.id)),
);

export function getSupplyLocation(id: number) {
  return RAW.find((s) => s.id === id);
}
