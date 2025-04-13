// src/components/map/mapLayerUtils.js
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import Color from "@arcgis/core/Color";
import Graphic from "@arcgis/core/Graphic";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";


// --- Function to create Comparison Layer ---
export const createCompLayer = (config) => {
    // Add a log to see the exact config received
    console.log("[createCompLayer] Received config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v)); // Log received config
  
    // Create the graphics layer
    const graphicsLayer = new GraphicsLayer({
      title: config?.title || "Comparison Map Layer",
      listMode: "show"
    });
  
    // --- Corrected Extraction ---
    const data = config?.customData?.data || []; // Get the actual data array
    const nameColumn = config?.nameColumn;
    const valueColumn = config?.valueColumn; // Get valueColumn directly
    const latitudeColumn = config?.latitudeColumn;
    const longitudeColumn = config?.longitudeColumn;
    const symbol = config?.symbol || {};
    const classBreakInfos = config?.classBreakInfos || [];
    // Prioritize rendererType from config, THEN calculate default
    const rendererType = config?.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
    const valueFormat = config?.valueFormat; // Get formatting info
    // --- End Corrected Extraction ---
  
  
    // Force numeric type for size to prevent string values
    const symbolSize = symbol.size !== undefined ? Number(symbol.size) : 12;
    const defaultColor = symbol.color || "#800080"; // Default purple for comp
    const outlineColor = symbol.outline?.color || "#FFFFFF";
    const outlineWidth = symbol.outline?.width !== undefined ?
      Number(symbol.outline.width) : 1;
    const pointStyle = symbol.style || "circle";
  
    // Log comprehensive symbol properties AND crucial config values
    console.log("[createCompLayer] Using effective properties:", {
      size: symbolSize,
      defaultColor: defaultColor,
      style: pointStyle,
      outlineColor: outlineColor,
      outlineWidth: outlineWidth,
      rendererType: rendererType, // Log the *effective* rendererType
      hasBreaks: classBreakInfos.length > 0,
      valueColumn: valueColumn, // Log the *effective* valueColumn
      numDataPoints: data.length
    });
  
    // Helper function to determine point color based on class breaks
    const getColorForValue = (value) => {
      // If no value, value column missing, no breaks, or not classBreaks type - use default color
      if (value === undefined || value === null || value === '' ||
          !valueColumn || // Check if valueColumn NAME is missing
          !classBreakInfos || classBreakInfos.length === 0 ||
          rendererType !== 'classBreaks') { // CRITICAL: Check effective rendererType
        // console.log(`[getColorForValue] Using default color. Value: ${value}, ValueCol: ${valueColumn}, Breaks: ${classBreakInfos?.length}, Renderer: ${rendererType}`);
        return defaultColor;
      }
  
      // Convert value to number
      const numValue = Number(value);
      if (isNaN(numValue)) {
        console.warn(`[getColorForValue] Value "${value}" cannot be converted to a number for column "${valueColumn}". Using default color.`);
        return defaultColor;
      }
  
      // Find the appropriate break
      for (const breakInfo of classBreakInfos) {
         // Handle potential Infinity in maxValue for the last break
         const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined || breakInfo.maxValue === null)
                        ? Infinity
                        : Number(breakInfo.maxValue);
         const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined || breakInfo.minValue === null)
                        ? -Infinity
                        : Number(breakInfo.minValue);
  
         // Check if numValue falls within the break range (inclusive)
         // Handle first break (no min), last break (no max/infinity), and middle breaks
         const isMinMet = (minVal === -Infinity || numValue >= minVal);
         const isMaxMet = (maxVal === Infinity || numValue <= maxVal);
  
         if (isMinMet && isMaxMet) {
          // console.log(`[getColorForValue] Value ${numValue} matches break [${minVal}-${maxVal}]. Color: ${breakInfo.symbol?.color}`);
          return breakInfo.symbol?.color || defaultColor; // Return break color or default if symbol/color missing
        }
      }
  
      // If no matching break found, use default
      console.warn(`[getColorForValue] Value ${numValue} did not match any class breaks. Using default color.`);
      return defaultColor;
    };
  
    // Check if we have the necessary data
    if (Array.isArray(data) && data.length > 0 && // Check the extracted 'data' array
        latitudeColumn && longitudeColumn) {
  
      // Create graphics for each data point
      data.forEach((item, index) => { // Iterate over the extracted 'data' array
        // Skip if missing coordinates
        if (!item[latitudeColumn] || !item[longitudeColumn]) return;
  
        const lat = parseFloat(item[latitudeColumn]);
        const lon = parseFloat(item[longitudeColumn]);
  
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lon)) return;
  
        // Get the value for this point (if using class breaks)
        const pointValue = valueColumn ? item[valueColumn] : null; // Use effective valueColumn
        // Determine the color based on the value and class breaks
        const pointColor = getColorForValue(pointValue); // Call the helper
  
        // Create the point geometry
        const point = new Point({
          longitude: lon,
          latitude: lat,
          spatialReference: { wkid: 4326 }
        });
  
        // Create the symbol with the specified styling
        const pointSymbol = new SimpleMarkerSymbol({
          style: pointStyle,
          size: symbolSize,
          color: new Color(pointColor), // Use determined color
          outline: {
            color: new Color(outlineColor),
            width: outlineWidth
          }
        });
  
        // Create the graphic with attributes
        const graphic = new Graphic({
          geometry: point,
          symbol: pointSymbol,
          attributes: {
            ...item,
            OBJECTID: index,
            displayValue: pointValue, // Value used for classification
            displayName: item[nameColumn] || `Point ${index + 1}`
          },
          popupTemplate: new PopupTemplate({
            title: "{displayName}",
            content: valueColumn ? [ // Only show value field if valueColumn is defined
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "displayValue", // Use the unified displayValue attribute
                    label: valueColumn || "Value", // Use the actual column name as label
                    format: valueFormat ? { // Apply formatting if available
                      digitSeparator: true,
                      places: valueFormat.decimals ?? 0,
                      prefix: valueFormat.prefix || '',
                      suffix: valueFormat.suffix || ''
                    } : { digitSeparator: true, places: 2 } // Default format
                  }
                ]
              }
            ] : [{ type: "text", text: "No value column selected for display."}] // Fallback if no value column
          })
        });
  
        // Add the graphic to the layer
        graphicsLayer.add(graphic);
      });
  
      console.log(`[createCompLayer] Added ${graphicsLayer.graphics.length} points to comp layer "${graphicsLayer.title}".`);
    } else {
      console.warn("[createCompLayer] Missing required data for comp layer: customData array, latitudeColumn, or longitudeColumn");
    }
  
    return graphicsLayer;
  };

// --- Function to create Pipeline Layer ---
export const createPipeLayer = (config) => {
    console.log("Creating Pipe Layer with config:", config);
    
    // Early validation check - quit if critical data is missing
    if (!config || !config.customData || !Array.isArray(config.customData.data) || 
        config.customData.data.length === 0 || !config.latitudeColumn || !config.longitudeColumn) {
      console.warn("Missing required data for pipeline layer: customData, latitudeColumn, or longitudeColumn");
      // Return a valid but empty layer instead of null to avoid errors
      return new GraphicsLayer({
        title: config?.title || "Pipeline Map Layer (Empty)",
        listMode: "show"
      });
    }
    
    // Create the graphics layer
    const graphicsLayer = new GraphicsLayer({
      title: config?.title || "Pipeline Map Layer",
      listMode: "show"
    });
    
    // Extract needed configuration
    const { 
      customData, 
      nameColumn, 
      statusColumn, 
      valueColumn,  // Add support for numeric value column
      latitudeColumn, 
      longitudeColumn,
      symbol = {},
      statusColors = {},
      classBreakInfos = [],
      rendererType = classBreakInfos.length > 0 ? 'classBreaks' : (statusColumn ? 'uniqueValue' : 'simple')
    } = config;
    
    // Define default symbol properties
    const defaultSymbol = {
      type: "simple-marker",
      style: "circle",
      size: 12,
      color: "#FFA500", // Orange default for pipe
      outline: {
        color: "#FFFFFF",
        width: 1
      }
    };
    
    // Force numeric type for size to prevent string values
    const symbolSize = symbol.size !== undefined ? Number(symbol.size) : defaultSymbol.size;
    
    // Create a complete symbol object with proper type handling
    const completeSymbol = {
      type: symbol.type || defaultSymbol.type,
      style: symbol.style || defaultSymbol.style,
      size: symbolSize,
      color: symbol.color || defaultSymbol.color,
      outline: {
        color: symbol.outline?.color || defaultSymbol.outline.color,
        width: symbol.outline?.width !== undefined ? 
          Number(symbol.outline.width) : defaultSymbol.outline.width
      }
    };
    
    // Log the symbol properties we're using for debugging
    console.log("Using pipe symbol properties:", {
      size: completeSymbol.size,
      color: completeSymbol.color,
      style: completeSymbol.style,
      outlineColor: completeSymbol.outline.color,
      outlineWidth: completeSymbol.outline.width,
      rendererType: rendererType,
      hasValueColumn: !!valueColumn,
      hasStatusColumn: !!statusColumn,
      hasBreaks: classBreakInfos.length > 0
    });
    
    // Status color mapping with defaults
    const defaultStatusColors = {
      "In Progress": "#FFB900",
      "Approved": "#107C10",
      "Pending": "#0078D4",
      "Completed": "#107C10",
      "Rejected": "#D13438",
      "default": completeSymbol.color // Use the main color as default
    };
    
    // Merge default status colors with provided ones
    const mergedStatusColors = {
      ...defaultStatusColors,
      ...statusColors
    };
    
    // Helper function to determine point color based on class breaks
    const getColorForValue = (value) => {
      // If no value, value column, or class breaks - use default color
      if (value === undefined || value === null || 
          !valueColumn || 
          !classBreakInfos || classBreakInfos.length === 0 || 
          rendererType !== 'classBreaks') {
        return completeSymbol.color;
      }
      
      // Convert value to number
      const numValue = Number(value);
      if (isNaN(numValue)) {
        console.warn(`Value "${value}" cannot be converted to a number. Using default color.`);
        return completeSymbol.color;
      }
      
      // Find the appropriate break
      for (const breakInfo of classBreakInfos) {
        if ((breakInfo.minValue === undefined || numValue >= breakInfo.minValue) && 
            (breakInfo.maxValue === undefined || numValue <= breakInfo.maxValue)) {
          return breakInfo.symbol?.color || completeSymbol.color;
        }
      }
      
      // If no matching break found, use default
      return completeSymbol.color;
    };
    
    try {
      // Extract the data array correctly
      const dataArray = customData.data || customData;
      
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        console.warn("Pipeline layer has no valid data points");
        return graphicsLayer; // Return empty layer
      }
      
      // Debug data
      console.log(`Processing ${dataArray.length} pipeline data points with columns:`, {
        name: nameColumn,
        lat: latitudeColumn,
        lon: longitudeColumn,
        status: statusColumn,
        value: valueColumn
      });
      
      // Create graphics for each data point
      let addedCount = 0;
      let skippedCount = 0;
      const graphicsToAdd = [];
      
      dataArray.forEach((item, index) => {
        // Skip if missing coordinates
        if (!item[latitudeColumn] || !item[longitudeColumn]) {
          skippedCount++;
          return;
        }
        
        const lat = parseFloat(item[latitudeColumn]);
        const lon = parseFloat(item[longitudeColumn]);
        
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lon)) {
          skippedCount++;
          return;
        }
        
        // Determine point color based on rendering type
        let pointColor = completeSymbol.color; // Default
        
        if (rendererType === 'classBreaks' && valueColumn) {
          // Class breaks based on numeric value
          const pointValue = item[valueColumn];
          pointColor = getColorForValue(pointValue);
        } 
        else if (rendererType === 'uniqueValue' || rendererType === 'uniqueValueOrSimple') {
          // Status-based coloring
          const status = item[statusColumn] || "default";
          pointColor = mergedStatusColors[status] || mergedStatusColors.default;
        }
        
        try {
          // Create the point geometry
          const point = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 }
          });
          
          // Create the symbol with status-based color and explicit properties
          const pointSymbol = new SimpleMarkerSymbol({
            style: completeSymbol.style,
            size: completeSymbol.size,
            color: new Color(pointColor),
            outline: {
              color: new Color(completeSymbol.outline.color),
              width: completeSymbol.outline.width
            }
          });
          
          // Create content for popup based on available columns
          const fieldInfos = [];
          
          if (statusColumn && item[statusColumn]) {
            fieldInfos.push({ fieldName: "status", label: statusColumn || "Status" });
          }
          
          if (valueColumn && item[valueColumn] !== undefined) {
            fieldInfos.push({ 
              fieldName: "value", 
              label: valueColumn || "Value",
              format: config.valueFormat ? {
                digitSeparator: true,
                places: config.valueFormat.decimals || 0,
                prefix: config.valueFormat.prefix || '',
                suffix: config.valueFormat.suffix || ''
              } : null
            });
          }
          
          // Create the graphic with attributes
          const graphic = new Graphic({
            geometry: point,
            symbol: pointSymbol,
            attributes: {
              ...item,
              OBJECTID: index,
              displayName: item[nameColumn] || `Point ${index + 1}`,
              status: item[statusColumn] || "Unknown",
              value: valueColumn ? item[valueColumn] : null
            },
            popupTemplate: new PopupTemplate({
              title: "{displayName}",
              content: fieldInfos.length > 0 ? [
                {
                  type: "fields",
                  fieldInfos: fieldInfos
                }
              ] : "No additional information available"
            })
          });
          
          // Add to batch array instead of directly to layer
          graphicsToAdd.push(graphic);
          addedCount++;
        } catch (pointError) {
          console.error(`Error creating point graphic at index ${index}:`, pointError);
          skippedCount++;
        }
      });
      
      // Add all graphics at once for performance
      if (graphicsToAdd.length > 0) {
        graphicsLayer.addMany(graphicsToAdd);
      }
      
      console.log(`Pipeline layer creation complete: Added ${addedCount} points, skipped ${skippedCount} invalid points`);
    } catch (error) {
      console.error("Error during pipeline layer creation:", error);
    }
    
    // Always return a valid layer, even if empty
    return graphicsLayer;
  };

// --- Function to create GraphicsLayer from Custom Data ---
// Make sure the dynamic imports are handled correctly within this function
export async function createGraphicsLayerFromCustomData(config) {
    // Log the received config
    console.log("[createGraphicsLayerFromCustomData] Creating graphics layer with config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));
  
    if (!config || !config.customData || !Array.isArray(config.customData.data)) {
      console.error("[createGraphicsLayerFromCustomData] Invalid configuration for custom data layer:", config);
      return null;
    }
  
    // Ensure GraphicsLayer and other modules are imported
    let GraphicsLayer, Point, SimpleMarkerSymbol, PopupTemplate, Color, Graphic;
     try {
         [{ default: GraphicsLayer }, { default: Point }, { default: SimpleMarkerSymbol }, { default: PopupTemplate }, { default: Color }, { default: Graphic }] = await Promise.all([
             import("@arcgis/core/layers/GraphicsLayer"),
             import("@arcgis/core/geometry/Point"),
             import("@arcgis/core/symbols/SimpleMarkerSymbol"),
             import("@arcgis/core/PopupTemplate"),
             import("@arcgis/core/Color"),
             import("@arcgis/core/Graphic")
         ]);
     } catch (importError) {
         console.error("Failed to import ArcGIS Core modules:", importError);
         return null;
     }
  
  
    const customLayer = new GraphicsLayer({
      title: config.title || "Custom Data Points",
      listMode: "show",
    });
    // Set flags
    customLayer.isVisualizationLayer = true;
    customLayer.isCustomDataLayer = true;
    customLayer.visualizationType = "custom"; // Explicitly set type
  
    // --- Corrected Extraction ---
    const data = config.customData.data || [];
    const nameColumn = config.nameColumn || config.customData.nameColumn;
    const valueColumn = config.field || config.valueColumn || config.customData.valueColumn;
    const latitudeColumn = config.latitudeColumn || config.customData.latitudeColumn || "latitude";
    const longitudeColumn = config.longitudeColumn || config.customData.longitudeColumn || "longitude";
    const symbolConfig = config.symbol || {};
    const classBreakInfos = config.classBreakInfos || [];
    const rendererType = config.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
    const valueFormat = config.valueFormat;
    // --- End Corrected Extraction ---
  
    if (data.length === 0) {
      console.warn("[createGraphicsLayerFromCustomData] No data points found in configuration for custom layer.");
      return customLayer; // Return empty layer
    }
  
    // --- Default Symbol Properties ---
    const defaultColor = '#FF0000'; // Default Red for custom
    const defaultSize = 10;
    const defaultOutlineColor = '#FFFFFF';
    const defaultOutlineWidth = 1;
    const defaultStyle = 'circle';
  
    const pointColor = symbolConfig.color || defaultColor;
    const pointSize = typeof symbolConfig.size === 'number' && !isNaN(symbolConfig.size)
                        ? symbolConfig.size : defaultSize;
    const outlineConfig = symbolConfig.outline || {};
    const outlineColor = outlineConfig.color || defaultOutlineColor;
    const outlineWidth = typeof outlineConfig.width === 'number' && !isNaN(outlineConfig.width)
                           ? outlineConfig.width : defaultOutlineWidth;
    const pointStyle = symbolConfig.style || defaultStyle;
    // --- End Default Symbol ---
  
    console.log("[createGraphicsLayerFromCustomData] Using symbol style:", {
        style: pointStyle, size: pointSize, defaultColor: pointColor,
        outlineColor: outlineColor, outlineWidth: outlineWidth,
        rendererType: rendererType, valueColumn: valueColumn, hasBreaks: classBreakInfos.length > 0
    });
  
    // Helper function (same as in createCompLayer)
    const getColorForValue = (value) => {
       if (value === undefined || value === null || value === '' ||
           !valueColumn || !classBreakInfos || classBreakInfos.length === 0 ||
           rendererType !== 'classBreaks') {
         return pointColor; // Use default custom color if not class breaks
       }
       const numValue = Number(value);
       if (isNaN(numValue)) { return pointColor; }
       for (const breakInfo of classBreakInfos) {
           const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined || breakInfo.maxValue === null) ? Infinity : Number(breakInfo.maxValue);
           const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined || breakInfo.minValue === null) ? -Infinity : Number(breakInfo.minValue);
           const isMinMet = (minVal === -Infinity || numValue >= minVal);
           const isMaxMet = (maxVal === Infinity || numValue <= maxVal);
           if (isMinMet && isMaxMet) { return breakInfo.symbol?.color || pointColor; }
       }
       return pointColor;
    };
  
    // Create popup template based on available columns
    let popupTemplate = null;
    const fieldInfos = [];
    // Always add name if column exists
    if (nameColumn) fieldInfos.push({ fieldName: nameColumn, label: nameColumn || "Name" });
    // Add value if column exists
    if (valueColumn) fieldInfos.push({
        fieldName: valueColumn, // Use original value column name for binding
        label: valueColumn || "Value",
        format: valueFormat ? {
          digitSeparator: true,
          places: valueFormat.decimals ?? 0,
          prefix: valueFormat.prefix || '',
          suffix: valueFormat.suffix || ''
        } : { digitSeparator: true, places: 2 } // Default format
    });
     // Add Lat/Lon
    fieldInfos.push({ fieldName: latitudeColumn, label: 'Latitude', format: { places: 6 } });
    fieldInfos.push({ fieldName: longitudeColumn, label: 'Longitude', format: { places: 6 } });
  
    popupTemplate = new PopupTemplate({
        // Use nameColumn for title if available, otherwise a generic title
        title: nameColumn ? `{${nameColumn}}` : "Custom Point",
        content: [{ type: "fields", fieldInfos: fieldInfos }]
    });
  
  
    let addedCount = 0;
    let errorCount = 0;
    const graphicsToAdd = [];
  
    data.forEach((item, index) => {
      let latitude, longitude;
      // Robust coordinate extraction
       if (item[latitudeColumn] !== undefined && item[longitudeColumn] !== undefined) {
          latitude = parseFloat(item[latitudeColumn]); longitude = parseFloat(item[longitudeColumn]);
      } else if (item.geometry && typeof item.geometry.y === "number" && typeof item.geometry.x === "number") {
          latitude = item.geometry.y; longitude = item.geometry.x;
      } else if (typeof item["lat"] === "number" && typeof item["lon"] === "number") {
          latitude = item["lat"]; longitude = item["lon"];
      } else if (typeof item["latitude"] === "number" && typeof item["longitude"] === "number") {
          latitude = item["latitude"]; longitude = item["longitude"];
      } else {
          console.warn(`[createGraphicsLayerFromCustomData] Item ${index} missing valid coordinates using columns '${latitudeColumn}' and '${longitudeColumn}'. Skipping.`);
          errorCount++; return;
      }
  
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          console.warn(`[createGraphicsLayerFromCustomData] Item ${index} has invalid coordinates (Lat: ${latitude}, Lon: ${longitude}). Skipping.`);
          errorCount++; return;
      }
  
      try {
        const point = new Point({
          longitude: longitude,
          latitude: latitude,
          spatialReference: { wkid: 4326 },
        });
  
        // Get the value and determine color based on class breaks/rendererType
        const pointValue = valueColumn ? item[valueColumn] : null;
        const itemColor = getColorForValue(pointValue);
  
        const markerSymbol = new SimpleMarkerSymbol({
          style: pointStyle,
          color: new Color(itemColor), // Use determined color
          size: pointSize,
          outline: {
            color: new Color(outlineColor),
            width: outlineWidth
          },
        });
  
        // Prepare attributes, ensuring popup fields exist
        const attributes = {
          ...item, // Include all original data
          OBJECTID: index, // Standard field
          // Ensure columns needed for popup binding exist
          [latitudeColumn]: latitude,
          [longitudeColumn]: longitude,
          ...(nameColumn && { [nameColumn]: item[nameColumn] ?? "N/A" }),
          ...(valueColumn && { [valueColumn]: item[valueColumn] ?? null }),
        };
  
        const pointGraphic = new Graphic({
          geometry: point,
          symbol: markerSymbol,
          attributes: attributes,
          popupTemplate: popupTemplate, // Use the single template
        });
  
        graphicsToAdd.push(pointGraphic);
        addedCount++;
      } catch (graphicError) {
        console.error(`[createGraphicsLayerFromCustomData] Error creating graphic for custom data point ${index}:`, graphicError, "Item:", item);
        errorCount++;
      }
    });
  
    if (graphicsToAdd.length > 0) {
      customLayer.addMany(graphicsToAdd);
    }
  
    console.log(`[createGraphicsLayerFromCustomData] Added ${addedCount} points to custom graphics layer "${customLayer.title}". ${errorCount} errors occurred.`);
    return customLayer;
  }

// --- Main Layer Factory Function ---
// IMPORTANT: This function now needs the layerConfigs and selectedAreaType passed to it
export const createLayers = async (
    visualizationType,
    configOverride = null,
    layerConfigs = initialLayerConfigurations, // Keep using the global one passed down
    selectedAreaType = areaTypes[0]
  ) => {
    // --- Input Validation and Config Setup ---
    if (!visualizationType && !configOverride?.type) {
      console.error("[createLayers] No visualization type or config type provided.");
      return null;
    }
  
    const baseConfig = layerConfigs[visualizationType];
    let config = configOverride || baseConfig;
  
    if (!config) {
       console.warn(`[createLayers] No specific config found for '${visualizationType}'. Using minimal defaults based on type.`);
       // Create a minimal structure, the specific creators will handle defaults
       config = { type: visualizationType };
    } else if (configOverride) {
        console.log("[createLayers] Using provided config override:", configOverride);
        config = { ...configOverride }; // Clone override
    } else {
        console.log(`[createLayers] Using initial config for '${visualizationType}'.`);
        config = { ...baseConfig }; // Clone base config
    }
  
    // Ensure config always has a type property, prioritizing override/base, then visualizationType
    if (!config.type) {
        config.type = visualizationType;
    }
    // --- End Config Setup ---
  
  
    // --- Normalize Type ---
    let effectiveVizType = config.type; // Start with type from config
    if (effectiveVizType === "pipeline") effectiveVizType = "pipe";
    if (effectiveVizType === "comps") effectiveVizType = "comp";
    // Further normalization based on legacy naming, if needed
    if (effectiveVizType && effectiveVizType.endsWith('_HEAT')) {
        console.log(`[createLayers] Normalizing HEAT type ${effectiveVizType} to class-breaks`);
        effectiveVizType = 'class-breaks';
        config.type = 'class-breaks'; // Update config type as well
    }
    // Use base config type if type is still ambiguous (e.g., just 'income')
    if (baseConfig && baseConfig.type && !['pipe', 'comp', 'custom', 'class-breaks', 'dot-density'].includes(effectiveVizType)) {
        console.log(`[createLayers] Using base config type '${baseConfig.type}' for ambiguous type '${effectiveVizType}'`);
        effectiveVizType = baseConfig.type;
        config.type = effectiveVizType; // Update config type
    }
  
    console.log(`[createLayers] Effective visualization type determined as: ${effectiveVizType}`);
    // --- End Normalize Type ---
  
  
    // --- Handle Special GraphicsLayer Types ---
    const specialTypes = ["pipe", "comp", "custom"];
    const hasCustomData = config.customData && Array.isArray(config.customData.data) && config.customData.data.length > 0;
  
    // **Revised Logic: Prioritize explicit type match**
    if (specialTypes.includes(effectiveVizType)) {
        console.log(`[createLayers] Explicitly handling special type: ${effectiveVizType}`);
        let graphicsLayer = null;
        try {
            if (effectiveVizType === "pipe") {
                graphicsLayer = createPipeLayer(config); // Pass full config
            } else if (effectiveVizType === "comp") {
                graphicsLayer = createCompLayer(config); // Pass full config
            } else if (effectiveVizType === "custom") {
                graphicsLayer = await createGraphicsLayerFromCustomData(config); // Pass full config
            }
  
            // Add standard flags AFTER creation if not done inside creators
            if (graphicsLayer instanceof GraphicsLayer) {
                graphicsLayer.isVisualizationLayer = true;
                // Type is already set inside creators now
                console.log(`[createLayers] Successfully created GraphicsLayer: "${graphicsLayer.title}", type: "${graphicsLayer.visualizationType}"`);
                return graphicsLayer;
            } else {
                console.error(`[createLayers] Failed to create a valid GraphicsLayer for type ${effectiveVizType}.`);
                return null;
            }
        } catch (error) {
            console.error(`[createLayers] Error creating GraphicsLayer for ${effectiveVizType}:`, error);
            return null;
        }
    }
    // --- Fallback for custom types if type wasn't explicitly set but data exists ---
    else if (hasCustomData && !['class-breaks', 'dot-density'].includes(effectiveVizType)) {
        console.log(`[createLayers] Handling as 'custom' based on customData presence and non-standard type '${effectiveVizType}'.`);
        try {
            // Force type to custom in config if needed
            config.type = 'custom';
            const graphicsLayer = await createGraphicsLayerFromCustomData(config);
             if (graphicsLayer instanceof GraphicsLayer) {
                graphicsLayer.isVisualizationLayer = true;
                // Type is set inside creator
                console.log(`[createLayers] Successfully created fallback custom GraphicsLayer: "${graphicsLayer.title}", type: "${graphicsLayer.visualizationType}"`);
                return graphicsLayer;
             } else {
                 console.error(`[createLayers] Failed to create fallback custom GraphicsLayer.`);
                 return null;
             }
        } catch (error) {
             console.error(`[createLayers] Error creating fallback custom GraphicsLayer:`, error);
             return null;
        }
    }
    // --- End Handle Special GraphicsLayer Types ---
  
  
    // --- Standard Heatmap/Dot Density Logic (using FeatureLayer) ---
    console.log(`[createLayers] Handling as standard type: ${effectiveVizType}`);
  
    if (!selectedAreaType?.url) {
      console.error(`[createLayers] Invalid area type for standard visualization '${effectiveVizType}': No URL.`, selectedAreaType);
      return null;
    }
  
    // Renderer creation logic (ensure FeatureLayer is imported)
    const createRenderer = (rendererConfig, areaType) => { // Pass areaType for defaults
      if (!rendererConfig || !rendererConfig.type) {
        console.warn("[createLayers->createRenderer] Invalid config provided", rendererConfig);
        return null;
      }
      if (!rendererConfig.field && (rendererConfig.type === "dot-density" || rendererConfig.type === "class-breaks")) {
        console.error(`[createLayers->createRenderer] Cannot create renderer for type ${rendererConfig.type}: Missing required 'field'.`);
        return null;
      }
  
      switch (rendererConfig.type) {
        case "dot-density":
          // Determine default dot value based on area type
          const defaultDotVal = (areaType?.value === 12 || String(areaType?.value).toLowerCase() === 'tract') ? 10 : 100;
          const currentDotValue = rendererConfig.dotValue !== undefined ? Number(rendererConfig.dotValue) : defaultDotVal;
  
          // Ensure attributes exist and are correctly structured
          let attributes = rendererConfig.attributes;
          if (!Array.isArray(attributes) || attributes.length === 0) {
            attributes = [{
              field: rendererConfig.field,
              color: "#E60049", // Default color
              label: rendererConfig.label || rendererConfig.field || "Value",
            }];
            console.warn(`[createLayers->createRenderer] Dot density config missing 'attributes', created default for field: ${rendererConfig.field}`);
          }
  
          attributes = attributes.map(attr => ({
            field: attr.field || rendererConfig.field,
            color: attr.color || "#E60049",
            label: attr.label || attr.field || rendererConfig.field,
          }));
  
          return {
            type: "dot-density",
            field: rendererConfig.field,
            dotValue: currentDotValue,
            dotBlending: rendererConfig.dotBlending || "additive",
            dotSize: rendererConfig.dotSize !== undefined ? Number(rendererConfig.dotSize) : 2,
            outline: rendererConfig.outline || { width: 0.5, color: [50, 50, 50, 0.2] },
            legendOptions: rendererConfig.legendOptions || { unit: "value" },
            attributes: attributes,
          };
  
        case "class-breaks":
          const classBreakInfos = Array.isArray(rendererConfig.classBreakInfos) ? rendererConfig.classBreakInfos : [];
          if (classBreakInfos.length === 0) {
            console.warn(`[createLayers->createRenderer] Class breaks config for field ${rendererConfig.field} is missing 'classBreakInfos'. Renderer might not display correctly.`);
          }
          return {
            type: "class-breaks",
            field: rendererConfig.field,
            defaultSymbol: rendererConfig.defaultSymbol || {
              type: "simple-fill",
              color: [0, 0, 0, 0], // Transparent fill
              outline: { color: [150, 150, 150, 0.5], width: 0.5 }, // Default outline
            },
            defaultLabel: rendererConfig.defaultLabel || "No data",
            classBreakInfos: classBreakInfos,
          };
        default:
          console.error("[createLayers->createRenderer] Unsupported standard renderer type:", rendererConfig.type);
          return null;
      }
    };
  
    // Layer definitions for Popups (Simplified)
    const getLayerDefinition = (vizType, cfg) => {
        // Prefer label/field from config if available
        const label = cfg?.attributes?.[0]?.label || cfg?.label || cfg?.field || vizType.replace(/_/g, ' ');
        const field = cfg?.field;
        // Basic number format as default
        const format = cfg?.valueFormat || { digitSeparator: true, places: (cfg?.type === 'class-breaks' ? 1 : 0) };
  
        return { title: label, fieldName: field, format: format };
    };
  
    const layerDef = getLayerDefinition(effectiveVizType, config);
  
    // Create and return the FeatureLayer
    let featureLayer = null;
    try {
      const renderer = createRenderer(config, selectedAreaType); // Pass area type
  
      if (!renderer) {
        console.error(`[createLayers] Failed to create renderer for type ${config.type}.`);
        return null;
      }
  
      // Simplified popup - assuming 'NAME' field exists on the service for area name
      const popupTemplate = layerDef.fieldName ? {
        title: `${selectedAreaType.label} {NAME}`,
        content: [{
          type: "fields",
          fieldInfos: [{
            fieldName: layerDef.fieldName,
            label: layerDef.title,
            format: layerDef.format
          }]
        }]
      } : {
          title: `${selectedAreaType.label} {NAME}`,
          content: "No specific data field configured for popup."
      };
  
      // MinScale based on area type
      const minScale = (selectedAreaType?.value === 12 || String(selectedAreaType?.value).toLowerCase() === 'tract')
                       ? 2500000
                       : 25000000; // Larger scale for County etc.
  
      featureLayer = new FeatureLayer({
        url: selectedAreaType.url,
        renderer: renderer,
        popupTemplate: popupTemplate,
        title: layerDef.title, // Use title from definition
        minScale: minScale,
        outFields: ["*", "NAME"], // Ensure NAME and all other fields are requested
        definitionExpression: config.definitionExpression || null // Add support for definition expressions if needed
      });
  
      // Add standard flags
      featureLayer.isVisualizationLayer = true;
      featureLayer.visualizationType = effectiveVizType; // Store the *effective* type
  
      console.log(`[createLayers] FeatureLayer created: "${featureLayer.title}", type: "${featureLayer.visualizationType}"`);
  
    } catch (error) {
      console.error("[createLayers] Failed to create FeatureLayer:", error);
      return null;
    }
  
    return featureLayer;
  };

// --- Optional Helper ---
// Move this if you created it and want to keep it separate
// export const extractSymbolProperties = (config) => {
//   // ... paste the implementation ...
// };