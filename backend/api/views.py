from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Project, MarketArea
from .serializers import UserSerializer, ProjectSerializer, MarketAreaSerializer

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

class ProjectList(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

class ProjectDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

class MarketAreaList(generics.ListCreateAPIView):
    serializer_class = MarketAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_id')
        return MarketArea.objects.filter(
            project__owner=self.request.user, 
            project_id=project_id
        ).select_related('project')

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_id')
        project = Project.objects.get(id=project_id, owner=self.request.user)
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
            project__owner=self.request.user,
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