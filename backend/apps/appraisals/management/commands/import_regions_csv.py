import csv
from django.core.management.base import BaseCommand
from apps.appraisals.models import Region


def parse_boolean(value):
    """
    Safely converts CSV string representations of booleans
    into actual Python booleans.
    """
    if isinstance(value, bool):
        return value
    # Converts "True", "1", "Yes", "T" to True. Everything else to False.
    return str(value).strip().lower() in ("true", "1", "yes", "t")


class Command(BaseCommand):
    help = "Imports Region data from a CSV file into the PostgreSQL database"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Path to the CSV file inside the container"
        )

    def handle(self, *args, **kwargs):
        file_path = kwargs["file_path"]
        self.stdout.write(f"Reading data from {file_path}...")

        try:
            # utf-8-sig is crucial here because your data contains Persian characters.
            # It safely handles the hidden BOM Excel sometimes adds to UTF-8 files.
            with open(file_path, mode="r", encoding="utf-8-sig") as file:
                reader = csv.DictReader(file)

                created_count = 0
                updated_count = 0

                for row in reader:
                    # 1. Extract and clean the data
                    code = row.get("code", "").strip()
                    name = row.get("name", "").strip()

                    # 2. Basic validation to prevent database crashes
                    if not code or not name:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Skipping row with missing code or name: {row}"
                            )
                        )
                        continue

                    if len(code) > 20:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Code '{code}' exceeds 20 chars. Skipping."
                            )
                        )
                        continue
                    if len(name) > 150:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Name '{name}' exceeds 150 chars. Skipping."
                            )
                        )
                        continue

                    # 3. Parse the boolean safely
                    is_active = parse_boolean(row.get("is_active", True))

                    # 4. Create or Update the record
                    # We use 'code' as the unique lookup field.
                    obj, created = Region.objects.update_or_create(
                        code=code,
                        defaults={
                            "name": name,
                            "is_active": is_active,
                        },
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Finished! Created: {created_count} | Updated: {updated_count}"
                )
            )

        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f"Error: File not found at {file_path}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"An error occurred: {e}"))
