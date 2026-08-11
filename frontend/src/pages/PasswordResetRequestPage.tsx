import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { publicPost } from "../api";

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await publicPost<{ detail: string }>(
        "/auth/password-reset/request/",
        { email },
      );
      setMessage(response.detail);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "ارسال درخواست ناموفق بود.");
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>بازیابی رمز عبور</h1>
        <p>پیوند تعیین رمز جدید به ایمیل ثبت‌شده شما ارسال می‌شود.</p>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          ایمیل
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button className="button button-primary">ارسال پیوند بازیابی</button>
        <Link to="/login" className="text-link">
          بازگشت به ورود
        </Link>
      </form>
    </main>
  );
}

