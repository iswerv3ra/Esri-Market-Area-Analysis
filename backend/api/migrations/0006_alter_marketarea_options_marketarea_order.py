# Generated by Django 4.2.11 on 2024-11-30 19:10

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_stylepreset_variablepreset'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='marketarea',
            options={'ordering': ['order', '-last_modified']},
        ),
        migrations.AddField(
            model_name='marketarea',
            name='order',
            field=models.IntegerField(default=0),
        ),
    ]