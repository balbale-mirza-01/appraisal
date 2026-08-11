import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { publicPost } from "../api";

export function PasswordResetConfirmPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }
    try {
      const response = await publicPost<{ detail: string }>(
        "/auth/password-reset/confirm/",
        {
          uid: params.get("uid"),
          token: params.get("token"),
          new_password: password,
        },
      );
      setMessage(response.detail);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "تغییر رمز ناموفق بود.");
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>تعیین رمز عبور جدید</h1>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {!message && (
          <>
            <label>
              رمز عبور جدید
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <label>
              تکرار رمز عبور
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            <button className="button button-primary">ثبت رمز جدید</button>
          </>
        )}
        <Link to="/login" className="text-link">
          بازگشت به ورود
        </Link>
      </form>
    </main>
  );
}

