import json
from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Count
from .models import Project, MarketArea, StylePreset, VariablePreset, ColorKey, TcgTheme, EnrichmentUsage, MapConfiguration, LabelPosition  

class ColorKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ColorKey
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'last_modified']

# serializers.py - Update LabelPositionSerializer
class LabelPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabelPosition
        fields = ['id', 'project', 'map_configuration', 'label_id', 'x_offset',
                 'y_offset', 'font_size', 'text', 'visibility', 'font_weight',
                 'has_background', 'background_color', 'last_modified']
        read_only_fields = ['id', 'created_at', 'last_modified', 'created_by']

class TcgThemeSerializer(serializers.ModelSerializer):
    color_key = ColorKeySerializer(read_only=True)
    color_key_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = TcgTheme
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'last_modified', 'color_key']

    def update(self, instance, validated_data):
        color_key_id = validated_data.pop('color_key_id', None)
        fill_color = validated_data.get('fill_color')

        if color_key_id:
            try:
                color_key = ColorKey.objects.get(id=color_key_id)
                instance.color_key = color_key
                instance.fill_color = color_key.key_number
            except ColorKey.DoesNotExist:
                raise serializers.ValidationError({'color_key_id': 'Invalid Color Key ID.'})
        elif fill_color:
            instance.fill_color = fill_color
            instance.color_key = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_active']
        read_only_fields = ['id']

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['is_admin'] = instance.is_staff  # Explicitly add admin status
        return rep

class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['is_active', 'is_staff', 'email']

class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long")
        return value

class EnrichmentUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrichmentUsage
        fields = ['id', 'user', 'project', 'cost', 'timestamp']

class MarketAreaSerializer(serializers.ModelSerializer):
    project_number = serializers.ReadOnlyField(source='project.project_number')
    
    class Meta:
        model = MarketArea
        fields = [
            'id', 'name', 'short_name', 'ma_type', 'geometry',
            'style_settings', 'locations', 'radius_points', 'drive_time_points',
            'site_location_data', 'created_at', 'last_modified',
            'project_number', 'order',
        ]
        read_only_fields = ['created_at', 'last_modified', 'order']

    def validate(self, data):
        ma_type = data.get('ma_type')
        site_location_data = data.get('site_location_data')
        
        # Validate site_location_data if ma_type is 'site_location'
        if ma_type == 'site_location' and site_location_data:
            # Check that site_location_data has the expected structure
            if not isinstance(site_location_data, dict):
                raise serializers.ValidationError({
                    "site_location_data": "Site location data must be a dictionary"
                })
            
            # Check for required fields in site_location_data
            point = site_location_data.get('point')
            if not point or not isinstance(point, dict):
                raise serializers.ValidationError({
                    "site_location_data": "Site location data must contain a 'point' object"
                })
            
            # Validate point coordinates
            latitude = point.get('latitude')
            longitude = point.get('longitude')
            if latitude is None or longitude is None:
                raise serializers.ValidationError({
                    "site_location_data": "Point must contain both 'latitude' and 'longitude'"
                })
            
            try:
                float(latitude)
                float(longitude)
            except (ValueError, TypeError):
                raise serializers.ValidationError({
                    "site_location_data": "Latitude and longitude must be numeric values"
                })
            
            # Validate optional fields if they exist
            size = site_location_data.get('size')
            if size is not None:
                try:
                    int(size)
                except (ValueError, TypeError):
                    raise serializers.ValidationError({
                        "site_location_data": "Size must be an integer"
                    })
            
            color = site_location_data.get('color')
            if color and not isinstance(color, str):
                raise serializers.ValidationError({
                    "site_location_data": "Color must be a string (hex code or color name)"
                })
        
        return data

class ProjectListSerializer(serializers.ModelSerializer):
    market_areas_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'client', 'location', 
            'last_modified', 'market_areas_count'
        ]

class ProjectDetailSerializer(serializers.ModelSerializer):
    market_areas = MarketAreaSerializer(many=True, read_only=True)
    users = UserSerializer(many=True, read_only=True)
    market_areas_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'client', 'location', 'description',
            'created_at', 'last_modified', 'market_areas', 
            'market_areas_count', 'users'
        ]

class StylePresetSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = StylePreset
        fields = ['id', 'name', 'project', 'styles',
                 'created_at', 'last_modified', 'created_by', 'created_by_username']
        read_only_fields = ['id', 'created_at', 'last_modified', 'created_by']

    def validate(self, data):
        styles = data.get('styles', {})
        required_fields = {'fillColor', 'fillOpacity', 'borderColor', 'borderWidth'}
        
        if not isinstance(styles, dict):
            raise serializers.ValidationError({"styles": "Styles must be a dictionary"})
        
        for ma_type, style in styles.items():
            missing_fields = required_fields - set(style.keys())
            if missing_fields:
                raise serializers.ValidationError({
                    "styles": f"Style for {ma_type} is missing required fields: {missing_fields}"
                })
            
            if not 0 <= style.get('fillOpacity', 0) <= 1:
                raise serializers.ValidationError({
                    "styles": f"Fill opacity for {ma_type} must be between 0 and 1"
                })
        
        return data

class VariablePresetSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    variable_count = serializers.SerializerMethodField()
    
    class Meta:
        model = VariablePreset
        fields = ['id', 'name', 'variables', 'is_global', 
                 'created_at', 'last_modified', 'created_by', 'created_by_username',
                 'variable_count']
        read_only_fields = ['id', 'created_at', 'last_modified', 'created_by']

    def get_variable_count(self, obj):
        return len(obj.variables)

    def validate_variables(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Variables must be a list")
        if not value:
            raise serializers.ValidationError("Variables list cannot be empty")
        return value

    def validate(self, data):
        data['is_global'] = True
        return data
    
class MapConfigurationSerializer(serializers.ModelSerializer):
    project = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = MapConfiguration
        fields = [
            'id', 'project', 'tab_name', 'visualization_type', 
            'area_type', 'layer_configuration', 
            'order', 'created_at', 'last_modified'
        ]
        read_only_fields = ['id', 'created_at', 'last_modified']

    def validate_area_type(self, value):
        valid_choices = dict(MarketArea.MARKET_AREA_TYPES)
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid area_type. Valid choices are: {list(valid_choices.keys())}")
        return value
        
    def validate_layer_configuration(self, value):
        """
        Ensure layer_configuration is properly handled whether it's a 
        JSON string or a Python dict
        """
        if value is None:
            return value
            
        # If it's already a dictionary (parsed JSON), return as is
        if isinstance(value, dict):
            return value
            
        # If it's a string, try to parse it to ensure it's valid JSON
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("layer_configuration must be valid JSON")
                
        # If it's neither a dict nor a string, raise an error
        raise serializers.ValidationError("layer_configuration must be a JSON string or a dictionary")

    def create(self, validated_data):
        try:
            project_id = validated_data.pop('project')
            project = Project.objects.get(id=project_id)
            
            # Ensure layer_configuration is stored correctly
            layer_config = validated_data.get('layer_configuration')
            if layer_config and isinstance(layer_config, dict):
                # If it's a dict, it's already been validated above
                # Django's JSONField will handle serialization
                pass
                
            return MapConfiguration.objects.create(project=project, **validated_data)
        except Project.DoesNotExist:
            raise serializers.ValidationError({"project": "Project does not exist"})
        except Exception as e:
            import traceback
            print(f"Error creating MapConfiguration: {str(e)}")
            print(traceback.format_exc())
            raise serializers.ValidationError(str(e))