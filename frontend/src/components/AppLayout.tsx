import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const roleLabels = {
  evaluator: "ارزیاب",
  region_supervisor: "سرپرست منطقه",
  marketing_manager: "مدیر بازاریابی",
  admin: "مدیر سامانه",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const canAssign = user.role !== "evaluator";
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>سامانه ارزیابی بازاریابی شعب</h1>
          <p>بانک اقتصادنوین</p>
        </div>
        <div className="user-area">
          <div>
            <strong>{user.display_name}</strong>
            <span>{roleLabels[user.role]}</span>
          </div>
          <button
            className="button button-ghost"
            onClick={() => void logout().then(() => navigate("/login"))}
          >
            خروج
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="ناوبری اصلی">
        <NavLink to="/" end>
          داشبورد
        </NavLink>
        <NavLink to="/evaluations">ارزیابی‌ها</NavLink>
        <NavLink to="/change-password">تغییر رمز عبور</NavLink>
        {canAssign && <NavLink to="/assignments">تخصیص ارزیابی</NavLink>}
        {(user.role === "marketing_manager" || user.role === "admin") && (
          <NavLink to="/cycles">دوره‌های ارزیابی</NavLink>
        )}
        {(user.role === "marketing_manager" || user.role === "admin") && (
          <a href="/admin/" target="_blank" rel="noreferrer">
            مدیریت سامانه
          </a>
        )}
      </nav>
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
