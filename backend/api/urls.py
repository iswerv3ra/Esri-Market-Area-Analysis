from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ColorKeyViewSet, TcgThemeViewSet, StylePresetViewSet,
    VariablePresetViewSet, CreateUserView, ProjectViewSet,
    MarketAreaList, MarketAreaReorder, MarketAreaDetail,
    AdminUserViewSet, EnrichmentUsageViewSet, MapConfigurationViewSet,  # Add this line
  # Make sure this is imported
)

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'style-presets', StylePresetViewSet, basename='style-preset')
router.register(r'variable-presets', VariablePresetViewSet, basename='variable-preset')
router.register(r'color-keys', ColorKeyViewSet, basename='color-key')
router.register(r'tcg-themes', TcgThemeViewSet, basename='tcg-theme')
router.register(r'admin/users', AdminUserViewSet, basename='admin-user')
router.register(r'enrichment', EnrichmentUsageViewSet, basename='enrichment')
router.register(r'map-configurations', MapConfigurationViewSet, basename='map-configuration')
urlpatterns = [
    # User registration
    path('users/', CreateUserView.as_view(), name='user-create'),
    path('api/', include(router.urls)),

    # Market Area endpoints
    path('projects/<uuid:project_id>/market-areas/',
         MarketAreaList.as_view(), name='market-area-list'),
    path('projects/<uuid:project_id>/market-areas/reorder/',
         MarketAreaReorder.as_view(), name='market-area-reorder'),
    path('projects/<uuid:project_id>/market-areas/<uuid:pk>/',
         MarketAreaDetail.as_view(), name='market-area-detail'),
         
    # Include the router URLs
    path('', include(router.urls)),
]