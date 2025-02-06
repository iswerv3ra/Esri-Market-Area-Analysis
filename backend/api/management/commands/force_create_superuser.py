from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

class Command(BaseCommand):
    help = 'Forces creation of a new superuser'

    def handle(self, *args, **kwargs):
        try:
            with transaction.atomic():
                # Create a superuser
                superuser = User.objects.create_superuser(
                    username='admin2',  # Different username to avoid conflicts
                    email='admin2@example.com',
                    password='Power@22'
                )
                self.stdout.write(self.style.SUCCESS(
                    f'Successfully created superuser with username: {superuser.username}'
                ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Failed to create superuser: {str(e)}'
            ))