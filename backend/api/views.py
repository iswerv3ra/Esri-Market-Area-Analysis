from rest_framework import generics, status, viewsets, permissions, serializers

from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action, permission_classes
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from datetime import timedelta
from .models import (
    Project, 
    MarketArea, 
    StylePreset, 
    VariablePreset, 
    ColorKey, 
    TcgTheme, 
    EnrichmentUsage,
    MapConfiguration  # Add this line
)
from .serializers import (
    UserSerializer, 
    ProjectListSerializer, 
    ProjectDetailSerializer, 
    MarketAreaSerializer, 
    StylePresetSerializer, 
    VariablePresetSerializer, 
    ColorKeySerializer, 
    TcgThemeSerializer, 
    AdminUserSerializer,
    AdminUserUpdateSerializer, 
    PasswordResetSerializer, 
    EnrichmentUsageSerializer,
    MapConfigurationSerializer  # Add this line
)
from decimal import Decimal, ROUND_HALF_UP  # Add at top of file


class ColorKeyViewSet(viewsets.ModelViewSet):
    queryset = ColorKey.objects.all().order_by('key_number')
    serializer_class = ColorKeySerializer
    permission_classes = [IsAuthenticated]

class TcgThemeViewSet(viewsets.ModelViewSet):
    queryset = TcgTheme.objects.all().order_by('theme_key')
    serializer_class = TcgThemeSerializer
    permission_classes = [IsAuthenticated]

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8, write_only=True)

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_active']
        read_only_fields = ['id']

class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.action == 'reset_password':
            return PasswordResetSerializer
        return self.serializer_class

    @action(
        detail=False,
        methods=['get'],
        url_path='me',
        url_name='user-me'
    )
    def me(self, request):
        """Get the current user's information."""
        try:
            serializer = self.get_serializer(request.user)
            return Response({
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'is_staff': request.user.is_staff,
                'is_active': request.user.is_active
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=True,
        methods=['post'],
        url_path='reset-password',
        url_name='user-reset-password'
    )
    def reset_password(self, request, pk=None):
        """Reset a user's password."""
        try:
            user = self.get_object()
            serializer = self.get_serializer(data=request.data)
            
            if serializer.is_valid():
                user.set_password(serializer.validated_data['new_password'])
                user.save()
                
                return Response(
                    {'status': 'Password successfully reset'},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(
        detail=False,
        methods=['get'],
        url_path='usage_stats_all',
        url_name='usage-stats-all'
    )
    def usage_stats_all(self, request):
        """Get usage statistics for all users."""
        try:
            thirty_days_ago = timezone.now() - timedelta(days=30)
            usage_stats = {}
            users = User.objects.all()
            
            print(f"Total users: {users.count()}")
            print(f"Filtering for records since: {thirty_days_ago}")
            
            for user in users:
                user_usage = EnrichmentUsage.objects.filter(
                    user=user,
                    timestamp__gte=thirty_days_ago
                )
                
                print(f"User {user.id} ({user.username}): {user_usage.count()} enrichments")
                
                total_enrichments = user_usage.count()
                total_cost = user_usage.aggregate(total=Sum('cost'))['total'] or 0
                
                usage_stats[str(user.id)] = {
                    'total_enrichments': total_enrichments,
                    'total_cost': float(total_cost)
                }
            
            return Response(usage_stats)
            
        except Exception as e:
            print(f"Error in usage_stats_all: {e}")
            return Response(
                {'error': 'Internal server error', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class EnrichmentUsageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = EnrichmentUsageSerializer

    @action(detail=False, methods=['post'])
    def record_usage(self, request):
        """
        Record an enrichment usage with cost
        """
        try:
            # Extract essential data from request
            user_id = request.data.get('user_id')
            project_id = request.data.get('project_id')
            cost = Decimal(request.data.get('cost', '0.01'))

            if not all([user_id, project_id, cost is not None]):
                return Response({
                    'error': 'Missing required fields',
                    'required': ['user_id', 'project_id', 'cost']
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create enrichment usage record
            enrichment_usage = EnrichmentUsage.objects.create(
                user_id=user_id,
                project_id=project_id,
                cost=cost
            )

            return Response({
                'id': str(enrichment_usage.id),
                'cost': float(cost),
                'timestamp': enrichment_usage.timestamp
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': 'Failed to record enrichment usage',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-last_modified')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Add project number filter
        project_number = self.request.query_params.get('project_number', None)
        if project_number:
            queryset = queryset.filter(project_number=project_number)
            
        if self.action == 'list':
            return queryset.only(
                'id', 'project_number', 'client', 
                'location', 'last_modified'
            ).annotate(
                market_areas_count=Count('market_areas')
            )
        return queryset

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
                Q(project_id=project_id) | Q(is_global=True)
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
                Q(project_id=project_id) | Q(is_global=True)
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
        

class MapConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = MapConfigurationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Debugging: Print request parameters
        print(f"[Backend View] MapConfigurationViewSet: Action = {self.action}")
        print(f"[Backend View] MapConfigurationViewSet: Query Params = {self.request.query_params}")

        # For list action, filter by project
        if self.action == 'list':
            # Explicitly get the 'project' parameter
            project_id = self.request.query_params.get('project', None) # Use None as default

            if project_id:
                print(f"[Backend View] Filtering MapConfigurations for project_id: {project_id}")
                queryset = MapConfiguration.objects.filter(
                    project_id=project_id
                ).order_by('order')
                print(f"[Backend View] Found {queryset.count()} configurations for project {project_id}")
                return queryset
            else:
                # Handle case where project_id is missing or invalid
                print("[Backend View] No project_id provided in query params for list action. Returning empty queryset.")
                # Decide behavior: return none, return all (potentially unsafe), or raise error?
                # Returning none is safest if filtering by project is mandatory.
                return MapConfiguration.objects.none()

        # For other actions (retrieve, update, delete), default behavior is fine
        # as they usually rely on the URL pk lookup.
        print(f"[Backend View] Action is '{self.action}', returning all (will be filtered by pk later if applicable)")
        return MapConfiguration.objects.all().order_by('order') # Ensure consistent ordering

    def create(self, request, *args, **kwargs):
        # Optional: Add logging here too if creation seems problematic
        print(f"[Backend View] Received create request data: {request.data}")
        try:
            # The existing create logic seems okay, but ensure project ID lookup is robust
            project_id = request.data.get('project') # Or 'project_id' depending on serializer/frontend
            if not project_id:
                return Response({"detail": "Project ID is required."}, status=status.HTTP_400_BAD_REQUEST)

            # Optional: Check if project exists before proceeding with serializer
            try:
                 Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                 return Response({"detail": f"Project with ID {project_id} not found."}, status=status.HTTP_404_NOT_FOUND)

            # Your existing logic (delete if same name exists, then create)
            # tab_name = request.data.get('tab_name')
            # existing_config = MapConfiguration.objects.filter(project_id=project_id, tab_name=tab_name).first()
            # if existing_config:
            #     print(f"[Backend View] Deleting existing config with same name: {tab_name} for project {project_id}")
            #     existing_config.delete()

            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            print(f"[Backend View] Successfully created MapConfiguration: {serializer.data}")
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        except Exception as e:
            print(f"[Backend View] Error in MapConfigurationViewSet.create: {str(e)}")
            import traceback
            print(traceback.format_exc())
            # Return a more specific error if possible (e.g., from serializer validation)
            error_detail = getattr(e, 'detail', str(e))
            status_code = getattr(e, 'status_code', status.HTTP_400_BAD_REQUEST)
            return Response({"detail": error_detail}, status=status_code)

    def perform_create(self, serializer):
        # Ensure the project FK is correctly handled by the serializer's create method
        # If project is write_only=True, the serializer needs to handle the lookup
        serializer.save() # Serializer's create method should handle project assignment

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            print(f"[Backend View] Attempting to delete configuration with ID: {instance.id}, Name: {instance.tab_name}")
            self.perform_destroy(instance)
            print(f"[Backend View] Successfully deleted configuration ID: {kwargs.get('pk')}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404:
             print(f"[Backend View] Delete failed: Configuration with pk {kwargs.get('pk')} not found.")
             return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"[Backend View] Error deleting configuration {kwargs.get('pk')}: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)