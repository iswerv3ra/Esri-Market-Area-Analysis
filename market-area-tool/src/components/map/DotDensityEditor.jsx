// DotDensityEditor.jsx
'use client'; // Add if using Next.js App Router or similar framework features

import React, { useRef, useEffect, useState } from 'react';

const DotDensityEditor = ({ config, onChange, selectedAreaType, onPreview }) => {
  // --- Refs for debouncing ---
  const timeoutRefs = useRef({});
  
  // --- Local state for immediate UI updates ---
  const [localDotSize, setLocalDotSize] = useState(null);
  const [localDotValue, setLocalDotValue] = useState(null);
  const [localLegendLabel, setLocalLegendLabel] = useState(null);

  // --- Cleanup timeouts on unmount ---
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

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

  // Generate default legend label with new format: "Number per dot (Base label)"
  const getDefaultLegendLabel = (dotValue, baseLabel = 'People') => {
    return `${dotValue} per dot (${baseLabel})`;
  };

  // Extract base label from full constructed label (handles both old and new formats)
  const extractBaseLabel = (fullLabel) => {
    if (!fullLabel) return 'People';
    
    // Handle new format: "100 per dot (People)"
    const newFormatMatch = fullLabel.match(/^\d+\s+per\s+dot\s*\(([^)]+)\)$/i);
    if (newFormatMatch) {
      return newFormatMatch[1].trim();
    }
    
    // Handle old format: "100 People per Dot" (for backward compatibility)
    const oldFormatMatch = fullLabel.replace(/^\d+\s+/, '').replace(/\s+per\s+dot$/i, '');
    if (oldFormatMatch && oldFormatMatch !== fullLabel) {
      return oldFormatMatch.trim();
    }
    
    // If no pattern matches, return the full label as base (user custom format)
    return fullLabel.trim() || 'People';
  };

  // Construct full label from dot value and base description using new format
  const constructFullLabel = (dotValue, baseDescription) => {
    return `${dotValue} per dot (${baseDescription})`;
  };

  // Check if label follows the default format pattern
  const isDefaultFormatLabel = (label) => {
    return /^\d+\s+per\s+dot\s*\([^)]+\)$/i.test(label);
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
      // For user-modified labels, preserve exactly as entered. For others, use default format.
      label: attr.isUserModified ? (attr.userOriginalLabel || attr.label) : (attr.label || getDefaultLegendLabel(actualValue)),
      baseLabel: attr.baseLabel || (attr.isUserModified ? 'People' : extractBaseLabel(attr.label)) || extractBaseLabel(config.label) || 'People',
      value: index === 0 ? actualValue : (attr.value !== undefined ? attr.value : actualValue), // Sync first attribute, keep others if they exist
      isUserModified: attr.isUserModified || false, // Preserve user-modified flag
      userOriginalLabel: attr.userOriginalLabel // Preserve original user input
    }))
  };

  // Sync local state with config when config changes
  useEffect(() => {
    if (localDotSize === null) {
      setLocalDotSize(safeConfig.dotSize);
    }
    if (localDotValue === null) {
      setLocalDotValue(safeConfig.dotValue);
    }
    if (localLegendLabel === null) {
      const attr = safeConfig.attributes[0];
      
      // If there's a user-modified label, use exactly what they entered
      if (attr?.isUserModified && attr?.userOriginalLabel) {
        setLocalLegendLabel(attr.userOriginalLabel);
      } else if (attr?.isUserModified && attr?.label) {
        setLocalLegendLabel(attr.label); // Fallback to stored label
      } else {
        // Use the full constructed label for system-generated labels
        const baseDescription = attr?.baseLabel || extractBaseLabel(attr?.label) || 'People';
        const fullLabel = constructFullLabel(safeConfig.dotValue, baseDescription);
        setLocalLegendLabel(fullLabel);
      }
    }
  }, [safeConfig.dotSize, safeConfig.dotValue, safeConfig.attributes, localDotSize, localDotValue, localLegendLabel]);

  // --- End State Synchronization ---

  // --- Event Handlers ---
  const handleValueChange = (key, value, parser = parseFloat, min = 0, max = Infinity, immediate = false) => {
    let parsedValue = parser(value);

    // Handle potential NaN from parsing empty strings or invalid input in number fields
    if (isNaN(parsedValue)) {
        // Allow empty input during typing, but don't propagate NaN config
        if (value === '' || value === '-' || value === '.') {
             // Update local state immediately for UI responsiveness
             if (key === 'dotSize') {
               setLocalDotSize(value);
             } else if (key === 'dotValue') {
               setLocalDotValue(value);
             }
             
             // Clear existing timeout
             if (timeoutRefs.current[key]) {
               clearTimeout(timeoutRefs.current[key]);
             }
             
             // Set debounced update to handle partial input
             timeoutRefs.current[key] = setTimeout(() => {
               const finalParsedValue = parser(value);
               if (!isNaN(finalParsedValue)) {
                 handleValueChange(key, value, parser, min, max, true);
               }
             }, immediate ? 0 : 1000);
             
             return;
        }
        // If not a valid intermediate state, revert to minimum or previous valid value
        parsedValue = min; // Or consider using safeConfig[key] if needed
    }

    // Clamp the value within bounds
    const clampedValue = Math.max(min, Math.min(max, parsedValue));

    // Update local state immediately for UI responsiveness
    if (key === 'dotSize') {
      setLocalDotSize(clampedValue);
    } else if (key === 'dotValue') {
      setLocalDotValue(clampedValue);
    }

    // Clear existing timeout for this field
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key]);
    }

    // Function to process the update
    const processUpdate = () => {
      // Create a deep clone for the update
      const updatedConfig = JSON.parse(JSON.stringify(safeConfig));

      // Update the specific key
      updatedConfig[key] = clampedValue;

      // Special handling for dotValue - needs to sync with attributes and reconstruct legend
      if (key === 'dotValue') {
        updatedConfig.attributes = updatedConfig.attributes.map((attr, index) => {
          if (index === 0) {
            // NEVER modify user-entered labels - check multiple protection flags
            const currentLabel = attr.label || '';
            let newLabel = currentLabel;
            
            // Check if this label was manually entered by the user - if so, NEVER touch it
            if (!attr.isUserModified && !attr.userOriginalLabel && isDefaultFormatLabel(currentLabel)) {
              // It's an auto-generated default format label, so reconstruct it with new dot value
              const currentBaseLabel = attr.baseLabel || extractBaseLabel(currentLabel) || 'People';
              newLabel = constructFullLabel(clampedValue, currentBaseLabel);
              
              // Update local legend label state to reflect the change
              setLocalLegendLabel(newLabel);
            }
            // If it's user-modified in ANY way, keep the original label completely unchanged
            
            return {
              ...attr,
              value: clampedValue,
              label: newLabel, // This will be unchanged for user-modified labels
              baseLabel: attr.baseLabel || extractBaseLabel(currentLabel) || 'People',
              isUserModified: attr.isUserModified, // Preserve the user-modified flag
              userOriginalLabel: attr.userOriginalLabel // Preserve original user input
            };
          } else {
            // For other attributes, just update value if it exists
            return {
              ...attr,
              value: attr.value !== undefined ? attr.value : clampedValue
            };
          }
        });
      }

      console.log(`DotDensityEditor: Updated ${key} to`, clampedValue, "Updating config:", updatedConfig);

      // Propagate changes up
      onChange(updatedConfig);
      if (onPreview) {
        // Debounce preview slightly
        setTimeout(() => onPreview(updatedConfig), 150); // Slightly longer delay for number inputs
      }
    };

    // Execute immediately or with delay
    if (immediate) {
      processUpdate();
    } else {
      // Set debounced update
      timeoutRefs.current[key] = setTimeout(processUpdate, 1000);
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

  const handleLegendLabelChange = (value, immediate = false) => {
    // Update local state immediately for UI responsiveness
    setLocalLegendLabel(value);

    // Clear existing timeout for this field
    if (timeoutRefs.current['legendLabel']) {
      clearTimeout(timeoutRefs.current['legendLabel']);
    }

    // Function to process the update
    const processUpdate = () => {
      // Create a deep clone for the update
      const updatedConfig = JSON.parse(JSON.stringify(safeConfig));

      // Use the full legend label EXACTLY as entered by the user - NO MODIFICATIONS WHATSOEVER
      const exactUserLabel = value || getDefaultLegendLabel(safeConfig.dotValue);
      
      // Mark this as user-modified so it won't be auto-updated when dot value changes
      const isUserModified = true;

      // Update the label in the first attribute
      if (updatedConfig.attributes && updatedConfig.attributes.length > 0) {
        updatedConfig.attributes[0].label = exactUserLabel; // Store exactly what user typed
        updatedConfig.attributes[0].isUserModified = isUserModified; // Flag to prevent auto-updates
        updatedConfig.attributes[0].userOriginalLabel = exactUserLabel; // Store original for absolute protection
        // Don't extract or modify baseLabel for user-entered labels - keep existing or set default
        if (!updatedConfig.attributes[0].baseLabel) {
          updatedConfig.attributes[0].baseLabel = 'People'; // Safe default, don't extract from user input
        }
      } else {
        // Handle case where attributes might be missing (should be rare with safeConfig)
        updatedConfig.attributes = [{ 
          ...(safeConfig.attributes[0] || {}), 
          label: exactUserLabel,
          isUserModified: isUserModified,
          userOriginalLabel: exactUserLabel,
          baseLabel: 'People' // Safe default
        }];
      }

      console.log("DotDensityEditor: Updated legend label to EXACT user input:", exactUserLabel, "Marked as user-modified:", isUserModified);

      // Propagate changes up
      onChange(updatedConfig);
      if (onPreview) {
        setTimeout(() => onPreview(updatedConfig), 100);
      }
    };

    // Execute immediately or with delay
    if (immediate) {
      processUpdate();
    } else {
      // Set debounced update
      timeoutRefs.current['legendLabel'] = setTimeout(processUpdate, 800); // Slightly shorter delay for text inputs
    }
  };
  // --- End Event Handlers ---

  // --- Recommended Value Display ---
  const recommendedValue = getDefaultDotValue();
  // --- End Recommended Value Display ---

  // Get display values (local state if available, otherwise from config)
  const displayDotSize = localDotSize !== null ? localDotSize : safeConfig.dotSize;
  const displayDotValue = localDotValue !== null ? localDotValue : safeConfig.dotValue;
  
  // For legend label, show the current label (custom or default format)
  const getCurrentFullLabel = () => {
    if (localLegendLabel !== null) {
      return localLegendLabel;
    }
    
    const attr = safeConfig.attributes[0];
    if (attr?.label) {
      // If the label was manually entered by the user, NEVER modify it - return exactly as stored
      if (attr.isUserModified) {
        return attr.userOriginalLabel || attr.label; // Use the preserved original if available
      }
      
      // Only auto-update if it's a system-generated default format label
      const currentLabel = attr.label;
      const currentDotValue = displayDotValue;
      
      if (isDefaultFormatLabel(currentLabel)) {
        // Extract the number from the current label
        const labelNumberMatch = currentLabel.match(/^(\d+)\s+per\s+dot/i);
        if (labelNumberMatch && parseInt(labelNumberMatch[1]) !== currentDotValue) {
          // Reconstruct with current dot value
          const baseDescription = attr.baseLabel || extractBaseLabel(currentLabel);
          return constructFullLabel(currentDotValue, baseDescription);
        }
      }
      
      return currentLabel;
    }
    
    // Fallback to default construction with new format
    return getDefaultLegendLabel(displayDotValue);
  };
  
  const displayLegendLabel = getCurrentFullLabel();

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
          value={displayDotSize}
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
          value={displayDotValue}
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

       {/* Legend Label (Shows Full Constructed Label) */}
       <div className="space-y-1">
          <label htmlFor="legend-label" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Dot Label
          </label>
          <input
            id="legend-label"
            type="text"
            value={displayLegendLabel}
            onChange={(e) => handleLegendLabelChange(e.target.value)}
            onBlur={(e) => handleLegendLabelChange(e.target.value, true)} // Apply changes immediately on blur
            placeholder="e.g., 100 per dot (Total Households)"
            className="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     border border-gray-300 dark:border-gray-700 rounded
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Edit the complete legend text. Default format updates automatically with dot value changes, but custom formats are preserved.
          </p>
       </div>

    </div>
  );
};

export default DotDensityEditor;