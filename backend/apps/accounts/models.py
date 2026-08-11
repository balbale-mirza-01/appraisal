from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        EVALUATOR = "evaluator", "ارزیاب"
        REGION_SUPERVISOR = "region_supervisor", "سرپرست منطقه"
        MARKETING_MANAGER = "marketing_manager", "مدیر بازاریابی"
        ADMIN = "admin", "مدیر سامانه"

    email = models.EmailField("ایمیل", unique=True)
    employee_number = models.CharField(
        "شماره پرسنلی", max_length=30, unique=True, null=True, blank=True
    )
    mobile_number = models.CharField(
        "شماره همراه", max_length=20, blank=True, help_text="برای OTP آینده"
    )
    role = models.CharField(
        "نقش", max_length=30, choices=Role.choices, default=Role.EVALUATOR
    )

    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = "کاربر"
        verbose_name_plural = "کاربران"

    def __str__(self):
        return self.get_full_name() or self.username

