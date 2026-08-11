from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Region(TimeStampedModel):
    code = models.CharField("کد منطقه", max_length=20, unique=True)
    name = models.CharField("نام منطقه", max_length=150)
    is_active = models.BooleanField("فعال", default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "منطقه"
        verbose_name_plural = "مناطق"

    def __str__(self):
        return self.name


class Branch(TimeStampedModel):
    region = models.ForeignKey(
        Region, related_name="branches", on_delete=models.PROTECT
    )
    code = models.CharField("کد شعبه", max_length=20, unique=True)
    name = models.CharField("نام شعبه", max_length=150)
    manager_name = models.CharField("نام رئیس شعبه", max_length=150, blank=True)
    is_active = models.BooleanField("فعال", default=True)

    class Meta:
        ordering = ("region__name", "name")
        verbose_name = "شعبه"
        verbose_name_plural = "شعب"

    def __str__(self):
        return f"{self.name} ({self.code})"


class RegionSupervisorAssignment(TimeStampedModel):
    region = models.ForeignKey(
        Region, related_name="supervisor_assignments", on_delete=models.CASCADE
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="supervised_region_assignments",
        on_delete=models.CASCADE,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("region", "supervisor"),
                name="unique_region_supervisor_assignment",
            )
        ]
        verbose_name = "تخصیص سرپرست منطقه"
        verbose_name_plural = "تخصیص‌های سرپرستان مناطق"

    def clean(self):
        if self.supervisor.role != self.supervisor.Role.REGION_SUPERVISOR:
            raise ValidationError("کاربر انتخاب‌شده باید نقش سرپرست منطقه داشته باشد.")

    def __str__(self):
        return f"{self.supervisor} - {self.region}"


class EvaluationTemplate(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PUBLISHED = "published", "منتشرشده"
        RETIRED = "retired", "بازنشسته"

    name = models.CharField("عنوان", max_length=200)
    version = models.PositiveIntegerField("نسخه")
    status = models.CharField(
        "وضعیت", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    effective_date = models.DateField("تاریخ اجرا", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_evaluation_templates",
        on_delete=models.PROTECT,
    )

    class Meta:
        ordering = ("-version",)
        constraints = [
            models.UniqueConstraint(
                fields=("name", "version"), name="unique_evaluation_template_version"
            )
        ]
        verbose_name = "الگوی ارزیابی"
        verbose_name_plural = "الگوهای ارزیابی"

    @property
    def total_weight(self):
        return sum(
            self.sections.values_list("weight", flat=True), start=Decimal("0")
        )

    def __str__(self):
        return f"{self.name} - نسخه {self.version}"


class EvaluationSection(models.Model):
    template = models.ForeignKey(
        EvaluationTemplate, related_name="sections", on_delete=models.CASCADE
    )
    title = models.CharField("عنوان بخش", max_length=250)
    icon = models.CharField("آیکون", max_length=50, blank=True)
    order = models.PositiveSmallIntegerField("ترتیب")
    weight = models.DecimalField("وزن بخش", max_digits=5, decimal_places=2)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("template", "order"), name="unique_template_section_order"
            )
        ]
        verbose_name = "بخش ارزیابی"
        verbose_name_plural = "بخش‌های ارزیابی"

    def __str__(self):
        return self.title


class EvaluationCriterion(models.Model):
    section = models.ForeignKey(
        EvaluationSection, related_name="criteria", on_delete=models.CASCADE
    )
    text = models.TextField("متن معیار")
    order = models.PositiveSmallIntegerField("ترتیب")
    weight = models.DecimalField("وزن معیار", max_digits=5, decimal_places=2)
    is_required = models.BooleanField("الزامی", default=True)

    class Meta:
        ordering = ("order",)
        constraints = [
            models.UniqueConstraint(
                fields=("section", "order"), name="unique_section_criterion_order"
            )
        ]
        verbose_name = "معیار ارزیابی"
        verbose_name_plural = "معیارهای ارزیابی"

    def __str__(self):
        return self.text[:80]


class EvaluationCycle(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        ACTIVE = "active", "فعال"
        CLOSED = "closed", "بسته"

    title = models.CharField("عنوان دوره", max_length=200)
    template = models.ForeignKey(
        EvaluationTemplate, related_name="cycles", on_delete=models.PROTECT
    )
    start_date = models.DateField("تاریخ شروع")
    end_date = models.DateField("تاریخ پایان")
    status = models.CharField(
        "وضعیت", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_evaluation_cycles",
        on_delete=models.PROTECT,
    )

    class Meta:
        ordering = ("-start_date",)
        verbose_name = "دوره ارزیابی"
        verbose_name_plural = "دوره‌های ارزیابی"

    def clean(self):
        if self.end_date < self.start_date:
            raise ValidationError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.")
        if self.template.status != EvaluationTemplate.Status.PUBLISHED:
            raise ValidationError("برای دوره ارزیابی باید از الگوی منتشرشده استفاده شود.")

    def __str__(self):
        return self.title


class EvaluationAssignment(TimeStampedModel):
    class Status(models.TextChoices):
        ASSIGNED = "assigned", "تخصیص داده شده"
        IN_PROGRESS = "in_progress", "در حال انجام"
        SUBMITTED = "submitted", "ارسال شده"
        RETURNED = "returned", "برگشت داده شده"
        APPROVED = "approved", "تأیید شده"

    cycle = models.ForeignKey(
        EvaluationCycle, related_name="assignments", on_delete=models.CASCADE
    )
    branch = models.ForeignKey(
        Branch, related_name="evaluation_assignments", on_delete=models.PROTECT
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="evaluation_assignments",
        on_delete=models.PROTECT,
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="assigned_evaluations",
        on_delete=models.PROTECT,
    )
    due_date = models.DateField("مهلت انجام")
    status = models.CharField(
        "وضعیت", max_length=20, choices=Status.choices, default=Status.ASSIGNED
    )

    class Meta:
        ordering = ("due_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("cycle", "branch"), name="unique_branch_assignment_per_cycle"
            )
        ]
        verbose_name = "تخصیص ارزیابی"
        verbose_name_plural = "تخصیص‌های ارزیابی"

    def clean(self):
        if self.evaluator.role != self.evaluator.Role.EVALUATOR:
            raise ValidationError("کاربر انتخاب‌شده باید نقش ارزیاب داشته باشد.")
        if not self.cycle.start_date <= self.due_date <= self.cycle.end_date:
            raise ValidationError("مهلت انجام باید در بازه دوره ارزیابی باشد.")

    def __str__(self):
        return f"{self.branch} - {self.evaluator}"


class Evaluation(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        SUBMITTED = "submitted", "ارسال شده"
        RETURNED = "returned", "برگشت داده شده"
        APPROVED = "approved", "تأیید شده"

    assignment = models.OneToOneField(
        EvaluationAssignment, related_name="evaluation", on_delete=models.PROTECT
    )
    status = models.CharField(
        "وضعیت", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    evaluation_date = models.DateField("تاریخ ارزیابی")
    strengths = models.TextField("نقاط قوت", blank=True)
    improvements = models.TextField("نقاط قابل بهبود", blank=True)
    market_opportunities = models.TextField("فرصت‌های بازار", blank=True)
    branch_needs = models.TextField("درخواست‌ها و نیازها", blank=True)
    total_score = models.DecimalField(
        "امتیاز کل", max_digits=6, decimal_places=2, default=0
    )
    section_scores = models.JSONField("امتیاز بخش‌ها", default=dict, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reviewed_evaluations",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    review_comment = models.TextField("نظر بازبین", blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "ارزیابی"
        verbose_name_plural = "ارزیابی‌ها"

    @property
    def evaluator(self):
        return self.assignment.evaluator

    @property
    def branch(self):
        return self.assignment.branch

    def __str__(self):
        return f"{self.assignment.branch} - {self.evaluation_date}"


class EvaluationAnswer(TimeStampedModel):
    evaluation = models.ForeignKey(
        Evaluation, related_name="answers", on_delete=models.CASCADE
    )
    criterion = models.ForeignKey(
        EvaluationCriterion, related_name="answers", on_delete=models.PROTECT
    )
    score = models.PositiveSmallIntegerField("امتیاز")
    weighted_score = models.DecimalField(
        "امتیاز وزنی", max_digits=8, decimal_places=4, default=0
    )
    comment = models.TextField("توضیح", blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("evaluation", "criterion"),
                name="unique_evaluation_criterion_answer",
            ),
            models.CheckConstraint(
                condition=models.Q(score__gte=1, score__lte=5),
                name="answer_score_between_1_and_5",
            ),
        ]
        verbose_name = "پاسخ ارزیابی"
        verbose_name_plural = "پاسخ‌های ارزیابی"


class Opportunity(TimeStampedModel):
    evaluation = models.ForeignKey(
        Evaluation, related_name="opportunities", on_delete=models.CASCADE
    )
    organization_name = models.CharField("نام سازمان", max_length=250)
    employee_count = models.PositiveIntegerField("تعداد کارکنان", null=True, blank=True)
    opportunity_types = models.JSONField("انواع فرصت", default=list)
    responsible_person = models.CharField("مسئول پیگیری", max_length=150, blank=True)
    status = models.CharField("وضعیت", max_length=150, blank=True)
    target_date = models.DateField("تاریخ هدف", null=True, blank=True)
    notes = models.TextField("توضیحات", blank=True)

    class Meta:
        ordering = ("id",)
        verbose_name = "فرصت منطقه"
        verbose_name_plural = "فرصت‌های منطقه"


class AuditEvent(models.Model):
    evaluation = models.ForeignKey(
        Evaluation,
        related_name="audit_events",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="appraisal_audit_events",
        on_delete=models.PROTECT,
    )
    action = models.CharField("عملیات", max_length=50)
    metadata = models.JSONField("جزئیات", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "رویداد ممیزی"
        verbose_name_plural = "رویدادهای ممیزی"

