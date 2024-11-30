from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register the preset viewsets
router = DefaultRouter()
router.register(r'style-presets', views.StylePresetViewSet, basename='style-preset')
router.register(r'variable-presets', views.VariablePresetViewSet, basename='variable-preset')

urlpatterns = [
    # Project endpoints
    path('projects/', views.ProjectList.as_view(), name='project-list'),
    path('projects/<uuid:pk>/', views.ProjectDetail.as_view(), name='project-detail'),
    
    # Market Area endpoints
    path('projects/<uuid:project_id>/market-areas/', 
         views.MarketAreaList.as_view(), name='market-area-list'),
    path('projects/<uuid:project_id>/market-areas/reorder/',
         views.MarketAreaReorder.as_view(), name='market-area-reorder'),
    path('projects/<uuid:project_id>/market-areas/<uuid:pk>/', 
         views.MarketAreaDetail.as_view(), name='market-area-detail'),
         
    # Include the preset router URLs
    path('', include(router.urls)),
]