from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
import uuid

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_number = models.CharField(max_length=20, unique=True)
    client = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    # Replace owner with users
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
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project.project_number})"
    
    class Meta:
        ordering = ['-last_modified']
        unique_together = ['project', 'name']

    def save(self, *args, **kwargs):
        # Set default style settings if not provided
        if not self.style_settings:
            self.style_settings = {
                "fillColor": "#0078D4",
                "fillOpacity": 0.3,
                "borderColor": "#0078D4",
                "borderWidth": 2
            }
        super().save(*args, **kwargs)