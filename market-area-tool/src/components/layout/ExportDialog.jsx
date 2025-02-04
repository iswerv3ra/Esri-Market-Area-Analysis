import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { TableCellsIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ExportDialog = ({
  isOpen = false,
  onClose = () => {},
  onExport = () => {},
  variablePresets = [],
  marketAreas = [],
  isExporting = false,
}) => {
  const [fileName, setFileName] = useState('');
  const [includeUSAData, setIncludeUSAData] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState(
    () => new Set(marketAreas.map((area) => area.id))
  );
  const [selectedTiers, setSelectedTiers] = useState(() => new Set(['tier1']));

  const { tier1Count, tier2Count } = useMemo(() => {
    return variablePresets.reduce((acc, preset) => {
      if (preset.name.toLowerCase().includes('tier 1')) {
        acc.tier1Count += preset.variables?.length || 0;
      } else if (preset.name.toLowerCase().includes('tier 2')) {
        acc.tier2Count += preset.variables?.length || 0;
      }
      return acc;
    }, { tier1Count: 0, tier2Count: 0 });
  }, [variablePresets]);

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

  useEffect(() => {
    setSelectedAreas(new Set(marketAreas.map((area) => area.id)));
  }, [marketAreas]);

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
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const handleSubmitExport = async (e) => {
    e.preventDefault();
    
    if (isExporting) return;
  
    try {
      const selectedMarketAreas = marketAreas.filter((area) =>
        selectedAreas.has(area.id)
      );
  
      let variables = [];
  
      if (selectedTiers.has('tier1')) {
        const tier1Variables = variablePresets
          .find(preset => preset.name.toLowerCase().includes('tier 1'))
          ?.variables || [];
        variables = [...variables, ...tier1Variables];
      }
      
      if (selectedTiers.has('tier2')) {
        const tier2Variables = variablePresets
          .find(preset => preset.name.toLowerCase().includes('tier 2'))
          ?.variables || [];
        variables = [...variables, ...tier2Variables];
      }
  
      const baseFileName = fileName.replace(/\.(xlsx|csv)$/i, '').trim();
      const fileNameWithExt = `${baseFileName}.xlsx`;
  
      const result = await onExport({
        variables,
        selectedMarketAreas,
        fileName: fileNameWithExt,
        includeUSAData: Boolean(includeUSAData),
      });
  
      if (result instanceof Blob) {
        const url = window.URL.createObjectURL(result);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileNameWithExt;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const isExportDisabled = 
    isExporting || 
    selectedTiers.size === 0 ||
    selectedAreas.size === 0;

  const exportButtonText = isExporting ? 'Exporting...' : 'Export';

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
              disabled={isExporting}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
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

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select Variables
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTiers.has('tier1')}
                    onChange={() => handleTierSelection('tier1')}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    Tier 1 Core Variables ({tier1Count} variables)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTiers.has('tier2')}
                    onChange={() => handleTierSelection('tier2')}
                    disabled={isExporting}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    Tier 2 Variables ({tier2Count} variables)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border 
                       border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 
                       dark:text-white dark:border-gray-600 dark:hover:bg-gray-600
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