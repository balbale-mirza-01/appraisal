import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadExcel } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Evaluation, Paginated } from "../types";

export function EvaluationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Evaluation[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback((searchValue = "") => {
    setLoading(true);
    const params = new URLSearchParams({ ordering: "-updated_at" });
    if (statusFilter) params.set("status", statusFilter);
    if (searchValue) params.set("search", searchValue);
    void api<Paginated<Evaluation>>(`/evaluations/?${params}`)
      .then((response) => {
        setItems(response.results);
        setError("");
      })
      .catch((exception) => setError(exception.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    load(search);
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>ارزیابی‌ها</h2>
          <p>مشاهده و پیگیری ارزیابی‌های مجاز برای نقش شما</p>
        </div>
        {user?.role !== "evaluator" && (
          <button
            className="button button-secondary"
            onClick={() =>
              void downloadExcel(
                `/reports/evaluations.xlsx${statusFilter ? `?status=${statusFilter}` : ""}`,
                "گزارش_ارزیابی_شعب.xlsx",
              )
            }
          >
            دریافت Excel
          </button>
        )}
      </div>
      <section className="panel">
        <form className="filter-bar" onSubmit={submitSearch}>
          <input
            placeholder="جستجو بر اساس شعبه یا ارزیاب"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            <option value="draft">پیش‌نویس</option>
            <option value="submitted">در انتظار بررسی</option>
            <option value="returned">برگشت داده شده</option>
            <option value="approved">تأیید شده</option>
          </select>
          <button className="button button-primary">جستجو</button>
        </form>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>شعبه</th>
                  <th>منطقه</th>
                  <th>ارزیاب</th>
                  <th>تاریخ</th>
                  <th>امتیاز</th>
                  <th>وضعیت</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((evaluation) => (
                  <tr key={evaluation.id}>
                    <td>{evaluation.assignment_detail.branch_detail.name}</td>
                    <td>{evaluation.assignment_detail.branch_detail.region_name}</td>
                    <td>{evaluation.assignment_detail.evaluator_detail.display_name}</td>
                    <td>{formatDate(evaluation.evaluation_date)}</td>
                    <td>{Number(evaluation.total_score).toLocaleString("fa-IR")}</td>
                    <td><StatusBadge status={evaluation.status} /></td>
                    <td>
                      <Link
                        className="button button-small button-secondary"
                        to={`/evaluations/${evaluation.id}`}
                      >
                        مشاهده
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <p className="empty-state">ارزیابی‌ای یافت نشد.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(
    new Date(`${value}T00:00:00`),
  );
}
