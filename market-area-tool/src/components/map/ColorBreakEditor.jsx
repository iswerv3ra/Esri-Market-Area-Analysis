'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';

const ColorBreakEditor = ({ breaks = [], onBreaksChange, visualizationType = 'income' }) => {
  const [distribution, setDistribution] = useState(1);
  const [transparency, setTransparency] = useState(40);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);

  useEffect(() => {
    // Initialize ranges when breaks array changes
    if (breaks && breaks.length > 0) {
      setMinRange(breaks[0]?.maxValue || 0);
      setMaxRange(breaks[breaks.length - 1]?.minValue || 0);
    }
  }, [breaks]);

  // Guard against undefined or empty breaks
  if (!breaks || breaks.length === 0) {
    return (
      <div className="p-4 text-gray-600 dark:text-gray-400">
        No break points configured. Please check visualization settings.
      </div>
    );
  }

  const formatValue = (value) => {
    if (value === undefined || value === null) return '';
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '-∞';
    if (typeof value === 'number') {
      if (visualizationType === 'income') {
        return Math.round(value).toLocaleString();
      } else {
        return value.toFixed(2);
      }
    }
    return value;
  };

  const getDisplayLabel = (breakItem, index) => {
    if (!breakItem) return '';
    
    const cleanNumber = (value) => {
      if (value === undefined || value === null) return '';
      if (value === -Infinity) return '-∞';
      if (value === Infinity) return '∞';
      if (typeof value === 'number') {
        if (visualizationType === 'income') {
          return Math.round(value).toLocaleString();
        } else {
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

  // Enhanced distribution calculation
  const calculateDistributedValue = (normalizedPosition, distributionValue) => {
    if (distributionValue === 1) {
      return normalizedPosition;
    }

    const expFactor = distributionValue > 1 ? distributionValue : 1/distributionValue;
    let adjustedPosition;

    if (distributionValue > 1) {
      // Emphasize higher values - exponential curve
      adjustedPosition = Math.pow(normalizedPosition, expFactor);
    } else {
      // Emphasize lower values - inverse exponential curve
      adjustedPosition = 1 - Math.pow(1 - normalizedPosition, expFactor);
    }

    // Apply additional scaling for more pronounced effect at extremes
    if (distributionValue !== 1) {
      const scalingFactor = distributionValue > 1 ? 1.2 : 0.8;
      adjustedPosition = adjustedPosition * scalingFactor;
      // Ensure we stay within bounds
      adjustedPosition = Math.max(0, Math.min(1, adjustedPosition));
    }

    return adjustedPosition;
  };

  const adjustDistribution = (value) => {
    const newValue = parseFloat(value);
    setDistribution(newValue);
    
    const newBreaks = [...breaks];
    const lowerBound = breaks[0].maxValue;
    const upperBound = breaks[breaks.length - 1].minValue;
    const range = upperBound - lowerBound;

    // Adjust intermediate breaks (skip first and last)
    for (let i = 1; i < breaks.length - 1; i++) {
      const normalizedPosition = (i) / (breaks.length - 2);
      const adjustedPosition = calculateDistributedValue(normalizedPosition, newValue);
      
      // Calculate the new break value
      const newBreakValue = lowerBound + (range * adjustedPosition);
      
      // Format based on visualization type
      const finalValue = visualizationType === 'income' 
        ? Math.round(newBreakValue)
        : parseFloat(newBreakValue.toFixed(2));

      // Update break values ensuring proper order
      newBreaks[i].maxValue = Math.min(upperBound, Math.max(lowerBound, finalValue));
      newBreaks[i].minValue = i === 1 ? lowerBound : newBreaks[i-1].maxValue;
    }

    // Ensure proper connectivity between breaks
    for (let i = 1; i < breaks.length - 1; i++) {
      if (i < breaks.length - 2) {
        newBreaks[i + 1].minValue = newBreaks[i].maxValue;
      }
    }

    // Update all labels
    newBreaks.forEach((breakItem, index) => {
      breakItem.label = getDisplayLabel(breakItem, index);
    });
    
    onBreaksChange(newBreaks);
  };

  // Color conversion utilities
  const rgbaToHex = (rgba) => {
    if (Array.isArray(rgba)) {
      return `#${rgba[0].toString(16).padStart(2, '0')}${rgba[1].toString(16).padStart(2, '0')}${rgba[2].toString(16).padStart(2, '0')}`;
    }
    return rgba;
  };

  const hexToRgba = (hex, alpha = 0.35) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, alpha];
  };

  const parseInputValue = (value) => {
    const cleanValue = String(value).replace(/,/g, '').trim();
    
    if (cleanValue.toLowerCase() === 'infinity' || cleanValue === '∞') return Infinity;
    if (cleanValue.toLowerCase() === '-infinity' || cleanValue === '-∞') return -Infinity;
    
    if (cleanValue === '' || 
        cleanValue === '.' || 
        cleanValue === '-.' || 
        cleanValue === '+.' || 
        cleanValue === '0.' || 
        cleanValue === '-0.' || 
        cleanValue === '+0.') return null;
    
    if (cleanValue === '0' || 
        cleanValue === '-0' || 
        cleanValue === '+0' || 
        cleanValue === '0.0' || 
        cleanValue === '-0.0' || 
        cleanValue === '+0.0') return 0;
    
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
      const alpha = numValue / 100;
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
      
      if (parsedValue === null) {
        break_item[field] = value;
      } else {
        break_item[field] = parsedValue;

        if (index === 0 && field === 'maxValue') {
          newBreaks[1].minValue = parsedValue;
          setMinRange(parsedValue);
        }
        else if (index === newBreaks.length - 1 && field === 'minValue') {
          newBreaks[newBreaks.length - 2].maxValue = parsedValue;
          setMaxRange(parsedValue);
        }
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
  
    newBreaks.forEach((breakItem, i) => {
      breakItem.label = getDisplayLabel(breakItem, i);
    });
  
    onBreaksChange(newBreaks);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Minimum Range
          </label>
          <input
            type="text"
            value={formatValue(breaks[0]?.maxValue)}
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
            value={formatValue(breaks[breaks.length - 1]?.minValue)}
            onChange={(e) => updateBreak(breaks.length - 1, 'minValue', e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Enter maximum value"
          />
        </div>
      </div>

      {/* Distribution slider */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {visualizationType === 'income' || visualizationType === 'homeValue' 
              ? 'Value Distribution' 
              : 'Color Distribution'}
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
              <div className="relative">
                <div 
                  className="w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700"style={{
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

              {index !== 0 && index !== breaks.length - 1 && (
                <button
                  onClick={() => removeBreak(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                  title="Remove break"
                >
                  <Minus size={16} />
                </button>
              )}

              <div className="text-xs text-gray-400">
                {getDisplayLabel(breakItem, index)}
              </div>
            </div>
          ))}

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