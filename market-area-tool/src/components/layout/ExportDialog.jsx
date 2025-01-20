import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { TableCellsIcon, XMarkIcon } from '@heroicons/react/24/outline';

const MA_TYPE_MAPPING = {
  radius: 'RADIUS',
  place: 'PLACE',
  block: 'BLOCK',
  blockgroup: 'BLOCKGROUP',
  cbsa: 'CBSA',
  state: 'STATE',
  zip: 'ZIP',
  tract: 'TRACT',
  county: 'COUNTY',
  cb: 'CENSUS BLOCK',
  cbg: 'CENSUS BLOCK GROUP',
  caa: 'CUSTOM ANALYSIS AREA',
  project: 'PROJECT',
  rt: 'RADIUS TARGET',
  usa: 'USA',
};

const ExportDialog = ({
  isOpen = false,
  onClose = () => {},
  onExport = () => {},
  variablePresets = [],
  marketAreas = [],
  isExporting = false,
}) => {
  // State management
  const [fileName, setFileName] = useState('');
  const [includeUSAData, setIncludeUSAData] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState(
    () => new Set(marketAreas.map((area) => area.id))
  );
  const [selectedTier, setSelectedTier] = useState('');

  useEffect(() => {
    if (marketAreas.length > 0) {
      const firstArea = marketAreas[0];
      const projectNumber =
        firstArea?.project_number || 
        firstArea?.project?.project_number || 
        firstArea?.project_id || 
        '00000.00';
  
      const date = new Date();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
  
      const fileName = `${projectNumber} Esri Data ${month}.${day}.${year}`;
      setFileName(fileName);
    } else {
      setFileName('00000.00 Esri Data 00.00.00');
    }
  }, [marketAreas]);

  // Sync selected areas when marketAreas changes
  useEffect(() => {
    setSelectedAreas(new Set(marketAreas.map((area) => area.id)));
  }, [marketAreas]);

  // Handler functions
  const handleSelectAllAreas = (e) => {
    if (e.target.checked) {
      setSelectedAreas(new Set(marketAreas.map((area) => area.id)));
    } else {
      setSelectedAreas(new Set());
    }
  };

  const handleAreaSelection = (areaId) => {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleIncludeUSACheckbox = (e) => {
    setIncludeUSAData(e.target.checked);
  };

  const handleTierSelection = (tier) => {
    setSelectedTier(tier);
  };

  const handleSubmitExport = async (e) => {
    e.preventDefault();
    
    if (isExporting) {
      return;
    }

    try {
      const selectedMarketAreas = marketAreas.filter((area) =>
        selectedAreas.has(area.id)
      );

      // Logic to get variables based on selected tiers
      const variables = variablePresets.reduce((acc, preset) => {
        if (
          (selectedTier === 'tier1' && preset.name.toLowerCase().includes('tier 1')) ||
          (selectedTier === 'tier2' && preset.name.toLowerCase().includes('tier 2'))
        ) {
          return [...acc, ...(preset.variables || [])];
        }
        return acc;
      }, []);

      await onExport({
        variables,
        selectedMarketAreas,
        fileName,
        includeUSAData: Boolean(includeUSAData)
      });
      
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const isExportDisabled = 
    isExporting || 
    !selectedTier ||
    selectedAreas.size === 0;

  const exportButtonText = isExporting ? 'Exporting...' : 'Export';

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <TableCellsIcon className="h-5 w-5" />
              Export Enriched Data
            </Dialog.Title>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-4">
            {/* Include USA Data Checkbox */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={includeUSAData}
                  onChange={handleIncludeUSACheckbox}
                  disabled={isExporting}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded 
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  Include USA Data
                </span>
              </label>
            </div>

            {/* File Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Export File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={isExporting}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                         focus:outline-none focus:ring-blue-500 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-white">
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
                      disabled={isExporting}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      {area.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Variable Tier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Variables
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tierSelection"
                    value="tier1"
                    checked={selectedTier === 'tier1'}
                    onChange={(e) => handleTierSelection(e.target.value)}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    Tier 1 Core Variables
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tierSelection"
                    value="tier2"
                    checked={selectedTier === 'tier2'}
                    onChange={(e) => handleTierSelection(e.target.value)}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    Tier 2 Variables
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border 
                       border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 
                       dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitExport}
              disabled={isExportDisabled}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white 
                       bg-blue-600 rounded-md hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       min-w-[80px] justify-center"
            >
              {exportButtonText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ExportDialog;