import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react'; // Import RotateCcw for the reset icon
import NumberRangeInput from './NumberRangeInput';
import { initialLayerConfigurations } from './mapConfig'; // Import the true default configurations

const ColorBreakEditor = ({ breaks = [], onBreaksChange, visualizationType = 'income' }) => {
  const [transparency, setTransparency] = useState(40);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(0);
  
  // Enhanced initial state setup with comprehensive data format handling
  const initializeBreaksState = (breaksData) => {
    if (!breaksData) return [];
    
    let breaksArray = [];
    
    if (Array.isArray(breaksData)) {
      // breaksData is already an array of break objects
      breaksArray = breaksData;
    } else if (breaksData.classBreakInfos && Array.isArray(breaksData.classBreakInfos)) {
      // breaksData is a config object containing classBreakInfos array
      breaksArray = breaksData.classBreakInfos;
    } else if (typeof breaksData === 'object' && breaksData.length === undefined) {
      // breaksData is a single break object, wrap in array
      breaksArray = [breaksData];
    } else {
      console.warn('[ColorBreakEditor] Invalid breaks format, defaulting to empty array:', breaksData);
      breaksArray = [];
    }
    
    return breaksArray;
  };

  const [localBreaks, setLocalBreaks] = useState(() => initializeBreaksState(breaks));
  const [hasCustomOpacities, setHasCustomOpacities] = useState(false);
  const [userOverrideCustom, setUserOverrideCustom] = useState(false);
  const [hasCustomLabels, setHasCustomLabels] = useState(false);
  const [originalLabels, setOriginalLabels] = useState({});
  const [customLabelSuffix, setCustomLabelSuffix] = useState('');
  
  // Enhanced number format initialization - check for existing config value first
  const getInitialNumberFormat = () => {
    // First check if numberFormat exists in the breaks configuration object
    if (breaks && typeof breaks === 'object' && breaks.numberFormat !== undefined) {
      const configNumberFormat = breaks.numberFormat;
      if (['number', 'decimal', 'currency', 'percentage'].includes(configNumberFormat)) {
        console.log('[ColorBreakEditor] Loading number format from breaks config:', configNumberFormat);
        return configNumberFormat;
      }
    }
    
    // Check if breaks is an array with a parent config object
    if (Array.isArray(breaks) && breaks.length > 0 && breaks.numberFormat !== undefined) {
      const configNumberFormat = breaks.numberFormat;
      if (['number', 'decimal', 'currency', 'percentage'].includes(configNumberFormat)) {
        console.log('[ColorBreakEditor] Loading number format from breaks array config:', configNumberFormat);
        return configNumberFormat;
      }
    }
    
    // Check if passed in window context (common pattern for layer configs)
    if (typeof window !== 'undefined' && window.currentLayerConfig && window.currentLayerConfig.numberFormat !== undefined) {
      const contextNumberFormat = window.currentLayerConfig.numberFormat;
      if (['number', 'decimal', 'currency', 'percentage'].includes(contextNumberFormat)) {
        console.log('[ColorBreakEditor] Loading number format from window context:', contextNumberFormat);
        return contextNumberFormat;
      }
    }
    
    // Legacy support: check for decimalPlaces and convert to numberFormat
    let legacyDecimalPlaces = null;
    if (breaks && typeof breaks === 'object' && breaks.decimalPlaces !== undefined) {
      legacyDecimalPlaces = breaks.decimalPlaces;
    } else if (Array.isArray(breaks) && breaks.length > 0 && breaks.decimalPlaces !== undefined) {
      legacyDecimalPlaces = breaks.decimalPlaces;
    } else if (typeof window !== 'undefined' && window.currentLayerConfig?.decimalPlaces !== undefined) {
      legacyDecimalPlaces = window.currentLayerConfig.decimalPlaces;
    }
    
    if (legacyDecimalPlaces !== null && Number.isInteger(legacyDecimalPlaces)) {
      const convertedFormat = legacyDecimalPlaces === 0 ? 'number' : 'decimal';
      console.log('[ColorBreakEditor] Converting legacy decimalPlaces to numberFormat:', legacyDecimalPlaces, '→', convertedFormat);
      return convertedFormat;
    }
    
    // Fallback to visualization type logic
    const fallbackValue = visualizationType === 'income' ? 'currency' : 'number';
    console.log('[ColorBreakEditor] Using fallback number format for visualization type:', visualizationType, '→', fallbackValue);
    return fallbackValue;
  };
  
  const [numberFormat, setNumberFormat] = useState(getInitialNumberFormat());
  
  // Track the dropdown value separately to ensure proper synchronization
  const [dropdownNumberFormat, setDropdownNumberFormat] = useState(numberFormat);
  
  // Refs for debouncing with extended delays
  const transparencyTimeoutRef = useRef(null);
  const breakTimeoutRefs = useRef({});
  
  // Track user interaction with number format to prevent auto-override
  const userHasChangedNumberFormat = useRef(false);

  // Extended debounce delays (4.5 seconds for most operations)
  const EXTENDED_DEBOUNCE_DELAY = 1000; // 4.5 seconds
  const QUICK_DEBOUNCE_DELAY = 1000; // 2 seconds for less critical operations
  const VALUE_DEBOUNCE_DELAY = 1000; // 5 seconds for min/max value change
  
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

  // Enhanced extract common suffix from existing labels - SIMPLIFIED VERSION
  const extractCommonSuffix = (breaksArray) => {
    if (!breaksArray || breaksArray.length === 0) return '';
    
    const labels = breaksArray.map(b => b.label).filter(Boolean);
    if (labels.length === 0) return '';
    
    console.log('[extractCommonSuffix] Analyzing labels:', labels);
    
    // Extract suffix after the last number in each label
    const suffixes = labels.map(label => {
      // Find all numbers in the label (including decimals and commas)
      const numbers = label.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (numbers && numbers.length > 0) {
        // Get the last number found
        const lastNumber = numbers[numbers.length - 1];
        // Find the last occurrence of this number in the label
        const lastNumberIndex = label.lastIndexOf(lastNumber);
        // Extract everything after the last number and trim whitespace
        const suffix = label.substring(lastNumberIndex + lastNumber.length).trim();
        return suffix;
      }
      return '';
    });
    
    console.log('[extractCommonSuffix] Found suffixes after last numbers:', suffixes);
    
    // Check if all suffixes are the same and not empty
    const firstSuffix = suffixes[0];
    if (firstSuffix && suffixes.every(suffix => suffix === firstSuffix)) {
      console.log(`[extractCommonSuffix] ✅ Found common suffix: "${firstSuffix}"`);
      return firstSuffix;
    }
    
    console.log(`[extractCommonSuffix] No common suffix found`);
    return '';
  };

  // Enhanced detect custom labels function with better pattern detection
  const detectCustomLabels = (breaksArray) => {
    if (!breaksArray || breaksArray.length === 0) return false;
    
    // Store original labels for preservation
    const labelMap = {};
    
    const hasCustom = breaksArray.some((breakItem, index) => {
      if (!breakItem.label) return false;
      
      // Store original label
      labelMap[index] = breakItem.label;
      
      // Check if label contains descriptive text beyond just numbers
      const label = breakItem.label.toLowerCase();
      
      // Auto-generated patterns WITHOUT suffixes (pure numeric)
      const autoGeneratedPatterns = [
        /^less than -?\d+(?:,\d{3})*(?:\.\d+)?$/,                 // "Less than 30.0" (pure numeric)
        /^-?\d+(?:,\d{3})*(?:\.\d+)?\s*-\s*-?\d+(?:,\d{3})*(?:\.\d+)?$/,       // "30.0-35.0" (pure numeric)
        /^-?\d+(?:,\d{3})*(?:\.\d+)?\s*to\s*-?\d+(?:,\d{3})*(?:\.\d+)?$/,      // "30.0 to 35.0" (pure numeric)
        /^-?\d+(?:,\d{3})*(?:\.\d+)?\s*or more$/,                 // "65.0 or more" (pure numeric)
      ];
      
      // If it matches pure auto-generated patterns, it's not custom
      if (autoGeneratedPatterns.some(pattern => pattern.test(label))) {
        return false;
      }
      
      // Check for descriptive words or suffixes that indicate custom labels
      // Enhanced list including "test" and other common test/demo words
      const descriptiveWords = [
        'years', 'year', 'months', 'month', 'days', 'day',
        'dollars', 'dollar', 'income', 'salary', 'wage',
        'units', 'households', 'residents', 'population',
        'percent', '%', 'rate', 'ratio', 'index', 'points',
        'score', 'value', 'count', 'total', 'average',
        'median', 'maximum', 'minimum', 'range', 'level',
        'grade', 'class', 'category', 'group', 'tier',
        'euros', 'pounds', 'yen', 'currency', 'price',
        'cost', 'revenue', 'profit', 'loss', 'budget',
        'expense', 'fee', 'tax', 'interest', 'dividend',
        // Added common test/demo suffixes
        'test', 'demo', 'sample', 'example', 'temp',
        'trial', 'beta', 'alpha', 'dev', 'staging'
      ];
      
      return descriptiveWords.some(word => label.includes(word));
    });
    
    setOriginalLabels(labelMap);
    console.log('[detectCustomLabels] Custom labels detected:', hasCustom, '| Label map:', labelMap);
    return hasCustom;
  };

  const detectCustomOpacities = (breaksArray) => {
    if (!breaksArray || breaksArray.length === 0) return false;
    
    // If user has explicitly overridden custom settings, don't detect as custom
    if (userOverrideCustom) return false;
    
    // Check if breaks are explicitly marked as having custom opacities (from heat maps)
    const hasExplicitMarkers = breaksArray.some(breakItem => 
      breakItem.preserveOpacity === true || 
      breakItem.hasCustomOpacities === true || 
      (breakItem.originalOpacity !== undefined && breakItem.originalOpacity !== breakItem.symbol?.color?.[3])
    );
  
    if (hasExplicitMarkers) {
      return true;
    }
    
    // Get opacity values and check for intentional variation
    const opacityValues = breaksArray.map(breakItem => {
      if (Array.isArray(breakItem.symbol?.color) && breakItem.symbol.color[3] !== undefined) {
        // Convert opacity to transparency percentage for consistency
        return Math.round((1 - breakItem.symbol.color[3]) * 100);
      }
      return 35; // Default value
    });
    
    // Only consider it custom if there's significant variation AND it looks intentional
    const uniqueOpacities = [...new Set(opacityValues)];
    const hasVariation = uniqueOpacities.length > 1;
    
    if (!hasVariation) return false;
    
    // Check if the variation looks intentional (not just rounding differences)
    const hasSignificantVariation = opacityValues.some(opacity => {
      const firstOpacity = opacityValues[0];
      return Math.abs(opacity - firstOpacity) > 5; // Increased threshold to 5%
    });
    
    // Additional check: if the pattern matches common heat map values, consider it custom
    const commonHeatMapValues = [15, 20, 25, 30, 35, 40, 45, 50];
    const hasHeatMapPattern = uniqueOpacities.every(opacity => 
      commonHeatMapValues.includes(opacity)
    ) && uniqueOpacities.length >= 3;
    
    return hasSignificantVariation || hasHeatMapPattern;
  };

  useEffect(() => {
      console.log('[ColorBreakEditor] Initializing with breaks data:', {
        breaks: breaks,
        breaksType: typeof breaks,
        isArray: Array.isArray(breaks),
        hasClassBreakInfos: breaks?.classBreakInfos,
        timestamp: Date.now()
      });

      // Enhanced data format handling with better validation
      let breaksArray = [];
      let configObject = null;
      
      if (breaks) {
        if (Array.isArray(breaks)) {
          // breaks is already an array
          breaksArray = breaks;
          configObject = breaks; // May have additional properties
        } else if (breaks.classBreakInfos && Array.isArray(breaks.classBreakInfos)) {
          // breaks is a config object with classBreakInfos array
          breaksArray = breaks.classBreakInfos;
          configObject = breaks;
        } else if (typeof breaks === 'object' && breaks.length === undefined) {
          // breaks is a single object, wrap in array
          breaksArray = [breaks];
          configObject = { classBreakInfos: [breaks] };
        } else {
          console.warn('[ColorBreakEditor] Invalid breaks format, using empty array:', breaks);
          breaksArray = [];
          configObject = { classBreakInfos: [] };
        }
      }

      // Early validation to prevent 50/50 loading issues
      if (!breaksArray || breaksArray.length === 0) {
        console.warn('[ColorBreakEditor] No breaks data available, initializing empty state');
        setLocalBreaks([]);
        setMinRange(0);
        setMaxRange(100);
        setTransparency(40);
        setHasCustomOpacities(false);
        setHasCustomLabels(false);
        setCustomLabelSuffix('');
        return;
      }

      console.log('[ColorBreakEditor] Processing breaks array:', {
        length: breaksArray.length,
        firstBreak: breaksArray[0],
        lastBreak: breaksArray[breaksArray.length - 1]
      });

      try {
        // Enhanced break normalization with comprehensive error handling
        const normalizedBreaks = breaksArray.map((breakItem, index) => {
          // Validate break item structure
          if (!breakItem || typeof breakItem !== 'object') {
            console.error(`[ColorBreakEditor] Invalid break item at index ${index}:`, breakItem);
            return null;
          }

          // --- FIX STARTS HERE ---
          // 1. Create the normalized object WITHOUT the aggressive `?? 100` fallback for maxValue.
          const normalizedBreak = {
            minValue: breakItem.minValue ?? 0,
            maxValue: breakItem.maxValue, // Let it be null/undefined for now
            label: breakItem.label || '',
            symbol: breakItem.symbol || {
              type: "simple-fill",
              color: [128, 128, 128, 0.65],
              outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
            }
          };

          // 2. Expand the check to handle Infinity, null, or undefined maxValues.
          // This is crucial for open-ended final breaks.
          if (normalizedBreak.maxValue === Infinity || normalizedBreak.maxValue === null || normalizedBreak.maxValue === undefined) {
            // Calculate a sensible maximum value instead of using a hardcoded default.
            const minVal = Number(normalizedBreak.minValue) || 0;
            let calculatedMax = minVal + 1000; // A base fallback

            // A much better approach: use the range of the previous break to estimate the range of the last one.
            if (index > 0) {
              const prevBreak = breaksArray[index - 1];
              if (prevBreak && typeof prevBreak.maxValue === 'number' && typeof prevBreak.minValue === 'number') {
                const prevRange = Math.abs(prevBreak.maxValue - prevBreak.minValue);
                // Ensure the range is a positive number greater than 0
                calculatedMax = minVal + (prevRange > 0 ? prevRange : 1000); 
              }
            }
            normalizedBreak.maxValue = calculatedMax;
            console.log(`[ColorBreakEditor] Calculated unbounded maxValue to ${normalizedBreak.maxValue} for break ${index}`);
          }
          // --- FIX ENDS HERE ---

          // Preserve any custom opacity metadata from heat maps (but allow user override)
          if (!userOverrideCustom && breakItem.originalOpacity !== undefined && Array.isArray(breakItem.symbol.color)) {
            normalizedBreak.symbol.color[3] = breakItem.originalOpacity;
            normalizedBreak.preserveOpacity = true;
          }
          
          // Preserve custom opacity flags only if user hasn't overridden
          if (!userOverrideCustom) {
            if (breakItem.preserveOpacity) {
              normalizedBreak.preserveOpacity = true;
            }
            if (breakItem.hasCustomOpacities) {
              normalizedBreak.hasCustomOpacities = true;
            }
          }

          return normalizedBreak;
        }).filter(Boolean); // Remove any null entries from validation failures

        // Additional validation after normalization
        if (normalizedBreaks.length === 0) {
          console.error('[ColorBreakEditor] All breaks failed validation, initializing empty state');
          setLocalBreaks([]);
          return;
        }

        console.log('[ColorBreakEditor] Breaks normalized successfully:', {
          originalLength: breaksArray.length,
          normalizedLength: normalizedBreaks.length,
          breaks: normalizedBreaks.map(b => ({ min: b.minValue, max: b.maxValue, label: b.label }))
        });

        // Set local breaks immediately to prevent rendering delays
        setLocalBreaks(normalizedBreaks);
        
        // Enhanced min/max range calculation with better error handling
        try {
          const firstBreak = normalizedBreaks[0];
          const lastBreak = normalizedBreaks[normalizedBreaks.length - 1];
          
          // Corrected the logic to check for the properties that are actually being used.
          if (firstBreak?.maxValue !== undefined && lastBreak?.maxValue !== undefined) {
              const minRangeValue = firstBreak.maxValue;
              const maxRangeValue = lastBreak.maxValue; // This will now be the correctly calculated value
              
              setMinRange(minRangeValue);
              setMaxRange(maxRangeValue);
              
              console.log('[ColorBreakEditor] Range values set:', {
                minRange: minRangeValue,
                maxRange: maxRangeValue
              });
          }
        } catch (rangeError) {
          console.error('[ColorBreakEditor] Error setting range values:', rangeError);
          setMinRange(0);
          setMaxRange(100);
        }

        // Enhanced custom opacity detection with timing safeguards
        setTimeout(() => {
          try {
            const hasCustom = detectCustomOpacities(normalizedBreaks);
            setHasCustomOpacities(hasCustom);
          } catch (opacityError) {
            console.error('[ColorBreakEditor] Error detecting custom opacities:', opacityError);
            setHasCustomOpacities(false);
          }
        }, 50);

        // Enhanced custom labels detection with timing safeguards
        setTimeout(() => {
          try {
            const hasCustomLabelsDetected = detectCustomLabels(normalizedBreaks);
            setHasCustomLabels(hasCustomLabelsDetected);
          } catch (labelsError) {
            console.error('[ColorBreakEditor] Error detecting custom labels:', labelsError);
            setHasCustomLabels(false);
          }
        }, 75);

        // Enhanced suffix extraction with error handling and timing
        setTimeout(() => {
          try {
            const extractedSuffix = extractCommonSuffix(normalizedBreaks);
            if (extractedSuffix) {
              setCustomLabelSuffix(extractedSuffix);
            } else if (!customLabelSuffix) {
              setCustomLabelSuffix('');
            }
          } catch (suffixError) {
            console.error('[ColorBreakEditor] Error extracting suffix:', suffixError);
            setCustomLabelSuffix('');
          }
        }, 100);

        // Enhanced transparency sync with better error handling
        try {
          const firstBreakColor = normalizedBreaks[0]?.symbol?.color;
          if (Array.isArray(firstBreakColor) && firstBreakColor[3] !== undefined) {
            const currentTransparency = Math.round((1 - firstBreakColor[3]) * 100);
            setTransparency(currentTransparency);
          } else {
            setTransparency(40);
          }
        } catch (transparencyError) {
          console.error('[ColorBreakEditor] Error syncing transparency:', transparencyError);
          setTransparency(40);
        }

        // Enhanced number format initialization with improved config detection
        if (!userHasChangedNumberFormat.current) {
          try {
            let configNumberFormat = null;
            if (configObject?.numberFormat !== undefined) configNumberFormat = configObject.numberFormat;
            else if (breaks?.numberFormat !== undefined) configNumberFormat = breaks.numberFormat;
            else if (window.currentLayerConfig?.numberFormat !== undefined) configNumberFormat = window.currentLayerConfig.numberFormat;
            if (configNumberFormat !== null) {
              const validNumberFormat = ['number', 'decimal', 'currency', 'percentage'].includes(configNumberFormat) ? configNumberFormat : getInitialNumberFormat();
              if (validNumberFormat !== numberFormat) {
                setNumberFormat(validNumberFormat);
                setDropdownNumberFormat(validNumberFormat);
              }
            }
          } catch (formatError) {
            console.error('[ColorBreakEditor] Error setting number format from config:', formatError);
          }
        }
      } catch (initError) {
        console.error('[ColorBreakEditor] Critical error during initialization:', initError);
        setLocalBreaks([]);
        setMinRange(0);
        setMaxRange(100);
        setTransparency(40);
        setHasCustomOpacities(false);
        setHasCustomLabels(false);
        setCustomLabelSuffix('');
      }
  }, [breaks, userOverrideCustom]);

  const prevVisualizationTypeRef = useRef(visualizationType);
  useEffect(() => {
    if (prevVisualizationTypeRef.current !== visualizationType && !userHasChangedNumberFormat.current) {
      const newNumberFormat = visualizationType === 'income' ? 'currency' : 'number';
      if (numberFormat !== newNumberFormat) {
        setNumberFormat(newNumberFormat);
        setDropdownNumberFormat(newNumberFormat);
      }
      prevVisualizationTypeRef.current = visualizationType;
    }
  }, [visualizationType, numberFormat]);

  useEffect(() => {
    if (dropdownNumberFormat !== numberFormat) {
      setDropdownNumberFormat(numberFormat);
    }
  }, [numberFormat, dropdownNumberFormat]);

  const handleFocus = (event) => event.target.select();

  const handleResetBreaks = () => {
    if (window.confirm('Are you sure you want to reset all changes to their original defaults? This cannot be undone.')) {
      console.log(`[ColorBreakEditor] Resetting to defaults for visualizationType: ${visualizationType}`);
      
      const defaultConfig = initialLayerConfigurations[visualizationType];
      
      if (!defaultConfig) {
        console.error(`[ColorBreakEditor] Could not find default configuration for "${visualizationType}".`);
        alert('Could not find default configuration to reset to.');
        return;
      }
      
      console.log('[ColorBreakEditor] Found default config. Calling onBreaksChange.', defaultConfig);
      onBreaksChange(defaultConfig);
    }
  };

  if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
    return (
      <div className="p-4 text-gray-600 dark:text-gray-400">
        <div className="space-y-2">
          <p>No break points configured. Please check visualization settings.</p>
          {localBreaks && !Array.isArray(localBreaks) && (
            <div className="text-xs text-red-500 dark:text-red-400">
              Warning: Break data is not in array format. Type: {typeof localBreaks}
            </div>
          )}
        </div>
      </div>
    );
  }

  const formatValue = (value) => {
    if (value === undefined || value === null || typeof value !== 'number') return value || '';
    switch (numberFormat) {
      case 'number': return Math.round(value).toLocaleString();
      case 'decimal': return value.toFixed(1);
      case 'currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value));
      case 'percentage': return `${value.toFixed(1)}%`;
      default: return Math.round(value).toLocaleString();
    }
  };

  const getDisplayLabel = (breakItem, index) => {
    if (!breakItem) return '';
    const cleanNumber = (value) => (value === undefined || value === null) ? '' : formatValue(value);
    const isFirst = index === 0;
    const isLast = index === localBreaks.length - 1;
    let baseLabel = '';
    if (isFirst) baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
    else if (isLast) baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
    else baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
    if (customLabelSuffix.trim()) baseLabel += ` ${customLabelSuffix.trim()}`;
    return baseLabel;
  };

  const parseInputValue = (value) => {
    if (value === '' || value === '-') return value;
    const cleanValue = String(value).replace(/[$,\s]/g, '').trim();
    if (!/^-?\d*\.?\d*$/.test(cleanValue) || cleanValue === '.') return null;
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? null : numValue;
  };

  const handleBreaksChangeWithNumberFormat = (updatedBreaks, customNumberFormat = null) => {
    let breaksArray = [];
    if (Array.isArray(updatedBreaks)) breaksArray = updatedBreaks;
    else if (updatedBreaks?.classBreakInfos) breaksArray = updatedBreaks.classBreakInfos;
    else if (typeof updatedBreaks === 'object') breaksArray = [updatedBreaks];
    else { console.error('[ColorBreakEditor] Invalid breaks format:', updatedBreaks); return; }
    const currentNumberFormat = customNumberFormat ?? numberFormat;
    onBreaksChange({ classBreakInfos: breaksArray, numberFormat: currentNumberFormat, type: 'class-breaks' });
  };

  const updateBreak = (index, field, value, immediate = false) => {
    const newLocalBreaks = [...localBreaks];
    const break_item = newLocalBreaks[index];

    if (field === 'color') {
      const existingAlpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.65;
      break_item.symbol.color = hexToRgba(value, existingAlpha);
      setLocalBreaks(newLocalBreaks);
      handleBreaksChangeWithNumberFormat(newLocalBreaks);
      return;
    }

    if (field === 'individualTransparency') {
      const timeoutKey = `${index}-transparency`;
      if (breakTimeoutRefs.current[timeoutKey]) clearTimeout(breakTimeoutRefs.current[timeoutKey]);
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) return;
      const alpha = (100 - numValue) / 100;
      if (Array.isArray(break_item.symbol.color)) break_item.symbol.color[3] = alpha;
      else break_item.symbol.color = hexToRgba(break_item.symbol.color, alpha);
      setLocalBreaks(newLocalBreaks);
      const allOpacities = newLocalBreaks.map(b => Math.round(((1 - (b.symbol?.color?.[3] || 0.35)) * 100)));
      setHasCustomOpacities(!allOpacities.every(o => o === allOpacities[0]));
      breakTimeoutRefs.current[timeoutKey] = setTimeout(() => handleBreaksChangeWithNumberFormat([...newLocalBreaks]), immediate ? 0 : EXTENDED_DEBOUNCE_DELAY);
      return;
    }

    if (field === 'transparency') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) return;
      setTransparency(numValue);
      if (transparencyTimeoutRef.current) clearTimeout(transparencyTimeoutRef.current);
      transparencyTimeoutRef.current = setTimeout(() => {
        const alpha = (100 - numValue) / 100;
        const updatedBreaks = localBreaks.map(breakItem => {
          const newBreak = { ...breakItem };
          if (Array.isArray(newBreak.symbol.color)) newBreak.symbol.color[3] = alpha;
          else newBreak.symbol.color = hexToRgba(newBreak.symbol.color, alpha);
          delete newBreak.preserveOpacity;
          return newBreak;
        });
        setUserOverrideCustom(true);
        setHasCustomOpacities(false);
        handleBreaksChangeWithNumberFormat(updatedBreaks);
      }, immediate ? 0 : EXTENDED_DEBOUNCE_DELAY);
      return;
    }

    if (field === 'maxValue' || field === 'minValue') {
      break_item[field] = value;
      setLocalBreaks(newLocalBreaks);
      const timeoutKey = `${index}-${field}`;
      if (breakTimeoutRefs.current[timeoutKey]) clearTimeout(breakTimeoutRefs.current[timeoutKey]);
      breakTimeoutRefs.current[timeoutKey] = setTimeout(() => {
        const adjustedBreaks = [...localBreaks];
        const targetBreak = adjustedBreaks[index];
        const parsedVal = parseInputValue(targetBreak[field]);
        if (parsedVal === null || isNaN(parsedVal)) return;
        targetBreak[field] = parsedVal;
        if (field === 'maxValue' && index < adjustedBreaks.length - 1) adjustedBreaks[index + 1].minValue = parsedVal;
        if (field === 'minValue' && index > 0) adjustedBreaks[index - 1].maxValue = parsedVal;
        adjustedBreaks.forEach((b, i) => { b.label = getDisplayLabel(b, i); });
        handleBreaksChangeWithNumberFormat(adjustedBreaks);
      }, immediate ? 0 : VALUE_DEBOUNCE_DELAY);
      return;
    }
  };

  const rgbaToHex = (rgba) => {
    if (Array.isArray(rgba)) return `#${rgba[0].toString(16).padStart(2, '0')}${rgba[1].toString(16).padStart(2, '0')}${rgba[2].toString(16).padStart(2, '0')}`;
    return rgba;
  };

  const hexToRgba = (hex, alpha = null) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const finalAlpha = alpha !== null ? alpha : 0.65;
    return [r, g, b, finalAlpha];
  };

  const getBreakTransparency = (breakItem) => {
    if (Array.isArray(breakItem?.symbol?.color) && breakItem.symbol.color[3] !== undefined) {
      return Math.round((1 - breakItem.symbol.color[3]) * 100);
    }
    return 35;
  };

  const addBreak = () => {
    if (!localBreaks || localBreaks.length === 0) return;
    const lastBreak = localBreaks[localBreaks.length - 1];
    if (!lastBreak) return;
    const lastMaxValue = lastBreak.maxValue;
    const range = lastMaxValue - lastBreak.minValue;
    const newMaxValue = lastBreak.minValue + (range * 0.7);
    lastBreak.maxValue = newMaxValue;
    if (hasCustomLabels && originalLabels[localBreaks.length - 1]) lastBreak.label = originalLabels[localBreaks.length - 1];
    else lastBreak.label = getDisplayLabel(lastBreak, localBreaks.length - 1);
    const lastBreakOpacity = Array.isArray(lastBreak.symbol?.color) ? lastBreak.symbol.color[3] : 0.65;
    const newBreak = {
      minValue: newMaxValue,
      maxValue: lastMaxValue,
      symbol: {
        type: "simple-fill",
        color: Array.isArray(lastBreak.symbol?.color) ? [...lastBreak.symbol.color.slice(0, 3), lastBreakOpacity] : hexToRgba(lastBreak.symbol?.color || "#ffffff", lastBreakOpacity),
        outline: { color: [50, 50, 50, 0.2], width: lastBreak.symbol?.outline?.width || "0.5px" }
      }
    };
    const newBreaks = [...localBreaks, newBreak];
    newBreaks.forEach((breakItem, idx) => {
      if (hasCustomLabels && originalLabels[idx]) breakItem.label = originalLabels[idx];
      else breakItem.label = getDisplayLabel(breakItem, idx);
    });
    setLocalBreaks(newBreaks);
    handleBreaksChangeWithNumberFormat(newBreaks);
  };

  const removeBreak = (index) => {
    if (!localBreaks || localBreaks.length <= 2 || index < 0 || index >= localBreaks.length) return;
    const newBreaks = [...localBreaks];
    const lastMaxValue = newBreaks[newBreaks.length - 1].maxValue;
    newBreaks.splice(index, 1);
    for (let i = index; i < newBreaks.length - 1; i++) newBreaks[i + 1].minValue = newBreaks[i].maxValue;
    if (newBreaks.length > 0) newBreaks[newBreaks.length - 1].maxValue = lastMaxValue;
    const updatedOriginalLabels = {};
    Object.keys(originalLabels).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) updatedOriginalLabels[keyIndex] = originalLabels[key];
      else if (keyIndex > index) updatedOriginalLabels[keyIndex - 1] = originalLabels[key];
    });
    setOriginalLabels(updatedOriginalLabels);
    newBreaks.forEach((breakItem, idx) => {
      if (hasCustomLabels && updatedOriginalLabels[idx]) breakItem.label = updatedOriginalLabels[idx];
      else breakItem.label = getDisplayLabel(breakItem, idx);
    });
    setHasCustomOpacities(detectCustomOpacities(newBreaks));
    setLocalBreaks(newBreaks);
    handleBreaksChangeWithNumberFormat(newBreaks);
  };

  const handleNumberFormatChange = (newNumberFormat) => {
    const validNumberFormat = ['number', 'decimal', 'currency', 'percentage'].includes(newNumberFormat) ? newNumberFormat : 'number';
    userHasChangedNumberFormat.current = true;
    setNumberFormat(validNumberFormat);
    setDropdownNumberFormat(validNumberFormat);
    if (localBreaks && localBreaks.length > 0) {
      const updatedBreaks = [...localBreaks];
      updatedBreaks.forEach((breakItem, idx) => {
        const cleanNumber = (value) => {
          if (value === undefined || value === null) return '';
          switch (validNumberFormat) {
            case 'number': return Math.round(value).toLocaleString();
            case 'decimal': return value.toFixed(1);
            case 'currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value));
            case 'percentage': return `${value.toFixed(1)}%`;
            default: return Math.round(value).toLocaleString();
          }
        };
        const isFirst = idx === 0;
        const isLast = idx === localBreaks.length - 1;
        let baseLabel = '';
        if (isFirst) baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
        else if (isLast) baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
        else baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
        if (customLabelSuffix.trim()) baseLabel += ` ${customLabelSuffix.trim()}`;
        breakItem.label = baseLabel;
      });
      setLocalBreaks(updatedBreaks);
      handleBreaksChangeWithNumberFormat(updatedBreaks, validNumberFormat);
    }
  };

  const getFormatPreview = (format) => {
    const sampleValue = -12345.6789;
    switch (format) {
      case 'number': return Math.round(sampleValue).toLocaleString();
      case 'decimal': return sampleValue.toFixed(1);
      case 'currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(sampleValue));
      case 'percentage': return `${sampleValue.toFixed(1)}%`;
      default: return Math.round(sampleValue).toLocaleString();
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
            key={`min-range-${numberFormat}`}
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
            key={`max-range-${numberFormat}`}
            value={localBreaks[localBreaks.length - 1]?.maxValue}
            onChange={(value) => updateBreak(localBreaks.length - 1, 'maxValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
            placeholder="Enter maximum value"
          />
        </div>
      </div>

      {/* Number Format Control Section - Enhanced with robust dropdown synchronization */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Number Format
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            For value formatting in legend
          </span>
        </div>
        <select
          key={`number-format-${dropdownNumberFormat}`} // Force re-render when dropdown state changes
          value={dropdownNumberFormat} // Use dropdown state for better synchronization
          onChange={(e) => {
            const newValue = e.target.value;
            setDropdownNumberFormat(newValue); // Update dropdown state immediately
            handleNumberFormatChange(newValue);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="number">1,000 - Whole numbers with commas</option>
          <option value="decimal">1.0 - Small numbers with 1 decimal</option>
          <option value="currency">$1,000 - Dollar amounts</option>
          <option value="percentage">1.0% - Percentage format</option>
        </select>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Preview: {getFormatPreview(numberFormat)}</span>
          <span>
            Current: {numberFormat} format
            {dropdownNumberFormat !== numberFormat && (
              <span className="text-orange-500"> (Dropdown: {dropdownNumberFormat})</span>
            )}
          </span>
        </div>
      </div>

      {/* Custom Label Suffix Section */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Custom Label Suffix
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Optional (e.g., "years", "dollars")
          </span>
        </div>
        <input
          type="text"
          value={customLabelSuffix}
          onChange={(e) => setCustomLabelSuffix(e.target.value)}
          placeholder="Enter suffix like 'years', 'dollars', '%', etc."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {customLabelSuffix && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Preview: "Less than {formatValue(30)} {customLabelSuffix.trim()}", "{formatValue(30)} - {formatValue(35)} {customLabelSuffix.trim()}", etc.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                    const updatedBreaks = [...localBreaks];
                    updatedBreaks.forEach((breakItem, idx) => {
                      if (!breakItem) return;
                      breakItem.label = getDisplayLabel(breakItem, idx);
                    });
                    setLocalBreaks(updatedBreaks);
                    handleBreaksChangeWithNumberFormat(updatedBreaks);
                  }}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply Suffix to All Labels
              </button>
              <button
                onClick={() => {
                  setCustomLabelSuffix('');
                  const updatedBreaks = [...localBreaks];
                  updatedBreaks.forEach((breakItem, idx) => {
                    const cleanNumber = (value) => (value === undefined || value === null) ? '' : formatValue(value);
                    const isFirst = idx === 0;
                    const isLast = idx === updatedBreaks.length - 1;
                    let baseLabel = '';
                    if (isFirst) baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
                    else if (isLast) baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
                    else baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
                    breakItem.label = baseLabel;
                  });
                  setLocalBreaks(updatedBreaks);
                  handleBreaksChangeWithNumberFormat(updatedBreaks);
                }}
                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Remove Suffix
              </button>
            </div>
          </div>
        )}
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
                    key={`min-${index}-${numberFormat}`}
                    value={index === 0 ? undefined : breakItem.minValue}
                    onChange={(value) => updateBreak(index, 'minValue', value)}
                    disabled={index === 0}
                    placeholder="Min"
                    formatValue={formatValue}
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <NumberRangeInput
                    key={`max-${index}-${numberFormat}`}
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
                    className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-all duration-200 opacity-60 hover:opacity-100"
                    title="Remove break"
                  >
                    <Minus size={16} />
                  </button>
                )}

                <div className="text-xs text-gray-400 min-w-0 flex-shrink">
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
                    title={`Individual transparency for break ${index + 1} - higher values = more transparent (saves after 4.5 seconds)`}
                    style={{
                      background: `linear-gradient(to right, 
                        ${Array.isArray(breakItem.symbol.color)
                          ? `rgb(${breakItem.symbol.color[0]}, ${breakItem.symbol.color[1]}, ${breakItem.symbol.color[2]})`
                          : rgbaToHex(breakItem.symbol.color)
                        } 0%, 
                        ${Array.isArray(breakItem.symbol.color) 
                          ? `rgba(${breakItem.symbol.color[0]}, ${breakItem.symbol.color[1]}, ${breakItem.symbol.color[2]}, 0)`
                          : 'transparent'
                        } 100%)`
                    }}
                  />
                  {/* Updated individual transparency input */}
                  <div className="flex items-center space-x-1 w-20 justify-end">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={getBreakTransparency(breakItem)}
                        onChange={(e) => updateBreak(index, 'individualTransparency', e.target.value)}
                        onFocus={handleFocus}
                        className="number-input-no-spinner w-14 text-right px-1 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        aria-label={`Transparency percentage for break ${index + 1}`}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Action Buttons: Add and Reset */}
          <div className="flex space-x-2 mt-2">
            <button
              onClick={addBreak}
              className="w-full py-1.5 px-4 border border-dashed border-gray-700 
                       rounded text-gray-400 hover:text-blue-400 hover:border-blue-400 
                       transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              <Plus size={16} />
              <span>Add Break</span>
            </button>
            <button
              onClick={handleResetBreaks}
              className="w-full py-1.5 px-4 border border-dashed border-gray-700 
                       rounded text-gray-400 hover:text-yellow-400 hover:border-yellow-400 
                       transition-colors flex items-center justify-center space-x-2 text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:border-gray-700"
              title="Reset all changes to their original default values"
            >
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Debug info showing current timeout values */}
      <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
        💡 Auto-save delays: 5s for values, 4.5s for other changes
      </div>
    </div>
  );
};

export default ColorBreakEditor;