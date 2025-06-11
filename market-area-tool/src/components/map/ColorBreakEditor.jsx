import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import NumberRangeInput from './NumberRangeInput';

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
  
  // Enhanced decimal places initialization - check for existing config value first
  const getInitialDecimalPlaces = () => {
    // First check if decimalPlaces exists in the breaks configuration object
    if (breaks && typeof breaks === 'object' && breaks.decimalPlaces !== undefined) {
      const configDecimalPlaces = parseInt(breaks.decimalPlaces);
      if (Number.isInteger(configDecimalPlaces) && configDecimalPlaces >= 0 && configDecimalPlaces <= 4) {
        console.log('[ColorBreakEditor] Loading decimal places from breaks config:', configDecimalPlaces);
        return configDecimalPlaces;
      }
    }
    
    // Check if breaks is an array with a parent config object
    if (Array.isArray(breaks) && breaks.length > 0 && breaks.decimalPlaces !== undefined) {
      const configDecimalPlaces = parseInt(breaks.decimalPlaces);
      if (Number.isInteger(configDecimalPlaces) && configDecimalPlaces >= 0 && configDecimalPlaces <= 4) {
        console.log('[ColorBreakEditor] Loading decimal places from breaks array config:', configDecimalPlaces);
        return configDecimalPlaces;
      }
    }
    
    // Check if passed in window context (common pattern for layer configs)
    if (typeof window !== 'undefined' && window.currentLayerConfig && window.currentLayerConfig.decimalPlaces !== undefined) {
      const contextDecimalPlaces = parseInt(window.currentLayerConfig.decimalPlaces);
      if (Number.isInteger(contextDecimalPlaces) && contextDecimalPlaces >= 0 && contextDecimalPlaces <= 4) {
        console.log('[ColorBreakEditor] Loading decimal places from window context:', contextDecimalPlaces);
        return contextDecimalPlaces;
      }
    }
    
    // Fallback to visualization type logic
    const fallbackValue = visualizationType === 'income' ? 0 : 2;
    console.log('[ColorBreakEditor] Using fallback decimal places for visualization type:', visualizationType, '→', fallbackValue);
    return fallbackValue;
  };
  
  const [decimalPlaces, setDecimalPlaces] = useState(getInitialDecimalPlaces());
  
  // Track the dropdown value separately to ensure proper synchronization
  const [dropdownDecimalPlaces, setDropdownDecimalPlaces] = useState(decimalPlaces);
  
  // Refs for debouncing with extended delays
  const transparencyTimeoutRef = useRef(null);
  const breakTimeoutRefs = useRef({});
  
  // Track user interaction with decimal places to prevent auto-override
  const userHasChangedDecimalPlaces = useRef(false);

  // Extended debounce delays (4.5 seconds for most operations)
  const EXTENDED_DEBOUNCE_DELAY = 4500; // 4.5 seconds
  const QUICK_DEBOUNCE_DELAY = 2000; // 2 seconds for less critical operations
  const VALUE_DEBOUNCE_DELAY = 5000; // 5 seconds for min/max value changes

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
      const numbers = label.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
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
        /^less than \d+(?:,\d{3})*(?:\.\d+)?$/,                 // "Less than 30.0" (pure numeric)
        /^\d+(?:,\d{3})*(?:\.\d+)?\s*-\s*\d+(?:,\d{3})*(?:\.\d+)?$/,       // "30.0-35.0" (pure numeric)
        /^\d+(?:,\d{3})*(?:\.\d+)?\s*to\s*\d+(?:,\d{3})*(?:\.\d+)?$/,      // "30.0 to 35.0" (pure numeric)
        /^\d+(?:,\d{3})*(?:\.\d+)?\s*or more$/,                 // "65.0 or more" (pure numeric)
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

    // Enhanced useEffect for initial data loading with improved decimal places detection
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

        // Ensure required properties exist
        const normalizedBreak = {
          minValue: breakItem.minValue ?? 0,
          maxValue: breakItem.maxValue ?? 100,
          label: breakItem.label || '',
          symbol: breakItem.symbol || {
            type: "simple-fill",
            color: [128, 128, 128, 0.65],
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          }
        };

        // Handle Infinity values more robustly
        if (normalizedBreak.maxValue === Infinity) {
          const prevBreak = index > 0 ? breaksArray[index - 1] : null;
          if (prevBreak && typeof prevBreak.maxValue === 'number') {
            normalizedBreak.maxValue = prevBreak.maxValue * 2;
          } else {
            normalizedBreak.maxValue = normalizedBreak.minValue * 2 || 100;
          }
          console.log(`[ColorBreakEditor] Converted Infinity to ${normalizedBreak.maxValue} for break ${index}`);
        }

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
        
        if (firstBreak?.maxValue !== undefined && lastBreak?.minValue !== undefined) {
          const minRangeValue = firstBreak.maxValue;
          const maxRangeValue = lastBreak.maxValue || lastBreak.minValue * 2;
          
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
          console.log('[ColorBreakEditor] Custom opacities detected:', hasCustom);

          if (hasCustom) {
            console.log('[ColorBreakEditor] Custom opacity values:', 
              normalizedBreaks.map((b, i) => {
                const transparency = Array.isArray(b.symbol?.color) ? Math.round((1 - b.symbol.color[3]) * 100) : 35;
                return `${i}: ${transparency}%`;
              }).join(', ')
            );
          }
        } catch (opacityError) {
          console.error('[ColorBreakEditor] Error detecting custom opacities:', opacityError);
          setHasCustomOpacities(false);
        }
      }, 50); // Small delay to ensure state is settled

      // Enhanced custom labels detection with timing safeguards
      setTimeout(() => {
        try {
          const hasCustomLabelsDetected = detectCustomLabels(normalizedBreaks);
          setHasCustomLabels(hasCustomLabelsDetected);
          console.log('[ColorBreakEditor] Custom labels detected:', hasCustomLabelsDetected);

          if (hasCustomLabelsDetected) {
            console.log('[ColorBreakEditor] Custom labels preserved:', 
              normalizedBreaks.map((b, i) => `${i}: "${b.label}"`).join(', ')
            );
          }
        } catch (labelsError) {
          console.error('[ColorBreakEditor] Error detecting custom labels:', labelsError);
          setHasCustomLabels(false);
        }
      }, 75); // Slightly later to avoid race conditions

      // Enhanced suffix extraction with error handling and timing
      setTimeout(() => {
        try {
          const extractedSuffix = extractCommonSuffix(normalizedBreaks);
          if (extractedSuffix) {
            setCustomLabelSuffix(extractedSuffix);
            console.log('[ColorBreakEditor] ✅ Extracted and set suffix from existing labels:', extractedSuffix);
          } else if (!customLabelSuffix) {
            // Only clear if no suffix was previously set by user
            setCustomLabelSuffix('');
            console.log('[ColorBreakEditor] No common suffix found in labels');
          }
        } catch (suffixError) {
          console.error('[ColorBreakEditor] Error extracting suffix:', suffixError);
          setCustomLabelSuffix('');
        }
      }, 100); // Latest timing to ensure all other processing is complete

      // Enhanced transparency sync with better error handling
      try {
        const firstBreakColor = normalizedBreaks[0]?.symbol?.color;
        if (Array.isArray(firstBreakColor) && firstBreakColor[3] !== undefined) {
          const currentTransparency = Math.round((1 - firstBreakColor[3]) * 100);
          setTransparency(currentTransparency);
          console.log('[ColorBreakEditor] Transparency synced:', currentTransparency);
        } else {
          setTransparency(40); // Default value
          console.log('[ColorBreakEditor] Using default transparency: 40%');
        }
      } catch (transparencyError) {
        console.error('[ColorBreakEditor] Error syncing transparency:', transparencyError);
        setTransparency(40);
      }

      // Enhanced decimal places initialization with improved config detection
      if (!userHasChangedDecimalPlaces.current) {
        try {
          let configDecimalPlaces = null;
          
          // Check multiple sources for decimal places configuration
          if (configObject && configObject.decimalPlaces !== undefined) {
            configDecimalPlaces = configObject.decimalPlaces;
          } else if (breaks && typeof breaks === 'object' && breaks.decimalPlaces !== undefined) {
            configDecimalPlaces = breaks.decimalPlaces;
          } else if (typeof window !== 'undefined' && window.currentLayerConfig?.decimalPlaces !== undefined) {
            configDecimalPlaces = window.currentLayerConfig.decimalPlaces;
          }
          
          if (configDecimalPlaces !== null && configDecimalPlaces !== undefined) {
            const validDecimalPlaces = Number.isInteger(configDecimalPlaces) && configDecimalPlaces >= 0 && configDecimalPlaces <= 4 
              ? configDecimalPlaces 
              : getInitialDecimalPlaces();
            
            if (validDecimalPlaces !== decimalPlaces) {
              console.log('[ColorBreakEditor] Updating decimal places from config during breaks load:', decimalPlaces, '→', validDecimalPlaces);
              setDecimalPlaces(validDecimalPlaces);
              setDropdownDecimalPlaces(validDecimalPlaces);
            }
          }
        } catch (decimalError) {
          console.error('[ColorBreakEditor] Error setting decimal places from config:', decimalError);
        }
      }

      console.log('[ColorBreakEditor] ✅ Initialization completed successfully');

    } catch (initError) {
      console.error('[ColorBreakEditor] Critical error during initialization:', initError);
      // Fallback to safe default state
      setLocalBreaks([]);
      setMinRange(0);
      setMaxRange(100);
      setTransparency(40);
      setHasCustomOpacities(false);
      setHasCustomLabels(false);
      setCustomLabelSuffix('');
    }

  }, [breaks, userOverrideCustom]);

  // Update decimal places when visualization type changes (only if user hasn't manually set it)
  const prevVisualizationTypeRef = useRef(visualizationType);
  useEffect(() => {
    // Only auto-set decimal places if visualization type actually changed AND user hasn't manually set it
    if (prevVisualizationTypeRef.current !== visualizationType && !userHasChangedDecimalPlaces.current) {
      const newDecimalPlaces = visualizationType === 'income' ? 0 : 2;
      if (decimalPlaces !== newDecimalPlaces) {
        console.log('[ColorBreakEditor] Auto-setting decimal places for visualization type:', visualizationType, 'to:', newDecimalPlaces);
        setDecimalPlaces(newDecimalPlaces);
        setDropdownDecimalPlaces(newDecimalPlaces); // Sync dropdown state
      }
      prevVisualizationTypeRef.current = visualizationType;
    }
  }, [visualizationType, decimalPlaces]);

  // Sync dropdown state with main decimal places state to handle external changes
  useEffect(() => {
    if (dropdownDecimalPlaces !== decimalPlaces) {
      console.log('[ColorBreakEditor] Syncing dropdown state from', dropdownDecimalPlaces, 'to', decimalPlaces);
      setDropdownDecimalPlaces(decimalPlaces);
    }
  }, [decimalPlaces, dropdownDecimalPlaces]);

  // Enhanced guard with comprehensive type checking and fallback handling
  if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
    console.warn('[ColorBreakEditor] Invalid or empty localBreaks state:', localBreaks);
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
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') {
      if (decimalPlaces === 0) {
        return Math.round(value).toLocaleString();
      } else {
        return value.toFixed(decimalPlaces);
      }
    }
    return value;
  };

  const getDisplayLabel = (breakItem, index) => {
    if (!breakItem) return '';
    
    const cleanNumber = (value) => {
      if (value === undefined || value === null) return '';
      if (typeof value === 'number') {
        if (decimalPlaces === 0) {
          return Math.round(value).toLocaleString();
        } else {
          return value.toFixed(decimalPlaces);
        }
      }
      return value;
    };

    const isFirst = index === 0;
    const isLast = index === localBreaks.length - 1;

    let baseLabel = '';
    if (isFirst) {
      baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
    } else if (isLast) {
      baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
    } else {
      baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
    }

    // Append custom suffix if provided
    if (customLabelSuffix.trim()) {
      baseLabel += ` ${customLabelSuffix.trim()}`;
    }

    return baseLabel;
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

  // Enhanced breaks change handler that preserves decimal places in configuration
  const handleBreaksChangeWithDecimalPlaces = (updatedBreaks, customDecimalPlaces = null) => {
    // Ensure updatedBreaks is always an array of break objects
    let breaksArray = [];
    
    if (Array.isArray(updatedBreaks)) {
      breaksArray = updatedBreaks;
    } else if (updatedBreaks && updatedBreaks.classBreakInfos && Array.isArray(updatedBreaks.classBreakInfos)) {
      breaksArray = updatedBreaks.classBreakInfos;
    } else if (updatedBreaks && typeof updatedBreaks === 'object') {
      breaksArray = [updatedBreaks];
    } else {
      console.error('[ColorBreakEditor] Invalid breaks format in handleBreaksChangeWithDecimalPlaces:', updatedBreaks);
      return;
    }

    // Use custom decimal places if provided, otherwise use current state
    const currentDecimalPlaces = customDecimalPlaces !== null ? customDecimalPlaces : decimalPlaces;

    // Always include the current decimal places setting in the configuration
    // Pass the data in the format expected by the layer creation functions
    const configWithDecimalPlaces = {
      classBreakInfos: breaksArray,
      decimalPlaces: currentDecimalPlaces,
      type: 'class-breaks'
    };
    
    console.log('[ColorBreakEditor] Passing config to parent:', configWithDecimalPlaces);
    onBreaksChange(configWithDecimalPlaces);
  };

  const updateBreak = (index, field, value, immediate = false) => {
    // Create a copy of local breaks for immediate UI updates
    const newLocalBreaks = [...localBreaks];
    const break_item = newLocalBreaks[index];
    
    if (field === 'color') {
      // Preserve existing alpha when changing color
      const existingAlpha = Array.isArray(break_item.symbol.color) ? break_item.symbol.color[3] : 0.65;
      break_item.symbol.color = hexToRgba(value, existingAlpha);
      setLocalBreaks(newLocalBreaks);
      handleBreaksChangeWithDecimalPlaces(newLocalBreaks);
      return;
    } 
    
    // Handle individual break transparency with extended debounce
    if (field === 'individualTransparency') {
      // Clear existing timeout for this specific break
      const timeoutKey = `${index}-transparency`;
      if (breakTimeoutRefs.current[timeoutKey]) {
        clearTimeout(breakTimeoutRefs.current[timeoutKey]);
      }
      
      // Update local state immediately for responsive UI
      const numValue = parseInt(value);
      // Convert transparency percentage to opacity (invert the scale)
      const alpha = (100 - numValue) / 100;
      
      // Update the specific break's transparency immediately in local state
      if (Array.isArray(break_item.symbol.color)) {
        break_item.symbol.color[3] = alpha;
      } else {
        break_item.symbol.color = hexToRgba(break_item.symbol.color, alpha);
      }
      setLocalBreaks(newLocalBreaks);
      
      // Mark that we now have custom opacities (unless user is deliberately making them uniform)
      const allOpacities = newLocalBreaks.map(b => Math.round(((1 - (b.symbol?.color?.[3] || 0.35)) * 100)));
      const allSame = allOpacities.every(o => o === allOpacities[0]);
      setHasCustomOpacities(!allSame);
      
      // Extended debounced update to parent (4.5 seconds)
      breakTimeoutRefs.current[timeoutKey] = setTimeout(() => {
        handleBreaksChangeWithDecimalPlaces([...newLocalBreaks]);
        console.log(`[ColorBreakEditor] Individual transparency updated after ${EXTENDED_DEBOUNCE_DELAY}ms delay`);
      }, immediate ? 0 : EXTENDED_DEBOUNCE_DELAY);
      return;
    }
    
    // Handle global transparency with extended debounce - ALWAYS allow this to work
    if (field === 'transparency') {
      // Update local state immediately for responsive UI
      setTransparency(parseInt(value));
      
      // Clear existing timeout
      if (transparencyTimeoutRef.current) {
        clearTimeout(transparencyTimeoutRef.current);
      }
      
      // Apply global transparency regardless of custom opacity status with extended delay
      // This gives users control to override custom opacities using the global slider
      transparencyTimeoutRef.current = setTimeout(() => {
        const numValue = parseInt(value);
        // Convert transparency percentage to opacity (invert the scale)
        const alpha = (100 - numValue) / 100;
        const updatedBreaks = [...localBreaks];
        
        updatedBreaks.forEach(breakItem => {
          if (Array.isArray(breakItem.symbol.color)) {
            breakItem.symbol.color[3] = alpha;
          } else {
            breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
          }
          
          // Clear custom opacity flags when user explicitly sets global transparency
          delete breakItem.preserveOpacity;
          delete breakItem.hasCustomOpacities;
          delete breakItem.originalOpacity;
        });
        
        // When user uses global transparency, they're overriding custom settings
        setUserOverrideCustom(true);
        setHasCustomOpacities(false);
        
        handleBreaksChangeWithDecimalPlaces(updatedBreaks);
        console.log(`[ColorBreakEditor] Global transparency updated after ${EXTENDED_DEBOUNCE_DELAY}ms delay`);
      }, immediate ? 0 : EXTENDED_DEBOUNCE_DELAY);
      return;
    }
  
    // Handle min/max value updates with extended debouncing (5 seconds for value changes)
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
        handleBreaksChangeWithDecimalPlaces(adjustedBreaks);
        console.log(`[ColorBreakEditor] Min/Max value updated after ${VALUE_DEBOUNCE_DELAY}ms delay`);
      };
      
      // Execute immediately or with extended delay (5 seconds for value changes)
      if (immediate) {
        processBreakUpdate();
      } else {
        // Set extended debounced update
        breakTimeoutRefs.current[timeoutKey] = setTimeout(processBreakUpdate, VALUE_DEBOUNCE_DELAY);
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
    // Use provided alpha or default to 0.65 (35% transparency) only if no alpha specified
    const finalAlpha = alpha !== null ? alpha : 0.65;
    return [r, g, b, finalAlpha];
  };

  // Helper to get the current transparency value for a break (converted from opacity)
  const getBreakTransparency = (breakItem) => {
    if (Array.isArray(breakItem?.symbol?.color) && breakItem.symbol.color[3] !== undefined) {
      // Convert opacity to transparency percentage
      return Math.round((1 - breakItem.symbol.color[3]) * 100);
    }
    return 35; // Default transparency
  };

  const addBreak = () => {
    // Enhanced safety checks to prevent array method errors
    if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
      console.error('[ColorBreakEditor] Cannot add break: localBreaks is not a valid array:', localBreaks);
      return;
    }

    const lastBreak = localBreaks[localBreaks.length - 1];
    if (!lastBreak || typeof lastBreak.maxValue === 'undefined' || typeof lastBreak.minValue === 'undefined') {
      console.error('[ColorBreakEditor] Cannot add break: last break is invalid:', lastBreak);
      return;
    }

    const lastMaxValue = lastBreak.maxValue;
    
    // Calculate new break point values
    const range = lastMaxValue - lastBreak.minValue;
    const newMinValue = lastBreak.minValue;
    const newMaxValue = newMinValue + (range * 0.7); // Smaller increment
    
    // Update last break's max value
    lastBreak.maxValue = newMaxValue;
    
    // Preserve custom label for last break or auto-generate with suffix
    if (hasCustomLabels && originalLabels[localBreaks.length - 1]) {
      lastBreak.label = originalLabels[localBreaks.length - 1];
    } else {
      lastBreak.label = getDisplayLabel(lastBreak, localBreaks.length - 1);
    }
    
    // Create new break with same color configuration as the last break
    // Preserve the exact opacity from the last break
    const lastBreakOpacity = Array.isArray(lastBreak.symbol?.color) ? lastBreak.symbol.color[3] : 0.65;
    
    const newBreak = {
      minValue: newMaxValue,
      maxValue: lastMaxValue, // Use the original max value for the new last break
      symbol: {
        type: "simple-fill",
        color: Array.isArray(lastBreak.symbol?.color) 
          ? [...lastBreak.symbol.color.slice(0, 3), lastBreakOpacity] 
          : hexToRgba(lastBreak.symbol?.color || "#ffffff", lastBreakOpacity),
        outline: { 
          color: [50, 50, 50, 0.2], 
          width: lastBreak.symbol?.outline?.width || "0.5px" 
        }
      }
    };
    
    const newBreaks = [...localBreaks, newBreak];
    
    // Update all labels - preserve custom labels where they exist
    newBreaks.forEach((breakItem, idx) => {
      if (hasCustomLabels && originalLabels[idx]) {
        breakItem.label = originalLabels[idx];
      } else {
        breakItem.label = getDisplayLabel(breakItem, idx);
      }
    });

    setLocalBreaks(newBreaks);
    handleBreaksChangeWithDecimalPlaces(newBreaks);
  };

  const removeBreak = (index) => {
    // Enhanced safety checks to prevent array method errors
    if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
      console.error('[ColorBreakEditor] Cannot remove break: localBreaks is not a valid array:', localBreaks);
      return;
    }

    if (typeof index !== 'number' || index < 0 || index >= localBreaks.length) {
      console.error('[ColorBreakEditor] Cannot remove break: invalid index:', index);
      return;
    }

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
      if (newBreaks.length > 0) {
        newBreaks[newBreaks.length - 1].maxValue = lastMaxValue;
      }
      
      // Update labels - preserve custom labels where they exist, accounting for removed index
      const updatedOriginalLabels = {};
      Object.keys(originalLabels).forEach(key => {
        const keyIndex = parseInt(key);
        if (keyIndex < index) {
          // Keep labels before removed index unchanged
          updatedOriginalLabels[keyIndex] = originalLabels[key];
        } else if (keyIndex > index) {
          // Shift labels after removed index down by one
          updatedOriginalLabels[keyIndex - 1] = originalLabels[key];
        }
        // Skip the removed index
      });
      setOriginalLabels(updatedOriginalLabels);
      
      // Update all labels - always preserve originals where they exist
      newBreaks.forEach((breakItem, idx) => {
        if (hasCustomLabels && updatedOriginalLabels[idx]) {
          breakItem.label = updatedOriginalLabels[idx];
        } else {
          breakItem.label = getDisplayLabel(breakItem, idx);
        }
      });
      
      // Re-check for custom opacities after removal
      setHasCustomOpacities(detectCustomOpacities(newBreaks));
      
      setLocalBreaks(newBreaks);
      handleBreaksChangeWithDecimalPlaces(newBreaks);
    } else {
      console.warn('[ColorBreakEditor] Cannot remove break: minimum of 2 breaks required');
    }
  };

  // Function to apply uniform transparency to all breaks with enhanced safety checks
  const applyUniformTransparency = () => {
    // Enhanced safety checks to prevent array method errors
    if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
      console.error('[ColorBreakEditor] Cannot apply uniform transparency: localBreaks is not a valid array:', localBreaks);
      return;
    }

    // Convert transparency percentage to opacity (inverted scale)
    const alpha = (100 - transparency) / 100;
    const updatedBreaks = [...localBreaks];
    
    updatedBreaks.forEach((breakItem, index) => {
      if (!breakItem || !breakItem.symbol) {
        console.warn(`[ColorBreakEditor] Invalid break item at index ${index}:`, breakItem);
        return;
      }

      if (Array.isArray(breakItem.symbol.color)) {
        breakItem.symbol.color[3] = alpha;
      } else {
        breakItem.symbol.color = hexToRgba(breakItem.symbol.color, alpha);
      }
      
      // Clear custom opacity flags
      delete breakItem.preserveOpacity;
      delete breakItem.hasCustomOpacities;
      delete breakItem.originalOpacity;
    });
    
    setHasCustomOpacities(false);
    setUserOverrideCustom(true);
    setLocalBreaks(updatedBreaks);
    handleBreaksChangeWithDecimalPlaces(updatedBreaks);
  };

  // Function to apply custom suffix to all labels with enhanced safety checks
  const applyCustomSuffixToAllLabels = () => {
    // Enhanced safety checks to prevent array method errors
    if (!localBreaks || !Array.isArray(localBreaks) || localBreaks.length === 0) {
      console.error('[ColorBreakEditor] Cannot apply custom suffix: localBreaks is not a valid array:', localBreaks);
      return;
    }

    const updatedBreaks = [...localBreaks];
    
    updatedBreaks.forEach((breakItem, idx) => {
      if (!breakItem) {
        console.warn(`[ColorBreakEditor] Invalid break item at index ${idx}:`, breakItem);
        return;
      }

      // FORCE regenerate ALL labels with the new suffix - don't preserve original custom labels
      // This is the key fix: remove the condition that was preserving original labels
      breakItem.label = getDisplayLabel(breakItem, idx);
    });
    
    setLocalBreaks(updatedBreaks);
    handleBreaksChangeWithDecimalPlaces(updatedBreaks);
    
    console.log('[ColorBreakEditor] Applied custom suffix to all labels:', customLabelSuffix);
  };

  // Function to detect and apply suffix from current labels - ENHANCED
  const syncSuffixFromLabels = () => {
    const detectedSuffix = extractCommonSuffix(localBreaks);
    if (detectedSuffix && detectedSuffix !== customLabelSuffix) {
      setCustomLabelSuffix(detectedSuffix);
      console.log("[ColorBreakEditor] Synced suffix from current labels:", detectedSuffix);
    }
  };

  // Effect to sync suffix when breaks change externally - ENHANCED
  useEffect(() => {
    if (localBreaks && localBreaks.length > 0) {
      // Only sync if we don't already have a suffix set by user input
      const currentSuffix = extractCommonSuffix(localBreaks);
      if (currentSuffix && (!customLabelSuffix || customLabelSuffix !== currentSuffix)) {
        setCustomLabelSuffix(currentSuffix);
        console.log("[ColorBreakEditor] Auto-synced suffix from breaks:", currentSuffix);
      }
    }
  }, [localBreaks, hasCustomLabels]);

  // Function to reset custom opacity detection
  const resetCustomOpacityDetection = () => {
    setUserOverrideCustom(false);
    setHasCustomOpacities(detectCustomOpacities(localBreaks));
  };

  // Handle decimal places change - improved state synchronization with robust dropdown sync
  const handleDecimalPlacesChange = (newDecimalPlaces) => {
    // Ensure we have a valid number
    const validDecimalPlaces = Number.isInteger(newDecimalPlaces) && newDecimalPlaces >= 0 && newDecimalPlaces <= 4 
      ? newDecimalPlaces 
      : 2; // fallback to 2 if invalid
    
    console.log('[ColorBreakEditor] User changed decimal places from', decimalPlaces, 'to:', validDecimalPlaces);
    
    // Mark that user has manually changed decimal places (prevents auto-setting from visualization type)
    userHasChangedDecimalPlaces.current = true;
    
    // Update both states immediately to ensure dropdown reflects the change
    setDecimalPlaces(validDecimalPlaces);
    setDropdownDecimalPlaces(validDecimalPlaces);
    
    // Update labels with new decimal formatting immediately
    if (localBreaks && localBreaks.length > 0) {
      const updatedBreaks = [...localBreaks];
      
      updatedBreaks.forEach((breakItem, idx) => {
        // When user explicitly changes decimal places, ALWAYS regenerate labels
        // This overrides custom label preservation since user wants new formatting
        const cleanNumber = (value) => {
          if (value === undefined || value === null) return '';
          if (typeof value === 'number') {
            if (validDecimalPlaces === 0) {
              return Math.round(value).toLocaleString();
            } else {
              return value.toFixed(validDecimalPlaces);
            }
          }
          return value;
        };

        const isFirst = idx === 0;
        const isLast = idx === localBreaks.length - 1;

        let baseLabel = '';
        if (isFirst) {
          baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
        } else if (isLast) {
          baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
        } else {
          baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
        }

        // Append custom suffix if provided
        if (customLabelSuffix.trim()) {
          baseLabel += ` ${customLabelSuffix.trim()}`;
        }

        breakItem.label = baseLabel;
      });
      
      setLocalBreaks(updatedBreaks);
      // CRITICAL FIX: Pass the new decimal places value directly to avoid async state issue
      handleBreaksChangeWithDecimalPlaces(updatedBreaks, validDecimalPlaces);
      console.log('[ColorBreakEditor] Labels updated with new decimal places:', validDecimalPlaces);
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
            key={`min-range-${decimalPlaces}`}
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
            key={`max-range-${decimalPlaces}`}
            value={localBreaks[localBreaks.length - 1]?.maxValue}
            onChange={(value) => updateBreak(localBreaks.length - 1, 'maxValue', value)}
            formatValue={formatValue}
            className="w-full px-3 py-2"
            placeholder="Enter maximum value"
          />
        </div>
      </div>

      {/* Decimal Places Control Section - Enhanced with robust dropdown synchronization */}
      <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Decimal Places
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            For value formatting in legend
          </span>
        </div>
        <select
          key={`decimal-places-${dropdownDecimalPlaces}`} // Force re-render when dropdown state changes
          value={String(dropdownDecimalPlaces)} // Use dropdown state for better synchronization
          onChange={(e) => {
            const newValue = parseInt(e.target.value, 10);
            console.log('[ColorBreakEditor] Dropdown changed to:', newValue, 'current dropdown state:', dropdownDecimalPlaces);
            setDropdownDecimalPlaces(newValue); // Update dropdown state immediately
            handleDecimalPlacesChange(newValue);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="0">0 decimal places (e.g., 1,234)</option>
          <option value="1">1 decimal place (e.g., 1,234.5)</option>
          <option value="2">2 decimal places (e.g., 1,234.56)</option>
          <option value="3">3 decimal places (e.g., 1,234.567)</option>
          <option value="4">4 decimal places (e.g., 1,234.5678)</option>
        </select>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Preview: {formatValue(12345.6789)}</span>
          <span>
            Current: {decimalPlaces} decimal places 
            {dropdownDecimalPlaces !== decimalPlaces && (
              <span className="text-orange-500"> (Dropdown: {dropdownDecimalPlaces})</span>
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
                onClick={applyCustomSuffixToAllLabels}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply Suffix to All Labels
              </button>
<button
                onClick={() => {
                  setCustomLabelSuffix('');
                  // FORCE regenerate ALL labels without suffix - ignore custom label detection
                  // Generate labels inline without using getDisplayLabel to avoid state dependency
                  const updatedBreaks = [...localBreaks];
                  updatedBreaks.forEach((breakItem, idx) => {
                    // Generate clean number formatting function
                    const cleanNumber = (value) => {
                      if (value === undefined || value === null) return '';
                      if (typeof value === 'number') {
                        if (decimalPlaces === 0) {
                          return Math.round(value).toLocaleString();
                        } else {
                          return value.toFixed(decimalPlaces);
                        }
                      }
                      return value;
                    };

                    const isFirst = idx === 0;
                    const isLast = idx === updatedBreaks.length - 1;

                    // Generate label WITHOUT any suffix
                    let baseLabel = '';
                    if (isFirst) {
                      baseLabel = `Less than ${cleanNumber(breakItem.maxValue)}`;
                    } else if (isLast) {
                      baseLabel = `${cleanNumber(breakItem.minValue)} to ${cleanNumber(breakItem.maxValue)}`;
                    } else {
                      baseLabel = `${cleanNumber(breakItem.minValue)} - ${cleanNumber(breakItem.maxValue)}`;
                    }

                    // DON'T append any suffix - we're explicitly removing it
                    breakItem.label = baseLabel;
                  });
                  setLocalBreaks(updatedBreaks);
                  handleBreaksChangeWithDecimalPlaces(updatedBreaks);
                  console.log('[ColorBreakEditor] Removed suffix and regenerated all labels without suffix');
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
                    key={`min-${index}-${decimalPlaces}`}
                    value={breakItem.minValue}
                    onChange={(value) => updateBreak(index, 'minValue', value)}
                    disabled={index === 0}
                    placeholder="Min"
                    formatValue={formatValue}
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <NumberRangeInput
                    key={`max-${index}-${decimalPlaces}`}
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

      {/* Debug info showing current timeout values */}
      <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
        💡 Auto-save delays: 5s for values, 4.5s for other changes
      </div>
    </div>
  );
};

export default ColorBreakEditor;