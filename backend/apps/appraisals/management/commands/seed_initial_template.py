from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.appraisals.initial_template import INITIAL_TEMPLATE
from apps.appraisals.models import (
    EvaluationCriterion,
    EvaluationSection,
    EvaluationTemplate,
)
from apps.appraisals.services import validate_template_weights


User = get_user_model()


class Command(BaseCommand):
    help = "Creates and publishes version 1 of the branch marketing appraisal."

    def add_arguments(self, parser):
        parser.add_argument(
            "--creator",
            required=True,
            help="Username of the marketing manager or administrator creating it.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            creator = User.objects.get(username=options["creator"])
        except User.DoesNotExist as exc:
            raise CommandError("Creator user was not found.") from exc

        data = INITIAL_TEMPLATE
        template, created = EvaluationTemplate.objects.get_or_create(
            name=data["name"],
            version=data["version"],
            defaults={
                "status": EvaluationTemplate.Status.DRAFT,
                "effective_date": date.today(),
                "created_by": creator,
            },
        )
        if not created and template.status == EvaluationTemplate.Status.PUBLISHED:
            self.stdout.write(self.style.WARNING("The initial template already exists."))
            return

        template.sections.all().delete()
        for section_order, section_data in enumerate(data["sections"], start=1):
            section = EvaluationSection.objects.create(
                template=template,
                title=section_data["title"],
                icon=section_data["icon"],
                order=section_order,
                weight=section_data["weight"],
            )
            EvaluationCriterion.objects.bulk_create(
                [
                    EvaluationCriterion(
                        section=section,
                        text=text,
                        order=criterion_order,
                        weight=weight,
                    )
                    for criterion_order, (text, weight) in enumerate(
                        section_data["criteria"], start=1
                    )
                ]
            )

        validate_template_weights(template)
        template.status = EvaluationTemplate.Status.PUBLISHED
        template.save(update_fields=["status", "updated_at"])
        criterion_count = EvaluationCriterion.objects.filter(
            section__template=template
        ).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Published template v{template.version}: "
                f"{template.sections.count()} sections, {criterion_count} criteria."
            )
        )

