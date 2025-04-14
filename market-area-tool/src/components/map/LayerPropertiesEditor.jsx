// src/components/LayerPropertiesEditor.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Type } from 'lucide-react';
import ColorBreakEditor from './ColorBreakEditor';
import DotDensityEditor from './DotDensityEditor';
import PointStyleEditor from './PointStyleEditor';
import PipelinePointStyleEditor from './PipelinePointStyleEditor';
import LabelEditor from './LabelEditor'; // Import the new LabelEditor component
import { mapConfigurationsAPI } from '../../services/api';

// Helper function to safely get properties, avoiding errors on null/undefined
const getConfigProp = (config, propPath, defaultValue = null) => {
  if (!config) return defaultValue;
  const pathParts = propPath.split('.');
  let current = config;
  for (const part of pathParts) {
    if (current === null || current === undefined) return defaultValue;
    current = current[part];
  }
  return current !== undefined ? current : defaultValue;
};


const valueFormats = {
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


const LayerPropertiesEditor = ({
  isOpen,
  onClose,
  visualizationType,
  layerConfig,
  initialLayerConfigurations = {}, // Provide a default empty object to prevent errors
  onConfigChange,
  selectedAreaType,
  onPreview,
  projectId,
  activeTab,
  tabs,
  mapView, // Added for label editing
  labelManager, // Added for label editing
  isLabelEditMode = false, // Track if we're in label editing mode
  onLabelEditModeChange, // Callback to toggle label edit mode
  activeLayer // Current active layer for label editing
}) => {
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [effectiveType, setEffectiveType] = useState(null);

   // Log received initial configurations for debugging
   useEffect(() => {
    console.log("LayerPropsEditor: Received initialLayerConfigurations:", initialLayerConfigurations);
    if (!initialLayerConfigurations || typeof initialLayerConfigurations !== 'object') {
        console.warn("LayerPropsEditor: initialLayerConfigurations is missing or not an object. Defaulting to {}. Ensure it's passed correctly from the parent.");
    }
   }, [initialLayerConfigurations]);


  // --- Determine Effective Type Logic ---
   useEffect(() => {
       console.log("LayerPropsEditor: Determining effectiveType...", { vizProp: visualizationType, configType: layerConfig?.type, initialConfigs: initialLayerConfigurations });
       let determinedType = null;

       // Prioritize config's explicit type
       if (layerConfig?.type) {
           determinedType = layerConfig.type;
       } else if (visualizationType) {
           determinedType = visualizationType;
       }

       // Normalize common aliases
       if (determinedType === 'pipeline') determinedType = 'pipe';
       if (determinedType === 'comps') determinedType = 'comp';

       // Further refinement based on structure or initial configurations
       if (determinedType) {
           if (determinedType.endsWith('_HEAT')) {
                determinedType = 'class-breaks';
           // *** ADD CHECK: Ensure initialLayerConfigurations exists before accessing ***
           } else if (initialLayerConfigurations && initialLayerConfigurations[determinedType]?.type) {
               // Check if it's a key in initial configs and get its *defined* renderer type
                console.log(`LayerPropsEditor: Mapping type '${determinedType}' using initialLayerConfigurations to '${initialLayerConfigurations[determinedType].type}'`);
                determinedType = initialLayerConfigurations[determinedType].type;
           }
       }

        // Infer type from config structure if still ambiguous
        if (!determinedType || ['vector-tile', 'feature'].includes(determinedType)) { // Avoid inferring if already specific like 'comp' or 'pipe'
            if (getConfigProp(layerConfig, 'classBreakInfos.length', 0) > 0) {
                determinedType = 'class-breaks';
            } else if (getConfigProp(layerConfig, 'uniqueValueInfos.length', 0) > 0) {
                determinedType = 'unique-value'; // Handle unique value if needed later
            } else if (getConfigProp(layerConfig, 'attributes.length', 0) > 0 && getConfigProp(layerConfig, 'dotValue') !== undefined) {
                determinedType = 'dot-density';
            } else if (getConfigProp(layerConfig, 'symbol') && getConfigProp(layerConfig, 'customData.data')) {
                // Could be 'comp', 'pipe', or 'custom'. Needs more context or defaults to 'custom'.
                // Let's keep the normalized type if it was 'comp' or 'pipe' earlier, otherwise default.
                if (!['comp', 'pipe'].includes(determinedType)) {
                    determinedType = 'custom';
                }
            }
        }


        setEffectiveType(determinedType);
        console.log(`LayerPropsEditor: Determined effectiveType: ${determinedType}`, { vizProp: visualizationType, configType: layerConfig?.type });

   // *** ADD initialLayerConfigurations TO DEPENDENCY ARRAY ***
   }, [visualizationType, layerConfig, initialLayerConfigurations]);


  useEffect(() => {
    setIsTransitioning(true);
    let initialConfig = layerConfig ? JSON.parse(JSON.stringify(layerConfig)) : null;

    if (initialConfig && !initialConfig.type && effectiveType) {
        initialConfig.type = effectiveType;
        console.log(`LayerPropsEditor: Added missing type '${effectiveType}' to initial config state`);
    } else if (!initialConfig && effectiveType) {
         initialConfig = { type: effectiveType };
         console.log(`LayerPropsEditor: Created minimal config with type '${effectiveType}'`);
    } else if (!initialConfig && !effectiveType) {
         // Handle case where no config and no type could be determined
         console.warn("LayerPropsEditor: Could not determine effective type and no layerConfig provided. Setting currentConfig to null.");
         initialConfig = null;
    }

    setCurrentConfig(initialConfig);

    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [layerConfig, visualizationType, effectiveType]);


   const handleConfigChange = (newConfig) => {
       if (!newConfig) return;
        console.log("LayerPropsEditor: handleConfigChange", newConfig);
       // Ensure the effectiveType state is updated if the config itself changes type
       if (newConfig.type && newConfig.type !== effectiveType) {
           console.log(`LayerPropsEditor: Config type changed from ${effectiveType} to ${newConfig.type}. Updating effectiveType.`);
           setEffectiveType(newConfig.type);
       }
       setCurrentConfig(newConfig);
       if (onConfigChange) onConfigChange(newConfig);
       if (onPreview) onPreview(newConfig);
   };

   const handleSave = async () => {
       // Ensure currentConfig and a valid type exist before proceeding
       if (!currentConfig || !effectiveType || isSaving) {
           console.warn("[Save] Save aborted. Missing currentConfig, effectiveType, or already saving.", { currentConfig, effectiveType, isSaving });
            if (!effectiveType) alert("Cannot save: Layer type could not be determined.");
            return;
       }


       setIsSaving(true);
       console.log("[Save] Initiated save with config:", currentConfig, "and effectiveType:", effectiveType);

       try {
           // Ensure the config being saved includes the latest determined type
           const configToSave = {
               ...currentConfig,
               type: effectiveType // Use the state variable which reflects the latest determination
           };

           const activeTabData = tabs.find(tab => tab.id === activeTab);
           if (!activeTabData?.configId) {
                console.warn("[Save] Active tab does not have a database configId. Will rely on bulk delete/create.");
           }

            const configurationsToSave = tabs
                .filter(tab => tab.id !== 1) // Exclude Core Map
                .map((tab, index) => {
                     const isActive = tab.id === activeTab;
                     const baseLayerConfig = isActive ? configToSave : tab.layerConfiguration;
                     const baseVizType = tab.visualizationType || (isActive ? visualizationType : null); // Use props if active tab

                     // Ensure we have a config object to work with
                     let finalLayerConfig = baseLayerConfig ? { ...baseLayerConfig } : {};

                     // Determine the type for this specific tab's config
                     let configType = finalLayerConfig.type; // Start with existing type if present

                     if (!configType && baseVizType) { // If no type in config, use vizType
                         configType = baseVizType;
                         // Normalize
                         if (configType === 'pipeline') configType = 'pipe';
                         if (configType === 'comps') configType = 'comp';
                         if (configType.endsWith('_HEAT')) configType = 'class-breaks';
                         // *** ADD CHECK: Ensure initialLayerConfigurations exists before accessing ***
                         if (initialLayerConfigurations && initialLayerConfigurations[configType]?.type) {
                             configType = initialLayerConfigurations[configType].type;
                         }
                     }

                     // If still no type, infer from structure (similar to effect hook logic)
                     if (!configType) {
                        if (getConfigProp(finalLayerConfig, 'classBreakInfos.length', 0) > 0) configType = 'class-breaks';
                        else if (getConfigProp(finalLayerConfig, 'dotValue') !== undefined) configType = 'dot-density';
                        else if (getConfigProp(finalLayerConfig, 'symbol')) configType = 'custom'; // Default point type
                     }

                     // If *still* no type (e.g., empty config for a new tab), use the active tab's type as a fallback
                     if (!configType) {
                         configType = effectiveType;
                         console.warn(`[Save] Tab '${tab.name}' lacked a determinable type. Falling back to active tab's type: ${effectiveType}`);
                     }

                     // Assign the determined type to the config object
                     finalLayerConfig.type = configType;

                     console.log(`[Save] Preparing config for tab '${tab.name}':`, { finalLayerConfig });


                     return {
                         id: tab.configId,
                         project_id: projectId,
                         project: projectId,
                         tab_name: tab.name,
                         visualization_type: baseVizType || '', // Use determined viz type
                         area_type: convertAreaTypeToString(tab.areaType),
                         layer_configuration: finalLayerConfig, // Use the potentially modified config
                         order: index
                     };
                 })
                 // Filter out any potential null/undefined configs if error handling becomes more complex
                 .filter(Boolean);

             console.log('[Save] Configurations prepared for API (Bulk Update):', configurationsToSave);

            // --- API Interaction: Delete existing and Create new ---
             console.log(`[Save] Fetching existing configs for project ${projectId}`);
             const existingConfigsResponse = await mapConfigurationsAPI.getAll(projectId);
             const existingConfigs = existingConfigsResponse?.data?.results || existingConfigsResponse?.data || []; // Adapt based on API response structure


             if (Array.isArray(existingConfigs) && existingConfigs.length > 0) {
                 console.log(`[Save] Deleting ${existingConfigs.length} existing configurations.`);
                 // Filter out core map config if it exists on backend but shouldn't be deleted
                 const configsToDelete = existingConfigs.filter(cfg => cfg.tab_name !== 'Core Map');
                 await Promise.all(
                     configsToDelete.map(config =>
                         mapConfigurationsAPI.delete(config.id)
                             .then(() => console.log(`[Save] Deleted config ${config.id} ('${config.tab_name}')`))
                             .catch(err => console.error(`[Save] Failed to delete config ${config.id} ('${config.tab_name}'):`, err))
                     )
                 );
                 console.log('[Save] Finished deleting existing configurations.');
             } else {
                 console.log('[Save] No existing configurations found to delete.');
             }

             if (configurationsToSave.length > 0) {
                 console.log('[Save] Creating new configurations...');
                 const createPromises = configurationsToSave.map(config =>
                     mapConfigurationsAPI.create(projectId, config)
                         .then(response => {
                             console.log(`[Save] Successfully created config for tab: ${config.tab_name}`, response.data);
                             // Find the original tab by name to update its configId
                             const originalTabIndex = tabs.findIndex(t => t.name === config.tab_name);
                             return { tabIndex: originalTabIndex, tabName: config.tab_name, configId: response.data.id, newConfig: config.layer_configuration };
                         })
                         .catch(err => {
                             console.error(`[Save] Error creating config for tab: ${config.tab_name}`, {
                                 configData: config,
                                 errorResponse: err.response?.data,
                                 fullError: err
                             });
                             return null;
                         })
                 );

                 const creationResults = await Promise.all(createPromises);
                 const successfulCreations = creationResults.filter(r => r !== null);
                 console.log(`[Save] Finished creating configurations. ${successfulCreations.length}/${configurationsToSave.length} successful.`);

                // Update local tab state with new config IDs and potentially updated configs
                if (successfulCreations.length > 0) {
                     // Trigger a state update in the parent component with all successful creations
                     // The parent should update the `tabs` array
                      window.dispatchEvent(new CustomEvent('mapConfigsSaved', {
                          detail: { successfulCreations }
                      }));

                     // If the currently active tab was successfully saved, ensure its config is updated locally too
                     const activeTabSaveResult = successfulCreations.find(r => tabs[r.tabIndex]?.id === activeTab);
                     if (activeTabSaveResult) {
                        onConfigChange(activeTabSaveResult.newConfig); // Update local editor state if needed
                        // Dispatch refresh event after state update
                        setTimeout(() => {
                              console.log("[Save] Forcing map refresh after save for active tab.");
                              window.dispatchEvent(new CustomEvent('refreshVisualization', {
                                  detail: { tabId: activeTab, config: activeTabSaveResult.newConfig }
                              }));
                          }, 50);
                     } else if (activeTab !== 1) { // Core map (id=1) doesn't get saved this way
                         console.warn("[Save] Active tab config might not have been updated in the backend successfully.");
                         // Still apply local changes as a fallback?
                         // onConfigChange(configToSave); // Apply local changes anyway
                         // Potentially trigger refresh with local changes
                         // setTimeout(() => {
                         //     window.dispatchEvent(new CustomEvent('refreshVisualization', {
                         //         detail: { tabId: activeTab, config: configToSave }
                         //     }));
                         // }, 50);
                     }

                } else {
                     console.error("[Save] Failed to save any configurations to the backend.");
                     alert("Failed to save configurations. Changes applied locally only.");
                     onConfigChange(configToSave); // Still apply local changes
                }
             } else {
                 console.log("[Save] No configurations to save to the backend.");
                  onConfigChange(configToSave); // Still apply local changes if any
                  // Potentially refresh map if local changes were made
                  // setTimeout(() => {
                  //       console.log("[Save] Forcing map refresh after local-only change.");
                  //       window.dispatchEvent(new CustomEvent('refreshVisualization', {
                  //           detail: { tabId: activeTab, config: configToSave }
                  //       }));
                  //   }, 50);
             }


            onClose(); // Close editor

       } catch (error) {
           console.error('[Save] General error during save process:', error.response?.data || error.message || error);
           alert('Failed to save map configurations. Check console for details.');
       } finally {
           setIsSaving(false);
           console.log("[Save] Save process finished.");
       }
   };

   const convertAreaTypeToString = (areaTypeValue) => {
    // Handles both object {label: 'Tract', value: 12} and direct value 'tract' or 12
    const value = areaTypeValue?.value !== undefined ? areaTypeValue.value : areaTypeValue;
    // console.log("[convertAreaTypeToString] Input:", areaTypeValue, "Derived value:", value); // Debugging line

    if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (['radius', 'drivetime', 'zip', 'county', 'place', 'tract', 'block', 'blockgroup', 'cbsa', 'state', 'usa', 'custom'].includes(lowerValue)) {
            return lowerValue;
        }
        // Check if it's a string representation of a known number
        const numVal = parseInt(value);
        if (!isNaN(numVal)) {
            if (numVal === 12) return 'tract';
            if (numVal === 11) return 'county';
            if (numVal === 15) return 'blockgroup'; // Example: Add if needed
        }
        // console.log("[convertAreaTypeToString] Unknown string, defaulting to 'custom':", value);
        return 'custom'; // Default for unknown strings
    }
    if (typeof value === 'number') {
        if (value === 12) return 'tract';
        if (value === 11) return 'county';
        if (value === 15) return 'blockgroup'; // Example: Add if needed
         // Add other numeric codes if necessary
         // console.log("[convertAreaTypeToString] Unknown number, defaulting to 'custom':", value);
        return 'custom'; // Default for unknown numbers
    }
    // console.log("[convertAreaTypeToString] Non-string/number, defaulting to 'custom':", value);
    return 'custom'; // Default for other types or null/undefined
};


  // --- Editor Rendering Logic ---
  const renderEditor = () => {
    // If in label editing mode, render the label editor instead of the regular editors
    if (isLabelEditMode) {
      return (
        <LabelEditor
          isOpen={isOpen}
          onClose={() => {
            if (onLabelEditModeChange) {
              onLabelEditModeChange(false);
            }
          }}
          mapView={mapView}
          labelManager={labelManager}
          activeLayer={activeLayer}
        />
      );
    }
    
    // Otherwise, show regular property editor based on layer type
    if (isTransitioning || !currentConfig) { // Check currentConfig existence here
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">
             {isTransitioning ? 'Loading configuration...' : 'No configuration loaded or type undetermined.'}
          </div>
        </div>
      );
    }

    // Use the effectiveType state variable for rendering decisions
    console.log("LayerPropsEditor: Rendering editor for effectiveType:", effectiveType);

    // *** RENDER PIPELINE EDITOR ***
    if (effectiveType === 'pipe') {
      return (
        <PipelinePointStyleEditor
          config={currentConfig}
          onChange={handleConfigChange}
          onPreview={onPreview}
          onClose={onClose} // Add this line
        />
      );
    }

    // *** RENDER COMPS/CUSTOM EDITOR ***
    if (effectiveType === 'comp' || effectiveType === 'custom') {
      return (
        <PointStyleEditor
          config={currentConfig}
          onChange={handleConfigChange}
          onPreview={onPreview}
          mapType={effectiveType}
          onClose={onClose} // Add this line to pass the onClose prop
        />
      );
    }

    // *** RENDER DOT DENSITY EDITOR ***
    if (effectiveType === 'dot-density') {
       const areaVal = selectedAreaType?.value !== undefined ? selectedAreaType.value : selectedAreaType;
       const isTract = areaVal === 12 || String(areaVal).toLowerCase() === 'tract';
       const isCounty = areaVal === 11 || String(areaVal).toLowerCase() === 'county';
       const defaultDotValue = isTract ? 10 : (isCounty ? 100 : 1);
       const currentDotValue = getConfigProp(currentConfig, 'dotValue') !== null
                                ? parseInt(String(getConfigProp(currentConfig, 'dotValue')), 10)
                                : defaultDotValue;


       let attributes = getConfigProp(currentConfig, 'attributes', []);
        if (!Array.isArray(attributes) || attributes.length === 0) {
             const fieldName = getConfigProp(currentConfig, 'field', 'value');
             attributes = [{
                 field: fieldName,
                 color: "#E60049",
                 label: getConfigProp(currentConfig, 'label', fieldName),
             }];
             console.warn("DotDensityEditor Prep: Attributes missing or invalid, created default attribute.");
        }

       const configForEditor = {
           ...currentConfig,
           type: 'dot-density', // Ensure type is set
           dotValue: currentDotValue,
           attributes: attributes
       };

       // Ensure config passed to editor is updated immediately if defaults were applied
       if(getConfigProp(currentConfig, 'attributes', []).length === 0 || getConfigProp(currentConfig, 'dotValue') === undefined) {
           // If we just created defaults, update the main state immediately
           // Be careful not to cause infinite loops if handleConfigChange triggers this effect again
           // Maybe only call if structure truly changed?
           // Or let DotDensityEditor handle internal defaults? For now, let's pass the prepared one.
           console.log("DotDensityEditor Prep: Passing prepared config with defaults", configForEditor);
       }


      return (
        <DotDensityEditor
          config={configForEditor}
          onChange={handleConfigChange} // handleConfigChange updates currentConfig
          selectedAreaType={selectedAreaType}
          onPreview={onPreview}
        />
      );
    }

    // *** RENDER CLASS BREAKS EDITOR (HEATMAPS) ***
    if (effectiveType === 'class-breaks') {
        const breaks = getConfigProp(currentConfig, 'classBreakInfos', []);
        // Try to derive format key more robustly
        const formatKeyBase = (visualizationType?.replace('_HEAT', '') || getConfigProp(currentConfig, 'field', '')).toLowerCase();
        const formatKey = Object.keys(valueFormats).find(key => formatKeyBase.includes(key.toLowerCase())) || 'default'; // Add a default format
        const format = valueFormats[formatKey] || { decimals: 0, prefix: '', suffix: '', multiplier: 1 };
        console.log("LayerPropsEditor: Rendering ColorBreakEditor. Format Key Base:", formatKeyBase, "Found Key:", formatKey, "Format:", format);

        // Ensure config passed includes necessary fields
        const configForEditor = {
           ...currentConfig,
           type: 'class-breaks', // Ensure type is set
           classBreakInfos: breaks, // Ensure breaks are present
        };

        return (
            <ColorBreakEditor
            // Use breaks from the prepared config
            breaks={configForEditor.classBreakInfos}
            onBreaksChange={(newBreaks) => {
                // Update the full config object, not just breaks
                handleConfigChange({
                ...configForEditor, // Use the prepared config as base
                classBreakInfos: newBreaks,
                });
            }}
            visualizationType={visualizationType}
            valueFormat={format}
            />
        );
    }

    // Fallback for unknown or unhandled types
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No specific editor available for the determined visualization type: '{effectiveType || 'unknown'}'.
        <br />
        Original visualizationType prop: '{visualizationType || 'not set'}'
        <br />
        Layer config type: '{layerConfig?.type || 'not set'}'
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-60">
          Current Config State:
          {JSON.stringify(currentConfig, null, 2)}
        </pre>
         <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-60">
          Initial Layer Config Prop:
          {JSON.stringify(layerConfig, null, 2)}
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
       {/* Header with mode toggle */}
      <div className="flex-none h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {isLabelEditMode ? 'Edit Labels' : `Edit Layer Properties (${effectiveType || '...'})`}
          </h2>
          
          {/* Mode toggle buttons - only show if we have a valid layer type */}
          {effectiveType && onLabelEditModeChange && (
            <div className="ml-4 flex rounded-md overflow-hidden">
              <button
                onClick={() => onLabelEditModeChange(false)}
                className={`px-3 py-1 text-sm font-medium ${!isLabelEditMode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                Properties
              </button>
              <button
                onClick={() => onLabelEditModeChange(true)}
                className={`px-3 py-1 text-sm font-medium flex items-center ${isLabelEditMode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                <Type className="h-3.5 w-3.5 mr-1" />
                Labels
              </button>
            </div>
          )}
        </div>
        
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
          
          {/* Only show Apply Changes button when not in label edit mode */}
          {!isLabelEditMode && (
            <button
              onClick={handleSave}
              // Disable if no config, transitioning, saving, or type is unknown
              disabled={!currentConfig || !effectiveType || isTransitioning || isSaving}
              className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white
                         bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} className={isSaving ? 'animate-spin' : ''} />
              <span>{isSaving ? 'Saving...' : 'Apply Changes'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayerPropertiesEditor;