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

/**
 * Formats a point label with optional variable inclusions
 * 
 * @param {Object} item - The data item containing label and variable values
 * @param {Object} options - Formatting options
 * @param {string} options.labelColumn - Column name for the main label
 * @param {string} options.variable1Column - Column name for first variable
 * @param {string} options.variable2Column - Column name for second variable
 * @param {Object} options.labelOptions - Additional label formatting options
 * @param {boolean} options.labelOptions.includeVariables - Whether to include variables in label
 * @returns {string} Formatted label text
 */
export function formatPointLabel(item, options) {
  // Extract options with defaults
  const {
    labelColumn,
    variable1Column,
    variable2Column,
    labelOptions = {}
  } = options || {};
  
  // Default to true if not explicitly set to false
  const includeVariables = labelOptions.includeVariables !== false;
  
  // Format the main label
  let labelText = '';
  
  // Use labelColumn if available
  if (labelColumn && item[labelColumn] !== undefined && item[labelColumn] !== null) {
    labelText = String(item[labelColumn]);
  } else {
    // Fallback to object ID or index if available
    labelText = item.OBJECTID !== undefined ? `Point ${item.OBJECTID}` : 
               (item.id !== undefined ? `Point ${item.id}` : 'Unnamed Point');
  }
  
  // Include variables if configured and available
  if (includeVariables) {
    const variables = [];
    
    // Add variable 1 if available
    if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
      variables.push(String(item[variable1Column]));
    }
    
    // Add variable 2 if available
    if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
      variables.push(String(item[variable2Column]));
    }
    
    // Append variables in parentheses if we have any
    if (variables.length > 0) {
      labelText += ` (${variables.join(', ')})`;
    }
  }
  
  return labelText;
}

/**
 * Generates a title for point popups
 * 
 * @param {Object} item - The data item containing label and variable values
 * @param {Object} options - Formatting options
 * @param {string} options.labelColumn - Column name for the main label
 * @param {string} options.variable1Column - Column name for first variable
 * @param {string} options.variable2Column - Column name for second variable
 * @returns {string} Formatted popup title
 */
export function generatePointTitle(item, options) {
  // Extract options with defaults
  const {
    labelColumn,
    variable1Column,
    variable2Column
  } = options || {};
  
  // Format the main title
  let title = '';
  
  // Use labelColumn if available
  if (labelColumn && item[labelColumn] !== undefined && item[labelColumn] !== null) {
    title = String(item[labelColumn]);
  } else {
    // Fallback to object ID or index if available
    title = item.OBJECTID !== undefined ? `Point ${item.OBJECTID}` : 
           (item.id !== undefined ? `Point ${item.id}` : 'Unnamed Point');
  }
  
  // Always include variables in the title for better identification
  const variables = [];
  
  // Add variable 1 if available
  if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
    variables.push(String(item[variable1Column]));
  }
  
  // Add variable 2 if available
  if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
    variables.push(String(item[variable2Column]));
  }
  
  // Append variables in parentheses if we have any
  if (variables.length > 0) {
    title += ` (${variables.join(', ')})`;
  }
  
  return title;
}

/**
 * Creates a comparison map layer with labels that properly includes variable text fields
 * 
 * @param {Object} config - Configuration for the comparison layer
 * @returns {GraphicsLayer} The configured comparison graphics layer
 */
export const createCompLayer = (config) => {
  // Log the received config (without data for brevity)
  console.log("[createCompLayer] Received config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));
  
  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Comparison Map Layer",
    listMode: "show"
  });
  
  // Flag to indicate this layer has its own label graphics
  // This signals to the UniversalLabelManager not to create duplicate labels
  graphicsLayer.hasLabelGraphics = true;

  // --- Extract data and column information ---
  const data = config?.customData?.data || [];
  const labelColumn = config?.labelColumn;
  const variable1Column = config?.variable1Column;
  const variable2Column = config?.variable2Column;
  // Extract variable text fields from config
  const variable1Text = config?.variable1Text || '';
  const variable2Text = config?.variable2Text || '';
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

  // Check if we have the necessary data
  if (!Array.isArray(data) || data.length === 0 || !latitudeColumn || !longitudeColumn) {
    console.warn("[createCompLayer] Missing required data for comp layer: customData array, latitudeColumn, or longitudeColumn");
    return graphicsLayer;
  }
  
  // Create a counter for added items
  let addedPoints = 0;
  let addedLabels = 0;
  
  // Process each data point
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    // Skip if missing coordinates
    if (!item[latitudeColumn] || !item[longitudeColumn]) continue;

    const lat = parseFloat(item[latitudeColumn]);
    const lon = parseFloat(item[longitudeColumn]);

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon)) continue;

    // Get the value for this point (if using class breaks)
    const pointValue = valueColumn ? item[valueColumn] : null;
    
    // Determine the color based on class breaks if applicable
    let pointColor = symbol.color || "#800080"; // Default purple for comp
    
    if (pointValue !== undefined && pointValue !== null && 
        rendererType === 'classBreaks' && classBreakInfos && classBreakInfos.length > 0) {
      
      const numValue = Number(pointValue);
      if (!isNaN(numValue)) {
        for (const breakInfo of classBreakInfos) {
          const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined) 
                        ? Infinity : Number(breakInfo.maxValue);
          const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined) 
                        ? -Infinity : Number(breakInfo.minValue);
          
          if ((minVal === -Infinity || numValue >= minVal) && 
              (maxVal === Infinity || numValue <= maxVal)) {
            pointColor = breakInfo.symbol?.color || pointColor;
            break;
          }
        }
      }
    }

    try {
      // Create the point geometry
      const point = new Point({
        longitude: lon,
        latitude: lat,
        spatialReference: { wkid: 4326 }
      });

      // Create the symbol with the specified styling
      const pointSymbol = new SimpleMarkerSymbol({
        style: symbol.style || "circle",
        size: symbol.size !== undefined ? Number(symbol.size) : 12,
        color: new Color(pointColor),
        outline: {
          color: new Color(symbol.outline?.color || "#FFFFFF"),
          width: symbol.outline?.width !== undefined ? Number(symbol.outline.width) : 1
        }
      });

      // --- Custom title generation with variable text fields ---
      let pointTitle = item[labelColumn] || `Point ${i}`;
      
      // Build variable part of the title with text
      const variableParts = [];
      if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
        const var1Display = item[variable1Column] + (variable1Text ? ' ' + variable1Text : '');
        variableParts.push(var1Display);
      }
      
      if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
        const var2Display = item[variable2Column] + (variable2Text ? ' ' + variable2Text : '');
        variableParts.push(var2Display);
      }
      
      // Add variables in parentheses if any exist
      if (variableParts.length > 0 && includeVariables) {
        pointTitle += ' (' + variableParts.join(', ') + ')';
      }

      // Create the graphic with attributes
      const graphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          ...item,
          OBJECTID: i,  // Use index as OBJECTID
          displayValue: pointValue,
          displayName: pointTitle,
          // Store variable text for label manager reference
          variable1Text: variable1Text,
          variable2Text: variable2Text,
          hasCustomFormat: true
        },
        popupTemplate: new PopupTemplate({
          title: "{displayName}",
          content: valueColumn ? [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "displayValue",
                  label: valueColumn || "Value",
                  format: valueFormat ? {
                    digitSeparator: true,
                    places: valueFormat.decimals ?? 0,
                    prefix: valueFormat.prefix || '',
                    suffix: valueFormat.suffix || ''
                  } : { digitSeparator: true, places: 2 }
                }
              ]
            }
          ] : [{ type: "text", text: "No value column selected for display." }]
        })
      });

      // Add the point graphic to the layer
      graphicsLayer.add(graphic);
      addedPoints++;
      
      // --- Create label text with variable text fields ---
      // Create label text (includes variables if configured)
      let labelText = item[labelColumn] || `Point ${i}`;
      
      // We'll add variables only if configured
      if (includeVariables) {
        const labelVariableParts = [];
        
        if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
          const var1Display = item[variable1Column] + (variable1Text ? ' ' + variable1Text : '');
          labelVariableParts.push(var1Display);
        }
        
        if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
          const var2Display = item[variable2Column] + (variable2Text ? ' ' + variable2Text : '');
          labelVariableParts.push(var2Display);
        }
        
        // Add variables in parentheses if any exist
        if (labelVariableParts.length > 0) {
          labelText += ' (' + labelVariableParts.join(', ') + ')';
        }
      }
      
      // Default label position (below point)
      let xOffset = 0;
      let yOffset = fontSize + 4;
      
      const textSymbol = new TextSymbol({
        text: labelText,
        font: {
          // IMPORTANT: Default to config fontSize but don't override in the symbol directly
          // Let the LabelManager apply saved fontSize based on the label's ID
          size: fontSize,
          family: "sans-serif",
          weight: "normal"
        },
        color: new Color([0, 0, 0, 0.9]),
        haloColor: new Color([255, 255, 255, 0.9]),
        haloSize: 1,
        xoffset: xOffset,
        yoffset: yOffset
      });
      // Create a label graphic
      const labelGraphic = new Graphic({
        geometry: point,
        symbol: textSymbol,
        attributes: {
          ...item,
          OBJECTID: `label-${i}`,
          parentID: i,
          isLabel: true,
          visible: true,
          // Store variables and text for label manager to preserve when editing
          variable1Column: variable1Column,
          variable2Column: variable2Column,
          variable1Text: variable1Text,
          variable2Text: variable2Text,
          hasCustomFormat: true,
          labelText: labelText,
          baseText: item[labelColumn] || `Point ${i}` // Store the base text without variables
        },
        // Labels should be invisible at low zoom levels if configured
        visible: visibleAtAllZooms
      });
      
      // Add the label graphic to the layer
      graphicsLayer.add(labelGraphic);
      addedLabels++;
    } catch (err) {
      console.error(`[createCompLayer] Error creating graphics for item ${i}:`, err);
    }
  }

  console.log(`[createCompLayer] Added ${addedPoints} points and ${addedLabels} labels to comp layer "${graphicsLayer.title}".`);
  
  // Store variable text fields on the layer for reference
  graphicsLayer.variable1Text = variable1Text;
  graphicsLayer.variable2Text = variable2Text;
  graphicsLayer.labelFormatInfo = {
    labelColumn,
    variable1Column,
    variable2Column,
    variable1Text,
    variable2Text,
    includeVariables
  };
  
  return graphicsLayer;
};
/**
 * Creates a pipeline map layer with improved label handling that includes variable text fields
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

  // Add this flag to indicate this layer manages its own labels
  // This signals to UniversalLabelManager not to create duplicate labels
  graphicsLayer.hasLabelGraphics = true;
  
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
  
  // Extract variable text fields from config
  const variable1Text = config.variable1Text || '';
  const variable2Text = config.variable2Text || '';
  
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
          
          // --- Generate label text with variable text fields ---
          let labelText = item[labelColumn] || `Point ${index}`;
          
          // We'll add variables only if configured
          if (includeVariables) {
            const labelVariableParts = [];
            
            if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
              const var1Display = item[variable1Column] + (variable1Text ? ' ' + variable1Text : '');
              labelVariableParts.push(var1Display);
            }
            
            if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
              const var2Display = item[variable2Column] + (variable2Text ? ' ' + variable2Text : '');
              labelVariableParts.push(var2Display);
            }
            
            // Add variables in parentheses if any exist
            if (labelVariableParts.length > 0) {
              labelText += ' (' + labelVariableParts.join(', ') + ')';
            }
          }
          
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
        
        // --- Generate formatted title with variable text fields ---
        let pointTitle = item[labelColumn] || `Point ${index}`;
        
        // Build variable part of the title with text
        const variableParts = [];
        if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
          const var1Display = item[variable1Column] + (variable1Text ? ' ' + variable1Text : '');
          variableParts.push(var1Display);
        }
        
        if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
          const var2Display = item[variable2Column] + (variable2Text ? ' ' + variable2Text : '');
          variableParts.push(var2Display);
        }
        
        // Add variables in parentheses if any exist
        if (variableParts.length > 0 && includeVariables) {
          pointTitle += ' (' + variableParts.join(', ') + ')';
        }
        
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
            value: valueColumn ? item[valueColumn] : null,
            // Store variable text for label manager reference
            variable1Text: variable1Text,
            variable2Text: variable2Text,
            hasCustomFormat: true
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
        
        // --- Create label text with variable text fields ---
        let labelText = item[labelColumn] || `Point ${index}`;
        
        // We'll add variables only if configured
        if (includeVariables) {
          const labelVariableParts = [];
          
          if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
            const var1Display = item[variable1Column] + (variable1Text ? ' ' + variable1Text : '');
            labelVariableParts.push(var1Display);
          }
          
          if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
            const var2Display = item[variable2Column] + (variable2Text ? ' ' + variable2Text : '');
            labelVariableParts.push(var2Display);
          }
          
          // Add variables in parentheses if any exist
          if (labelVariableParts.length > 0) {
            labelText += ' (' + labelVariableParts.join(', ') + ')';
          }
        }
        
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
            visible: labelOffset.visible,
            // Store variables and text for label manager to preserve when editing
            variable1Column: variable1Column,
            variable2Column: variable2Column,
            variable1Text: variable1Text,
            variable2Text: variable2Text,
            hasCustomFormat: true,
            labelText: labelText,
            baseText: item[labelColumn] || `Point ${index}` // Store the base text without variables
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
    
    // Store variable text fields on the layer for reference
    graphicsLayer.variable1Text = variable1Text;
    graphicsLayer.variable2Text = variable2Text;
    graphicsLayer.labelFormatInfo = {
      labelColumn,
      variable1Column,
      variable2Column,
      variable1Text,
      variable2Text,
      includeVariables
    };
    
  } catch (error) {
    console.error("Error during pipeline layer creation:", error);
  }
  
  return graphicsLayer;
};

export const createGraphicsLayerFromCustomData = async (config) => {
  console.log("[createGraphicsLayerFromCustomData] Received config:", JSON.stringify(config, (k, v) => 
    (k === "data" || k === "customData") ? `[${v?.data?.length || v?.length} items]` : v));

  // Dynamic imports
  const { default: GraphicsLayer } = await import("@arcgis/core/layers/GraphicsLayer");
  const { default: Graphic } = await import("@arcgis/core/Graphic");
  const { default: Point } = await import("@arcgis/core/geometry/Point");
  const { default: SimpleMarkerSymbol } = await import("@arcgis/core/symbols/SimpleMarkerSymbol");
  const { default: TextSymbol } = await import("@arcgis/core/symbols/TextSymbol");
  const { default: Color } = await import("@arcgis/core/Color");
  const { default: PopupTemplate } = await import("@arcgis/core/PopupTemplate");

  const layer = new GraphicsLayer({
    title: config.title || "Custom Data Layer",
    listMode: "hide",
    visualizationType: "custom",
    rendererType: config.rendererType || "simple",
    isVisualizationLayer: true,
  });
  
  let customData = [];
  if (config.customData?.data) {
    customData = config.customData.data;
  } else if (config.data) {
    customData = config.data;
  } else if (config.customData && Array.isArray(config.customData)) {
    customData = config.customData;
  }

  if (!Array.isArray(customData) || customData.length === 0) {
    console.warn("[createGraphicsLayerFromCustomData] No custom data provided.");
    return layer;
  }

  const latCol = config.latitudeColumn || "latitude";
  const lonCol = config.longitudeColumn || "longitude";
  const labelCol = config.labelColumn || "name";
  const var1Col = config.variable1Column;
  const var2Col = config.variable2Column;
  const var1Text = config.variable1Text || "";
  const var2Text = config.variable2Text || "";
  
  const isDualValueRender = config.rendererType === 'custom-dual-value';
  const valueCol1 = config.valueColumn1;
  const valueCol2 = config.valueColumn2;
  
  const colorBreaks = Array.isArray(config.colorClassBreakInfos) ? config.colorClassBreakInfos : [];
  const sizeBreaks = Array.isArray(config.sizeInfos) ? config.sizeInfos : [];

  // --- MODIFICATION START ---
  // Define baseSymbolConfig based on rendererType
  let baseSymbolConfig;
  const inputSymbolConfig = config.symbol || {};

  if (isDualValueRender) {
    // For dual-value, base symbol defines outline, style, and min/max for ramps.
    // Fixed color/size are ignored; they come from breaks.
    baseSymbolConfig = {
      type: "simple-marker", // Ensure type is always set
      style: inputSymbolConfig.style || "circle",
      outline: inputSymbolConfig.outline || { color: "#FFFFFF", width: 1 },
      minSize: inputSymbolConfig.minSize || 6, // Crucial for size ramp default
      maxSize: inputSymbolConfig.maxSize || 24,
      // Explicitly DO NOT include 'color' or 'size' for dual-value base
    };
  } else {
    // For simple or single class-break custom maps, a base color/size might be intended.
    baseSymbolConfig = {
      type: "simple-marker", // Ensure type is always set
      style: inputSymbolConfig.style || "circle",
      outline: inputSymbolConfig.outline || { color: "#FFFFFF", width: 1 },
      color: inputSymbolConfig.color || "#FF0000", // Default red for non-dual-value
      size: inputSymbolConfig.size || 10,         // Default size for non-dual-value
    };
  }
  // --- MODIFICATION END ---

  console.log(`[createGraphicsLayerFromCustomData] Processing ${customData.length} points with:`, {
    rendererType: config.rendererType || 'simple',
    isDualValue: isDualValueRender,
    colorColumn: valueCol1 || 'N/A',
    sizeColumn: valueCol2 || 'N/A',
    colorBreaksCount: colorBreaks.length,
    sizeBreaksCount: sizeBreaks.length,
    baseSymbolConfig: baseSymbolConfig // Log the determined baseSymbolConfig
  });

  const pointGraphics = [];
  const labelGraphics = [];

  customData.forEach((item, index) => {
    try {
      let lat, lon;
      if (item[latCol] !== undefined && item[lonCol] !== undefined) {
        lat = parseFloat(item[latCol]);
        lon = parseFloat(item[lonCol]);
      } else if (item.geometry && typeof item.geometry.y === "number" && typeof item.geometry.x === "number") {
        lat = item.geometry.y;
        lon = item.geometry.x;
      } else if (item.lat !== undefined && item.lon !== undefined) {
        lat = parseFloat(item.lat);
        lon = parseFloat(item.lon);
      } else if (item.latitude !== undefined && item.longitude !== undefined) {
        lat = parseFloat(item.latitude);
        lon = parseFloat(item.longitude);
      }

      if (isNaN(lat) || isNaN(lon)) {
        console.warn(`[createGraphicsLayerFromCustomData] Skipping item ${index} due to invalid coordinates.`);
        return;
      }

      const point = new Point({ 
        longitude: lon, 
        latitude: lat, 
        spatialReference: { wkid: 4326 } 
      });

      // --- MODIFICATION START: Default finalColorHex and finalSize ---
      let finalColorHex = isDualValueRender ? "#808080" : (baseSymbolConfig.color || "#FF0000"); // Default grey for unmatched dual-value
      let finalSize = isDualValueRender 
        ? (baseSymbolConfig.minSize || 6) // Default to minSize for unmatched dual-value
        : (parseFloat(baseSymbolConfig.size || 10));
      // --- MODIFICATION END ---

      if (isDualValueRender) {
        if (valueCol1 && colorBreaks.length > 0 && item[valueCol1] !== undefined) {
          const val1 = parseFloat(item[valueCol1]);
          if (!isNaN(val1)) {
            for (const breakInfo of colorBreaks) {
              const minVal = breakInfo.minValue !== undefined ? parseFloat(breakInfo.minValue) : -Infinity;
              const maxVal = breakInfo.maxValue !== undefined ? parseFloat(breakInfo.maxValue) : Infinity;
              if (val1 >= minVal && val1 <= maxVal) {
                if (breakInfo.symbol && breakInfo.symbol.color) {
                  finalColorHex = breakInfo.symbol.color;
                  break;
                }
              }
            }
          }
        }
        
        if (valueCol2 && sizeBreaks.length > 0 && item[valueCol2] !== undefined) {
          const val2 = parseFloat(item[valueCol2]);
          if (!isNaN(val2)) {
            for (const sizeBreak of sizeBreaks) {
              const minVal = sizeBreak.minValue !== undefined ? parseFloat(sizeBreak.minValue) : -Infinity;
              const maxVal = sizeBreak.maxValue !== undefined ? parseFloat(sizeBreak.maxValue) : Infinity;
              if (val2 >= minVal && val2 <= maxVal) {
                if (sizeBreak.size !== undefined) {
                  finalSize = parseFloat(sizeBreak.size);
                  break;
                }
              }
            }
          }
        }
      } 
      else if (config.classBreakInfos && config.classBreakInfos.length > 0 && config.field) {
        const value = parseFloat(item[config.field]);
        if (!isNaN(value)) {
          for (const classBreak of config.classBreakInfos) {
            const minVal = classBreak.minValue !== undefined ? parseFloat(classBreak.minValue) : -Infinity;
            const maxVal = classBreak.maxValue !== undefined ? parseFloat(classBreak.maxValue) : Infinity;
            if (value >= minVal && value <= maxVal) {
              if (classBreak.symbol) {
                finalColorHex = classBreak.symbol.color || baseSymbolConfig.color || "#FF0000";
                finalSize = parseFloat(classBreak.symbol.size || baseSymbolConfig.size || 10);
                break;
              }
            }
          }
        }
      }

      const pointSymbol = new SimpleMarkerSymbol({
        style: baseSymbolConfig.style || "circle",
        color: new Color(finalColorHex),
        size: finalSize,
        outline: {
          color: new Color(baseSymbolConfig.outline?.color || "#FFFFFF"),
          width: parseFloat(baseSymbolConfig.outline?.width || 1)
        }
      });

      let displayLabel = String(item[labelCol] || `Point ${index + 1}`);
      if (config.labelOptions?.includeVariables !== false) {
        if (var1Col && item[var1Col] !== undefined) {
          displayLabel += `, ${item[var1Col]}${var1Text ? ' ' + var1Text : ''}`;
        }
        if (var2Col && item[var2Col] !== undefined) {
          displayLabel += ` / ${item[var2Col]}${var2Text ? ' ' + var2Text : ''}`;
        }
      }

      const attributes = {
        ...item,
        _internalId: `custom-${index}`,
        labelText: displayLabel,
        isCustomPoint: true,
        FEATURE_TYPE: "custom",
        parentID: `custom-${index}`,
        rendererType: config.rendererType,
        [valueCol1]: item[valueCol1],
        [valueCol2]: item[valueCol2],
        [labelCol]: item[labelCol] || `Point ${index + 1}`
      };

      const popupTemplate = new PopupTemplate({
        title: attributes.labelText,
        content: [{
          type: "fields",
          fieldInfos: Object.keys(item)
            .filter(key => !['geometry', '_internalId'].includes(key))
            .map(key => ({ fieldName: key, label: key }))
        }]
      });

      pointGraphics.push(new Graphic({ 
        geometry: point, 
        symbol: pointSymbol, 
        attributes, 
        popupTemplate 
      }));

      if (config.labelOptions?.showLabels !== false) {
        const labelFontSize = config.labelOptions?.fontSize || 10;
        const labelSymbol = new TextSymbol({
          text: displayLabel,
          color: new Color(config.labelOptions?.color || "#000000"),
          haloColor: new Color(config.labelOptions?.haloColor || "#FFFFFF"),
          haloSize: config.labelOptions?.haloSize || 1,
          font: {
            size: labelFontSize,
            family: config.labelOptions?.fontFamily || "sans-serif",
            weight: config.labelOptions?.bold ? "bold" : "normal"
          },
          yoffset: -(finalSize / 2 + labelFontSize / 2 + 2)
        });
        
        labelGraphics.push(new Graphic({
          geometry: point,
          symbol: labelSymbol,
          attributes: { 
            ...attributes, 
            isLabel: true,
            FEATURE_TYPE: "label",
            layerId: layer.id,
            parentID: `parent-custom-${index}`
          }
        }));
      }
    } catch (error) {
      console.error(`[createGraphicsLayerFromCustomData] Error processing item ${index}:`, error, item);
    }
  });

  if (pointGraphics.length > 0) {
    layer.addMany(pointGraphics);
  }
  if (labelGraphics.length > 0) {
    layer.addMany(labelGraphics);
  }
  
  layer.customConfig = {
    rendererType: config.rendererType,
    valueColumn1: valueCol1,
    valueColumn2: valueCol2,
    colorBreaks: colorBreaks,
    sizeBreaks: sizeBreaks,
    isDualValue: isDualValueRender,
    pointCount: pointGraphics.length,
    labelCount: labelGraphics.length
  };
  
  console.log(`[createGraphicsLayerFromCustomData] Successfully created layer with ${pointGraphics.length} points, ${labelGraphics.length} labels using ${isDualValueRender ? 'custom-dual-value' : (config.rendererType || 'simple')} renderer`);
  
  return layer;
};

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