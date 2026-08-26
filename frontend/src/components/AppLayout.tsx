import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { UserMenu } from "./UserMenu";

export function AppLayout() {
  const { user } = useAuth();
  if (!user) return null;

  const canAssign = user.role !== "evaluator";
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>سامانه ارزیابی بازاریابی شعب</h1>
          <p>بانک اقتصادنوین</p>
        </div>
        <UserMenu />
      </header>
      <nav className="main-nav" aria-label="ناوبری اصلی">
        <NavLink to="/" end>
          داشبورد
        </NavLink>
        <NavLink to="/evaluations">ارزیابی‌ها</NavLink>
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
