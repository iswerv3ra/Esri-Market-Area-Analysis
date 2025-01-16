import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Draggable from 'react-draggable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ColorBreakEditor from './ColorBreakEditor';



const DotDensityEditor = ({ config, onChange }) => {
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
          className="w-full p-2 bg-white dark:bg-black text-black dark:text-white 
                   border border-gray-200 dark:border-gray-800 rounded"
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
          className="w-full p-2 bg-white dark:bg-black text-black dark:text-white 
                   border border-gray-200 dark:border-gray-800 rounded"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-black dark:text-white">
          Dot Color
        </label>
        <input
          type="color"
          value={config.attributes[0].color}
          onChange={(e) => {
            const newAttributes = [...config.attributes];
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
  onPreview,
}) => {
  const [currentConfig, setCurrentConfig] = useState(layerConfig);

  useEffect(() => {
    setCurrentConfig(layerConfig);
  }, [layerConfig]);

  const handleConfigChange = (newConfig) => {
    setCurrentConfig(newConfig);
    onPreview(newConfig);
  };

  const handleSave = () => {
    onConfigChange(currentConfig);
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={onClose}
      className="right-side-dialog"
    >
    <DialogContent className="fixed inset-y-0 right-0 h-full w-[500px] rounded-none border-l shadow-lg 
                            data-[state=open]:animate-slide-in-from-right
                            data-[state=closed]:animate-slide-out-to-right">
        <div className="absolute inset-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800" />
        <div className="relative z-10 h-full flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-black dark:text-white">
              <span>Edit Layer Properties</span>
              <button 
                onClick={onClose} 
                className="text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 flex-grow overflow-y-auto">
            {visualizationType === 'population' && (
              <DotDensityEditor
                config={currentConfig}
                onChange={handleConfigChange}
              />
            )}
            
            {(visualizationType === 'income' || visualizationType === 'growth') && (
              <ColorBreakEditor
                breaks={currentConfig.classBreakInfos}
                onBreaksChange={(newBreaks) => 
                  handleConfigChange({
                    ...currentConfig,
                    classBreakInfos: newBreaks
                  })
                }
              />
            )}
          </div>
  
          <div className="mt-6 flex justify-end space-x-4 border-t border-gray-200 dark:border-gray-800 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-900 text-black dark:text-white rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Save Changes
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LayerPropertiesEditor;