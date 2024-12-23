from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'style-presets', views.StylePresetViewSet, basename='style-preset')
router.register(r'variable-presets', views.VariablePresetViewSet, basename='variable-preset')
router.register(r'color-keys', views.ColorKeyViewSet, basename='color-key')  # NEW ROUTE

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
         
    # Include the preset and color key router URLs
    path('', include(router.urls)),
]
