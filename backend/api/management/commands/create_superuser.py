from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

class Command(BaseCommand):
    help = 'Lists existing superusers and creates a default one if none exist'

    def handle(self, *args, **kwargs):
        superusers = User.objects.filter(is_superuser=True)
        
        if superusers.exists():
            self.stdout.write(self.style.WARNING('Existing superusers:'))
            for user in superusers:
                self.stdout.write(self.style.SUCCESS(
                    f'Username: {user.username}, Email: {user.email}'
                ))
        else:
            try:
                with transaction.atomic():
                    # Create a superuser
                    superuser = User.objects.create_superuser(
                        username='admin',
                        email='admin@example.com',
                        password='Power@22'
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f'Successfully created superuser with username: {superuser.username}'
                    ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'Failed to create superuser: {str(e)}'
                ))