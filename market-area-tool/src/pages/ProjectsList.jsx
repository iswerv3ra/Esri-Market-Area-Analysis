import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  CalendarIcon,
  MapIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects/');
        setProjects(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load projects. Please try again later.');
        console.error('Error fetching projects:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filter projects based on search term
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const searchString = [
        project.project_number,
        project.client,
        project.location,
        project.description
      ].join(' ').toLowerCase();
      
      return searchString.includes(searchTerm.toLowerCase());
    });
  }, [projects, searchTerm]);

  // Navigation handlers
  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}/market-areas`);
  };

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
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
              onClick={() => handleProjectClick(project.id)}
              className="group cursor-pointer rounded-lg bg-white dark:bg-gray-800 p-6 shadow 
                       hover:shadow-md transition-all duration-200 border border-gray-100
                       dark:border-gray-700 hover:border-green-100 dark:hover:border-green-900"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white 
                               group-hover:text-green-600 dark:group-hover:text-green-400 
                               flex items-center gap-2"
                  >
                    {project.project_number} - {project.client}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {project.location}
                  </p>
                  {project.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {project.description}
                    </p>
                  )}
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
    </div>
  );
}