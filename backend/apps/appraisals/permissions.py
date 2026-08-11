from rest_framework.permissions import BasePermission

from apps.accounts.models import User

from .models import RegionSupervisorAssignment


BUSINESS_MANAGERS = {User.Role.MARKETING_MANAGER, User.Role.ADMIN}


def supervised_region_ids(user):
    if user.role != User.Role.REGION_SUPERVISOR:
        return []
    return list(
        RegionSupervisorAssignment.objects.filter(
            supervisor=user, is_active=True
        ).values_list("region_id", flat=True)
    )


def can_review_evaluation(user, evaluation):
    if user.role in BUSINESS_MANAGERS:
        return True
    return (
        user.role == User.Role.REGION_SUPERVISOR
        and evaluation.branch.region_id in supervised_region_ids(user)
    )


class IsMarketingManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in BUSINESS_MANAGERS


class CanManageAssignments(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {
            User.Role.REGION_SUPERVISOR,
            *BUSINESS_MANAGERS,
        }

