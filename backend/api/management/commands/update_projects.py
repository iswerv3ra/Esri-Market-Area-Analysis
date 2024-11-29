from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.apps import apps

class Command(BaseCommand):
    help = 'Updates existing projects to include all users'

    def handle(self, *args, **options):
        try:
            # Get the Project model dynamically
            Project = apps.get_model('api', 'Project')  # Using 'api' as the app name
            
            # Get all users
            all_users = User.objects.all()
            self.stdout.write(self.style.SUCCESS(f'Found {all_users.count()} users'))
            
            # Update each project
            projects = Project.objects.all()
            count = 0
            
            for project in projects:
                # Add all users to the project without checking owner
                project.users.add(*all_users)
                count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Updated project {project.project_number}')
                )

            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {count} projects')
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error updating projects: {str(e)}')
            )