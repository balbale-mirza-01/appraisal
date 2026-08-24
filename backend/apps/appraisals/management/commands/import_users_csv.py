import csv
from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.appraisals.models import Region


def parse_boolean(value, default=False):
    """Safely converts CSV string representations into Python booleans."""
    if not value:
        return default
    return str(value).strip().lower() in ("true", "1", "yes", "t")


class Command(BaseCommand):
    help = "Imports User data from a CSV file"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Path to the CSV file inside the container"
        )
        parser.add_argument(
            "--default-password",
            type=str,
            default="ChangeMe123!",
            help="Default password for users if not specified in CSV",
        )

    def handle(self, *args, **kwargs):
        file_path = kwargs["file_path"]
        default_password = kwargs["default_password"]
        self.stdout.write(f"Reading users from {file_path}...")

        try:
            # Pre-load regions for fast lookup (same pattern as Branches)
            regions_lookup = {region.code: region for region in Region.objects.all()}

            # Validate roles
            valid_roles = {choice[0] for choice in User.Role.choices}

            with open(file_path, mode="r", encoding="utf-8-sig") as file:
                reader = csv.DictReader(file)

                created_count = 0
                updated_count = 0
                skipped_count = 0

                for row in reader:
                    # 1. Extract and clean data
                    username = row.get("username", "").strip()
                    email = row.get("email", "").strip()
                    first_name = row.get("first_name", "").strip()
                    last_name = row.get("last_name", "").strip()
                    employee_number = row.get("employee_number", "").strip() or None
                    mobile_number = row.get("mobile_number", "").strip()
                    role = row.get("role", "").strip()
                    region_code = row.get("region_code", "").strip()
                    password = row.get("password", "").strip() or default_password
                    is_active = parse_boolean(row.get("is_active", True), default=True)
                    is_staff = parse_boolean(row.get("is_staff", False), default=False)

                    # 2. Basic validation
                    if not username or not email:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Skipping row: username and email are required. Row: {row}"
                            )
                        )
                        skipped_count += 1
                        continue

                    # Validate role
                    if role and role not in valid_roles:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Invalid role '{role}' for user '{username}'. Using default 'evaluator'."
                            )
                        )
                        role = User.Role.EVALUATOR
                    elif not role:
                        role = User.Role.EVALUATOR

                    # 3. Look up Region (if provided)
                    region_instance = None
                    if region_code:
                        region_instance = regions_lookup.get(region_code)
                        if not region_instance:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Region '{region_code}' not found for user '{username}'. Setting region to NULL."
                                )
                            )

                    # 4. Create or Update the user
                    # We use 'username' as the unique lookup field
                    user, created = User.objects.update_or_create(
                        username=username,
                        defaults={
                            "email": email,
                            "first_name": first_name,
                            "last_name": last_name,
                            "employee_number": employee_number,
                            "mobile_number": mobile_number,
                            "role": role,
                            "region": region_instance,
                            "is_active": is_active,
                            "is_staff": is_staff,
                        },
                    )

                    # 5. CRITICAL: Set the password using Django's hashing method
                    # This must be done AFTER update_or_create
                    user.set_password(password)
                    user.save()

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Finished! Created: {created_count} | Updated: {updated_count} | Skipped: {skipped_count}"
                )
            )

        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f"Error: File not found at {file_path}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"An error occurred: {e}"))
