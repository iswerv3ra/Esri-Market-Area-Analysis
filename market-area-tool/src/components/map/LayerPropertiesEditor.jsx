import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import ColorBreakEditor from './ColorBreakEditor';
import { mapConfigurationsAPI } from '../../services/api';

const DotDensityEditor = ({ config, onChange }) => {
  if (!config) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Dot Size
        </label>
        <input
          type="number"
          value={config.dotSize}
          onChange={(e) => onChange({ 
            ...config, 
            dotSize: Math.max(0.5, Math.min(10, parseFloat(e.target.value) || 0.5))
          })}
          min="0.5"
          max="10"
          step="0.5"
          className="w-full p-2 bg-gray-800 text-white 
                   border border-gray-700 rounded"
        />
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          People per Dot
        </label>
        <input
          type="number"
          value={config.dotValue}
          onChange={(e) => onChange({ 
            ...config, 
            dotValue: Math.max(1, parseInt(e.target.value) || 1)
          })}
          min="1"
          className="w-full p-2 bg-gray-800 text-white 
                   border border-gray-700 rounded"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Dot Color
        </label>
        <input
          type="color"
          value={config.attributes?.[0]?.color || '#000000'}
          onChange={(e) => {
            const newAttributes = [...(config.attributes || [])];
            newAttributes[0] = { ...newAttributes[0], color: e.target.value };
            onChange({ ...config, attributes: newAttributes });
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
      console.log('[Save] Starting save with projectId:', projectId);
  
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
  
      onConfigChange(currentConfig);
      onClose();
  
    } catch (error) {
      console.error('[Save] Error:', {
        error,
        response: error.response?.data,
        projectId
      });
      alert('Failed to save map configurations');
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

    if (visualizationType === 'population') {
      return (
        <DotDensityEditor
          config={currentConfig}
          onChange={handleConfigChange}
        />
      );
    }

    const classBreakTypes = [
      'income', 'growth', 'density', 'age', 
      'unemployment', 'homeValue', 'affordability'
    ];
    
    if (classBreakTypes.includes(visualizationType)) {
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
    <div className="h-full flex flex-col bg-[#1a202c] border-t border-gray-700">
      <div className="flex-none h-12 flex items-center justify-center px-5 border-b border-gray-700 bg-[#1e2330]">
        <h2 className="text-xl font-semibold text-white">
          Edit Layer Properties
        </h2>
      </div>
  
      <div className={`flex-1 overflow-y-auto p-6 ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-150`}>
        {renderEditor()}
      </div>
  
      <div className="p-5 border-t border-gray-700 bg-[#1a202c]">
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 bg-transparent 
                     hover:bg-gray-700 rounded transition-colors"
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