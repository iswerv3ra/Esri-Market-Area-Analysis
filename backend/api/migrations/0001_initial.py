# api/migrations/0002_add_tcg_themes.py

from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):


    operations = [
        migrations.CreateModel(
            name='ColorKey',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('key_number', models.CharField(max_length=10, unique=True)),
                ('color_name', models.CharField(max_length=100)),
                ('R', models.IntegerField()),
                ('G', models.IntegerField()),
                ('B', models.IntegerField()),
                ('Hex', models.CharField(max_length=7)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_modified', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='TcgTheme',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('theme_key', models.CharField(max_length=10, unique=True)),
                ('theme_name', models.CharField(max_length=100)),
                ('fill', models.CharField(choices=[('Yes', 'Yes'), ('No', 'No')], max_length=3)),
                ('fill_color', models.CharField(default='', max_length=10)),
                ('transparency', models.CharField(max_length=10)),
                ('border', models.CharField(choices=[('Yes', 'Yes'), ('No', 'No')], max_length=3)),
                ('weight', models.CharField(max_length=10)),
                ('excel_fill', models.CharField(max_length=10)),
                ('excel_text', models.CharField(max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_modified', models.DateTimeField(auto_now=True)),
                ('color_key', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tcg_themes', to='api.colorkey')),
            ],
        ),
    ]