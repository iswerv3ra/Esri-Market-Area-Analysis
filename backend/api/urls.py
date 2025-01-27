from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ColorKeyViewSet, TcgThemeViewSet, StylePresetViewSet,
    VariablePresetViewSet, CreateUserView, ProjectViewSet,
    MarketAreaList, MarketAreaReorder, MarketAreaDetail
)

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'style-presets', StylePresetViewSet, basename='style-preset')
router.register(r'variable-presets', VariablePresetViewSet, basename='variable-preset')
router.register(r'color-keys', ColorKeyViewSet, basename='color-key')
router.register(r'tcg-themes', TcgThemeViewSet, basename='tcg-theme')

urlpatterns = [
    # User registration
    path('users/', CreateUserView.as_view(), name='user-create'),

    # Market Area endpoints
    path('projects/<uuid:project_id>/market-areas/',
         MarketAreaList.as_view(), name='market-area-list'),
    path('projects/<uuid:project_id>/market-areas/reorder/',
         MarketAreaReorder.as_view(), name='market-area-reorder'),
    path('projects/<uuid:project_id>/market-areas/<uuid:pk>/',
         MarketAreaDetail.as_view(), name='market-area-detail'),

    # Include the router URLs (only once)
    path('', include(router.urls)),
]