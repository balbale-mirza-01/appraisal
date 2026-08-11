import { type FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Cycle, EvaluationTemplate } from "../types";

export function CycleManagerPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [form, setForm] = useState({
    title: "",
    template: "",
    start_date: "",
    end_date: "",
    status: "active",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [cycleData, templateData] = await Promise.all([
        api<Cycle[]>("/cycles/?ordering=-start_date"),
        api<EvaluationTemplate[]>("/templates/"),
      ]);
      setCycles(cycleData);
      setTemplates(templateData);
      setError("");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "دریافت دوره‌ها ناموفق بود.");
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
      await api<Cycle>("/cycles/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          template: Number(form.template),
        }),
      });
      setForm({
        title: "",
        template: "",
        start_date: "",
        end_date: "",
        status: "active",
      });
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ثبت دوره ناموفق بود.");
    }
  }

  async function changeStatus(cycle: Cycle, status: string) {
    try {
      await api<Cycle>(`/cycles/${cycle.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "تغییر وضعیت ناموفق بود.");
    }
  }

  if (user?.role !== "marketing_manager" && user?.role !== "admin") {
    return <div className="alert alert-error">شما مجوز مدیریت دوره‌ها را ندارید.</div>;
  }
  if (loading) return <Loading />;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>دوره‌های ارزیابی</h2>
          <p>ایجاد دوره بر اساس یک نسخه منتشرشده از الگوی ارزیابی</p>
        </div>
      </div>
      <section className="panel">
        <h3>دوره جدید</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="cycle-form" onSubmit={submit}>
          <label>
            عنوان دوره
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </label>
          <label>
            نسخه الگو
            <select
              value={form.template}
              onChange={(event) => setForm({ ...form, template: event.target.value })}
              required
            >
              <option value="">انتخاب الگو</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} — نسخه {template.version.toLocaleString("fa-IR")}
                </option>
              ))}
            </select>
          </label>
          <label>
            تاریخ شروع
            <input
              type="date"
              value={form.start_date}
              onChange={(event) => setForm({ ...form, start_date: event.target.value })}
              required
            />
          </label>
          <label>
            تاریخ پایان
            <input
              type="date"
              value={form.end_date}
              onChange={(event) => setForm({ ...form, end_date: event.target.value })}
              required
            />
          </label>
          <label>
            وضعیت
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="draft">پیش‌نویس</option>
              <option value="active">فعال</option>
            </select>
          </label>
          <button className="button button-primary">ایجاد دوره</button>
        </form>
      </section>
      <section className="panel">
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>عنوان</th>
                <th>الگو</th>
                <th>شروع</th>
                <th>پایان</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.id}>
                  <td>{cycle.title}</td>
                  <td>{cycle.template_name}</td>
                  <td>{formatDate(cycle.start_date)}</td>
                  <td>{formatDate(cycle.end_date)}</td>
                  <td><StatusBadge status={cycle.status} /></td>
                  <td>
                    {cycle.status === "draft" && (
                      <button
                        className="button button-small button-success"
                        onClick={() => void changeStatus(cycle, "active")}
                      >
                        فعال‌سازی
                      </button>
                    )}
                    {cycle.status === "active" && (
                      <button
                        className="button button-small button-secondary"
                        onClick={() => void changeStatus(cycle, "closed")}
                      >
                        بستن دوره
                      </button>
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

