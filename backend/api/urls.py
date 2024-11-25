from django.urls import path
from . import views

urlpatterns = [
    # Project endpoints
    path('projects/', views.ProjectList.as_view(), name='project-list'),
    path('projects/<uuid:pk>/', views.ProjectDetail.as_view(), name='project-detail'),
    
    # Market Area endpoints
    path('projects/<uuid:project_id>/market-areas/', 
         views.MarketAreaList.as_view(), name='market-area-list'),
    path('projects/<uuid:project_id>/market-areas/<uuid:pk>/', 
         views.MarketAreaDetail.as_view(), name='market-area-detail'),
]