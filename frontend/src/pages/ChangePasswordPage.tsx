import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export function ChangePasswordPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }
    setSubmitting(true);
    try {
      await api<{ detail: string }>("/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      await logout();
      navigate("/login", {
        replace: true,
        state: { message: "رمز عبور تغییر کرد. دوباره وارد شوید." },
      });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "تغییر رمز ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>تغییر رمز عبور</h2>
          <p>پس از تغییر رمز، تمام نشست‌های فعال شما باطل می‌شوند.</p>
        </div>
      </div>
      <form className="panel password-change-form" onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          رمز عبور فعلی
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          رمز عبور جدید
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        <label>
          تکرار رمز عبور جدید
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
        <button className="button button-primary" disabled={submitting}>
          {submitting ? "در حال تغییر..." : "تغییر رمز عبور"}
        </button>
      </form>
    </div>
  );
}
