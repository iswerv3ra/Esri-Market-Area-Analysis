import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { tcgThemesAPI } from '../../services/api';
import { toast } from 'react-hot-toast';

const ThemeSelector = ({ onThemeSelect, isOpen, onClose }) => {
  const [themes, setThemes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const categoryOrder = useMemo(() => [
    'Core Study',
    'Submarkets With Comps 1-11',
    'Submarkets Without Comps 12-16',
    'Additional MSAs'
  ], []);

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const response = await tcgThemesAPI.getAll();
        const themeData = response.data;

        // Group themes by category
        const grouped = themeData.reduce((acc, theme) => {
          let category;
          const submarketNumber = theme.theme_name.match(/Submarket (\d+)/)?.[1];
          
          if (theme.theme_name.includes('Subject MSA') || !theme.theme_name.match(/Submarket|MSA/)) {
            category = 'Core Study';
          } else if (submarketNumber) {
            const num = parseInt(submarketNumber);
            category = num <= 11 ? 'Submarkets With Comps 1-11' : 'Submarkets Without Comps 12-16';
          } else if (theme.theme_name.includes('MSA')) {
            category = 'Additional MSAs';
          }

          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(theme);
          return acc;
        }, {});

        // Sort themes within each category
        Object.keys(grouped).forEach(category => {
          grouped[category].sort((a, b) => {
            const aNum = parseInt(a.theme_name.match(/\d+/)?.[0] || '0');
            const bNum = parseInt(b.theme_name.match(/\d+/)?.[0] || '0');
            return aNum - bNum;
          });
        });

        setThemes(grouped);
        setLoading(false);
      } catch (error) {
        console.error('Error loading themes:', error);
        setError('Failed to load themes');
        setLoading(false);
      }
    };

    fetchThemes();
  }, []);

  const getColorName = (theme) => {
    if (theme.color_key && theme.color_key.color_name) {
      return theme.color_key.color_name;
    }
    return 'Default';
  };

  const getBackgroundColor = (theme) => {
    if (theme.color_key) {
      return `rgb(${theme.color_key.R}, ${theme.color_key.G}, ${theme.color_key.B})`;
    }
    return theme.fill_color || '#0078D4';
  };

  const handleThemeClick = (theme) => {
    try {
      // Convert transparency percentage directly to opacity
      const transparencyPercent = parseInt(theme.transparency) || 35;
      const opacity = 1 - (transparencyPercent / 100);  // Invert the calculation
  
      // Get hex value instead of building 'rgb(...)'
      const fillColorHex = theme.color_key?.Hex || theme.fill_color || '#0078D4';
  
      const styleSettings = {
        themeName: theme.theme_name,
        fillColor: fillColorHex,
        fillOpacity: opacity,
        borderColor: fillColorHex,
        borderWidth:
          theme.border === 'Yes'
            ? theme.weight && theme.weight !== '-'
              ? parseInt(theme.weight)
              : 3
            : 0,
        excelFill: fillColorHex,  // Always use the theme's fill color
        excelText:
          theme.excel_text === 'Black'
            ? '#000000'
            : theme.excel_text === 'White'
            ? '#ffffff'
            : theme.excel_text || '#000000',
        noFill: theme.fill !== 'Yes',
        noBorder: theme.border !== 'Yes',
      };
  
      onThemeSelect(styleSettings);
      onClose();
      toast.success(`Theme style applied: ${theme.theme_name}`);
    } catch (err) {
      console.error('Error applying theme:', err);
      toast.error('Failed to apply theme');
    }
  };
  
  // Prevent clicks inside the modal from closing it
  const handleDialogClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (!isOpen) return null;

  // Create portal for modal
  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={handleDialogClick}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Theme
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-500 dark:text-gray-400">Loading themes...</div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center">{error}</div>
          ) : (
            categoryOrder.map((category) => themes[category] && (
              <div key={category} className="mb-8 last:mb-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {themes[category].map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleThemeClick(theme);
                      }}
                      className="flex items-center space-x-2 p-3 text-left rounded-lg 
                               border border-gray-200 dark:border-gray-700
                               hover:bg-gray-50 dark:hover:bg-gray-700
                               focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ 
                          backgroundColor: getBackgroundColor(theme),
                          opacity: theme.fill === 'Yes' ? 1 : 0.65
                        }}
                      />
                      <span className="text-sm text-gray-900 dark:text-white flex-1">
                        {theme.theme_name}
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          {getColorName(theme)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ThemeSelector;