# serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, MarketArea, StylePreset, VariablePreset, ColorKey, TcgTheme

class ColorKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ColorKey
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'last_modified']  # Adjust as needed

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
            # If fill_color is provided but no color_key_id, clear the color_key relation
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

class MarketAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketArea
        fields = [
            'id', 'name', 'short_name', 'ma_type', 'geometry', 
            'style_settings', 'locations', 'radius_points',
            'created_at', 'last_modified'
        ]
        read_only_fields = ['created_at', 'last_modified']

    def validate(self, data):
        if data.get('ma_type') == 'radius':
            if not data.get('radius_points'):
                raise serializers.ValidationError(
                    {"radius_points": "Radius points are required for radius type market areas"}
                )
        elif not data.get('locations'):
            raise serializers.ValidationError(
                {"locations": "Locations are required for non-radius type market areas"}
            )
        return data

class ProjectSerializer(serializers.ModelSerializer):
    market_areas = MarketAreaSerializer(many=True, read_only=True)
    market_areas_count = serializers.IntegerField(source='market_areas.count', read_only=True)
    users = UserSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'client', 'location', 'description',
            'created_at', 'last_modified', 'market_areas', 'market_areas_count',
            'users'
        ]
        read_only_fields = ['id', 'created_at', 'last_modified']

    def create(self, validated_data):
        project = Project.objects.create(
            project_number=validated_data['project_number'],
            client=validated_data['client'],
            location=validated_data['location'],
            description=validated_data.get('description', '')
        )
        all_users = User.objects.all()
        project.users.set(all_users)
        return project

class StylePresetSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = StylePreset
        fields = ['id', 'name', 'project', 'styles', 'is_global', 
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
        fields = ['id', 'name', 'project', 'variables', 'is_global', 
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
        if data.get('is_global') and data.get('project'):
            raise serializers.ValidationError(
                {"is_global": "Global presets cannot be associated with a specific project"}
            )
        return data
