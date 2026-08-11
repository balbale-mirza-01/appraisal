from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import AuditEvent, Evaluation, EvaluationAnswer, EvaluationAssignment


TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


def _rounded(value, places=TWO_PLACES):
    return value.quantize(places, rounding=ROUND_HALF_UP)


def validate_template_weights(template):
    sections = template.sections.prefetch_related("criteria").all()
    section_total = sum((section.weight for section in sections), Decimal("0"))
    errors = {}
    if section_total != Decimal("100"):
        errors["template"] = f"جمع وزن بخش‌ها باید ۱۰۰ باشد؛ مقدار فعلی {section_total} است."

    criterion_errors = []
    for section in sections:
        total = sum(
            (criterion.weight for criterion in section.criteria.all()), Decimal("0")
        )
        if total != Decimal("100"):
            criterion_errors.append(
                f"جمع وزن معیارهای بخش «{section.title}» برابر {total} است."
            )
    if criterion_errors:
        errors["sections"] = criterion_errors
    if errors:
        raise ValidationError(errors)


@transaction.atomic
def recalculate_evaluation(evaluation, require_complete=False):
    template = evaluation.assignment.cycle.template
    sections = template.sections.prefetch_related("criteria").all()
    answers = {
        answer.criterion_id: answer
        for answer in evaluation.answers.select_related("criterion").all()
    }

    if require_complete:
        validate_template_weights(template)
        missing = [
            criterion.id
            for section in sections
            for criterion in section.criteria.all()
            if criterion.is_required and criterion.id not in answers
        ]
        if missing:
            raise ValidationError(
                {
                    "answers": (
                        f"پاسخ {len(missing)} معیار الزامی ثبت نشده است."
                    )
                }
            )

    section_scores = {}
    total_score = Decimal("0")
    dirty_answers = []
    for section in sections:
        criteria = list(section.criteria.all())
        total_weight = sum((criterion.weight for criterion in criteria), Decimal("0"))
        weighted_sum = Decimal("0")
        for criterion in criteria:
            answer = answers.get(criterion.id)
            if answer:
                answer.weighted_score = _rounded(
                    Decimal(answer.score) * criterion.weight, FOUR_PLACES
                )
                dirty_answers.append(answer)
                weighted_sum += Decimal(answer.score) * criterion.weight

        score = (
            weighted_sum / total_weight / Decimal("5") * section.weight
            if total_weight
            else Decimal("0")
        )
        score = _rounded(score)
        section_scores[str(section.id)] = {
            "title": section.title,
            "score": float(score),
            "weight": float(section.weight),
            "percentage": float(
                _rounded(score / section.weight * Decimal("100"))
                if section.weight
                else Decimal("0")
            ),
        }
        total_score += score

    if dirty_answers:
        EvaluationAnswer.objects.bulk_update(dirty_answers, ["weighted_score"])
    evaluation.total_score = _rounded(total_score)
    evaluation.section_scores = section_scores
    evaluation.save(update_fields=["total_score", "section_scores", "updated_at"])
    return evaluation


def classification_for_score(score):
    score = Decimal(str(score))
    if score < 40:
        return "ضعیف"
    if score < 60:
        return "نیازمند بهبود"
    if score < 75:
        return "قابل قبول"
    if score < 90:
        return "خوب"
    return "شعبه برتر بازاریابی"


@transaction.atomic
def submit_evaluation(evaluation, actor):
    if evaluation.status not in (Evaluation.Status.DRAFT, Evaluation.Status.RETURNED):
        raise ValidationError({"status": "فقط پیش‌نویس یا ارزیابی برگشتی قابل ارسال است."})
    if evaluation.assignment.evaluator_id != actor.id:
        raise ValidationError({"detail": "فقط ارزیاب تخصیص‌یافته می‌تواند ارزیابی را ارسال کند."})

    recalculate_evaluation(evaluation, require_complete=True)
    previous_status = evaluation.status
    evaluation.status = Evaluation.Status.SUBMITTED
    evaluation.submitted_at = timezone.now()
    evaluation.review_comment = ""
    evaluation.save(
        update_fields=["status", "submitted_at", "review_comment", "updated_at"]
    )
    assignment = evaluation.assignment
    assignment.status = EvaluationAssignment.Status.SUBMITTED
    assignment.save(update_fields=["status", "updated_at"])
    AuditEvent.objects.create(
        evaluation=evaluation,
        actor=actor,
        action="submitted",
        metadata={"previous_status": previous_status},
    )
    return evaluation


@transaction.atomic
def review_evaluation(evaluation, actor, approve, comment=""):
    if evaluation.status != Evaluation.Status.SUBMITTED:
        raise ValidationError({"status": "فقط ارزیابی ارسال‌شده قابل بررسی است."})

    previous_status = evaluation.status
    evaluation.status = (
        Evaluation.Status.APPROVED if approve else Evaluation.Status.RETURNED
    )
    evaluation.reviewed_at = timezone.now()
    evaluation.reviewed_by = actor
    evaluation.review_comment = comment
    evaluation.save(
        update_fields=[
            "status",
            "reviewed_at",
            "reviewed_by",
            "review_comment",
            "updated_at",
        ]
    )
    assignment = evaluation.assignment
    assignment.status = (
        EvaluationAssignment.Status.APPROVED
        if approve
        else EvaluationAssignment.Status.RETURNED
    )
    assignment.save(update_fields=["status", "updated_at"])
    AuditEvent.objects.create(
        evaluation=evaluation,
        actor=actor,
        action="approved" if approve else "returned",
        metadata={"previous_status": previous_status, "comment": comment},
    )
    return evaluation


@transaction.atomic
def reopen_evaluation(evaluation, actor, comment):
    if evaluation.status != Evaluation.Status.APPROVED:
        raise ValidationError({"status": "فقط ارزیابی تأییدشده قابل بازگشایی است."})
    if not comment.strip():
        raise ValidationError({"comment": "دلیل بازگشایی الزامی است."})

    previous_status = evaluation.status
    evaluation.status = Evaluation.Status.RETURNED
    evaluation.reviewed_at = timezone.now()
    evaluation.reviewed_by = actor
    evaluation.review_comment = comment
    evaluation.save(
        update_fields=[
            "status",
            "reviewed_at",
            "reviewed_by",
            "review_comment",
            "updated_at",
        ]
    )
    assignment = evaluation.assignment
    assignment.status = EvaluationAssignment.Status.RETURNED
    assignment.save(update_fields=["status", "updated_at"])
    AuditEvent.objects.create(
        evaluation=evaluation,
        actor=actor,
        action="reopened",
        metadata={"previous_status": previous_status, "comment": comment},
    )
    return evaluation


def aggregate_status_counts(queryset):
    counts = defaultdict(int)
    for status_value in queryset.values_list("status", flat=True):
        counts[status_value] += 1
    return dict(counts)
