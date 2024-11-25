import { useState, useEffect, Fragment, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { 
  ChevronDownIcon, 
  ArrowLeftIcon,
  PhotoIcon, 
  MapIcon,
  TableCellsIcon,
  CodeBracketSquareIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  ListBulletIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useMap } from '../../contexts/MapContext';
import axios from 'axios';

export default function Toolbar({ onCreateMA, onToggleList }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { mapView } = useMap();

  const GEOCODING_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

  const handleBack = () => {
    navigate('/');
  };

  // Handle search input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 3) {
        setSuggestions([]);
        setIsDropdownOpen(false);
        return;
      }

      try {
        const response = await axios.get("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest", {
          params: {
            f: 'json',
            text: searchQuery,
            maxSuggestions: 5,
            token: GEOCODING_API_KEY,
          },
        });

        setSuggestions(response.data.suggestions || []);
        setIsDropdownOpen(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setIsDropdownOpen(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, GEOCODING_API_KEY]);

  // Handle clicking outside the search input to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle selecting a suggestion
  const handleSelectSuggestion = async (suggestion) => {
    setSearchQuery(suggestion.text);
    setIsDropdownOpen(false);

    if (!mapView) {
      console.error("MapView instance is not available.");
      return;
    }

    try {
      const response = await axios.get("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates", {
        params: {
          f: 'json',
          singleLine: suggestion.text,
          maxLocations: 1,
          outFields: 'location',
          token: GEOCODING_API_KEY,
        },
      });

      if (response.data.candidates && response.data.candidates.length > 0) {
        const { x, y } = response.data.candidates[0].location;
        mapView.center = [x, y];
        mapView.zoom = 12;
        console.log(`Map centered at: [${x}, ${y}]`);
      } else {
        console.warn("No location found for the selected suggestion.");
      }
    } catch (error) {
      console.error("Error fetching location details:", error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="h-14 px-4 flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 
                     dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Projects
          </button>

          <Menu as="div" className="relative">
            <Menu.Button className="inline-flex items-center px-3 py-2 text-sm 
                                  text-gray-600 hover:text-gray-900 dark:text-gray-300 
                                  dark:hover:text-white">
              Actions
              <ChevronDownIcon className="ml-2 h-5 w-5" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md 
                                   bg-white dark:bg-gray-700 shadow-lg ring-1 ring-black 
                                   ring-opacity-5 focus:outline-none">
                {/* Export Options */}
                <div className="py-1">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Export Options
                  </div>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <TableCellsIcon className="mr-3 h-5 w-5" />
                        Export Data
                      </button>
                    )}
                  </Menu.Item>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <PhotoIcon className="mr-3 h-5 w-5" />
                        Export JPEG
                      </button>
                    )}
                  </Menu.Item>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <MapIcon className="mr-3 h-5 w-5" />
                        Export MXD
                      </button>
                    )}
                  </Menu.Item>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <DocumentArrowDownIcon className="mr-3 h-5 w-5" />
                        Export Definitions
                      </button>
                    )}
                  </Menu.Item>
                </div>

                {/* Import Options */}
                <div className="border-t border-gray-100 dark:border-gray-600">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Import Options
                  </div>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <CodeBracketSquareIcon className="mr-3 h-5 w-5" />
                        Import MA JSON
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 max-w-2xl mx-4 relative" ref={searchInputRef}>
          <div className="relative">
            <MagnifyingGlassIcon 
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" 
            />
            <input
              type="text"
              placeholder="Search for zip, state, city, or county..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 pl-10 pr-3 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:border-green-500 dark:focus:border-green-400
                       focus:outline-none focus:ring-1 focus:ring-green-500"
            />

            {/* Search Suggestions Dropdown */}
            {isDropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 
                            border border-gray-300 dark:border-gray-600 rounded-md 
                            shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 
                             dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 
                             focus:outline-none"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onCreateMA}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white 
                     rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 
                     focus:ring-green-400"
          >
            <PlusIcon className="h-5 w-5" />
            Create New MA
          </button>
          <button
            onClick={onToggleList}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white 
                     rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 
                     focus:ring-blue-400"
          >
            <ListBulletIcon className="h-5 w-5" />
            Toggle MA List
          </button>
        </div>
      </div>
    </div>
  );
}