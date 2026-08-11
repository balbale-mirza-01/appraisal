import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { AssignmentManagerPage } from "./pages/AssignmentManagerPage";
import { CycleManagerPage } from "./pages/CycleManagerPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { EvaluationsPage } from "./pages/EvaluationsPage";
import { LoginPage } from "./pages/LoginPage";
import { PasswordResetConfirmPage } from "./pages/PasswordResetConfirmPage";
import { PasswordResetRequestPage } from "./pages/PasswordResetRequestPage";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">در حال بارگذاری...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">در حال بارگذاری...</div>;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordResetRequestPage />} />
        <Route path="/reset-password" element={<PasswordResetConfirmPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/evaluations" element={<EvaluationsPage />} />
          <Route path="/evaluations/:evaluationId" element={<EvaluationPage />} />
          <Route path="/assignments/:assignmentId/start" element={<EvaluationPage />} />
          <Route path="/assignments" element={<AssignmentManagerPage />} />
          <Route path="/cycles" element={<CycleManagerPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
