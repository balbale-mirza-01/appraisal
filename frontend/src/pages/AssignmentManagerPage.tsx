import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Assignment, Branch, Cycle, Paginated, User } from "../types";

function unwrap<T>(response: Paginated<T> | T[]): T[] {
  return Array.isArray(response) ? response : response.results;
}

export function AssignmentManagerPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [evaluators, setEvaluators] = useState<User[]>([]);
  const [form, setForm] = useState({
    branch: "",
    cycle: "",
    evaluator: "",
    due_date: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [assignmentData, branchData, cycleData, evaluatorData] = await Promise.all([
        api<Paginated<Assignment>>("/assignments/?ordering=due_date"),
        api<Paginated<Branch> | Branch[]>("/branches/?ordering=name"),
        api<Paginated<Cycle> | Cycle[]>("/cycles/?status=active"),
        api<User[]>("/evaluators/"),
      ]);
      setAssignments(assignmentData.results);
      setBranches(unwrap(branchData));
      setCycles(unwrap(cycleData));
      setEvaluators(evaluatorData);
      setError("");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "دریافت اطلاعات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api<Assignment>("/assignments/", {
        method: "POST",
        body: JSON.stringify({
          branch: Number(form.branch),
          cycle: Number(form.cycle),
          evaluator: Number(form.evaluator),
          due_date: form.due_date,
        }),
      });
      setForm({ branch: "", cycle: "", evaluator: "", due_date: "" });
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ثبت تخصیص ناموفق بود.");
    }
  }

  if (user?.role === "evaluator") {
    return <div className="alert alert-error">شما مجوز مدیریت تخصیص‌ها را ندارید.</div>;
  }
  if (loading) return <Loading />;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>تخصیص ارزیابی</h2>
          <p>تخصیص ارزیاب به شعب مجاز در یک دوره فعال</p>
        </div>
      </div>
      <section className="panel">
        <h3>تخصیص جدید</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="assignment-form" onSubmit={submit}>
          <label>
            دوره
            <select
              value={form.cycle}
              onChange={(event) => setForm({ ...form, cycle: event.target.value })}
              required
            >
              <option value="">انتخاب دوره</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>{cycle.title}</option>
              ))}
            </select>
          </label>
          <label>
            شعبه
            <select
              value={form.branch}
              onChange={(event) => setForm({ ...form, branch: event.target.value })}
              required
            >
              <option value="">انتخاب شعبه</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} — {branch.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            ارزیاب
            <select
              value={form.evaluator}
              onChange={(event) => setForm({ ...form, evaluator: event.target.value })}
              required
            >
              <option value="">انتخاب ارزیاب</option>
              {evaluators.map((evaluator) => (
                <option key={evaluator.id} value={evaluator.id}>
                  {evaluator.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            مهلت انجام
            <input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
              required
            />
          </label>
          <button className="button button-primary">ثبت تخصیص</button>
        </form>
      </section>
      <section className="panel">
        <div className="section-title"><h3>تخصیص‌های موجود</h3></div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>شعبه</th>
                <th>ارزیاب</th>
                <th>دوره</th>
                <th>مهلت</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.branch_detail.name}</td>
                  <td>{assignment.evaluator_detail.display_name}</td>
                  <td>{assignment.cycle_title}</td>
                  <td>{formatDate(assignment.due_date)}</td>
                  <td><StatusBadge status={assignment.status} /></td>
                  <td>
                    {assignment.evaluation_id && (
                      <Link
                        className="button button-small button-secondary"
                        to={`/evaluations/${assignment.evaluation_id}`}
                      >
                        مشاهده
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(
    new Date(`${value}T00:00:00`),
  );
}

