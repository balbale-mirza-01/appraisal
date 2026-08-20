import csv
from django.core.management.base import BaseCommand
from apps.appraisals.models import Region, Branch


def parse_boolean(value):
    """Safely converts CSV string representations into Python booleans."""
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "1", "yes", "t")


class Command(BaseCommand):
    help = "Imports Branch data from a CSV file"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Path to the CSV file inside the container"
        )

    def handle(self, *args, **kwargs):
        file_path = kwargs["file_path"]
        self.stdout.write(f"Reading data from {file_path}...")

        try:
            # Pro-Tip: Pre-load all regions into a dictionary for lightning-fast lookups.
            # This prevents querying the database inside the loop for every single branch.
            regions_lookup = {region.code: region for region in Region.objects.all()}

            with open(file_path, mode="r", encoding="utf-8-sig") as file:
                reader = csv.DictReader(file)

                created_count = 0
                updated_count = 0
                skipped_count = 0

                for row in reader:
                    # 1. Extract and clean data
                    code = row.get("code", "").strip()
                    name = row.get("name", "").strip()
                    region_code = row.get("region_code", "").strip()
                    manager_name = row.get("manager_name", "").strip()

                    # 2. Basic validation
                    if not code or not name or not region_code:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Skipping row with missing required fields: {row}"
                            )
                        )
                        skipped_count += 1
                        continue

                    if len(code) > 20 or len(name) > 150:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Skipping branch '{code}': Exceeds max length."
                            )
                        )
                        skipped_count += 1
                        continue

                    # 3. Look up the Region instance using the dictionary
                    region_instance = regions_lookup.get(region_code)
                    if not region_instance:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Region with code '{region_code}' not found. Skipping branch '{code}'."
                            )
                        )
                        skipped_count += 1
                        continue

                    # 4. Parse boolean
                    is_active = parse_boolean(row.get("is_active", True))

                    # 5. Create or Update
                    obj, created = Branch.objects.update_or_create(
                        code=code,
                        defaults={
                            # Pass the actual Region instance. Django handles the integer ID behind the scenes!
                            "region": region_instance,
                            "name": name,
                            # manager_name has blank=True, so an empty string ("") is perfectly valid.
                            "manager_name": manager_name,
                            "is_active": is_active,
                        },
                    )

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
