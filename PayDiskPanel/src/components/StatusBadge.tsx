import type { RequestStatus } from "@/lib/types";

const MAP: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  queued: { label: "در صف", color: "#3d5166", bg: "#e8eef3" },
  running: { label: "در حال اجرا", color: "#0b6e6a", bg: "#d9ebe9" },
  ready: { label: "آماده دانلود", color: "#1f7a4d", bg: "#e1f4ea" },
  handed_to_finance: { label: "تحویل به مالی", color: "#a15c00", bg: "#fff1db" },
  failed: { label: "خطا", color: "#a11f2c", bg: "#fde6e9" },
  cancelled: { label: "لغو", color: "#5a6570", bg: "#eceff2" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = MAP[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}
