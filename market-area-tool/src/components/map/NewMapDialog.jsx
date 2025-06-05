import React, { useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import chroma from 'chroma-js';
import { mapConfigurationsAPI } from '../../services/api'; // Adjust path as necessary
import { 
  initialLayerConfigurations,
  // createClassBreaks as createClassBreaksFromConfig // Only if used for generic fallback
} from './mapConfig'; // Adjust path as necessary

// --- categorizeOption function (can be outside the component or memoized) ---
const categorizeOption = (option) => {
  const val = option.value.toLowerCase();
  if (['totpop_cy', 'totpop_cy_heat', 'tothh_cy', 'tothh_cy_heat', 'avghhsz_cy_heat'].includes(val)) return 'Population & Households';
  if (['dpop_cy', 'dpop_cy_heat', 'dpopwrk_cy', 'dpopwrk_cy_heat', 'dpopres_cy', 'dpopres_cy_heat'].includes(val)) return 'Daytime Population';
  if (['medage_cy', 'medage_cy_heat', 'workage_cy', 'workage_cy_heat', 'senior_cy', 'senior_cy_heat', 'child_cy', 'child_cy_heat'].includes(val)) return 'Age';
  if (val.includes('hinc') || ['medhinc_cy_heat', 'avghinc_cy_heat', 'unemprt_cy_heat'].some(p => val.startsWith(p))) return 'Income';
  if (['popgrwcyfy_heat', 'hhgrwcyfy_heat', 'mhigrwcyfy_heat'].includes(val)) return 'Projected Growth';
  if (['popgrw20cy_heat', 'hhgrw20cy_heat'].includes(val)) return 'Historical Growth';
  if (val.includes('val') || ['tothu_cy', 'tothu_cy_heat', 'owner_cy', 'owner_cy_heat', 'renter_cy', 'renter_cy_heat', 'pcthomeowner_heat', 'vacant_cy', 'vacant_cy_heat', 'vacant_cy_pct_heat'].some(p=>val.startsWith(p)) ) return 'Housing';
  if (['pop0_cy', 'pop5_cy', 'pop10_cy', 'pop15_cy', 'pop20_cy', 'pop25_cy', 'pop30_cy', 'pop35_cy', 'pop40_cy', 'pop45_cy', 'pop50_cy', 'pop55_cy', 'pop60_cy', 'pop65_cy', 'pop70_cy', 'pop75_cy', 'pop80_cy', 'pop85_cy', 'genalphacy', 'genz_cy', 'millenn_cy', 'genx_cy', 'babyboomcy', 'oldrgenscy'].includes(val)) return 'Age Detail';
  if (['nohs_cy', 'somehs_cy', 'hsgrad_cy', 'ged_cy', 'smcoll_cy', 'asscdeg_cy', 'bachdeg_cy', 'graddeg_cy', 'hsgrad_less_cy_pct_heat', 'bachdeg_plus_cy_pct_heat', 'educbasecy', 'educbasecy_heat'].includes(val)) return 'Education';
  if (['_fy', '_fy_heat'].some(s => val.endsWith(s)) && !['popgrwcyfy_heat', 'hhgrwcyfy_heat', 'mhigrwcyfy_heat', 'pcigrwcyfy_heat'].includes(val) ) return 'Future'; // More specific future
  if (['hai_cy_heat', 'incmort_cy_heat', 'wlthindxcy_heat', 'sei_cy_heat', 'pci_cy_heat'].includes(val)) return 'Affluence & Affordability';
  if (val.includes('hisp') || val.includes('wht_cy') || val.includes('blk_cy') || val.includes('ai_cy') || val.includes('asn_cy') || val.includes('pi_cy') || val.includes('oth_cy') || val.includes('mlt_cy') || ['divindx_cy_heat', 'racebasecy', 'racebasecy_heat'].includes(val) ) return 'Race';
  if (val.includes('civlf') || val.includes('emp') || val.includes('unemp') || val.includes('edr_cy')) return 'Employment & Labor Force';
  return 'Other';
};


/**
 * Intelligently rounds numbers based on their magnitude
 * for better display in visualizations.
 * 
 * @param {number} value - Value to round
 * @return {number} - Rounded value
 */
const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  if (Math.abs(value) < 10) return Math.round(value);
  if (Math.abs(value) < 100) return Math.round(value / 10) * 10;
  if (Math.abs(value) < 1000) return Math.round(value / 100) * 100;
  if (Math.abs(value) < 10000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 10000) * 10000;
};  
/**
 * Determines the optimal number of breaks based on total data point count
 * using exact thresholds from specifications.
 * 
 * @param {number} dataCount - Total number of data points
 * @return {number} - Optimal number of breaks (1-10)
 */
const determineBreakCountByAreas = (dataCount) => {
  if (dataCount <= 1) return 1;
  if (dataCount <= 5) return 2;
  if (dataCount <= 9) return 3;
  if (dataCount <= 16) return 4;
  if (dataCount <= 25) return 5;
  if (dataCount <= 30) return 6;
  if (dataCount <= 42) return 7;
  if (dataCount <= 56) return 8;
  if (dataCount <= 81) return 9;
  return 10; // For 82+ data points
};

// TCG Color palette with RGB values
const TCG_COLORS = {
  'TCG Red Dark': [191, 0, 0],
  'TCG Orange Dark': [255, 122, 13],
  'TCG Green Dark': [0, 191, 44],
  'TCG Yellow Dark': [248, 242, 0],
  'TCG Cyan Dark': [0, 155, 155],
  'TCG Blue Dark': [0, 51, 128],
  'TCG Purple Dark': [92, 0, 184],
  'Pink Dark': [214, 0, 158],
  'Brown Dark': [148, 112, 60],
  'Carbon Gray Light': [174, 170, 170]
};

/**
 * Gets the appropriate TCG color for each break
 * @param {number} index - Index of the break (0-based)
 * @param {number} totalBreaks - Total number of breaks (1-10)
 * @param {string} returnFormat - 'array' for [r,g,b,a] or 'string' for CSS
 * @return {Array|string} - Color in requested format
 */
const getBreakColor = (index, totalBreaks, returnFormat = 'array') => {
  // TCG Color palette with RGB values
  const TCG_COLORS_INNER = { // Renamed to avoid conflict with outer scope if any confusion
    'TCG Red Dark': [191, 0, 0],
    'TCG Orange Dark': [255, 122, 13],
    'TCG Yellow Dark': [248, 242, 0],
    'TCG Green Dark': [0, 191, 44],
    'TCG Cyan Dark': [0, 155, 155],
    'TCG Blue Dark': [0, 51, 128],
    'TCG Purple Dark': [92, 0, 184],
    'Pink Dark': [214, 0, 158],
    'Brown Dark': [148, 112, 60],
    'Carbon Gray Light': [174, 170, 170]
  };
  
  // Complete color mappings for all break levels (1-10)
  const colorMappings = {
    1: ['TCG Red Dark'],
    2: ['TCG Red Dark', 'TCG Orange Dark'],
    3: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Green Dark'],
    4: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Cyan Dark'],
    5: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark'],
    6: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark', 'TCG Blue Dark'],
    7: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark', 'TCG Blue Dark', 'TCG Purple Dark'],
    8: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark', 'TCG Blue Dark', 'TCG Purple Dark', 'Pink Dark'],
    9: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark', 'TCG Blue Dark', 'TCG Purple Dark', 'Pink Dark', 'Brown Dark'],
    10: ['TCG Red Dark', 'TCG Orange Dark', 'TCG Yellow Dark', 'TCG Green Dark', 'TCG Cyan Dark', 'TCG Blue Dark', 'TCG Purple Dark', 'Pink Dark', 'Brown Dark', 'Carbon Gray Light']
  };
  
  // Validate inputs and get appropriate color mapping
  const validBreakCount = Math.max(1, Math.min(10, Math.floor(totalBreaks)));
  const validIndex = Math.max(0, Math.min(validBreakCount - 1, index));
  const colorNames = colorMappings[validBreakCount] || colorMappings[10];
  const colorName = colorNames[validIndex];
  
  // Default alpha value (0.8 for moderate transparency)
  const alpha = 0.8;
  const colorArray = [...TCG_COLORS_INNER[colorName], alpha];
  
  // Return in requested format
  return returnFormat === 'string' ? formatColorForDisplay(colorArray) : colorArray;
};


// Helper function to get predefined break ranges based on total breaks
/**
 * Returns precise break ranges for all break levels (1-10)
 * based on the specifications.
 * 
 * @param {number} totalBreaks - Total number of breaks (1-10)
 * @return {Array} - Array of min/max range objects
 */
const getBreakRanges = (totalBreaks) => {
  // Complete break ranges for all levels 1-10
  const breakRanges = {
    1: [
      {min: 0, max: 1}
    ],
    2: [
      {min: 0, max: 1},
      {min: 2, max: 5}
    ],
    3: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9}
    ],
    4: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16}
    ],
    5: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25}
    ],
    6: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25},
      {min: 26, max: 30}
    ],
    7: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25},
      {min: 26, max: 30},
      {min: 31, max: 42}
    ],
    8: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25},
      {min: 26, max: 30},
      {min: 31, max: 42},
      {min: 43, max: 56}
    ],
    9: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25},
      {min: 26, max: 30},
      {min: 31, max: 42},
      {min: 43, max: 56},
      {min: 57, max: 81}
    ],
    10: [
      {min: 0, max: 1},
      {min: 2, max: 5},
      {min: 6, max: 9},
      {min: 10, max: 16},
      {min: 17, max: 25},
      {min: 26, max: 30},
      {min: 31, max: 42},
      {min: 43, max: 56},
      {min: 57, max: 81},
      {min: 82, max: 200}
    ]
  };
  
  // Validate and return the appropriate break range
  const validBreakCount = Math.max(1, Math.min(10, Math.floor(totalBreaks)));
  return breakRanges[validBreakCount] || breakRanges[10];
};



/**
 * Calculates evenly distributed break points based on actual data values.
 * 
 * @param {Array<number>} values - Sorted array of numeric values
 * @param {number} breakCount - Number of breaks to generate
 * @return {Array<{min: number, max: number}>} - Array of min/max range objects
 */
const calculateDataDrivenBreaks = (values, breakCount) => {
  if (!values || values.length === 0 || !breakCount) {
    return [];
  }

  // Sort values if not already sorted
  const sortedValues = [...values].sort((a, b) => a - b);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  
  // Handle special case where all values are the same
  if (min === max) {
    return [{ min, max }];
  }

  // Calculate breaks based on actual data distribution
  const breaks = [];
  const dataLength = sortedValues.length;
  
  // Ensure we don't create more breaks than unique values
  const actualBreakCount = Math.min(breakCount, new Set(sortedValues).size);
  
  // Calculate step size for even distribution across the dataset
  const step = dataLength / actualBreakCount;
  
  for (let i = 0; i < actualBreakCount; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = (i === actualBreakCount - 1) 
      ? dataLength - 1 
      : Math.floor((i + 1) * step) - 1;
    
    const rangeMin = sortedValues[startIdx];
    const rangeMax = sortedValues[endIdx];
    
    // Apply smart rounding to make the ranges more user-friendly
    const roundedMin = smartRound(rangeMin);
    const roundedMax = smartRound(rangeMax);
    
    breaks.push({
      min: roundedMin,
      max: roundedMax
    });
  }

  // Fix any overlap caused by rounding
  for (let i = 0; i < breaks.length - 1; i++) {
    if (breaks[i].max >= breaks[i + 1].min) {
      // Find a midpoint value between the actual data points
      const currentEndIdx = Math.floor((i + 1) * step) - 1;
      const nextStartIdx = Math.floor((i + 1) * step);
      
      const midpoint = (sortedValues[currentEndIdx] + sortedValues[nextStartIdx]) / 2;
      const roundedMidpoint = smartRound(midpoint);
      
      breaks[i].max = roundedMidpoint;
      breaks[i + 1].min = roundedMidpoint;
    }
  }

  // Ensure the last break includes the maximum value exactly
  if (breaks.length > 0) {
    breaks[breaks.length - 1].max = smartRound(max);
  }
  
  return breaks;
};

/**
 * Generates table-driven class breaks for data visualization
 * with automatic distribution based on actual data values.
 * 
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Column name for values
 * @param {Object} baseSymbolStyle - Base style for symbols (optional)
 * @param {number} customBreakCount - Custom break count (optional)
 * @return {Array} - Array of class break objects
 */
const generateTableDrivenClassBreaks = (data, valueColumn, baseSymbolStyle = {}, customBreakCount = null) => {
  // Validate inputs
  if (!data || data.length === 0 || !valueColumn) {
    console.warn("generateTableDrivenClassBreaks: Missing data or valueColumn.");
    return null;
  }

  // Extract numeric values from data
  const values = data.map(item => {
    const rawValue = item[valueColumn];
    if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
    const num = Number(rawValue);
    return isNaN(num) ? NaN : num;
  }).filter(val => !isNaN(val));

  // Handle special case with no valid values
  if (values.length === 0) {
    console.warn(`generateTableDrivenClassBreaks: No valid numeric data in '${valueColumn}'.`);
    return null;
  }
  
  // Handle special case with single value
  if (values.length === 1) {
    const singleValue = smartRound(values[0]);
    const colorArray = getBreakColor(0, 1);
    const colorString = formatColorForDisplay(colorArray);
    
    return [{
      minValue: singleValue,
      maxValue: singleValue,
      label: `${singleValue.toLocaleString()}`,
      symbol: {
        type: "simple-marker",
        style: baseSymbolStyle.style || 'circle',
        color: colorString,
        size: baseSymbolStyle.size || 10,
        outline: {
          color: baseSymbolStyle.outline?.color || '#FFFFFF',
          width: Number(baseSymbolStyle.outline?.width) || 1
        }
      }
    }];
  }

  // Determine optimal break count based on TOTAL data count
  const totalDataCount = data.length;
  const optimalBreakCount = customBreakCount !== null ? 
    customBreakCount : determineBreakCountByAreas(totalDataCount);
  
  // console.log(`Data has ${totalDataCount} points, using ${optimalBreakCount} breaks`);
  
  // Generate data-driven breaks based on the actual values
  const breakRanges = calculateDataDrivenBreaks(values, optimalBreakCount);
  const breaks = [];
  
  // Create break objects with appropriate colors and labels
  for (let i = 0; i < breakRanges.length; i++) {
    const range = breakRanges[i];
    // Get color as RGB array and convert to CSS string
    const colorArray = getBreakColor(i, breakRanges.length);
    const colorString = formatColorForDisplay(colorArray);
    
    let label = '';
    if (i === 0 && breakRanges.length > 1) {
      label = `Less than ${range.max.toLocaleString()}`;
    } else if (i === breakRanges.length - 1 && breakRanges.length > 1) {
      label = `${range.min.toLocaleString()} or more`;
    } else {
      label = `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
    }
    
    breaks.push({
      minValue: range.min,
      maxValue: range.max,
      label: label,
      symbol: {
        type: "simple-marker",
        style: baseSymbolStyle.style || 'circle',
        color: colorString, // Use formatted color string for UI display
        size: baseSymbolStyle.size || 10,
        outline: {
          color: baseSymbolStyle.outline?.color || '#FFFFFF',
          width: Number(baseSymbolStyle.outline?.width) || 1
        }
      }
    });
  }

  // console.log("Generated data-driven class breaks with formatted colors:", breaks);
  return breaks;
};


// Helper function to generate color ramp
const generateColorRamp = (color1, color2, count) => {
  const validCount = Math.max(1, count);
  if (validCount === 1) return [color1];
  return chroma.scale([color1, color2]).mode('lch').colors(validCount);
};

// Helper function to get project ID from multiple sources
const getProjectId = () => {
  const routeProjectId = new URLSearchParams(window.location.search).get('projectId');
  const localStorageProjectId = localStorage.getItem("currentProjectId");
  const sessionStorageProjectId = sessionStorage.getItem("currentProjectId");
  const projectId = routeProjectId || localStorageProjectId || sessionStorageProjectId;
  // console.log('[NewMapDialog] Project ID sources:', { route: routeProjectId, localStorage: localStorageProjectId, sessionStorage: sessionStorageProjectId, final: projectId });
  return projectId;
};

// Helper function to clean undefined values from object
const cleanObject = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      if (obj[key] === '' || (Array.isArray(obj[key]) && obj[key].length === 0)) return;
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

// Helper function to convert area type to string
const convertAreaTypeToString = (value) => {
  // console.log('[NewMapDialog] Converting area type:', { value, type: typeof value });
  if (value === null || value === undefined) {
    // console.log('[NewMapDialog] Area type is null/undefined, defaulting to tract');
    return 'tract';
  }
  if (Array.isArray(value)) {
    // console.warn('[NewMapDialog] Area type received as array:', value);
    return value.length > 0 ? convertAreaTypeToString(value[0]) : 'tract';
  }
  if (typeof value === 'object' && value.value !== undefined) {
    // console.log('[NewMapDialog] Area type is object with value property:', value.value);
    return convertAreaTypeToString(value.value);
  }
  if (typeof value === 'string') {
    const validAreaTypes = ['tract', 'county', 'block_group', 'msa', 'state'];
    if (validAreaTypes.includes(value.toLowerCase())) return value.toLowerCase();
    // console.warn('[NewMapDialog] Unknown area type string:', value, 'defaulting to tract');
    return 'tract';
  }
  if (typeof value === 'number') {
    // console.log('[NewMapDialog] Area type is numeric:', value);
    switch (value) {
      case 11: return 'county';
      case 12: return 'tract';
      case 150: return 'block_group';
      default: 
        // console.warn('[NewMapDialog] Unknown numeric area type:', value, 'defaulting to tract');
        return 'tract';
    }
  }
  // console.warn('[NewMapDialog] Unexpected area type format:', value, typeof value, 'defaulting to tract');
  return 'tract';
};

// Helper function to validate configuration before sending to API
const validateConfigurationData = (configData) => {
  const errors = [];
  if (!configData.project_id) errors.push('Project ID is required');
  if (!configData.tab_name || configData.tab_name.trim() === '') errors.push('Tab name is required');
  if (!configData.visualization_type) errors.push('Visualization type is required');
  if (!configData.area_type || typeof configData.area_type !== 'string') {
    errors.push(`Area type must be a valid string, received: ${JSON.stringify(configData.area_type)}`);
  }
  if (configData.layer_configuration) {
    if (typeof configData.layer_configuration !== 'string') {
      errors.push('Layer configuration must be a serialized JSON string');
    } else {
      try { JSON.parse(configData.layer_configuration); } 
      catch (e) { errors.push('Layer configuration is not valid JSON'); }
    }
  }
  return errors;
};

// Save configuration to localStorage as fallback
const saveMapConfigurationToLocalStorage = async (mapData) => {
  const MANUAL_SAVE_KEY = "mapConfigurations_default";
  try {
    // console.log("[NewMapDialog] Starting localStorage save");
    let existingConfigs = [];
    try {
      const saved = localStorage.getItem(MANUAL_SAVE_KEY);
      if (saved) existingConfigs = JSON.parse(saved);
    } catch (parseError) {
      console.warn("Could not parse existing localStorage configurations:", parseError);
      existingConfigs = [];
    }
    const configToSave = {
      tab_name: mapData.name || `${mapData.type} Map`,
      visualization_type: mapData.type, // Original map type (e.g. 'heatmap', 'comps')
      area_type: mapData.layerConfiguration?.areaType || // Use areaType from layerConfig if available
                   (mapData.type === 'heatmap' || mapData.type === 'dotdensity' 
                    ? convertAreaTypeToString(mapData.areaType?.value || mapData.areaType || 'tract')
                    : 'custom'), 
      layer_configuration: mapData.layerConfiguration || {},
      order: existingConfigs.length,
      created_at: new Date().toISOString()
    };
    // console.log("[NewMapDialog] LocalStorage config prepared:", { tab_name: configToSave.tab_name, visualization_type: configToSave.visualization_type, area_type: configToSave.area_type });
    const existingIndex = existingConfigs.findIndex(savedConfig =>
      (savedConfig.layer_configuration?.type === mapData.layerConfiguration?.type && savedConfig.layer_configuration?.title === mapData.name) ||
      (savedConfig.visualization_type === mapData.type && savedConfig.tab_name === mapData.name)
    );
    if (existingIndex >= 0) {
      existingConfigs[existingIndex] = { ...existingConfigs[existingIndex], ...configToSave, updated_at: new Date().toISOString() };
      // console.log("[NewMapDialog] Updated localStorage config at index:", existingIndex);
    } else {
      existingConfigs.push(configToSave);
      // console.log("[NewMapDialog] Added new localStorage config");
    }
    localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(existingConfigs));
    // console.log("[NewMapDialog] LocalStorage save completed successfully");
    return { success: true, count: existingConfigs.length, type: 'localStorage' };
  } catch (error) {
    console.error("[NewMapDialog] LocalStorage save failed:", error);
    throw new Error(`LocalStorage save failed: ${error.message}`);
  }
};

// Save configuration to the database
const saveMapConfigurationToDatabase = async (mapData) => {
  const projectId = getProjectId();
  if (!projectId) throw new Error("No project ID available for saving configuration.");
  // console.log("[NewMapDialog] Starting database save for project:", projectId);
  try {
    const existingConfigsResponse = await mapConfigurationsAPI.getAll(projectId);
    const existingConfigs = existingConfigsResponse?.data || [];
    // console.log("[NewMapDialog] Found existing configurations:", existingConfigs.length);
    
    // Try to find existing config by tab_name and visualization_type (original map type)
    let targetConfig = existingConfigs.find(config => 
        config.tab_name === mapData.name && 
        config.visualization_type === mapData.type // mapData.type is original map type
    );

    if (!targetConfig) {
      // Fallback: if only one config of this original map type exists, update it
      const sameTypeConfigs = existingConfigs.filter(config => config.visualization_type === mapData.type);
      if (sameTypeConfigs.length === 1) {
        targetConfig = sameTypeConfigs[0];
        // console.log("[NewMapDialog] Found config by unique original type match:", targetConfig.id);
      }
    } else {
        // console.log("[NewMapDialog] Found config by name and original type:", targetConfig.id);
    }

    if (targetConfig?.id) {
      // console.log("[NewMapDialog] Deleting existing config:", targetConfig.id);
      try {
        await mapConfigurationsAPI.delete(targetConfig.id);
        // console.log("[NewMapDialog] Successfully deleted existing config");
      } catch (deleteError) {
        console.warn("[NewMapDialog] Failed to delete existing config, continuing with create:", deleteError.message);
      }
    }
    const configDataForApi = {
      project_id: projectId,
      project: projectId, 
      tab_name: mapData.name || `${mapData.type} Map`,
      visualization_type: mapData.type, // Save the original mapType ('heatmap', 'comps', etc.)
      area_type: mapData.layerConfiguration?.areaType || // Use areaType from layerConfig
                   (mapData.type === 'heatmap' || mapData.type === 'dotdensity' 
                    ? convertAreaTypeToString(mapData.areaType?.value || mapData.areaType || 'tract')
                    : 'custom'),
      layer_configuration: mapData.layerConfiguration || {},
      order: targetConfig?.order ?? existingConfigs.length
    };
    // console.log("[NewMapDialog] Configuration data prepared for API:", configDataForApi);
    const cleanedConfigData = cleanObject(configDataForApi);
    if (!cleanedConfigData.project_id && projectId) cleanedConfigData.project_id = projectId;
    if (!cleanedConfigData.project && projectId) cleanedConfigData.project = projectId;
    
    const apiValidationPayload = {
      ...cleanedConfigData,
      layer_configuration: JSON.stringify(cleanedConfigData.layer_configuration) 
    };
    const validationErrors = validateConfigurationData(apiValidationPayload);
    if (validationErrors.length > 0) throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
    
    // console.log("[NewMapDialog] Creating new config with validated data (sending object for layer_configuration)");
    const createResponse = await mapConfigurationsAPI.create(projectId, cleanedConfigData); // Send object for layer_configuration

    if (createResponse.data?.id) {
      // console.log("[NewMapDialog] Database save successful:", { configId: createResponse.data.id, status: createResponse.status });
      return { success: true, type: targetConfig ? 'recreate' : 'create', configId: createResponse.data.id, action: targetConfig ? 'updated' : 'created' };
    } else {
      throw new Error("Database API returned no configuration ID");
    }
  } catch (apiError) {
    console.error("[NewMapDialog] Database API error:", apiError);
    if (apiError.response) {
      // console.error("[NewMapDialog] API Error Details:", { status: apiError.response.status, data: apiError.response.data });
      if (apiError.response.status === 400) {
        const validationData = apiError.response.data;
        let errorMessage = "Database validation failed: ";
        Object.keys(validationData).forEach(key => { errorMessage += `${key}: ${JSON.stringify(validationData[key])}. `; });
        throw new Error(errorMessage || `Validation error: ${JSON.stringify(validationData)}`);
      }
    }
    throw new Error(`Database save failed: ${apiError.message}`);
  }
};

// Primary save function
const saveMapConfiguration = async (mapData) => {
  try {
    const databaseResult = await saveMapConfigurationToDatabase(mapData);
    if (databaseResult.success) {
      try { await saveMapConfigurationToLocalStorage(mapData); /* console.log("[NewMapDialog] Backup localStorage save completed"); */ } 
      catch (localStorageError) { console.warn("[NewMapDialog] Backup localStorage save failed:", localStorageError); }
      return databaseResult;
    }
  } catch (databaseError) {
    console.error("[NewMapDialog] Database save failed, attempting localStorage fallback:", databaseError);
    try {
      const localStorageResult = await saveMapConfigurationToLocalStorage(mapData);
      // console.log("[NewMapDialog] LocalStorage fallback save successful");
      return { success: true, type: 'localStorage', message: 'Saved to local storage (database unavailable)', fallbackReason: databaseError.message };
    } catch (localStorageError) {
      console.error("[NewMapDialog] Both database and localStorage saves failed");
      throw new Error(`Database save failed: ${databaseError.message}. LocalStorage fallback also failed: ${localStorageError.message}`);
    }
  }
  return { success: false, message: "Save operation did not complete."}; // Should not be reached if throws are working
};

/**
 * Generates class breaks specifically for point data colorization
 * 
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Column name for values
 * @param {number} numClasses - Custom break count (optional)
 * @param {Object} baseSymbolStyle - Base style for symbols (optional)
 * @return {Array} - Array of class break objects
 */
const generateClassBreaksForPoints = (data, valueColumn, numClasses = null, baseSymbolStyle = {}) => {
  return generateTableDrivenClassBreaks(data, valueColumn, baseSymbolStyle, numClasses);
};

/**
 * Generates class breaks for point size visualization
 * 
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Column name for values
 * @param {number} numClasses - Custom break count (optional)
 * @param {number} minSize - Minimum point size (optional)
 * @param {number} maxSize - Maximum point size (optional)
 * @return {Array} - Array of size break objects
 */
const generateSizeBreaksForPoints = (data, valueColumn, numClasses = null, minSize = 6, maxSize = 24) => {
  // Validate inputs
  if (!data || data.length === 0 || !valueColumn) {
    console.warn("generateSizeBreaksForPoints: Missing data or valueColumn.");
    return null;
  }

  // Extract numeric values from data
  const values = data.map(item => {
    const rawValue = item[valueColumn];
    if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
    const num = Number(rawValue);
    return isNaN(num) ? NaN : num;
  }).filter(val => !isNaN(val));

  if (values.length === 0) {
    console.warn(`generateSizeBreaksForPoints: No valid numeric data in '${valueColumn}'.`);
    return null;
  }
  
  // Determine optimal break count based on TOTAL data count (using values length)
  const optimalBreakCount = numClasses !== null ? 
    numClasses : determineBreakCountByAreas(values.length); // Use length of valid values
  
  // Generate breaks based on actual data distribution, not predefined ranges
  const breakRanges = calculateDataDrivenBreaks(values, optimalBreakCount);
  const sizeBreaks = [];
  
  // Create size break objects with appropriate size progression
  for (let i = 0; i < breakRanges.length; i++) {
    const range = breakRanges[i];
    // Calculate proportional size between min and max
    const proportion = breakRanges.length === 1 ? 0.5 : i / (breakRanges.length - 1);
    const currentSize = minSize + (proportion * (maxSize - minSize));
    
    let label = '';
    if (i === 0 && breakRanges.length > 1) {
      label = `Less than ${range.max.toLocaleString()}`;
    } else if (i === breakRanges.length - 1 && breakRanges.length > 1) {
      label = `${range.min.toLocaleString()} or more`;
    } else {
      label = `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
    }
    if (breakRanges.length === 1) { // Single break, label is just the range
        label = `${range.min.toLocaleString()}${range.min !== range.max ? ` - ${range.max.toLocaleString()}` : ''}`;
    }


    sizeBreaks.push({
      minValue: range.min,
      maxValue: range.max,
      label: label,
      size: Math.round(currentSize)
    });
  }

  return sizeBreaks;
};


/**
 * Formats a color value (array or string) into a CSS-compatible color string.
 * 
 * @param {Array|string} color - Color as RGB/RGBA array or string
 * @return {string} - CSS color string (rgb, rgba, or original if already string)
 */
const formatColorForDisplay = (color) => {
  if (Array.isArray(color)) {
    if (color.length === 3) {
      return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    } else if (color.length === 4) {
      return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    }
  }
  return String(color); // Return as is if already a string or ensure it's a string
};


/**
 * Generates class breaks for heatmap visualizations with
 * data-driven distribution and properly formatted colors.
 * 
 * @param {number} dataCount - Number of data points
 * @param {Array} sampleData - Sample data for distribution calculation (optional)
 * @return {Array} - Array of class break objects for heatmap
 */
const generateGenericHeatmapClassBreaks = (dataCount = 100, sampleData = null) => {
  // Determine break count
  const breakCount = determineBreakCountByAreas(dataCount);
  // console.log(`Heatmap with ${dataCount} data points, using ${breakCount} breaks`);
  
  // Generate sample data for distribution if no real data provided
  const values = sampleData || Array.from({ length: dataCount }, (_, i) => i);
  
  // Get data-driven break ranges
  const breakRanges = calculateDataDrivenBreaks(values, breakCount);
  
  // Create break objects with appropriate colors
  return breakRanges.map((range, index) => {
    // Get color as RGB array and convert to CSS string
    const colorArray = getBreakColor(index, breakCount);
    const colorString = formatColorForDisplay(colorArray);
    
    let label = '';
    if (index === 0 && breakRanges.length > 1) {
      label = `Less than ${range.max.toLocaleString()}`;
    } else if (index === breakRanges.length - 1 && breakRanges.length > 1) {
      label = `${range.min.toLocaleString()} or more`;
    } else {
      label = `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
    }
    
    return {
      minValue: range.min,
      maxValue: range.max,
      label: label,
      symbol: { 
        type: "simple-fill", 
        style: "solid", 
        color: colorString, // Use formatted color string for UI display
        outline: { 
          color: 'rgba(255, 255, 255, 0.5)', 
          width: 0.5 
        }
      }
    };
  });
};

// Helper to infer value format
const getValueFormatForColumn = (columnName, value) => {
  const name = columnName?.toLowerCase() || '';
  if (name.includes('price') || name.includes('value') || name.includes('income') || name.includes('cost') || name.includes('sales')) return { prefix: '$', decimals: 0, multiplier: 1 };
  if (name.includes('percent') || name.includes('rate') || name.includes('pct')) return { suffix: '%', decimals: 1, multiplier: 1 };
  if (name.includes('density')) return { suffix: '/sq mi', decimals: 0, multiplier: 1 };
  if (name.includes('age')) return { suffix: ' yrs', decimals: 1, multiplier: 1 };
  if (name.includes('count') || name.includes('total') || name.includes('number')) return { decimals: 0, multiplier: 1 };
  if (typeof value === 'number') {
    if (!Number.isInteger(value) && value > 0 && value < 1) return { suffix: '%', decimals: 1, multiplier: 100 };
    if (value >= 1 && value <= 100 && (name.includes('%') || name.includes('rate'))) return { suffix: '%', decimals: 1, multiplier: 1 };
    if (value > 1000) return { prefix: '$', decimals: 0, multiplier: 1 };
    return { decimals: Number.isInteger(value) ? 0 : 2, multiplier: 1 };
  }
  return { decimals: 0, prefix: '', suffix: '', multiplier: 1 };
};

// Helper to get specific config from initialLayerConfigurations (from mapConfig.js)
const getInitialConfigForVisualization = (visualizationValue) => {
  if (initialLayerConfigurations[visualizationValue]) {
    return JSON.parse(JSON.stringify(initialLayerConfigurations[visualizationValue]));
  }
  // console.warn(`[NewMapDialog] No specific config found in initialLayerConfigurations for '${visualizationValue}'.`);
  return null;
};

// Generic fallback for dot density attributes
const generateGenericDotDensityAttributes = (field) => {
  return [{ field: field || "value", color: "#8A2BE2", label: field || "Value" }];
};

// Definition of map types for the selection UI
const MAP_TYPE_DEFINITIONS = [
  { id: 'heatmap', name: 'Heat Map', desc: 'Color-coded gradient data.', enabled: true },
  { id: 'dotdensity', name: 'Dot Density', desc: 'Points representing data quantity.', enabled: true },
  { id: 'comps', name: 'Comps Map', desc: 'Comparable property data (value based color).', enabled: false },
  { id: 'pipeline', name: 'Pipeline Map', desc: 'Status-based property data.', enabled: false },
  { id: 'custom', name: 'Custom Points Map', desc: 'Points with color by Value1, size by Value2.', enabled: false },
];


// NewMapDialog Component
const NewMapDialog = ({ isOpen, onClose, onCreateMap, visualizationOptions, areaTypes }) => {
  const [step, setStep] = useState(1);
  const [mapName, setMapName] = useState('New Map');
  // Default to the first enabled map type, or 'heatmap' as a fallback
  const [mapType, setMapType] = useState(MAP_TYPE_DEFINITIONS.find(mt => mt.enabled)?.id || 'heatmap');
  const [selectedVisualization, setSelectedVisualization] = useState('');
  const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);
  const [customData, setCustomData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [labelColumn, setLabelColumn] = useState('');
  const [variable1Column, setVariable1Column] = useState('');
  const [variable2Column, setVariable2Column] = useState('');
  const [valueColumn1, setValueColumn1] = useState('');
  const [valueColumn2, setValueColumn2] = useState('');
  const [statusColumn, setStatusColumn] = useState('');
  const [latitudeColumn, setLatitudeColumn] = useState('');
  const [longitudeColumn, setLongitudeColumn] = useState('');
  const [fileError, setFileError] = useState('');
  const [colorClassBreakInfos, setColorClassBreakInfos] = useState(null);
  const [sizeClassBreakInfos, setSizeClassBreakInfos] = useState(null);
  const [variable1Text, setVariable1Text] = useState('');
  const [variable2Text, setVariable2Text] = useState('');
  const [labelOptions, setLabelOptions] = useState({ includeVariables: true, avoidCollisions: true, visibleAtAllZooms: false, fontSize: 10, bold: false, whiteBackground: false, showLabelConfig: false });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [categorizedVisualizationOptions, setCategorizedVisualizationOptions] = useState({});


  // Determine if current map type needs configuration step
  const isHeatmapOrDotDensity = mapType === 'heatmap' || mapType === 'dotdensity';
  
  // Calculate maximum steps based on map type
  const maxSteps = isHeatmapOrDotDensity ? 2 : 3; // Heatmap/DotDensity have 2 steps (Type -> Review), others 3 (Type -> Config -> Review)

  useEffect(() => {
    if (mapType === 'heatmap' || mapType === 'dotdensity') {
      const relevantOptions = visualizationOptions.filter(option => {
        if (mapType === 'heatmap') {
          return option.category === 'Heat Map';
        } else if (mapType === 'dotdensity') {
          return option.category === 'Dot Density Map';
        }
        return false;
      });
  
      const grouped = relevantOptions.reduce((acc, option) => {
        const categoryName = categorizeOption(option); // Use the globally defined function
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(option);
        return acc;
      }, {});
  
      const categoryOrder = [
        'Population & Households', 'Daytime Population', 'Age', 'Age Detail', 'Income', 
        'Affluence & Affordability', 'Housing', 'Education', 'Employment & Labor Force',
        'Race', 'Projected Growth', 'Historical Growth', 'Future', 'Other'
      ];
      
      const orderedGrouped = {};
      categoryOrder.forEach(catName => {
          if (grouped[catName]) {
              orderedGrouped[catName] = grouped[catName];
          }
      });
      Object.keys(grouped).forEach(catName => {
          if (!orderedGrouped[catName]) { // Add any categories not in predefined order (e.g. if new ones appear)
              orderedGrouped[catName] = grouped[catName];
          }
      });
  
      setCategorizedVisualizationOptions(orderedGrouped);
    } else {
      setCategorizedVisualizationOptions({}); // Clear if not heatmap/dotdensity
    }
  }, [visualizationOptions, mapType]);


  // Auto-generate color class breaks when data and value column change
  useEffect(() => {
    if (mapType === 'custom' && customData && valueColumn1) {
      const baseSymbol = { style: 'circle', outline: { color: '#FFFFFF', width: 1 } };
      const breaks = generateClassBreaksForPoints(customData, valueColumn1, null, baseSymbol);
      setColorClassBreakInfos(breaks);
    } else if (mapType !== 'custom' && mapType !== 'comps' && colorClassBreakInfos !== null) { // Clear if not custom or comps
      setColorClassBreakInfos(null);
    }
  }, [customData, valueColumn1, mapType]); // Removed colorClassBreakInfos from deps to avoid loops if it's set null here

  // Auto-generate size class breaks when data and size column change
  useEffect(() => {
    if (mapType === 'custom' && customData && valueColumn2) {
      const breaks = generateSizeBreaksForPoints(customData, valueColumn2);
      setSizeClassBreakInfos(breaks);
    } else if (mapType !== 'custom' && sizeClassBreakInfos !== null) { // Clear if not custom
      setSizeClassBreakInfos(null);
    }
  }, [customData, valueColumn2, mapType]); // Removed sizeClassBreakInfos from deps

  // Auto-generate color class breaks for comps maps
  useEffect(() => {
    if (mapType === 'comps' && customData && valueColumn1) {
      const baseSymbol = { style: 'circle', outline: { color: '#FFFFFF', width: 1 } };
      const breaks = generateClassBreaksForPoints(customData, valueColumn1, null, baseSymbol);
      setColorClassBreakInfos(breaks);
    } else if (mapType !== 'comps' && mapType !== 'custom' && colorClassBreakInfos !== null) {
        // Already handled by the first useEffect which clears if not custom OR comps
    }
  }, [customData, valueColumn1, mapType]); // Removed colorClassBreakInfos from deps

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    setFileError(''); setCustomData(null); setColumns([]);
    setLabelColumn(''); setVariable1Column(''); setVariable2Column('');
    setValueColumn1(''); setValueColumn2(''); setStatusColumn('');
    setLatitudeColumn(''); setLongitudeColumn('');
    setColorClassBreakInfos(null); setSizeClassBreakInfos(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setFileError('File size exceeds 10MB limit'); return; }
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension === 'csv') handleCSVFile(file);
    else if (fileExtension === 'xlsx' || fileExtension === 'xls') handleExcelFile(file);
    else setFileError('Unsupported file format. Please upload a CSV, XLSX, or XLS file.');
  };
  
  const handleCSVFile = (file) => {
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: 'greedy', transformHeader: header => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
            console.warn("CSV Parsing Errors:", results.errors);
            setFileError(`CSV parsing encountered issues. Check file format near row ${results.errors[0].row}.`);
        }
        if (!results.data || results.data.length === 0) { setFileError("CSV file appears empty or couldn't be parsed correctly."); return; }
        const typedData = results.data.map(row => {
            const newRow = {};
            for (const key in row) {
                const value = row[key];
                if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) newRow[key] = Number(value);
                else newRow[key] = value; // Keep original type if not clearly a number string
            }
            return newRow;
        });
        processFileData(typedData, results.meta.fields || []);
      },
      error: (error) => { setFileError(`Error parsing CSV file: ${error.message}`); setCustomData(null); setColumns([]); }
    });
  };
  
  const handleExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellStyles: false });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("Workbook contains no sheets.");
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) throw new Error(`Sheet '${firstSheetName}' could not be read.`);
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null }); // raw: true tries to preserve types
        if (jsonData.length === 0) { setFileError('Excel sheet appears to have no data rows.'); return; }
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        processFileData(jsonData, headers);
      } catch (error) {
        console.error("Excel Parsing Error:", error);
        setFileError(`Error parsing Excel file: ${error.message}. Ensure the first sheet has data.`);
        setCustomData(null); setColumns([]);
      }
    };
    reader.onerror = (readError) => {
      console.error("File Reading Error:", readError);
      setFileError('Error reading the selected file.');
    };
    reader.readAsArrayBuffer(file);
  };
  
  const processFileData = (data, fields) => {
    const validFields = fields.filter(f => f !== undefined && f !== null && String(f).trim() !== '');
    setCustomData(data); setColumns(validFields);
    setColorClassBreakInfos(null); setSizeClassBreakInfos(null);
    setLabelColumn(''); setVariable1Column(''); setVariable2Column(''); 
    setValueColumn1(''); setValueColumn2(''); setStatusColumn('');
    setLatitudeColumn(''); setLongitudeColumn('');
    if (validFields.length > 0) {
      const potentialLabelCols = ['name', 'title', 'label', 'property', 'id', 'address', 'site'];
      const labelCol = validFields.find(f => potentialLabelCols.some(p => f.toLowerCase().includes(p))) || validFields[0];
      setLabelColumn(labelCol);
      const numericColumns = [], potentialLatLon = ['lat', 'lon', 'lng', 'latitude', 'longitude', 'x', 'y', 'coord', 'east', 'north'], potentialIds = ['id', 'objectid', 'fid', 'pk', 'key'];
      validFields.forEach(field => {
        let isNumeric = false, checked = 0, nonNullFound = false;
        for (let i = 0; i < data.length && checked < 5; i++) { // Check up to 5 non-null/undefined values
          const value = data[i]?.[field];
          if (value !== null && value !== undefined && String(value).trim() !== '') { // Added trim check for strings
            nonNullFound = true;
            isNumeric = typeof value === 'number' && !isNaN(value); 
            checked++; 
            if (!isNumeric) break; 
          }
        }
        // Only consider it numeric if at least one non-null value was found and all checked were numeric
        if (nonNullFound && isNumeric && !potentialLatLon.some(p => field.toLowerCase().includes(p)) && !potentialIds.some(p => field.toLowerCase() === p)) {
          numericColumns.push(field);
        }
      });
      if (numericColumns.length > 0) setValueColumn1(numericColumns[0]);
      if (numericColumns.length > 1) setValueColumn2(numericColumns[1]); else if (numericColumns.length > 0) setValueColumn2(numericColumns[0]); // Default to same if only one numeric
      
      const statusColumns = ['status', 'state', 'condition', 'phase', 'stage'];
      const statusCol = validFields.find(field => statusColumns.some(p => field.toLowerCase().includes(p)));
      if (statusCol) setStatusColumn(statusCol);
      
      const latColumns = ['latitude', 'lat', 'ycoord', 'y'];
      const longColumns = ['longitude', 'long', 'lng', 'xcoord', 'x'];
      let latCol = validFields.find(f => latColumns.includes(f.toLowerCase())) || validFields.find(f => f.toLowerCase().includes('lat'));
      let lngCol = validFields.find(f => longColumns.includes(f.toLowerCase())) || validFields.find(f => f.toLowerCase().includes('lon') || f.toLowerCase().includes('lng'));
      if (latCol) setLatitudeColumn(latCol); if (lngCol) setLongitudeColumn(lngCol);
    }
  };



  const getSampleValue = (col) => {
    if (!customData || !col) return undefined;
    for (const row of customData) if (row && row[col] !== null && row[col] !== undefined) return row[col];
    return undefined;
  };

  const generateFormattedTitle = () => {
    const parts = [];
    if (labelColumn && labelColumn !== 'none') parts.push(labelColumn || "Label");
    else if (valueColumn1 || valueColumn2 || selectedVisualization) parts.push("Data Visualization");
    else parts.push("Map");
    const variableParts = [];
    if (variable1Column) variableParts.push(variable1Column + (variable1Text ? ' ' + variable1Text : ''));
    if (variable2Column) variableParts.push(variable2Column + (variable2Text ? ' ' + variable2Text : ''));
    if (variableParts.length > 0) parts.push('(' + variableParts.join(", ") + ')');
    return parts.join(" ");
  };

  const resetForm = () => {
    setStep(1); setMapName('New Map'); 
    setMapType(MAP_TYPE_DEFINITIONS.find(mt => mt.enabled)?.id || 'heatmap'); // Reset to default enabled map type
    setSelectedVisualization('');
    setSelectedAreaType(areaTypes[0]); setCustomData(null); setColumns([]);
    setLabelColumn(''); setVariable1Column(''); setVariable2Column('');
    setVariable1Text(''); setVariable2Text(''); setValueColumn1(''); setValueColumn2('');
    setStatusColumn(''); setLatitudeColumn(''); setLongitudeColumn(''); setFileError('');
    setColorClassBreakInfos(null); setSizeClassBreakInfos(null);
    setLabelOptions({ includeVariables: true, avoidCollisions: true, visibleAtAllZooms: false, fontSize: 10, bold: false, whiteBackground: false, showLabelConfig: false });
    setIsSaving(false); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateMap = async () => {
    console.log("[NewMapDialog] Starting map creation process...");
    
    try {
      // Set saving state
      setIsSaving(true);
      
      // Validate required fields based on map type
      if ((mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && !customData) {
        setFileError('Please upload a data file.');
        setIsSaving(false);
        return;
      }
      
      if ((mapType === 'heatmap' || mapType === 'dotdensity') && !selectedVisualization) {
        setFileError('Please select a visualization variable.');
        setIsSaving(false);
        return;
      }
      
      // Additional validation for custom data maps
      if (mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') {
        if (!labelColumn && labelColumn !== 'none') {
          setFileError('Please select a Label column or "None".');
          setIsSaving(false);
          return;
        }
        if (!latitudeColumn || !longitudeColumn) {
          setFileError('Please select Latitude and Longitude columns.');
          setIsSaving(false);
          return;
        }
      }

      // Build map configuration based on map type
      let mapConfiguration = {};
      
      if (mapType === 'heatmap' || mapType === 'dotdensity') {
        // For standard visualizations, get config from initialLayerConfigurations
        const visualizationConfig = getInitialConfigForVisualization(selectedVisualization);
        if (visualizationConfig) {
          mapConfiguration = {
            ...visualizationConfig,
            field: selectedVisualization,
            visualizationKey: selectedVisualization,
            type: mapType,
            areaType: convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract')
          };
        } else {
          console.warn(`[NewMapDialog] No configuration found for visualization: ${selectedVisualization}`);
          mapConfiguration = {
            field: selectedVisualization,
            visualizationKey: selectedVisualization,
            type: mapType,
            areaType: convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract')
          };
        }
      } else if (mapType === 'custom' || mapType === 'comps' || mapType === 'pipeline') {
        // For custom data maps, build configuration from form data
        mapConfiguration = {
          type: mapType,
          customData: {
            data: customData,
            nameColumn: labelColumn === 'none' ? null : labelColumn
          },
          labelColumn: labelColumn === 'none' ? null : labelColumn,
          hasNoLabels: labelColumn === 'none',
          hideAllLabels: labelColumn === 'none',
          variable1Column: variable1Column,
          variable2Column: variable2Column,
          variable1Text: variable1Text,
          variable2Text: variable2Text,
          valueColumn: valueColumn1,
          valueColumn1: valueColumn1,
          valueColumn2: valueColumn2,
          statusColumn: statusColumn,
          latitudeColumn: latitudeColumn,
          longitudeColumn: longitudeColumn,
          labelOptions: labelOptions,
          titleFormat: generateFormattedTitle(),
          
          // Include generated class breaks for visualization
          colorClassBreakInfos: colorClassBreakInfos,
          sizeClassBreakInfos: sizeClassBreakInfos,
          
          // Symbol configuration for points
          symbol: {
            style: 'circle',
            size: 10,
            color: mapType === 'comps' ? '#800080' : '#FF0000', // Purple for comps, red for others
            outline: {
              color: '#FFFFFF',
              width: 1
            }
          }
        };

        // Add type-specific configurations
        if (mapType === 'pipeline') {
          mapConfiguration.statusMapping = {
            // Default status color mapping - can be customized later
            'active': '#00FF00',
            'pending': '#FFFF00',
            'completed': '#0000FF',
            'cancelled': '#FF0000'
          };
        }
      }

      // Create the map data object to pass to parent
      const mapData = {
        name: mapName.trim() || generateFormattedTitle(),
        type: mapType,
        visualizationType: mapType,
        areaType: selectedAreaType,
        layerConfiguration: mapConfiguration,
        
        // Include original form data for reference
        originalFormData: {
          mapType,
          selectedVisualization,
          selectedAreaType,
          customData,
          labelColumn,
          variable1Column,
          variable2Column,
          variable1Text,
          variable2Text,
          valueColumn1,
          valueColumn2,
          statusColumn,
          latitudeColumn,
          longitudeColumn,
          labelOptions
        }
      };

      console.log("[NewMapDialog] Calling onCreateMap with data:", {
        name: mapData.name,
        type: mapData.type,
        hasCustomData: !!customData,
        configType: mapConfiguration.type
      });

      // Save the map configuration to database/storage
      try {
        const saveResult = await saveMapConfiguration(mapData);
        console.log("[NewMapDialog] Map configuration saved:", saveResult);
        
        // Add the configId to mapData if save was successful
        if (saveResult.success && saveResult.configId) {
          mapData.configId = saveResult.configId;
          mapData.mapConfigId = saveResult.configId;
        }
      } catch (saveError) {
        console.error("[NewMapDialog] Error saving map configuration:", saveError);
        // Continue with map creation even if save fails - it will use localStorage fallback
      }

      // Call the parent's map creation handler
      if (onCreateMap && typeof onCreateMap === 'function') {
        await onCreateMap(mapData);
        console.log("[NewMapDialog] Map creation completed successfully");
        
        // Reset form and close dialog
        resetForm();
        onClose();
      } else {
        throw new Error("onCreateMap function not provided or invalid");
      }
      
    } catch (error) {
      console.error("[NewMapDialog] Error during map creation:", error);
      setFileError(`Failed to create map: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const onCancel = () => { resetForm(); onClose(); };

  /**
   * Enhanced nextStep function that intelligently handles step navigation
   * based on map type. For heatmap/dotdensity maps, skips configuration
   * step and goes directly from step 1 to step 3 (review).
   */
  const nextStep = () => {
    if (step === 1) {
      // Validate step 1 requirements for all map types
      if ((mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && !customData) { 
        setFileError('Please upload a data file.'); 
        return; 
      }
      if ((mapType === 'heatmap' || mapType === 'dotdensity') && !selectedVisualization) { 
        setFileError('Please select a visualization variable.'); 
        return; 
      }
      
      // For heatmap/dotdensity maps, skip configuration step and go directly to review
      if (isHeatmapOrDotDensity) {
        setStep(maxSteps); // Skip step 2 and go to review (which is now maxSteps)
        setFileError('');
        return;
      }
    }
    
    if (step === 2) { // This is the configuration step, only for non-heatmap/dotdensity
      // Configuration step validation for custom data maps only
      if (mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') {
          if (!labelColumn && labelColumn !== 'none') { 
            setFileError('Please select a Label column or "None".'); 
            return; 
          }
          if (!latitudeColumn || !longitudeColumn) { 
            setFileError('Please select Latitude and Longitude columns.'); 
            return; 
          }
          if (customData && customData.length > 0) {
              let latValid = false, lonValid = false, val1Numeric = true, val2Numeric = true, checked = 0;
              for(let i = 0; i < customData.length && checked < 5; i++) {
                  const row = customData[i];
                  if (row) {
                      if (latitudeColumn && typeof row[latitudeColumn] === 'number' && !isNaN(Number(row[latitudeColumn]))) latValid = true;
                      if (longitudeColumn && typeof row[longitudeColumn] === 'number' && !isNaN(Number(row[longitudeColumn]))) lonValid = true;
                      
                      if (mapType === 'custom' && valueColumn1 && row[valueColumn1] !== null && row[valueColumn1] !== undefined && String(row[valueColumn1]).trim() !== '' && isNaN(Number(row[valueColumn1]))) val1Numeric = false;
                      if (mapType === 'custom' && valueColumn2 && row[valueColumn2] !== null && row[valueColumn2] !== undefined && String(row[valueColumn2]).trim() !== '' && isNaN(Number(row[valueColumn2]))) val2Numeric = false;
                      if (mapType === 'comps' && valueColumn1 && row[valueColumn1] !== null && row[valueColumn1] !== undefined && String(row[valueColumn1]).trim() !== '' && isNaN(Number(row[valueColumn1]))) val1Numeric = false;
                      
                      // Only increment checked if relevant columns are being validated for this row
                      if ((latitudeColumn && row[latitudeColumn] !== undefined) || 
                          (longitudeColumn && row[longitudeColumn] !== undefined) ||
                          (valueColumn1 && row[valueColumn1] !== undefined) ||
                          (valueColumn2 && row[valueColumn2] !== undefined)) {
                        checked++;
                      }
                  }
              }
              // Check only if a column is selected
              if (latitudeColumn && !latValid) { 
                setFileError(`Latitude column ('${latitudeColumn}') has non-numeric or missing data in first 5 non-empty rows.`); 
                return; 
              }
              if (longitudeColumn && !lonValid) { 
                setFileError(`Longitude column ('${longitudeColumn}') has non-numeric or missing data in first 5 non-empty rows.`); 
                return; 
              }
              if ((mapType === 'custom' || mapType === 'comps') && valueColumn1 && !val1Numeric) { 
                setFileError(`Value Column 1 (Color) ('${valueColumn1}') has non-numeric data. Class breaks cannot be generated.`); 
                setColorClassBreakInfos(null); 
                return; 
              }
              if (mapType === 'custom' && valueColumn2 && !val2Numeric) { 
                setFileError(`Value Column 2 (Size) ('${valueColumn2}') has non-numeric data. Size breaks cannot be generated.`); 
                setSizeClassBreakInfos(null); 
                return; 
              }
          }
      }
    }
    
    // Normal step progression
    setStep(step + 1); 
    setFileError('');
  };

  /**
   * Enhanced prevStep function that handles backward navigation correctly
   * for both heatmap/dotdensity (2-step) and custom data (3-step) workflows.
   */
  const prevStep = () => { 
    // For heatmap/dotdensity maps on review step (maxSteps), go back to step 1
    if (isHeatmapOrDotDensity && step === maxSteps) {
      setStep(1);
    } else {
      // Normal backward progression for other cases
      setStep(step - 1); 
    }
    setFileError(''); 
  };
  
  const toggleLabelConfig = () => setLabelOptions(prev => ({ ...prev, showLabelConfig: !prev.showLabelConfig }));
  const updateLabelOption = (option, value) => setLabelOptions(prev => ({ ...prev, [option]: value }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create New Map</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" disabled={isSaving}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Enhanced step indicator that adapts to map type */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            {/* Step 1: Map Type - Always shown */}
            <div className={`pb-2 px-4 border-b-2 ${step >= 1 ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}>
              1. Map Type
            </div>
            
            {/* Step 2: Configuration - Only shown for non-heatmap/dot-density maps */}
            {!isHeatmapOrDotDensity && (
              <div className={`pb-2 px-4 border-b-2 ${step >= 2 ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}>
                2. Configuration
              </div>
            )}
            
            {/* Final Step: Review - Step number adapts based on map type */}
            <div className={`pb-2 px-4 border-b-2 ${step >= maxSteps ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}>
              {isHeatmapOrDotDensity ? '2' : '3'}. Review
            </div>
          </div>
          
          {step === 1 && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map Name</label>
                <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Enter map name (or leave blank for auto-title)" disabled={isSaving} />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map Type</label>
                
                {/* Enabled Map Types */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {MAP_TYPE_DEFINITIONS.filter(type => type.enabled).map(type => (
                    <div 
                      key={type.id} 
                      className={`border rounded-lg p-4 transition-colors 
                        ${isSaving 
                          ? 'opacity-50 cursor-not-allowed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50'
                          : mapType === type.id 
                            ? 'cursor-pointer border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                            : 'cursor-pointer border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                        }
                      `}
                      onClick={() => !isSaving && setMapType(type.id)}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{type.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{type.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Disabled Map Types */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MAP_TYPE_DEFINITIONS.filter(type => !type.enabled).map(type => (
                    <div 
                      key={type.id} 
                      className="border rounded-lg p-4 transition-colors border-gray-300 bg-gray-100 dark:bg-gray-800 dark:border-gray-600 opacity-50 cursor-not-allowed"
                    >
                      <div className="font-medium text-gray-400 dark:text-gray-500">{type.name}</div>
                      <div className="text-sm text-gray-400 dark:text-gray-500">{type.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Geography Level</label>
                {(mapType === 'heatmap' || mapType === 'dotdensity') ? (
                  <select 
                    value={selectedAreaType.value} 
                    onChange={(e) => setSelectedAreaType(areaTypes.find(type => type.value === parseInt(e.target.value)) || areaTypes[0])} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                    disabled={isSaving}
                  >
                    {areaTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                ) : ( <p className="text-sm text-gray-500 dark:text-gray-400">Geography level isn't applicable for this map type.</p> )}
              </div>
              {(mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Data File</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <div className="flex text-sm text-gray-600 dark:text-gray-300">
                        <label htmlFor="file-upload" className={`relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={handleFileUpload} ref={fileInputRef} disabled={isSaving} /></label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">CSV, XLSX, or XLS up to 10MB</p>
                    </div>
                  </div>
                  {customData && (<div className="mt-2 text-sm text-green-600 dark:text-green-400">✓ File uploaded successfully ({customData.length} rows) - Breaks will be automatically optimized for {customData.length} data points</div>)}
                </div>
              )}
              {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Visualization Variable</label>
                  <select 
                    value={selectedVisualization} 
                    onChange={(e) => setSelectedVisualization(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                    disabled={isSaving}
                  >
                    <option value="">Select a variable...</option>
                    {Object.entries(categorizedVisualizationOptions).map(([category, options]) => (
                      <optgroup label={category} key={category}>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
              {fileError && (<div className="text-red-500 mt-2 text-sm">{fileError}</div>)}
            </div>
          )}
          {step === 2 && ( <div>
              {(mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && (
                <div> {/* Wrapper for point-data specific config, previews, and data table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div> {/* Left Column for selects */}
                      {(mapType === 'custom' || mapType === 'comps') && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{mapType === 'custom' ? "Value Column 1 (for Color)" : "Value Column (for Color)"}</label>
                          <select value={valueColumn1} onChange={(e) => setValueColumn1(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                            <option value="">Select column...</option>
                            {columns.map((column) => ( <option key={column} value={column}>{column}</option> ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Numeric column to determine point color. Breaks automatically optimized based on data size.</p>
                        </div>
                      )}
                      {mapType === 'custom' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value Column 2 (for Size)</label>
                          <select value={valueColumn2} onChange={(e) => setValueColumn2(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                            <option value="">Select column...</option>
                            {columns.map((column) => ( <option key={column} value={column}>{column}</option> ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Numeric column to determine point size. Breaks automatically optimized based on data size.</p>
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Latitude Column</label>
                        <select value={latitudeColumn} onChange={(e) => setLatitudeColumn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                          <option value="">Select column...</option>
                          {columns.map((column) => (<option key={column} value={column}>{column}</option>))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Numeric latitude values (-90 to 90).</p>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Longitude Column</label>
                        <select value={longitudeColumn} onChange={(e) => setLongitudeColumn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                          <option value="">Select column...</option>
                          {columns.map((column) => (<option key={column} value={column}>{column}</option>))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Numeric longitude values (-180 to 180).</p>
                      </div>
                    </div>
                    <div> {/* Right Column for selects & label options */}
                      {mapType === 'pipeline' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Status Column</label>
                          <select value={statusColumn} onChange={(e) => setStatusColumn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                            <option value="">Select column...</option>
                            {columns.map((column) => (<option key={column} value={column}>{column}</option>))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Shows status for each point.</p>
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Label Column</label>
                        <select value={labelColumn} onChange={(e) => setLabelColumn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                          <option value="">Select column...</option>
                          <option value="none">None (dots/colors only)</option>
                          {columns.map((column) => (<option key={column} value={column}>{column}</option>))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Used for point labels. Select "None" for no labels.</p>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variable 1 (Optional)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={variable1Column} onChange={(e) => setVariable1Column(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}><option value="">Select column...</option>{columns.map((c) => (<option key={c} value={c}>{c}</option>))}</select>
                          <input type="text" value={variable1Text} onChange={(e) => setVariable1Text(e.target.value)} placeholder="Additional text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Displayed as "Column Additional text".</p>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variable 2 (Optional)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={variable2Column} onChange={(e) => setVariable2Column(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}><option value="">Select column...</option>{columns.map((c) => (<option key={c} value={c}>{c}</option>))}</select>
                          <input type="text" value={variable2Text} onChange={(e) => setVariable2Text(e.target.value)} placeholder="Additional text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Displayed after Variable 1.</p>
                      </div>
                      {labelColumn !== 'none' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between cursor-pointer" onClick={toggleLabelConfig}>
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Label Display Options</h3>
                            <svg className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform ${labelOptions.showLabelConfig ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                          {labelOptions.showLabelConfig && (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/60 rounded-md space-y-3">
                              <div className="flex items-center justify-between"><label className="text-sm text-gray-700 dark:text-gray-300">Include Variables</label><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-900 dark:border-gray-600" checked={labelOptions.includeVariables} onChange={(e) => updateLabelOption('includeVariables', e.target.checked)} disabled={isSaving}/></div>
                              <div><label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Font Size: {labelOptions.fontSize}px</label><input type="range" min="8" max="14" value={labelOptions.fontSize} onChange={(e) => updateLabelOption('fontSize', parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600" disabled={isSaving}/></div>
                              <div className="flex items-center justify-between"><label className="text-sm text-gray-700 dark:text-gray-300">Avoid Overlaps</label><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-900 dark:border-gray-600" checked={labelOptions.avoidCollisions} onChange={(e) => updateLabelOption('avoidCollisions', e.target.checked)} disabled={isSaving}/></div>
                              <div className="flex items-center justify-between"><label className="text-sm text-gray-700 dark:text-gray-300">Show All Zooms</label><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-900 dark:border-gray-600" checked={labelOptions.visibleAtAllZooms} onChange={(e) => updateLabelOption('visibleAtAllZooms', e.target.checked)} disabled={isSaving}/></div>
                              <div className="flex items-center justify-between"><label className="text-sm text-gray-700 dark:text-gray-300 font-bold">Bold Text</label><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-900 dark:border-gray-600" checked={labelOptions.bold} onChange={(e) => updateLabelOption('bold', e.target.checked)} disabled={isSaving}/></div>
                              <div className="flex items-center justify-between"><label className="text-sm text-gray-700 dark:text-gray-300">White Background</label><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded dark:bg-gray-900 dark:border-gray-600" checked={labelOptions.whiteBackground} onChange={(e) => updateLabelOption('whiteBackground', e.target.checked)} disabled={isSaving}/></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Label Generator Preview */}
                  <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700/80 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label Generator (Preview)</label>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">{generateFormattedTitle()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: Label (Variable1 Text, Variable2 Text).</p>
                  </div>

                  {/* Legend Previews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {mapType === 'custom' && valueColumn1 && (
                      <div className="p-3 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700/50">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                          Color Legend (Based on '{valueColumn1}') - {colorClassBreakInfos ? `${colorClassBreakInfos.length} optimized breaks` : 'Auto-generating...'}
                        </h4>
                        {colorClassBreakInfos ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {colorClassBreakInfos.map((breakInfo, index) => (
                              <div key={`color-${index}`} className="flex items-center space-x-2">
                                <div 
                                  style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    backgroundColor: formatColorForDisplay(breakInfo.symbol.color),
                                    borderRadius: '50%', 
                                    border: `${breakInfo.symbol.outline.width}px solid ${formatColorForDisplay(breakInfo.symbol.outline.color)}`, 
                                    flexShrink: 0 
                                  }} 
                                />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{breakInfo.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Could not generate color legend. Ensure '{valueColumn1}' has numeric data or try adjusting data.
                          </p>
                        )}
                      </div>
                    )}
                    {mapType === 'custom' && valueColumn2 && (
                      <div className="p-3 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700/50">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Size Legend (Based on '{valueColumn2}') - {sizeClassBreakInfos ? `${sizeClassBreakInfos.length} optimized breaks` : 'Auto-generating...'}</h4>
                        {sizeClassBreakInfos ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {sizeClassBreakInfos.map((breakInfo, index) => (
                              <div key={`size-${index}`} className="flex items-center space-x-2">
                                <div style={{ width: `${breakInfo.size}px`, height: `${breakInfo.size}px`, backgroundColor: '#cccccc', borderRadius: '50%', border: `1px solid #aaaaaa`, flexShrink: 0 }} />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{breakInfo.label} ({breakInfo.size}px)</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-yellow-600 dark:text-yellow-400">Could not generate size legend. Ensure '{valueColumn2}' has numeric data or try adjusting data.</p>}
                      </div>
                    )}
                    {mapType === 'comps' && valueColumn1 && (
                      <div className="p-3 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700/50">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Legend Preview (Based on '{valueColumn1}') - {colorClassBreakInfos ? `${colorClassBreakInfos.length} optimized breaks` : 'Auto-generating...'}</h4>
                        {colorClassBreakInfos ? (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {colorClassBreakInfos.map((breakInfo, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <div 
                                  style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    backgroundColor: formatColorForDisplay(breakInfo.symbol.color),
                                    borderRadius: '50%', 
                                    border: `${breakInfo.symbol.outline.width}px solid ${formatColorForDisplay(breakInfo.symbol.outline.color)}`, 
                                    flexShrink: 0 
                                  }} 
                                />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{breakInfo.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-yellow-600 dark:text-yellow-400">Could not generate legend. Ensure '{valueColumn1}' contains valid numeric data. A single point style will be used.</p>}
                      </div>
                    )}
                  </div>
                  
                  {/* Data Preview Table */}
                  {customData && customData.length > 0 && (latitudeColumn || longitudeColumn) && ( // Show if any loc col selected
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Preview (First 5 Rows)</label>
                      <div className="border rounded-md overflow-x-auto max-h-60">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-100 dark:bg-gray-700/80">
                            <tr>
                              {labelColumn && labelColumn !== 'none' && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Label ({labelColumn})</th>}
                              {variable1Column && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Var1 ({variable1Column})</th>}
                              {variable2Column && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Var2 ({variable2Column})</th>}
                              {valueColumn1 && (mapType === 'custom' || mapType === 'comps') && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Val1 ({valueColumn1})</th>}
                              {valueColumn2 && mapType === 'custom' && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Val2 ({valueColumn2})</th>}
                              {statusColumn && mapType === 'pipeline' && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status ({statusColumn})</th>}
                              {latitudeColumn && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lat ({latitudeColumn})</th>}
                              {longitudeColumn && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lng ({longitudeColumn})</th>}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-600">
                            {customData.slice(0, 5).map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                {labelColumn && labelColumn !== 'none' && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[labelColumn] ?? '')}</td>}
                                {variable1Column && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[variable1Column] ?? '')}</td>}
                                {variable2Column && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[variable2Column] ?? '')}</td>}
                                {valueColumn1 && (mapType === 'custom' || mapType === 'comps') && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[valueColumn1] ?? '')}</td>}
                                {valueColumn2 && mapType === 'custom' && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[valueColumn2] ?? '')}</td>}
                                {statusColumn && mapType === 'pipeline' && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[statusColumn] ?? '')}</td>}
                                {latitudeColumn && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[latitudeColumn] ?? '')}</td>}
                                {longitudeColumn && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{String(row[longitudeColumn] ?? '')}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {customData.length > 5 && (
                          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/80 border-t border-gray-200 dark:border-gray-700">
                            Showing 5 of {customData.length} rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {fileError && (<div className="text-red-500 mt-2 text-sm">{fileError}</div>)}
            </div>)}
          
          {/* Step 3 (or 2 for Heatmap/DotDensity): Review */}
          {step === maxSteps && ( 
            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700/80 dark:border-gray-600 space-y-4">
              <div><h3 className="font-medium text-gray-900 dark:text-white">Map Name:</h3><p className="text-gray-600 dark:text-gray-300">{mapName || generateFormattedTitle()}</p></div>
              <div><h3 className="font-medium text-gray-900 dark:text-white">Map Type:</h3><p className="text-gray-600 dark:text-gray-300">{MAP_TYPE_DEFINITIONS.find(mt => mt.id === mapType)?.name || mapType}</p></div>
              {(mapType === 'heatmap' || mapType === 'dotdensity') ? (
                <>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Geography Level:</h3><p className="text-gray-600 dark:text-gray-300">{selectedAreaType?.label || 'None selected'}</p></div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Visualization Variable:</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {visualizationOptions.find(opt => opt.value === selectedVisualization)?.label || 'None selected'}
                    </p>
                  </div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Break Optimization:</h3><p className="text-gray-600 dark:text-gray-300">Class breaks optimized for {selectedAreaType?.label || 'selected geography'} level</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Configuration:</h3><p className="text-gray-600 dark:text-gray-300">Pre-configured settings applied automatically - no manual configuration required</p></div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">Data & Title</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Data Source: Custom File ({customData?.length || 0} rows)</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Formatted Title: {generateFormattedTitle()}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Break Optimization: {colorClassBreakInfos?.length || 'Auto'} color breaks{sizeClassBreakInfos?.length ? `, ${sizeClassBreakInfos.length} size breaks` : ''}</p>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-2 mb-1">Location</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Lat: {latitudeColumn || <span className="italic text-gray-400">N/A</span>}, Lng: {longitudeColumn || <span className="italic text-gray-400">N/A</span>}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">Data Columns</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Label: {labelColumn === 'none' ? 'None' : labelColumn || <span className="italic text-gray-400">N/A</span>}</p>
                    {mapType === 'custom' && <>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Value (Color): {valueColumn1 || <span className="italic text-gray-400">N/A</span>}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Value (Size): {valueColumn2 || <span className="italic text-gray-400">N/A</span>}</p>
                    </>}
                    {mapType === 'comps' && <p className="text-sm text-gray-600 dark:text-gray-300">Value (Color): {valueColumn1 || <span className="italic text-gray-400">N/A</span>}</p>}
                    {mapType === 'pipeline' && <p className="text-sm text-gray-600 dark:text-gray-300">Status: {statusColumn || <span className="italic text-gray-400">N/A</span>}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-300">Var 1: {variable1Column ? `${variable1Column}${variable1Text ? ' ' + variable1Text : ''}` : <span className="italic text-gray-400">N/A</span>}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Var 2: {variable2Column ? `${variable2Column}${variable2Text ? ' ' + variable2Text : ''}` : <span className="italic text-gray-400">N/A</span>}</p>
                  </div>
                </div>
              )}
              {isSaving && (<div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-blue-700 dark:text-blue-300 font-medium">Saving map configuration...</span></div>)}
            </div>
          )}
        </div>
        
        {/* Enhanced footer navigation that adapts to workflow */}
        <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700/60 flex justify-between rounded-b-lg">
          <button 
            onClick={step > 1 ? prevStep : onCancel} 
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md" 
            disabled={isSaving}
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          
          <button 
            onClick={step < maxSteps ? nextStep : handleCreateMap} 
            className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm flex items-center ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`} 
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating & Saving...
              </>
            ) : (
              step < maxSteps ? 'Next' : 'Create Map'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewMapDialog;