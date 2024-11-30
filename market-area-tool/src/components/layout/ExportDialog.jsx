import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { TableCellsIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getAllVariables } from "../../services/enrichmentService";

const ExportDialog = ({ isOpen, onClose, onExport, variablePresets = [] }) => {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [exportOption, setExportOption] = useState('selected-preset');

  const handleExport = () => {
    console.log('Export triggered with option:', exportOption);
    let variables = [];
    
    if (exportOption === 'selected-preset' && selectedPresetId) {
      const preset = variablePresets.find(p => p.id === selectedPresetId);
      variables = preset ? preset.variables : [];
      console.log('Selected preset variables:', variables);
    } else if (exportOption === 'all-variables') {
      try {
        variables = getAllVariables();
        console.log('All variables:', variables);
      } catch (error) {
        console.error('Error getting all variables:', error);
        variables = [];
      }
    }
    
    console.log('Final variables to export:', variables);
    onExport(variables);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <TableCellsIcon className="h-5 w-5" />
              Export Enriched Data
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Export Options
                </label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="selected-preset"
                      checked={exportOption === 'selected-preset'}
                      onChange={(e) => setExportOption(e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      Use Selected Preset
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="all-variables"
                      checked={exportOption === 'all-variables'}
                      onChange={(e) => setExportOption(e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      Use All Variables
                    </span>
                  </label>
                </div>
              </div>

              {exportOption === 'selected-preset' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Variable Preset
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                             bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                             focus:outline-none focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">Select a preset...</option>
                    {variablePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.variables.length} variables)
                        {preset.is_global ? ' (Global)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border 
                       border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 
                       dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exportOption === 'selected-preset' && !selectedPresetId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md 
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ExportDialog;