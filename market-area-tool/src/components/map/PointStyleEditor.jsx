// PointStyleEditor.jsx
'use client'; // Add if using Next.js App Router or similar framework features

import React from 'react';
import { HelpCircle } from 'lucide-react'; // For tooltips

// Helper to safely get nested properties with defaults
const getConfigProp = (config, path, defaultValue) => {
  const keys = path.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null) return defaultValue;
    current = current[key];
  }
  // Ensure the final value is not undefined/null before returning
  return current !== undefined && current !== null ? current : defaultValue;
};

const PointStyleEditor = ({ config, onChange, onPreview, mapType /* 'comp' or 'pipe' */ }) => {
  if (!config) {
      console.warn("PointStyleEditor received null config.");
      return <div className="p-4 text-gray-500 dark:text-gray-400">Loading configuration...</div>;
  }

   // --- Define Default Properties based on mapType ---
   const defaultSymbolProps = {
     type: 'simple-marker',
     color: mapType === 'pipe' ? '#FFA500' : '#800080', // Orange for pipe, Purple for comp
     size: 10,
     outline: {
         color: '#FFFFFF',
         width: 1
     }
   };
   const defaultLegendProps = {
     label: mapType === 'pipe' ? 'Pipe Location' : 'Comparison Point'
   };

   // --- Get current values safely, using defaults ---
   // Use optional chaining and nullish coalescing for cleaner default handling
   const currentSymbol = config?.symbol ?? {};
   const currentLegendInfo = config?.legendInfo ?? {};

   const currentSize = currentSymbol.size ?? defaultSymbolProps.size;
   const currentColor = currentSymbol.color ?? defaultSymbolProps.color;
   const currentOutline = currentSymbol.outline ?? {};
   const currentOutlineWidth = currentOutline.width ?? defaultSymbolProps.outline.width;
   const currentOutlineColor = currentOutline.color ?? defaultSymbolProps.outline.color;
   const currentLegendLabel = currentLegendInfo.label ?? defaultLegendProps.label;


   // --- Handler for changes ---
   const handleConfigChange = (propPath, value) => {
     // Start with a deep clone of the existing config
     const updatedConfig = JSON.parse(JSON.stringify(config));

     // Ensure base objects exist before setting nested properties
     if (propPath.startsWith('symbol.') && !updatedConfig.symbol) {
       updatedConfig.symbol = { ...defaultSymbolProps }; // Initialize with defaults
     }
     if (propPath.startsWith('symbol.outline.') && updatedConfig.symbol && !updatedConfig.symbol.outline) {
       updatedConfig.symbol.outline = { ...defaultSymbolProps.outline }; // Initialize outline
     }
     if (propPath.startsWith('legendInfo.') && !updatedConfig.legendInfo) {
       updatedConfig.legendInfo = { ...defaultLegendProps }; // Initialize legendInfo
     }

     // Navigate and set the property
     const keys = propPath.split('.');
     let current = updatedConfig;
     for (let i = 0; i < keys.length - 1; i++) {
       // If a key in the path doesn't exist, create an empty object (should be rare now with initialization above)
       if (current[keys[i]] === undefined || current[keys[i]] === null) {
         current[keys[i]] = {};
       }
       current = current[keys[i]];
     }
     current[keys[keys.length - 1]] = value;

     // Ensure symbol type is correct if modifying symbol
     if (propPath.startsWith('symbol.')) {
       updatedConfig.symbol.type = 'simple-marker';
     }

     console.log(`PointStyleEditor: Updated config for path "${propPath}":`, updatedConfig); // Debug log

     // Propagate changes up
     onChange(updatedConfig);
     if (onPreview) {
       // Debounce preview slightly
       setTimeout(() => onPreview(updatedConfig), 100);
     }
   };


  // --- Render Legend Preview ---
  const renderLegendPreview = () => (
    <div className="mt-4 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Legend Preview</h4>
        <div className="flex items-center space-x-2">
            {/* Symbol Preview */}
            <div
                style={{
                    width: `${currentSize}px`,
                    height: `${currentSize}px`,
                    backgroundColor: currentColor,
                    border: `${currentOutlineWidth}px solid ${currentOutlineColor}`,
                    borderRadius: '50%', // Assuming circle marker
                    flexShrink: 0,
                }}
                 aria-hidden="true" // Indicate it's decorative
            />
            {/* Label Preview */}
            <span className="text-sm text-gray-800 dark:text-gray-100 break-all">
                {currentLegendLabel || '(No Label)'}
            </span>
        </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 border-b pb-2 mb-4">
        Point Style & Legend ({mapType === 'pipe' ? 'Pipe' : 'Comparison'})
      </h3>

      {/* --- Symbol Styling --- */}
      <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
        <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Symbol Style</legend>
         {/* Point Size */}
          <div className="space-y-1">
            <label htmlFor={`point-size-${mapType}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Size (px)
            </label>
            <input
              id={`point-size-${mapType}`}
              type="number"
              value={currentSize}
              onChange={(e) => {
                const newSize = Math.max(1, Math.min(30, parseFloat(e.target.value) || 1));
                handleConfigChange('symbol.size', newSize);
              }}
              min="1" max="30" step="1"
              className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
            />
          </div>
          {/* Point Color */}
          <div className="space-y-1">
            <label htmlFor={`point-color-${mapType}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Fill Color
            </label>
            <input
              id={`point-color-${mapType}`}
              type="color"
              value={currentColor} // Input type color expects hex
              onChange={(e) => handleConfigChange('symbol.color', e.target.value)}
              className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
            />
          </div>
           {/* Outline Width */}
           <div className="space-y-1">
             <label htmlFor={`outline-width-${mapType}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
               Outline Width (px)
             </label>
             <input
               id={`outline-width-${mapType}`}
               type="number"
               value={currentOutlineWidth}
               onChange={(e) => {
                 const newWidth = Math.max(0, Math.min(5, parseFloat(e.target.value) || 0));
                 handleConfigChange('symbol.outline.width', newWidth);
               }}
               min="0" max="5" step="0.5"
               className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
             />
           </div>
           {/* Outline Color */}
           <div className="space-y-1">
             <label htmlFor={`outline-color-${mapType}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
               Outline Color
             </label>
             <input
               id={`outline-color-${mapType}`}
               type="color"
               value={currentOutlineColor} // Input type color expects hex
               onChange={(e) => handleConfigChange('symbol.outline.color', e.target.value)}
               className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
             />
           </div>
      </fieldset>

      {/* --- Legend Configuration --- */}
       <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
         <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Legend</legend>
          <div className="space-y-1">
             <label htmlFor={`legend-label-${mapType}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
               Label
             </label>
             <input
               id={`legend-label-${mapType}`}
               type="text"
               value={currentLegendLabel}
               onChange={(e) => handleConfigChange('legendInfo.label', e.target.value)}
               placeholder={mapType === 'pipe' ? 'e.g., Pipeline Segment' : 'e.g., Comparable Property'}
               className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
             />
             {/* Tooltip */}
             <p className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
               <HelpCircle size={12} className="mr-1 flex-shrink-0" />
               <span>This label appears below the symbol in the map legend.</span>
             </p>
           </div>

           {/* Legend Preview */}
           {renderLegendPreview()}
       </fieldset>

    </div>
  );
};

export default PointStyleEditor;