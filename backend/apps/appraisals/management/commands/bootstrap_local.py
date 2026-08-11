from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.appraisals.models import (
    Branch,
    EvaluationAssignment,
    EvaluationCycle,
    EvaluationTemplate,
    Region,
    RegionSupervisorAssignment,
)


User = get_user_model()


class Command(BaseCommand):
    help = "Creates safe-to-replace local demo users and appraisal data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="ChangeMe123!",
            help="Password assigned to all local demo users.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        users = {}
        user_data = [
            ("admin", User.Role.ADMIN, True, "مدیر", "سامانه"),
            ("manager", User.Role.MARKETING_MANAGER, False, "مدیر", "بازاریابی"),
            ("supervisor", User.Role.REGION_SUPERVISOR, False, "سرپرست", "منطقه"),
            ("evaluator", User.Role.EVALUATOR, False, "ارزیاب", "آزمایشی"),
        ]
        for index, (username, role, is_staff, first_name, last_name) in enumerate(
            user_data, start=1
        ):
            user, _ = User.objects.update_or_create(
                username=username,
                defaults={
                    "email": f"{username}@appraisal.local",
                    "employee_number": f"LOCAL-{index:03d}",
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "is_staff": is_staff,
                    "is_superuser": username == "admin",
                    "is_active": True,
                },
            )
            user.set_password(password)
            user.save()
            users[username] = user

        call_command("seed_initial_template", creator="manager")
        region, _ = Region.objects.get_or_create(
            code="R-001", defaults={"name": "منطقه آزمایشی"}
        )
        branch, _ = Branch.objects.get_or_create(
            code="B-1001",
            defaults={
                "name": "شعبه آزمایشی",
                "region": region,
                "manager_name": "رئیس شعبه آزمایشی",
            },
        )
        RegionSupervisorAssignment.objects.get_or_create(
            region=region,
            supervisor=users["supervisor"],
            defaults={"is_active": True},
        )
        template = EvaluationTemplate.objects.get(
            name=INITIAL_TEMPLATE_NAME, version=1
        )
        today = timezone.localdate()
        cycle, _ = EvaluationCycle.objects.get_or_create(
            title="دوره آزمایشی",
            defaults={
                "template": template,
                "start_date": today,
                "end_date": today + timedelta(days=30),
                "status": EvaluationCycle.Status.ACTIVE,
                "created_by": users["manager"],
            },
        )
        EvaluationAssignment.objects.get_or_create(
            cycle=cycle,
            branch=branch,
            defaults={
                "evaluator": users["evaluator"],
                "assigned_by": users["supervisor"],
                "due_date": today + timedelta(days=14),
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Local demo data created. Users: admin, manager, supervisor, evaluator"
            )
        )


INITIAL_TEMPLATE_NAME = "فرم ارزیابی بازاریابی شعبه"
