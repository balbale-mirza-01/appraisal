from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class AppUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "اطلاعات سازمانی",
            {"fields": ("employee_number", "mobile_number", "role", "region")},
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "اطلاعات سازمانی",
            {"fields": ("email", "employee_number", "mobile_number", "role", "region")},
        ),
    )
    list_display = (
        "username",
        "email",
        "employee_number",
        "role",
        "region",
        "is_active",
        "is_staff",
    )
    list_filter = ("role", "region", "is_active", "is_staff")
    search_fields = ("username", "email", "employee_number", "first_name", "last_name")

