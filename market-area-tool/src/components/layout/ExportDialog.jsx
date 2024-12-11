import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { TableCellsIcon, XMarkIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const MA_TYPE_MAPPING = {
  'radius': 'RADIUS',
  'place': 'PLACE',
  'block': 'BLOCK',
  'blockgroup': 'BLOCKGROUP',
  'cbsa': 'CBSA',
  'state': 'STATE',
  'zip': 'ZIP',
  'tract': 'TRACT',
  'county': 'COUNTY',
  'cb': 'CENSUS BLOCK',
  'cbg': 'CENSUS BLOCK GROUP',
  'caa': 'CUSTOM ANALYSIS AREA',
  'project': 'PROJECT',
  'rt': 'RADIUS TARGET'
};

const COST_PER_VARIABLE = 0.001; // $0.001 per variable

const ExportDialog = ({ isOpen, onClose, onExport, variablePresets = [], marketAreas = [] }) => {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [exportOption, setExportOption] = useState('selected-preset');
  const [fileName, setFileName] = useState(`market_areas_enriched_${new Date().toISOString().split('T')[0]}`);
  const [selectedAreas, setSelectedAreas] = useState(
    () => new Set(marketAreas.map(area => area.id))
  );

  useEffect(() => {
    setSelectedAreas(new Set(marketAreas.map(area => area.id)));
  }, [marketAreas]);

  // Calculate total variables based on export option
  const totalVariables = useMemo(() => {
    if (exportOption === 'selected-preset') {
      const selectedPreset = variablePresets.find(p => p.id === selectedPresetId);
      return selectedPreset ? selectedPreset.variables.length : 0;
    } else {
      // Assuming getAllVariables() for 'all-variables' option
      return variablePresets.reduce((total, preset) => total + preset.variables.length, 0);
    }
  }, [exportOption, selectedPresetId, variablePresets]);

  // Calculate total cost
  const totalCost = useMemo(() => {
    const numAreas = selectedAreas.size;
    const cost = (totalVariables * numAreas * COST_PER_VARIABLE);
    return cost.toFixed(2);
  }, [selectedAreas.size, totalVariables]);

  const handleSelectAllAreas = (e) => {
    if (e.target.checked) {
      setSelectedAreas(new Set(marketAreas.map(area => area.id)));
    } else {
      setSelectedAreas(new Set());
    }
  };

  const handleAreaSelection = (areaId) => {
    setSelectedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleExport = () => {
    const selectedMarketAreas = marketAreas.filter(area => selectedAreas.has(area.id));
    let variables = [];
    
    if (exportOption === 'selected-preset' && selectedPresetId) {
      const preset = variablePresets.find(p => p.id === selectedPresetId);
      variables = preset ? preset.variables : [];
    } else if (exportOption === 'all-variables') {
      // Collect all variables from all presets
      variables = variablePresets.reduce((all, preset) => [...all, ...preset.variables], []);
    }

    onExport({
      variables,
      selectedMarketAreas,
      fileName
    });

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
              {/* Cost Display */}
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CurrencyDollarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Estimated Cost
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    ${totalCost}
                  </span>
                </div>
              </div>

              {/* File Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Export File Name
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                           bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                           focus:outline-none focus:ring-blue-500 dark:text-white"
                  placeholder="Enter file name"
                />
              </div>

              {/* Market Areas Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Market Areas to Include
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 max-h-40 overflow-y-auto">
                  <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedAreas.size === marketAreas.length}
                      onChange={handleSelectAllAreas}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                      Select All
                    </span>
                  </label>
                  {marketAreas.map((area) => (
                    <label
                      key={area.id}
                      className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAreas.has(area.id)}
                        onChange={() => handleAreaSelection(area.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">
                        {area.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Options */}
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

              {/* Preset Selection */}
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
              disabled={
                (exportOption === 'selected-preset' && !selectedPresetId) ||
                selectedAreas.size === 0
              }
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