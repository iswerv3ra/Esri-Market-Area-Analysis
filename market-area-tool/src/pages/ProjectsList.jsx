import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  CalendarIcon,
  MapIcon,
  XCircleIcon,
  TrashIcon,
  PencilIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { projectsAPI } from '../services/api';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ 
    isOpen: false, 
    projectId: null, 
    projectName: '' 
  });
  const [editModal, setEditModal] = useState({ 
    isOpen: false, 
    projectId: null, 
    projectData: null,
    isSubmitting: false
  });
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsAPI.getAll();
        if (response.data && response.data.length > 0) {
          setProjects(response.data);
        } else {
          setProjects([]);
          setError('No projects found');
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setError('Failed to load projects');

        if (error.response?.status === 401) {
          // Handle unauthorized access
          // You might want to redirect to login or refresh token
        } else if (error.request) {
          setError('No response from server');
        } else {
          setError('Error setting up project request');
        }
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) {
      return [];
    }
    return projects.filter(project => {
      if (!project) return false;
      const searchString = [
        project.project_number,
        project.client,
        project.location
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchString.includes(searchTerm.toLowerCase());
    });
  }, [projects, searchTerm]);

  const handleProjectClick = async (projectId) => {
    try {
      const response = await projectsAPI.retrieve(projectId);
      console.log('Full project response:', response.data);
      navigate(`/projects/${projectId}/market-areas`, { replace: true });
      window.location.reload();
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.detail || 'Failed to load project details';
      alert(errorMessage);
    }
  };

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  const handleDeleteProject = async () => {
    try {
      await projectsAPI.delete(deleteConfirmation.projectId);
      setProjects(projects.filter(p => p.id !== deleteConfirmation.projectId));
      setDeleteConfirmation({ isOpen: false, projectId: null, projectName: '' });
      alert('Project deleted successfully');
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(err.response?.data?.detail || 'Failed to delete project');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editModal.isSubmitting) return; // Prevent double submission
    
    setEditModal(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      await projectsAPI.update(editModal.projectId, editModal.projectData);
      
      // Update the projects list with edited data
      setProjects(projects.map(project => 
        project.id === editModal.projectId 
          ? { ...project, ...editModal.projectData }
          : project
      ));
      
      // Close modal and reset state
      setEditModal({ 
        isOpen: false, 
        projectId: null, 
        projectData: null, 
        isSubmitting: false 
      });
      
      // Show success message
      alert('Project updated successfully');
    } catch (err) {
      console.error('Error updating project:', err);
      alert(err.response?.data?.detail || 'Failed to update project');
    } finally {
      setEditModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Projects</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your market area analysis projects
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={handleCreateProject}
              className="inline-flex items-center px-4 py-2 border border-transparent 
                       text-sm font-medium rounded-md shadow-sm text-white 
                       bg-green-600 hover:bg-green-700 focus:outline-none 
                       focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                       dark:focus:ring-offset-gray-900"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create New Project
            </button>
          </div>
        </div>

        {/* Search Section */}
        <div className="mt-6 max-w-2xl">
          <div className="relative rounded-md shadow-sm">
            <MagnifyingGlassIcon 
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" 
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects by number, client, or location..."
              className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 
                       text-sm placeholder-gray-500 focus:border-green-500 
                       focus:ring-1 focus:ring-green-500 dark:bg-gray-700
                       dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="mt-8 space-y-4">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group rounded-lg bg-white dark:bg-gray-800 p-6 shadow 
                         hover:shadow-md transition-all duration-200 border border-gray-100
                         dark:border-gray-700 hover:border-green-100 dark:hover:border-green-900"
              >
                <div className="flex justify-between items-start">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white 
                                 group-hover:text-green-600 dark:group-hover:text-green-400 
                                 flex items-center gap-2"
                    >
                      {project.project_number} - {project.client}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {project.location}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Modified {new Date(project.last_modified).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapIcon className="h-4 w-4" />
                        <span>{project.market_areas_count} Market Areas</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditModal({ 
                          isOpen: true, 
                          projectId: project.id,
                          projectData: {
                            project_number: project.project_number,
                            client: project.client,
                            location: project.location,
                            description: project.description || ''
                          },
                          isSubmitting: false
                        });
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-full 
                              hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Edit project"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmation({ 
                          isOpen: true, 
                          projectId: project.id,
                          projectName: `${project.project_number} - ${project.client}`
                        });
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-full 
                              hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete project"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : searchTerm ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No projects match your search "{searchTerm}"
              </p>
              <button 
                onClick={() => setSearchTerm('')}
                className="mt-4 text-sm font-medium text-green-600 hover:text-green-500"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <MapIcon className="h-full w-full" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No projects</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new project.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleCreateProject}
                  className="inline-flex items-center px-4 py-2 border border-transparent 
                           text-sm font-medium rounded-md shadow-sm text-white 
                           bg-green-600 hover:bg-green-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create New Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Project Modal */}
        {editModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Edit Project
              </h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <BuildingOfficeIcon className="h-5 w-5" />
                      Project Number
                    </div>
                  </label>
                  <input
                    type="text"
                    value={editModal.projectData?.project_number || ''}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      projectData: { ...prev.projectData, project_number: e.target.value }
                    }))}
                    disabled={editModal.isSubmitting}
                    className="mt-1 block w-full rounded-md border border-gray-300 
                             dark:border-gray-600 shadow-sm py-2 px-3 
                             focus:border-green-500 focus:ring-green-500 
                             bg-gray-50 dark:bg-gray-700 text-gray-900 
                             dark:text-white sm:text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <BuildingOfficeIcon className="h-5 w-5" />
                      Client
                    </div>
                  </label>
                  <input
                    type="text"
                    value={editModal.projectData?.client || ''}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      projectData: { ...prev.projectData, client: e.target.value }
                    }))}
                    disabled={editModal.isSubmitting}
                    className="mt-1 block w-full rounded-md border border-gray-300 
                             dark:border-gray-600 shadow-sm py-2 px-3 
                             focus:border-green-500 focus:ring-green-500 
                             bg-gray-50 dark:bg-gray-700 text-gray-900 
                             dark:text-white sm:text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-5 w-5" />
                      Location
                    </div>
                  </label>
                  <input
                    type="text"
                    value={editModal.projectData?.location || ''}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      projectData: { ...prev.projectData, location: e.target.value }
                    }))}
                    disabled={editModal.isSubmitting}
                    className="mt-1 block w-full rounded-md border border-gray-300 
                             dark:border-gray-600 shadow-sm py-2 px-3 
                             focus:border-green-500 focus:ring-green-500 
                             bg-gray-50 dark:bg-gray-700 text-gray-900 
                             dark:text-white sm:text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5" />
                      Description
                    </div>
                  </label>
                  <textarea
                    value={editModal.projectData?.description || ''}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      projectData: { ...prev.projectData, description: e.target.value }
                    }))}
                    disabled={editModal.isSubmitting}
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 
                             dark:border-gray-600 shadow-sm py-2 px-3 
                             focus:border-green-500 focus:ring-green-500 
                             bg-gray-50 dark:bg-gray-700 text-gray-900 
                             dark:text-white sm:text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditModal({ 
                      isOpen: false, 
                      projectId: null, 
                      projectData: null,
                      isSubmitting: false
                    })}
                    disabled={editModal.isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 
                             bg-white border border-gray-300 rounded-md 
                             hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 
                             dark:border-gray-600 dark:hover:bg-gray-600
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editModal.isSubmitting}
                    className="relative px-4 py-2 text-sm font-medium text-white 
                             bg-green-600 rounded-md hover:bg-green-700 
                             focus:outline-none focus:ring-2 focus:ring-offset-2 
                             focus:ring-green-500 min-w-[100px]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center justify-center"
                  >
                    {editModal.isSubmitting ? (
                      <>
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                        <span className="opacity-0">Save Changes</span>
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Delete Project
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{deleteConfirmation.projectName}"? 
                This will permanently remove the project and all its market areas. 
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmation({ isOpen: false, projectId: null, projectName: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white 
                           border border-gray-300 rounded-md hover:bg-gray-50
                           dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 
                           dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 
                           rounded-md hover:bg-red-700 focus:outline-none 
                           focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}