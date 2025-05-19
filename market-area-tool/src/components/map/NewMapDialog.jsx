import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import chroma from 'chroma-js';
import { mapConfigurationsAPI } from '../../services/api'; // Adjust path as necessary
import { 
  initialLayerConfigurations,
  // createClassBreaks as createClassBreaksFromConfig // Only if used for generic fallback
} from './mapConfig'; // Adjust path as necessary

// Helper function to smartly round numbers based on their magnitude
const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  if (Math.abs(value) < 10) return Math.round(value);
  if (Math.abs(value) < 100) return Math.round(value / 10) * 10;
  if (Math.abs(value) < 1000) return Math.round(value / 100) * 100;
  if (Math.abs(value) < 10000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 10000) * 10000;
};

// Helper function to determine break count based on number of areas/data points
// Uses the same logic as PointStyleEditor for consistency
const determineBreakCountByAreas = (areaCount) => {
  if (areaCount <= 10) return 3;
  if (areaCount <= 50) return 4;
  if (areaCount <= 100) return 5;
  if (areaCount <= 500) return 6;
  return 7;
};

// Helper function to get appropriate colors based on break index and total breaks
// Uses the same color palettes as PointStyleEditor for consistency
const getBreakColor = (index, totalBreaks, areaCount) => {
  // Enhanced color palettes based on break count and area density
  const colorPalettes = {
    3: ['#3182ce', '#be56b0', '#e53e3e'],
    4: ['#3182ce', '#8371cc', '#e13b7d', '#e53e3e'],
    5: ['#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'],
    6: ['#2b6cb8', '#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'],
    7: ['#2563eb', '#2b6cb8', '#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e']
  };
  
  const palette = colorPalettes[totalBreaks] || colorPalettes[5];
  return palette[index % palette.length];
};

// Advanced function to generate table-driven class breaks based on data distribution
const generateTableDrivenClassBreaks = (data, valueColumn, baseSymbolStyle = {}, customBreakCount = null) => {
  if (!data || data.length === 0 || !valueColumn) {
    console.log("generateTableDrivenClassBreaks: Missing data or valueColumn.");
    return null;
  }

  // Extract and validate numeric values
  const values = data.map(item => {
    const rawValue = item[valueColumn];
    if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
    const num = Number(rawValue);
    return isNaN(num) ? NaN : num;
  }).filter(val => !isNaN(val));

  if (values.length < 2) {
    console.log(`generateTableDrivenClassBreaks: Not enough valid numeric data in '${valueColumn}'. Found:`, values.length);
    if (values.length === 1) {
      const singleValue = smartRound(values[0]);
      const colors = getBreakColor(1, data.length);
      return [{
        minValue: singleValue,
        maxValue: singleValue,
        label: `${singleValue.toLocaleString()}`,
        symbol: {
          type: "simple-marker",
          style: baseSymbolStyle.style || 'circle',
          color: colors[0],
          size: baseSymbolStyle.size || 10,
          outline: {
            color: baseSymbolStyle.outline?.color || '#FFFFFF',
            width: Number(baseSymbolStyle.outline?.width) || 1
          }
        }
      }];
    }
    return null;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const roundedMin = smartRound(minValue);
  const roundedMax = smartRound(maxValue);

  // Handle case where all values are the same
  if (minValue === maxValue) {
    const colors = getBreakColor(1, data.length);
    return [{
      minValue: roundedMin,
      maxValue: roundedMin,
      label: `${roundedMin.toLocaleString()}`,
      symbol: {
        type: "simple-marker",
        style: baseSymbolStyle.style || 'circle',
        color: colors[0],
        size: baseSymbolStyle.size || 10,
        outline: {
          color: baseSymbolStyle.outline?.color || '#FFFFFF',
          width: Number(baseSymbolStyle.outline?.width) || 1
        }
      }
    }];
  }

  // Determine optimal number of breaks based on data count
  const optimalBreakCount = customBreakCount || determineBreakCountByAreas(data.length);
  const finalBreakCount = Math.max(1, Math.min(optimalBreakCount, values.length));
  
  // Calculate breaks using equal interval method (can be enhanced with other methods)
  const range = maxValue - minValue;
  const interval = range > 0 ? range / finalBreakCount : 0;
  const breaks = [];
  
  for (let i = 0; i < finalBreakCount; i++) {
    const classMinValue = minValue + (i * interval);
    const classMaxValue = (i === finalBreakCount - 1) ? maxValue : (minValue + ((i + 1) * interval));
    const roundedClassMin = smartRound(classMinValue);
    const roundedClassMax = smartRound(classMaxValue);
    
    breaks.push({
      minValue: roundedClassMin,
      maxValue: roundedClassMax,
      label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`,
      symbol: {
        type: "simple-marker",
        style: baseSymbolStyle.style || 'circle',
        color: getBreakColor(i, finalBreakCount, data.length),
        size: baseSymbolStyle.size || 10,
        outline: {
          color: baseSymbolStyle.outline?.color || '#FFFFFF',
          width: Number(baseSymbolStyle.outline?.width) || 1
        }
      }
    });
  }

  // Ensure no overlapping ranges
  for (let i = 0; i < breaks.length - 1; i++) {
    if (breaks[i].maxValue >= breaks[i + 1].minValue) {
      const epsilon = Math.abs(breaks[i + 1].minValue * 0.000001) || 0.000001;
      breaks[i].maxValue = breaks[i + 1].minValue - epsilon;
      breaks[i].label = `${breaks[i].minValue.toLocaleString()} - ${breaks[i].maxValue.toLocaleString()}`;
    }
  }

  // Ensure the last break covers the maximum value exactly
  if (breaks.length > 0) {
    breaks[breaks.length - 1].maxValue = roundedMax;
    breaks[breaks.length - 1].label = `${breaks[breaks.length - 1].minValue.toLocaleString()} - ${roundedMax.toLocaleString()}`;
  }

  console.log("Generated Table-Driven Class Breaks:", breaks);
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

// Updated helper function to generate class breaks for point data (for COLOR) using the new table-driven approach
const generateClassBreaksForPoints = (data, valueColumn, numClasses = null, baseSymbolStyle = {}) => {
  if (!data || data.length === 0 || !valueColumn) {
    console.log("generateClassBreaksForPoints (Color): Missing data or valueColumn.");
    return null;
  }

  // Use the new table-driven approach
  const tableBreaks = generateTableDrivenClassBreaks(data, valueColumn, baseSymbolStyle, numClasses);
  if (tableBreaks) {
    console.log("Generated Color Class Breaks using table-driven approach:", tableBreaks);
    return tableBreaks;
  }

  // Fallback to original logic if table-driven approach fails
  const values = data.map(item => {
      const rawValue = item[valueColumn];
      if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
      const num = Number(rawValue);
      return isNaN(num) ? NaN : num;
    }).filter(val => !isNaN(val));

  if (values.length < 2) {
    console.log(`generateClassBreaksForPoints (Color): Not enough valid numeric data in '${valueColumn}'. Found:`, values.length);
    if (values.length === 1) {
      const singleValue = smartRound(values[0]);
      return [{ 
        minValue: singleValue, 
        maxValue: singleValue, 
        label: `${singleValue.toLocaleString()}`, 
        symbol: { 
          type: "simple-marker", 
          style: baseSymbolStyle.style || 'circle', 
          color: generateColorRamp('#3182CE', '#E53E3E', 1)[0], 
          size: baseSymbolStyle.size || 10, 
          outline: { 
            color: baseSymbolStyle.outline?.color || '#FFFFFF', 
            width: Number(baseSymbolStyle.outline?.width) || 1 
          }
        }
      }];
    }
    return null;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const roundedMin = smartRound(minValue);
  const roundedMax = smartRound(maxValue);
  
  if (minValue === maxValue) {
    return [{ 
      minValue: roundedMin, 
      maxValue: roundedMin, 
      label: `${roundedMin.toLocaleString()}`, 
      symbol: { 
        type: "simple-marker", 
        style: baseSymbolStyle.style || 'circle', 
        color: generateColorRamp('#3182CE', '#E53E3E', 1)[0], 
        size: baseSymbolStyle.size || 10, 
        outline: { 
          color: baseSymbolStyle.outline?.color || '#FFFFFF', 
          width: Number(baseSymbolStyle.outline?.width) || 1 
        }
      }
    }];
  }
  
  // Use intelligent break count determination
  const optimalBreakCount = numClasses || determineBreakCountByAreas(data.length);
  const validNumClasses = Math.max(1, Math.min(optimalBreakCount, values.length));
  const range = maxValue - minValue;
  const interval = range > 0 ? range / validNumClasses : 0;
  const fallbackBreaks = [];
  
  // Generate class breaks using equal interval method
  for (let i = 0; i < validNumClasses; i++) {
    const classMinValue = minValue + (i * interval);
    const classMaxValue = (i === validNumClasses - 1) ? maxValue : (minValue + ((i + 1) * interval));
    const roundedClassMin = smartRound(classMinValue);
    const roundedClassMax = smartRound(classMaxValue);
    
    fallbackBreaks.push({ 
      minValue: roundedClassMin, 
      maxValue: roundedClassMax, 
      label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`, 
      symbol: { 
        type: "simple-marker", 
        style: baseSymbolStyle.style || 'circle', 
        color: getBreakColor(i, validNumClasses, data.length), 
        size: baseSymbolStyle.size || 10, 
        outline: { 
          color: baseSymbolStyle.outline?.color || '#FFFFFF', 
          width: Number(baseSymbolStyle.outline?.width) || 1 
        }
      }
    });
  }
  
  // Ensure no overlapping ranges
  for (let i = 0; i < fallbackBreaks.length - 1; i++) {
    if (fallbackBreaks[i].maxValue >= fallbackBreaks[i + 1].minValue) {
      const epsilon = Math.abs(fallbackBreaks[i + 1].minValue * 0.000001) || 0.000001;
      fallbackBreaks[i].maxValue = fallbackBreaks[i + 1].minValue - epsilon;
      fallbackBreaks[i].label = `${fallbackBreaks[i].minValue.toLocaleString()} - ${fallbackBreaks[i].maxValue.toLocaleString()}`;
    }
  }
  
  // Ensure the last break covers the maximum value exactly
  if (fallbackBreaks.length > 0) {
    fallbackBreaks[fallbackBreaks.length - 1].maxValue = roundedMax;
    fallbackBreaks[fallbackBreaks.length - 1].label = `${fallbackBreaks[fallbackBreaks.length - 1].minValue.toLocaleString()} - ${roundedMax.toLocaleString()}`;
  }
  
  console.log("Generated Color Class Breaks (fallback method):", fallbackBreaks);
  return fallbackBreaks;
};

// Updated helper function to generate class breaks for SIZE using intelligent break count
const generateSizeBreaksForPoints = (data, valueColumn, numClasses = null, minSize = 6, maxSize = 24) => {
  if (!data || data.length === 0 || !valueColumn) return null;
  
  const values = data.map(item => {
    const rawValue = item[valueColumn];
    if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
    const num = Number(rawValue);
    return isNaN(num) ? NaN : num;
  }).filter(val => !isNaN(val));

  if (values.length < 2) {
    if (values.length === 1) {
        const singleValue = smartRound(values[0]);
        return [{ minValue: singleValue, maxValue: singleValue, label: `${singleValue.toLocaleString()}`, size: (minSize + maxSize) / 2 }];
    }
    return null;
  }
  
  const minValue = Math.min(...values), maxValue = Math.max(...values);
  const roundedMin = smartRound(minValue), roundedMax = smartRound(maxValue);
  if (minValue === maxValue) return [{ minValue: roundedMin, maxValue: roundedMin, label: `${roundedMin.toLocaleString()}`, size: (minSize + maxSize) / 2 }];
  
  // Use intelligent break count determination
  const optimalBreakCount = numClasses || determineBreakCountByAreas(data.length);
  const validNumClasses = Math.max(1, Math.min(optimalBreakCount, values.length));
  const valueRange = maxValue - minValue, sizeRange = maxSize - minSize;
  const sizeBreaks = [];
  
  for (let i = 0; i < validNumClasses; i++) {
    const classMinValue = minValue + (i * (valueRange / validNumClasses));
    const classMaxValue = (i === validNumClasses - 1) ? maxValue : (minValue + ((i + 1) * (valueRange / validNumClasses)));
    const roundedClassMin = smartRound(classMinValue), roundedClassMax = smartRound(classMaxValue);
    const proportion = (i + 0.5) / validNumClasses;
    const currentSize = minSize + (proportion * sizeRange);
    sizeBreaks.push({ minValue: roundedClassMin, maxValue: roundedClassMax, label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`, size: Math.round(currentSize) });
  }
  for (let i = 0; i < sizeBreaks.length - 1; i++) {
    if (sizeBreaks[i].maxValue >= sizeBreaks[i+1].minValue) {
      const epsilon = Math.abs(sizeBreaks[i+1].minValue * 0.000001) || 0.000001;
      sizeBreaks[i].maxValue = sizeBreaks[i+1].minValue - epsilon;
      sizeBreaks[i].label = `${sizeBreaks[i].minValue.toLocaleString()} - ${sizeBreaks[i].maxValue.toLocaleString()}`;
    }
  }
  if (sizeBreaks.length > 0) {
    sizeBreaks[sizeBreaks.length - 1].maxValue = roundedMax;
    sizeBreaks[sizeBreaks.length - 1].label = `${sizeBreaks[sizeBreaks.length - 1].minValue.toLocaleString()} - ${roundedMax.toLocaleString()}`;
  }
  console.log("Generated Size Breaks:", sizeBreaks);
  return sizeBreaks;
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

// Generic fallback for heatmap class breaks using intelligent break count
const generateGenericHeatmapClassBreaks = (dataCount = 100) => {
  const breakCount = determineBreakCountByAreas(dataCount);
  return Array.from({ length: breakCount }, (_, index) => ({
    minValue: index * 20,
    maxValue: index === breakCount - 1 ? Infinity : (index + 1) * 20,
    label: index === breakCount - 1 ? `${index * 20} and above` : `${index * 20} - ${(index + 1) * 20}`,
    symbol: { 
      type: "simple-fill", 
      style: "solid", 
      color: getBreakColor(index, breakCount, dataCount),
      outline: { color: [255, 255, 255, 0.5], width: 0.5 }
    }
  }));
};

// Generic fallback for dot density attributes
const generateGenericDotDensityAttributes = (field) => {
  return [{ field: field || "value", color: "#8A2BE2", label: field || "Value" }];
};

// NewMapDialog Component
const NewMapDialog = ({ isOpen, onClose, onCreateMap, visualizationOptions, areaTypes }) => {
  const [step, setStep] = useState(1);
  const [mapName, setMapName] = useState('New Map');
  const [mapType, setMapType] = useState('custom');
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

  // Auto-generate color class breaks when data and value column change
  useEffect(() => {
    if (mapType === 'custom' && customData && valueColumn1) {
      const baseSymbol = { style: 'circle', outline: { color: '#FFFFFF', width: 1 } };
      const breaks = generateClassBreaksForPoints(customData, valueColumn1, null, baseSymbol);
      setColorClassBreakInfos(breaks);
    } else if (mapType !== 'custom' && mapType !== 'comps' && colorClassBreakInfos !== null) {
      setColorClassBreakInfos(null);
    }
  }, [customData, valueColumn1, mapType]);

  // Auto-generate size class breaks when data and size column change
  useEffect(() => {
    if (mapType === 'custom' && customData && valueColumn2) {
      const breaks = generateSizeBreaksForPoints(customData, valueColumn2);
      setSizeClassBreakInfos(breaks);
    } else if (mapType !== 'custom' && sizeClassBreakInfos !== null) {
      setSizeClassBreakInfos(null);
    }
  }, [customData, valueColumn2, mapType]);

  // Auto-generate color class breaks for comps maps
  useEffect(() => {
    if (mapType === 'comps' && customData && valueColumn1) {
      const baseSymbol = { style: 'circle', outline: { color: '#FFFFFF', width: 1 } };
      const breaks = generateClassBreaksForPoints(customData, valueColumn1, null, baseSymbol);
      setColorClassBreakInfos(breaks);
    } else if (mapType !== 'comps' && mapType !== 'custom' && colorClassBreakInfos !== null) {
        // This condition was in the first useEffect, ensuring it's cleared if not custom or comps
        // setColorClassBreakInfos(null); // Already handled by the first useEffect
    }
  }, [customData, valueColumn1, mapType]);

  const filteredOptions = visualizationOptions.filter(option => 
    mapType === 'heatmap' ? option.category === 'Heat Map' : 
    mapType === 'dotdensity' ? option.category === 'Dot Density Map' : 
    true
  );

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
        const headers = Object.keys(jsonData[0]);
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
        let isNumeric = false, checked = 0;
        for (let i = 0; i < data.length && checked < 5; i++) { // Check up to 5 non-null/undefined values
          const value = data[i]?.[field];
          if (value !== null && value !== undefined && value !== '') { 
            isNumeric = typeof value === 'number' && !isNaN(value); 
            checked++; 
            if (!isNumeric) break; 
          }
        }
        if (isNumeric && !potentialLatLon.some(p => field.toLowerCase().includes(p)) && !potentialIds.some(p => field.toLowerCase() === p)) {
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
    setStep(1); setMapName('New Map'); setMapType('custom'); setSelectedVisualization('');
    setSelectedAreaType(areaTypes[0]); setCustomData(null); setColumns([]);
    setLabelColumn(''); setVariable1Column(''); setVariable2Column('');
    setVariable1Text(''); setVariable2Text(''); setValueColumn1(''); setValueColumn2('');
    setStatusColumn(''); setLatitudeColumn(''); setLongitudeColumn(''); setFileError('');
    setColorClassBreakInfos(null); setSizeClassBreakInfos(null);
    setLabelOptions({ includeVariables: true, avoidCollisions: true, visibleAtAllZooms: false, fontSize: 10, bold: false, whiteBackground: false, showLabelConfig: false });
    setIsSaving(false); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateMap = async () => {
    try {
      setIsSaving(true);
      setFileError('');
      
      const formattedTitle = generateFormattedTitle();
      const displayTitle = mapName.trim() || formattedTitle;
      
      const mapData = {
        name: displayTitle,
        type: mapType, // Original user-selected map type e.g., 'heatmap', 'comps'
        // For heatmap/dotdensity, visualizationType holds the specific field ID like "income_HEAT"
        // For other types, it's the same as mapType.
        visualizationType: (mapType === 'heatmap' || mapType === 'dotdensity') ? selectedVisualization : mapType,
      };
    
      const defaultBaseSymbolConfig = { type: "simple-marker", style: 'circle', color: '#CCCCCC', size: 10, outline: { color: '#FFFFFF', width: 1 } };
  
      if (mapType === 'custom') {
        mapData.areaType = { value: 'custom', label: 'Custom Data', url: null };
        // mapData.visualizationType is 'custom' from above
        const layerConfig = {
          title: displayTitle, type: 'custom', rendererType: 'custom-dual-value',
          labelColumn: labelColumn === 'none' ? null : labelColumn, hasNoLabels: labelColumn === 'none', hideAllLabels: labelColumn === 'none',
          variable1Column, variable2Column, variable1Text, variable2Text, latitudeColumn, longitudeColumn,
          labelFormatString: formattedTitle, titleFormat: {},
          valueColumn1, valueColumn2, symbol: defaultBaseSymbolConfig,
          colorClassBreakInfos, value1Format: valueColumn1 ? getValueFormatForColumn(valueColumn1, getSampleValue(valueColumn1)) : null,
          sizeInfos: sizeClassBreakInfos, value2Format: valueColumn2 ? getValueFormatForColumn(valueColumn2, getSampleValue(valueColumn2)) : null,
          customData: { data: customData || [] }, labelOptions,
        };
        mapData.layerConfiguration = layerConfig;

      } else if (mapType === 'comps' || mapType === 'pipeline') {
        mapData.areaType = { value: 'custom', label: 'Custom Data', url: null };
        // mapData.visualizationType is 'comps' or 'pipeline' from above
        const layerConfig = {
          title: displayTitle,
          type: mapType, // "comps" or "pipeline". createLayers will normalize to "comp" or "pipe"
          labelColumn: labelColumn === 'none' ? null : labelColumn,
          hasNoLabels: labelColumn === 'none',
          hideAllLabels: labelColumn === 'none',
          variable1Column, variable2Column, variable1Text, variable2Text,
          latitudeColumn, longitudeColumn,
          labelFormatString: formattedTitle,
          titleFormat: {},
          symbol: {
            ...defaultBaseSymbolConfig,
            color: mapType === 'pipeline' ? '#FFA500' : '#800080',
          },
          customData: { data: customData || [] },
          labelOptions: labelOptions,
        };
        if (mapType === 'comps') {
          layerConfig.valueColumn = valueColumn1;
          if (valueColumn1 && colorClassBreakInfos) {
            layerConfig.classBreakInfos = colorClassBreakInfos;
            layerConfig.rendererType = 'classBreaks';
            layerConfig.valueFormat = getValueFormatForColumn(valueColumn1, getSampleValue(valueColumn1));
          } else {
            layerConfig.rendererType = 'simple';
          }
        } else if (mapType === 'pipeline') {
          layerConfig.statusColumn = statusColumn;
          layerConfig.rendererType = 'uniqueValue';
        }
        mapData.layerConfiguration = layerConfig;

      } else { // Heatmap or Dot Density
        mapData.areaType = selectedAreaType;
        // mapData.visualizationType is selectedVisualization (e.g., "income_HEAT")
        
        const areaTypeString = convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract');
        let specificConfig = getInitialConfigForVisualization(selectedVisualization);
        let finalField, finalClassBreaks, finalDotAttributes, finalDotValue;

        if (specificConfig) {
            // console.log(`[NewMapDialog] Found specific config for ${selectedVisualization}:`, specificConfig);
            finalField = specificConfig.field;
            if (mapType === 'heatmap') {
                finalClassBreaks = specificConfig.classBreakInfos;
            } else { // dotdensity
                finalDotAttributes = specificConfig.attributes || generateGenericDotDensityAttributes(finalField);
                finalDotValue = specificConfig.dotValue || 100;
            }
        } else {
            console.warn(`[NewMapDialog] No specific config for ${selectedVisualization}. Using generic.`);
            finalField = selectedVisualization; // Fallback
            if (mapType === 'heatmap') {
                // Use intelligent break count for generic heatmap
                finalClassBreaks = generateGenericHeatmapClassBreaks(100); // Assume 100 areas if no data available
            } else { // dotdensity
                finalDotAttributes = generateGenericDotDensityAttributes(finalField);
                finalDotValue = 100;
            }
        }
        
        const layerConfig = {
          title: displayTitle,
          type: mapType === 'heatmap' ? 'class-breaks' : 'dot-density', // For createRenderer
          visualizationType: selectedVisualization, // The ID for selection (e.g. "income_HEAT")
          areaType: areaTypeString,
          rendererType: mapType === 'heatmap' ? 'class-breaks' : 'dot-density',
          field: finalField,
          classBreakInfos: mapType === 'heatmap' ? finalClassBreaks : undefined,
          attributes: mapType === 'dotdensity' ? finalDotAttributes : undefined,
          dotValue: mapType === 'dotdensity' ? finalDotValue : undefined,
          opacity: 0.8, visible: true,
          legendInfo: { label: displayTitle, type: mapType },
          isStatisticalVisualization: true, mapType: mapType,
          valueFormat: getValueFormatForColumn(finalField, undefined), // Provide a generic format or infer
          visualizationStyle: mapType, 
        };
        if (mapType === 'dotdensity') {
          layerConfig.backgroundFillSymbol = { type: "simple-fill", style: "none", outline: { color: [128,128,128,0.3], width: 0.5 }};
        }
        mapData.layerConfiguration = layerConfig;
      }
  
      // console.log("[NewMapDialog handleCreateMap] MapData prepared for save and creation:", JSON.stringify(mapData, (k,v) => (k === 'data' || (k === 'customData' && v?.data)) ? `[${(v.data || v).length} items]` : v, 2));
      const saveResult = await saveMapConfiguration(mapData);
      if (saveResult.success) {
        // console.log("[NewMapDialog] Map config saved successfully:", saveResult);
        if (saveResult.configId) {
          mapData.configId = saveResult.configId;
          if (mapData.layerConfiguration) mapData.layerConfiguration.configId = saveResult.configId;
        }
      } else console.warn("[NewMapDialog] Map config save failed, proceeding with map creation:", saveResult);
      
      onCreateMap(mapData);
      resetForm();
      onClose();
    } catch (error) {
      console.error("[NewMapDialog] Error during map creation and save:", error);
      setFileError(`Map creation failed: ${error.message}`);
      try {
        // Fallback map creation logic
        const formattedTitle = generateFormattedTitle();
        const displayTitle = mapName.trim() || formattedTitle;
        const fallbackMapData = { 
            name: displayTitle, 
            type: mapType, 
            visualizationType: (mapType === 'heatmap' || mapType === 'dotdensity') ? selectedVisualization : mapType,
        };
        if (mapType === 'custom' || mapType === 'comps' || mapType === 'pipeline') {
            fallbackMapData.areaType = { value: 'custom', label: 'Custom Data', url: null };
            fallbackMapData.layerConfiguration = {
                title: displayTitle, type: mapType,
                rendererType: mapType === 'comps' ? (valueColumn1 ? 'classBreaks' : 'simple') : (mapType === 'pipeline' ? 'uniqueValue' : 'simple'),
                customData: { data: customData || [] },
                labelColumn, latitudeColumn, longitudeColumn, valueColumn1, statusColumn,
                symbol: defaultBaseSymbolConfig,
                classBreakInfos: mapType === 'comps' && valueColumn1 ? colorClassBreakInfos : undefined, // Basic fallback
            };
        } else { // heatmap or dotdensity
            fallbackMapData.areaType = selectedAreaType;
            const areaTypeString = convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract');
            fallbackMapData.layerConfiguration = {
                title: displayTitle,
                type: mapType === 'heatmap' ? 'class-breaks' : 'dot-density',
                visualizationType: selectedVisualization, areaType: areaTypeString,
                rendererType: mapType === 'heatmap' ? 'class-breaks' : 'dot-density',
                field: selectedVisualization,
                classBreakInfos: mapType === 'heatmap' ? generateGenericHeatmapClassBreaks(100) : undefined,
                attributes: mapType === 'dotdensity' ? generateGenericDotDensityAttributes(selectedVisualization) : undefined,
                dotValue: mapType === 'dotdensity' ? 100 : undefined,
                opacity: 0.8, visible: true,
            };
        }
        console.log("[NewMapDialog] Creating map with fallback configuration due to error...");
        onCreateMap(fallbackMapData);
        resetForm(); onClose();
      } catch (fbError) { console.error("[NewMapDialog] Fallback map creation also failed:", fbError); }
    } finally {
      setIsSaving(false);
    }
  };

  const onCancel = () => { resetForm(); onClose(); };

  const nextStep = () => {
    if (step === 1) {
      if ((mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && !customData) { setFileError('Please upload a data file.'); return; }
      if ((mapType === 'heatmap' || mapType === 'dotdensity') && !selectedVisualization) { setFileError('Please select a visualization variable.'); return; }
    }
    if (step === 2) {
      if (mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') {
          if (!labelColumn && labelColumn !== 'none') { setFileError('Please select a Label column or "None".'); return; }
          if (!latitudeColumn || !longitudeColumn) { setFileError('Please select Latitude and Longitude columns.'); return; }
          if (customData && customData.length > 0) {
              let latValid = false, lonValid = false, val1Numeric = true, val2Numeric = true, checked = 0;
              for(let i = 0; i < customData.length && checked < 5; i++) {
                  const row = customData[i];
                  if (row) {
                      if (latitudeColumn && !isNaN(Number(row[latitudeColumn]))) latValid = true;
                      if (longitudeColumn && !isNaN(Number(row[longitudeColumn]))) lonValid = true;
                      
                      if (mapType === 'custom' && valueColumn1 && row[valueColumn1] !== null && row[valueColumn1] !== undefined && row[valueColumn1] !== '' && isNaN(Number(row[valueColumn1]))) val1Numeric = false;
                      if (mapType === 'custom' && valueColumn2 && row[valueColumn2] !== null && row[valueColumn2] !== undefined && row[valueColumn2] !== '' && isNaN(Number(row[valueColumn2]))) val2Numeric = false;
                      if (mapType === 'comps' && valueColumn1 && row[valueColumn1] !== null && row[valueColumn1] !== undefined && row[valueColumn1] !== '' && isNaN(Number(row[valueColumn1]))) val1Numeric = false;
                      checked++;
                  }
              }
              if (!latValid && latitudeColumn) { setFileError(`Latitude column ('${latitudeColumn}') has non-numeric or missing data in first 5 rows.`); return; }
              if (!lonValid && longitudeColumn) { setFileError(`Longitude column ('${longitudeColumn}') has non-numeric or missing data in first 5 rows.`); return; }
              if (!val1Numeric && (mapType === 'custom' || mapType === 'comps') && valueColumn1) { setFileError(`Value Column 1 (Color) ('${valueColumn1}') has non-numeric data.`); setColorClassBreakInfos(null); return; } // Added return
              if (mapType === 'custom' && !val2Numeric && valueColumn2) { setFileError(`Value Column 2 (Size) ('${valueColumn2}') has non-numeric data.`); setSizeClassBreakInfos(null); return; } // Added return
          }
      }
    }
    setStep(step + 1); setFileError('');
  };

  const prevStep = () => { setStep(step - 1); setFileError(''); };
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
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            {[1, 2, 3].map(s => (
              <div key={s} className={`pb-2 px-4 border-b-2 ${step >= s ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}>
                {s}. {s === 1 ? 'Map Type' : s === 2 ? 'Configuration' : 'Review'}
              </div>
            ))}
          </div>
          {step === 1 && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map Name</label>
                <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Enter map name (or leave blank for auto-title)" disabled={isSaving} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map Type</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[ {id: 'comps', name: 'Comps Map', desc: 'Comparable property data (value based color).'},
                    {id: 'pipeline', name: 'Pipeline Map', desc: 'Status-based property data.'},
                    {id: 'heatmap', name: 'Heat Map', desc: 'Color-coded gradient data.'} ].map(type => (
                    <div key={type.id} className={`border rounded-lg p-4 cursor-pointer transition-colors ${mapType === type.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isSaving && setMapType(type.id)}>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{type.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[ {id: 'dotdensity', name: 'Dot Density', desc: 'Points representing data quantity.'},
                    {id: 'custom', name: 'Custom Points Map', desc: 'Points with color by Value1, size by Value2.'} ].map(type => (
                    <div key={type.id} className={`border rounded-lg p-4 cursor-pointer transition-colors ${mapType === type.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => !isSaving && setMapType(type.id)}>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{type.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Geography Level</label>
                {(mapType === 'heatmap' || mapType === 'dotdensity') ? (
                  <select value={selectedAreaType.value} onChange={(e) => setSelectedAreaType(areaTypes.find(type => type.value === parseInt(e.target.value)) || areaTypes[0])} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                    {areaTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                ) : ( <p className="text-sm text-gray-500 dark:text-gray-400">Geography level isn't applicable for point data maps.</p> )}
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
                  <select value={selectedVisualization} onChange={(e) => setSelectedVisualization(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" disabled={isSaving}>
                    <option value="">Select a variable...</option>
                    {filteredOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
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
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Color Legend (Based on '{valueColumn1}') - {colorClassBreakInfos ? `${colorClassBreakInfos.length} optimized breaks` : 'Auto-generating...'}</h4>
                        {colorClassBreakInfos ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {colorClassBreakInfos.map((breakInfo, index) => (
                              <div key={`color-${index}`} className="flex items-center space-x-2">
                                <div style={{ width: '12px', height: '12px', backgroundColor: breakInfo.symbol.color, borderRadius: '50%', border: `${breakInfo.symbol.outline.width}px solid ${breakInfo.symbol.outline.color}`, flexShrink: 0 }} />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{breakInfo.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-yellow-600 dark:text-yellow-400">Could not generate color legend. Ensure '{valueColumn1}' has numeric data or try adjusting data.</p>}
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
                                <div style={{ width: '12px', height: '12px', backgroundColor: breakInfo.symbol.color, borderRadius: '50%', border: `${breakInfo.symbol.outline.width}px solid ${breakInfo.symbol.outline.color}`, flexShrink: 0 }} />
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
              {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700/80 dark:border-gray-600 space-y-2">
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Selected Visualization:</h3><p className="text-gray-600 dark:text-gray-300">{filteredOptions.find(opt => opt.value === selectedVisualization)?.label || 'None selected'}</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Geography Level:</h3><p className="text-gray-600 dark:text-gray-300">{selectedAreaType?.label || 'None selected'}</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Map Type:</h3><p className="text-gray-600 dark:text-gray-300">{mapType === 'heatmap' ? 'Heat Map' : 'Dot Density'}</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Break Optimization:</h3><p className="text-gray-600 dark:text-gray-300">Breaks will be intelligently optimized based on data distribution and geography level</p></div>
                </div>
              )}
              {fileError && (<div className="text-red-500 mt-2 text-sm">{fileError}</div>)}
            </div>)}
          {step === 3 && ( 
            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700/80 dark:border-gray-600 space-y-4">
              <div><h3 className="font-medium text-gray-900 dark:text-white">Map Name:</h3><p className="text-gray-600 dark:text-gray-300">{mapName || generateFormattedTitle()}</p></div>
              <div><h3 className="font-medium text-gray-900 dark:text-white">Map Type:</h3><p className="text-gray-600 dark:text-gray-300">{mapType.charAt(0).toUpperCase() + mapType.slice(1).replace(/([A-Z])/g, ' $1')} Map</p></div>
              {(mapType === 'heatmap' || mapType === 'dotdensity') ? (
                <>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Geography Level:</h3><p className="text-gray-600 dark:text-gray-300">{selectedAreaType?.label || 'None selected'}</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Visualization Variable:</h3><p className="text-gray-600 dark:text-gray-300">{filteredOptions.find(opt => opt.value === selectedVisualization)?.label || 'None selected'}</p></div>
                  <div><h3 className="font-medium text-gray-900 dark:text-white">Break Optimization:</h3><p className="text-gray-600 dark:text-gray-300">Class breaks optimized for {selectedAreaType?.label || 'selected geography'} level</p></div>
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
        <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700/60 flex justify-between rounded-b-lg">
          <button onClick={step > 1 ? prevStep : onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md" disabled={isSaving}>{step > 1 ? 'Back' : 'Cancel'}</button>
          <button onClick={step < 3 ? nextStep : handleCreateMap} className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm flex items-center ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`} disabled={isSaving}>
            {isSaving ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Creating & Saving...</>) : (step < 3 ? 'Next' : 'Create Map')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewMapDialog;