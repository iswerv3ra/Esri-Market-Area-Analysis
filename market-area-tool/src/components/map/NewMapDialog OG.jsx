import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// NewMapDialog Component
const NewMapDialog = ({ isOpen, onClose, onCreateMap, visualizationOptions, areaTypes }) => {
  const [step, setStep] = useState(1);
  const [mapName, setMapName] = useState('New Map');
  const [mapType, setMapType] = useState('custom'); // 'custom', 'heatmap', or 'dotdensity'
  const [selectedVisualization, setSelectedVisualization] = useState('');
  const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);
  const [customData, setCustomData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [nameColumn, setNameColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [latitudeColumn, setLatitudeColumn] = useState('');
  const [longitudeColumn, setLongitudeColumn] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);

  // Filter visualization options based on type (heat map or dot density)
  const filteredOptions = visualizationOptions.filter(option => 
    mapType === 'heatmap' ? option.type === 'class-breaks' : 
    mapType === 'dotdensity' ? option.type === 'dot-density' : 
    true
  );

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    setFileError('');
    
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setFileError('File size exceeds 10MB limit');
      return;
    }
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
      // Handle CSV files with PapaParse (existing implementation)
      handleCSVFile(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel files with SheetJS
      handleExcelFile(file);
    } else {
      setFileError('Unsupported file format. Please upload a CSV, XLSX, or XLS file.');
      return;
    }
  };
  
  const handleCSVFile = (file) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        processFileData(results.data, results.meta.fields || []);
      },
      error: (error) => {
        setFileError(`Error parsing CSV: ${error.message}`);
        setCustomData(null);
        setColumns([]);
      }
    });
  };
  
  const handleExcelFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true,
          cellNF: true,
          cellStyles: true
        });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          setFileError('Excel file must contain at least a header row and one data row.');
          return;
        }
        
        // Extract header row (first row)
        const headers = jsonData[0];
        
        // Create data objects from rows
        const dataRows = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const dataObj = {};
          
          // Map each cell to its header
          headers.forEach((header, index) => {
            if (header) { // Only include cells with valid headers
              dataObj[header] = row[index];
            }
          });
          
          dataRows.push(dataObj);
        }
        
        processFileData(dataRows, headers);
      } catch (error) {
        setFileError(`Error parsing Excel file: ${error.message}`);
        setCustomData(null);
        setColumns([]);
      }
    };
    
    reader.onerror = () => {
      setFileError('Error reading file');
    };
    
    reader.readAsArrayBuffer(file);
  };
  
  const processFileData = (data, fields) => {
    setCustomData(data);
    setColumns(fields);
    
    // Auto-select first column as name and second (if numeric) as value
    if (fields && fields.length > 0) {
      setNameColumn(fields[0]);
      
      // Find first numeric column for value
      const numericColumn = fields.find(field => {
        return data.length > 0 && typeof data[0][field] === 'number';
      });
      
      if (numericColumn) {
        setValueColumn(numericColumn);
      } else if (fields.length > 1) {
        setValueColumn(fields[1]);
      }
      
      // Auto-detect latitude and longitude columns
      const latCol = fields.find(field => 
        field.toLowerCase().includes('lat') || 
        field.toLowerCase() === 'lat'
      );
      
      const lngCol = fields.find(field => 
        field.toLowerCase().includes('lon') || 
        field.toLowerCase().includes('lng') || 
        field.toLowerCase() === 'lon' || 
        field.toLowerCase() === 'long'
      );
      
      if (latCol) setLatitudeColumn(latCol);
      if (lngCol) setLongitudeColumn(lngCol);
    }
  };

  const handleCreateMap = () => {
    const mapData = {
      name: mapName,
      type: mapType,
      areaType: selectedAreaType
    };
    
    if (mapType === 'custom' && customData) {
      mapData.customData = customData;
      mapData.nameColumn = nameColumn;
      mapData.valueColumn = valueColumn;
      mapData.latitudeColumn = latitudeColumn;
      mapData.longitudeColumn = longitudeColumn;
    } else {
      mapData.visualizationType = selectedVisualization;
    }
    
    onCreateMap(mapData);
    resetForm();
    onClose();
  };
  
  const resetForm = () => {
    setStep(1);
    setMapName('New Map');
    setMapType('custom');
    setSelectedVisualization('');
    setSelectedAreaType(areaTypes[0]);
    setCustomData(null);
    setColumns([]);
    setNameColumn('');
    setValueColumn('');
    setLatitudeColumn('');
    setLongitudeColumn('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCancel = () => {
    resetForm();
    onClose();
  };

  // Button to go to next step
  const nextStep = () => {
    if (step === 1) {
      if (mapType === 'custom' && !customData) {
        setFileError('Please upload a file');
        return;
      }
      if ((mapType === 'heatmap' || mapType === 'dotdensity') && !selectedVisualization) {
        setFileError('Please select a visualization type');
        return;
      }
    }
    if (step === 2 && mapType === 'custom') {
      if (!nameColumn || !valueColumn) {
        setFileError('Please select both name and value columns');
        return;
      }
      if (!latitudeColumn || !longitudeColumn) {
        setFileError('Please select both latitude and longitude columns');
        return;
      }
    }
    
    setStep(step + 1);
    setFileError('');
  };

  // Button to go to previous step
  const prevStep = () => {
    setStep(step - 1);
    setFileError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Create New Map
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Step indicators */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <div 
              className={`pb-2 px-4 border-b-2 ${
                step >= 1 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-gray-500'
              }`}
            >
              1. Map Type
            </div>
            <div 
              className={`pb-2 px-4 border-b-2 ${
                step >= 2 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-gray-500'
              }`}
            >
              2. Configuration
            </div>
            <div 
              className={`pb-2 px-4 border-b-2 ${
                step >= 3 
                  ? 'border-blue-500 text-blue-500' 
                  : 'border-transparent text-gray-500'
              }`}
            >
              3. Review
            </div>
          </div>

          {/* Step 1: Choose Map Type */}
          {step === 1 && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Map Name
                </label>
                <input
                  type="text"
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter map name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Data Area Type
                </label>
                <select
                  value={selectedAreaType.value}
                  onChange={(e) => {
                    const newAreaType = areaTypes.find(type => type.value === parseInt(e.target.value));
                    setSelectedAreaType(newAreaType);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {areaTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Map Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      mapType === 'custom' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                        : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setMapType('custom')}
                  >
                    <div className="font-medium">Custom Data</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Upload your own data</div>
                  </div>
                  
                  <div 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      mapType === 'heatmap' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                        : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setMapType('heatmap')}
                  >
                    <div className="font-medium">Heat Map</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Color-coded gradient data</div>
                  </div>
                  
                  <div 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      mapType === 'dotdensity' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                        : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setMapType('dotdensity')}
                  >
                    <div className="font-medium">Dot Density</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Points representing data</div>
                  </div>
                </div>
              </div>

              {mapType === 'custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Upload Data File
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="sr-only"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        CSV, XLSX, or XLS up to 10MB
                      </p>
                    </div>
                  </div>
                  {customData && (
                    <div className="mt-2 text-sm text-green-600">
                      ✓ File uploaded successfully ({customData.length} rows)
                    </div>
                  )}
                </div>
              )}

              {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Visualization Variable
                  </label>
                  <select
                    value={selectedVisualization}
                    onChange={(e) => setSelectedVisualization(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select a variable...</option>
                    {filteredOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {fileError && (
                <div className="text-red-500 mt-2 text-sm">
                  {fileError}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Data */}
          {step === 2 && (
            <div>
              {mapType === 'custom' && (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Name Column
                    </label>
                    <select
                      value={nameColumn}
                      onChange={(e) => setNameColumn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Value Column
                    </label>
                    <select
                      value={valueColumn}
                      onChange={(e) => setValueColumn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Latitude Column
                    </label>
                    <select
                      value={latitudeColumn}
                      onChange={(e) => setLatitudeColumn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Longitude Column
                    </label>
                    <select
                      value={longitudeColumn}
                      onChange={(e) => setLongitudeColumn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {nameColumn && valueColumn && latitudeColumn && longitudeColumn && customData && customData.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data Preview
                      </label>
                      <div className="border rounded-md overflow-x-auto max-h-60">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Name ({nameColumn})
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Value ({valueColumn})
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Lat ({latitudeColumn})
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Lng ({longitudeColumn})
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-700 dark:divide-gray-600">
                            {customData.slice(0, 5).map((row, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                                  {row[nameColumn]}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                                  {row[valueColumn]}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                                  {row[latitudeColumn]}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                                  {row[longitudeColumn]}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {customData.length > 5 && (
                          <div className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            Showing 5 of {customData.length} rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                <div className="mb-4">
                  <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Selected Visualization</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {filteredOptions.find(opt => opt.value === selectedVisualization)?.label || 'None selected'}
                    </p>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Area Type</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedAreaType?.label || 'None selected'}
                    </p>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Map Type</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {mapType === 'heatmap' ? 'Heat Map' : 'Dot Density'}
                    </p>
                  </div>
                </div>
              )}
              
              {fileError && (
                <div className="text-red-500 mt-2 text-sm">
                  {fileError}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <div>
              <div className="mb-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Map Name</h3>
                <p className="text-gray-600 dark:text-gray-300">{mapName}</p>

                <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Map Type</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {mapType === 'custom' ? 'Custom Data' : mapType === 'heatmap' ? 'Heat Map' : 'Dot Density'}
                </p>
                
                <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Area Type</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {selectedAreaType?.label || 'None selected'}
                </p>

                {mapType === 'custom' && (
                  <>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Data Source</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Custom Data File ({customData?.length || 0} rows)
                    </p>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Name Column</h3>
                    <p className="text-gray-600 dark:text-gray-300">{nameColumn}</p>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Value Column</h3>
                    <p className="text-gray-600 dark:text-gray-300">{valueColumn}</p>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Location Coordinates</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Latitude: {latitudeColumn} | Longitude: {longitudeColumn}
                    </p>
                  </>
                )}

                {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                  <>
                    <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Selected Visualization</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {filteredOptions.find(opt => opt.value === selectedVisualization)?.label || 'None selected'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-between rounded-b-lg">
          {step > 1 ? (
            <button
              onClick={prevStep}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md"
            >
              Cancel
            </button>
          )}
          
          {step < 3 ? (
            <button
              onClick={nextStep}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateMap}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
            >
              Create Map
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewMapDialog;