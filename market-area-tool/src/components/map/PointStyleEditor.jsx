'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react';

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

// Helper to smartly round numbers based on their magnitude
const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  
  // For values less than 10, round to nearest whole number
  if (Math.abs(value) < 10) {
    return Math.round(value);
  }
  // For values between 10-100, round to nearest 10
  else if (Math.abs(value) < 100) {
    return Math.round(value / 10) * 10;
  }
  // For values between 100-1000, round to nearest 100
  else if (Math.abs(value) < 1000) {
    return Math.round(value / 100) * 100;
  }
  // For values between 1000-10000, round to nearest 1000
  else if (Math.abs(value) < 10000) {
    return Math.round(value / 1000) * 1000;
  }
  // For larger values, round to nearest 10000
  else {
    return Math.round(value / 10000) * 10000;
  }
};

const PointStyleEditor = ({ config, onChange, onPreview, mapType = 'comps' }) => {
  if (!config) {
    console.warn("PointStyleEditor received null config.");
    return <div className="p-4 text-gray-500 dark:text-gray-400">Loading configuration...</div>;
  }

  // --- Define Default Properties based on mapType ---
  const getTypeDefaults = () => {
    switch(mapType) {
      case 'pipe':
        return {
          symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: '#4CAF50', // Green for pipe
            size: 8,
            outline: {
              color: '#FFFFFF',
              width: 1
            }
          },
          legend: {
            label: 'Pipeline Property'
          },
          valueColumn: 'Status'
        };
      case 'comps':
      default:
        return {
          symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: '#800080', // Purple for comp
            size: 10,
            outline: {
              color: '#FFFFFF',
              width: 1
            }
          },
          legend: {
            label: 'Comparison Property'
          },
          valueColumn: 'AvgBasePSF'
        };
    }
  };
  
  const typeDefaults = getTypeDefaults();
  const defaultSymbolProps = typeDefaults.symbol;
  const defaultLegendProps = typeDefaults.legend;
  const defaultValueColumn = typeDefaults.valueColumn;

  // Default class breaks - used when creating a new legend
  const defaultClassBreaks = [
    {
      minValue: 2,
      maxValue: 3,
      label: "2 - 3",
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#3182ce",
        size: 10,
        outline: { color: "#FFFFFF", width: 1 }
      }
    },
    {
      minValue: 3,
      maxValue: 4,
      label: "3 - 4",
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#8371cc",
        size: 10,
        outline: { color: "#FFFFFF", width: 1 }
      }
    },
    {
      minValue: 4,
      maxValue: 5,
      label: "4 - 5",
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#be56b0",
        size: 10,
        outline: { color: "#FFFFFF", width: 1 }
      }
    },
    {
      minValue: 5,
      maxValue: 6,
      label: "5 - 6",
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#e13b7d",
        size: 10,
        outline: { color: "#FFFFFF", width: 1 }
      }
    },
    {
      minValue: 6,
      maxValue: 7,
      label: "6 - 7",
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#e53e3e",
        size: 10,
        outline: { color: "#FFFFFF", width: 1 }
      }
    }
  ];

  // --- Get current values safely, using defaults ---
  const currentSymbol = config?.symbol ?? defaultSymbolProps;
  const currentLegendInfo = config?.legendInfo ?? defaultLegendProps;
  const currentClassBreaks = config?.classBreakInfos || [];
  const renderType = config?.rendererType || (currentClassBreaks.length > 0 ? 'classBreaks' : 'simple');

  // Create a working copy of the config to accumulate changes
  const [workingConfig, setWorkingConfig] = useState(JSON.parse(JSON.stringify(config)));
  
  // Get values from the working config
  const workingSymbol = workingConfig?.symbol ?? defaultSymbolProps;
  const workingLegendInfo = workingConfig?.legendInfo ?? defaultLegendProps;
  const workingSize = workingSymbol.size ?? defaultSymbolProps.size;
  const workingColor = workingSymbol.color ?? defaultSymbolProps.color;
  const workingOutline = workingSymbol.outline ?? {};
  const workingOutlineWidth = workingOutline.width ?? defaultSymbolProps.outline.width;
  const workingOutlineColor = workingOutline.color ?? defaultSymbolProps.outline.color;
  const workingLegendLabel = workingLegendInfo.label ?? defaultLegendProps.label;

  // State for class breaks editing
  const [classBreaks, setClassBreaks] = useState(currentClassBreaks.length > 0 ? currentClassBreaks : []);
  const [useClassBreaks, setUseClassBreaks] = useState(renderType === 'classBreaks');
  const [valueColumn, setValueColumn] = useState(config?.valueColumn || 'AvgBasePSF');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Get list of available columns from custom data
  useEffect(() => {
    if (config?.customData?.data && config.customData.data.length > 0) {
      const firstItem = config.customData.data[0];
      const columns = Object.keys(firstItem);
      setAvailableColumns(columns.filter(col => typeof firstItem[col] === 'number'));
    }
  }, [config]);

  // Update local state when config changes
  useEffect(() => {
    setWorkingConfig(JSON.parse(JSON.stringify(config)));
    setClassBreaks(config?.classBreakInfos?.length > 0 ? [...config.classBreakInfos] : []);
    setUseClassBreaks(config?.rendererType === 'classBreaks' || (config?.classBreakInfos?.length > 0));
    setValueColumn(config?.valueColumn || 'AvgBasePSF');
    setHasUnsavedChanges(false);
  }, [config]);

  // --- Handler for simple style changes ---
  const handleConfigChange = (propPath, value) => {
    // Start with a deep clone of the existing working config
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));

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
      updatedConfig.symbol.style = 'circle';
    }

    // Mark that we have unsaved changes
    setHasUnsavedChanges(true);
    
    // Update working config
    setWorkingConfig(updatedConfig);
  };

  // --- Handler for class breaks changes ---
  const handleClassBreaksChange = (newBreaks, newValueColumn = valueColumn) => {
    // Update local state
    setClassBreaks(newBreaks);
    setHasUnsavedChanges(true);
    
    // Clone the working config to avoid mutations
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));
    
    // Update class breaks and renderer type
    updatedConfig.classBreakInfos = newBreaks;
    updatedConfig.rendererType = newBreaks.length > 0 ? 'classBreaks' : 'simple';
    updatedConfig.valueColumn = newValueColumn;
    
    // Apply to size to all breaks if different from current
    if (updatedConfig.symbol && updatedConfig.symbol.size !== undefined && newBreaks.length > 0) {
      const symbolSize = Number(updatedConfig.symbol.size);
      newBreaks.forEach(breakInfo => {
        if (breakInfo.symbol) {
          breakInfo.symbol.size = symbolSize;
        }
      });
    }
    
    // Update working config
    setWorkingConfig(updatedConfig);
  };

  // Preview changes
  const previewChanges = () => {
    // Call the preview function with the working config
    if (onPreview) {
      onPreview(workingConfig);
    }
  };

  // Apply changes
  const applyChanges = () => {
    // Propagate changes up
    onChange(workingConfig);
    if (onPreview) {
      onPreview(workingConfig);
    }
    
    setHasUnsavedChanges(false);
  };

  // --- Toggle between simple styling and class breaks ---
  const handleToggleClassBreaks = (e) => {
    const useClasses = e.target.checked;
    setUseClassBreaks(useClasses);
    setHasUnsavedChanges(true);
    
    // Clone config
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));
    
    if (useClasses) {
      // Switching to class breaks
      if (classBreaks.length === 0) {
        // If no breaks exist, create default ones
        const newBreaks = JSON.parse(JSON.stringify(defaultClassBreaks));
        setClassBreaks(newBreaks);
        updatedConfig.classBreakInfos = newBreaks;
      } else {
        // Use existing breaks
        updatedConfig.classBreakInfos = classBreaks;
      }
      updatedConfig.rendererType = 'classBreaks';
      
      // Set value column if not already set
      if (!updatedConfig.valueColumn) {
        updatedConfig.valueColumn = 'AvgBasePSF';
      }
    } else {
      // Switching to simple styling
      updatedConfig.rendererType = 'simple';
      // Keep classBreakInfos for when user toggles back
    }
    
    // Update working config
    setWorkingConfig(updatedConfig);
  };
  
  // --- Add a new class break ---
  const addClassBreak = () => {
    const newBreaks = [...classBreaks];
    
    // Determine min/max values for the new break
    let minValue = 0, maxValue = 1;
    
    if (newBreaks.length > 0) {
      // Use the last break's max value as the new min value
      const lastBreak = newBreaks[newBreaks.length - 1];
      minValue = lastBreak.maxValue;
      maxValue = minValue + 1; // Default increment
    }
    
    // Apply smart rounding to the values
    minValue = smartRound(minValue);
    maxValue = smartRound(maxValue);
    
    // Generate a color based on position
    const colorIndex = newBreaks.length % 5;
    const colors = ['#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'];
    
    // Create the new break with current symbol size and outline
    const newBreak = {
      minValue: minValue,
      maxValue: maxValue,
      label: `${minValue} - ${maxValue}`,
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: colors[colorIndex],
        size: workingSize, // Use working symbol size
        outline: {
          color: workingOutlineColor,
          width: workingOutlineWidth
        }
      }
    };
    
    newBreaks.push(newBreak);
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  // --- Remove a class break ---
  const removeClassBreak = (index) => {
    const newBreaks = [...classBreaks];
    newBreaks.splice(index, 1);
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  // --- Update a specific class break ---
  const updateClassBreak = (index, field, value) => {
    const newBreaks = [...classBreaks];
    const breakToUpdate = { ...newBreaks[index] };
    
    // Handle different field types
    if (field === 'minValue' || field === 'maxValue') {
      // Allow any value the user enters, don't force rounding
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        breakToUpdate[field] = numericValue;
        
        // Update the label to reflect the new range
        if (breakToUpdate.maxValue === Infinity) {
          breakToUpdate.label = `${breakToUpdate.minValue} and above`;
        } else {
          breakToUpdate.label = `${breakToUpdate.minValue} - ${breakToUpdate.maxValue}`;
        }
      }
    }
    else if (field === 'label') {
      breakToUpdate.label = value;
    }
    else if (field.startsWith('symbol.')) {
      const symbolField = field.split('.')[1];
      if (!breakToUpdate.symbol) breakToUpdate.symbol = { ...defaultSymbolProps };
      
      if (symbolField === 'color') {
        breakToUpdate.symbol.color = value;
      }
      else if (symbolField === 'size') {
        breakToUpdate.symbol.size = parseFloat(value);
      }
      else if (symbolField.startsWith('outline.')) {
        const outlineField = symbolField.split('.')[1];
        if (!breakToUpdate.symbol.outline) breakToUpdate.symbol.outline = { ...defaultSymbolProps.outline };
        breakToUpdate.symbol.outline[outlineField] = outlineField === 'width' ? parseFloat(value) : value;
      }
    }
    
    newBreaks[index] = breakToUpdate;
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  // --- Move a class break up or down ---
  const moveClassBreak = (index, direction) => {
    const newBreaks = [...classBreaks];
    if (direction === 'up' && index > 0) {
      [newBreaks[index], newBreaks[index - 1]] = [newBreaks[index - 1], newBreaks[index]];
    } else if (direction === 'down' && index < newBreaks.length - 1) {
      [newBreaks[index], newBreaks[index + 1]] = [newBreaks[index + 1], newBreaks[index]];
    }
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  // --- Generate Class Breaks Based on Data ---
  const generateClassBreaksFromData = () => {
    if (!workingConfig?.customData?.data || !valueColumn) return;
    
    // Extract values from data
    const values = workingConfig.customData.data
      .map(item => parseFloat(item[valueColumn]))
      .filter(value => !isNaN(value));
    
    if (values.length === 0) return;
    
    // Find min and max
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Create 5 evenly distributed breaks
    const range = max - min;
    const interval = range / 5;
    
    const colors = ['#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'];
    
    const newBreaks = [];
    for (let i = 0; i < 5; i++) {
      const minValue = min + (i * interval);
      const maxValue = i === 4 ? max : min + ((i + 1) * interval);
      
      // Apply smart rounding to the min and max values
      const roundedMin = smartRound(minValue);
      const roundedMax = smartRound(maxValue);
      
      newBreaks.push({
        minValue: roundedMin,
        maxValue: roundedMax,
        label: `${roundedMin} - ${roundedMax}`,
        symbol: {
          type: "simple-marker",
          style: "circle",
          color: colors[i],
          size: workingSize,
          outline: {
            color: workingOutlineColor,
            width: workingOutlineWidth
          }
        }
      });
    }
    
    // Update state and config
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };

  // --- Render Simple Legend Preview ---
  const renderSimpleLegendPreview = () => (
    <div className="mt-4 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Legend Preview</h4>
      <div className="flex items-center space-x-2">
        {/* Symbol Preview */}
        <div
          style={{
            width: `${workingSize}px`,
            height: `${workingSize}px`,
            backgroundColor: workingColor,
            border: `${workingOutlineWidth}px solid ${workingOutlineColor}`,
            borderRadius: '50%', // Assuming circle marker
            flexShrink: 0,
          }}
          aria-hidden="true" // Indicate it's decorative
        />
        {/* Label Preview */}
        <span className="text-sm text-gray-800 dark:text-gray-100 break-all">
          {workingLegendLabel || '(No Label)'}
        </span>
      </div>
    </div>
  );
  
  // --- Render Class Breaks Legend Preview ---
  const renderClassBreaksLegendPreview = () => (
    <div className="mt-4 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Class Breaks Legend Preview</h4>
      {classBreaks.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">No class breaks defined yet. Add breaks below.</p>
      ) : (
        <div className="space-y-2">
          {classBreaks.map((breakInfo, index) => (
            <div key={index} className="flex items-center space-x-2">
              {/* Symbol Preview */}
              <div
                style={{
                  width: `${breakInfo.symbol?.size || workingSize}px`,
                  height: `${breakInfo.symbol?.size || workingSize}px`,
                  backgroundColor: breakInfo.symbol?.color,
                  border: `${breakInfo.symbol?.outline?.width || workingOutlineWidth}px solid ${breakInfo.symbol?.outline?.color || workingOutlineColor}`,
                  borderRadius: '50%', // Assuming circle marker
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {/* Label Preview */}
              <span className="text-sm text-gray-800 dark:text-gray-100 break-all">
                {breakInfo.label || `${breakInfo.minValue} - ${breakInfo.maxValue === Infinity ? 'and above' : breakInfo.maxValue}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  // --- Render Value Column Input Field ---
  const renderValueColumnInput = () => (
    <div className="space-y-1">
      <label htmlFor="value-column" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
        Value Column <span className="text-gray-400">(Required for class breaks)</span>
      </label>
      
      <select
        id="value-column"
        value={valueColumn}
        onChange={(e) => {
          const newValue = e.target.value;
          setValueColumn(newValue);
          setHasUnsavedChanges(true);
          // Update class breaks with new value column
          handleClassBreaksChange(classBreaks, newValue);
        }}
        className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
      >
        {availableColumns.map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
      
      <div className="flex items-center justify-between mt-2">
        <p className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <HelpCircle size={12} className="mr-1 flex-shrink-0" />
          <span>Select column containing numeric values for classification</span>
        </p>
        
        <button
          onClick={generateClassBreaksFromData}
          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
          title="Generate class breaks based on data distribution"
        >
          Auto-Generate Breaks
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 border-b pb-2 mb-4">
          Comp Property Style & Legend
        </h3>
        
        <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
          <Info size={16} className="mr-1" />
          <span>Visualization Type: Comps</span>
        </div>
      </div>

      {/* Render Type Toggle */}
      <div className="flex items-center mb-4">
        <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">Simple Style</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={useClassBreaks}
            onChange={handleToggleClassBreaks}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
        <span className="text-sm text-gray-700 dark:text-gray-300 ml-2">Class Breaks</span>
      </div>

      {/* --- Value Column Input (for Class Breaks) --- */}
      {useClassBreaks && renderValueColumnInput()}

      {/* --- Symbol Styling (Always visible, used in simple mode or as defaults for class breaks) --- */}
      <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
        <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">
          {useClassBreaks ? 'Default Symbol Style' : 'Symbol Style'}
        </legend>
        {/* Point Size */}
        <div className="space-y-1">
          <label htmlFor="point-size-comp" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Size (px)
          </label>
          <input
            id="point-size-comp"
            type="number"
            value={workingSize}
            onChange={(e) => {
              const newSize = Math.max(1, Math.min(30, parseFloat(e.target.value) || 1));
              handleConfigChange('symbol.size', newSize);
            }}
            min="1" max="30" step="1"
            className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
          />
        </div>
        {/* Point Color (visible only in simple mode) */}
        {!useClassBreaks && (
          <div className="space-y-1">
            <label htmlFor="point-color-comp" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Fill Color
            </label>
            <input
              id="point-color-comp"
              type="color"
              value={workingColor} // Input type color expects hex
              onChange={(e) => handleConfigChange('symbol.color', e.target.value)}
              className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
            />
          </div>
        )}
        {/* Outline Width */}
        <div className="space-y-1">
          <label htmlFor="outline-width-comp" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Outline Width (px)
          </label>
          <input
            id="outline-width-comp"
            type="number"
            value={workingOutlineWidth}
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
          <label htmlFor="outline-color-comp" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Outline Color
          </label>
          <input
            id="outline-color-comp"
            type="color"
            value={workingOutlineColor} // Input type color expects hex
            onChange={(e) => handleConfigChange('symbol.outline.color', e.target.value)}
            className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
          />
        </div>
      </fieldset>

      {/* --- Legend Configuration (Simple Mode) --- */}
      {!useClassBreaks && (
        <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
          <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Legend</legend>
          <div className="space-y-1">
            <label htmlFor="legend-label-comp" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Label
            </label>
            <input
              id="legend-label-comp"
              type="text"
              value={workingLegendLabel}
              onChange={(e) => handleConfigChange('legendInfo.label', e.target.value)}
              placeholder="e.g., Comparable Property"
              className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
            />
            {/* Tooltip */}
            <p className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              <HelpCircle size={12} className="mr-1 flex-shrink-0" />
              <span>This label appears below the symbol in the map legend.</span>
            </p>
          </div>

          {/* Simple Legend Preview */}
          {renderSimpleLegendPreview()}
        </fieldset>
      )}

      {/* --- Class Breaks Configuration --- */}
      {useClassBreaks && (
        <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
          <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Class Breaks</legend>
          
          {/* Class Breaks Legend Preview */}
          {renderClassBreaksLegendPreview()}
          
          {/* Class Breaks Editor */}
          <div className="mt-3 space-y-4">
            {classBreaks.map((breakInfo, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Break {index + 1}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => moveClassBreak(index, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded ${index === 0 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      title="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => moveClassBreak(index, 'down')}
                      disabled={index === classBreaks.length - 1}
                      className={`p-1 rounded ${index === classBreaks.length - 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      title="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      onClick={() => removeClassBreak(index)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Remove break"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Break-specific action buttons */}
                {hasUnsavedChanges && (
                  <div className="flex justify-end space-x-2 mt-3 mb-1">
                    <button
                      onClick={() => {
                        // Reset this break to original
                        const originalBreak = config?.classBreakInfos?.[index];
                        if (originalBreak) {
                          const newBreaks = [...classBreaks];
                          newBreaks[index] = JSON.parse(JSON.stringify(originalBreak));
                          handleClassBreaksChange(newBreaks);
                        }
                      }}
                      className="px-3 py-1 text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={previewChanges}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600"
                    >
                      Preview
                    </button>
                    <button
                      onClick={applyChanges}
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      Apply Changes
                    </button>
                  </div>
                )}
                
                {/* Min/Max Value */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor={`break-${index}-min`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                      Min Value
                    </label>
                    <input
                      id={`break-${index}-min`}
                      type="number"
                      step="any"
                      value={breakInfo.minValue}
                      onChange={(e) => updateClassBreak(index, 'minValue', e.target.value)}
                      className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`break-${index}-max`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                      Max Value
                    </label>
                    <input
                      id={`break-${index}-max`}
                      type="number"
                      step="any"
                      value={index === classBreaks.length - 1 && breakInfo.maxValue === Infinity ? '' : breakInfo.maxValue}
                      placeholder={index === classBreaks.length - 1 ? "∞ (Infinity)" : ""}
                      onChange={(e) => {
                        const value = e.target.value.trim() === '' && index === classBreaks.length - 1 
                          ? Infinity 
                          : e.target.value;
                        updateClassBreak(index, 'maxValue', value);
                      }}
                      className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                    />
                  </div>
                </div>
                
                {/* Label */}
                <div className="space-y-1">
                  <label htmlFor={`break-${index}-label`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Label
                  </label>
                  <input
                    id={`break-${index}-label`}
                    type="text"
                    value={breakInfo.label}
                    onChange={(e) => updateClassBreak(index, 'label', e.target.value)}
                    placeholder={breakInfo.maxValue === Infinity 
                      ? `${breakInfo.minValue} and above`
                      : `${breakInfo.minValue} - ${breakInfo.maxValue}`
                    }
                    className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                  />
                </div>
                
                {/* Color */}
                <div className="space-y-1">
                  <label htmlFor={`break-${index}-color`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Color
                  </label>
                  <input
                    id={`break-${index}-color`}
                    type="color"
                    value={breakInfo.symbol?.color || '#3182CE'}
                    onChange={(e) => updateClassBreak(index, 'symbol.color', e.target.value)}
                    className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
                  />
                </div>
              </div>
            ))}
            
            {/* Add Break Button */}
            <button
              onClick={addClassBreak}
              className="flex items-center justify-center w-full p-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              <Plus size={16} className="mr-1" /> Add Break
            </button>
          </div>
          
          {/* Help Text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Class breaks determine how properties are styled based on their values. Properties with values in a break's range will use that break's color.
          </p>
        </fieldset>
      )}

      {/* Helpful Tips */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded">
        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center">
          <Info size={16} className="mr-1" /> Tips for Comps Map
        </h4>
        <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc pl-4">
          <li>For rent comparison, use "AvgBasePSF" or "AvgNetPSF" as the value column</li>
          <li>For occupancy analysis, use the "Occupancy" column (values from 0-1)</li>
          <li>Use "Auto-Generate Breaks" to create even class breaks based on your data</li>
          <li>Set the last break's maximum value to blank for "and above" classification</li>
          <li>Values are automatically rounded based on their magnitude, but you can enter any value</li>
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-4 mt-6">
        {hasUnsavedChanges && (
          <div className="flex items-center text-sm text-amber-600 dark:text-amber-400 mr-auto">
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
            </svg>
            Unsaved changes
          </div>
        )}
        
        {hasUnsavedChanges && (
          <>
            <button
              onClick={previewChanges}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600"
            >
              Preview
            </button>
            <button
              onClick={applyChanges}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Apply Changes
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PointStyleEditor;