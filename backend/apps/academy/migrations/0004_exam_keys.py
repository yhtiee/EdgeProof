from django.db import migrations, models


class Migration(migrations.Migration):
    """Stable keys so question banks and exams sync from content/exams."""

    dependencies = [("academy", "0003_curriculum_slugs")]

    operations = [
        migrations.AddField(
            model_name="question",
            name="key",
            field=models.SlugField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="exam",
            name="key",
            field=models.SlugField(blank=True, max_length=80, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="question",
            name="concept_tags",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
