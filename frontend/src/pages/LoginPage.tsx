import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)
    ?.message;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : "ورود ناموفق بود.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="brand-mark">EN</div>
        <h1>ورود به سامانه ارزیابی بازاریابی شعب</h1>
        <p>نام کاربری و رمز عبور سازمانی خود را وارد کنید.</p>
        {successMessage && (
          <div className="alert alert-success">{successMessage}</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          نام کاربری
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          رمز عبور
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="button button-primary" disabled={submitting}>
          {submitting ? "در حال ورود..." : "ورود"}
        </button>
        <Link to="/forgot-password" className="text-link">
          رمز عبور را فراموش کرده‌ام
        </Link>
      </form>
    </main>
  );
}
