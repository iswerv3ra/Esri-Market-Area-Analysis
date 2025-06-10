import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import NumberRangeInput from './NumberRangeInput';

const ColorBreakEditor = ({ breaks = [], onBreaksChange, visualizationType = 'income' }) => {
  const [transparency, setTransparency] = useState(40);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);
  const [localBreaks, setLocalBreaks] = useState(breaks || []);
  const [hasCustomOpacities, setHasCustomOpacities] = useState(false);
  
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

  const detectCustomOpacities = (breaksArray) => {
    if (!breaksArray || breaksArray.length === 0) return false;
    
    // Check if breaks are explicitly marked as having custom opacities (from heat maps)
    const hasCustomMarker = breaksArray.some(breakItem => 
      breakItem.preserveOpacity || 
      breakItem.hasCustomOpacities || 
      breakItem.originalOpacity !== undefined
    );
    
    if (hasCustomMarker) {
      console.log("[ColorBreakEditor] Heat map with intentional custom opacities detected");
      return true;
    }
    
    // Check opacity variation with more tolerance for intentional design
    const opacityValues = breaksArray.map(breakItem => {
      if (Array.isArray(breakItem.symbol?.color) && breakItem.symbol.color[3] !== undefined) {
        return Math.round(breakItem.symbol.color[3] * 100);
      }
      return 35; // Default value
    });
    
    // Calculate if there's significant variation in opacity values
    const firstOpacity = opacityValues[0];
    const hasSignificantVariation = opacityValues.some(opacity => 
      Math.abs(opacity - firstOpacity) > 3 // Increased tolerance to 3%
    );
    
    if (hasSignificantVariation) {
      console.log("[ColorBreakEditor] Custom opacities detected in breaks:", 
        opacityValues.map((val, i) => `${i}: ${val}%`).join(', ')
      );
      return true;
    }
    
    // Additional check for heat map typical opacity ranges
    const hasHeatMapPattern = opacityValues.some(opacity => 
      [15, 20, 25, 35, 40].includes(opacity) // Common heat map opacity values
    ) && new Set(opacityValues).size > 1; // Multiple different values
    
    if (hasHeatMapPattern) {
      console.log("[ColorBreakEditor] Heat map opacity pattern detected:", opacityValues.join('%, ') + '%');
      return true;
    }
    
    return false;
  };


  useEffect(() => {
    if (breaks && breaks.length > 0) {
      const normalizedBreaks = [...breaks];
      
      // Convert Infinity values to large numeric values
      const lastBreakIndex = normalizedBreaks.length - 1;
      if (normalizedBreaks[lastBreakIndex].maxValue === Infinity) {
        const lastMinValue = normalizedBreaks[lastBreakIndex].minValue;
        normalizedBreaks[lastBreakIndex].maxValue = lastMinValue * 2;
      }
      
      // Preserve any custom opacity metadata from heat maps
      normalizedBreaks.forEach((breakItem, index) => {
        // Ensure original opacity is preserved if it exists
        if (breakItem.originalOpacity !== undefined && Array.isArray(breakItem.symbol.color)) {
          breakItem.symbol.color[3] = breakItem.originalOpacity;
        }
        
        // Preserve custom opacity flags
        if (breakItem.preserveOpacity) {
          breakItem.preserveOpacity = true;
        }
        if (breakItem.hasCustomOpacities) {
          breakItem.hasCustomOpacities = true;
        }
      });
      
      setLocalBreaks(normalizedBreaks);
      
      // Update min/max range UI values
      const firstBreak = normalizedBreaks[0]?.maxValue;
      const lastBreak = normalizedBreaks[lastBreakIndex]?.minValue;
      const lastBreakMax = normalizedBreaks[lastBreakIndex]?.maxValue;
      
      if (firstBreak !== undefined && lastBreak !== undefined) {
        setMinRange(firstBreak);
        setMaxRange(lastBreakMax || lastBreak * 2);
      }

      // Check for custom opacity values with enhanced detection
      const hasCustom = detectCustomOpacities(normalizedBreaks);
      setHasCustomOpacities(hasCustom);

      // Only sync transparency state if all breaks have uniform opacity
      if (!hasCustom) {
        const firstBreakColor = normalizedBreaks[0]?.symbol?.color;
        if (Array.isArray(firstBreakColor) && firstBreakColor[3] !== undefined) {
          const currentTransparency = Math.round(firstBreakColor[3] * 100);
          setTransparency(currentTransparency);
        }
      } else {
        // For custom opacities, set transparency slider to average value but don't apply it
        const avgOpacity = normalizedBreaks.reduce((sum, breakItem) => {
          return sum + getBreakTransparency(breakItem);
        }, 0) / normalizedBreaks.length;
        setTransparency(Math.round(avgOpacity));
        
        console.log("[ColorBreakEditor] Custom opacities preserved:", 
          normalizedBreaks.map((b, i) => {
            const opacity = Array.isArray(b.symbol?.color) ? Math.round(b.symbol.color[3] * 100) : 35;
            return `${i}: ${opacity}%`;
          }).join(', ')
        );
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
    const isLast = index === localBreaks.length - 1;

    if (isFirst) {
      return `Less than ${cleanNumber(breakItem.maxValue)}`;
    }
    if (isLast) {
      // Display the actual range for the last break instead of "or more"
      return `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
    }
    return `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
  };

  const parseInputValue = (value) => {
    if (value === '' || value === '-' || value === '.' || /^-?\d*\.?\d*$/.test(value)) {
      return value;
    }
  
    const cleanValue = String(value).replace(/,/g, '').trim();
    
    // Don't support Infinity anymore - parse as number instead
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? null : numValue;
  };

  const updateBreak = (index, field, value, immediate = false) => {
    // Create a copy of local breaks for immediate UI updates
    const newLocalBreaks = [...localBreaks];
    const break_item = newLocalBreaks[index];
    
    if (field === 'color') {
      // Preserve existing alpha when changing color
      const existingAlpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.35;
      break_item.symbol.color = hexToRgba(value, existingAlpha);
      setLocalBreaks(newLocalBreaks);
      onBreaksChange(newLocalBreaks);
      return;
    } 
    
    // Handle individual break transparency
    if (field === 'individualTransparency') {
      // Clear existing timeout for this specific break
      const timeoutKey = `${index}-transparency`;
      if (breakTimeoutRefs.current[timeoutKey]) {
        clearTimeout(breakTimeoutRefs.current[timeoutKey]);
      }
      
      // Update local state immediately for responsive UI
      const numValue = parseInt(value);
      const alpha = numValue / 100;
      
      // Update the specific break's transparency immediately in local state
      if (Array.isArray(break_item.symbol.color)) {
        break_item.symbol.color[3] = alpha;
      } else {
        break_item.symbol.color = hexToRgba(break_item.symbol.color, alpha);
      }
      setLocalBreaks(newLocalBreaks);
      
      // Mark that we now have custom opacities
      setHasCustomOpacities(true);
      
      // Debounced update to parent
      breakTimeoutRefs.current[timeoutKey] = setTimeout(() => {
        onBreaksChange([...newLocalBreaks]);
      }, immediate ? 0 : 300);
      return;
    }
    
    // Handle global transparency - only apply if user explicitly wants uniform opacity
    if (field === 'transparency') {
      // Update local state immediately for responsive UI
      setTransparency(parseInt(value));
      
      // Clear existing timeout
      if (transparencyTimeoutRef.current) {
        clearTimeout(transparencyTimeoutRef.current);
      }
      
      // Only apply global transparency if we don't have custom opacities or user confirms
      if (!hasCustomOpacities) {
        // Set debounced update for uniform opacity
        transparencyTimeoutRef.current = setTimeout(() => {
          const numValue = parseInt(value);
          const alpha = numValue / 100;
          const updatedBreaks = [...localBreaks];
          updatedBreaks.forEach(breakItem => {
            if (Array.isArray(breakItem.symbol.color)) {
              breakItem.symbol.color[3] = alpha;
            } else {
              breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
            }
          });
          onBreaksChange(updatedBreaks);
        }, immediate ? 0 : 1000);
      }
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
        const finalBreaks = [...localBreaks];
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
            
            // Ensure current break's max equals next break's min for all except last break
            if (i < sortedBreaks.length - 2) { // Only adjust when not dealing with last break
              next.minValue = current.maxValue;
            }
          }
          
          // For the last break, check if max is greater than min but don't auto-adjust
          const lastBreak = sortedBreaks[sortedBreaks.length - 1];
          if (parseBreakValue(lastBreak.minValue) >= parseBreakValue(lastBreak.maxValue)) {
            // Only adjust if there's an actual problem
            if (field !== 'maxValue' || index !== sortedBreaks.length - 1) { 
              // Don't auto-adjust if user is explicitly setting the max value of last break
              lastBreak.maxValue = parseBreakValue(lastBreak.minValue) * 1.1;
            }
          }
          
          // Backward pass to maintain continuity for all except last break
          for (let i = sortedBreaks.length - 2; i > 0; i--) {
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

  const hexToRgba = (hex, alpha = null) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Use provided alpha or default to 0.35 only if no alpha specified
    const finalAlpha = alpha !== null ? alpha : 0.35;
    return [r, g, b, finalAlpha];
  };

  // Helper to get the current transparency value for a break
  const getBreakTransparency = (breakItem) => {
    if (Array.isArray(breakItem?.symbol?.color) && breakItem.symbol.color[3] !== undefined) {
      return Math.round(breakItem.symbol.color[3] * 100);
    }
    return 35; // Default transparency
  };

  const addBreak = () => {
    const lastBreak = localBreaks[localBreaks.length - 1];
    const lastMaxValue = lastBreak.maxValue;
    
    // Calculate new break point values
    const range = lastMaxValue - lastBreak.minValue;
    const newMinValue = lastBreak.minValue;
    const newMaxValue = newMinValue + (range * 0.7); // Smaller increment
    
    // Update last break's max value
    lastBreak.maxValue = newMaxValue;
    lastBreak.label = getDisplayLabel(lastBreak, localBreaks.length - 1);
    
    // Create new break with same color configuration as the last break
    // Preserve the exact opacity from the last break
    const lastBreakOpacity = Array.isArray(lastBreak.symbol.color) ? lastBreak.symbol.color[3] : 0.35;
    
    const newBreak = {
      minValue: newMaxValue,
      maxValue: lastMaxValue, // Use the original max value for the new last break
      symbol: {
        type: "simple-fill",
        color: Array.isArray(lastBreak.symbol.color) 
          ? [...lastBreak.symbol.color.slice(0, 3), lastBreakOpacity] 
          : hexToRgba(lastBreak.symbol.color || "#ffffff", lastBreakOpacity),
        outline: { 
          color: [50, 50, 50, 0.2], 
          width: lastBreak.symbol.outline?.width || "0.5px" 
        }
      }
    };
    
    const newBreaks = [...localBreaks, newBreak];
    
    // Update all labels to ensure consistency
    newBreaks.forEach((breakItem, idx) => {
      breakItem.label = getDisplayLabel(breakItem, idx);
    });

    setLocalBreaks(newBreaks);
    onBreaksChange(newBreaks);
  };

  const removeBreak = (index) => {
    if (localBreaks.length > 2) {
      const newBreaks = [...localBreaks];
      const removedBreak = newBreaks[index];
      const lastMaxValue = newBreaks[newBreaks.length - 1].maxValue;
      
      newBreaks.splice(index, 1);
      
      // Update adjacent breaks
      for (let i = index; i < newBreaks.length - 1; i++) {
        newBreaks[i + 1].minValue = newBreaks[i].maxValue;
      }
      
      // Preserve the last break's max value
      newBreaks[newBreaks.length - 1].maxValue = lastMaxValue;
      
      // Update all labels
      newBreaks.forEach((breakItem, idx) => {
        breakItem.label = getDisplayLabel(breakItem, idx);
      });
      
      // Re-check for custom opacities after removal
      setHasCustomOpacities(detectCustomOpacities(newBreaks));
      
      setLocalBreaks(newBreaks);
      onBreaksChange(newBreaks);
    }
  };

  // Function to apply uniform transparency to all breaks
  const applyUniformTransparency = () => {
    const alpha = transparency / 100;
    const updatedBreaks = [...localBreaks];
    updatedBreaks.forEach(breakItem => {
      if (Array.isArray(breakItem.symbol.color)) {
        breakItem.symbol.color[3] = alpha;
      } else {
        breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
      }
    });
    setHasCustomOpacities(false);
    setLocalBreaks(updatedBreaks);
    onBreaksChange(updatedBreaks);
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
            value={localBreaks[localBreaks.length - 1]?.maxValue}
            onChange={(value) => updateBreak(localBreaks.length - 1, 'maxValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
            placeholder="Enter maximum value"
          />
        </div>
      </div>

      {/* Opacity Slider with Custom Opacity Warning */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Global Opacity
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {transparency}%
          </span>
        </div>
        
        {hasCustomOpacities && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
            <div className="flex items-start space-x-2">
              <div className="text-yellow-600 dark:text-yellow-400 text-sm">
                <strong>Custom Opacities Detected:</strong> Your breaks have individual transparency values. 
                The global slider shows the average but won't override individual settings.
              </div>
            </div>
            <button 
              onClick={applyUniformTransparency}
              className="mt-2 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Apply {transparency}% to All Breaks
            </button>
          </div>
        )}
        
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

        <div className="space-y-3">
          {localBreaks.map((breakItem, index) => (
            <div key={index} className="space-y-2">
              {/* Main break row */}
              <div className="group flex items-center space-x-2 py-1">
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
                    disabled={false} // Enable max input for all breaks including last one
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

              {/* Individual transparency slider for each color */}
              <div className="pl-10 pr-4">
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-20">
                    Transparency:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={getBreakTransparency(breakItem)}
                    onChange={(e) => updateBreak(index, 'individualTransparency', e.target.value)}
                    className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        ${Array.isArray(breakItem.symbol.color) 
                          ? `rgba(${breakItem.symbol.color[0]}, ${breakItem.symbol.color[1]}, ${breakItem.symbol.color[2]}, 0)`
                          : 'transparent'
                        } 0%, 
                        ${Array.isArray(breakItem.symbol.color)
                          ? `rgb(${breakItem.symbol.color[0]}, ${breakItem.symbol.color[1]}, ${breakItem.symbol.color[2]})`
                          : rgbaToHex(breakItem.symbol.color)
                        } 100%)`
                    }}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                    {getBreakTransparency(breakItem)}%
                  </span>
                </div>
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