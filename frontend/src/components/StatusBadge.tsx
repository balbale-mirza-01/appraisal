const labels: Record<string, string> = {
  assigned: "تخصیص داده شده",
  in_progress: "در حال انجام",
  draft: "پیش‌نویس",
  submitted: "در انتظار بررسی",
  returned: "برگشت داده شده",
  approved: "تأیید شده",
  active: "فعال",
  closed: "بسته",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

