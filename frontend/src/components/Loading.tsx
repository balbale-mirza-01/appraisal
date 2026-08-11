export function Loading({ label = "در حال بارگذاری..." }: { label?: string }) {
  return <div className="panel loading">{label}</div>;
}

