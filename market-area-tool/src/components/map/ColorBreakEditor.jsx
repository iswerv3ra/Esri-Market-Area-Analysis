'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import NumberRangeInput from './NumberRangeInput';

const ColorBreakEditor = ({ breaks = [], onBreaksChange, visualizationType = 'income' }) => {
  const [distribution, setDistribution] = useState(1);
  const [transparency, setTransparency] = useState(40);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);

  useEffect(() => {
    // Initialize ranges when breaks array changes
    if (breaks && breaks.length > 0) {
      const firstBreak = breaks[0]?.maxValue;
      const lastBreak = breaks[breaks.length - 1]?.minValue;
      
      if (firstBreak !== undefined && lastBreak !== undefined) {
        setMinRange(firstBreak);
        setMaxRange(lastBreak);
      }
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

  const calculateDistributedValue = (normalizedPosition, distributionValue) => {
    if (distributionValue === 1) return normalizedPosition;

    const expFactor = distributionValue > 1 ? distributionValue : 1/distributionValue;
    let adjustedPosition;

    if (distributionValue > 1) {
      adjustedPosition = Math.pow(normalizedPosition, expFactor);
    } else {
      adjustedPosition = 1 - Math.pow(1 - normalizedPosition, expFactor);
    }

    if (distributionValue !== 1) {
      const scalingFactor = distributionValue > 1 ? 1.2 : 0.8;
      adjustedPosition = adjustedPosition * scalingFactor;
      adjustedPosition = Math.max(0, Math.min(1, adjustedPosition));
    }

    return adjustedPosition;
  };

  const adjustDistribution = (value) => {
    const newValue = parseFloat(value);
    if (isNaN(newValue)) return;
    
    setDistribution(newValue);
    
    // Get current min/max values
    const lowerBound = parseFloat(breaks[0].maxValue);
    const upperBound = parseFloat(breaks[breaks.length - 1].minValue);
    
    // Validate bounds
    if (isNaN(lowerBound) || isNaN(upperBound) || lowerBound >= upperBound) {
      return;
    }
    
    const range = upperBound - lowerBound;
    const newBreaks = [...breaks];

    // Adjust intermediate breaks (skip first and last)
    for (let i = 1; i < breaks.length - 1; i++) {
      const normalizedPosition = (i) / (breaks.length - 2);
      const adjustedPosition = calculateDistributedValue(normalizedPosition, newValue);
      
      const newBreakValue = lowerBound + (range * adjustedPosition);
      const finalValue = visualizationType === 'income' 
        ? Math.round(newBreakValue)
        : parseFloat(newBreakValue.toFixed(2));

      // Update current break
      newBreaks[i].maxValue = finalValue;
      newBreaks[i].minValue = i === 1 ? lowerBound : newBreaks[i-1].maxValue;

      // Update next break's min value if not the last one
      if (i < breaks.length - 2) {
        newBreaks[i + 1].minValue = finalValue;
      }
    }

    // Update all labels
    newBreaks.forEach((breakItem, index) => {
      breakItem.label = getDisplayLabel(breakItem, index);
    });
    
    onBreaksChange(newBreaks);
  };

  const parseInputValue = (value) => {
    if (value === '' || value === '-' || value === '.' || /^-?\d*\.?\d*$/.test(value)) {
      return value;
    }
  
    const cleanValue = String(value).replace(/,/g, '').trim();
    
    if (cleanValue.toLowerCase() === 'infinity' || cleanValue === '∞') return Infinity;
    if (cleanValue.toLowerCase() === '-infinity' || cleanValue === '-∞') return -Infinity;
    
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? null : numValue;
  };

  const updateBreak = (index, field, value) => {
    const newBreaks = [...breaks];
    const break_item = newBreaks[index];
    
    // Store original breaks for potential restoration
    const originalBreaks = JSON.parse(JSON.stringify(breaks));
  
    if (field === 'color') {
      const alpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.35;
      break_item.symbol.color = hexToRgba(value, alpha);
      onBreaksChange(newBreaks);
      return;
    } 
    
    if (field === 'transparency') {
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
      onBreaksChange(newBreaks);
      return;
    }
  
    if (field === 'maxValue' || field === 'minValue') {
      const parsedValue = parseInputValue(value);
      
      // Allow partial number entry
      if (parsedValue === null || typeof parsedValue === 'string') {
        break_item[field] = value;
        onBreaksChange(newBreaks);
        return;
      }
  
      // Apply the change to the current break
      break_item[field] = parsedValue;
  
      // Function to parse break value safely
      const parseBreakValue = (val) => {
        if (val === Infinity || val === -Infinity) return val;
        return parseFloat(val);
      };
  
      // Sort breaks based on their values, excluding first and last breaks
      const sortBreaks = () => {
        // Keep first and last breaks in place
        const firstBreak = newBreaks[0];
        const lastBreak = newBreaks[newBreaks.length - 1];
        
        // Sort middle breaks
        const middleBreaks = newBreaks.slice(1, -1)
          .sort((a, b) => {
            const aVal = parseBreakValue(a.minValue);
            const bVal = parseBreakValue(b.minValue);
            return aVal - bVal;
          });
  
        // Recombine breaks
        return [firstBreak, ...middleBreaks, lastBreak];
      };
  
      // Ensure breaks maintain proper sequence and continuity
      const validateAndAdjustBreaks = (breaks) => {
        // First sort the breaks
        const sortedBreaks = sortBreaks();
        
        // Forward pass to ensure continuity
        for (let i = 0; i < sortedBreaks.length - 1; i++) {
          const current = sortedBreaks[i];
          const next = sortedBreaks[i + 1];
          
          // Ensure current break's min is less than its max
          if (parseBreakValue(current.minValue) >= parseBreakValue(current.maxValue)) {
            current.maxValue = parseBreakValue(current.minValue) + 1;
          }
          
          // Ensure current break's max equals next break's min
          next.minValue = current.maxValue;
        }
        
        // Backward pass to maintain continuity
        for (let i = sortedBreaks.length - 1; i > 0; i--) {
          const current = sortedBreaks[i];
          const prev = sortedBreaks[i - 1];
          
          prev.maxValue = current.minValue;
        }
  
        return sortedBreaks;
      };
  
      // Apply validation and adjustments
      const adjustedBreaks = validateAndAdjustBreaks(newBreaks);
  
      // Update all labels
      adjustedBreaks.forEach((breakItem, i) => {
        breakItem.label = getDisplayLabel(breakItem, i);
      });
  
      onBreaksChange(adjustedBreaks);
      return;
    }
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
      
      // Update adjacent breaks
      for (let i = 0; i < newBreaks.length; i++) {
        if (i > 0) {
          newBreaks[i].minValue = newBreaks[i - 1].maxValue;
        }
        newBreaks[i].label = getDisplayLabel(newBreaks[i], i);
      }
      
      onBreaksChange(newBreaks);
    }
  };

  return (
    <div className="space-y-4">
      {/* Min/Max Range Section */}
      <div className="grid grid-cols-2 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Minimum Range
          </label>
          <NumberRangeInput
            value={breaks[0]?.maxValue}
            onChange={(value) => updateBreak(0, 'maxValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
            placeholder="Enter minimum value"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Maximum Range
          </label>
          <NumberRangeInput
            value={breaks[breaks.length - 1]?.minValue}
            onChange={(value) => updateBreak(breaks.length - 1, 'minValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
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

    {/* Opacity Slider */}
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

    {/* Color Breaks Section */}
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

            <div className="flex items-center space-x-2 flex-1">
              <NumberRangeInput
                value={breakItem.minValue}
                onChange={(value) => updateBreak(index, 'minValue', value)}
                disabled={index === 0}
                placeholder="Min"
                formatValue={formatValue}
              />
              <span className="text-gray-400 text-sm">to</span>
              <NumberRangeInput
                value={breakItem.maxValue}
                onChange={(value) => updateBreak(index, 'maxValue', value)}
                disabled={index === breaks.length - 1}
                placeholder="Max"
                formatValue={formatValue}
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