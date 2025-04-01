// src/components/LayerPropertiesEditor.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import ColorBreakEditor from './ColorBreakEditor';
import DotDensityEditor from './DotDensityEditor';
import PointStyleEditor from './PointStyleEditor';
import { mapConfigurationsAPI } from '../../services/api';

const LayerPropertiesEditor = ({
  isOpen,
  onClose,
  visualizationType, // The *original* type string from the tab (e.g., 'pipe', 'comp', 'custom', 'income_HEAT')
  layerConfig,
  onConfigChange,
  selectedAreaType,
  onPreview,
  projectId,
  activeTab,
  tabs
}) => {
  console.log('LayerPropertiesEditor rendered. isOpen prop:', isOpen); // <<< ADD THIS LOG
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const valueFormats = {
    // ... (valueFormats remain the same) ...
    income: { prefix: '$', decimals: 0, multiplier: 1 },
    homeValue: { prefix: '$', decimals: 0, multiplier: 1 },
    growth: { prefix: '', suffix: '%', decimals: 1, multiplier: 1 },
    density: { prefix: '', suffix: '/sq mi', decimals: 0, multiplier: 1 },
    age: { prefix: '', suffix: ' yrs', decimals: 1, multiplier: 1 },
    unemployment: { prefix: '', suffix: '%', decimals: 1, multiplier: 1 },
    affordability: { prefix: '', decimals: 0, multiplier: 1 },
    totalPopulation: { prefix: '', decimals: 0, multiplier: 1 },
    totalHouseholds: { prefix: '', decimals: 0, multiplier: 1 },
  };

  useEffect(() => {
    console.log("LayerPropsEditor: Props updated. Type:", visualizationType, "Config:", layerConfig);
    setIsTransitioning(true);
    // Ensure the config includes the 'type' if missing, deriving from visualizationType
    let effectiveConfig = layerConfig ? JSON.parse(JSON.stringify(layerConfig)) : null;
    if (effectiveConfig && !effectiveConfig.type && visualizationType) {
        let configType = visualizationType;
         if (configType === 'pipeline') configType = 'pipe';
         if (configType === 'comps') configType = 'comp';
         if (configType.endsWith('_HEAT')) configType = 'class-breaks';
         // Add more normalization if needed (like for dot density based on original name)
         if (initialLayerConfigurations[configType]?.type) configType = initialLayerConfigurations[configType].type;

        effectiveConfig.type = configType;
         console.log(`LayerPropsEditor: Added missing type '${configType}' to initial config`);
    }
    setCurrentConfig(effectiveConfig);


    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [layerConfig, visualizationType]);


  const handleConfigChange = (newConfig) => {
    // ... (handleConfigChange remains the same) ...
    if (!newConfig) return;
    console.log("LayerPropsEditor: handleConfigChange received:", newConfig);
    setCurrentConfig(newConfig);
    if (onPreview) {
        console.log("LayerPropsEditor: Triggering onPreview");
        onPreview(newConfig);
    }
  };

  const convertAreaTypeToString = (areaTypeValue) => {
    // ... (convertAreaTypeToString remains the same) ...
    const value = areaTypeValue?.value !== undefined ? areaTypeValue.value : areaTypeValue;
    if (typeof value === 'string') {
        if (value === 'tract' || value === 'county' || value === 'custom') return value;
        const numVal = parseInt(value);
        if (!isNaN(numVal)) {
             if (numVal === 12) return 'tract';
             if (numVal === 11) return 'county';
        }
         console.warn(`Unknown string area type value: "${value}", defaulting to 'custom'`);
         return 'custom';
    }
    if (typeof value === 'number') {
        if (value === 12) return 'tract';
        if (value === 11) return 'county';
    }
    console.warn(`Unrecognized area type value: "${value}" (type: ${typeof value}), defaulting to 'custom'`);
    return 'custom';
  };

  const handleSave = async () => {
    // ... (handleSave remains the same) ...
     if (!currentConfig || isSaving) return;
     setIsSaving(true);
     console.log("[Save] Initiated save with config:", currentConfig);
     try {
       const configToSave = JSON.parse(JSON.stringify(currentConfig));
       const configurations = tabs
         .filter(tab => tab.id !== 1)
         .map((tab, index) => ({
           project_id: projectId,
           project: projectId,
           tab_name: tab.name,
           visualization_type: tab.visualizationType || '',
           area_type: convertAreaTypeToString(tab.areaType), // Use updated helper
           layer_configuration: tab.id === activeTab ? configToSave : tab.layerConfiguration,
           order: index
         }));
       console.log('[Save] Configurations prepared for API:', configurations);
       console.log(`[Save] Fetching existing configs for project ${projectId}`);
       const existingConfigsResponse = await mapConfigurationsAPI.getAll(projectId);
       const existingConfigs = existingConfigsResponse?.data;
       if (Array.isArray(existingConfigs) && existingConfigs.length > 0) {
         console.log(`[Save] Deleting ${existingConfigs.length} existing configurations.`);
         await Promise.all(
           existingConfigs.map(config =>
             mapConfigurationsAPI.delete(config.id)
               .then(() => console.log(`[Save] Deleted config ${config.id}`))
               .catch(err => console.error(`[Save] Failed to delete config ${config.id}:`, err))
           )
         );
         console.log('[Save] Finished deleting existing configurations.');
       } else {
         console.log('[Save] No existing configurations found to delete.');
       }
       console.log('[Save] Creating new configurations...');
       const createPromises = configurations.map(config =>
         mapConfigurationsAPI.create(projectId, { ...config, project: projectId })
           .then(response => {
             console.log(`[Save] Successfully created config for tab: ${config.tab_name}`, response.data);
             return response.data;
           })
           .catch(err => {
             console.error(`[Save] Error creating config for tab: ${config.tab_name}`, { configData: config, errorResponse: err.response?.data, fullError: err });
             return null;
           })
       );
       const creationResults = await Promise.all(createPromises);
       const successfulCreations = creationResults.filter(r => r !== null);
       console.log(`[Save] Finished creating configurations. ${successfulCreations.length}/${configurations.length} successful.`);
       console.log("[Save] Calling onConfigChange with final saved config for map update.");
       onConfigChange(configToSave);
       onClose();
     } catch (error) {
       console.error('[Save] General error during save process:', error.response?.data || error.message || error);
       alert('Failed to save map configurations. Check console for details.');
     } finally {
       setIsSaving(false);
       console.log("[Save] Save process finished.");
     }
  };


  // --- Editor Rendering Logic ---
  const renderEditor = () => {
    if (!currentConfig || isTransitioning) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">Loading configuration...</div>
        </div>
      );
    }

    // Determine effective type: Prioritize config.type, fallback to normalized visualizationType prop
    let effectiveType = currentConfig.type;
    if (!effectiveType && visualizationType) {
        effectiveType = visualizationType;
        if (effectiveType === 'pipeline') effectiveType = 'pipe';
        if (effectiveType === 'comps') effectiveType = 'comp';
        if (effectiveType.endsWith('_HEAT')) effectiveType = 'class-breaks';
        // Add more normalization if necessary (e.g., check initialLayerConfigurations)
        if (initialLayerConfigurations[effectiveType]?.type) effectiveType = initialLayerConfigurations[effectiveType].type;
        console.log(`LayerPropsEditor: Derived effectiveType from visualizationType prop: ${effectiveType}`);
    }

    console.log("LayerPropsEditor: Rendering editor for final effectiveType:", effectiveType);

    // --- Render PointStyleEditor for 'comp', 'pipe', 'custom' ---
    if (effectiveType === 'comp' || effectiveType === 'pipe' || effectiveType === 'custom') {
        // Ensure the config object being passed *definitely* has the type property
        const configForPointEditor = { ...currentConfig, type: effectiveType };
        return (
          <PointStyleEditor
            config={configForPointEditor}
            onChange={handleConfigChange}
            onPreview={onPreview}
            mapType={effectiveType} // Pass 'comp', 'pipe', or 'custom'
          />
        );
    }

    // --- Render DotDensityEditor ---
    if (effectiveType === "dot-density") {
        // ... (DotDensityEditor rendering logic remains the same) ...
        const isTract = selectedAreaType?.value === 12;
        const isCounty = selectedAreaType?.value === 11;
        const defaultDotValue = isTract ? 10 : (isCounty ? 100 : 1);
        const currentDotValue = currentConfig.dotValue !== undefined ? parseInt(currentConfig.dotValue) : defaultDotValue;
        let attributes = currentConfig.attributes;
        if (!attributes || !Array.isArray(attributes) || attributes.length === 0) {
            const fieldName = currentConfig.field || 'value';
            attributes = [{ field: fieldName, color: "#E60049", label: currentConfig.label || fieldName, value: currentDotValue }];
        } else {
            attributes = attributes.map(attr => ({ ...attr, value: currentDotValue }));
        }
        const configForEditor = { ...currentConfig, type: 'dot-density', dotValue: currentDotValue, attributes }; // Ensure type is set
        return (
            <DotDensityEditor
                config={configForEditor}
                onChange={handleConfigChange}
                selectedAreaType={selectedAreaType}
                onPreview={onPreview}
            />
        );
    }

    // --- Render ColorBreakEditor for Heat Maps ---
    if (effectiveType === "class-breaks") { // Simplify condition to just check effectiveType
        // ... (ColorBreakEditor rendering logic remains the same) ...
        const breaks = currentConfig.classBreakInfos || [];
        const formatKeyBase = visualizationType?.replace('_HEAT', '').toLowerCase(); // Still use original prop for format hint
        const formatKey = Object.keys(valueFormats).find(key => formatKeyBase?.includes(key.toLowerCase()));
        const format = valueFormats[formatKey] || { decimals: 0, prefix: '', suffix: '', multiplier: 1 };
        console.log("LayerPropsEditor: Rendering ColorBreakEditor. Original Type:", visualizationType, "Format Key:", formatKey, "Format:", format);
        return (
            <ColorBreakEditor
                breaks={breaks}
                onBreaksChange={(newBreaks) => {
                    console.log("LayerPropsEditor: ColorBreakEditor breaks changed:", newBreaks);
                    handleConfigChange({
                        ...currentConfig,
                        classBreakInfos: newBreaks,
                        type: 'class-breaks' // Ensure type is explicitly set/kept
                    });
                }}
                visualizationType={visualizationType}
                valueFormat={format}
            />
        );
    }

    // General fallback if no editor matches
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No specific editor available for visualization type: '{effectiveType || visualizationType}'. Config:
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto">
            {JSON.stringify(currentConfig, null, 2)}
        </pre>
      </div>
    );
  };
  // --- End Editor Rendering Logic ---


  // --- Component JSX ---
  return (
    <div className={`
      fixed inset-y-0 right-0 z-30 w-[500px] h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl
      transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      {/* Header */}
      <div className="flex-none h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Edit Layer Properties
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close editor"
        >
          <X size={24} />
        </button>
      </div>

      {/* Editor Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderEditor()}
      </div>

      {/* Footer - Actions */}
      <div className="flex-none p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                       border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!currentConfig || isTransitioning || isSaving}
            className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white
                       bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'Saving...' : 'Apply Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerPropertiesEditor;