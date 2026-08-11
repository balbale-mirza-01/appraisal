import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Radar } from "react-chartjs-2";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadExcel } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type {
  Answer,
  Assignment,
  Evaluation,
  EvaluationTemplate,
  Opportunity,
} from "../types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const opportunityTypes = [
  "منابع",
  "حقوق و دستمزد",
  "تسهیلات",
  "ضمانت‌نامه",
  "ارزی",
  "SCF",
  "سایر",
];

const emptyOpportunity = (): Opportunity => ({
  organization_name: "",
  employee_count: null,
  opportunity_types: [],
  responsible_person: "",
  status: "",
  target_date: null,
  notes: "",
});

export function EvaluationPage() {
  const { evaluationId, assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let loadedAssignment: Assignment;
        let loadedEvaluation: Evaluation | null = null;
        if (evaluationId) {
          loadedEvaluation = await api<Evaluation>(`/evaluations/${evaluationId}/`);
          loadedAssignment = loadedEvaluation.assignment_detail;
        } else {
          loadedAssignment = await api<Assignment>(`/assignments/${assignmentId}/`);
          if (loadedAssignment.evaluation_id) {
            navigate(`/evaluations/${loadedAssignment.evaluation_id}`, { replace: true });
            return;
          }
        }
        const loadedTemplate = await api<EvaluationTemplate>(
          `/templates/${loadedAssignment.template_id}/`,
        );
        if (!active) return;
        setAssignment(loadedAssignment);
        setTemplate(loadedTemplate);
        setEvaluation(loadedEvaluation);
        if (loadedEvaluation) {
          setAnswers(
            Object.fromEntries(
              loadedEvaluation.answers.map((answer) => [answer.criterion, answer]),
            ),
          );
        }
      } catch (exception) {
        if (active) {
          setError(exception instanceof Error ? exception.message : "بارگذاری فرم ناموفق بود.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [evaluationId, assignmentId, navigate]);

  const editable =
    Boolean(evaluation) &&
    user?.role === "evaluator" &&
    assignment?.evaluator === user.id &&
    ["draft", "returned"].includes(evaluation?.status ?? "");

  const saveDraft = useCallback(async () => {
    if (!evaluation || !editable) return evaluation;
    setSaving(true);
    try {
      const updated = await api<Evaluation>(`/evaluations/${evaluation.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          evaluation_date: evaluation.evaluation_date,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          market_opportunities: evaluation.market_opportunities,
          branch_needs: evaluation.branch_needs,
          answers: Object.values(answers),
          opportunities: evaluation.opportunities,
        }),
      });
      setEvaluation(updated);
      setDirty(false);
      setError("");
      return updated;
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ذخیره پیش‌نویس ناموفق بود.");
      throw exception;
    } finally {
      setSaving(false);
    }
  }, [answers, editable, evaluation]);

  useEffect(() => {
    if (!dirty || !editable) return;
    const timeout = window.setTimeout(() => void saveDraft(), 1200);
    return () => window.clearTimeout(timeout);
  }, [dirty, editable, saveDraft]);

  const preview = useMemo(() => {
    if (!template) return { total: 0, sections: [] as number[] };
    const sections = template.sections.map((section) => {
      const weighted = section.criteria.reduce(
        (sum, criterion) =>
          sum + (answers[criterion.id]?.score ?? 0) * Number(criterion.weight),
        0,
      );
      const criterionWeight = section.criteria.reduce(
        (sum, criterion) => sum + Number(criterion.weight),
        0,
      );
      return criterionWeight
        ? (weighted / criterionWeight / 5) * Number(section.weight)
        : 0;
    });
    return { total: sections.reduce((sum, score) => sum + score, 0), sections };
  }, [answers, template]);

  function changeEvaluation(values: Partial<Evaluation>) {
    setEvaluation((current) => (current ? { ...current, ...values } : current));
    setDirty(true);
  }

  async function startEvaluation() {
    if (!assignment) return;
    setSaving(true);
    try {
      const created = await api<Evaluation>("/evaluations/", {
        method: "POST",
        body: JSON.stringify({
          assignment: assignment.id,
          evaluation_date: localIsoDate(),
          answers: [],
          opportunities: [],
        }),
      });
      setEvaluation(created);
      navigate(`/evaluations/${created.id}`, { replace: true });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "شروع ارزیابی ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  function selectScore(criterion: number, score: number) {
    setAnswers((current) => ({
      ...current,
      [criterion]: { ...current[criterion], criterion, score },
    }));
    setDirty(true);
  }

  async function submitEvaluation() {
    if (!evaluation) return;
    try {
      await saveDraft();
      const submitted = await api<Evaluation>(`/evaluations/${evaluation.id}/submit/`, {
        method: "POST",
        body: "{}",
      });
      setEvaluation(submitted);
      setError("");
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ارسال ارزیابی ناموفق بود.");
    }
  }

  async function review(approve: boolean) {
    if (!evaluation) return;
    const comment = approve
      ? window.prompt("توضیح تأیید (اختیاری):", "") ?? ""
      : window.prompt("دلیل بازگشت ارزیابی را وارد کنید:", "") ?? "";
    if (!approve && !comment.trim()) return;
    const endpoint = approve ? "approve" : "return_for_correction";
    try {
      const reviewed = await api<Evaluation>(
        `/evaluations/${evaluation.id}/${endpoint}/`,
        { method: "POST", body: JSON.stringify({ comment }) },
      );
      setEvaluation(reviewed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "بررسی ارزیابی ناموفق بود.");
    }
  }

  async function reopen() {
    if (!evaluation) return;
    const comment =
      window.prompt("دلیل بازگشایی ارزیابی تأییدشده را وارد کنید:", "") ?? "";
    if (!comment.trim()) return;
    try {
      const reopened = await api<Evaluation>(
        `/evaluations/${evaluation.id}/reopen/`,
        { method: "POST", body: JSON.stringify({ comment }) },
      );
      setEvaluation(reopened);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "بازگشایی ناموفق بود.");
    }
  }

  function addOpportunity() {
    if (!evaluation) return;
    changeEvaluation({ opportunities: [...evaluation.opportunities, emptyOpportunity()] });
  }

  function updateOpportunity(index: number, values: Partial<Opportunity>) {
    if (!evaluation) return;
    const opportunities = evaluation.opportunities.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...values } : item,
    );
    changeEvaluation({ opportunities });
  }

  if (loading) return <Loading />;
  if (error && (!assignment || !template)) return <div className="alert alert-error">{error}</div>;
  if (!assignment || !template) return null;

  if (!evaluation) {
    return (
      <section className="panel start-card">
        <h2>شروع ارزیابی</h2>
        <p>
          {assignment.branch_detail.name} — {assignment.cycle_title}
        </p>
        <p>این فرم شامل {template.sections.reduce((sum, section) => sum + section.criteria.length, 0).toLocaleString("fa-IR")} معیار الزامی است.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="button button-primary" disabled={saving} onClick={() => void startEvaluation()}>
          ایجاد پیش‌نویس
        </button>
      </section>
    );
  }

  const canReview =
    user?.role !== "evaluator" && evaluation.status === "submitted";
  const canReopen =
    (user?.role === "marketing_manager" || user?.role === "admin") &&
    evaluation.status === "approved";
  const answeredCount = Object.keys(answers).length;
  const criterionCount = template.sections.reduce(
    (sum, section) => sum + section.criteria.length,
    0,
  );

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="heading-inline">
            <h2>{assignment.branch_detail.name}</h2>
            <StatusBadge status={evaluation.status} />
          </div>
          <p>
            {assignment.branch_detail.region_name} — {assignment.cycle_title} — ارزیاب:{" "}
            {assignment.evaluator_detail.display_name}
          </p>
        </div>
        <div className="action-row">
          <button
            className="button button-secondary"
            onClick={() =>
              void downloadExcel(
                `/evaluations/${evaluation.id}/export-xlsx/`,
                `ارزیابی_${assignment.branch_detail.code}.xlsx`,
              )
            }
          >
            Excel
          </button>
          {editable && (
            <button
              className="button button-primary"
              disabled={saving}
              onClick={() => void submitEvaluation()}
            >
              ارسال برای بررسی
            </button>
          )}
          {canReview && (
            <>
              <button className="button button-danger" onClick={() => void review(false)}>
                بازگشت برای اصلاح
              </button>
              <button className="button button-success" onClick={() => void review(true)}>
                تأیید ارزیابی
              </button>
            </>
          )}
          {canReopen && (
            <button className="button button-danger" onClick={() => void reopen()}>
              بازگشایی ارزیابی
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {evaluation.status === "returned" && evaluation.review_comment && (
        <div className="alert alert-warning">
          دلیل بازگشت: {evaluation.review_comment}
        </div>
      )}

      <section className="score-overview panel">
        <div>
          <span>امتیاز فعلی</span>
          <strong>{preview.total.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}</strong>
          <small>از ۱۰۰</small>
        </div>
        <div>
          <span>پیشرفت پاسخ‌دهی</span>
          <strong>
            {answeredCount.toLocaleString("fa-IR")} / {criterionCount.toLocaleString("fa-IR")}
          </strong>
          <small>{saving ? "در حال ذخیره..." : dirty ? "در انتظار ذخیره خودکار" : "ذخیره شده"}</small>
        </div>
      </section>

      {template.sections.map((section, sectionIndex) => (
        <section className="panel evaluation-section" key={section.id}>
          <div className="section-title">
            <h3>
              {sectionIndex + 1}. {section.title}
            </h3>
            <span>
              {preview.sections[sectionIndex].toLocaleString("fa-IR", {
                maximumFractionDigits: 1,
              })}{" "}
              / {Number(section.weight).toLocaleString("fa-IR")}
            </span>
          </div>
          <div className="question-list">
            {section.criteria.map((criterion, index) => (
              <article className="question-row" key={criterion.id}>
                <div className="question-text">
                  <span>{(index + 1).toLocaleString("fa-IR")}</span>
                  <p>{criterion.text}</p>
                </div>
                <div className="likert-group" aria-label={`امتیاز ${criterion.text}`}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      type="button"
                      key={score}
                      disabled={!editable}
                      className={
                        answers[criterion.id]?.score === score
                          ? `likert selected score-${score}`
                          : "likert"
                      }
                      onClick={() => selectScore(criterion.id, score)}
                    >
                      {score.toLocaleString("fa-IR")}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="panel">
        <div className="section-title">
          <h3>فرصت‌های منطقه</h3>
          {editable && (
            <button className="button button-small button-secondary" onClick={addOpportunity}>
              افزودن فرصت
            </button>
          )}
        </div>
        <div className="opportunity-list">
          {evaluation.opportunities.map((opportunity, index) => (
            <article className="opportunity-card" key={index}>
              <input
                placeholder="نام شرکت یا سازمان"
                value={opportunity.organization_name}
                disabled={!editable}
                onChange={(event) =>
                  updateOpportunity(index, { organization_name: event.target.value })
                }
              />
              <input
                type="number"
                min="0"
                placeholder="تعداد کارکنان"
                value={opportunity.employee_count ?? ""}
                disabled={!editable}
                onChange={(event) =>
                  updateOpportunity(index, {
                    employee_count: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
              <select
                multiple
                value={opportunity.opportunity_types}
                disabled={!editable}
                onChange={(event) =>
                  updateOpportunity(index, {
                    opportunity_types: Array.from(
                      event.currentTarget.selectedOptions,
                      (option) => option.value,
                    ),
                  })
                }
              >
                {opportunityTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                placeholder="مسئول پیگیری"
                value={opportunity.responsible_person}
                disabled={!editable}
                onChange={(event) =>
                  updateOpportunity(index, { responsible_person: event.target.value })
                }
              />
              <input
                placeholder="وضعیت"
                value={opportunity.status}
                disabled={!editable}
                onChange={(event) => updateOpportunity(index, { status: event.target.value })}
              />
              {editable && (
                <button
                  className="button button-small button-danger"
                  onClick={() =>
                    changeEvaluation({
                      opportunities: evaluation.opportunities.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  حذف
                </button>
              )}
            </article>
          ))}
          {!evaluation.opportunities.length && (
            <p className="empty-state">هنوز فرصتی ثبت نشده است.</p>
          )}
        </div>
      </section>

      <section className="panel notes-grid">
        <TextArea
          label="نقاط قوت شعبه"
          value={evaluation.strengths}
          disabled={!editable}
          onChange={(strengths) => changeEvaluation({ strengths })}
        />
        <TextArea
          label="نقاط قابل بهبود"
          value={evaluation.improvements}
          disabled={!editable}
          onChange={(improvements) => changeEvaluation({ improvements })}
        />
        <TextArea
          label="مهم‌ترین فرصت‌های بازار"
          value={evaluation.market_opportunities}
          disabled={!editable}
          onChange={(market_opportunities) => changeEvaluation({ market_opportunities })}
        />
        <TextArea
          label="درخواست‌ها و نیازهای شعبه"
          value={evaluation.branch_needs}
          disabled={!editable}
          onChange={(branch_needs) => changeEvaluation({ branch_needs })}
        />
      </section>

      <section className="panel results-grid">
        <div>
          <h3>نتیجه ارزیابی</h3>
          <div className="final-score">
            {preview.total.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
          </div>
          <p>{evaluation.classification}</p>
        </div>
        <div className="chart-wrap">
          <Radar
            data={{
              labels: template.sections.map((section) => section.title),
              datasets: [
                {
                  label: "درصد تحقق",
                  data: preview.sections.map((score, index) =>
                    Number(template.sections[index].weight)
                      ? (score / Number(template.sections[index].weight)) * 100
                      : 0,
                  ),
                  borderColor: "#662d91",
                  backgroundColor: "rgba(102,45,145,.16)",
                  pointBackgroundColor: "#662d91",
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      </section>
    </div>
  );
}

function TextArea({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function localIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
