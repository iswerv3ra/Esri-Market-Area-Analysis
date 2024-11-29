from rest_framework import generics, status, viewsets, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth.models import User
from django.db import models
from .models import Project, MarketArea, StylePreset, VariablePreset
from .serializers import (
    UserSerializer, ProjectSerializer, MarketAreaSerializer,
    StylePresetSerializer, VariablePresetSerializer
)

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class ProjectList(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.all()

class ProjectDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.all()

class MarketAreaList(generics.ListCreateAPIView):
    serializer_class = MarketAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_id')
        return MarketArea.objects.filter(
            project_id=project_id
        ).select_related('project')

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_id')
        project = Project.objects.get(id=project_id)
        serializer.save(project=project)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class MarketAreaDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MarketAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_id')
        return MarketArea.objects.filter(
            project_id=project_id
        ).select_related('project')

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class StylePresetViewSet(viewsets.ModelViewSet):
    serializer_class = StylePresetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get('project')
        queryset = StylePreset.objects.select_related('created_by', 'project')
        
        if project_id:
            return queryset.filter(
                models.Q(project_id=project_id) | models.Q(is_global=True)
            )
        return queryset.filter(is_global=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def make_global(self, request, pk=None):
        preset = self.get_object()
        if not preset.is_global:
            preset.is_global = True
            preset.project = None  # Remove project association
            preset.save()
        return Response({'status': 'preset is now global'})

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class VariablePresetViewSet(viewsets.ModelViewSet):
    serializer_class = VariablePresetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get('project')
        queryset = VariablePreset.objects.select_related('created_by', 'project')
        
        if project_id:
            return queryset.filter(
                models.Q(project_id=project_id) | models.Q(is_global=True)
            )
        return queryset.filter(is_global=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def make_global(self, request, pk=None):
        preset = self.get_object()
        if not preset.is_global:
            preset.is_global = True
            preset.project = None  # Remove project association
            preset.save()
        return Response({'status': 'preset is now global'})

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )