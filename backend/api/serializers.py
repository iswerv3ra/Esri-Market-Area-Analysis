from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, MarketArea

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
    
    class Meta:
        model = Project
        fields = [
            'id', 'project_number', 'client', 'location', 'description',
            'created_at', 'last_modified', 'market_areas', 'market_areas_count'
        ]
        read_only_fields = ['created_at', 'last_modified']

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)