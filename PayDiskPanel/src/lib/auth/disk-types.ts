import type { DiskFamily } from "@/lib/types";

export type AccessTypeRef = {
  family: DiskFamily;
  /** یارانه: SupplyLocationId as string; مستمری: catalog id (mst-base, …) */
  typeId: string;
  label: string;
};

/** مستمری types available for ACL (aligned with catalog). */
export const MOSTAMARI_ACCESS_TYPES: AccessTypeRef[] = [
  {
    family: "mostamari",
    typeId: "mst-base",
    label: "مستمری (اعتبارات سازمان) · Ky=Mst_131500",
  },
  {
    family: "mostamari",
    typeId: "mst-hadafmandi",
    label: "افزایش مستمری (هدفمندی) · Ky=Mst_HDF",
  },
  {
    family: "mostamari",
    typeId: "mst-hagh-family",
    label: "حق پرستاری خانواده محور · Ky=Mst_F_PRSTRI",
  },
  {
    family: "mostamari",
    typeId: "mst-hagh-spinal",
    label: "حق پرستاری ضایعه نخاعی · Ky=Mst_PARASTARI",
  },
  {
    family: "mostamari",
    typeId: "mst-emdad",
    label: "کمک هزینه امداد · Ky=Mst_Emdad",
  },
];

/** Map ACL / filter typeId → PayedTransaction.Ky (safe for client + server). */
export const MOSTAMARI_KY_BY_TYPE: Record<string, string> = {
  "mst-base": "Mst_131500",
  "mst-hadafmandi": "Mst_HDF",
  "mst-hagh-family": "Mst_F_PRSTRI",
  "mst-hagh-spinal": "Mst_PARASTARI",
  "mst-emdad": "Mst_Emdad",
};

export function mostamariTypeOptions() {
  return MOSTAMARI_ACCESS_TYPES.map((t) => ({
    value: t.typeId,
    label: t.label.split("·")[0]?.trim() || t.label,
    title: t.label,
  }));
}
