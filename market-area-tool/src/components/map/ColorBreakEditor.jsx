'use client';

import * as React from 'react';
import { Plus, Minus } from 'lucide-react';

const ColorBreakEditor = ({ breaks, onBreaksChange, visualizationType = 'income' }) => {
    const [distribution, setDistribution] = React.useState(1);
    const [transparency, setTransparency] = React.useState(40);
    const [minRange, setMinRange] = React.useState(breaks[0].maxValue);
    const [maxRange, setMaxRange] = React.useState(breaks[breaks.length - 1].minValue);
    const [originalBreaks] = React.useState(breaks);
  
    const formatValue = (value) => {
        if (value === Infinity) return '∞';
        if (value === -Infinity) return '-∞';
        if (typeof value === 'number') {
          if (visualizationType === 'income') {
            // For income, round to nearest thousand
            return Math.round(value).toLocaleString();
          } else {
            // For growth, always display with 2 decimal places
            return value.toFixed(2);
          }
        }
        return value;
      };
      

    const updateRanges = (newMin, newMax) => {
        const min = parseInputValue(newMin);
        const max = parseInputValue(newMax);

        if (min !== null && max !== null && min < max) {
            const newBreaks = [...breaks];
            
            // Update first break
            newBreaks[0].maxValue = min;
            newBreaks[1].minValue = min;

            // Update last break
            newBreaks[newBreaks.length - 1].minValue = max;
            newBreaks[newBreaks.length - 2].maxValue = max;

            // Recalculate intermediate breaks
            const range = max - min;
            for (let i = 1; i < newBreaks.length - 1; i++) {
                const normalizedPosition = i / (newBreaks.length - 1);
                let adjustedPosition;
                
                if (distribution === 1) {
                    adjustedPosition = normalizedPosition;
                } else if (distribution > 1) {
                    adjustedPosition = Math.pow(normalizedPosition, distribution);
                } else {
                    adjustedPosition = Math.pow(normalizedPosition, 1/distribution);
                }

                const newValue = min + (range * adjustedPosition);
                const finalValue = visualizationType === 'income' 
                    ? Math.round(newValue) 
                    : parseFloat(newValue.toFixed(2));

                if (i < newBreaks.length - 1) {
                    newBreaks[i].maxValue = finalValue;
                    newBreaks[i + 1].minValue = finalValue;
                }
            }

            // Update labels
            newBreaks.forEach((breakItem, index) => {
                breakItem.label = getDisplayLabel(breakItem, index);
            });

            setMinRange(min);
            setMaxRange(max);
            onBreaksChange(newBreaks);
        }
    };

  // Convert RGBA array to hex color for input[type="color"]
  const rgbaToHex = (rgba) => {
    if (Array.isArray(rgba)) {
      return `#${rgba[0].toString(16).padStart(2, '0')}${rgba[1].toString(16).padStart(2, '0')}${rgba[2].toString(16).padStart(2, '0')}`;
    }
    return rgba; // Return as is if it's already a hex color
  };

  // Convert hex color to RGBA array
  const hexToRgba = (hex, alpha = 0.35) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, alpha];
  };


  const getDisplayLabel = (breakItem, index) => {
    const cleanNumber = (value) => {
        if (value === -Infinity) return '-∞';
        if (value === Infinity) return '∞';
        if (typeof value === 'number') {
          if (visualizationType === 'income') {
            // For income, round to nearest integer
            return Math.round(value).toLocaleString();
          } else {
            // For growth, always display with 2 decimal places
            return value.toFixed(2);
          }
        }
        return value;
      };
  
    const isFirst = index === 0;
    const isLast = index === breaks.length - 1;
  
    if (isFirst && breakItem.minValue === -Infinity) {
      return `Less than ${cleanNumber(breakItem.maxValue)}`;
    }
    if (isLast && breakItem.maxValue === Infinity) {
      return `${cleanNumber(breakItem.minValue)} or more`;
    }
    return `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
  };

const adjustDistribution = (value) => {
    const newValue = parseFloat(value);
    setDistribution(newValue);
    
    const newBreaks = [...breaks];
    
    // Get the fixed lower and upper bounds
    const lowerBound = breaks[0].maxValue;
    const upperBound = breaks[breaks.length - 1].minValue;
    const range = upperBound - lowerBound;
  
    // Only adjust intermediate breaks (skip first and last)
    for (let i = 1; i < breaks.length - 1; i++) {
      // Calculate position between 0 and 1 for each intermediate break
      const normalizedPosition = (i) / (breaks.length - 2);
      
      let adjustedPosition;
      if (newValue === 1) {
        // Linear distribution
        adjustedPosition = normalizedPosition;
      } else if (newValue > 1) {
        // Exponential distribution - emphasize higher values
        adjustedPosition = Math.pow(normalizedPosition, newValue);
      } else {
        // Logarithmic distribution - emphasize lower values
        adjustedPosition = Math.pow(normalizedPosition, 1/newValue);
      }
      
      // Calculate the new value while preserving the bounds
      const newBreakValue = lowerBound + (range * adjustedPosition);
      
      // For income, round to nearest thousand. For growth, precisely keep 2 decimal places
      const finalValue = visualizationType === 'income' 
        parseFloat(newBreakValue.toFixed(2));
  
      // Update the break values
      newBreaks[i].maxValue = finalValue;
      newBreaks[i].minValue = i === 1 ? lowerBound : newBreaks[i-1].maxValue;
      
      // Ensure we don't exceed the upper bound
      if (finalValue > upperBound) {
        newBreaks[i].maxValue = upperBound;
      }
    }
  
    // Ensure proper connectivity between breaks
    for (let i = 1; i < breaks.length - 1; i++) {
      if (i < breaks.length - 2) {
        newBreaks[i + 1].minValue = newBreaks[i].maxValue;
      }
    }
  
    // Ensure the last break's minimum value is correct
    newBreaks[breaks.length - 1].minValue = upperBound;
    
    // Update all labels
    newBreaks.forEach((breakItem, index) => {
      breakItem.label = getDisplayLabel(breakItem, index);
    });
    
    onBreaksChange(newBreaks);
  };

  const parseInputValue = (value) => {
    // Convert to string and trim
    const cleanValue = String(value).replace(/,/g, '').trim();
    
    // Handle infinity cases
    if (cleanValue.toLowerCase() === 'infinity' || cleanValue === '∞') return Infinity;
    if (cleanValue.toLowerCase() === '-infinity' || cleanValue === '-∞') return -Infinity;
    
    // Special handling for edge cases
    if (cleanValue === '' || 
        cleanValue === '.' || 
        cleanValue === '-.' || 
        cleanValue === '+.' || 
        cleanValue === '0.' || 
        cleanValue === '-0.' || 
        cleanValue === '+0.') return null;
    
    // Special case for explicit zero values
    if (cleanValue === '0' || 
        cleanValue === '-0' || 
        cleanValue === '+0' || 
        cleanValue === '0.0' || 
        cleanValue === '-0.0' || 
        cleanValue === '+0.0') return 0;
    
    // Attempt to parse the value
    const numValue = parseFloat(cleanValue);
    
    return isNaN(numValue) ? null : numValue;
  };

  const addBreak = () => {
    const lastBreak = breaks[breaks.length - 1];
    let newMaxValue;
    
    if (lastBreak.maxValue === Infinity) {
      const secondToLastBreak = breaks[breaks.length - 2];
      newMaxValue = lastBreak.minValue * 1.5;
      lastBreak.minValue = newMaxValue;
    } else {
      newMaxValue = lastBreak.maxValue * 1.5;
    }

    const newBreak = {
      minValue: lastBreak.maxValue,
      maxValue: newMaxValue,
      symbol: {
        type: "simple-fill",
        color: "#ffffff",
        outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
      },
      label: `${lastBreak.maxValue} - ${newMaxValue}`
    };

    const newBreaks = [...breaks];
    if (lastBreak.maxValue === Infinity) {
      newBreaks.splice(newBreaks.length - 1, 0, newBreak);
    } else {
      newBreaks.push(newBreak);
    }

    onBreaksChange(newBreaks);
  };

  const removeBreak = (index) => {
    if (breaks.length > 2) {
      const newBreaks = [...breaks];
      newBreaks.splice(index, 1);
      
      for (let i = 0; i < newBreaks.length; i++) {
        if (i > 0) {
          newBreaks[i].minValue = newBreaks[i - 1].maxValue;
        }
        newBreaks[i].label = getDisplayLabel(newBreaks[i], i);
      }
      
      onBreaksChange(newBreaks);
    }
  };

  
  const updateBreak = (index, field, value) => {
    const newBreaks = [...breaks];
    const break_item = newBreaks[index];
  
    if (field === 'color') {
      const alpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.35;
      break_item.symbol.color = hexToRgba(value, alpha);
    } else if (field === 'transparency') {
      const numValue = parseInt(value);
      const alpha = numValue / 100; // Now higher transparency value means more opacity
      newBreaks.forEach(breakItem => {
        if (Array.isArray(breakItem.symbol.color)) {
          breakItem.symbol.color[3] = alpha;
        } else {
          breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
        }
      });
      setTransparency(numValue);
    } else if (field === 'maxValue' || field === 'minValue') {
      const parsedValue = parseInputValue(value);
      
      // If the input is not a complete number (like '.' or '0.'), keep the original input
      if (parsedValue === null) {
        break_item[field] = value;
      } else {
        // For valid numbers, update the breaks
        break_item[field] = parsedValue;

        // Handle the first break's max value (minimum range)
        if (index === 0 && field === 'maxValue') {
          newBreaks[1].minValue = parsedValue;
          setMinRange(parsedValue);
        }
        // Handle the last break's min value (maximum range)
        else if (index === newBreaks.length - 1 && field === 'minValue') {
          newBreaks[newBreaks.length - 2].maxValue = parsedValue;
          setMaxRange(parsedValue);
        }
        // Handle intermediate breaks
        else if (index !== 0 && index !== newBreaks.length - 1) {
          const lowerBound = newBreaks[0].maxValue;
          const upperBound = newBreaks[newBreaks.length - 1].minValue;
          
          if (parsedValue > lowerBound && parsedValue < upperBound) {
            if (field === 'maxValue' && index < newBreaks.length - 1) {
              newBreaks[index + 1].minValue = parsedValue;
            } else if (field === 'minValue' && index > 0) {
              newBreaks[index - 1].maxValue = parsedValue;
            }
          }
        }
      }
    }
  
    // Update all labels
    newBreaks.forEach((breakItem, i) => {
      breakItem.label = getDisplayLabel(breakItem, i);
    });
  
    onBreaksChange(newBreaks);
  };

  // Return JSX
  return (
    <div className="space-y-4">
      {/* Max and Min Range Fields */}
      <div className="grid grid-cols-2 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Minimum Range
          </label>
          <input
            type="text"
            value={formatValue(breaks[0].maxValue)}
            onChange={(e) => updateBreak(0, 'maxValue', e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Enter minimum value"
            />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Maximum Range
          </label>
          <input
            type="text"
            value={formatValue(breaks[breaks.length - 1].minValue)}
            onChange={(e) => updateBreak(breaks.length - 1, 'minValue', e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Enter maximum value"
            />
        </div>
      </div>
  
      {/* Distribution Slider */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Color Distribution
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {distribution === 1 ? 'Linear' : distribution < 1 ? 'Highlight Low Values' : 'Highlight High Values'}
          </span>
        </div>
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.05"
          value={distribution}
          onChange={(e) => adjustDistribution(e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Low Values</span>
          <span>Linear</span>
          <span>High Values</span>
        </div>
      </div>
  
      {/* Transparency Slider */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Opacity
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {transparency}%
        </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={transparency}
          onChange={(e) => updateBreak(0, 'transparency', e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        />
      </div>
  
      {/* Color Breaks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-black dark:text-white">Color Breaks</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {breaks.length} breaks
          </div>
        </div>
  
        <div className="space-y-2">
          {breaks.map((breakItem, index) => (
            <div key={index} className="group flex items-center space-x-2 py-1">
              {/* Color Picker */}
              <div className="relative">
                <div 
                  className="w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700"
                  style={{
                    backgroundColor: Array.isArray(breakItem.symbol.color) ? 
                      `rgba(${breakItem.symbol.color[0]}, ${breakItem.symbol.color[1]}, ${breakItem.symbol.color[2]}, ${breakItem.symbol.color[3]})` :
                      breakItem.symbol.color,
                    backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
                    backgroundSize: '10px 10px',
                    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                  }}
                >
                  <input
                    type="color"
                    value={rgbaToHex(breakItem.symbol.color)}
                    onChange={(e) => updateBreak(index, 'color', e.target.value)}
                    className="opacity-0 w-full h-full cursor-pointer"
                    title="Choose color"
                  />
                </div>
              </div>
  
              {/* Break Range Inputs */}
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={formatValue(breakItem.minValue)}
                  onChange={(e) => updateBreak(index, 'minValue', e.target.value)}
                  className="w-24 px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 text-sm"
                  placeholder="Min"
                  disabled={index === 0}
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="text"
                  value={formatValue(breakItem.maxValue)}
                  onChange={(e) => updateBreak(index, 'maxValue', e.target.value)}
                  className="w-24 px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 text-sm"
                  placeholder="Max"
                  disabled={index === breaks.length - 1}
                />
              </div>
  
              {/* Remove Button - Only show for middle breaks */}
              {index !== 0 && index !== breaks.length - 1 && (
                <button
                  onClick={() => removeBreak(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                  title="Remove break"
                >
                  <Minus size={16} />
                </button>
              )}
  
              {/* Display Label */}
              <div className="text-xs text-gray-400">
                {getDisplayLabel(breakItem, index)}
              </div>
            </div>
          ))}
  
          {/* Add Break Button */}
          <button
            onClick={addBreak}
            className="w-full mt-2 py-1.5 px-4 border border-dashed border-gray-700 
                     rounded text-gray-400 hover:text-blue-400 hover:border-blue-400 
                     transition-colors flex items-center justify-center space-x-2 text-sm"
          >
            <Plus size={16} />
            <span>Add Break</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorBreakEditor;