from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
import uuid

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_number = models.CharField(max_length=20)  
    client = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    users = models.ManyToManyField(User, related_name="projects")
    
    def __str__(self):
        return f"{self.project_number} - {self.client}"
    
    class Meta:
        ordering = ['-last_modified']

class MarketArea(models.Model):
    MARKET_AREA_TYPES = [
        ('radius', 'Radius'),
        ('zip', 'Zip Code'),
        ('county', 'County'),
        ('place', 'Place'),
        ('tract', 'Census Tract'),
        ('block', 'Census Block'),
        ('blockgroup', 'Census Block Group'),
        ('cbsa', 'CBSA'),
        ('state', 'State'),
        ('usa', 'USA'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="market_areas")
    name = models.CharField(max_length=100)
    short_name = models.CharField(max_length=50, blank=True)
    ma_type = models.CharField(max_length=20, choices=MARKET_AREA_TYPES)
    geometry = models.JSONField(null=True, blank=True)  # Store GeoJSON
    style_settings = models.JSONField(default=dict)  # Store style settings
    locations = models.JSONField(null=True, blank=True)  # Store location data
    radius_points = models.JSONField(null=True, blank=True)  # Store radius points data
    order = models.IntegerField(default=0)  # New field for ordering
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-last_modified']
        unique_together = ['project', 'name']

    def save(self, *args, **kwargs):
        if not self.style_settings:
            self.style_settings = {
                "fillColor": "#0078D4",
                "fillOpacity": 0.3,
                "borderColor": "#0078D4",
                "borderWidth": 2
            }
        if not self.order and not self.id:
            from django.db.models import Max
            last_order = MarketArea.objects.filter(project=self.project).aggregate(Max('order'))['order__max']
            self.order = (last_order or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.project.project_number})"


class StylePreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, 
                              related_name="style_presets", null=True, blank=True)
    styles = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    is_global = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, 
                                 null=True, related_name="created_style_presets")

    class Meta:
        ordering = ['-last_modified']
        unique_together = [['project', 'name'], ['name', 'is_global']]

    def __str__(self):
        return self.name


class VariablePreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, 
                              related_name="variable_presets", null=True, blank=True)
    variables = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    is_global = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, 
                                 null=True, related_name="created_variable_presets")

    class Meta:
        ordering = ['-last_modified']
        unique_together = [['project', 'name'], ['name', 'is_global']]

    def __str__(self):
        return self.name


class TcgTheme(models.Model):
    theme_key = models.CharField(max_length=10)
    theme_name = models.CharField(max_length=100)
    fill = models.CharField(max_length=3)  # 'Yes' or 'No'
    fill_color = models.CharField(max_length=10, blank=True, null=True)
    transparency = models.CharField(max_length=10, blank=True, null=True)
    border = models.CharField(max_length=3, blank=True, null=True) # 'Yes' or 'No'
    weight = models.CharField(max_length=10, blank=True, null=True)
    excel_fill = models.CharField(max_length=10, blank=True, null=True)
    excel_text = models.CharField(max_length=10, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.theme_key} - {self.theme_name}"

class ColorKey(models.Model):
    key_number = models.CharField(max_length=10)
    color_name = models.CharField(max_length=100)
    R = models.CharField(max_length=3)
    G = models.CharField(max_length=3)
    B = models.CharField(max_length=3)
    Hex = models.CharField(max_length=7)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key_number} - {self.color_name}"
