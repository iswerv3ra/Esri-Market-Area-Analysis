import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  className = "",
  filterCategory = null // New prop for category filtering
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // First filter by category if provided, then by search term
  const getFilteredOptions = () => {
    let filtered = options;
    
    // Filter by category first (e.g., "Heat", "Dot Density")
    if (filterCategory) {
      filtered = options.filter(option => {
        // Handle case-insensitive matching for category
        const optionCategory = option.category?.toLowerCase();
        const searchCategory = filterCategory.toLowerCase();
        
        // Support partial matching for categories like "Heat Map" matching "Heat"
        return optionCategory && optionCategory.includes(searchCategory);
      });
    }
    
    // Then filter by search term
    if (searchTerm) {
      filtered = filtered.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const filteredOptions = getFilteredOptions();

  // Find the selected option label from all options (not just filtered ones)
  const selectedOption = options.find(option => option.value === value);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search term when filter category changes
  useEffect(() => {
    setSearchTerm('');
    // Close dropdown if currently selected option doesn't match new category
    if (filterCategory && selectedOption && selectedOption.category) {
      const optionCategory = selectedOption.category.toLowerCase();
      const searchCategory = filterCategory.toLowerCase();
      if (!optionCategory.includes(searchCategory)) {
        setIsOpen(false);
      }
    }
  }, [filterCategory, selectedOption]);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  // For debugging
  console.log('Dropdown is open:', isOpen);
  console.log('Filter category:', filterCategory);
  console.log('Filtered options:', filteredOptions);

  return (
    <div className={`relative w-48 ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Selected value display */}
      <div
        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
          text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
          focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        onClick={toggleDropdown}
      >
        <div className="flex items-center justify-between">
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="fixed mt-1 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-auto"
          style={{ 
            zIndex: 9999, 
            top: dropdownRef.current?.getBoundingClientRect().bottom,
            left: dropdownRef.current?.getBoundingClientRect().left,
            width: dropdownRef.current?.offsetWidth
          }}
        >
          {/* Search input */}
          <div className="sticky top-0 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Category filter indicator */}
          {filterCategory && (
            <div className="px-4 py-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              Showing {filterCategory} options only
            </div>
          )}
          
          {/* Options list */}
          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 
                    ${option.value === value ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {option.category && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                        {option.category}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {filterCategory ? `No ${filterCategory} options found` : 'No results found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

SearchableDropdown.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      category: PropTypes.string, // New optional category field
    })
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  className: PropTypes.string,
  filterCategory: PropTypes.string, // New prop for filtering by category
};

export default SearchableDropdown;