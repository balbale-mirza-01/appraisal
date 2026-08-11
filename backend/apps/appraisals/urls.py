from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .health import HealthView
from .views import (
    AssignmentViewSet,
    BranchViewSet,
    CycleViewSet,
    DashboardView,
    EvaluationReportExportView,
    EvaluationViewSet,
    EvaluatorViewSet,
    RegionSupervisorAssignmentViewSet,
    RegionViewSet,
    TemplateViewSet,
)


router = DefaultRouter()
router.register("regions", RegionViewSet, basename="region")
router.register("branches", BranchViewSet, basename="branch")
router.register("templates", TemplateViewSet, basename="template")
router.register("cycles", CycleViewSet, basename="cycle")
router.register("evaluators", EvaluatorViewSet, basename="evaluator")
router.register("assignments", AssignmentViewSet, basename="assignment")
router.register("evaluations", EvaluationViewSet, basename="evaluation")
router.register(
    "region-supervisors",
    RegionSupervisorAssignmentViewSet,
    basename="region-supervisor",
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("", include(router.urls)),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path(
        "reports/evaluations.xlsx",
        EvaluationReportExportView.as_view(),
        name="evaluation-report-xlsx",
    ),
]
