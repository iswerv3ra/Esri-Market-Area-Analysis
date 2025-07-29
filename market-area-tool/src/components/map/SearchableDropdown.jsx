import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  className = "",
  filterCategory = null, // New prop for category filtering
  showCategoryGroups = true // New prop to enable/disable category grouping
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownHeight, setDropdownHeight] = useState(600); // Higher default
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // Calculate optimal dropdown height with aggressive expansion
  const calculateDropdownHeight = () => {
    if (!dropdownRef.current) return 700; // Very generous default
    
    try {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // Calculate aggressive height - prioritize showing many items
      const reservedSpace = 60; // Minimal space for margins and search
      const availableHeight = spaceBelow - reservedSpace;
      
      // Very generous minimum to ensure many items are visible
      const minDropdownHeight = 600; 
      // Use most of viewport height if needed
      const maxDropdownHeight = Math.floor(viewportHeight * 0.85);
      
      // Choose the most generous option that fits
      if (availableHeight >= minDropdownHeight) {
        return Math.min(availableHeight, maxDropdownHeight);
      } else {
        // If not enough space below, still use generous minimum
        return Math.min(minDropdownHeight, maxDropdownHeight);
      }
    } catch (error) {
      console.warn('Error calculating dropdown height:', error);
      return 700; // Fallback to generous default
    }
  };

  // Categorize options based on visualizationOptions structure to match exactly
  const categorizeOption = (option) => {
    const value = option.value.toLowerCase();
    
    // Population & Households - Exact matches from visualizationOptions
    if (value === 'totpop_cy' || value === 'totpop_cy_heat' || 
        value === 'tothh_cy' || value === 'tothh_cy_heat' || 
        value === 'avghhsz_cy_heat') {
      return 'Population & Households';
    }
    
    // Daytime Population - Exact matches
    if (value === 'dpop_cy' || value === 'dpop_cy_heat' || 
        value === 'dpopwrk_cy' || value === 'dpopwrk_cy_heat' || 
        value === 'dpopres_cy' || value === 'dpopres_cy_heat') {
      return 'Daytime Population';
    }
    
    // Age - Basic age groups only (not detailed breakdowns)
    if (value === 'medage_cy' || value === 'medage_cy_heat' || 
        value === 'workage_cy' || value === 'workage_cy_heat' || 
        value === 'senior_cy' || value === 'senior_cy_heat' || 
        value === 'child_cy' || value === 'child_cy_heat') {
      return 'Age';
    }
    
    // Income - All household income related variables
    if (value === 'medhinc_cy_heat' || value === 'avghinc_cy_heat' || value === 'unemprt_cy_heat' ||
        value === 'hinc0_cy' || value === 'hinc0_cy_heat' || 
        value === 'hinc15_cy' || value === 'hinc15_cy_heat' ||
        value === 'hinc25_cy' || value === 'hinc25_cy_heat' ||
        value === 'hinc35_cy' || value === 'hinc35_cy_heat' ||
        value === 'hinc50_cy' || value === 'hinc50_cy_heat' ||
        value === 'hinc75_cy' || value === 'hinc75_cy_heat' ||
        value === 'hinc100_cy' || value === 'hinc100_cy_heat' ||
        value === 'hinc150_cy' || value === 'hinc150_cy_heat' ||
        value === 'hinc200_cy' || value === 'hinc200_cy_heat') {
      return 'Income';
    }
    
    // Projected Growth - 2024-2029 CAGR metrics
    if (value === 'popgrwcyfy_heat' || value === 'hhgrwcyfy_heat' || value === 'mhigrwcyfy_heat') {
      return 'Projected Growth';
    }
    
    // Historical Growth - 2020-2024 CAGR metrics  
    if (value === 'popgrw20cy_heat' || value === 'hhgrw20cy_heat') {
      return 'Historical Growth';
    }
    
    // Housing - All housing variables including home values
    if (value === 'tothu_cy' || value === 'tothu_cy_heat' || 
        value === 'owner_cy' || value === 'owner_cy_heat' || 
        value === 'renter_cy' || value === 'renter_cy_heat' || 
        value === 'pcthomeowner_heat' || 
        value === 'vacant_cy' || value === 'vacant_cy_heat' || 
        value === 'vacant_cy_pct_heat' || 
        value === 'medval_cy_heat' || value === 'avgval_cy_heat' ||
        // Home Value Ranges
        value === 'val0_cy' || value === 'val0_cy_heat' ||
        value === 'val50k_cy' || value === 'val50k_cy_heat' ||
        value === 'val100k_cy' || value === 'val100k_cy_heat' ||
        value === 'val150k_cy' || value === 'val150k_cy_heat' ||
        value === 'val200k_cy' || value === 'val200k_cy_heat' ||
        value === 'val250k_cy' || value === 'val250k_cy_heat' ||
        value === 'val300k_cy' || value === 'val300k_cy_heat' ||
        value === 'val400k_cy' || value === 'val400k_cy_heat' ||
        value === 'val500k_cy' || value === 'val500k_cy_heat' ||
        value === 'val750k_cy' || value === 'val750k_cy_heat' ||
        value === 'val1m_cy' || value === 'val1m_cy_heat' ||
        value === 'val1pt5mcy' || value === 'val1pt5mcy_heat' ||
        value === 'val2m_cy' || value === 'val2m_cy_heat') {
      return 'Housing';
    }
    
    // Age Detail - Detailed age breakdowns and generational data
    if (value === 'pop0_cy' || value === 'pop5_cy' || value === 'pop10_cy' || 
        value === 'pop15_cy' || value === 'pop20_cy' || value === 'pop25_cy' ||
        value === 'pop30_cy' || value === 'pop35_cy' || value === 'pop40_cy' ||
        value === 'pop45_cy' || value === 'pop50_cy' || value === 'pop55_cy' ||
        value === 'pop60_cy' || value === 'pop65_cy' || value === 'pop70_cy' ||
        value === 'pop75_cy' || value === 'pop80_cy' || value === 'pop85_cy' ||
        value === 'genalphacy' || value === 'genz_cy' || value === 'millenn_cy' ||
        value === 'genx_cy' || value === 'babyboomcy' || value === 'oldrgenscy') {
      return 'Age Detail';
    }
    
    // Education - All education related variables
    if (value === 'nohs_cy' || value === 'somehs_cy' || value === 'hsgrad_cy' || 
        value === 'ged_cy' || value === 'smcoll_cy' || value === 'asscdeg_cy' ||
        value === 'bachdeg_cy' || value === 'graddeg_cy' || 
        value === 'hsgrad_less_cy_pct_heat' || value === 'bachdeg_plus_cy_pct_heat' ||
        value === 'educbasecy' || value === 'educbasecy_heat') {
      return 'Education';
    }
    
    // Future - 2029 projections
    if (value === 'totpop_fy' || value === 'totpop_fy_heat' || 
        value === 'tothh_fy' || value === 'tothh_fy_heat' || 
        value === 'avghhsz_fy_heat' || value === 'medhinc_fy_heat' || 
        value === 'avghinc_fy_heat' || value === 'popdens_fy' || 
        value === 'popdens_fy_heat' || value === 'hhpop_fy' || 
        value === 'hhpop_fy_heat' || value === 'pcigrwcyfy_heat' ||
        value === 'divindx_fy_heat' || value === 'pci_fy' || value === 'pci_fy_heat') {
      return 'Future';
    }
    
    // Affluence & Affordability - Economic status indicators
    if (value === 'hai_cy_heat' || value === 'incmort_cy_heat' || 
        value === 'wlthindxcy_heat' || value === 'sei_cy_heat' || 
        value === 'pci_cy_heat') {
      return 'Affluence & Affordability';
    }
    
    // Race - All racial and ethnic demographic variables (both percentages and counts)
    if (value === 'hisppop_cy_pct_heat' || value === 'nhspwht_cy_pct_heat' || 
        value === 'nhspblk_cy_pct_heat' || value === 'nhspai_cy_pct_heat' ||
        value === 'nhspasn_cy_pct_heat' || value === 'nhsppi_cy_pct_heat' ||
        value === 'nhspoth_cy_pct_heat' || value === 'nhspmlt_cy_pct_heat' ||
        value === 'hisppop_cy' || value === 'hisppop_cy_heat' ||
        value === 'nhspwht_cy' || value === 'nhspwht_cy_heat' ||
        value === 'nhspblk_cy' || value === 'nhspblk_cy_heat' ||
        value === 'nhspai_cy' || value === 'nhspai_cy_heat' ||
        value === 'nhspasn_cy' || value === 'nhspasn_cy_heat' ||
        value === 'nhsppi_cy' || value === 'nhsppi_cy_heat' ||
        value === 'nhspoth_cy' || value === 'nhspoth_cy_heat' ||
        value === 'nhspmlt_cy' || value === 'nhspmlt_cy_heat' ||
        value === 'divindx_cy_heat' || value === 'racebasecy' || value === 'racebasecy_heat') {
      return 'Race';
    }
    
    // Employment & Labor Force - All employment related variables
    if (value === 'civlbfr_cy' || value === 'civlbfr_cy_heat' ||
        value === 'emp_cy' || value === 'emp_cy_heat' ||
        value === 'unemp_cy' || value === 'unemp_cy_heat' ||
        // Age-based employment
        value === 'civlf16_cy' || value === 'civlf16_cy_heat' ||
        value === 'empage16cy' || value === 'empage16cy_heat' ||
        value === 'unage16cy' || value === 'unage16cy_heat' ||
        value === 'unemrt16cy' || value === 'unemrt16cy_heat' ||
        value === 'civlf25_cy' || value === 'civlf25_cy_heat' ||
        value === 'empage25cy' || value === 'empage25cy_heat' ||
        value === 'unage25cy' || value === 'unage25cy_heat' ||
        value === 'unemrt25cy' || value === 'unemrt25cy_heat' ||
        value === 'civlf55_cy' || value === 'civlf55_cy_heat' ||
        value === 'empage55cy' || value === 'empage55cy_heat' ||
        value === 'unage55cy' || value === 'unage55cy_heat' ||
        value === 'unemrt55cy_heat' ||
        value === 'civlf65_cy' || value === 'civlf65_cy_heat' ||
        value === 'empage65cy' || value === 'empage65cy_heat' ||
        value === 'unage65cy' || value === 'unage65cy_heat' ||
        value === 'unemrt65cy' || value === 'unemrt65cy_heat' ||
        // Economic dependency ratios
        value === 'chldedr_cy' || value === 'chldedr_cy_heat' ||
        value === 'wrkedr_cy_heat' || value === 'senredr_cy_heat' ||
        value === 'edr_cy_heat' ||
        // Employment by race
        value === 'empwhtcy' || value === 'empwhtcy_heat' ||
        value === 'empblkcy' || value === 'empblkcy_heat' ||
        value === 'empaicy' || value === 'empaicy_heat' ||
        value === 'empasncy' || value === 'empasncy_heat' ||
        value === 'emppicy' || value === 'emppicy_heat' ||
        value === 'empothcy' || value === 'empothcy_heat' ||
        value === 'empmltcy' || value === 'empmltcy_heat' ||
        // Unemployment by race
        value === 'unwhtcy' || value === 'unwhtcy_heat' ||
        value === 'unblkcy' || value === 'unblkcy_heat' ||
        value === 'unaicy' || value === 'unaicy_heat' ||
        value === 'unasncy' || value === 'unasncy_heat' ||
        value === 'unpicy' || value === 'unpicy_heat' ||
        value === 'unothcy' || value === 'unothcy_heat' ||
        value === 'unmltcy' || value === 'unmltcy_heat' ||
        // Labor force by race
        value === 'civlfwhtcy' || value === 'civlfwhtcy_heat' ||
        value === 'civlfblkcy' || value === 'civlfblkcy_heat' ||
        value === 'civlfaicy' || value === 'civlfaicy_heat' ||
        value === 'civlfasncy' || value === 'civlfasncy_heat' ||
        value === 'civlfpicy' || value === 'civlfpicy_heat' ||
        value === 'civlfothcy' || value === 'civlfothcy_heat' ||
        value === 'civlfmltcy' || value === 'civlfmltcy_heat' ||
        // Unemployment rates by race
        value === 'unemrtwhcy_heat' || value === 'unemrtblcy_heat' ||
        value === 'unemrtaicy_heat' || value === 'unemrtascy_heat' ||
        value === 'unemrtpicy_heat' || value === 'unemrtotcy_heat' ||
        value === 'unemrtmlcy_heat') {
      return 'Employment & Labor Force';
    }
    
    // Other - All remaining variables including density, dependency ratios, disposable income, etc.
    if (value === 'popdens_cy' || value === 'popdens_cy_heat' ||
        value === 'dpopdenscy' || value === 'dpopdenscy_heat' ||
        value === 'chlddep_cy_heat' || value === 'agedep_cy_heat' ||
        value === 'senrdep_cy_heat' || value === 'hhpop_cy' || 
        value === 'hhpop_cy_heat' || value === 'gqpop_cy' || 
        value === 'gqpop_cy_heat' || value === 'males_cy' || 
        value === 'males_cy_heat' || value === 'medmage_cy' || 
        value === 'medmage_cy_heat' || value === 'females_cy' || 
        value === 'females_cy_heat' || value === 'medfage_cy' || 
        value === 'medfage_cy_heat' || value === 'gini_cy_heat' ||
        // Income inequality ratios
        value === 'rat9010_cy' || value === 'rat9010_cy_heat' ||
        value === 'rat9050_cy' || value === 'rat9050_cy_heat' ||
        value === 'rat5010_cy' || value === 'rat5010_cy_heat' ||
        value === 'shr8020_cy' || value === 'shr8020_cy_heat' ||
        value === 'shr9040_cy' || value === 'shr9040_cy_heat' ||
        // Income tiers
        value === 'lotrhh_cy' || value === 'lotrhh_cy_heat' ||
        value === 'mdtrhh_cy' || value === 'mdtrhh_cy_heat' ||
        value === 'uptrhh_cy' || value === 'uptrhh_cy_heat' ||
        // Disposable income
        value === 'di0_cy' || value === 'di0_cy_heat' ||
        value === 'di15_cy' || value === 'di15_cy_heat' ||
        value === 'di25_cy' || value === 'di25_cy_heat' ||
        value === 'di35_cy' || value === 'di35_cy_heat' ||
        value === 'di50_cy' || value === 'di50_cy_heat' ||
        value === 'di75_cy' || value === 'di75_cy_heat' ||
        value === 'di100_cy' || value === 'di100_cy_heat' ||
        value === 'di150_cy' || value === 'di150_cy_heat' ||
        value === 'di200_cy' || value === 'di200_cy_heat' ||
        value === 'meddi_cy' || value === 'meddi_cy_heat') {
      return 'Other';
    }
    
    // Default fallback
    return 'Other';
  };

  // Update dropdown height when opening or on window resize
  useEffect(() => {
    if (isOpen) {
      const height = calculateDropdownHeight();
      setDropdownHeight(height);
    }
  }, [isOpen, filterCategory]);

  // Handle window resize to recalculate dropdown height
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        const height = calculateDropdownHeight();
        setDropdownHeight(height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

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
    
    // Exclude race-related options for dot density maps
    if (filterCategory && filterCategory.toLowerCase().includes('dot')) {
      filtered = filtered.filter(option => {
        const dataCategory = categorizeOption(option);
        return dataCategory !== 'Race';
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

  // Group options by meaningful categories matching visualizationOptions structure
  const getGroupedOptions = () => {
    if (!showCategoryGroups) {
      return [{ category: null, options: filteredOptions }];
    }

    // Group by meaningful data categories
    const groups = {};
    filteredOptions.forEach(option => {
      const category = categorizeOption(option);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(option);
    });

    // Define category display order to match visualizationOptions structure exactly
    const categoryOrder = [
      'Population & Households',
      'Daytime Population', 
      'Age',
      'Income',
      'Projected Growth',
      'Historical Growth',
      'Housing',
      'Age Detail',
      'Education',
      'Future',
      'Affluence & Affordability',
      'Race',
      'Employment & Labor Force',
      'Other'
    ];

    // Convert to array and sort by predefined order
    return categoryOrder
      .map(category => ({ 
        category, 
        options: groups[category] || [] 
      }))
      .filter(group => group.options.length > 0); // Only include non-empty groups
  };

  const groupedOptions = getGroupedOptions();

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
  console.log('Calculated dropdown height:', dropdownHeight);

  return (
    <div className={`relative w-96 ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Selected value display - Fixed height, perfect width */}
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
          ref={dropdownMenuRef}
          className="fixed mt-1 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
          style={{ 
            zIndex: 9999, 
            top: dropdownRef.current?.getBoundingClientRect().bottom + 2,
            left: dropdownRef.current?.getBoundingClientRect().left,
            width: dropdownRef.current?.offsetWidth,
            height: `${dropdownHeight}px`,
            maxHeight: 'none',
            minHeight: '500px', // Ensure generous minimum
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search input */}
          <div className="flex-shrink-0 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
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
            <div className="flex-shrink-0 px-4 py-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              Showing {filterCategory} options only
            </div>
          )}
          
          {/* Options list - Expandable scrollable area with category groups */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ 
              minHeight: '400px', // Guarantee space for many options
              height: 'auto', // Let it expand naturally
              maxHeight: 'none' // Remove all height constraints
            }}
          >
            <div className="py-1">
              {groupedOptions.length > 0 ? (
                groupedOptions.map((group, groupIndex) => (
                  <div key={group.category || 'ungrouped'}>
                    {/* Category header (only show if we have multiple groups and category exists) */}
                    {group.category && groupedOptions.length > 1 && (
                      <div className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0 z-10">
                        {group.category}
                      </div>
                    )}
                    
                    {/* Options in this category */}
                    {group.options.map((option) => (
                      <div
                        key={option.value}
                        onClick={() => handleSelect(option)}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-800
                          ${option.value === value ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-200'}`}
                      >
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {filterCategory ? `No ${filterCategory} options found` : 'No results found'}
                </div>
              )}
            </div>
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
      category: PropTypes.string, // Optional category field
    })
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  className: PropTypes.string,
  filterCategory: PropTypes.string, // New prop for filtering by category
  showCategoryGroups: PropTypes.bool, // New prop to enable/disable category grouping
};

export default SearchableDropdown;