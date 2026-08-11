from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import (
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
from .permissions import BUSINESS_MANAGERS, supervised_region_ids
from .services import classification_for_score, recalculate_evaluation


User = get_user_model()


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ("id", "code", "name", "is_active")


class BranchSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True)

    class Meta:
        model = Branch
        fields = ("id", "code", "name", "manager_name", "region", "region_name")


class CriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationCriterion
        fields = ("id", "text", "order", "weight", "is_required")


class SectionSerializer(serializers.ModelSerializer):
    criteria = CriterionSerializer(many=True, read_only=True)

    class Meta:
        model = EvaluationSection
        fields = ("id", "title", "icon", "order", "weight", "criteria")


class TemplateSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    total_weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, read_only=True
    )

    class Meta:
        model = EvaluationTemplate
        fields = (
            "id",
            "name",
            "version",
            "status",
            "effective_date",
            "total_weight",
            "sections",
        )


class CycleSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)

    class Meta:
        model = EvaluationCycle
        fields = (
            "id",
            "title",
            "template",
            "template_name",
            "start_date",
            "end_date",
            "status",
        )

    def validate(self, attrs):
        template = attrs.get("template") or getattr(self.instance, "template", None)
        start_date = attrs.get("start_date") or getattr(
            self.instance, "start_date", None
        )
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if template and template.status != EvaluationTemplate.Status.PUBLISHED:
            raise serializers.ValidationError(
                {"template": "برای دوره باید از الگوی منتشرشده استفاده شود."}
            )
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class AssignmentSerializer(serializers.ModelSerializer):
    branch_detail = BranchSerializer(source="branch", read_only=True)
    evaluator_detail = UserSerializer(source="evaluator", read_only=True)
    assigned_by_detail = UserSerializer(source="assigned_by", read_only=True)
    cycle_title = serializers.CharField(source="cycle.title", read_only=True)
    template_id = serializers.IntegerField(source="cycle.template_id", read_only=True)
    evaluation_id = serializers.IntegerField(
        source="evaluation.id", read_only=True, allow_null=True
    )

    class Meta:
        model = EvaluationAssignment
        fields = (
            "id",
            "cycle",
            "cycle_title",
            "template_id",
            "branch",
            "branch_detail",
            "evaluator",
            "evaluator_detail",
            "assigned_by_detail",
            "due_date",
            "status",
            "evaluation_id",
            "created_at",
        )
        read_only_fields = ("status",)

    def validate_evaluator(self, evaluator):
        if evaluator.role != User.Role.EVALUATOR or not evaluator.is_active:
            raise serializers.ValidationError("کاربر باید یک ارزیاب فعال باشد.")
        return evaluator

    def validate(self, attrs):
        request = self.context["request"]
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        if (
            request.user.role == User.Role.REGION_SUPERVISOR
            and branch.region_id not in supervised_region_ids(request.user)
        ):
            raise serializers.ValidationError(
                "سرپرست فقط می‌تواند در مناطق تحت سرپرستی خود تخصیص ایجاد کند."
            )
        cycle = attrs.get("cycle") or getattr(self.instance, "cycle", None)
        due_date = attrs.get("due_date") or getattr(self.instance, "due_date", None)
        if cycle and due_date and not cycle.start_date <= due_date <= cycle.end_date:
            raise serializers.ValidationError(
                {"due_date": "مهلت باید در بازه دوره ارزیابی باشد."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["assigned_by"] = self.context["request"].user
        return super().create(validated_data)


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationAnswer
        fields = ("id", "criterion", "score", "weighted_score", "comment")
        read_only_fields = ("id", "weighted_score")


class OpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Opportunity
        fields = (
            "id",
            "organization_name",
            "employee_count",
            "opportunity_types",
            "responsible_person",
            "status",
            "target_date",
            "notes",
        )
        read_only_fields = ("id",)


class EvaluationSerializer(serializers.ModelSerializer):
    assignment_detail = AssignmentSerializer(source="assignment", read_only=True)
    answers = AnswerSerializer(many=True, required=False)
    opportunities = OpportunitySerializer(many=True, required=False)
    classification = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = (
            "id",
            "assignment",
            "assignment_detail",
            "status",
            "evaluation_date",
            "strengths",
            "improvements",
            "market_opportunities",
            "branch_needs",
            "answers",
            "opportunities",
            "total_score",
            "section_scores",
            "classification",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "review_comment",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "status",
            "total_score",
            "section_scores",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "review_comment",
        )

    def get_classification(self, obj):
        return classification_for_score(obj.total_score)

    def validate_assignment(self, assignment):
        request = self.context["request"]
        if assignment.evaluator_id != request.user.id:
            raise serializers.ValidationError(
                "فقط ارزیاب تخصیص‌یافته می‌تواند ارزیابی را ایجاد کند."
            )
        if hasattr(assignment, "evaluation"):
            raise serializers.ValidationError("برای این تخصیص قبلاً ارزیابی ایجاد شده است.")
        return assignment

    def validate_answers(self, answers):
        assignment = self.initial_data.get("assignment")
        if self.instance:
            template_id = self.instance.assignment.cycle.template_id
        elif assignment:
            try:
                template_id = EvaluationAssignment.objects.get(
                    pk=assignment
                ).cycle.template_id
            except EvaluationAssignment.DoesNotExist:
                return answers
        else:
            return answers

        valid_ids = set(
            EvaluationCriterion.objects.filter(
                section__template_id=template_id
            ).values_list("id", flat=True)
        )
        submitted_ids = [item["criterion"].id for item in answers]
        if len(submitted_ids) != len(set(submitted_ids)):
            raise serializers.ValidationError("هر معیار فقط یک پاسخ می‌تواند داشته باشد.")
        if not set(submitted_ids).issubset(valid_ids):
            raise serializers.ValidationError("یک یا چند معیار متعلق به این الگو نیست.")
        return answers

    @transaction.atomic
    def create(self, validated_data):
        answers = validated_data.pop("answers", [])
        opportunities = validated_data.pop("opportunities", [])
        evaluation = Evaluation.objects.create(**validated_data)
        self._save_nested(evaluation, answers, opportunities)
        evaluation.assignment.status = EvaluationAssignment.Status.IN_PROGRESS
        evaluation.assignment.save(update_fields=["status", "updated_at"])
        recalculate_evaluation(evaluation)
        return evaluation

    @transaction.atomic
    def update(self, instance, validated_data):
        answers = validated_data.pop("answers", None)
        opportunities = validated_data.pop("opportunities", None)
        instance = super().update(instance, validated_data)
        self._save_nested(instance, answers, opportunities)
        recalculate_evaluation(instance)
        return instance

    def _save_nested(self, evaluation, answers, opportunities):
        if answers is not None:
            for answer in answers:
                criterion = answer.pop("criterion")
                EvaluationAnswer.objects.update_or_create(
                    evaluation=evaluation,
                    criterion=criterion,
                    defaults=answer,
                )
        if opportunities is not None:
            evaluation.opportunities.all().delete()
            Opportunity.objects.bulk_create(
                [
                    Opportunity(evaluation=evaluation, **opportunity)
                    for opportunity in opportunities
                ]
            )


class ReviewSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class RegionSupervisorAssignmentSerializer(serializers.ModelSerializer):
    supervisor_detail = UserSerializer(source="supervisor", read_only=True)
    region_detail = RegionSerializer(source="region", read_only=True)

    class Meta:
        model = RegionSupervisorAssignment
        fields = (
            "id",
            "region",
            "region_detail",
            "supervisor",
            "supervisor_detail",
            "is_active",
        )
