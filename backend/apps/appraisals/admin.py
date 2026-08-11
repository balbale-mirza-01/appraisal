from django.contrib import admin

from .models import (
    AuditEvent,
    Branch,
    Evaluation,
    EvaluationAnswer,
    EvaluationAssignment,
    EvaluationCriterion,
    EvaluationCycle,
    EvaluationSection,
    EvaluationTemplate,
    Opportunity,
    Region,
    RegionSupervisorAssignment,
)


class CriterionInline(admin.TabularInline):
    model = EvaluationCriterion
    extra = 0

    def has_add_permission(self, request, obj):
        return not obj or obj.template.status != EvaluationTemplate.Status.PUBLISHED

    def has_change_permission(self, request, obj=None):
        return not obj or obj.template.status != EvaluationTemplate.Status.PUBLISHED

    def has_delete_permission(self, request, obj=None):
        return not obj or obj.template.status != EvaluationTemplate.Status.PUBLISHED


@admin.register(EvaluationSection)
class EvaluationSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "template", "order", "weight")
    list_filter = ("template",)
    inlines = (CriterionInline,)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.template.status == EvaluationTemplate.Status.PUBLISHED:
            return ("template", "title", "icon", "order", "weight")
        return ()

    def has_delete_permission(self, request, obj=None):
        if obj and obj.template.status == EvaluationTemplate.Status.PUBLISHED:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(EvaluationTemplate)
class EvaluationTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "version", "status", "effective_date", "created_by")
    list_filter = ("status",)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status == EvaluationTemplate.Status.PUBLISHED:
            return ("name", "version", "effective_date", "created_by")
        return ()


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active")
    search_fields = ("code", "name")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "region", "manager_name", "is_active")
    list_filter = ("region", "is_active")
    search_fields = ("code", "name", "manager_name")


@admin.register(EvaluationAssignment)
class EvaluationAssignmentAdmin(admin.ModelAdmin):
    list_display = ("branch", "cycle", "evaluator", "assigned_by", "due_date", "status")
    list_filter = ("cycle", "status", "branch__region")
    search_fields = ("branch__name", "branch__code", "evaluator__username")


class AnswerInline(admin.TabularInline):
    model = EvaluationAnswer
    extra = 0
    readonly_fields = ("weighted_score",)


class OpportunityInline(admin.TabularInline):
    model = Opportunity
    extra = 0


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = (
        "assignment",
        "evaluation_date",
        "status",
        "total_score",
        "submitted_at",
        "reviewed_by",
    )
    list_filter = ("status", "assignment__cycle", "assignment__branch__region")
    search_fields = (
        "assignment__branch__name",
        "assignment__branch__code",
        "assignment__evaluator__username",
    )
    readonly_fields = ("total_score", "section_scores", "submitted_at", "reviewed_at")
    inlines = (AnswerInline, OpportunityInline)


@admin.register(EvaluationCycle)
class EvaluationCycleAdmin(admin.ModelAdmin):
    list_display = ("title", "template", "start_date", "end_date", "status")
    list_filter = ("status",)


@admin.register(RegionSupervisorAssignment)
class RegionSupervisorAssignmentAdmin(admin.ModelAdmin):
    list_display = ("region", "supervisor", "is_active")
    list_filter = ("region", "is_active")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("action", "evaluation", "actor", "created_at")
    list_filter = ("action", "created_at")
    readonly_fields = ("evaluation", "actor", "action", "metadata", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
