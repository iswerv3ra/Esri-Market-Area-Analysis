import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import ColorBreakEditor from './ColorBreakEditor';
import { mapConfigurationsAPI } from '../../services/api';

const DotDensityEditor = ({ config, onChange, selectedAreaType, onPreview }) => {
  if (!config) return null;
  
  // Determine default dot value based on area type
  const getDefaultDotValue = () => {
    if (!selectedAreaType || !selectedAreaType.value) return 1;
    
    // Use area type to determine default value
    if (selectedAreaType.value === 11) return 100; // County level
    if (selectedAreaType.value === 12) return 10;  // Census tract level
    return 1; // Default for other area types
  };

  // Fix value mismatch by ensuring both properties match
  const actualValue = config.attributes && config.attributes[0] && 
                     config.attributes[0].value !== undefined ? 
                     parseInt(config.attributes[0].value) : 
                     (config.dotValue !== undefined ? 
                     parseInt(config.dotValue) : 
                     getDefaultDotValue());

  // Create a safer reference of the config with synchronized values
  const safeConfig = {
    ...config,
    dotSize: config.dotSize || 1,
    dotValue: actualValue,
    dotType: 'circle',
    attributes: config.attributes ? 
      config.attributes.map(attr => ({
        ...attr,
        value: actualValue // Force sync with dotValue
      })) :
      [{ color: '#000000', value: actualValue }]
  };

  const handleDotValueChange = (e) => {
    // Get the raw input value
    const inputValue = e.target.value;
    
    // Parse the input value
    let newValue = parseInt(inputValue);
    
    // Only apply minimum if parsed value is NaN
    if (isNaN(newValue)) {
      newValue = 1;
    }
    const updatedConfig = {
      ...JSON.parse(JSON.stringify(safeConfig)), // Deep clone to force refresh
      dotValue: newValue,
      attributes: safeConfig.attributes.map(attr => ({
        ...attr,
        value: newValue // Ensure value is also updated in attributes
      }))
    };
    
    // Pass the updated config to the parent component
    onChange(updatedConfig);
    
    // Force a preview if available - use a longer timeout to ensure the change is processed
    if (onPreview) {
      setTimeout(() => {
        onPreview(updatedConfig);
      }, 200); // Increased from 100ms to 200ms
    }
  };

  // Get recommended value for the current geography (for display only)
  const recommendedValue = getDefaultDotValue();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Dot Size
        </label>
        <input
          type="number"
          value={safeConfig.dotSize}
          onChange={(e) => {
            const newSize = Math.max(0.5, Math.min(10, parseFloat(e.target.value) || 0.5));
            const updatedConfig = {
              ...JSON.parse(JSON.stringify(safeConfig)), // Deep clone
              dotSize: newSize
            };
            onChange(updatedConfig);
            if (onPreview) setTimeout(() => onPreview(updatedConfig), 100);
          }}
          min="0.5"
          max="10"
          step="0.5"
          className="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                   border border-gray-300 dark:border-gray-700 rounded"
        />
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          People per Dot
        </label>
        <input
          type="number"
          value={safeConfig.dotValue}
          onChange={handleDotValueChange}
          min="1"
          step="1"
          className="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                   border border-gray-300 dark:border-gray-700 rounded"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Dot Color
        </label>
        <input
          type="color"
          value={safeConfig.attributes[0]?.color || '#000000'}
          onChange={(e) => {
            const newAttributes = safeConfig.attributes.map(attr => ({
              ...attr,
              color: e.target.value,
              value: safeConfig.dotValue // Maintain synchronization
            }));
            
            const updatedConfig = {
              ...JSON.parse(JSON.stringify(safeConfig)), // Deep clone
              attributes: newAttributes
            };
            
            onChange(updatedConfig);
            if (onPreview) setTimeout(() => onPreview(updatedConfig), 100);
          }}
          className="w-full h-10 bg-transparent rounded cursor-pointer"
        />
      </div>
    </div>
  );
};

const LayerPropertiesEditor = ({ 
  isOpen, 
  onClose, 
  visualizationType,
  layerConfig,
  onConfigChange,
  selectedAreaType,
  onPreview,
  projectId,
  activeTab,
  tabs
}) => {
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const valueFormats = {
    income: {
      prefix: '$',
      decimals: 0,
      multiplier: 1
    },
    homeValue: {
      prefix: '$',
      decimals: 0,
      multiplier: 1
    },
    growth: {
      prefix: '',
      suffix: '%',
      decimals: 2,
      multiplier: 1
    },
    density: {
      prefix: '',
      suffix: ' per sq mi',
      decimals: 0,
      multiplier: 1
    },
    age: {
      prefix: '',
      suffix: ' years',
      decimals: 1,
      multiplier: 1
    },
    unemployment: {
      prefix: '',
      suffix: '%',
      decimals: 1,
      multiplier: 1
    },
    affordability: {
      prefix: '',
      decimals: 1,
      multiplier: 1
    }
  };

  useEffect(() => {
    setIsTransitioning(true);
    setCurrentConfig(layerConfig);
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [layerConfig, visualizationType]);

  const handleConfigChange = (newConfig) => {
    if (!newConfig) return;
    
    setCurrentConfig(newConfig);
    if (onPreview) {
      onPreview(newConfig);
    }
  };

  // Helper function to convert area type to string format
  const convertAreaTypeToString = (value) => {
    if (typeof value === 'string') return value;
    return value === 12 ? 'tract' : value === 11 ? 'county' : 'tract';
  };

  const handleSave = async () => {
    if (!currentConfig || isSaving) return;

    try {
      setIsSaving(true);
      
      // Create a deep clone of the configuration to ensure all references are new
      const freshConfig = JSON.parse(JSON.stringify(currentConfig));
      
      // Add a unique timestamp to force the map to see this as a new configuration
      freshConfig.timestamp = Date.now();
    
        const configurations = tabs
          .filter(tab => tab.id !== 1)
          .map((tab, index) => ({
            project_id: projectId,
            project: projectId,
            tab_name: tab.name,
            visualization_type: tab.visualizationType || '',
            area_type: convertAreaTypeToString(tab.id === activeTab ? selectedAreaType.value : tab.areaType?.value),
            layer_configuration: tab.id === activeTab ? currentConfig : tab.layerConfiguration,
            order: index
          }));
    
        console.log('[Save] Configurations to save:', configurations);
    
        const existingConfigs = await mapConfigurationsAPI.getAll(projectId);
        if (existingConfigs?.data?.length > 0) {
          await Promise.all(
            existingConfigs.data.map(config => 
              mapConfigurationsAPI.delete(config.id)
            )
          );
        }
    
        for (const config of configurations) {
          try {
            console.log('[Save] Creating configuration:', config);
            const response = await mapConfigurationsAPI.create(projectId, {
              ...config,
              project: projectId
            });
            console.log('[Save] Creation response:', response);
          } catch (err) {
            console.error('[Save] Error creating config:', {
              config,
              error: err.response?.data,
              fullError: err
            });
            throw err;
          }
        }
      // When returning to the map view, force a complete redraw
      onConfigChange(freshConfig);
      onClose();
      
    } catch (error) {
      // Error handling...
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditor = () => {
    if (!currentConfig || isTransitioning) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">
            Loading configuration...
          </div>
        </div>
      );
    }
  
    // Check for dot density type based on configuration properties
    if (currentConfig.type === "dot-density") {
      return (
        <DotDensityEditor
          config={currentConfig}
          onChange={handleConfigChange}
          selectedAreaType={selectedAreaType}
          onPreview={onPreview} // Pass this down to force refreshes
        />
      );
    }
  
    const classBreakTypes = [
      'income', 'growth', 'density', 'age', 
      'unemployment', 'homeValue', 'affordability'
    ];
    
    if (currentConfig.type === "class-breaks" || classBreakTypes.includes(visualizationType)) {
      return (
        <ColorBreakEditor
          breaks={currentConfig.classBreakInfos || []}
          onBreaksChange={(newBreaks) => 
            handleConfigChange({
              ...currentConfig,
              classBreakInfos: newBreaks
            })
          }
          visualizationType={visualizationType}
          valueFormat={valueFormats[visualizationType]}
        />
      );
    }
  
    return (
      <div className="p-4 text-gray-400">
        No editor available for this visualization type.
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-[#1a202c] border-t border-gray-300 dark:border-gray-700">
      <div className="flex-none h-12 flex items-center justify-center px-5 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1e2330]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Edit Layer Properties
        </h2>
      </div>
  
      <div className={`flex-1 overflow-y-auto p-6 ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-150`}>
        {renderEditor()}
      </div>
  
      <div className="p-5 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a202c]">
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-transparent 
                     hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!currentConfig || isTransitioning || isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 
                     text-white rounded transition-colors disabled:opacity-50 
                     disabled:cursor-not-allowed"
          >
            <Save size={16} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerPropertiesEditor;