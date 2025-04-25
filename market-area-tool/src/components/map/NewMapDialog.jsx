  import React, { useState, useRef, useEffect } from 'react';
  import Papa from 'papaparse';
  import * as XLSX from 'xlsx';
  import chroma from 'chroma-js'; // Import chroma-js for color ramps

  // Helper function to smartly round numbers based on their magnitude
  const smartRound = (value) => {
    if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
    
    // For values less than 10, round to nearest whole number
    if (Math.abs(value) < 10) {
      return Math.round(value);
    }
    // For values between 10-100, round to nearest 10
    else if (Math.abs(value) < 100) {
      return Math.round(value / 10) * 10;
    }
    // For values between 100-1000, round to nearest 100
    else if (Math.abs(value) < 1000) {
      return Math.round(value / 100) * 100;
    }
    // For values between 1000-10000, round to nearest 1000
    else if (Math.abs(value) < 10000) {
      return Math.round(value / 1000) * 1000;
    }
    // For larger values, round to nearest 10000
    else {
      return Math.round(value / 10000) * 10000;
    }
  };

  // Helper function to generate color ramp
  const generateColorRamp = (color1, color2, count) => {
    const validCount = Math.max(1, count);
    if (validCount === 1) return [color1];
    return chroma.scale([color1, color2]).mode('lch').colors(validCount);
  };

  // Helper function to generate class breaks for point data
  const generateClassBreaksForPoints = (data, valueColumn, numClasses = 5, baseSymbolStyle = {}) => {
    if (!data || data.length === 0 || !valueColumn) {
      console.log("generateClassBreaks: Missing data or valueColumn.");
      return null;
    }

    const values = data
      .map(item => {
        const rawValue = item[valueColumn];
        if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
        const num = Number(rawValue);
        return isNaN(num) ? NaN : num;
      })
      .filter(val => !isNaN(val));

    if (values.length < 2) {
      console.log(`generateClassBreaks: Not enough valid numeric data found in column '${valueColumn}'. Found:`, values.length);
      return null;
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    console.log(`generateClassBreaks: Column '${valueColumn}', Min: ${minValue}, Max: ${maxValue}, Valid Values: ${values.length}`);

    // Apply smart rounding to overall min/max (for display purposes)
    const roundedMin = smartRound(minValue);
    const roundedMax = smartRound(maxValue);

    if (minValue === maxValue) {
      console.log("generateClassBreaks: All valid numeric values are the same. Generating single break.");
      const color = generateColorRamp('#3182CE', '#E53E3E', 1)[0];
      const baseSize = baseSymbolStyle.size !== undefined ? Number(baseSymbolStyle.size) : 10;
      const baseOutlineColor = baseSymbolStyle.outline?.color || '#FFFFFF';
      const baseOutlineWidth = baseSymbolStyle.outline?.width !== undefined ? Number(baseSymbolStyle.outline.width) : 1;
      const baseStyle = baseSymbolStyle.style || 'circle';
      return [{
        minValue: roundedMin, // Use rounded value
        maxValue: roundedMin, // Same as min since they're equal
        label: `${roundedMin.toLocaleString()}`, // Format single value label
        symbol: {
          type: "simple-marker", style: baseStyle, color: color, size: baseSize,
          outline: { color: baseOutlineColor, width: baseOutlineWidth }
        }
      }];
    }

    const validNumClasses = Math.max(1, Math.min(numClasses, values.length));
    // Use original min/max for interval calculation to avoid classification issues
    const range = maxValue - minValue;
    const interval = range > 0 ? range / validNumClasses : 0;
    const breaks = [];

    // Choose a Color Ramp (e.g., Blue to Red)
    const colors = generateColorRamp('#3182CE', '#E53E3E', validNumClasses);

    // Define Base Symbol Properties
    const baseSize = baseSymbolStyle.size !== undefined ? Number(baseSymbolStyle.size) : 10;
    const baseOutlineColor = baseSymbolStyle.outline?.color || '#FFFFFF';
    const baseOutlineWidth = baseSymbolStyle.outline?.width !== undefined ? Number(baseSymbolStyle.outline.width) : 1;
    const baseStyle = baseSymbolStyle.style || 'circle';

    for (let i = 0; i < validNumClasses; i++) {
      const classMinValue = minValue + (i * interval);
      const classMaxValue = (i === validNumClasses - 1) ? maxValue : (minValue + ((i + 1) * interval));

      // Apply smart rounding to min/max values for better readability
      const roundedClassMin = smartRound(classMinValue);
      const roundedClassMax = smartRound(classMaxValue);

      breaks.push({
        minValue: roundedClassMin, // Use smart-rounded value
        maxValue: roundedClassMax, // Use smart-rounded value
        // Use localeString for better number formatting in labels
        label: `${roundedClassMin.toLocaleString()} - ${roundedClassMax.toLocaleString()}`,
        symbol: {
          type: "simple-marker",
          style: baseStyle,
          color: colors[i],
          size: baseSize,
          outline: {
            color: baseOutlineColor,
            width: baseOutlineWidth,
          }
        }
      });
    }

    // Adjustment for overlapping boundaries if interval is not perfect
    for (let i = 0; i < breaks.length - 1; i++) {
      if (breaks[i].maxValue >= breaks[i+1].minValue) {
        // Adjust based on expected precision - using a small relative epsilon might be better
        const epsilon = Math.abs(breaks[i+1].minValue * 0.000001) || 0.000001;
        breaks[i].maxValue = breaks[i+1].minValue - epsilon;
        // Ensure label reflects adjustment if needed, though toLocaleString might hide it
        breaks[i].label = `${breaks[i].minValue.toLocaleString()} - ${breaks[i].maxValue.toLocaleString()}`;
      }
    }
    
    // Ensure the last break max value is exactly the rounded max value from data
    if (breaks.length > 0) {
      breaks[breaks.length - 1].maxValue = roundedMax; // Use rounded max
      breaks[breaks.length - 1].label = `${breaks[breaks.length - 1].minValue.toLocaleString()} - ${roundedMax.toLocaleString()}`;
    }

    console.log("Generated Class Breaks with Smart Rounding:", breaks);
    return breaks;
  };

  // Helper to infer value format
  const getValueFormatForColumn = (columnName, value) => {
    const name = columnName?.toLowerCase() || '';
    const sample = value;

    if (name.includes('price') || name.includes('value') || name.includes('income') || name.includes('cost') || name.includes('sales')) return { prefix: '$', decimals: 0, multiplier: 1 };
    if (name.includes('percent') || name.includes('rate') || name.includes('pct')) return { suffix: '%', decimals: 1, multiplier: 1 };
    if (name.includes('density')) return { suffix: '/sq mi', decimals: 0, multiplier: 1 };
    if (name.includes('age')) return { suffix: ' yrs', decimals: 1, multiplier: 1 };
    if (name.includes('count') || name.includes('total') || name.includes('number')) return { decimals: 0, multiplier: 1 };
    if (typeof sample === 'number') {
      // Refined checks for percentage/currency
      if (!Number.isInteger(sample) && sample > 0 && sample < 1) return { suffix: '%', decimals: 1, multiplier: 100 }; // Likely 0-1 range percent
      if (sample >= 1 && sample <= 100 && (name.includes('%') || name.includes('rate'))) return { suffix: '%', decimals: 1, multiplier: 1 }; // Likely 1-100 range percent
      if (sample > 1000) return { prefix: '$', decimals: 0, multiplier: 1 }; // Likely currency

      return { decimals: Number.isInteger(sample) ? 0 : 2, multiplier: 1 }; // Default numeric format
    }
    return { decimals: 0, prefix: '', suffix: '', multiplier: 1 }; // Default fallback
  };

  // NewMapDialog Component
  const NewMapDialog = ({ isOpen, onClose, onCreateMap, visualizationOptions, areaTypes }) => {
    const [step, setStep] = useState(1);
    const [mapName, setMapName] = useState('New Map');
    const [mapType, setMapType] = useState('comps'); // 'comps', 'pipeline', 'custom', 'heatmap', or 'dotdensity'
    const [selectedVisualization, setSelectedVisualization] = useState('');
    const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);
    const [customData, setCustomData] = useState(null);
    const [columns, setColumns] = useState([]);
    const [labelColumn, setLabelColumn] = useState('');
    const [variable1Column, setVariable1Column] = useState('');
    const [variable2Column, setVariable2Column] = useState('');
    const [valueColumn, setValueColumn] = useState('');
    const [statusColumn, setStatusColumn] = useState('');
    const [latitudeColumn, setLatitudeColumn] = useState('');
    const [longitudeColumn, setLongitudeColumn] = useState('');
    const [fileError, setFileError] = useState('');
    const [generatedClassBreaks, setGeneratedClassBreaks] = useState(null);
    
    // New state for label configuration
    const [labelOptions, setLabelOptions] = useState({
      includeVariables: true,      // Whether to include variables in labels
      avoidCollisions: true,       // Whether to avoid label collisions
      visibleAtAllZooms: false,    // Whether labels are visible at all zoom levels
      fontSize: 10,                // Default label font size
      showLabelConfig: false       // UI toggle for label settings
    });
    
    const fileInputRef = useRef(null);

    // Effect to generate breaks when value column changes for comp/custom
    useEffect(() => {
      if ((mapType === 'comps' || mapType === 'custom') && customData && valueColumn) {
        console.log(`Effect: Triggering break generation for column '${valueColumn}'`);
        // Define a default base symbol style for generation
        const baseSymbol = { size: 10, outline: { color: '#FFFFFF', width: 1 }, style: 'circle' };
        const breaks = generateClassBreaksForPoints(customData, valueColumn, 5, baseSymbol);
        setGeneratedClassBreaks(breaks);
      } else {
        // Clear breaks if map type, data, or value column changes to something not applicable
        if (generatedClassBreaks !== null) { // Avoid clearing if already null
          console.log("Effect: Clearing generated breaks.");
          setGeneratedClassBreaks(null);
        }
      }
    }, [customData, valueColumn, mapType]); // Dependencies: re-run when these change

    // Filter visualization options based on type (heat map or dot density)
    const filteredOptions = visualizationOptions.filter(option => 
      mapType === 'heatmap' ? option.type === 'class-breaks' : 
      mapType === 'dotdensity' ? option.type === 'dot-density' : 
      true
    );

    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      // Reset everything related to the previous file
      setFileError('');
      setCustomData(null);
      setColumns([]);
      setLabelColumn('');
      setVariable1Column('');
      setVariable2Column('');
      setValueColumn('');
      setStatusColumn('');
      setLatitudeColumn('');
      setLongitudeColumn('');
      setGeneratedClassBreaks(null);
      // Clear the file input visually
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      if (!file) return;
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setFileError('File size exceeds 10MB limit');
        return;
      }
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (fileExtension === 'csv') {
        // Handle CSV files with PapaParse
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
        skipEmptyLines: 'greedy', // Skip lines that are truly empty or just whitespace
        transformHeader: header => header.trim(), // Trim header whitespace
        complete: (results) => {
          if (results.errors.length > 0) {
              console.warn("CSV Parsing Errors:", results.errors);
              setFileError(`CSV parsing encountered issues. Check file format near row ${results.errors[0].row}.`);
              // Optionally proceed with results.data if partially parsed
          }
          if (!results.data || results.data.length === 0) {
            setFileError("CSV file appears empty or couldn't be parsed correctly.");
            return;
          }

          // Refined type conversion post-PapaParse
          const typedData = results.data.map(row => {
              const newRow = {};
              for (const key in row) {
                  const value = row[key];
                  // Try explicit number conversion for non-null/non-empty strings
                  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
                      newRow[key] = Number(value);
                  }
                  // Keep numbers that PapaParse already correctly identified (and aren't NaN)
                  else if (typeof value === 'number' && !isNaN(value)) {
                      newRow[key] = value;
                  }
                  // Otherwise, keep the value as is (string, boolean, null, etc.)
                  else {
                      newRow[key] = value;
                  }
              }
              return newRow;
          });
          console.log("CSV Processed Data Sample (first row types):", typedData.length > 0 ? Object.fromEntries(Object.entries(typedData[0]).map(([k,v]) => [k, v === null ? 'null' : typeof v])) : {});
          processFileData(typedData, results.meta.fields || []);
        },
        error: (error) => {
          setFileError(`Error parsing CSV file: ${error.message}`);
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
            cellDates: true, // Recognize dates
            cellNF: false, // Get raw cell values
            cellStyles: false
          });
          
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) throw new Error("Workbook contains no sheets.");
          const worksheet = workbook.Sheets[firstSheetName];
          if (!worksheet) throw new Error(`Sheet '${firstSheetName}' could not be read.`);
          
          // Convert to JSON array of objects
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              raw: true, // Get raw values (numbers, booleans) instead of formatted strings
              defval: null // Represent empty cells as null
          });
          
          if (jsonData.length === 0) {
            setFileError('Excel sheet appears to have no data rows.');
            return;
          }
          
          // Get headers from the keys of the first data object
          const headers = Object.keys(jsonData[0]);
          
          // Data should already have inferred types from SheetJS with raw:true
          console.log("Excel Processed Data Sample (first row types):", jsonData.length > 0 ? Object.fromEntries(Object.entries(jsonData[0]).map(([k,v]) => [k, v === null ? 'null' : typeof v])) : {});
          
          processFileData(jsonData, headers);
        } catch (error) {
          console.error("Excel Parsing Error:", error);
          setFileError(`Error parsing Excel file: ${error.message}. Ensure the first sheet has data.`);
          setCustomData(null);
          setColumns([]);
        }
      };
      
      reader.onerror = (readError) => {
        console.error("File Reading Error:", readError);
        setFileError('Error reading the selected file.');
      };
      
      reader.readAsArrayBuffer(file);
    };
    
    const processFileData = (data, fields) => {
      const validFields = fields.filter(f => f !== undefined && f !== null && String(f).trim() !== '');
      setCustomData(data);
      setColumns(validFields);
      setGeneratedClassBreaks(null); // Reset breaks
      
      // Reset selections
      setLabelColumn('');
      setVariable1Column('');
      setVariable2Column('');
      setValueColumn('');
      setStatusColumn('');
      setLatitudeColumn('');
      setLongitudeColumn('');
      
      if (validFields.length > 0) {
        // Auto-select label column (more robust)
        const potentialLabelCols = ['name', 'title', 'label', 'property', 'id', 'address', 'site'];
        const labelCol = validFields.find(f => potentialLabelCols.some(p => f.toLowerCase().includes(p))) || validFields[0];
        setLabelColumn(labelCol);
        
        // Auto-select variable columns if possible
        // Use heuristics to find potential variable columns (looking for quantitative data columns)
        const numericColumns = [];
        
        // Find numeric columns that aren't lat/lon and ID fields
        const potentialLatLon = ['lat', 'lon', 'lng', 'latitude', 'longitude', 'x', 'y', 'coord', 'east', 'north'];
        const potentialIds = ['id', 'objectid', 'fid', 'pk', 'key'];
        validFields.forEach(field => {
          // Check if the field contains mostly numeric values
          let isNumeric = false;
          let checked = 0;
          for (let i = 0; i < data.length && checked < 5; i++) {
            const value = data[i]?.[field];
            if (value !== null && value !== undefined) {
              isNumeric = typeof value === 'number' && !isNaN(value);
              checked++;
              if (!isNumeric) break;
            }
          }
          
          const isNotLatLon = !potentialLatLon.some(p => field.toLowerCase().includes(p));
          const isNotId = !potentialIds.some(p => field.toLowerCase() === p);
          
          if (isNumeric && isNotLatLon && isNotId) {
            numericColumns.push(field);
          }
        });
        
        // Select the first and second numeric columns for variable1 and variable2
        if (numericColumns.length > 0) {
          setVariable1Column(numericColumns[0]);
          
          // If we have a second numeric column, use it for variable2
          if (numericColumns.length > 1) {
            setVariable2Column(numericColumns[1]);
          }
          
          // If we have a third column, use it for value (or first column if no variable2)
          if (numericColumns.length > 2) {
            setValueColumn(numericColumns[2]);
          } else if (numericColumns.length > 0) {
            setValueColumn(numericColumns[0]);
          }
        }
        
        // Auto-detect status column
        const statusColumns = ['status', 'state', 'condition', 'phase', 'stage'];
        const statusCol = validFields.find(field => statusColumns.some(p => field.toLowerCase().includes(p)));
        if (statusCol) setStatusColumn(statusCol);
        
        // Auto-detect lat/long (more robust)
        const latColumns = ['latitude', 'lat', 'ycoord', 'y'];
        const longColumns = ['longitude', 'long', 'lng', 'xcoord', 'x'];
        // Prioritize exact matches, then broader contains checks
        let latCol = validFields.find(f => latColumns.includes(f.toLowerCase()));
        if (!latCol) latCol = validFields.find(f => f.toLowerCase().includes('lat'));
        let lngCol = validFields.find(f => longColumns.includes(f.toLowerCase()));
        if (!lngCol) lngCol = validFields.find(f => f.toLowerCase().includes('lon') || f.toLowerCase().includes('lng'));
        
        if (latCol) setLatitudeColumn(latCol);
        if (lngCol) setLongitudeColumn(lngCol);
        
        console.log("Auto-detected columns:", { 
          labelCol, 
          variable1: numericColumns[0], 
          variable2: numericColumns.length > 1 ? numericColumns[1] : null,
          valueColumn: numericColumns.length > 2 ? numericColumns[2] : numericColumns[0],
          statusCol, 
          latCol, 
          lngCol 
        });
      }
    };

    // Helper to get a sample value for format inference
    const getSampleValue = (col) => {
      if (!customData || !col) return undefined;
      // Find first non-null value in the column
      for (const row of customData) {
        if (row && row[col] !== null && row[col] !== undefined) {
          return row[col];
        }
      }
      return undefined;
    };

    // Helper to generate a formatted title
    const generateFormattedTitle = () => {
      // Start with the label column
      const hasLabel = !!labelColumn;
      const hasVar1 = !!variable1Column;
      const hasVar2 = !!variable2Column;
      
      // Build title parts
      const parts = [];
      
      // First part is always the label
      parts.push(labelColumn || "Label");
      
      // If we have variables, add them
      if (hasVar1 || hasVar2) {
        const variableParts = [];
        if (hasVar1) variableParts.push(variable1Column);
        if (hasVar2) variableParts.push(variable2Column);
        
        if (variableParts.length > 0) {
          parts.push(variableParts.join(" / "));
        }
      }
      
      // Join the parts with a comma
      return parts.join(", ");
    };

    const handleCreateMap = () => {
      // --- Generate the title using the label and variables ---
      const formattedTitle = generateFormattedTitle();
      
      // --- Base mapData object ---
      const mapData = {
        name: mapName.trim() || formattedTitle, // Use formatted title if no custom name provided
        // We still set top-level type/vizType for context in Map.jsx's handleCreateMap
        type: mapType,
        visualizationType: mapType, // Initially set to the selected mapType
      };

      // --- Default Symbol ---
      const defaultBaseSymbol = {
        type: "simple-marker", // Explicitly set type
        style: 'circle',
        size: 10,
        outline: { color: '#FFFFFF', width: 1 }
      };

      // --- Configuration specific to map type ---
      if (mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') {
        // Point-based maps
        mapData.areaType = { value: 'custom', label: 'Custom Data', url: null }; // Set area type for point data

        // --- Build the layerConfiguration object ---
        const layerConfig = {
          // Core properties expected by layer creators
          title: formattedTitle, // Use the formatted title for display
          type: mapType, // *** CRITICAL: Ensure 'type' is set within layerConfig ***

          // Column references needed by layer creators
          labelColumn: labelColumn,
          variable1Column: variable1Column,
          variable2Column: variable2Column,
          latitudeColumn: latitudeColumn,
          longitudeColumn: longitudeColumn,

          // Base symbol configuration
          symbol: {
            ...defaultBaseSymbol,
            // Assign default color based on type
            color: mapType === 'pipeline' ? '#FFA500' : (mapType === 'comps' ? '#800080' : '#FF0000'),
          },

          // Data payload (nested structure expected by graphics layer creators)
          customData: {
              data: customData || [] // Pass the data array, ensure it's at least empty
          },
          
          // Add new label configuration options
          labelOptions: {
            ...labelOptions,
            // Set default label options based on map type
            fontSize: labelOptions.fontSize,
            includeVariables: labelOptions.includeVariables,
            avoidCollisions: labelOptions.avoidCollisions,
            visibleAtAllZooms: labelOptions.visibleAtAllZooms,
            minZoom: 10, // Default minimum zoom level to show labels
            maxLabelsVisible: 50 // Default max number of labels to show at lower zoom levels
          }
        };

        // Add type-specific properties to layerConfig
        if (mapType === 'comps' || mapType === 'custom') {
          layerConfig.valueColumn = valueColumn; // Add value column
          if (valueColumn && generatedClassBreaks && generatedClassBreaks.length > 0) {
            layerConfig.classBreakInfos = generatedClassBreaks;
            layerConfig.rendererType = 'classBreaks'; // Hint for renderer type
            const sampleValue = getSampleValue(valueColumn);
            layerConfig.valueFormat = getValueFormatForColumn(valueColumn, sampleValue);
            console.log(`[NewMapDialog] Config for ${mapType}: Using generated class breaks for '${valueColumn}'.`);
          } else {
            layerConfig.rendererType = 'simple'; // Hint for renderer type
            console.log(`[NewMapDialog] Config for ${mapType}: No value column or breaks not generated. Using simple renderer.`);
          }
        } else if (mapType === 'pipeline') {
          layerConfig.statusColumn = statusColumn; // Add status column
          layerConfig.rendererType = 'uniqueValue'; // Hint for renderer type (prefer uniqueValue if status exists)
          // Add default status colors here if desired, or let Map.jsx handle defaults
          // layerConfig.statusColors = { ... };
          console.log(`[NewMapDialog] Config for ${mapType}: Status column '${statusColumn}'. Using unique value renderer hint.`);
        }
        // --- End building layerConfiguration ---

        // Assign the fully built configuration object to mapData
        mapData.layerConfiguration = layerConfig;
        // Ensure top-level viz type is also correct (redundant but safe)
        mapData.visualizationType = mapType;

      } else {
        // Heatmap or Dot Density (Standard Layers)
        mapData.areaType = selectedAreaType; // Set the selected area type (e.g., Tract, County)
        // For standard types, visualizationType is the *specific* variable (e.g., 'income_HEAT')
        mapData.visualizationType = selectedVisualization;
        // Standard types don't pass a layerConfig initially; Map.jsx looks it up
        mapData.layerConfiguration = null;
      }

      // Log the final object being sent to the parent
      console.log("[NewMapDialog handleCreateMap] Final mapData object being sent:", JSON.stringify(mapData, (key, value) => {
          // Custom replacer to avoid logging the full data array
          if (key === 'data' && Array.isArray(value)) {
              return `[${value.length} items]`;
          }
          return value;
      }, 2));

      // Call the parent function to create the map/tab
      onCreateMap(mapData);

      // Reset the dialog form and close
      resetForm();
      onClose();
    };
    
    const resetForm = () => {
      setStep(1);
      setMapName('New Map');
      setMapType('comps');
      setSelectedVisualization('');
      setSelectedAreaType(areaTypes[0]);
      setCustomData(null);
      setColumns([]);
      setLabelColumn('');
      setVariable1Column('');
      setVariable2Column('');
      setValueColumn('');
      setStatusColumn('');
      setLatitudeColumn('');
      setLongitudeColumn('');
      setFileError('');
      setGeneratedClassBreaks(null);
      // Reset label options to defaults
      setLabelOptions({
        includeVariables: true,
        avoidCollisions: true,
        visibleAtAllZooms: false,
        fontSize: 10,
        showLabelConfig: false
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onCancel = () => {
      resetForm();
      onClose();
    };

    // Button to go to next step
    const nextStep = () => {
      // Step 1 validation
      if (step === 1) {
        if (!mapName.trim()) {
          setFileError('Please enter a map name.'); 
          return;
        }
        if ((mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && !customData) {
          setFileError('Please upload a data file.'); 
          return;
        }
        if ((mapType === 'heatmap' || mapType === 'dotdensity') && !selectedVisualization) {
          setFileError('Please select a visualization variable.'); 
          return;
        }
      }
      // Step 2 validation (only for point types)
      if (step === 2 && (mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom')) {
        if (!labelColumn) { 
          setFileError('Please select the Label column.'); 
          return; 
        }
        if (!latitudeColumn || !longitudeColumn) { 
          setFileError('Please select both Latitude and Longitude columns.'); 
          return; 
        }
        // Specific checks
        if ((mapType === 'comps' || mapType === 'custom') && !valueColumn) {
          console.warn("Proceeding without a selected Value column for Comp/Custom map."); // Allow proceeding
          if (generatedClassBreaks) setGeneratedClassBreaks(null); // Ensure breaks are cleared if no value col
        }
        if (mapType === 'pipeline' && !statusColumn) { 
          setFileError('Please select the Status column.'); 
          return; 
        }

        // Check lat/lon contain numbers (more robust check across a few rows)
        if (customData && customData.length > 0) {
          let latValid = false, lonValid = false, valValid = true; // Assume value is valid unless proven otherwise
          let checked = 0;
          for(let i = 0; i < customData.length && checked < 5; i++) {
            const row = customData[i];
            if (row) {
              const latValue = row[latitudeColumn];
              const lonValue = row[longitudeColumn];
              if (latValue !== null && latValue !== undefined && !isNaN(Number(latValue))) latValid = true;
              if (lonValue !== null || lonValue !== undefined && !isNaN(Number(lonValue))) lonValid = true;

              // Check value column ONLY if it's selected for comp/custom
              if ((mapType === 'comps' || mapType === 'custom') && valueColumn) {
                const valValue = row[valueColumn];
                // If we find a non-null value that's NOT a number, mark as invalid
                if (valValue !== null && valValue !== undefined && valValue !== '' && isNaN(Number(valValue))) {
                  valValid = false;
                }
              }
              checked++;
            }
          }
          if (!latValid) { 
            setFileError(`Selected Latitude column ('${latitudeColumn}') doesn't seem to contain valid numbers.`); 
            return; 
          }
          if (!lonValid) { 
            setFileError(`Selected Longitude column ('${longitudeColumn}') doesn't seem to contain valid numbers.`); 
            return; 
          }
          if (!valValid) {
            setFileError(`Selected Value column ('${valueColumn}') contains non-numeric data. Automatic legend requires numbers.`);
            setGeneratedClassBreaks(null); // Clear potentially invalid breaks
            // Allow proceeding, but user is warned, and legend won't generate.
          }
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
    
    // Toggle label configuration section visibility
    const toggleLabelConfig = () => {
      setLabelOptions(prev => ({
        ...prev,
        showLabelConfig: !prev.showLabelConfig
      }));
    };
    
    // Update label options
    const updateLabelOption = (option, value) => {
      setLabelOptions(prev => ({
        ...prev,
        [option]: value
      }));
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
                    placeholder="Enter map name (or leave blank to use formatted title)"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Map Type
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        mapType === 'comps'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setMapType('comps')}
                    >
                      <div className="font-medium">Comps Map</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Comparable property data with value fields</div>
                    </div>

                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        mapType === 'pipeline'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setMapType('pipeline')}
                    >
                      <div className="font-medium">Pipeline Map</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Status-based property data (in progress, approved, etc.)</div>
                    </div>

                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        mapType === 'custom'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setMapType('custom')}
                    >
                      <div className="font-medium">Custom Map</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Simple point data with label, location, and value</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Only show Area Type selection for heat maps and dot density */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Geography Level
                  </label>
                  {(mapType === 'heatmap' || mapType === 'dotdensity') ? (
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
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Geography level isn't applicable for point data maps. Your data will be displayed as individual points on the map.
                    </p>
                  )}
                </div>

                {(mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && (
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
                {(mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && (
                  <div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Label Column
                      </label>
                      <select
                        value={labelColumn}
                        onChange={(e) => setLabelColumn(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">Select column...</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        This column will be used for point labels on the map
                      </p>
                    </div>

                    {/* Variable 1 Column Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Variable 1 Column
                      </label>
                      <select
                        value={variable1Column}
                        onChange={(e) => setVariable1Column(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">Select column...</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        This column will be displayed alongside the label in the title format: "Label, Variable 1 / Variable 2"
                      </p>
                    </div>

                    {/* Variable 2 Column Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Variable 2 Column (Optional)
                      </label>
                      <select
                        value={variable2Column}
                        onChange={(e) => setVariable2Column(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">Select column...</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        This optional column will be displayed after Variable 1 in the title format
                      </p>
                    </div>

                    {/* Label Configuration Options */}
                    <div className="mb-6">
                      <div 
                        className="flex items-center justify-between cursor-pointer" 
                        onClick={toggleLabelConfig}
                      >
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Label Display Options
                        </h3>
                        <svg 
                          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform ${labelOptions.showLabelConfig ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      
                      {labelOptions.showLabelConfig && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                          {/* Include Variables Toggle */}
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-gray-700 dark:text-gray-300">
                              Include Variables in Labels
                            </label>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={labelOptions.includeVariables}
                                onChange={(e) => updateLabelOption('includeVariables', e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </div>
                          </div>
                          
                          {/* Label Font Size */}
                          <div className="mb-3">
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                              Label Font Size
                            </label>
                            <div className="flex items-center">
                              <input 
                                type="range" 
                                min="8" 
                                max="14" 
                                step="1"
                                value={labelOptions.fontSize}
                                onChange={(e) => updateLabelOption('fontSize', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                              />
                              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 w-8 text-center">
                                {labelOptions.fontSize}px
                              </span>
                            </div>
                          </div>
                          
                          {/* Avoid Collisions Toggle */}
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-gray-700 dark:text-gray-300">
                              Avoid Label Overlaps
                            </label>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={labelOptions.avoidCollisions}
                                onChange={(e) => updateLabelOption('avoidCollisions', e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </div>
                          </div>
                          
                          {/* Visible at All Zooms Toggle */}
                          <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-700 dark:text-gray-300">
                              Show Labels at All Zoom Levels
                            </label>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={labelOptions.visibleAtAllZooms}
                                onChange={(e) => updateLabelOption('visibleAtAllZooms', e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                            These settings help prevent label clutter and improve map readability. Labels are automatically 
                            prioritized by importance when zoomed out.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Preview of the generated title */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Formatted Title Preview
                      </label>
                      <p className="text-blue-600 dark:text-blue-400 font-medium">
                        {generateFormattedTitle()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        This is how point titles will be formatted in the popup. You can override this with a custom map name above.
                      </p>
                    </div>

                    {/* Value Column (for Comps and Custom) */}
                    {(mapType === 'comps' || mapType === 'custom') && (
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
                        <p className="text-xs text-gray-500 mt-1">
                          This column will determine the data value for each point and will be used to auto-generate class breaks
                        </p>
                      </div>
                    )}

                    {/* Status Column (for Pipeline) */}
                    {mapType === 'pipeline' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Select Status Column
                        </label>
                        <select
                          value={statusColumn}
                          onChange={(e) => setStatusColumn(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">Select column...</option>
                          {columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          This column will show the status for each point (e.g., "In Progress", "Approved", etc.)
                        </p>
                      </div>
                    )}

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
                      <p className="text-xs text-gray-500 mt-1">
                        This column should contain numeric latitude values (typically between -90 and 90)
                      </p>
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
                      <p className="text-xs text-gray-500 mt-1">
                        This column should contain numeric longitude values (typically between -180 and 180)
                      </p>
                    </div>

                    {/* Data Preview (simplified conditional rendering) */}
                    {customData && customData.length > 0 && (labelColumn || variable1Column || variable2Column) && latitudeColumn && longitudeColumn && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Data Preview (First 5 Rows)
                          </label>
                        <div className="border rounded-md overflow-x-auto max-h-60">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                {labelColumn && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Label ({labelColumn})</th>}
                                {variable1Column && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Variable 1 ({variable1Column})</th>}
                                {variable2Column && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Variable 2 ({variable2Column})</th>}
                                {valueColumn && (mapType === 'comps' || mapType === 'custom') && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Value ({valueColumn})</th>}
                                {statusColumn && mapType === 'pipeline' && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status ({statusColumn})</th>}
                                {latitudeColumn && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lat ({latitudeColumn})</th>}
                                {longitudeColumn && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lng ({longitudeColumn})</th>}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-700 dark:divide-gray-600">
                              {customData.slice(0, 5).map((row, index) => (
                                <tr key={index}>
                                  {labelColumn && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[labelColumn]}</td>}
                                  {variable1Column && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[variable1Column]}</td>}
                                  {variable2Column && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[variable2Column]}</td>}
                                  {valueColumn && (mapType === 'comps' || mapType === 'custom') && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[valueColumn]}</td>}
                                  {statusColumn && mapType === 'pipeline' && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[statusColumn]}</td>}
                                  {latitudeColumn && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[latitudeColumn]}</td>}
                                  {longitudeColumn && <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{row[longitudeColumn]}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {customData.length > 5 && (
                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                              Showing 5 of {customData.length} rows
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legend Preview for Comp/Custom */}
                    {(mapType === 'comps' || mapType === 'custom') && valueColumn && (
                      <div className="mt-4 p-3 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700/50">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Generated Legend Preview (Based on '{valueColumn}')</h4>
                        {generatedClassBreaks ? (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {generatedClassBreaks.map((breakInfo, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <div style={{ width: '12px', height: '12px', backgroundColor: breakInfo.symbol.color, borderRadius: '50%', border: `${breakInfo.symbol.outline.width}px solid ${breakInfo.symbol.outline.color}`, flexShrink: 0 }} />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{breakInfo.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">Could not generate legend. Ensure '{valueColumn}' contains valid numeric data. A single point style will be used.</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Legend automatically generated with smart rounding. Values are rounded based on their magnitude for better readability.</p>
                      </div>
                    )}
                    {(mapType === 'comps' || mapType === 'custom') && !valueColumn && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">Select a numeric 'Value Column' to automatically generate a legend based on data ranges with smart rounding.</p>
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

                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Geography Level</h3>
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
                  <p className="text-gray-600 dark:text-gray-300">
                    {mapName || generateFormattedTitle()}
                  </p>

                  <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Map Type</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {mapType === 'comps' ? 'Comps Map' :
                    mapType === 'pipeline' ? 'Pipeline Map' :
                    mapType === 'custom' ? 'Custom Map' :
                    mapType === 'heatmap' ? 'Heat Map' : 'Dot Density'}
                  </p>

                  {(mapType === 'heatmap' || mapType === 'dotdensity') && (
                    <>
                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Geography Level</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {selectedAreaType?.label || 'None selected'}
                      </p>
                    </>
                  )}

                  {(mapType === 'comps' || mapType === 'pipeline' || mapType === 'custom') && (
                    <>
                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Data Source</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Custom Data File ({customData?.length || 0} rows)
                      </p>

                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Formatted Title</h3>
                      <p className="text-gray-600 dark:text-gray-300">{generateFormattedTitle()}</p>

                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Data Columns</h3>
                      <div className="space-y-2">
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Label Column:</span> {labelColumn}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Variable 1:</span> {variable1Column || <span className="italic text-gray-400">None Selected</span>}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Variable 2:</span> {variable2Column || <span className="italic text-gray-400">None Selected</span>}
                        </p>

                        {(mapType === 'comps' || mapType === 'custom') && (
                          <p className="text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Value Column:</span> {valueColumn || <span className="italic text-gray-400">None Selected</span>}
                          </p>
                        )}

                        {mapType === 'pipeline' && (
                          <p className="text-gray-600 dark:text-gray-300">
                            <span className="font-medium">Status Column:</span> {statusColumn}
                          </p>
                        )}
                      </div>

                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Location Coordinates</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Latitude: {latitudeColumn} | Longitude: {longitudeColumn}
                      </p>

                      {/* Label Display Settings */}
                      <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">Label Display</h3>
                      <div className="space-y-1">
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Include Variables:</span> {labelOptions.includeVariables ? 'Yes' : 'No'}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Font Size:</span> {labelOptions.fontSize}px
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Avoid Overlaps:</span> {labelOptions.avoidCollisions ? 'Yes' : 'No'}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Show at All Zooms:</span> {labelOptions.visibleAtAllZooms ? 'Yes' : 'No'}
                        </p>
                      </div>

                      {/* Legend Information */}
                      {(mapType === 'comps' || mapType === 'custom') && valueColumn && generatedClassBreaks && (
                        <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">
                          Legend: <span className="text-green-600 dark:text-green-400">✅ Auto-generated with smart rounding (based on '{valueColumn}')</span>
                        </h3>
                      )}
                      {(mapType === 'comps' || mapType === 'custom') && (!valueColumn || !generatedClassBreaks) && (
                        <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">
                          Legend: <span className="text-gray-600 dark:text-gray-400">⚫ Single symbol style will be used</span>
                        </h3>
                      )}
                      {mapType === 'pipeline' && (
                        <h3 className="font-medium text-gray-900 dark:text-white mt-4 mb-2">
                          Legend: <span className="text-blue-600 dark:text-blue-400">🚦 Status-based (Edit colors later)</span>
                        </h3>
                      )}
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