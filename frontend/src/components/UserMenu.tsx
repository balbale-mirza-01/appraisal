import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const roleLabels = {
  evaluator: "ارزیاب",
  region_supervisor: "سرپرست منطقه",
  marketing_manager: "مدیر بازاریابی",
  admin: "مدیر سامانه",
};

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const triggerClass = ["user-menu-trigger", menuOpen ? "open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="user-area" ref={menuRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="user-avatar" aria-hidden="true">
          {user.display_name.trim().charAt(0) || "؟"}
        </span>
        <span className="user-menu-names">
          <strong>{user.display_name}</strong>
          <span>{roleLabels[user.role]}</span>
        </span>
      </button>
      {menuOpen && (
        <div className="user-menu" role="menu">
          <NavLink
            to="/change-password"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
          >
            تغییر رمز عبور
          </NavLink>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout().then(() => navigate("/login"))}
          >
            خروج از حساب
          </button>
        </div>
      )}
    </div>
  );
}
