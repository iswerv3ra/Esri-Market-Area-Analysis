import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ColorBreakEditor from './ColorBreakEditor';

const DotDensityEditor = ({ config, onChange }) => {
  if (!config) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-black dark:text-white">
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
          className="w-full p-2 bg-white dark:bg-gray-800 text-black dark:text-white 
                   border border-gray-200 dark:border-gray-700 rounded"
        />
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-black dark:text-white">
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
          className="w-full p-2 bg-white dark:bg-gray-800 text-black dark:text-white 
                   border border-gray-200 dark:border-gray-700 rounded"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-black dark:text-white">
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
  onPreview
}) => {
  const [currentConfig, setCurrentConfig] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Define value formats for all visualization types
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

  const handleSave = () => {
    if (currentConfig) {
      onConfigChange(currentConfig);
    }
    onClose();
  };

  const renderEditor = () => {
    if (!currentConfig || isTransitioning) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">
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

    // Handle all class break visualizations
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
      <div className="p-4 text-gray-600 dark:text-gray-400">
        No editor available for this visualization type.
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Edit Layer Properties
        </h2>
        <button 
          onClick={onClose}
          className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 
                   dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-150`}>
        {renderEditor()}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-transparent 
                     hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!currentConfig || isTransitioning}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded 
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerPropertiesEditor;