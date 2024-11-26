import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

// Get API URL from window.configs (Choreo) or environment variable
const getApiUrl = () => {
  if (window.configs?.apiUrl) {
    return window.configs.apiUrl;
  }
  return import.meta.env.VITE_API_URL || '/choreo-apis/market-area-analysis/backend/v1';
};

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();

      // Register the user
      await axios.post(`${apiUrl}/api/user/register/`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      // Log the user in automatically
      const loginResponse = await axios.post(`${apiUrl}/api/token/`, {
        username: formData.username,
        password: formData.password,
      });

      // Store tokens
      localStorage.setItem('accessToken', loginResponse.data.access);
      localStorage.setItem('refreshToken', loginResponse.data.refresh);
      
      // Set default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${loginResponse.data.access}`;
      
      // Redirect to projects page
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Registration error:', error);
      
      // Enhanced error handling
      let errorMessage;
      if (error.response?.data) {
        // Handle different types of error responses
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          // Handle validation errors
          const firstError = Object.entries(error.response.data)[0];
          if (firstError) {
            const [field, messages] = firstError;
            errorMessage = Array.isArray(messages) ? messages[0] : messages;
          } else {
            errorMessage = 'An error occurred during registration.';
          }
        }
      } else {
        errorMessage = 'Unable to connect to the server. Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-green-600 hover:text-green-500"
            >
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border 
                         border-gray-300 dark:border-gray-600 placeholder-gray-500 
                         text-gray-900 dark:text-white bg-white dark:bg-gray-700
                         focus:outline-none focus:ring-green-500 focus:border-green-500 
                         focus:z-10 sm:text-sm"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border 
                         border-gray-300 dark:border-gray-600 placeholder-gray-500 
                         text-gray-900 dark:text-white bg-white dark:bg-gray-700
                         focus:outline-none focus:ring-green-500 focus:border-green-500 
                         focus:z-10 sm:text-sm"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border 
                         border-gray-300 dark:border-gray-600 placeholder-gray-500 
                         text-gray-900 dark:text-white bg-white dark:bg-gray-700
                         focus:outline-none focus:ring-green-500 focus:border-green-500 
                         focus:z-10 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border 
                         border-gray-300 dark:border-gray-600 placeholder-gray-500 
                         text-gray-900 dark:text-white bg-white dark:bg-gray-700
                         focus:outline-none focus:ring-green-500 focus:border-green-500 
                         focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent 
                       text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                       disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <UserPlusIcon
                  className="h-5 w-5 text-green-500 group-hover:text-green-400"
                  aria-hidden="true"
                />
              </span>
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}