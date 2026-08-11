import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadExcel } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { DashboardData } from "../types";

const roleTitles = {
  evaluator: "کارهای ارزیابی من",
  region_supervisor: "کنترل ارزیابی‌های منطقه",
  marketing_manager: "نمای کل بازاریابی شعب",
  admin: "نمای مدیریتی سامانه",
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<DashboardData>("/dashboard/")
      .then(setData)
      .catch((exception) => setError(exception.message));
  }, []);

  if (!user || (!data && !error)) return <Loading />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const reviewItems = data.waiting_for_review ?? [];
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>{roleTitles[user.role]}</h2>
          <p>خلاصه وضعیت ارزیابی‌ها و اقدام‌های مورد نیاز</p>
        </div>
        {user.role !== "evaluator" && (
          <button
            className="button button-secondary"
            onClick={() =>
              void downloadExcel(
                "/reports/evaluations.xlsx",
                "گزارش_ارزیابی_شعب.xlsx",
              )
            }
          >
            دریافت گزارش Excel
          </button>
        )}
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span>کل تخصیص‌ها</span>
          <strong>{data.total_assignments.toLocaleString("fa-IR")}</strong>
        </article>
        <article className="metric-card">
          <span>کل ارزیابی‌ها</span>
          <strong>{data.total_evaluations.toLocaleString("fa-IR")}</strong>
        </article>
        <article className="metric-card">
          <span>سررسید هفت روز آینده</span>
          <strong>{data.due_soon.toLocaleString("fa-IR")}</strong>
        </article>
        <article className="metric-card metric-card-primary">
          <span>میانگین ارزیابی‌های تأییدشده</span>
          <strong>
            {data.average_score
              ? Number(data.average_score).toLocaleString("fa-IR", {
                  maximumFractionDigits: 1,
                })
              : "—"}
          </strong>
        </article>
      </section>

      {user.role === "evaluator" && (
        <>
        <section className="role-summary-grid">
          <RoleMetric
            label="نرخ تکمیل"
            value={`${(data.evaluator_summary?.completion_rate ?? 0).toLocaleString("fa-IR")}%`}
          />
          <RoleMetric
            label="تأییدشده"
            value={(data.evaluator_summary?.approved ?? 0).toLocaleString("fa-IR")}
          />
          <RoleMetric
            label="برگشتی"
            value={(data.evaluator_summary?.returned ?? 0).toLocaleString("fa-IR")}
          />
          <RoleMetric
            label="عقب‌افتاده"
            value={(data.evaluator_summary?.overdue ?? 0).toLocaleString("fa-IR")}
          />
        </section>
        <section className="panel">
          <div className="section-title">
            <h3>نیازمند اقدام</h3>
            <Link to="/evaluations">مشاهده سوابق</Link>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>شعبه</th>
                  <th>دوره</th>
                  <th>مهلت</th>
                  <th>وضعیت</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data.action_required ?? []).map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.branch_detail.name}</td>
                    <td>{assignment.cycle_title}</td>
                    <td>{formatDate(assignment.due_date)}</td>
                    <td><StatusBadge status={assignment.status} /></td>
                    <td>
                      <Link
                        className="button button-small button-primary"
                        to={
                          assignment.evaluation_id
                            ? `/evaluations/${assignment.evaluation_id}`
                            : `/assignments/${assignment.id}/start`
                        }
                      >
                        {assignment.evaluation_id ? "ادامه" : "شروع"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
      )}

      {user.role !== "evaluator" && (
        <>
          <section className="panel">
            <div className="section-title">
              <h3>در انتظار بررسی</h3>
              <span>{reviewItems.length.toLocaleString("fa-IR")} مورد</span>
            </div>
            <div className="card-list">
              {reviewItems.map((evaluation) => (
                <Link
                  className="list-card"
                  to={`/evaluations/${evaluation.id}`}
                  key={evaluation.id}
                >
                  <div>
                    <strong>{evaluation.assignment_detail.branch_detail.name}</strong>
                    <span>{evaluation.assignment_detail.evaluator_detail.display_name}</span>
                  </div>
                  <div>
                    <strong>{Number(evaluation.total_score).toLocaleString("fa-IR")}</strong>
                    <StatusBadge status={evaluation.status} />
                  </div>
                </Link>
              ))}
              {!reviewItems.length && <p className="empty-state">موردی در انتظار بررسی نیست.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="section-title"><h3>خلاصه مناطق</h3></div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>منطقه</th>
                    <th>تعداد ارزیابی</th>
                    <th>تأییدشده</th>
                    <th>میانگین</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.regions ?? []).map((region) => (
                    <tr key={region.assignment__branch__region_id}>
                      <td>{region.assignment__branch__region__name}</td>
                      <td>{region.evaluation_count.toLocaleString("fa-IR")}</td>
                      <td>{region.approved_count.toLocaleString("fa-IR")}</td>
                      <td>
                        {region.average_score === null
                          ? "—"
                          : Number(region.average_score).toLocaleString("fa-IR", {
                              maximumFractionDigits: 1,
                            })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {user.role === "region_supervisor" && (
        <>
          <section className="role-summary-grid">
            <RoleMetric label="مناطق تحت سرپرستی" value={(data.supervisor_summary?.regions ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="شعب فعال" value={(data.supervisor_summary?.branches ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="ارزیاب فعال" value={(data.supervisor_summary?.active_evaluators ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="موارد عقب‌افتاده" value={(data.supervisor_summary?.overdue ?? 0).toLocaleString("fa-IR")} />
          </section>
          <section className="panel">
            <div className="section-title"><h3>بار کاری ارزیابان</h3></div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>ارزیاب</th>
                    <th>کل</th>
                    <th>در حال اقدام</th>
                    <th>در انتظار بررسی</th>
                    <th>تأییدشده</th>
                    <th>عقب‌افتاده</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.evaluator_workload ?? []).map((item) => (
                    <tr key={item.evaluator_id}>
                      <td>{displayEvaluator(item)}</td>
                      <td>{item.total.toLocaleString("fa-IR")}</td>
                      <td>{item.in_progress.toLocaleString("fa-IR")}</td>
                      <td>{item.waiting_review.toLocaleString("fa-IR")}</td>
                      <td>{item.approved.toLocaleString("fa-IR")}</td>
                      <td>{item.overdue.toLocaleString("fa-IR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {user.role === "marketing_manager" && (
        <>
          <section className="role-summary-grid">
            <RoleMetric label="مناطق فعال" value={(data.manager_summary?.regions ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="شعب فعال" value={(data.manager_summary?.branches ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="ارزیابان" value={(data.manager_summary?.evaluators ?? 0).toLocaleString("fa-IR")} />
            <RoleMetric label="دوره‌های فعال" value={(data.manager_summary?.active_cycles ?? 0).toLocaleString("fa-IR")} />
          </section>
          <section className="panel">
            <div className="section-title"><h3>پیشرفت دوره‌های فعال</h3></div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>دوره</th>
                    <th>بازه</th>
                    <th>تخصیص</th>
                    <th>در انتظار بررسی</th>
                    <th>تأییدشده</th>
                    <th>میانگین</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.active_cycles ?? []).map((cycle) => (
                    <tr key={cycle.id}>
                      <td>{cycle.title}</td>
                      <td>{formatDate(cycle.start_date)} تا {formatDate(cycle.end_date)}</td>
                      <td>{cycle.assignment_count.toLocaleString("fa-IR")}</td>
                      <td>{cycle.submitted_count.toLocaleString("fa-IR")}</td>
                      <td>{cycle.approved_count.toLocaleString("fa-IR")}</td>
                      <td>{cycle.average_score === null ? "—" : Number(cycle.average_score).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {user.role === "admin" && (
        <section className="role-summary-grid role-summary-grid-wide">
          <RoleMetric label="کاربران فعال" value={(data.admin_summary?.active_users ?? 0).toLocaleString("fa-IR")} />
          <RoleMetric label="ارزیابان" value={(data.admin_summary?.evaluators ?? 0).toLocaleString("fa-IR")} />
          <RoleMetric label="سرپرستان" value={(data.admin_summary?.supervisors ?? 0).toLocaleString("fa-IR")} />
          <RoleMetric label="مناطق" value={(data.admin_summary?.regions ?? 0).toLocaleString("fa-IR")} />
          <RoleMetric label="شعب" value={(data.admin_summary?.branches ?? 0).toLocaleString("fa-IR")} />
          <RoleMetric label="نسخه‌های الگو" value={(data.admin_summary?.templates ?? 0).toLocaleString("fa-IR")} />
        </section>
      )}
    </div>
  );
}

function RoleMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="role-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function displayEvaluator(item: NonNullable<DashboardData["evaluator_workload"]>[number]) {
  return (
    `${item.evaluator__first_name} ${item.evaluator__last_name}`.trim() ||
    item.evaluator__username
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(
    new Date(`${value}T00:00:00`),
  );
}
