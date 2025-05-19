// src/components/LayerPropertiesEditor.jsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Tag, Type } from "lucide-react";
import ColorBreakEditor from "./ColorBreakEditor";
import DotDensityEditor from "./DotDensityEditor";
import PointStyleEditor from "./PointStyleEditor"; // For 'comp' and 'pipeline'
import CustomPointStyleEditor from "./CustomPointStyleEditor"; // For new 'custom-dual-value' maps
import PipelinePointStyleEditor from "./PipelinePointStyleEditor";
import LabelEditor from "./LabelEditor"; // Import the new LabelEditor component
import { mapConfigurationsAPI } from "../../services/api";

// Helper function to safely get properties, avoiding errors on null/undefined
const getConfigProp = (config, propPath, defaultValue = null) => {
  if (!config) return defaultValue;
  const pathParts = propPath.split(".");
  let current = config;
  for (const part of pathParts) {
    if (current === null || current === undefined) return defaultValue;
    current = current[part];
  }
  return current !== undefined ? current : defaultValue;
};

const valueFormats = {
  income: { prefix: "$", decimals: 0, multiplier: 1 },
  homeValue: { prefix: "$", decimals: 0, multiplier: 1 },
  growth: { prefix: "", suffix: "%", decimals: 1, multiplier: 1 },
  density: { prefix: "", suffix: "/sq mi", decimals: 0, multiplier: 1 },
  age: { prefix: "", suffix: " yrs", decimals: 1, multiplier: 1 },
  unemployment: { prefix: "", suffix: "%", decimals: 1, multiplier: 1 },
  affordability: { prefix: "", decimals: 0, multiplier: 1 },
  totalPopulation: { prefix: "", decimals: 0, multiplier: 1 },
  totalHouseholds: { prefix: "", decimals: 0, multiplier: 1 },
  // Add more formats as needed for your custom data
  default: { prefix: "", suffix: "", decimals: 2, multiplier: 1 },
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
  activeLayer, // Current active layer for label editing
}) => {
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [effectiveType, setEffectiveType] = useState(null);
  const [rendererType, setRendererType] = useState(null); // To distinguish custom map subtypes
  const [previousLabelMode, setPreviousLabelMode] = useState(false);
  const labelStateRef = useRef({ editedLabels: new Map() });

  // Log received initial configurations for debugging
  useEffect(() => {
    console.log(
      "LayerPropsEditor: Received initialLayerConfigurations:",
      initialLayerConfigurations
    );
    if (
      !initialLayerConfigurations ||
      typeof initialLayerConfigurations !== "object"
    ) {
      console.warn(
        "LayerPropsEditor: initialLayerConfigurations is missing or not an object. Defaulting to {}. Ensure it's passed correctly from the parent."
      );
    }
  }, [initialLayerConfigurations]);

  // --- Determine Effective Type and Renderer Type Logic ---
  useEffect(() => {
    console.log("LayerPropsEditor: Determining effectiveType/rendererType...", {
      vizProp: visualizationType,
      configType: layerConfig?.type,
      configRendererType: layerConfig?.rendererType,
      initialConfigs: initialLayerConfigurations,
    });
    let determinedType = null;
    let determinedRendererType = layerConfig?.rendererType || null;

    // Prioritize config's explicit type
    if (layerConfig?.type) {
      determinedType = layerConfig.type;
    } else if (visualizationType) {
      determinedType = visualizationType;
    }

    // Normalize common aliases
    if (determinedType === "pipeline") determinedType = "pipe";
    if (determinedType === "comps") determinedType = "comp";

    // Further refinement based on structure or initial configurations
    if (determinedType) {
      if (determinedType.endsWith("_HEAT")) {
        determinedType = "class-breaks";
      } else if (
        initialLayerConfigurations &&
        initialLayerConfigurations[determinedType]?.type
      ) {
        console.log(
          `LayerPropsEditor: Mapping type '${determinedType}' using initialLayerConfigurations to '${initialLayerConfigurations[determinedType].type}'`
        );
        // If determinedType is a key in initialConfigs, its 'type' property is the renderer type
        // but the overall effectiveType remains the key itself (e.g., 'income_HEAT' -> effectiveType 'income_HEAT', renderer 'class-breaks')
        // For custom maps, we handle this differently.
        if (determinedType !== 'custom') { // Avoid overriding 'custom' if it came from vizProp or config.type
             if (!determinedRendererType) determinedRendererType = initialLayerConfigurations[determinedType].type;
        }
      }
    }
    
    // Infer type and renderer from config structure if still ambiguous
    if (
      !determinedType ||
      ["vector-tile", "feature"].includes(determinedType) || // Generic types that need more info
      (determinedType === 'custom' && !determinedRendererType) // 'custom' type but no specific renderer yet
    ) {
      if (getConfigProp(layerConfig, "classBreakInfos.length", 0) > 0 && getConfigProp(layerConfig, "valueColumn1")) { // Check for custom dual value markers
          determinedType = "custom";
          determinedRendererType = "custom-dual-value";
      } else if (getConfigProp(layerConfig, "classBreakInfos.length", 0) > 0) {
        determinedType = determinedType || "class-breaks"; // Keep 'custom' if it was, otherwise 'class-breaks'
        determinedRendererType = "class-breaks";
      } else if (getConfigProp(layerConfig, "uniqueValueInfos.length", 0) > 0) {
        determinedType = determinedType || "unique-value";
        determinedRendererType = "unique-value";
      } else if (
        getConfigProp(layerConfig, "attributes.length", 0) > 0 &&
        getConfigProp(layerConfig, "dotValue") !== undefined
      ) {
        determinedType = "dot-density";
        determinedRendererType = "dot-density";
      } else if (
        getConfigProp(layerConfig, "symbol") &&
        getConfigProp(layerConfig, "customData.data")
      ) {
        // This is a point layer. Could be 'comp', 'pipe', or a simpler 'custom' (single symbol).
        // If determinedType was already 'comp' or 'pipe', keep it.
        if (!["comp", "pipe"].includes(determinedType)) {
          determinedType = "custom";
        }
        // If no specific renderer, assume simple point editor
        if (!determinedRendererType && (determinedType === 'custom' || determinedType === 'comp')) {
            determinedRendererType = "simple"; // For PointStyleEditor
        }
      }
    }
    
    // If it's a 'comp' map, ensure renderer is 'classBreaks' if breaks exist, else 'simple'
    if (determinedType === 'comp' && !determinedRendererType) {
        if (getConfigProp(layerConfig, "classBreakInfos.length", 0) > 0) {
            determinedRendererType = "classBreaks";
        } else {
            determinedRendererType = "simple";
        }
    }
    // If it's a 'pipe' map, it uses unique value rendering based on status
    if (determinedType === 'pipe' && !determinedRendererType) {
        determinedRendererType = "uniqueValue"; // PipelinePointStyleEditor handles this
    }


    setEffectiveType(determinedType);
    setRendererType(determinedRendererType);
    console.log(
      `LayerPropsEditor: Determined effectiveType: ${determinedType}, rendererType: ${determinedRendererType}`,
      { vizProp: visualizationType, configType: layerConfig?.type, configRenderer: layerConfig?.rendererType }
    );

  }, [visualizationType, layerConfig, initialLayerConfigurations]);

  useEffect(() => {
    setIsTransitioning(true);
    let initialConfig = layerConfig
      ? JSON.parse(JSON.stringify(layerConfig))
      : null;

    if (initialConfig) {
        if (!initialConfig.type && effectiveType) {
            initialConfig.type = effectiveType;
        }
        if (!initialConfig.rendererType && rendererType) {
            initialConfig.rendererType = rendererType;
        }
    } else if (effectiveType) {
        initialConfig = { type: effectiveType };
        if (rendererType) initialConfig.rendererType = rendererType;
    } else {
      console.warn(
        "LayerPropsEditor: Could not determine effective type/renderer and no layerConfig provided. Setting currentConfig to null."
      );
      initialConfig = null;
    }

    setCurrentConfig(initialConfig);

    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [layerConfig, visualizationType, effectiveType, rendererType]);

  // Handle label edit mode changes
  useEffect(() => {
    // Track transitions between modes to handle cleanup
    if (previousLabelMode !== isLabelEditMode) {
      console.log(
        `[LayerPropertiesEditor] Label edit mode changed: ${previousLabelMode} -> ${isLabelEditMode}`
      );

      if (isLabelEditMode) {
        // Entering label edit mode, save the state
        labelStateRef.current.editMode = true;
      } else {
        // Exiting label edit mode - ensure any pending changes are applied
        if (labelManager && labelStateRef.current.editMode) {
          console.log(
            "[LayerPropertiesEditor] Exiting label edit mode, ensuring label cache is up to date"
          );

          // Force a refresh of all labels to ensure any final changes are applied
          setTimeout(() => {
            try {
              if (labelManager.refreshLabels) {
                labelManager.refreshLabels(); // Refresh all labels
              }
            } catch (error) {
              console.warn(
                "[LayerPropertiesEditor] Error refreshing labels on mode exit:",
                error
              );
            }
          }, 0);
        }

        // Reset label edit state
        labelStateRef.current.editMode = false;
      }

      setPreviousLabelMode(isLabelEditMode);
    }
  }, [isLabelEditMode, labelManager, previousLabelMode]);

  const handleConfigChange = (newConfig) => {
    if (!newConfig) return;
    console.log("LayerPropsEditor: handleConfigChange", newConfig);

    if (newConfig.type && newConfig.type !== effectiveType) {
      setEffectiveType(newConfig.type);
    }
    if (newConfig.rendererType && newConfig.rendererType !== rendererType) {
      setRendererType(newConfig.rendererType);
    }
    setCurrentConfig(newConfig);
    if (onConfigChange) onConfigChange(newConfig);
    if (onPreview) onPreview(newConfig);
  };

  const handleLabelEditModeChange = (newMode) => {
    if (onLabelEditModeChange) {
      if (isLabelEditMode && !newMode && labelManager) {
        try {
          console.log("[LayerPropertiesEditor] Saving labels on mode change");
          if (labelManager.savePositions) labelManager.savePositions(true); // Force save
        } catch (error) {
          console.warn("[LayerPropertiesEditor] Error saving labels:", error);
        }
      }
      onLabelEditModeChange(newMode);
    }
  };

  const handleClose = () => {
    if (isLabelEditMode && labelManager) {
      try {
        console.log(
          "[LayerPropertiesEditor] Finalizing label edits before closing..."
        );
        if (labelManager.savePositions) {
          const result = labelManager.savePositions(true);
          if (result.success || result.count > 0) { // Check for success or actual saves
            console.log(
              `[LayerPropertiesEditor] Saved ${result.count} label positions before closing`
            );
          }
        }
        if (labelManager.loadPositions) {
          labelManager.loadPositions(true, false, true); // force, don't preserve map, do preserve storage
        }
        if (labelManager.refreshLabels) {
          labelManager.refreshLabels([], true);
        }
      } catch (error) {
        console.error(
          "[LayerPropertiesEditor] Error finalizing label edits before close:",
          error
        );
      }
    }
    if (onClose) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!currentConfig || !effectiveType || isSaving) {
      console.warn(
        "[Save] Save aborted. Missing currentConfig, effectiveType, or already saving.",
        { currentConfig, effectiveType, rendererType, isSaving }
      );
      if (!effectiveType)
        alert("Cannot save: Layer type could not be determined.");
      return;
    }

    setIsSaving(true);
    console.log(
      "[Save] Initiated save with config:",
      currentConfig,
      "effectiveType:", effectiveType, "rendererType:", rendererType
    );

    try {
      const configToSave = {
        ...currentConfig,
        type: effectiveType, 
        rendererType: rendererType || currentConfig.rendererType, // Ensure rendererType is also included
      };

      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      // ... (rest of the save logic, ensuring configToSave.rendererType is passed along if relevant for backend)

      const configurationsToSave = tabs
        .filter((tab) => tab.id !== 1) // Exclude Core Map
        .map((tab, index) => {
          const isActive = tab.id === activeTab;
          const baseLayerConfig = isActive
            ? configToSave
            : tab.layerConfiguration;
          const baseVizType =
            tab.visualizationType || (isActive ? visualizationType : null); 

          let finalLayerConfig = baseLayerConfig ? { ...baseLayerConfig } : {};
          let configType = finalLayerConfig.type;
          let configRendererType = finalLayerConfig.rendererType;

          if (!configType && baseVizType) {
            configType = baseVizType;
            if (configType === "pipeline") configType = "pipe";
            if (configType === "comps") configType = "comp";
            if (configType.endsWith("_HEAT")) configType = "class-breaks";
            if (initialLayerConfigurations && initialLayerConfigurations[configType]?.type) {
              if (!configRendererType) configRendererType = initialLayerConfigurations[configType].type;
            }
          }
          
          if (!configType) { /* ... infer type ... */ }
          if (configType === 'custom' && !configRendererType) { // Special handling for custom
              if (getConfigProp(finalLayerConfig, "colorClassBreakInfos") && getConfigProp(finalLayerConfig, "sizeInfos")) {
                configRendererType = "custom-dual-value";
              } else if (getConfigProp(finalLayerConfig, "classBreakInfos")) {
                configRendererType = "classBreaks"; // Could be simple custom with class breaks
              } else {
                configRendererType = "simple"; // Default simple custom
              }
          } else if (configType === 'comp' && !configRendererType) {
              configRendererType = getConfigProp(finalLayerConfig, "classBreakInfos.length", 0) > 0 ? "classBreaks" : "simple";
          } else if (configType === 'pipe' && !configRendererType) {
              configRendererType = "uniqueValue";
          }


          finalLayerConfig.type = configType;
          finalLayerConfig.rendererType = configRendererType;

          return {
            id: tab.configId,
            project_id: projectId,
            project: projectId,
            tab_name: tab.name,
            visualization_type: baseVizType || "", 
            area_type: convertAreaTypeToString(tab.areaType),
            layer_configuration: finalLayerConfig, 
            order: index,
          };
        })
        .filter(Boolean);
      
      // ... (API interaction logic - delete existing, create new)
      console.log("[Save] Configurations prepared for API:", configurationsToSave);

      // API Interaction (Simplified for brevity)
      const existingConfigsResponse = await mapConfigurationsAPI.getAll(projectId);
      const existingConfigs = existingConfigsResponse?.data?.results || existingConfigsResponse?.data || [];
      if (Array.isArray(existingConfigs) && existingConfigs.length > 0) {
        const configsToDelete = existingConfigs.filter(cfg => cfg.tab_name !== "Core Map");
        await Promise.all(configsToDelete.map(config => mapConfigurationsAPI.delete(config.id)));
      }

      if (configurationsToSave.length > 0) {
        const createPromises = configurationsToSave.map(config =>
          mapConfigurationsAPI.create(projectId, config).then(response => ({
            tabName: config.tab_name,
            configId: response.data.id,
            originalTabId: tabs.find(t => t.name === config.tab_name)?.id,
            newConfig: config.layer_configuration
          }))
        );
        const creationResults = (await Promise.all(createPromises)).filter(r => r);

        if (creationResults.length > 0) {
          window.dispatchEvent(new CustomEvent("mapConfigsSaved", { detail: { successfulCreations: creationResults } }));
          const activeTabSaveResult = creationResults.find(r => tabs.find(t => t.id === activeTab)?.name === r.tabName);
          if (activeTabSaveResult) {
            onConfigChange(activeTabSaveResult.newConfig);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("refreshVisualization", { detail: { tabId: activeTab, config: activeTabSaveResult.newConfig } }));
            }, 50);
          }
        } else {
           alert("Failed to save configurations. Changes applied locally only.");
           onConfigChange(configToSave);
        }
      } else {
        onConfigChange(configToSave); // Apply local if nothing to save to backend
      }

      onClose();
    } catch (error) {
      console.error("[Save] General error during save process:", error.response?.data || error.message || error);
      alert("Failed to save map configurations. Check console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  const convertAreaTypeToString = (areaTypeValue) => {
    const value = areaTypeValue?.value !== undefined ? areaTypeValue.value : areaTypeValue;
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase();
      if (["radius", "drivetime", "zip", "county", "place", "tract", "block", "blockgroup", "cbsa", "state", "usa", "custom"].includes(lowerValue)) {
        return lowerValue;
      }
      const numVal = parseInt(value);
      if (!isNaN(numVal)) {
        if (numVal === 12) return "tract";
        if (numVal === 11) return "county";
      }
      return "custom";
    }
    if (typeof value === "number") {
      if (value === 12) return "tract";
      if (value === 11) return "county";
      return "custom";
    }
    return "custom";
  };

  const renderEditor = () => {
    if (isLabelEditMode) {
      return (
        <LabelEditor
          isOpen={isOpen}
          onClose={() => {
            try {
              if (labelManager) {
                if (labelManager.savePositions) labelManager.savePositions(true);
                if (labelManager.loadPositions) labelManager.loadPositions(true, false, true);
                if (labelManager.refreshLabels) labelManager.refreshLabels([], true);
              }
            } catch (error) { console.warn("Error finalizing labels on close:", error); }
            if (onLabelEditModeChange) onLabelEditModeChange(false);
          }}
          mapView={mapView} labelManager={labelManager} activeLayer={activeLayer}
        />
      );
    }

    if (isTransitioning || !currentConfig) {
      return <div className="flex items-center justify-center h-full"><div className="text-gray-500 dark:text-gray-400">{isTransitioning ? "Loading configuration..." : "No configuration loaded or type undetermined."}</div></div>;
    }

    console.log("LayerPropsEditor: Rendering editor for effectiveType:", effectiveType, "rendererType:", rendererType);

    if (effectiveType === "pipe") { // Uses PipelinePointStyleEditor which handles unique value internally
      return <PipelinePointStyleEditor config={currentConfig} onChange={handleConfigChange} onPreview={onPreview} onClose={onClose} />;
    }
    
    // New: Custom map with dual-value rendering (color by Value1, size by Value2)
    if (effectiveType === "custom" && rendererType === "custom-dual-value") {
      // Ensure essential properties for CustomPointStyleEditor are present in currentConfig
      const configForCustomEditor = {
        ...currentConfig,
        symbol: currentConfig.symbol || { style: 'circle', outline: { color: '#FFFFFF', width: 1 }, minSize: 6, maxSize: 24 }, // Ensure symbol and min/max size exist
        colorClassBreakInfos: currentConfig.colorClassBreakInfos || [],
        sizeInfos: currentConfig.sizeInfos || [],
        customData: currentConfig.customData || { data: [] } // Ensure customData and data array exist
      };
      return <CustomPointStyleEditor config={configForCustomEditor} onChange={handleConfigChange} onPreview={onPreview} valueFormats={valueFormats} />;
    }
    // Comps maps or simple custom maps (single symbol or single value class breaks)
    if ((effectiveType === "comp") || (effectiveType === "custom" && (rendererType === "simple" || rendererType === "classBreaks"))) {
         // PointStyleEditor might need to handle classBreaks for comps if valueColumn1 is used.
         // For now, it assumes simple symbol or that classBreakInfos are directly in config for comps.
      return <PointStyleEditor config={currentConfig} onChange={handleConfigChange} onPreview={onPreview} mapType={effectiveType} onClose={onClose} />;
    }

    if (effectiveType === "dot-density" || rendererType === "dot-density") {
      const areaVal = selectedAreaType?.value !== undefined ? selectedAreaType.value : selectedAreaType;
      const isTract = areaVal === 12 || String(areaVal).toLowerCase() === "tract";
      const isCounty = areaVal === 11 || String(areaVal).toLowerCase() === "county";
      const defaultDotValue = isTract ? 10 : isCounty ? 100 : 1;
      const currentDotValue = getConfigProp(currentConfig, "dotValue") !== null ? parseInt(String(getConfigProp(currentConfig, "dotValue")), 10) : defaultDotValue;
      let attributes = getConfigProp(currentConfig, "attributes", []);
      if (!Array.isArray(attributes) || attributes.length === 0) {
        const fieldName = getConfigProp(currentConfig, "field", "value");
        attributes = [{ field: fieldName, color: "#E60049", label: getConfigProp(currentConfig, "label", fieldName) }];
      }
      const configForEditor = { ...currentConfig, type: "dot-density", dotValue: currentDotValue, attributes: attributes };
      return <DotDensityEditor config={configForEditor} onChange={handleConfigChange} selectedAreaType={selectedAreaType} onPreview={onPreview} />;
    }

    if (effectiveType === "class-breaks" || rendererType === "class-breaks") {
      const breaks = getConfigProp(currentConfig, "classBreakInfos", []);
      const formatKeyBase = (visualizationType?.replace("_HEAT", "") || getConfigProp(currentConfig, "field", "")).toLowerCase();
      const formatKey = Object.keys(valueFormats).find((key) => formatKeyBase.includes(key.toLowerCase())) || "default";
      const format = valueFormats[formatKey] || valueFormats.default;
      const configForEditor = { ...currentConfig, type: "class-breaks", classBreakInfos: breaks };
      return <ColorBreakEditor breaks={configForEditor.classBreakInfos} onBreaksChange={(newBreaks) => handleConfigChange({ ...configForEditor, classBreakInfos: newBreaks })} visualizationType={visualizationType} valueFormat={format} />;
    }

    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No specific editor for: effectiveType '{effectiveType || "unknown"}' / rendererType '{rendererType || "unknown"}'.
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-60">
          Current Config: {JSON.stringify(currentConfig, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div
      className={`
      fixed inset-y-0 right-0 z-30 w-[500px] h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl
      transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700
      ${isOpen ? "translate-x-0" : "translate-x-full"}
    `}
    >
      <div className="flex-none h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {isLabelEditMode ? "Edit Labels" : `Edit Layer (${effectiveType})`}
          </h2>
        </div>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Close editor">
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{renderEditor()}</div>
      <div className="flex-none p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex justify-end space-x-3">
          <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">Cancel</button>
          {!isLabelEditMode && (
            <button
              onClick={handleSave}
              disabled={!currentConfig || !effectiveType || isTransitioning || isSaving}
              className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            ><Save size={16} className={isSaving ? "animate-spin" : ""} /><span>{isSaving ? "Saving..." : "Apply Changes"}</span></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayerPropertiesEditor;