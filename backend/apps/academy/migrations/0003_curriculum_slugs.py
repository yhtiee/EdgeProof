from django.db import migrations, models


class Migration(migrations.Migration):
    """Slugs link database rows to the compiled curriculum (sync_curriculum)."""

    dependencies = [("academy", "0002_initial")]

    operations = [
        migrations.AddField(
            model_name="level",
            name="slug",
            field=models.SlugField(default="", max_length=80, unique=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="level",
            name="phase",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="module",
            name="slug",
            field=models.SlugField(default="", max_length=80, unique=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="lesson",
            name="minutes",
            field=models.PositiveSmallIntegerField(default=5),
        ),
        migrations.AlterField(
            model_name="lesson",
            name="block_count",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="lessonprogress",
            name="completed_blocks",
            field=models.JSONField(default=list),
        ),
    ]
