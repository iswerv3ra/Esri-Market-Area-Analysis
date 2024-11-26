import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  HashtagIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';
import { projectsAPI } from '../services/api'; // Update this import

function generateProjectNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${year}-${random}`;
}

export default function CreateProject() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    project_number: generateProjectNumber(),
    client: '',
    location: '',
    description: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await projectsAPI.create(formData); // Use the projectsAPI
      navigate(`/projects/${response.data.id}/market-areas`);
    } catch (err) {
      console.error('Error creating project:', err);
      setError(
        err.response?.data?.detail || 
        'Failed to create project. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center text-gray-600 dark:text-gray-300 
                       hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Projects
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create New Project
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Project Number */}
            <div>
              <label 
                htmlFor="project_number" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center gap-2">
                  <HashtagIcon className="h-5 w-5" />
                  Project Number
                </div>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="project_number"
                  id="project_number"
                  required
                  value={formData.project_number}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 
                           shadow-sm py-2 px-3 focus:border-green-500 focus:ring-green-500 
                           bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white 
                           sm:text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Auto-generated number that can be modified if needed.
              </p>
            </div>

            {/* Client Name */}
            <div>
              <label 
                htmlFor="client" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="h-5 w-5" />
                  Client Name
                </div>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="client"
                  id="client"
                  required
                  value={formData.client}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 
                           shadow-sm py-2 px-3 focus:border-green-500 focus:ring-green-500 
                           bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white 
                           sm:text-sm"
                  placeholder="Enter client name"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label 
                htmlFor="location" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5" />
                  Location
                </div>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="location"
                  id="location"
                  required
                  value={formData.location}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 
                           shadow-sm py-2 px-3 focus:border-green-500 focus:ring-green-500 
                           bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white 
                           sm:text-sm"
                  placeholder="City, State or Region"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label 
                htmlFor="description" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5" />
                  Project Description
                </div>
              </label>
              <div className="mt-1">
                <textarea
                  name="description"
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 
                           shadow-sm py-2 px-3 focus:border-green-500 focus:ring-green-500 
                           bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white 
                           sm:text-sm"
                  placeholder="Enter project description (optional)"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm text-sm font-medium text-gray-700 
                         dark:text-gray-300 bg-white dark:bg-gray-700 
                         hover:bg-gray-50 dark:hover:bg-gray-600 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 
                         focus:ring-green-500 dark:focus:ring-offset-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex justify-center px-4 py-2 border border-transparent 
                         rounded-md shadow-sm text-sm font-medium text-white 
                         bg-green-600 hover:bg-green-700 focus:outline-none 
                         focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                         dark:focus:ring-offset-gray-900 disabled:bg-green-400 
                         disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}