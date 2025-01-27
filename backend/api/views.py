from rest_framework import generics, status, viewsets, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from .models import Project, MarketArea, StylePreset, VariablePreset, ColorKey, TcgTheme
from .serializers import (
    UserSerializer, ProjectListSerializer, ProjectDetailSerializer, 
    MarketAreaSerializer, StylePresetSerializer, 
    VariablePresetSerializer, ColorKeySerializer, TcgThemeSerializer
)

class ColorKeyViewSet(viewsets.ModelViewSet):
    queryset = ColorKey.objects.all().order_by('key_number')  # Ensure ordering
    serializer_class = ColorKeySerializer
    permission_classes = [IsAuthenticated]

class TcgThemeViewSet(viewsets.ModelViewSet):
    queryset = TcgTheme.objects.all().order_by('theme_key')  # Ensure ordering
    serializer_class = TcgThemeSerializer
    permission_classes = [IsAuthenticated]

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-last_modified')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectDetailSerializer
    
    def get_queryset(self):
        # Optimize list query
        if self.action == 'list':
            return self.queryset.only(
                'id', 'project_number', 'client', 
                'location', 'last_modified'
            ).annotate(
                market_areas_count=Count('market_areas')
            )
        return self.queryset
class ProjectDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectDetailSerializer
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
        ).select_related('project').order_by('order', '-last_modified')

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

class MarketAreaReorder(generics.GenericAPIView):
    serializer_class = MarketAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_id')
        return MarketArea.objects.filter(
            project_id=project_id
        ).select_related('project')

    def put(self, request, project_id=None):
        order = request.data.get('order', [])
        
        if not order:
            return Response(
                {'error': 'Order list is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            with transaction.atomic():
                market_areas = MarketArea.objects.filter(
                    project_id=project_id, 
                    id__in=order
                )
                
                if len(market_areas) != len(order):
                    return Response(
                        {'error': 'Invalid market area IDs or some IDs do not belong to this project'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                order_mapping = {str(id): index for index, id in enumerate(order)}
                for market_area in market_areas:
                    market_area.order = order_mapping[str(market_area.id)]
                    market_area.save()
                
                updated_market_areas = MarketArea.objects.filter(
                    project_id=project_id
                ).order_by('order')
                serializer = self.get_serializer(updated_market_areas, many=True)
                
                return Response(serializer.data)
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            preset.project = None
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
            preset.project = None
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