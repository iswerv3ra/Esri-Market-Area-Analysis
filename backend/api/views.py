from rest_framework import generics, status, viewsets, permissions, serializers
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.decorators import action, permission_classes, api_view
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.http import HttpResponse
from datetime import timedelta, datetime
from .models import (
    Project, 
    MarketArea, 
    StylePreset, 
    VariablePreset, 
    ColorKey, 
    TcgTheme, 
    EnrichmentUsage,
    MapConfiguration,
    LabelPosition
)
from .serializers import (
    UserSerializer, ProjectListSerializer, ProjectDetailSerializer,
    MarketAreaSerializer, StylePresetSerializer, VariablePresetSerializer,
    ColorKeySerializer, TcgThemeSerializer, AdminUserSerializer,
    AdminUserUpdateSerializer, PasswordResetSerializer, EnrichmentUsageSerializer,
    MapConfigurationSerializer, LabelPositionSerializer  # Add this import
)
from decimal import Decimal, ROUND_HALF_UP
import csv
import json


class LabelPositionViewSet(viewsets.ModelViewSet):
    serializer_class = LabelPositionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get('project')
        map_config_id = self.request.query_params.get('map_configuration')
        
        queryset = LabelPosition.objects.all()
        
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
        if map_config_id:
            queryset = queryset.filter(map_configuration_id=map_config_id)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        
        
    @action(detail=False, methods=['post'])
    def reset_all(self, request):
        """
        Reset all label positions for a project
        """
        try:
            project_id = request.query_params.get('project')
            if not project_id:
                return Response({
                    'error': 'Project ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)
                
            map_config_id = request.query_params.get('map_configuration')
                
            # Delete all label positions for this project
            queryset = LabelPosition.objects.filter(project_id=project_id)
            if map_config_id:
                queryset = queryset.filter(map_configuration_id=map_config_id)
                
            count = queryset.count()
            queryset.delete()
                
            return Response({
                'success': True,
                'message': f'Successfully reset {count} label positions'
            }, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response({
                'error': 'Failed to reset label positions',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)     
        
        
    @action(detail=False, methods=['post'])
    def batch_save(self, request):
        """
        Batch save multiple label positions
        """
        try:
            project_id = request.data.get('project_id')
            map_config_id = request.data.get('map_configuration_id')
            labels = request.data.get('labels', [])
            
            if not project_id or not labels:
                return Response({
                    'error': 'Missing required fields',
                    'required': ['project_id', 'labels']
                }, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                return Response({
                    'error': f'Project with ID {project_id} does not exist'
                }, status=status.HTTP_404_NOT_FOUND)
                
            map_config = None
            if map_config_id:
                try:
                    map_config = MapConfiguration.objects.get(id=map_config_id)
                except MapConfiguration.DoesNotExist:
                    return Response({
                        'error': f'MapConfiguration with ID {map_config_id} does not exist'
                    }, status=status.HTTP_404_NOT_FOUND)
            
            # Process each label
            results = []
            for label_data in labels:
                label_id = label_data.get('label_id')
                if not label_id:
                    continue
                    
                # Try to find existing label position
                try:
                    label_position = LabelPosition.objects.get(
                        project=project,
                        label_id=label_id
                    )
                    # Update existing
                    label_position.x_offset = label_data.get('x_offset', label_position.x_offset)
                    label_position.y_offset = label_data.get('y_offset', label_position.y_offset)
                    label_position.font_size = label_data.get('font_size', label_position.font_size)
                    label_position.text = label_data.get('text', label_position.text)
                    label_position.visibility = label_data.get('visibility', label_position.visibility)
                    if map_config:
                        label_position.map_configuration = map_config
                    label_position.save()
                except LabelPosition.DoesNotExist:
                    # Create new
                    label_position = LabelPosition.objects.create(
                        project=project,
                        map_configuration=map_config,
                        label_id=label_id,
                        x_offset=label_data.get('x_offset', 0),
                        y_offset=label_data.get('y_offset', 0),
                        font_size=label_data.get('font_size', 10),
                        text=label_data.get('text', ''),
                        visibility=label_data.get('visibility', True),
                        created_by=request.user
                    )
                
                results.append({
                    'id': str(label_position.id),
                    'label_id': label_position.label_id,
                    'updated': True
                })
            
            return Response({
                'success': True,
                'message': f'Successfully processed {len(results)} label positions',
                'results': results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'Failed to process label positions',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)




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
    
        
    @action(
        detail=False,
        methods=['get'],
        url_path='export_usage_stats',
        url_name='export-usage-stats'
    )
    def export_usage_stats(self, request):
        """
        Export user usage statistics as CSV with only selected columns:
        Email, Date, Project Name, Cost
        """
        try:
            # Parse query parameters
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            user_ids = request.query_params.getlist('user_id')
            
            # Convert date strings to datetime objects
            start_date = None
            end_date = None
            
            if start_date_str:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').replace(
                    hour=0, minute=0, second=0, microsecond=0,
                    tzinfo=timezone.get_current_timezone()
                )
            
            if end_date_str:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(
                    hour=23, minute=59, second=59, microsecond=999999,
                    tzinfo=timezone.get_current_timezone()
                )
            
            # Create filename with date information
            today = timezone.now().strftime('%Y-%m-%d')
            date_range = ""
            if start_date_str and end_date_str:
                date_range = f"_{start_date_str}_to_{end_date_str}"
            
            filename = f"user_usage_report{date_range}_{today}.csv"
            
            # Set up the HTTP response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Create CSV writer
            writer = csv.writer(response)
            
            # Only include the requested columns
            writer.writerow([
                'Email', 
                'Date', 
                'Project Name', 
                'Cost'
            ])
            
            # Query the usage records based on filters
            query = EnrichmentUsage.objects.all().select_related('user', 'project').order_by('user__username', '-timestamp')
            
            # Apply date filters if provided
            if start_date:
                query = query.filter(timestamp__gte=start_date)
            if end_date:
                query = query.filter(timestamp__lte=end_date)
            
            # Apply user filters if provided
            if user_ids and len(user_ids) > 0:
                # Remove any trailing slashes from user_ids
                cleaned_user_ids = [user_id.rstrip('/') for user_id in user_ids]
                query = query.filter(user__id__in=cleaned_user_ids)
            
            # Log query details for debugging
            print(f"Export query filters: start_date={start_date}, end_date={end_date}, user_ids={user_ids}")
            print(f"Total records in query: {query.count()}")
            
            # Write data rows with only the requested columns
            for record in query:
                writer.writerow([
                    record.user.email,
                    record.timestamp.strftime('%Y-%m-%d %H:%M'),
                    record.project.project_number if record.project else 'N/A',
                    f"{record.cost:.2f}" if record.cost is not None else 'N/A'
                ])
            
            return response
            
        except Exception as e:
            import traceback
            print(f"Error in export_usage_stats: {e}")
            print(traceback.format_exc())
            # Return error as JSON
            return Response(
                {'error': 'Failed to export usage statistics', 'details': str(e)},
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
        # Detailed logging for debugging
        print(f"[Backend View] Received create request data: {request.data}")
        
        try:
            # The project ID must be present
            project_id = request.data.get('project')
            if not project_id:
                return Response({"detail": "Project ID is required."}, status=status.HTTP_400_BAD_REQUEST)

            # Check if project exists
            try:
                Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                return Response({"detail": f"Project with ID {project_id} not found."}, status=status.HTTP_404_NOT_FOUND)

            # Handle layer_configuration if it's stringified JSON
            data = request.data.copy()
            if 'layer_configuration' in data and isinstance(data['layer_configuration'], str):
                try:
                    # Try to parse it to validate, but keep as string for the serializer
                    json.loads(data['layer_configuration'])
                except json.JSONDecodeError as e:
                    return Response({"detail": f"Invalid JSON in layer_configuration: {str(e)}"}, 
                                status=status.HTTP_400_BAD_REQUEST)

            # Process the serializer
            serializer = self.get_serializer(data=data)
            
            # Detailed validation error logging
            if not serializer.is_valid():
                print(f"[Backend View] Serializer validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            print(f"[Backend View] Successfully created MapConfiguration: {serializer.data}")
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        except Exception as e:
            print(f"[Backend View] Error in MapConfigurationViewSet.create: {str(e)}")
            import traceback
            print(traceback.format_exc())
            # Return a more specific error if possible
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