// src/components/map/CustomPointStyleEditor.jsx
import React, { useState, useEffect, useCallback } from 'react';
import chroma from 'chroma-js'; // For color manipulation if needed

// --- Re-include or import helper functions ---
// These would typically be in a shared utils file

const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  if (Math.abs(value) < 10) return Math.round(value);
  if (Math.abs(value) < 100) return Math.round(value / 10) * 10;
  if (Math.abs(value) < 1000) return Math.round(value / 100) * 100;
  if (Math.abs(value) < 10000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 10000) * 10000;
};

const generateColorRamp = (color1, color2, count) => {
  const validCount = Math.max(1, count);
  if (validCount === 1) return [color1];
  return chroma.scale([color1, color2]).mode('lch').colors(validCount);
};

const generateClassBreaksForPoints = (data, valueColumn, numClasses = 5, baseSymbolStyle = {}) => {
  if (!data || data.length === 0 || !valueColumn) return null;
  const values = data.map(item => Number(item[valueColumn])).filter(val => !isNaN(val));
  if (values.length < 2) return null;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const roundedMin = smartRound(minValue);
  const roundedMax = smartRound(maxValue);

  if (minValue === maxValue) {
    return [{
      minValue: roundedMin, maxValue: roundedMin, label: `${roundedMin.toLocaleString()}`,
      symbol: { ...baseSymbolStyle, color: generateColorRamp('#3182CE', '#E53E3E', 1)[0] }
    }];
  }

  const validNumClasses = Math.max(1, Math.min(numClasses, values.length));
  const range = maxValue - minValue;
  const interval = range > 0 ? range / validNumClasses : 0;
  const breaks = [];
  const colors = generateColorRamp('#3182CE', '#E53E3E', validNumClasses);

  for (let i = 0; i < validNumClasses; i++) {
    const classMinValue = minValue + (i * interval);
    const classMaxValue = (i === validNumClasses - 1) ? maxValue : (minValue + ((i + 1) * interval));
    const roundedClassMin = smartRound(classMinValue);
    const roundedClassMax = smartRound(classMaxValue);
    breaks.push({
      minValue: roundedClassMin, maxValue: roundedClassMax,
      label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`,
      symbol: { ...baseSymbolStyle, color: colors[i] }
    });
  }
  // Adjust overlaps and last break max (simplified for brevity, original logic was more robust)
  if (breaks.length > 0) breaks[breaks.length-1].maxValue = roundedMax;
  return breaks;
};

const generateSizeBreaksForPoints = (data, valueColumn, numClasses = 5, minSize = 6, maxSize = 24) => {
  if (!data || data.length === 0 || !valueColumn) return null;
  const values = data.map(item => Number(item[valueColumn])).filter(val => !isNaN(val));
  if (values.length < 2) return null;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const roundedMin = smartRound(minValue);
  const roundedMax = smartRound(maxValue);
  
  if (minValue === maxValue) {
    return [{ minValue: roundedMin, maxValue: roundedMin, label: `${roundedMin.toLocaleString()}`, size: Math.round((minSize + maxSize) / 2) }];
  }

  const validNumClasses = Math.max(1, Math.min(numClasses, values.length));
  const valueRange = maxValue - minValue;
  const sizeRange = maxSize - minSize;
  const breaks = [];

  for (let i = 0; i < validNumClasses; i++) {
    const classMinValue = minValue + (i * (valueRange / validNumClasses));
    const classMaxValue = (i === validNumClasses - 1) ? maxValue : (minValue + ((i + 1) * (valueRange / validNumClasses)));
    const roundedClassMin = smartRound(classMinValue);
    const roundedClassMax = smartRound(classMaxValue);
    const proportion = (i + 0.5) / validNumClasses;
    const currentSize = minSize + (proportion * sizeRange);
    breaks.push({
      minValue: roundedClassMin, maxValue: roundedClassMax,
      label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`,
      size: Math.round(currentSize)
    });
  }
  if (breaks.length > 0) breaks[breaks.length-1].maxValue = roundedMax;
  return breaks;
};
// --- End Helper Functions ---


const SymbolPreview = ({ symbol }) => {
  if (!symbol) return null;
  const style = {
    width: `${symbol.size || 10}px`,
    height: `${symbol.size || 10}px`,
    backgroundColor: symbol.color || '#FF0000',
    borderRadius: symbol.style === 'circle' ? '50%' : '0',
    border: `${symbol.outline?.width || 1}px solid ${symbol.outline?.color || '#FFFFFF'}`,
    display: 'inline-block',
    marginRight: '8px',
  };
  return <span style={style}></span>;
};


const CustomPointStyleEditor = ({ config, onChange, onPreview, valueFormats }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [numColorClasses, setNumColorClasses] = useState(config?.colorClassBreakInfos?.length || 5);
  const [numSizeClasses, setNumSizeClasses] = useState(config?.sizeInfos?.length || 5);
  const [minSymSize, setMinSymSize] = useState(config?.symbol?.minSize || 6); // For size ramp
  const [maxSymSize, setMaxSymSize] = useState(config?.symbol?.maxSize || 24); // For size ramp


  useEffect(() => {
    // Deep copy config to avoid direct mutation issues if parent re-renders
    const deepConfig = JSON.parse(JSON.stringify(config));
    setLocalConfig(deepConfig);
    setNumColorClasses(deepConfig?.colorClassBreakInfos?.length || 5);
    setNumSizeClasses(deepConfig?.sizeInfos?.length || 5);
    setMinSymSize(deepConfig?.symbol?.minSize || 6);
    setMaxSymSize(deepConfig?.symbol?.maxSize || 24);
  }, [config]);

  const handleFullConfigChange = useCallback((newConfig) => {
    setLocalConfig(newConfig);
    if (onChange) onChange(newConfig);
    if (onPreview) onPreview(newConfig);
  }, [onChange, onPreview]);

  const handleInputChange = (field, value) => {
    const newConfig = { ...localConfig, [field]: value };
    // If value columns change, regenerate breaks
    if (field === 'valueColumn1' && localConfig.customData?.data) {
      const newColorBreaks = generateClassBreaksForPoints(localConfig.customData.data, value, numColorClasses, localConfig.symbol);
      newConfig.colorClassBreakInfos = newColorBreaks;
    }
    if (field === 'valueColumn2' && localConfig.customData?.data) {
      const newSizeBreaks = generateSizeBreaksForPoints(localConfig.customData.data, value, numSizeClasses, minSymSize, maxSymSize);
      newConfig.sizeInfos = newSizeBreaks;
    }
    handleFullConfigChange(newConfig);
  };
  
  const handleSymbolChange = (part, field, value) => {
    const newSymbolConfig = { ...(localConfig.symbol || {}) };
    if (part === 'outline') {
      newSymbolConfig.outline = { ...(newSymbolConfig.outline || {}), [field]: value };
    } else {
      newSymbolConfig[part] = value; 
    }
    handleInputChange('symbol', newSymbolConfig);
  };

  const handleNumColorClassesChange = (newNumClasses) => {
    const num = parseInt(newNumClasses, 10);
    if (num > 0 && localConfig.customData?.data && localConfig.valueColumn1) {
      setNumColorClasses(num);
      const newColorBreaks = generateClassBreaksForPoints(localConfig.customData.data, localConfig.valueColumn1, num, localConfig.symbol);
      handleInputChange('colorClassBreakInfos', newColorBreaks);
    }
  };

  const handleNumSizeClassesChange = (newNumClasses) => {
    const num = parseInt(newNumClasses, 10);
    if (num > 0 && localConfig.customData?.data && localConfig.valueColumn2) {
      setNumSizeClasses(num);
      const newSizeBreaks = generateSizeBreaksForPoints(localConfig.customData.data, localConfig.valueColumn2, num, minSymSize, maxSymSize);
      handleInputChange('sizeInfos', newSizeBreaks);
    }
  };
  
  const handleMinMaxSizeChange = (type, value) => {
    const val = parseInt(value, 10);
    let newMin = minSymSize; // Current state value
    let newMax = maxSymSize; // Current state value
  
    if (type === 'min') {
      newMin = Math.max(1, val); // Ensure minSize is at least 1
      if (newMin >= newMax) { // Current newMax if type === 'max', or existing maxSymSize
        newMin = newMax - 1 >= 1 ? newMax - 1 : 1; // Ensure min < max, and min is at least 1
      }
      setMinSymSize(newMin); // Update state
    } else { // type === 'max'
      newMax = Math.max(1, val);
      if (newMax <= newMin) { // Current newMin if type === 'min', or existing minSymSize
        newMax = newMin + 1; // Ensure max > min
      }
      setMaxSymSize(newMax); // Update state
    }
  
    // Use the values that will be set after this function completes
    const effectiveMinForSymbol = (type === 'min') ? newMin : minSymSize;
    const effectiveMaxForSymbol = (type === 'max') ? newMax : maxSymSize;
  
    const updatedSymbol = {
      ...(localConfig.symbol || {}),
      minSize: effectiveMinForSymbol,
      maxSize: effectiveMaxForSymbol,
    };
  
    if (localConfig.customData?.data && localConfig.valueColumn2) {
      const newSizeBreaks = generateSizeBreaksForPoints(
        localConfig.customData.data, 
        localConfig.valueColumn2, 
        numSizeClasses, 
        effectiveMinForSymbol, // Pass the updated min
        effectiveMaxForSymbol  // Pass the updated max
      );
      const newConfig = {
        ...localConfig,
        symbol: updatedSymbol,
        sizeInfos: newSizeBreaks,
      };
      handleFullConfigChange(newConfig);
    } else {
      const newConfig = {
        ...localConfig,
        symbol: updatedSymbol,
      };
      handleFullConfigChange(newConfig);
    }
  };


  const handleColorBreakChange = (index, newColor) => {
    const newBreaks = [...(localConfig.colorClassBreakInfos || [])];
    if (newBreaks[index] && newBreaks[index].symbol) {
      newBreaks[index].symbol.color = newColor;
      handleInputChange('colorClassBreakInfos', newBreaks);
    }
  };

  const handleSizeBreakChange = (index, newSize) => {
    const newBreaks = [...(localConfig.sizeInfos || [])];
    const parsedSize = parseInt(newSize, 10);
    if (newBreaks[index] && !isNaN(parsedSize) && parsedSize > 0) {
      newBreaks[index].size = parsedSize; // sizeInfos directly stores the size
      handleInputChange('sizeInfos', newBreaks);
    }
  };

  const columns = localConfig.customData?.data?.[0] ? Object.keys(localConfig.customData.data[0]) : [];

  if (!localConfig) return <div>Loading custom config...</div>;

  return (
    <div className="space-y-6 p-1">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Point Map Editor</h3>
      
      {/* Column Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="valueColumn1" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Value Column 1 (for Color)</label>
          <select id="valueColumn1" name="valueColumn1" value={localConfig.valueColumn1 || ''} onChange={(e) => handleInputChange('valueColumn1', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="">None</option>
            {columns.map(col => <option key={`v1-${col}`} value={col}>{col}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="valueColumn2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Value Column 2 (for Size)</label>
          <select id="valueColumn2" name="valueColumn2" value={localConfig.valueColumn2 || ''} onChange={(e) => handleInputChange('valueColumn2', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="">None</option>
            {columns.map(col => <option key={`v2-${col}`} value={col}>{col}</option>)}
          </select>
        </div>
      </div>

      {/* Base Symbol Style Editor */}
      <div>
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Base Symbol Style</h4>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="symbolStyle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Shape</label>
                <select id="symbolStyle" value={localConfig.symbol?.style || 'circle'} onChange={(e) => handleSymbolChange('style', null, e.target.value)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="circle">Circle</option><option value="square">Square</option><option value="cross">Cross</option><option value="x">X</option><option value="diamond">Diamond</option><option value="triangle">Triangle</option>
                </select>
            </div>
             <div>
                <label htmlFor="symbolOutlineWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Outline Width (px)</label>
                <input type="number" id="symbolOutlineWidth" value={localConfig.symbol?.outline?.width || 1} min="0" max="5" step="0.5"
                    onChange={(e) => handleSymbolChange('outline', 'width', parseFloat(e.target.value))}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
            <div>
                <label htmlFor="symbolOutlineColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Outline Color</label>
                <input type="color" id="symbolOutlineColor" value={localConfig.symbol?.outline?.color || '#FFFFFF'}
                    onChange={(e) => handleSymbolChange('outline', 'color', e.target.value)}
                    className="mt-1 block w-full h-10 border-gray-300 dark:border-gray-600 rounded-md shadow-sm cursor-pointer" />
            </div>
        </div>
      </div>

      {/* Color Ramp Editor */}
      {localConfig.valueColumn1 && localConfig.colorClassBreakInfos && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Color Ramp (from '{localConfig.valueColumn1}')</h4>
            <div>
              <label htmlFor="numColorClasses" className="text-xs text-gray-600 dark:text-gray-400 mr-1">Classes:</label>
              <input type="number" id="numColorClasses" value={numColorClasses} min="1" max="10"
                onChange={(e) => handleNumColorClassesChange(e.target.value)}
                className="w-16 py-1 px-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md text-sm"/>
            </div>
          </div>
          <div className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700/50 max-h-60 overflow-y-auto space-y-2">
            {localConfig.colorClassBreakInfos.map((breakInfo, index) => (
              <div key={`color-edit-${index}`} className="flex items-center space-x-3 p-1 bg-white dark:bg-gray-800 rounded">
                <SymbolPreview symbol={{ ...localConfig.symbol, color: breakInfo.symbol.color, size: 16 }} />
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate" title={breakInfo.label}>{breakInfo.label}</span>
                <input type="color" value={breakInfo.symbol.color} onChange={(e) => handleColorBreakChange(index, e.target.value)}
                  className="w-8 h-8 border-none rounded cursor-pointer"/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Size Ramp Editor */}
      {localConfig.valueColumn2 && localConfig.sizeInfos && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Size Ramp (from '{localConfig.valueColumn2}')</h4>
            <div className="flex items-center space-x-2">
              <label htmlFor="minSymSize" className="text-xs text-gray-600 dark:text-gray-400">Min:</label>
              <input type="number" id="minSymSize" value={minSymSize} min="1" max={maxSymSize -1}
                onChange={(e) => handleMinMaxSizeChange('min', e.target.value)}
                className="w-16 py-1 px-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md text-sm"/>
              <label htmlFor="maxSymSize" className="text-xs text-gray-600 dark:text-gray-400">Max:</label>
              <input type="number" id="maxSymSize" value={maxSymSize} min={minSymSize + 1} max="50"
                onChange={(e) => handleMinMaxSizeChange('max', e.target.value)}
                className="w-16 py-1 px-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md text-sm"/>
              <label htmlFor="numSizeClasses" className="text-xs text-gray-600 dark:text-gray-400 ml-2">Classes:</label>
              <input type="number" id="numSizeClasses" value={numSizeClasses} min="1" max="10"
                onChange={(e) => handleNumSizeClassesChange(e.target.value)}
                className="w-16 py-1 px-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md text-sm"/>
            </div>
          </div>
           <div className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700/50 max-h-60 overflow-y-auto space-y-2">
            {localConfig.sizeInfos.map((sizeInfo, index) => (
              <div key={`size-edit-${index}`} className="flex items-center space-x-3 p-1 bg-white dark:bg-gray-800 rounded">
                 <SymbolPreview symbol={{ ...localConfig.symbol, size: sizeInfo.size, color: '#CCCCCC' }} />
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate" title={sizeInfo.label}>{sizeInfo.label}</span>
                <input type="number" value={sizeInfo.size} min="1" max="50" onChange={(e) => handleSizeBreakChange(index, e.target.value)}
                    className="w-20 py-1 px-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md text-sm"/>
                 <span className="text-xs text-gray-500 dark:text-gray-400">px</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomPointStyleEditor;