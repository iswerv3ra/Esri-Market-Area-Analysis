'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { mapConfigurationsAPI } from '../../services/api';

// Helper to safely get nested properties with defaults
const getConfigProp = (config, path, defaultValue) => {
  const keys = path.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null) return defaultValue;
    current = current[key];
  }
  return current !== undefined && current !== null ? current : defaultValue;
};

// Helper to smartly round numbers based on their magnitude
const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  
  if (Math.abs(value) < 10) {
    return Math.round(value);
  } else if (Math.abs(value) < 100) {
    return Math.round(value / 10) * 10;
  } else if (Math.abs(value) < 1000) {
    return Math.round(value / 100) * 100;
  } else if (Math.abs(value) < 10000) {
    return Math.round(value / 1000) * 1000;
  } else {
    return Math.round(value / 10000) * 10000;
  }
};

// Enhanced helper function to convert area type to string with better validation
const convertAreaTypeToString = (value) => {
  console.log('[PointStyleEditor] Converting area type:', { value, type: typeof value });
  
  // Handle null/undefined
  if (value === null || value === undefined) {
    console.log('[PointStyleEditor] Area type is null/undefined, defaulting to tract');
    return 'tract';
  }
  
  // Handle array (incorrect format)
  if (Array.isArray(value)) {
    console.warn('[PointStyleEditor] Area type received as array:', value);
    // If array has elements, use the first one, otherwise default
    if (value.length > 0) {
      return convertAreaTypeToString(value[0]);
    }
    return 'tract';
  }
  
  // Handle object with value property
  if (typeof value === 'object' && value.value !== undefined) {
    console.log('[PointStyleEditor] Area type is object with value property:', value.value);
    return convertAreaTypeToString(value.value);
  }
  
  // Handle string (already correct format)
  if (typeof value === 'string') {
    console.log('[PointStyleEditor] Area type is already string:', value);
    // Validate known area types
    const validAreaTypes = ['tract', 'county', 'block_group', 'msa', 'state'];
    if (validAreaTypes.includes(value)) {
      return value;
    }
    // If not a known type, default to tract
    console.warn('[PointStyleEditor] Unknown area type string:', value, 'defaulting to tract');
    return 'tract';
  }
  
  // Handle numeric (legacy format)
  if (typeof value === 'number') {
    console.log('[PointStyleEditor] Area type is numeric:', value);
    switch (value) {
      case 11: return 'county';
      case 12: return 'tract';
      case 150: return 'block_group';
      default: 
        console.warn('[PointStyleEditor] Unknown numeric area type:', value, 'defaulting to tract');
        return 'tract';
    }
  }
  
  // Fallback for any other type
  console.warn('[PointStyleEditor] Unexpected area type format:', value, typeof value, 'defaulting to tract');
  return 'tract';
};

// Helper function to get project ID from multiple sources with validation
const getProjectId = () => {
  const routeProjectId = new URLSearchParams(window.location.search).get('projectId');
  const localStorageProjectId = localStorage.getItem("currentProjectId");
  const sessionStorageProjectId = sessionStorage.getItem("currentProjectId");
  
  const projectId = routeProjectId || localStorageProjectId || sessionStorageProjectId;
  
  console.log('[PointStyleEditor] Project ID sources:', {
    route: routeProjectId,
    localStorage: localStorageProjectId,
    sessionStorage: sessionStorageProjectId,
    final: projectId
  });
  
  return projectId;
};

// Helper function to clean undefined values from object
const cleanObject = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      // Special handling for empty strings and arrays
      if (obj[key] === '' || (Array.isArray(obj[key]) && obj[key].length === 0)) {
        // Skip empty strings and arrays
        return;
      }
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

// Helper function to validate configuration before sending to API
const validateConfigurationData = (configData) => {
  const errors = [];
  
  // Required fields validation
  if (!configData.project_id) {
    errors.push('Project ID is required');
  }
  
  if (!configData.tab_name || configData.tab_name.trim() === '') {
    errors.push('Tab name is required');
  }
  
  if (!configData.visualization_type) {
    errors.push('Visualization type is required');
  }
  
  // Area type validation
  if (!configData.area_type || typeof configData.area_type !== 'string') {
    errors.push(`Area type must be a valid string, received: ${JSON.stringify(configData.area_type)}`);
  }
  
  // Layer configuration validation
  if (configData.layer_configuration) {
    if (typeof configData.layer_configuration !== 'string') {
      errors.push('Layer configuration must be a serialized JSON string');
    } else {
      try {
        JSON.parse(configData.layer_configuration);
      } catch (e) {
        errors.push('Layer configuration is not valid JSON');
      }
    }
  }
  
  return errors;
};

const PointStyleEditor = ({ config, onChange, onPreview, onClose, mapType = 'comps' }) => {
  if (!config) {
    console.warn("PointStyleEditor received null config.");
    return <div className="p-4 text-gray-500 dark:text-gray-400">Loading configuration...</div>;
  }

  // Default properties based on mapType
  const getTypeDefaults = () => {
    switch(mapType) {
      case 'pipe':
        return {
          symbol: { type: 'simple-marker', style: 'circle', color: '#4CAF50', size: 8, outline: { color: '#FFFFFF', width: 1 } },
          legend: { label: 'Pipeline Property' },
          valueColumn: 'Status'
        };
      case 'comps':
      default:
        return {
          symbol: { type: 'simple-marker', style: 'circle', color: '#800080', size: 10, outline: { color: '#FFFFFF', width: 1 } },
          legend: { label: 'Comparison Property' },
          valueColumn: 'AvgBasePSF'
        };
    }
  };
  
  const typeDefaults = getTypeDefaults();
  const defaultSymbolProps = typeDefaults.symbol;
  const defaultLegendProps = typeDefaults.legend;

  // Default class breaks template
  const defaultClassBreaks = [
    { minValue: 2, maxValue: 3, label: "2 - 3", symbol: { type: "simple-marker", style: "circle", color: "#3182ce", size: 10, outline: { color: "#FFFFFF", width: 1 } } },
    { minValue: 3, maxValue: 4, label: "3 - 4", symbol: { type: "simple-marker", style: "circle", color: "#8371cc", size: 10, outline: { color: "#FFFFFF", width: 1 } } },
    { minValue: 4, maxValue: 5, label: "4 - 5", symbol: { type: "simple-marker", style: "circle", color: "#be56b0", size: 10, outline: { color: "#FFFFFF", width: 1 } } },
    { minValue: 5, maxValue: 6, label: "5 - 6", symbol: { type: "simple-marker", style: "circle", color: "#e13b7d", size: 10, outline: { color: "#FFFFFF", width: 1 } } },
    { minValue: 6, maxValue: 7, label: "6 - 7", symbol: { type: "simple-marker", style: "circle", color: "#e53e3e", size: 10, outline: { color: "#FFFFFF", width: 1 } } }
  ];

  // Get current values safely with defaults
  const currentSymbol = config?.symbol ?? defaultSymbolProps;
  const currentLegendInfo = config?.legendInfo ?? defaultLegendProps;
  const currentClassBreaks = config?.classBreakInfos || [];
  const renderType = config?.rendererType || (currentClassBreaks.length > 0 ? 'classBreaks' : 'simple');

  // State variables
  const [workingConfig, setWorkingConfig] = useState(JSON.parse(JSON.stringify(config)));
  const [classBreaks, setClassBreaks] = useState(currentClassBreaks.length > 0 ? currentClassBreaks : []);
  const [useClassBreaks, setUseClassBreaks] = useState(renderType === 'classBreaks');
  const [valueColumn, setValueColumn] = useState(config?.valueColumn || 'AvgBasePSF');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig] = useState(JSON.parse(JSON.stringify(config)));
  
  // Working values derived from state
  const workingSymbol = workingConfig?.symbol ?? defaultSymbolProps;
  const workingLegendInfo = workingConfig?.legendInfo ?? defaultLegendProps;
  const workingSize = workingSymbol.size ?? defaultSymbolProps.size;
  const workingColor = workingSymbol.color ?? defaultSymbolProps.color;
  const workingOutline = workingSymbol.outline ?? {};
  const workingOutlineWidth = workingOutline.width ?? defaultSymbolProps.outline.width;
  const workingOutlineColor = workingOutline.color ?? defaultSymbolProps.outline.color;
  const workingLegendLabel = workingLegendInfo.label ?? defaultLegendProps.label;

  // Extract available numeric columns from custom data
  useEffect(() => {
    if (config?.customData?.data && config.customData.data.length > 0) {
      const firstItem = config.customData.data[0];
      const columns = Object.keys(firstItem);
      setAvailableColumns(columns.filter(col => typeof firstItem[col] === 'number'));
    }
  }, [config]);

  // Update local state when config changes
  useEffect(() => {
    setWorkingConfig(JSON.parse(JSON.stringify(config)));
    setClassBreaks(config?.classBreakInfos?.length > 0 ? [...config.classBreakInfos] : []);
    setUseClassBreaks(config?.rendererType === 'classBreaks' || (config?.classBreakInfos?.length > 0));
    setValueColumn(config?.valueColumn || 'AvgBasePSF');
    setHasUnsavedChanges(false);
  }, [config]);

  /**
   * Saves configuration to localStorage as fallback option
   * Maintains backward compatibility and provides offline persistence
   */
  const savePointStyleConfigurationToLocalStorage = async () => {
    const MANUAL_SAVE_KEY = "mapConfigurations_default";
    
    try {
      console.log("[PointStyleEditor] Starting localStorage save");
      
      // Get existing configurations from localStorage
      let existingConfigs = [];
      try {
        const saved = localStorage.getItem(MANUAL_SAVE_KEY);
        if (saved) {
          existingConfigs = JSON.parse(saved);
        }
      } catch (parseError) {
        console.warn("Could not parse existing localStorage configurations:", parseError);
        existingConfigs = [];
      }
      
      // Prepare configuration for localStorage with proper area type handling
      const configToSave = {
        tab_name: workingConfig.title || `${mapType} Map`,
        visualization_type: mapType,
        area_type: convertAreaTypeToString(workingConfig.areaType?.value || workingConfig.areaType || 'tract'),
        layer_configuration: workingConfig,
        order: existingConfigs.length,
        created_at: new Date().toISOString()
      };
      
      console.log("[PointStyleEditor] LocalStorage config prepared:", {
        tab_name: configToSave.tab_name,
        visualization_type: configToSave.visualization_type,
        area_type: configToSave.area_type,
        area_type_type: typeof configToSave.area_type
      });
      
      // Find existing configuration to update or add new one
      const existingIndex = existingConfigs.findIndex(savedConfig =>
        (savedConfig.layer_configuration?.type === workingConfig.type) ||
        (savedConfig.layer_configuration?.title === workingConfig.title) ||
        (savedConfig.visualization_type === mapType && savedConfig.tab_name === workingConfig.title)
      );
      
      if (existingIndex >= 0) {
        // Update existing configuration
        existingConfigs[existingIndex] = {
          ...existingConfigs[existingIndex],
          ...configToSave,
          updated_at: new Date().toISOString()
        };
        console.log("[PointStyleEditor] Updated localStorage config at index:", existingIndex);
      } else {
        // Add new configuration
        existingConfigs.push(configToSave);
        console.log("[PointStyleEditor] Added new localStorage config");
      }
      
      // Save back to localStorage
      localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(existingConfigs));
      
      console.log("[PointStyleEditor] LocalStorage save completed successfully");
      return { success: true, count: existingConfigs.length, type: 'localStorage' };
      
    } catch (error) {
      console.error("[PointStyleEditor] LocalStorage save failed:", error);
      throw new Error(`LocalStorage save failed: ${error.message}`);
    }
  };

  /**
   * Saves configuration to the database with robust error handling and validation
   * Uses the same successful pattern as the Map component
   */
  const savePointStyleConfigurationToDatabase = async () => {
    const projectId = getProjectId();
    
    if (!projectId) {
      throw new Error("No project ID available for saving configuration. Please ensure you are logged in and have selected a project.");
    }

    console.log("[PointStyleEditor] Starting database save for project:", projectId);

    try {
      // Get all existing configurations for this project
      const existingConfigsResponse = await mapConfigurationsAPI.getAll(projectId);
      const existingConfigs = existingConfigsResponse?.data || [];
      
      console.log("[PointStyleEditor] Found existing configurations:", existingConfigs.length);
      
      // Find configuration to update/replace using multiple strategies
      let targetConfig = null;
      
      // Strategy 1: Match by configId (most reliable)
      if (workingConfig.configId) {
        targetConfig = existingConfigs.find(config => config.id === workingConfig.configId);
        if (targetConfig) {
          console.log("[PointStyleEditor] Found config by configId:", workingConfig.configId);
        }
      }
      
      // Strategy 2: Match by tab name and visualization type
      if (!targetConfig) {
        targetConfig = existingConfigs.find(config => 
          config.tab_name === workingConfig.title && 
          config.visualization_type === mapType
        );
        if (targetConfig) {
          console.log("[PointStyleEditor] Found config by title and type:", targetConfig.id);
        }
      }
      
      // Strategy 3: Match by visualization type only (for single configs of this type)
      if (!targetConfig) {
        const sameTypeConfigs = existingConfigs.filter(config => 
          config.visualization_type === mapType
        );
        if (sameTypeConfigs.length === 1) {
          targetConfig = sameTypeConfigs[0];
          console.log("[PointStyleEditor] Found config by unique type match:", targetConfig.id);
        }
      }
      
      // If we found an existing configuration, delete it first
      // This avoids the complex field validation issues with updates
      if (targetConfig && targetConfig.id) {
        console.log("[PointStyleEditor] Deleting existing config:", targetConfig.id);
        try {
          await mapConfigurationsAPI.delete(targetConfig.id);
          console.log("[PointStyleEditor] Successfully deleted existing config");
        } catch (deleteError) {
          console.warn("[PointStyleEditor] Failed to delete existing config, continuing with create:", deleteError.message);
          // Continue with creation even if deletion fails
        }
      }
      
      // FIXED: Use the same pattern as the working Map component
      // Prepare configuration data exactly like the Map component does
      const configData = {
        project_id: projectId,        // Include both project_id and project fields
        project: projectId,           // Backend might expect either/both
        tab_name: workingConfig.title || `${mapType} Map`,
        visualization_type: mapType,
        area_type: convertAreaTypeToString(workingConfig.areaType?.value || workingConfig.areaType || 'tract'),
        layer_configuration: workingConfig,
        order: targetConfig?.order ?? existingConfigs.length
      };
      
      console.log("[PointStyleEditor] Configuration data prepared:", {
        project_id: configData.project_id,
        project: configData.project,
        tab_name: configData.tab_name,
        visualization_type: configData.visualization_type,
        area_type: configData.area_type,
        area_type_type: typeof configData.area_type,
        has_layer_configuration: !!configData.layer_configuration,
        renderer_type: configData.layer_configuration?.rendererType
      });
      
      // Clean the configuration data to remove undefined values (but preserve projectId fields)
      const cleanedConfigData = cleanObject(configData);
      
      // CRITICAL: Ensure project fields are not accidentally removed
      if (!cleanedConfigData.project_id && projectId) {
        cleanedConfigData.project_id = projectId;
      }
      if (!cleanedConfigData.project && projectId) {
        cleanedConfigData.project = projectId;
      }
      
      // Validate the configuration before sending
      const validationErrors = validateConfigurationData({
        ...cleanedConfigData,
        layer_configuration: JSON.stringify(cleanedConfigData.layer_configuration)
      });
      
      if (validationErrors.length > 0) {
        throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
      }
      
      console.log("[PointStyleEditor] Creating new config with validated data");
      
      // FIXED: Use the same API call pattern as the Map component
      // The Map component does: mapConfigurationsAPI.create(projectId, { ...config, project: projectId })
      const createResponse = await mapConfigurationsAPI.create(
        projectId, 
        { ...cleanedConfigData, project: projectId }  // Ensure project field is present, matching Map component
      );
      
      if (createResponse.data && createResponse.data.id) {
        console.log("[PointStyleEditor] Database save successful:", {
          configId: createResponse.data.id,
          status: createResponse.status
        });
        
        // Update working config with the new database ID
        workingConfig.configId = createResponse.data.id;
        
        return {
          success: true,
          type: targetConfig ? 'recreate' : 'create',
          configId: createResponse.data.id,
          action: targetConfig ? 'updated' : 'created'
        };
      } else {
        throw new Error("Database API returned no configuration ID");
      }
      
    } catch (apiError) {
      console.error("[PointStyleEditor] Database API error:", apiError);
      
      // Enhanced error logging for debugging
      if (apiError.response) {
        console.error("[PointStyleEditor] API Error Details:", {
          status: apiError.response.status,
          statusText: apiError.response.statusText,
          data: apiError.response.data,
          url: apiError.config?.url,
          method: apiError.config?.method
        });
        
        // Check for specific validation errors
        if (apiError.response.status === 400) {
          const validationData = apiError.response.data;
          let errorMessage = "Database validation failed: ";
          
          if (validationData.area_type) {
            errorMessage += `Area type error: ${JSON.stringify(validationData.area_type)}. `;
          }
          if (validationData.project_id || validationData.project) {
            errorMessage += `Project ID error: ${JSON.stringify(validationData.project_id || validationData.project)}. `;
          }
          if (validationData.layer_configuration) {
            errorMessage += `Layer configuration error: ${JSON.stringify(validationData.layer_configuration)}. `;
          }
          if (validationData.detail) {
            errorMessage += `${validationData.detail}. `;
          }
          
          throw new Error(errorMessage || `Validation error: ${JSON.stringify(validationData)}`);
        }
      }
      
      throw new Error(`Database save failed: ${apiError.message}`);
    }
  };  

  /**
   * Primary save function that attempts database save with localStorage fallback
   * Provides comprehensive error handling and user feedback
   */
  const savePointStyleConfiguration = async () => {
    try {
      // Attempt database save first
      const databaseResult = await savePointStyleConfigurationToDatabase();
      
      if (databaseResult.success) {
        // Also save to localStorage as a backup
        try {
          await savePointStyleConfigurationToLocalStorage();
          console.log("[PointStyleEditor] Backup localStorage save completed");
        } catch (localStorageError) {
          console.warn("[PointStyleEditor] Backup localStorage save failed:", localStorageError);
          // Don't fail the entire operation if backup fails
        }
        
        return databaseResult;
      }
    } catch (databaseError) {
      console.error("[PointStyleEditor] Database save failed, attempting localStorage fallback:", databaseError);
      
      // Fallback to localStorage save
      try {
        const localStorageResult = await savePointStyleConfigurationToLocalStorage();
        console.log("[PointStyleEditor] LocalStorage fallback save successful");
        
        return {
          success: true,
          type: 'localStorage',
          message: 'Saved to local storage (database unavailable)',
          fallbackReason: databaseError.message
        };
      } catch (localStorageError) {
        console.error("[PointStyleEditor] Both database and localStorage saves failed");
        throw new Error(
          `Database save failed: ${databaseError.message}. ` + 
          `LocalStorage fallback also failed: ${localStorageError.message}`
        );
      }
    }
  };

  /**
   * Handles configuration property changes with deep cloning for safety
   * Maintains immutability and triggers change detection
   */
  const handleConfigChange = (propPath, value) => {
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));

    // Initialize nested objects as needed
    if (propPath.startsWith('symbol.') && !updatedConfig.symbol) {
      updatedConfig.symbol = { ...defaultSymbolProps };
    }
    if (propPath.startsWith('symbol.outline.') && updatedConfig.symbol && !updatedConfig.symbol.outline) {
      updatedConfig.symbol.outline = { ...defaultSymbolProps.outline };
    }
    if (propPath.startsWith('legendInfo.') && !updatedConfig.legendInfo) {
      updatedConfig.legendInfo = { ...defaultLegendProps };
    }

    // Navigate to the target property and set the value
    const keys = propPath.split('.');
    let current = updatedConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined || current[keys[i]] === null) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    // Ensure symbol properties are correct for markers
    if (propPath.startsWith('symbol.')) {
      updatedConfig.symbol.type = 'simple-marker';
      updatedConfig.symbol.style = 'circle';
    }

    setHasUnsavedChanges(true);
    setWorkingConfig(updatedConfig);
  };

  /**
   * Handles class breaks changes with validation and state synchronization
   * Ensures renderer type consistency and propagates size changes
   */
  const handleClassBreaksChange = (newBreaks, newValueColumn = valueColumn) => {
    setClassBreaks(newBreaks);
    setHasUnsavedChanges(true);
    
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));
    
    updatedConfig.classBreakInfos = newBreaks;
    updatedConfig.rendererType = newBreaks.length > 0 ? 'classBreaks' : 'simple';
    updatedConfig.valueColumn = newValueColumn;
    
    // Apply current symbol size to all breaks
    if (updatedConfig.symbol && updatedConfig.symbol.size !== undefined && newBreaks.length > 0) {
      const symbolSize = Number(updatedConfig.symbol.size);
      newBreaks.forEach(breakInfo => {
        if (breakInfo.symbol) {
          breakInfo.symbol.size = symbolSize;
        }
      });
    }
    
    setWorkingConfig(updatedConfig);
  };

  /**
   * Previews changes without saving
   * Allows users to see visual feedback before committing
   */
  const previewChanges = () => {
    if (onPreview) {
      onPreview(workingConfig);
    }
  };

  /**
   * Applies and saves all changes with comprehensive error handling
   * Provides detailed user feedback and manages UI state appropriately
   */
  const applyChanges = async () => {
    try {
      setIsSaving(true);

      // Apply changes to parent configuration
      onChange(workingConfig);
      
      // Apply preview if callback provided
      if (onPreview) {
        onPreview(workingConfig);
      }
      
      // Save configuration with fallback handling
      const saveResult = await savePointStyleConfiguration();
      
      if (saveResult.success) {
        // Prepare success message based on save type
        const successMessages = {
          create: "Style configuration created successfully",
          recreate: "Style configuration updated successfully", 
          update: "Style configuration updated successfully",
          localStorage: "Configuration saved to local storage (database temporarily unavailable)"
        };
        
        const message = successMessages[saveResult.type] || "Style configuration saved successfully";
        alert(message);
        
        // Reset change tracking
        setHasUnsavedChanges(false);
        
        // Close the editor
        if (typeof onClose === 'function') {
          console.log("[PointStyleEditor] Closing editor after successful save");
          onClose();
        } else {
          // Fallback close mechanisms if onClose prop is missing
          console.warn("[PointStyleEditor] onClose prop missing, using fallback close methods");
          
          try {
            // Dispatch escape key event
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true
            }));
            
            // Dispatch custom close event
            const closeEvent = new CustomEvent('point-style-editor-close', { 
              detail: { 
                applied: true, 
                saved: true, 
                configId: workingConfig.configId || 'unknown',
                saveType: saveResult.type
              } 
            });
            window.dispatchEvent(closeEvent);
          } catch (fallbackError) {
            console.error("[PointStyleEditor] Fallback close methods failed:", fallbackError);
          }
        }
      }
    } catch (error) {
      console.error("[PointStyleEditor] Failed to apply and save changes:", error);
      
      // Provide user-friendly error messages based on error type
      let userMessage = "Failed to save configuration changes. ";
      
      if (error.message.includes('No project ID')) {
        userMessage += "Project context is missing. Please refresh the page and try again.";
      } else if (error.message.includes('Database save failed')) {
        userMessage += "Unable to connect to the server. Your changes have been saved locally.";
      } else if (error.message.includes('LocalStorage')) {
        userMessage += "Both database and local storage saves failed. Please try again.";
      } else if (error.message.includes('Area type error')) {
        userMessage += "There was an issue with the area type configuration. Please try again or contact support.";
      } else if (error.message.includes('validation failed')) {
        userMessage += "The configuration data is invalid. Please check your settings and try again.";
      } else {
        userMessage += "An unexpected error occurred. Your changes were applied but may not be saved.";
      }
      
      alert(userMessage);
      
      // Still attempt to close the editor even if save failed
      if (typeof onClose === 'function') {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Cancels all changes and reverts to original configuration
   * Provides clean rollback with state restoration
   */
  const cancelChanges = () => {
    // Revert all working state to original values
    setWorkingConfig(JSON.parse(JSON.stringify(originalConfig)));
    setClassBreaks(originalConfig?.classBreakInfos?.length > 0 ? [...originalConfig.classBreakInfos] : []);
    setUseClassBreaks(originalConfig?.rendererType === 'classBreaks' || (originalConfig?.classBreakInfos?.length > 0));
    setValueColumn(originalConfig?.valueColumn || 'AvgBasePSF');
    setHasUnsavedChanges(false);
    
    // Preview original configuration
    if (onPreview) {
      onPreview(originalConfig);
    }
    
    // Close the editor
    if (typeof onClose === 'function') {
      console.log("[PointStyleEditor] Canceling changes and closing editor");
      onClose();
    } else {
      // Fallback close mechanisms
      console.warn("[PointStyleEditor] onClose prop missing for cancel, using fallback methods");
      
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true
        }));
        
        const closeEvent = new CustomEvent('point-style-editor-close', { 
          detail: { applied: false, configId: originalConfig.id || 'unknown' } 
        });
        window.dispatchEvent(closeEvent);
      } catch (fallbackError) {
        console.error("[PointStyleEditor] Fallback cancel close methods failed:", fallbackError);
      }
    }
  };

  // Setup external close event listener on component mount
  useEffect(() => {
    const handleExternalClose = () => {
      if (hasUnsavedChanges) {
        console.warn("[PointStyleEditor] External close requested with unsaved changes");
      }
      setHasUnsavedChanges(false);
      if (typeof onClose === 'function') {
        onClose();
      }
    };
    
    window.addEventListener('close-point-style-editor', handleExternalClose);
    
    return () => {
      window.removeEventListener('close-point-style-editor', handleExternalClose);
    };
  }, [hasUnsavedChanges, onClose]);

  /**
   * Toggles between simple styling and class breaks rendering
   * Manages renderer type and preserves existing breaks when toggling
   */
  const handleToggleClassBreaks = (e) => {
    const useClasses = e.target.checked;
    setUseClassBreaks(useClasses);
    setHasUnsavedChanges(true);
    
    const updatedConfig = JSON.parse(JSON.stringify(workingConfig));
    
    if (useClasses) {
      // Switching to class breaks
      if (classBreaks.length === 0) {
        // Create default breaks if none exist
        const newBreaks = JSON.parse(JSON.stringify(defaultClassBreaks));
        setClassBreaks(newBreaks);
        updatedConfig.classBreakInfos = newBreaks;
      } else {
        // Use existing breaks
        updatedConfig.classBreakInfos = classBreaks;
      }
      updatedConfig.rendererType = 'classBreaks';
      
      // Set default value column if not already set
      if (!updatedConfig.valueColumn) {
        updatedConfig.valueColumn = 'AvgBasePSF';
      }
    } else {
      // Switching to simple styling
      updatedConfig.rendererType = 'simple';
      // Keep classBreakInfos for potential future toggle back
    }
    
    setWorkingConfig(updatedConfig);
  };
  
  /**
   * Adds a new class break with smart defaults
   * Calculates appropriate ranges and applies current symbol styling
   */
  const addClassBreak = () => {
    const newBreaks = [...classBreaks];
    
    // Calculate min/max values for the new break
    let minValue = 0, maxValue = 1;
    
    if (newBreaks.length > 0) {
      const lastBreak = newBreaks[newBreaks.length - 1];
      minValue = lastBreak.maxValue;
      maxValue = minValue + 1;
    }
    
    // Apply smart rounding
    minValue = smartRound(minValue);
    maxValue = smartRound(maxValue);
    
    // Cycle through colors for visual distinction
    const colorIndex = newBreaks.length % 5;
    const colors = ['#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'];
    
    // Create new break with current symbol settings
    const newBreak = {
      minValue: minValue,
      maxValue: maxValue,
      label: `${minValue} - ${maxValue}`,
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: colors[colorIndex],
        size: workingSize,
        outline: {
          color: workingOutlineColor,
          width: workingOutlineWidth
        }
      }
    };
    
    newBreaks.push(newBreak);
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  /**
   * Removes a class break by index
   * Handles array bounds and triggers state updates
   */
  const removeClassBreak = (index) => {
    if (index < 0 || index >= classBreaks.length) return;
    
    const newBreaks = [...classBreaks];
    newBreaks.splice(index, 1);
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  /**
   * Updates a specific field in a class break
   * Handles different field types with appropriate type conversion
   */
  const updateClassBreak = (index, field, value) => {
    if (index < 0 || index >= classBreaks.length) return;
    
    const newBreaks = [...classBreaks];
    const breakToUpdate = { ...newBreaks[index] };
    
    // Handle numeric fields
    if (field === 'minValue' || field === 'maxValue') {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        breakToUpdate[field] = numericValue;
        
        // Update label to reflect new range
        if (breakToUpdate.maxValue === Infinity) {
          breakToUpdate.label = `${breakToUpdate.minValue} and above`;
        } else {
          breakToUpdate.label = `${breakToUpdate.minValue} - ${breakToUpdate.maxValue}`;
        }
      }
    }
    // Handle label field
    else if (field === 'label') {
      breakToUpdate.label = value;
    }
    // Handle nested symbol fields
    else if (field.startsWith('symbol.')) {
      const symbolField = field.split('.')[1];
      if (!breakToUpdate.symbol) breakToUpdate.symbol = { ...defaultSymbolProps };
      
      if (symbolField === 'color') {
        breakToUpdate.symbol.color = value;
      }
      else if (symbolField === 'size') {
        breakToUpdate.symbol.size = parseFloat(value);
      }
      else if (symbolField.startsWith('outline.')) {
        const outlineField = symbolField.split('.')[1];
        if (!breakToUpdate.symbol.outline) breakToUpdate.symbol.outline = { ...defaultSymbolProps.outline };
        breakToUpdate.symbol.outline[outlineField] = outlineField === 'width' ? parseFloat(value) : value;
      }
    }
    
    newBreaks[index] = breakToUpdate;
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  /**
   * Moves a class break up or down in the order
   * Handles array bounds and maintains data integrity
   */
  const moveClassBreak = (index, direction) => {
    if (index < 0 || index >= classBreaks.length) return;
    
    const newBreaks = [...classBreaks];
    
    if (direction === 'up' && index > 0) {
      [newBreaks[index], newBreaks[index - 1]] = [newBreaks[index - 1], newBreaks[index]];
    } else if (direction === 'down' && index < newBreaks.length - 1) {
      [newBreaks[index], newBreaks[index + 1]] = [newBreaks[index + 1], newBreaks[index]];
    } else {
      return; // No movement needed
    }
    
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };
  
  /**
   * Auto-generates class breaks based on data distribution
   * Creates evenly distributed breaks with smart rounding
   */
  const generateClassBreaksFromData = () => {
    if (!workingConfig?.customData?.data || !valueColumn) {
      console.warn("[PointStyleEditor] Cannot generate breaks: missing data or value column");
      return;
    }
    
    // Extract numeric values from the data
    const values = workingConfig.customData.data
      .map(item => parseFloat(item[valueColumn]))
      .filter(value => !isNaN(value));
    
    if (values.length === 0) {
      console.warn("[PointStyleEditor] No valid numeric values found for auto-generation");
      return;
    }
    
    // Calculate min and max values
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Create 5 evenly distributed breaks
    const breakCount = 5;
    const range = max - min;
    const interval = range / breakCount;
    
    const colors = ['#3182ce', '#8371cc', '#be56b0', '#e13b7d', '#e53e3e'];
    const newBreaks = [];
    
    for (let i = 0; i < breakCount; i++) {
      const minValue = min + (i * interval);
      const maxValue = i === breakCount - 1 ? max : min + ((i + 1) * interval);
      
      // Apply smart rounding
      const roundedMin = smartRound(minValue);
      const roundedMax = smartRound(maxValue);
      
      newBreaks.push({
        minValue: roundedMin,
        maxValue: roundedMax,
        label: `${roundedMin} - ${roundedMax}`,
        symbol: {
          type: "simple-marker",
          style: "circle",
          color: colors[i],
          size: workingSize,
          outline: {
            color: workingOutlineColor,
            width: workingOutlineWidth
          }
        }
      });
    }
    
    console.log("[PointStyleEditor] Generated", newBreaks.length, "class breaks from data");
    setHasUnsavedChanges(true);
    handleClassBreaksChange(newBreaks);
  };

  /**
   * Renders the simple legend preview component
   * Shows single symbol with label for simple renderer type
   */
  const renderSimpleLegendPreview = () => (
    <div className="mt-4 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Legend Preview</h4>
      <div className="flex items-center space-x-2">
        <div
          style={{
            width: `${workingSize}px`,
            height: `${workingSize}px`,
            backgroundColor: workingColor,
            border: `${workingOutlineWidth}px solid ${workingOutlineColor}`,
            borderRadius: '50%',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <span className="text-sm text-gray-800 dark:text-gray-100 break-all">
          {workingLegendLabel || '(No Label)'}
        </span>
      </div>
    </div>
  );
  
  /**
   * Renders the class breaks legend preview component
   * Shows all breaks with their symbols and labels
   */
  const renderClassBreaksLegendPreview = () => (
    <div className="mt-4 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Class Breaks Legend Preview</h4>
      {classBreaks.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No class breaks defined yet. Add breaks below or use auto-generation.
        </p>
      ) : (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {classBreaks.map((breakInfo, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                style={{
                  width: `${breakInfo.symbol?.size || workingSize}px`,
                  height: `${breakInfo.symbol?.size || workingSize}px`,
                  backgroundColor: breakInfo.symbol?.color,
                  border: `${breakInfo.symbol?.outline?.width || workingOutlineWidth}px solid ${breakInfo.symbol?.outline?.color || workingOutlineColor}`,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-800 dark:text-gray-100 break-all">
                {breakInfo.label || `${breakInfo.minValue} - ${breakInfo.maxValue === Infinity ? 'and above' : breakInfo.maxValue}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  /**
   * Renders the value column input and auto-generation controls
   * Only shown when class breaks mode is enabled
   */
  const renderValueColumnInput = () => (
    <div className="space-y-1">
      <label htmlFor="value-column" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
        Value Column <span className="text-gray-400">(Required for class breaks)</span>
      </label>
      
      <select
        id="value-column"
        value={valueColumn}
        onChange={(e) => {
          const newValue = e.target.value;
          setValueColumn(newValue);
          setHasUnsavedChanges(true);
          handleClassBreaksChange(classBreaks, newValue);
        }}
        className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
        disabled={availableColumns.length === 0}
      >
        {availableColumns.length === 0 ? (
          <option value="">No numeric columns available</option>
        ) : (
          availableColumns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))
        )}
      </select>
      
      <div className="flex items-center justify-between mt-2">
        <p className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <HelpCircle size={12} className="mr-1 flex-shrink-0" />
          <span>Select column with numeric values for classification</span>
        </p>
        
        <button
          onClick={generateClassBreaksFromData}
          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate class breaks based on data distribution"
          disabled={!valueColumn || availableColumns.length === 0}
        >
          Auto-Generate Breaks
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 border-b pb-2 mb-4">
          {mapType === 'comps' ? 'Comp Property Style & Legend' : 
           mapType === 'pipe' ? 'Pipeline Property Style & Legend' : 
           'Style & Legend Configuration'}
        </h3>
        
        <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
          <Info size={16} className="mr-1" />
          <span>Type: {mapType.charAt(0).toUpperCase() + mapType.slice(1)}</span>
        </div>
      </div>

      {/* Render Type Toggle */}
      <div className="flex items-center mb-4">
        <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">Simple Style</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={useClassBreaks}
            onChange={handleToggleClassBreaks}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
        <span className="text-sm text-gray-700 dark:text-gray-300 ml-2">Class Breaks</span>
      </div>

      {/* Value Column Input (for Class Breaks) */}
      {useClassBreaks && renderValueColumnInput()}

      {/* Symbol Styling Section */}
      <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
        <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">
          {useClassBreaks ? 'Default Symbol Style' : 'Symbol Style'}
        </legend>
        
        {/* Point Size */}
        <div className="space-y-1">
          <label htmlFor="point-size" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Size (px)
          </label>
          <input
            id="point-size"
            type="number"
            value={workingSize}
            onChange={(e) => {
              const newSize = Math.max(1, Math.min(30, parseFloat(e.target.value) || 1));
              handleConfigChange('symbol.size', newSize);
            }}
            min="1" max="30" step="1"
            className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
          />
        </div>
        
        {/* Point Color (visible only in simple mode) */}
        {!useClassBreaks && (
          <div className="space-y-1">
            <label htmlFor="point-color" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Fill Color
            </label>
            <input
              id="point-color"
              type="color"
              value={workingColor}
              onChange={(e) => handleConfigChange('symbol.color', e.target.value)}
              className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
            />
          </div>
        )}
        
        {/* Outline Width */}
        <div className="space-y-1">
          <label htmlFor="outline-width" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Outline Width (px)
          </label>
          <input
            id="outline-width"
            type="number"
            value={workingOutlineWidth}
            onChange={(e) => {
              const newWidth = Math.max(0, Math.min(5, parseFloat(e.target.value) || 0));
              handleConfigChange('symbol.outline.width', newWidth);
            }}
            min="0" max="5" step="0.5"
            className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
          />
        </div>
        
        {/* Outline Color */}
        <div className="space-y-1">
          <label htmlFor="outline-color" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
            Outline Color
          </label>
          <input
            id="outline-color"
            type="color"
            value={workingOutlineColor}
            onChange={(e) => handleConfigChange('symbol.outline.color', e.target.value)}
            className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
          />
        </div>
      </fieldset>

      {/* Legend Configuration (Simple Mode) */}
      {!useClassBreaks && (
        <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
          <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Legend</legend>
          <div className="space-y-1">
            <label htmlFor="legend-label" className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              Label
            </label>
            <input
              id="legend-label"
              type="text"
              value={workingLegendLabel}
              onChange={(e) => handleConfigChange('legendInfo.label', e.target.value)}
              placeholder={`e.g., ${mapType === 'comps' ? 'Comparable Property' : 'Property Location'}`}
              className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
            />
            <p className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              <HelpCircle size={12} className="mr-1 flex-shrink-0" />
              <span>This label appears below the symbol in the map legend.</span>
            </p>
          </div>

          {renderSimpleLegendPreview()}
        </fieldset>
      )}

      {/* Class Breaks Configuration */}
      {useClassBreaks && (
        <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded space-y-3">
          <legend className="text-sm font-medium px-1 text-gray-600 dark:text-gray-300">Class Breaks</legend>
          
          {renderClassBreaksLegendPreview()}
          
          {/* Class Breaks Editor */}
          <div className="mt-3 space-y-4">
            {classBreaks.map((breakInfo, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Break {index + 1}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => moveClassBreak(index, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded ${index === 0 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      title="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => moveClassBreak(index, 'down')}
                      disabled={index === classBreaks.length - 1}
                      className={`p-1 rounded ${index === classBreaks.length - 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                      title="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      onClick={() => removeClassBreak(index)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Remove break"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Min/Max Value Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor={`break-${index}-min`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                      Min Value
                    </label>
                    <input
                      id={`break-${index}-min`}
                      type="number"
                      step="any"
                      value={breakInfo.minValue}
                      onChange={(e) => updateClassBreak(index, 'minValue', e.target.value)}
                      className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`break-${index}-max`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                      Max Value
                    </label>
                    <input
                      id={`break-${index}-max`}
                      type="number"
                      step="any"
                      value={index === classBreaks.length - 1 && breakInfo.maxValue === Infinity ? '' : breakInfo.maxValue}
                      placeholder={index === classBreaks.length - 1 ? "∞ (Infinity)" : ""}
                      onChange={(e) => {
                        const value = e.target.value.trim() === '' && index === classBreaks.length - 1 
                          ? Infinity 
                          : e.target.value;
                        updateClassBreak(index, 'maxValue', value);
                      }}
                      className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                    />
                  </div>
                </div>
                
                {/* Label Input */}
                <div className="space-y-1">
                  <label htmlFor={`break-${index}-label`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Label
                  </label>
                  <input
                    id={`break-${index}-label`}
                    type="text"
                    value={breakInfo.label}
                    onChange={(e) => updateClassBreak(index, 'label', e.target.value)}
                    placeholder={breakInfo.maxValue === Infinity 
                      ? `${breakInfo.minValue} and above`
                      : `${breakInfo.minValue} - ${breakInfo.maxValue}`
                    }
                    className="w-full p-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded"
                  />
                </div>
                
                {/* Color Input */}
                <div className="space-y-1">
                  <label htmlFor={`break-${index}-color`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Color
                  </label>
                  <input
                    id={`break-${index}-color`}
                    type="color"
                    value={breakInfo.symbol?.color || '#3182CE'}
                    onChange={(e) => updateClassBreak(index, 'symbol.color', e.target.value)}
                    className="w-full h-8 p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
                  />
                </div>
              </div>
            ))}
            
            {/* Add Break Button */}
            <button
              onClick={addClassBreak}
              className="flex items-center justify-center w-full p-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              <Plus size={16} className="mr-1" /> Add Break
            </button>
          </div>
          
          {/* Help Text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Class breaks determine how properties are styled based on their values. 
            Properties with values in a break's range will use that break's color.
          </p>
        </fieldset>
      )}

      {/* Helpful Tips */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded">
        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center">
          <Info size={16} className="mr-1" /> Tips for {mapType === 'comps' ? 'Comps' : 'Property'} Map
        </h4>
        <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc pl-4">
          {mapType === 'comps' ? (
            <>
              <li>For rent comparison, use "AvgBasePSF" or "AvgNetPSF" as the value column</li>
              <li>For occupancy analysis, use the "Occupancy" column (values from 0-1)</li>
            </>
          ) : (
            <>
              <li>Use numeric columns for meaningful class break classification</li>
              <li>Consider the data range when setting break values</li>
            </>
          )}
          <li>Use "Auto-Generate Breaks" to create even class breaks based on your data</li>
          <li>Set the last break's maximum value to blank for "and above" classification</li>
          <li>Values are automatically rounded based on their magnitude for better readability</li>
          <li>Changes are only saved when you click "Apply, Save & Close"</li>
        </ul>
      </div>

      {/* Bottom padding to prevent content being hidden behind fixed footer */}
      <div className="pb-20"></div>
      
      {/* Fixed Footer with Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 dark:bg-gray-900 py-3 px-4 border-t border-gray-700 shadow-lg z-10">
        <div className="container mx-auto max-w-screen-lg flex items-center justify-between">
          {/* Unsaved Changes Indicator */}
          {hasUnsavedChanges && (
            <div className="flex items-center text-sm text-amber-400">
              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              Unsaved changes
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex ml-auto space-x-3">
            <button
              onClick={cancelChanges}
              className="px-4 py-2 text-sm bg-transparent hover:bg-gray-700 text-white rounded border border-gray-600"
              disabled={!hasUnsavedChanges || isSaving}
            >
              Cancel
            </button>
            
            <button
              onClick={previewChanges}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded"
              disabled={!hasUnsavedChanges || isSaving}
            >
              Preview
            </button>
            
            <button
              onClick={applyChanges}
              className={`px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center ${
                isSaving ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3 3m3-3V4" />
                  </svg>
                  Apply, Save & Close
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointStyleEditor;