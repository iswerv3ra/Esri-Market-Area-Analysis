import React from 'react';
import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { TableCellsIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Market area type mapping for consistent formatting
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
  // Add mappings for other types
  'cb': 'CENSUS BLOCK',
  'cbg': 'CENSUS BLOCK GROUP',
  'caa': 'CUSTOM ANALYSIS AREA',
  'project': 'PROJECT',
  'rt': 'RADIUS TARGET'
};

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

  // Updated getStateFullName with error handling
  const getStateFullName = (stateAbbr) => {
    if (!stateAbbr) return '';
    
    const stateMap = {
      'AL': 'Alabama', 'AK': 'Alaska', /* ... rest of state mappings ... */
    };
    
    return stateMap[stateAbbr.trim().toUpperCase()] || stateAbbr;
  };

  const formatMarketAreasForExport = (selectedMarketAreas) => {
    const marketAreaColumns = selectedMarketAreas.map(ma => {
      // Basic data structure with defaults
      let maData = {
        name: ma?.name || '',
        shortName: ma?.short_name || '',
        definitionType: MA_TYPE_MAPPING[ma?.ma_type?.toLowerCase()] || ma?.ma_type?.toUpperCase() || '',
        areasIncluded: '',
        state: '',
      };

      try {
        // Handle different market area types
        switch (ma?.ma_type?.toLowerCase()) {
          case 'zip':
            maData.areasIncluded = ma.locations
              ?.map(loc => loc.name?.split(' - ')?.[0])
              .filter(Boolean)
              .join(', ') || '';
            maData.state = 'CA'; // Default state for ZIP types
            break;

          case 'radius':
            maData.areasIncluded = ma.radius_points
              ?.map(point => `${point.radius} miles`)
              .filter(Boolean)
              .join(', ') || '';
            break;

          case 'county':
            maData.areasIncluded = ma.locations
              ?.map(loc => loc.name)
              .filter(Boolean)
              .join(', ') || '';
            break;

          default:
            // Handle other types of market areas
            maData.areasIncluded = ma.locations
              ?.map(loc => loc.name)
              .filter(Boolean)
              .join(', ') || '';
        }
      } catch (err) {
        console.error('Error processing market area:', err);
      }

      return maData;
    });

    // Create the standardized rows structure
    return {
      headers: ['Market Area Name', 'Short Name', 'Definition Type', 'Areas Included', 'State'],
      rows: marketAreaColumns.map(col => [
        col.name,
        col.shortName,
        col.definitionType,
        col.areasIncluded,
        col.state
      ])
    };
  };

  const processEnrichmentData = (enrichmentResults, selectedMarketAreas) => {
    if (!enrichmentResults?.results?.length) return [];

    return enrichmentResults.results.map((result, index) => {
      const attributes = result?.value?.FeatureSet?.[0]?.features?.[0]?.attributes || {};
      const marketArea = selectedMarketAreas[index];

      return {
        marketAreaName: marketArea?.name || '',
        ...attributes
      };
    });
  };

  const handleExport = () => {
    const selectedMarketAreas = marketAreas.filter(area => selectedAreas.has(area.id));
    let variables = [];
    
    if (exportOption === 'selected-preset' && selectedPresetId) {
      const preset = variablePresets.find(p => p.id === selectedPresetId);
      variables = preset ? preset.variables : [];
    } else if (exportOption === 'all-variables') {
      variables = getAllVariables();
    }

    const formattedData = formatMarketAreasForExport(selectedMarketAreas);
    
    onExport({
      variables,
      formattedMarketAreas: formattedData,
      selectedMarketAreas,
      fileName
    });

    onClose();
  };

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