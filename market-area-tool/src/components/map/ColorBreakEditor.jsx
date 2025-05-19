'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import NumberRangeInput from './NumberRangeInput';

const ColorBreakEditor = ({ breaks = [], onBreaksChange, visualizationType = 'income' }) => {
  const [transparency, setTransparency] = useState(40);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);
  const [localBreaks, setLocalBreaks] = useState(breaks || []);
  
  // Refs for debouncing
  const transparencyTimeoutRef = useRef(null);
  const breakTimeoutRefs = useRef({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (transparencyTimeoutRef.current) {
        clearTimeout(transparencyTimeoutRef.current);
      }
      Object.values(breakTimeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Sync local breaks with props
  useEffect(() => {
    setLocalBreaks(breaks || []);
  }, [breaks]);

  useEffect(() => {
    // Initialize ranges when breaks array changes
    if (breaks && breaks.length > 0) {
      const firstBreak = breaks[0]?.maxValue;
      const lastBreak = breaks[breaks.length - 1]?.minValue;
      
      if (firstBreak !== undefined && lastBreak !== undefined) {
        setMinRange(firstBreak);
        setMaxRange(lastBreak);
      }

      // Sync transparency state with actual break transparency
      const firstBreakColor = breaks[0]?.symbol?.color;
      if (Array.isArray(firstBreakColor) && firstBreakColor[3] !== undefined) {
        const currentTransparency = Math.round(firstBreakColor[3] * 100);
        setTransparency(currentTransparency);
      }
    }
  }, [breaks]);

  // Guard against undefined or empty breaks
  if (!localBreaks || localBreaks.length === 0) {
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

    if (isFirst) {
      return `Less than ${cleanNumber(breakItem.maxValue)}`;
    }
    if (isLast) {
      return `${cleanNumber(breakItem.minValue)} or more`;
    }
    return `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
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

  const updateBreak = (index, field, value, immediate = false) => {
    // Create a copy of local breaks for immediate UI updates
    const newLocalBreaks = [...localBreaks];
    const break_item = newLocalBreaks[index];
    
    if (field === 'color') {
      const alpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.35;
      break_item.symbol.color = hexToRgba(value, alpha);
      setLocalBreaks(newLocalBreaks);
      onBreaksChange(newLocalBreaks);
      return;
    } 
    
    if (field === 'transparency') {
      // Update local state immediately for responsive UI
      setTransparency(parseInt(value));
      
      // Clear existing timeout
      if (transparencyTimeoutRef.current) {
        clearTimeout(transparencyTimeoutRef.current);
      }
      
      // Set debounced update
      transparencyTimeoutRef.current = setTimeout(() => {
        const numValue = parseInt(value);
        const alpha = numValue / 100;
        const updatedBreaks = [...breaks];
        updatedBreaks.forEach(breakItem => {
          if (Array.isArray(breakItem.symbol.color)) {
            breakItem.symbol.color[3] = alpha;
          } else {
            breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
          }
        });
        onBreaksChange(updatedBreaks);
      }, immediate ? 0 : 1000);
      return;
    }
  
    // Handle min/max value updates with debouncing
    if (field === 'maxValue' || field === 'minValue') {
      const parsedValue = parseInputValue(value);
      
      // Update local state immediately for UI responsiveness
      break_item[field] = value;
      setLocalBreaks(newLocalBreaks);
      
      // Clear existing timeout for this break
      const timeoutKey = `${index}-${field}`;
      if (breakTimeoutRefs.current[timeoutKey]) {
        clearTimeout(breakTimeoutRefs.current[timeoutKey]);
      }
      
      // Function to process the break update with full validation
      const processBreakUpdate = () => {
        const finalBreaks = [...breaks];
        const finalBreakItem = finalBreaks[index];
        
        // Parse the final value
        const finalParsedValue = parseInputValue(value);
        if (finalParsedValue === null || typeof finalParsedValue === 'string') {
          // If still not a valid number, try to convert or ignore
          const numericValue = parseFloat(String(value).replace(/,/g, ''));
          if (isNaN(numericValue)) return; // Ignore invalid input
          finalBreakItem[field] = numericValue;
        } else {
          finalBreakItem[field] = finalParsedValue;
        }
        
        // Function to parse break value safely
        const parseBreakValue = (val) => {
          if (val === Infinity || val === -Infinity) return val;
          return parseFloat(val);
        };
    
        // Sort breaks based on their values, excluding first and last breaks
        const sortBreaks = () => {
          // Keep first and last breaks in place
          const firstBreak = finalBreaks[0];
          const lastBreak = finalBreaks[finalBreaks.length - 1];
          
          // Sort middle breaks
          const middleBreaks = finalBreaks.slice(1, -1)
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
        const adjustedBreaks = validateAndAdjustBreaks(finalBreaks);
    
        // Update all labels
        adjustedBreaks.forEach((breakItem, i) => {
          breakItem.label = getDisplayLabel(breakItem, i);
        });
    
        // Submit the final changes
        onBreaksChange(adjustedBreaks);
      };
      
      // Execute immediately or with delay
      if (immediate) {
        processBreakUpdate();
      } else {
        // Set debounced update
        breakTimeoutRefs.current[timeoutKey] = setTimeout(processBreakUpdate, 1000);
      }
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
    const lastBreak = localBreaks[localBreaks.length - 1];
    let newMaxValue;
    
    if (lastBreak.maxValue === Infinity) {
      const secondToLastBreak = localBreaks[localBreaks.length - 2];
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

    const newBreaks = [...localBreaks];
    if (lastBreak.maxValue === Infinity) {
      newBreaks.splice(newBreaks.length - 1, 0, newBreak);
    } else {
      newBreaks.push(newBreak);
    }

    setLocalBreaks(newBreaks);
    onBreaksChange(newBreaks);
  };

  const removeBreak = (index) => {
    if (localBreaks.length > 2) {
      const newBreaks = [...localBreaks];
      newBreaks.splice(index, 1);
      
      // Update adjacent breaks
      for (let i = 0; i < newBreaks.length; i++) {
        if (i > 0) {
          newBreaks[i].minValue = newBreaks[i - 1].maxValue;
        }
        newBreaks[i].label = getDisplayLabel(newBreaks[i], i);
      }
      
      setLocalBreaks(newBreaks);
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
            value={localBreaks[0]?.maxValue}
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
            value={localBreaks[localBreaks.length - 1]?.minValue}
            onChange={(value) => updateBreak(localBreaks.length - 1, 'minValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
            placeholder="Enter maximum value"
          />
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
            {localBreaks.length} breaks
          </div>
        </div>

        <div className="space-y-2">
          {localBreaks.map((breakItem, index) => (
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
                  disabled={index === localBreaks.length - 1}
                  placeholder="Max"
                  formatValue={formatValue}
                />
              </div>

              {index !== 0 && index !== localBreaks.length - 1 && (
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