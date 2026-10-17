from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academy", "0004_exam_keys")]

    operations = [
        migrations.AddField(
            model_name="question",
            name="unit",
            field=models.CharField(blank=True, max_length=24),
        ),
    ]
