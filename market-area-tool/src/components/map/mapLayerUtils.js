/**
 * Creates a comparison map layer with improved label handling
 * 
 * @param {Object} config - Configuration for the comp layer
 * @returns {GraphicsLayer} The configured comparison graphics layer
 */
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import Color from "@arcgis/core/Color";
import Graphic from "@arcgis/core/Graphic";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { formatPointLabel, generatePointTitle } from './labelutils';

export const createCompLayer = (config) => {
  // Log the received config
  console.log("[createCompLayer] Received config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));
  
  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Comparison Map Layer",
    listMode: "show"
  });

  // --- Extract data and column information ---
  const data = config?.customData?.data || [];
  const labelColumn = config?.labelColumn;
  const variable1Column = config?.variable1Column;
  const variable2Column = config?.variable2Column;
  const valueColumn = config?.valueColumn || config?.field;
  const latitudeColumn = config?.latitudeColumn;
  const longitudeColumn = config?.longitudeColumn;
  const symbol = config?.symbol || {};
  const classBreakInfos = config?.classBreakInfos || [];
  const rendererType = config?.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
  const valueFormat = config?.valueFormat;
  
  // --- Extract label configuration ---
  const labelOptions = config?.labelOptions || {};
  const fontSize = labelOptions.fontSize || 10;
  const includeVariables = labelOptions.includeVariables !== false; // Default to true
  const avoidCollisions = labelOptions.avoidCollisions !== false; // Default to true
  const visibleAtAllZooms = labelOptions.visibleAtAllZooms || false;
  const minZoom = labelOptions.minZoom || 10; // Default minimum zoom for labels
  
  // Set flag for visibility tracking
  graphicsLayer.labelVisibilityTracking = { 
    enabled: !visibleAtAllZooms,
    minimumZoom: minZoom,
    currentlyVisible: false
  };

  // Force numeric type for size to prevent string values
  const symbolSize = symbol.size !== undefined ? Number(symbol.size) : 12;
  const defaultColor = symbol.color || "#800080"; // Default purple for comp
  const outlineColor = symbol.outline?.color || "#FFFFFF";
  const outlineWidth = symbol.outline?.width !== undefined ?
    Number(symbol.outline.width) : 1;
  const pointStyle = symbol.style || "circle";

  // Helper function to determine point color based on class breaks
  const getColorForValue = (value) => {
    // If no value, value column missing, no breaks, or not classBreaks type - use default color
    if (value === undefined || value === null || value === '' ||
        !valueColumn || // Check if valueColumn NAME is missing
        !classBreakInfos || classBreakInfos.length === 0 ||
        rendererType !== 'classBreaks') { // CRITICAL: Check effective rendererType
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
       const isMinMet = (minVal === -Infinity || numValue >= minVal);
       const isMaxMet = (maxVal === Infinity || numValue <= maxVal);

       if (isMinMet && isMaxMet) {
        return breakInfo.symbol?.color || defaultColor; // Return break color or default if symbol/color missing
      }
    }

    // If no matching break found, use default
    console.warn(`[getColorForValue] Value ${numValue} did not match any class breaks. Using default color.`);
    return defaultColor;
  };

  // Check if we have the necessary data
  if (Array.isArray(data) && data.length > 0 && latitudeColumn && longitudeColumn) {
    // Create a map to store label position adjustments
    const labelPositions = new Map();
    
    // Get point data ready for anti-collision calculation if needed
    if (avoidCollisions) {
      // First pass: gather point positions for label collision detection
      const pointData = data.map((item, index) => {
        // Skip if missing coordinates
        if (!item[latitudeColumn] || !item[longitudeColumn]) return null;

        const lat = parseFloat(item[latitudeColumn]);
        const lon = parseFloat(item[longitudeColumn]);
        
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lon)) return null;
        
        // Generate label text
        const labelText = formatPointLabel(item, {
          labelColumn,
          variable1Column,
          variable2Column,
          labelOptions: { includeVariables }
        });
        
        return {
          id: `label-${index}`,
          screenX: 0, // Will be calculated later from geographic coords
          screenY: 0, // Will be calculated later from geographic coords
          latitude: lat,
          longitude: lon,
          labelText,
          priority: index < 20 ? 2 : 1 // Prioritize first 20 points
        };
      }).filter(Boolean); // Remove null values
      
      // To be implemented: Use ArcGIS view.toScreen() to convert geographic coords to screen coords
      // For now, we'll use a placeholder arrangement in a grid pattern
      
      // Arrange in a grid pattern for demonstration
      const gridSize = Math.ceil(Math.sqrt(pointData.length));
      pointData.forEach((point, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        point.screenX = col * 100; // 100px spacing in grid
        point.screenY = row * 100; // 100px spacing in grid
      });
      
      // Calculate label positions to avoid collisions
      // In a real implementation this would be calculated on each view update
      // For now we'll generate static positions that avoid simple grid collisions
      const positions = pointData.map((point, index) => {
        const offset = [0, fontSize + 4]; // Default to below the point
        
        // Stagger label positions in a deterministic way based on index
        // This creates a pattern where adjacent points get different offsets
        const patternIndex = index % 4;
        switch (patternIndex) {
          case 0: // Below
            offset[0] = 0;
            offset[1] = fontSize + 4;
            break;
          case 1: // Right
            offset[0] = fontSize + 4;
            offset[1] = 0;
            break;
          case 2: // Above
            offset[0] = 0;
            offset[1] = -(fontSize + 4);
            break;
          case 3: // Left
            offset[0] = -(fontSize + 4);
            offset[1] = 0;
            break;
        }
        
        return {
          id: point.id,
          x: offset[0],
          y: offset[1],
          visible: index < 50 // Limit visible labels to 50
        };
      });
      
      // Store calculated positions
      positions.forEach(pos => {
        labelPositions.set(pos.id, pos);
      });
    }

    // Create graphics for each data point
    data.forEach((item, index) => {
      // Skip if missing coordinates
      if (!item[latitudeColumn] || !item[longitudeColumn]) return;

      const lat = parseFloat(item[latitudeColumn]);
      const lon = parseFloat(item[longitudeColumn]);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lon)) return;

      // Get the value for this point (if using class breaks)
      const pointValue = valueColumn ? item[valueColumn] : null;
      // Determine the color based on the value and class breaks
      const pointColor = getColorForValue(pointValue);

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

      // Generate formatted title for popup
      const pointTitle = generatePointTitle(item, {
        labelColumn,
        variable1Column,
        variable2Column
      });

      // Create the graphic with attributes
      const graphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          ...item,
          OBJECTID: index,
          displayValue: pointValue, // Value used for classification
          displayName: pointTitle // Use the formatted title
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

      // Add the point graphic to the layer
      graphicsLayer.add(graphic);
      
      // Create label text (includes variables if configured)
      const labelText = formatPointLabel(item, {
        labelColumn,
        variable1Column, 
        variable2Column,
        labelOptions: { includeVariables }
      });
      
      // Get label position if we're avoiding collisions
      const labelId = `label-${index}`;
      let labelOffset = { x: 0, y: fontSize + 4, visible: true }; // Default offset
      
      if (avoidCollisions && labelPositions.has(labelId)) {
        labelOffset = labelPositions.get(labelId);
      }
      
      // Create a text symbol for the label with the configured font size
      const textSymbol = new TextSymbol({
        text: labelText,
        font: {
          size: fontSize,
          family: "sans-serif",
          weight: "normal"
        },
        color: new Color([0, 0, 0, 0.9]),
        haloColor: new Color([255, 255, 255, 0.9]),
        haloSize: 1,
        xoffset: labelOffset.x, // Apply calculated x offset 
        yoffset: labelOffset.y, // Apply calculated y offset
      });
      
      // Create a label graphic
      const labelGraphic = new Graphic({
        geometry: point,
        symbol: textSymbol,
        attributes: {
          ...item,
          OBJECTID: `label-${index}`,
          parentID: index,
          isLabel: true,
          visible: labelOffset.visible && (visibleAtAllZooms || false) // Initially invisible if configured
        },
        // Labels should be invisible at low zoom levels if configured
        visible: labelOffset.visible && visibleAtAllZooms
      });
      
      // Add the label graphic to the layer
      graphicsLayer.add(labelGraphic);
    });

    console.log(`[createCompLayer] Added ${graphicsLayer.graphics.length} points and labels to comp layer "${graphicsLayer.title}".`);
    
    // Add a watch handler to show/hide labels based on zoom level
    // This would be set up in the Map.jsx or other parent component
    // using view.watch("zoom", (newZoom) => {...})
  } else {
    console.warn("[createCompLayer] Missing required data for comp layer: customData array, latitudeColumn, or longitudeColumn");
  }
  
  return graphicsLayer;
};

/**
 * Creates a pipeline map layer with improved label handling
 * 
 * @param {Object} config - Configuration for the pipeline layer
 * @returns {GraphicsLayer} The configured pipeline graphics layer
 */
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
  
  // Extract needed configuration with updated column names
  const { 
    customData, 
    labelColumn,
    variable1Column,
    variable2Column,
    statusColumn, 
    valueColumn,
    latitudeColumn, 
    longitudeColumn,
    symbol = {},
    statusColors = {},
    classBreakInfos = [],
    rendererType = classBreakInfos.length > 0 ? 'classBreaks' : (statusColumn ? 'uniqueValue' : 'simple')
  } = config;
  
  // --- Extract label configuration ---
  const labelOptions = config?.labelOptions || {};
  const fontSize = labelOptions.fontSize || 10;
  const includeVariables = labelOptions.includeVariables !== false; // Default to true
  const avoidCollisions = labelOptions.avoidCollisions !== false; // Default to true
  const visibleAtAllZooms = labelOptions.visibleAtAllZooms || false;
  const minZoom = labelOptions.minZoom || 10; // Default minimum zoom for labels
  
  // Set flag for visibility tracking
  graphicsLayer.labelVisibilityTracking = { 
    enabled: !visibleAtAllZooms,
    minimumZoom: minZoom,
    currentlyVisible: false
  };
  
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
  
  try {
    // Extract the data array correctly
    const dataArray = customData.data || customData;
    
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn("Pipeline layer has no valid data points");
      return graphicsLayer; // Return empty layer
    }
    
    // Create a map to store label position adjustments for anti-collision
    const labelPositions = new Map();
    
    // First pass: gather point positions for label collision detection if needed
    if (avoidCollisions) {
      const pointData = dataArray
        .map((item, index) => {
          // Skip if missing coordinates
          if (!item[latitudeColumn] || !item[longitudeColumn]) return null;

          const lat = parseFloat(item[latitudeColumn]);
          const lon = parseFloat(item[longitudeColumn]);
          
          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lon)) return null;
          
          // Generate label text
          const labelText = formatPointLabel(item, {
            labelColumn,
            variable1Column,
            variable2Column,
            labelOptions: { includeVariables }
          });
          
          return {
            id: `label-${index}`,
            screenX: 0, // Will be calculated later
            screenY: 0, // Will be calculated later
            latitude: lat,
            longitude: lon,
            labelText,
            priority: index < 20 ? 2 : 1 // Prioritize first 20 points
          };
        })
        .filter(Boolean); // Remove null values
      
      // Arrange in a grid pattern for demonstration (in real implementation, use view.toScreen())
      const gridSize = Math.ceil(Math.sqrt(pointData.length));
      pointData.forEach((point, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        point.screenX = col * 100; // 100px spacing
        point.screenY = row * 100; // 100px spacing
      });
      
      // Calculate label positions to avoid collisions
      // Use staggered pattern similar to comp layer
      const positions = pointData.map((point, index) => {
        const offset = [0, fontSize + 4]; // Default below
        
        // Stagger label positions based on index
        const patternIndex = index % 8;
        const directions = [
          [0, fontSize + 4],       // Below
          [fontSize + 4, 0],       // Right
          [0, -(fontSize + 4)],    // Above
          [-(fontSize + 4), 0],    // Left
          [fontSize + 4, fontSize + 4],    // Bottom-right
          [-(fontSize + 4), fontSize + 4], // Bottom-left
          [fontSize + 4, -(fontSize + 4)], // Top-right
          [-(fontSize + 4), -(fontSize + 4)] // Top-left
        ];
        
        offset[0] = directions[patternIndex][0];
        offset[1] = directions[patternIndex][1];
        
        return {
          id: point.id,
          x: offset[0],
          y: offset[1],
          visible: index < 50 // Limit visible labels to 50
        };
      });
      
      // Store calculated positions
      positions.forEach(pos => {
        labelPositions.set(pos.id, pos);
      });
    }
    
    // Create graphics for each data point
    let addedCount = 0;
    let skippedCount = 0;
    
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
        // Similar color determination as in comp layer
        if (pointValue !== undefined && pointValue !== null && 
            classBreakInfos && classBreakInfos.length > 0) {
          const numValue = Number(pointValue);
          if (!isNaN(numValue)) {
            for (const breakInfo of classBreakInfos) {
              if ((breakInfo.minValue === undefined || numValue >= breakInfo.minValue) && 
                  (breakInfo.maxValue === undefined || numValue <= breakInfo.maxValue)) {
                pointColor = breakInfo.symbol?.color || completeSymbol.color;
                break;
              }
            }
          }
        }
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
        
        // Generate formatted title including variables for popup
        const pointTitle = generatePointTitle(item, {
          labelColumn,
          variable1Column,
          variable2Column
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
            displayName: pointTitle,
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
        
        // Add the point graphic to the layer
        graphicsLayer.add(graphic);
        
        // Create label text that includes variables if configured
        const labelText = formatPointLabel(item, {
          labelColumn,
          variable1Column, 
          variable2Column,
          labelOptions: { includeVariables }
        });
        
        // Get label position if we're avoiding collisions
        const labelId = `label-${index}`;
        let labelOffset = { x: 0, y: fontSize + 4, visible: true }; // Default offset
        
        if (avoidCollisions && labelPositions.has(labelId)) {
          labelOffset = labelPositions.get(labelId);
        }
        
        // Create a text symbol for the label with applied offset and font size
        const textSymbol = new TextSymbol({
          text: labelText,
          font: {
            size: fontSize,
            family: "sans-serif",
            weight: "normal"
          },
          color: new Color([0, 0, 0, 0.9]),
          haloColor: new Color([255, 255, 255, 0.9]),
          haloSize: 1,
          xoffset: labelOffset.x, // Apply calculated x offset
          yoffset: labelOffset.y, // Apply calculated y offset
        });
        
        // Create a label graphic
        const labelGraphic = new Graphic({
          geometry: point,
          symbol: textSymbol,
          attributes: {
            ...item,
            OBJECTID: `label-${index}`,
            parentID: index,
            isLabel: true,
            visible: labelOffset.visible
          },
          // Labels should be invisible at low zoom levels if configured
          visible: labelOffset.visible && visibleAtAllZooms
        });
        
        // Add the label graphic to the layer
        graphicsLayer.add(labelGraphic);
        
        addedCount++;
      } catch (pointError) {
        console.error(`Error creating point graphic at index ${index}:`, pointError);
        skippedCount++;
      }
    });
    
    console.log(`Pipeline layer creation complete: Added ${addedCount} points with labels, skipped ${skippedCount} invalid points`);
  } catch (error) {
    console.error("Error during pipeline layer creation:", error);
  }
  
  return graphicsLayer;
};

/**
 * Creates a custom data map layer with improved label handling
 * 
 * @param {Object} config - Configuration for the custom data layer
 * @returns {Promise<GraphicsLayer>} The configured custom graphics layer
 */
export async function createGraphicsLayerFromCustomData(config) {
  // Log the received config
  console.log("[createGraphicsLayerFromCustomData] Creating graphics layer with config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));

  if (!config || !config.customData || !Array.isArray(config.customData.data)) {
    console.error("[createGraphicsLayerFromCustomData] Invalid configuration for custom data layer:", config);
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

  // --- Enhanced data extraction ---
  const data = config.customData.data || [];
  const labelColumn = config.labelColumn || config.customData.labelColumn;
  const variable1Column = config.variable1Column || config.customData.variable1Column;
  const variable2Column = config.variable2Column || config.customData.variable2Column;
  const valueColumn = config.field || config.valueColumn || config.customData.valueColumn;
  const latitudeColumn = config.latitudeColumn || config.customData.latitudeColumn || "latitude";
  const longitudeColumn = config.longitudeColumn || config.customData.longitudeColumn || "longitude";
  const symbolConfig = config.symbol || {};
  const classBreakInfos = config.classBreakInfos || [];
  const rendererType = config.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
  const valueFormat = config.valueFormat;
  
  // --- Extract label configuration ---
  const labelOptions = config?.labelOptions || {};
  const fontSize = labelOptions.fontSize || 10;
  const includeVariables = labelOptions.includeVariables !== false; // Default to true
  const avoidCollisions = labelOptions.avoidCollisions !== false; // Default to true
  const visibleAtAllZooms = labelOptions.visibleAtAllZooms || false;
  const minZoom = labelOptions.minZoom || 10; // Default minimum zoom for labels
  
  // Set flag for visibility tracking
  customLayer.labelVisibilityTracking = { 
    enabled: !visibleAtAllZooms,
    minimumZoom: minZoom,
    currentlyVisible: false
  };

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

  // Helper function to determine color based on class breaks
  const getColorForValue = (value) => {
    if (value === undefined || value === null || value === '' ||
        !valueColumn || !classBreakInfos || classBreakInfos.length === 0 ||
        rendererType !== 'classBreaks') {
      return pointColor; // Use default color
    }
    
    const numValue = Number(value);
    if (isNaN(numValue)) { return pointColor; }
    
    for (const breakInfo of classBreakInfos) {
      const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined) 
                    ? Infinity : Number(breakInfo.maxValue);
      const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined) 
                    ? -Infinity : Number(breakInfo.minValue);
                    
      if ((minVal === -Infinity || numValue >= minVal) && 
          (maxVal === Infinity || numValue <= maxVal)) {
        return breakInfo.symbol?.color || pointColor;
      }
    }
    
    return pointColor;
  };

  // Create popup template based on available columns
  let popupTemplate = null;
  const fieldInfos = [];
  // Always add name if column exists
  if (labelColumn) fieldInfos.push({ fieldName: labelColumn, label: labelColumn || "Name" });
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
      title: "{displayName}",
      content: [{ type: "fields", fieldInfos: fieldInfos }]
  });
  
  // First pass: gather point positions for label collision detection if needed
  const labelPositions = new Map();
  
  if (avoidCollisions) {
    const pointData = data
      .map((item, index) => {
        // Skip if missing coordinates
        let latitude, longitude;
        
        // Robust coordinate extraction
        if (item[latitudeColumn] !== undefined && item[longitudeColumn] !== undefined) {
            latitude = parseFloat(item[latitudeColumn]); 
            longitude = parseFloat(item[longitudeColumn]);
        } else if (item.geometry && typeof item.geometry.y === "number" && typeof item.geometry.x === "number") {
            latitude = item.geometry.y; 
            longitude = item.geometry.x;
        } else if (typeof item["lat"] === "number" && typeof item["lon"] === "number") {
            latitude = item["lat"]; 
            longitude = item["lon"];
        } else if (typeof item["latitude"] === "number" && typeof item["longitude"] === "number") {
            latitude = item["latitude"]; 
            longitude = item["longitude"];
        } else {
            return null; // Skip invalid coordinates
        }
        
        if (isNaN(latitude) || isNaN(longitude)) return null;
        
        // Generate label text
        const labelText = formatPointLabel(item, {
          labelColumn,
          variable1Column,
          variable2Column,
          labelOptions: { includeVariables }
        });
        
        return {
          id: `label-${index}`,
          screenX: 0, // Will be calculated later
          screenY: 0, // Will be calculated later
          latitude,
          longitude,
          labelText,
          priority: index < 20 ? 2 : 1 // Prioritize first 20 points
        };
      })
      .filter(Boolean); // Remove null values
    
    // Arrange in a grid pattern for demonstration (in real implementation, use view.toScreen())
    const gridSize = Math.ceil(Math.sqrt(pointData.length));
    pointData.forEach((point, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      point.screenX = col * 100; // 100px spacing
      point.screenY = row * 100; // 100px spacing
    });
    
    // Use advanced staggered pattern for label positioning
    const positions = pointData.map((point, index) => {
      // Create a quasi-random but deterministic pattern based on index
      // This helps distribute labels more evenly than simple rotation
      const seed = (index * 17) % 100; // Use prime number multiplication for better distribution
      let x = 0, y = 0, visible = true;
      
      // Use the seed to determine position
      if (seed < 20) {
        // Below
        x = 0;
        y = fontSize + 4;
      } else if (seed < 40) {
        // Right
        x = fontSize + 4;
        y = 0;
      } else if (seed < 60) {
        // Above
        x = 0;
        y = -(fontSize + 4);
      } else if (seed < 80) {
        // Left
        x = -(fontSize + 4);
        y = 0;
      } else {
        // Diagonals for remaining 20%
        const diagonalType = seed % 4;
        const offset = fontSize + 4;
        
        switch (diagonalType) {
          case 0: // Top-right
            x = offset;
            y = -offset;
            break;
          case 1: // Bottom-right
            x = offset;
            y = offset;
            break;
          case 2: // Bottom-left
            x = -offset;
            y = offset;
            break;
          case 3: // Top-left
            x = -offset;
            y = -offset;
            break;
        }
      }
      
      // Limit visible labels based on priority and position
      visible = (point.priority > 1) || (index < 50);
      
      return {
        id: point.id,
        x,
        y,
        visible
      };
    });
    
    // Store calculated positions
    positions.forEach(pos => {
      labelPositions.set(pos.id, pos);
    });
  }

  let addedCount = 0;
  let errorCount = 0;
  
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
        console.warn(`[createGraphicsLayerFromCustomData] Item ${index} missing valid coordinates. Skipping.`);
        errorCount++; return;
    }

    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.warn(`[createGraphicsLayerFromCustomData] Item ${index} has invalid coordinates. Skipping.`);
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

      // Generate formatted title for popup using all variables
      const pointTitle = generatePointTitle(item, {
        labelColumn,
        variable1Column,
        variable2Column
      });

      // Prepare attributes, ensuring popup fields exist
      const attributes = {
        ...item, // Include all original data
        OBJECTID: index, // Standard field
        // Ensure columns needed for popup binding exist
        [latitudeColumn]: latitude,
        [longitudeColumn]: longitude,
        displayName: pointTitle, // Use the formatted title
        ...(labelColumn && { [labelColumn]: item[labelColumn] ?? "N/A" }),
        ...(valueColumn && { [valueColumn]: item[valueColumn] ?? null }),
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        attributes: attributes,
        popupTemplate: popupTemplate, // Use the single template
      });

      // Add the point graphic to the layer
      customLayer.add(pointGraphic);
      
      // Create label text (includes variables if configured)
      const labelText = formatPointLabel(item, {
        labelColumn,
        variable1Column, 
        variable2Column,
        labelOptions: { includeVariables }
      });
      
      // Get label position if we're avoiding collisions
      const labelId = `label-${index}`;
      let labelOffset = { x: 0, y: fontSize + 4, visible: true }; // Default offset
      
      if (avoidCollisions && labelPositions.has(labelId)) {
        labelOffset = labelPositions.get(labelId);
      }
      
      // Create a text symbol for the label with applied offset and font size
      const textSymbol = new TextSymbol({
        text: labelText,
        font: {
          size: fontSize,
          family: "sans-serif",
          weight: "normal"
        },
        color: new Color([0, 0, 0, 0.9]),
        haloColor: new Color([255, 255, 255, 0.9]),
        haloSize: 1,
        xoffset: labelOffset.x, // Apply calculated x offset
        yoffset: labelOffset.y, // Apply calculated y offset
      });
      
      // Create a label graphic
      const labelGraphic = new Graphic({
        geometry: point,
        symbol: textSymbol,
        attributes: {
          ...item,
          OBJECTID: `label-${index}`,
          parentID: index,
          isLabel: true,
          visible: labelOffset.visible
        },
        // Labels should be invisible at low zoom levels if configured
        visible: labelOffset.visible && visibleAtAllZooms
      });
      
      // Add the label graphic to the layer
      customLayer.add(labelGraphic);
      
      addedCount++;
    } catch (graphicError) {
      console.error(`[createGraphicsLayerFromCustomData] Error creating graphic for point ${index}:`, graphicError);
      errorCount++;
    }
  });

  console.log(`[createGraphicsLayerFromCustomData] Added ${addedCount} points with labels to custom graphics layer. ${errorCount} errors occurred.`);
  return customLayer;
}

/**
 * Creates and returns an appropriate layer based on visualization type
 * 
 * @param {string} visualizationType - Type of visualization to create
 * @param {Object} configOverride - Configuration overrides for the layer
 * @param {Object} layerConfigs - Base layer configurations
 * @param {Object} selectedAreaType - Selected area type object
 * @returns {Promise<FeatureLayer|GraphicsLayer>} The created layer
 */
export async function createLayers(
    visualizationType,
    configOverride = null,
    layerConfigs = {}, 
    selectedAreaType = null
) {
    // Input validation and configuration setup
    if (!visualizationType && !configOverride?.type) {
        console.error("[createLayers] No visualization type or config type provided.");
        return null;
    }

    const baseConfig = layerConfigs[visualizationType];
    let config = configOverride || baseConfig;

    if (!config) {
        console.warn(`[createLayers] No specific config found for '${visualizationType}'. Using minimal defaults based on type.`);
        // Create a minimal structure, specific creators will handle defaults
        config = { type: visualizationType };
    } else if (configOverride) {
        console.log("[createLayers] Using provided config override");
        config = { ...configOverride }; // Clone override
    } else {
        console.log(`[createLayers] Using initial config for '${visualizationType}'`);
        config = { ...baseConfig }; // Clone base config
    }

    // Ensure config always has a type property
    if (!config.type) {
        config.type = visualizationType;
    }

    // Normalize visualization type
    let effectiveVizType = config.type;
    if (effectiveVizType === "pipeline") effectiveVizType = "pipe";
    if (effectiveVizType === "comps") effectiveVizType = "comp";
    
    if (effectiveVizType && effectiveVizType.endsWith('_HEAT')) {
        console.log(`[createLayers] Normalizing HEAT type ${effectiveVizType} to class-breaks`);
        effectiveVizType = 'class-breaks';
        config.type = 'class-breaks';
    }
    
    // Use base config type if still ambiguous
    if (baseConfig && baseConfig.type && 
        !['pipe', 'comp', 'custom', 'class-breaks', 'dot-density'].includes(effectiveVizType)) {
        console.log(`[createLayers] Using base config type '${baseConfig.type}' for ambiguous type '${effectiveVizType}'`);
        effectiveVizType = baseConfig.type;
        config.type = effectiveVizType;
    }

    console.log(`[createLayers] Effective visualization type determined as: ${effectiveVizType}`);

    // Handle special GraphicsLayer types
    const specialTypes = ["pipe", "comp", "custom"];
    const hasCustomData = config.customData && Array.isArray(config.customData.data) && config.customData.data.length > 0;

    if (specialTypes.includes(effectiveVizType)) {
        console.log(`[createLayers] Handling special type: ${effectiveVizType}`);
        let graphicsLayer = null;
        
        try {
            if (effectiveVizType === "pipe") {
                graphicsLayer = createPipeLayer(config);
            } else if (effectiveVizType === "comp") {
                graphicsLayer = createCompLayer(config);
            } else if (effectiveVizType === "custom") {
                graphicsLayer = await createGraphicsLayerFromCustomData(config);
            }

            if (graphicsLayer instanceof GraphicsLayer) {
                graphicsLayer.isVisualizationLayer = true;
                graphicsLayer.visualizationType = effectiveVizType;
                console.log(`[createLayers] Successfully created GraphicsLayer: "${graphicsLayer.title}", type: "${graphicsLayer.visualizationType}"`);
                return graphicsLayer;
            } else {
                console.error(`[createLayers] Failed to create a valid GraphicsLayer for type ${effectiveVizType}`);
                return null;
            }
        } catch (error) {
            console.error(`[createLayers] Error creating GraphicsLayer for ${effectiveVizType}:`, error);
            return null;
        }
    }
    // Fallback for custom data with non-standard type
    else if (hasCustomData && !['class-breaks', 'dot-density'].includes(effectiveVizType)) {
        console.log(`[createLayers] Handling as 'custom' based on customData presence and non-standard type '${effectiveVizType}'`);
        try {
            config.type = 'custom';
            const graphicsLayer = await createGraphicsLayerFromCustomData(config);
            if (graphicsLayer instanceof GraphicsLayer) {
                graphicsLayer.isVisualizationLayer = true;
                graphicsLayer.visualizationType = 'custom';
                console.log(`[createLayers] Successfully created fallback custom GraphicsLayer: "${graphicsLayer.title}"`);
                return graphicsLayer;
            } else {
                console.error(`[createLayers] Failed to create fallback custom GraphicsLayer`);
                return null;
            }
        } catch (error) {
            console.error(`[createLayers] Error creating fallback custom GraphicsLayer:`, error);
            return null;
        }
    }

    // Standard FeatureLayer implementation for heatmap/dot density
    console.log(`[createLayers] Handling as standard type: ${effectiveVizType}`);
    
    if (!selectedAreaType?.url) {
        console.error(`[createLayers] Invalid area type for standard visualization '${effectiveVizType}': No URL.`, selectedAreaType);
        return null;
    }

    try {
        // Create renderer for the feature layer
        const renderer = createRenderer(config, selectedAreaType);
        if (!renderer) {
            console.error(`[createLayers] Failed to create renderer for ${effectiveVizType}`);
            return null;
        }

        // Create feature layer with proper configuration
        const featureLayer = new FeatureLayer({
            url: selectedAreaType.url,
            renderer: renderer,
            popupTemplate: createPopupTemplate(effectiveVizType, config, selectedAreaType),
            title: config.title || effectiveVizType,
            minScale: selectedAreaType.value === 12 ? 2500000 : 25000000,
            outFields: ["*", "NAME"],
            definitionExpression: config.definitionExpression || null
        });

        // Set visualization flags
        featureLayer.isVisualizationLayer = true;
        featureLayer.visualizationType = effectiveVizType;

        console.log(`[createLayers] FeatureLayer created: "${featureLayer.title}", type: "${featureLayer.visualizationType}"`);
        return featureLayer;
    } catch (error) {
        console.error(`[createLayers] Failed to create FeatureLayer:`, error);
        return null;
    }
}

/**
 * Create a renderer for feature layers based on configuration and area type
 * 
 * @param {Object} rendererConfig - Configuration for the renderer
 * @param {Object} areaType - Area type information
 * @returns {Object} The configured renderer
 */
function createRenderer(rendererConfig, areaType) {
    if (!rendererConfig || !rendererConfig.type) {
        console.warn("[createRenderer] Invalid config provided", rendererConfig);
        return null;
    }
    
    if (!rendererConfig.field && 
        (rendererConfig.type === "dot-density" || rendererConfig.type === "class-breaks")) {
        console.error(`[createRenderer] Cannot create renderer for type ${rendererConfig.type}: Missing required 'field'`);
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
                    color: "#E60049",
                    label: rendererConfig.label || rendererConfig.field || "Value",
                }];
                console.warn(`[createRenderer] Dot density config missing 'attributes', created default for field: ${rendererConfig.field}`);
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
                console.warn(`[createRenderer] Class breaks config for field ${rendererConfig.field} is missing 'classBreakInfos'`);
            }
            return {
                type: "class-breaks",
                field: rendererConfig.field,
                defaultSymbol: rendererConfig.defaultSymbol || {
                    type: "simple-fill",
                    color: [0, 0, 0, 0],
                    outline: { color: [150, 150, 150, 0.5], width: 0.5 },
                },
                defaultLabel: rendererConfig.defaultLabel || "No data",
                classBreakInfos: classBreakInfos,
            };
            
        default:
            console.error("[createRenderer] Unsupported renderer type:", rendererConfig.type);
            return null;
    }
}

/**
 * Create a popup template for feature layers
 * 
 * @param {string} vizType - Visualization type
 * @param {Object} config - Layer configuration
 * @param {Object} selectedAreaType - Area type information
 * @returns {Object} The configured popup template
 */
function createPopupTemplate(vizType, config, selectedAreaType) {
    // Get field and formatting information
    const label = config?.attributes?.[0]?.label || config?.label || config?.field || vizType.replace(/_/g, ' ');
    const field = config?.field;
    const format = config?.valueFormat || { 
        digitSeparator: true, 
        places: (config?.type === 'class-breaks' ? 1 : 0) 
    };

    if (!field) {
        return {
            title: `${selectedAreaType.label} {NAME}`,
            content: "No specific data field configured for popup."
        };
    }

    return {
        title: `${selectedAreaType.label} {NAME}`,
        content: [{
            type: "fields",
            fieldInfos: [{
                fieldName: field,
                label: label,
                format: format
            }]
        }]
    };
}

/**
 * Factory function to update label visibility based on zoom level
 * 
 * @param {MapView} view - The ArcGIS MapView
 * @param {GraphicsLayer} layer - The graphics layer containing labels
 */
export function setupLabelVisibilityHandling(view, layer) {
  if (!view || !layer || !layer.labelVisibilityTracking?.enabled) return;
  
  const tracking = layer.labelVisibilityTracking;
  const minZoom = tracking.minimumZoom || 10;
  
  // Watch for zoom changes
  const zoomHandle = view.watch("zoom", (newZoom) => {
    // Determine if labels should be visible at this zoom level
    const shouldBeVisible = newZoom >= minZoom;
    
    // Skip if visibility state hasn't changed
    if (tracking.currentlyVisible === shouldBeVisible) return;
    
    // Update the tracking state
    tracking.currentlyVisible = shouldBeVisible;
    
    // Find and update all label graphics
    layer.graphics.forEach(graphic => {
      const attrs = graphic.attributes;
      if (attrs && attrs.isLabel === true) {
        // Only update if the base visibility allows it (some labels might be hidden due to collision)
        if (attrs.visible !== false) {
          graphic.visible = shouldBeVisible;
        }
      }
    });
    
    console.log(`[LabelVisibility] ${layer.title}: Labels ${shouldBeVisible ? 'shown' : 'hidden'} at zoom level ${newZoom.toFixed(2)}`);
  });
  
  // Store the handle for cleanup
  layer.labelVisibilityHandle = zoomHandle;
  
  // Initial update
  const currentZoom = view.zoom;
  tracking.currentlyVisible = currentZoom >= minZoom;
  
  // Apply initial visibility
  layer.graphics.forEach(graphic => {
    const attrs = graphic.attributes;
    if (attrs && attrs.isLabel === true) {
      if (attrs.visible !== false) {
        graphic.visible = tracking.currentlyVisible;
      }
    }
  });
}

/**
 * Cleanup function to remove zoom watch handlers
 * 
 * @param {GraphicsLayer} layer - The layer to clean up
 */
export function cleanupLabelVisibilityHandling(layer) {
  if (layer && layer.labelVisibilityHandle) {
    layer.labelVisibilityHandle.remove();
    layer.labelVisibilityHandle = null;
  }
}