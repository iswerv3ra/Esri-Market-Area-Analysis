// DotDensityEditor.jsx
'use client'; // Add if using Next.js App Router or similar framework features

import React from 'react';

const DotDensityEditor = ({ config, onChange, selectedAreaType, onPreview }) => {
  // --- Guard Clause ---
  if (!config) {
    console.warn("DotDensityEditor received null config.");
    return <div className="p-4 text-gray-500 dark:text-gray-400">Loading configuration...</div>;
  }

  // --- Helper Functions ---
  // Determine default dot value based on area type
  const getDefaultDotValue = () => {
    if (!selectedAreaType || typeof selectedAreaType.value !== 'number') {
        console.warn("DotDensityEditor: Invalid selectedAreaType, using default dot value 1.", selectedAreaType);
        return 1; // Default if area type is invalid
    }
    if (selectedAreaType.value === 11) return 100; // County level (typically larger areas)
    if (selectedAreaType.value === 12) return 10;  // Census tract level (smaller areas)
    // Add more cases if other area types exist
    return 1; // Default for unknown area types
  };

  // --- State Synchronization & Safe Config ---
  // Ensure attributes array exists and has at least one element
  const safeAttributes = (config.attributes && Array.isArray(config.attributes) && config.attributes.length > 0)
    ? config.attributes
    : [{ field: config.field || 'value', color: '#E60049', label: config.label || config.field || 'Data', value: undefined }]; // Provide default structure if missing

  // Determine the actual dot value, synchronizing config.dotValue and attributes[0].value
  let actualValue;
  const valueFromAttribute = safeAttributes[0]?.value;
  const valueFromConfig = config.dotValue;

  if (valueFromAttribute !== undefined && !isNaN(parseInt(valueFromAttribute))) {
    actualValue = parseInt(valueFromAttribute);
  } else if (valueFromConfig !== undefined && !isNaN(parseInt(valueFromConfig))) {
    actualValue = parseInt(valueFromConfig);
  } else {
    actualValue = getDefaultDotValue(); // Fallback to default based on area type
  }
  // Ensure minimum value is 1
  actualValue = Math.max(1, actualValue);

  // Create a working config copy with synchronized values for the UI
  const safeConfig = {
    ...config,
    dotSize: config.dotSize !== undefined && !isNaN(parseFloat(config.dotSize)) ? Math.max(0.5, parseFloat(config.dotSize)) : 1, // Default size 1, min 0.5
    dotValue: actualValue, // Use the synchronized value
    // Ensure attributes array exists and the first attribute's value is synced
    attributes: safeAttributes.map((attr, index) => ({
      ...attr,
      // Ensure essential fields exist even if original was partial
      field: attr.field || config.field || 'value',
      color: attr.color || '#E60049',
      label: attr.label || config.label || attr.field || config.field || 'Data',
      value: index === 0 ? actualValue : (attr.value !== undefined ? attr.value : actualValue) // Sync first attribute, keep others if they exist
    }))
  };
  // --- End State Synchronization ---


  // --- Event Handlers ---
  const handleValueChange = (key, value, parser = parseFloat, min = 0, max = Infinity) => {
    let parsedValue = parser(value);

    // Handle potential NaN from parsing empty strings or invalid input in number fields
    if (isNaN(parsedValue)) {
        // Allow empty input during typing, but don't propagate NaN config
        if (value === '' || value === '-' || value === '.') {
             // We could potentially store the intermediate string value in local state
             // but for now, we just prevent updating the main config with NaN
             return;
        }
        // If not a valid intermediate state, revert to minimum or previous valid value
        parsedValue = min; // Or consider using safeConfig[key] if needed
    }


    // Clamp the value within bounds
    const clampedValue = Math.max(min, Math.min(max, parsedValue));

    // Create a deep clone for the update
    const updatedConfig = JSON.parse(JSON.stringify(safeConfig));

    // Update the specific key
    updatedConfig[key] = clampedValue;

    // Special handling for dotValue - needs to sync with attributes
    if (key === 'dotValue') {
      updatedConfig.attributes = updatedConfig.attributes.map((attr, index) => ({
        ...attr,
        value: index === 0 ? clampedValue : (attr.value !== undefined ? attr.value : clampedValue) // Sync first attribute's value
      }));
    }

    console.log(`DotDensityEditor: Updated ${key} to`, clampedValue, "Updating config:", updatedConfig);

    // Propagate changes up
    onChange(updatedConfig);
    if (onPreview) {
      // Debounce preview slightly
      setTimeout(() => onPreview(updatedConfig), 150); // Slightly longer delay for number inputs
    }
  };

  const handleColorChange = (value) => {
    const updatedConfig = JSON.parse(JSON.stringify(safeConfig));

    // Update the color in the first attribute (assuming single attribute dot density for now)
    if (updatedConfig.attributes && updatedConfig.attributes.length > 0) {
        updatedConfig.attributes[0].color = value;
    } else {
        // Handle case where attributes might be missing (should be rare with safeConfig)
        updatedConfig.attributes = [{ ...(safeConfig.attributes[0] || {}), color: value }];
    }


    console.log("DotDensityEditor: Updated color to", value, "Updating config:", updatedConfig);

    onChange(updatedConfig);
    if (onPreview) {
      setTimeout(() => onPreview(updatedConfig), 100);
    }
  };
  // --- End Event Handlers ---


  // --- Recommended Value Display ---
  const recommendedValue = getDefaultDotValue();
  // --- End Recommended Value Display ---

  return (
    <div className="space-y-4">
       <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 border-b pb-2 mb-4">
         Dot Density Style
       </h3>

      {/* Dot Size */}
      <div className="space-y-1">
        <label htmlFor="dot-size" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Dot Size (px)
        </label>
        <input
          id="dot-size"
          type="number"
          value={safeConfig.dotSize}
          onChange={(e) => handleValueChange('dotSize', e.target.value, parseFloat, 0.5, 10)}
          min="0.5"
          max="10"
          step="0.1" // Finer control for size
          className="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   border border-gray-300 dark:border-gray-700 rounded"
        />
         <p className="text-xs text-gray-500 dark:text-gray-400">Adjusts the visual size of each dot (0.5-10).</p>
      </div>

      {/* Dot Value (e.g., People per Dot) */}
      <div className="space-y-1">
        <label htmlFor="dot-value" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Value per Dot (e.g., People)
        </label>
        <input
          id="dot-value"
          type="number"
          value={safeConfig.dotValue} // Render the synchronized value
          onChange={(e) => handleValueChange('dotValue', e.target.value, parseInt, 1, Infinity)}
          min="1" // Minimum value per dot must be 1
          step="1" // Usually whole numbers make sense here
          className="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   border border-gray-300 dark:border-gray-700 rounded"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
            Sets how much value each dot represents. Recommended for {selectedAreaType?.label || 'current geography'}: {recommendedValue}
        </p>
      </div>

      {/* Dot Color */}
      <div className="space-y-1">
        <label htmlFor="dot-color" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Dot Color
        </label>
        <input
          id="dot-color"
          type="color"
          // Use color from the (potentially created) first attribute
          value={safeConfig.attributes[0]?.color || '#E60049'} // Default color if missing
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-full h-10 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
        />
         <p className="text-xs text-gray-500 dark:text-gray-400">Choose the color for the dots.</p>
      </div>

      {/* Display Field (Read-only for now) */}
      <div className="space-y-1">
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
           Data Field
         </label>
         <input
           type="text"
           value={safeConfig.field || 'N/A'}
           readOnly
           className="w-full p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                    border border-gray-300 dark:border-gray-600 rounded cursor-not-allowed"
         />
          <p className="text-xs text-gray-500 dark:text-gray-400">The data field used for this visualization.</p>
      </div>

       {/* Legend Label (Read-only based on attribute) */}
       <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Legend Label
          </label>
          <input
            type="text"
            value={safeConfig.attributes[0]?.label || 'N/A'}
            readOnly
            className="w-full p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                     border border-gray-300 dark:border-gray-600 rounded cursor-not-allowed"
          />
           <p className="text-xs text-gray-500 dark:text-gray-400">Label shown in the map legend.</p>
       </div>

    </div>
  );
};

export default DotDensityEditor;