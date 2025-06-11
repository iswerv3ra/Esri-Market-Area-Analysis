/**
 * Complete mapLayerUtils.js with enhanced renderer type normalization
 * Creates comparison map layers with improved label handling and robust type support
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
 * Utility function to normalize renderer types with comprehensive fallback detection
 * Handles various type formats and normalizes them to expected renderer types
 * 
 * @param {string} type - The input type to normalize
 * @param {Object} config - Configuration object for auto-detection fallbacks
 * @returns {string|null} - Normalized type or null if unable to determine
 */
const normalizeRendererType = (type, config = {}) => {
  if (!type) {
    // Auto-detect type from config properties if type is missing
    if (config.classBreakInfos && Array.isArray(config.classBreakInfos)) {
      return 'class-breaks';
    } else if (config.attributes && Array.isArray(config.attributes)) {
      return 'dot-density';
    } else if (config.dotValue !== undefined || config.dotSize !== undefined) {
      return 'dot-density';
    }
    return null;
  }
  
  const typeStr = String(type).toLowerCase().trim();
  
  // Normalize heatmap and class-breaks variations
  if (typeStr === 'heatmap' || 
      typeStr === 'heat-map' || 
      typeStr === 'heat_map' ||
      typeStr === 'classbreaks' || 
      typeStr === 'class_breaks' ||
      typeStr === 'choropleth') {
    return 'class-breaks';
  }
  
  // Normalize dot density variations
  if (typeStr === 'dotdensity' || 
      typeStr === 'dot_density' || 
      typeStr === 'dot-density-map' ||
      typeStr === 'dotdensitymap' ||
      typeStr === 'dots') {
    return 'dot-density';
  }
  
  // Return normalized types as-is
  if (typeStr === 'class-breaks' || typeStr === 'dot-density') {
    return typeStr;
  }
  
  // Handle field-based type detection for _HEAT fields
  if (config.field && String(config.field).toUpperCase().endsWith('_HEAT')) {
    return 'class-breaks';
  }
  
  // Final fallback based on config properties
  if (config.classBreakInfos && Array.isArray(config.classBreakInfos)) {
    return 'class-breaks';
  } else if (config.attributes && Array.isArray(config.attributes) || config.dotValue !== undefined) {
    return 'dot-density';
  }
  
  // Return original type if no normalization possible
  return typeStr;
};

/**
 * Utility function to create default class break symbols using TCG color palette
 * 
 * @param {number} breakCount - Number of breaks to create colors for
 * @returns {Array} - Array of RGBA color arrays
 */
const createDefaultClassBreakSymbols = (breakCount) => {
  // TCG color palette for consistent styling
  const tcgColors = [
    [191, 0, 0, 0.4],        // TCG Red Dark - 40% opacity
    [255, 122, 13, 0.25],    // TCG Orange Dark - 25% opacity
    [248, 242, 0, 0.35],     // TCG Yellow Dark - 35% opacity
    [0, 191, 44, 0.35],      // TCG Green Dark - 35% opacity
    [0, 155, 155, 0.35],     // TCG Cyan Dark - 35% opacity
    [0, 51, 128, 0.15],      // TCG Blue Dark - 15% opacity
    [92, 0, 184, 0.2],       // TCG Purple Dark - 20% opacity
    [214, 0, 158, 0.2],      // Pink Dark - 20% opacity
    [148, 112, 60, 0.2],     // Brown Dark - 20% opacity
    [174, 170, 170, 0.2]     // Carbon Gray Light - 20% opacity
  ];
  
  return tcgColors.slice(0, Math.min(breakCount, tcgColors.length));
};

/**
 * Utility function to create default dot density colors
 * 
 * @param {number} attributeCount - Number of attributes to create colors for
 * @returns {Array} - Array of RGB color arrays
 */
const createDefaultDotDensityColors = (attributeCount) => {
  const dotColors = [
    [227, 26, 28],    // Red
    [55, 126, 184],   // Blue
    [77, 175, 74],    // Green
    [152, 78, 163],   // Purple
    [255, 127, 0],    // Orange
    [255, 255, 51],   // Yellow
    [166, 86, 40],    // Brown
    [247, 129, 191],  // Pink
    [153, 153, 153]   // Gray
  ];
  
  return dotColors.slice(0, Math.min(attributeCount, dotColors.length));
};

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
 * Creates a comparison map layer with improved label handling
 * 
 * @param {Object} config - Configuration for the comp layer
 * @returns {GraphicsLayer} The configured comparison graphics layer
 */
export const createCompLayer = (config) => {
  console.log("[createCompLayer] Received config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));
  
  // Extract mapConfigId from config or from session storage as fallback
  let determinedMapConfigId = config.configId || config.mapConfigId;
  if (!determinedMapConfigId && typeof sessionStorage !== 'undefined') {
      determinedMapConfigId = sessionStorage.getItem("currentMapConfigId");
  }
  const mapConfigId = determinedMapConfigId; // Use the correctly determined ID

  // Add more detailed logging to confirm:
  console.log(`[createCompLayer/PipeLayer] Using mapConfigId: ${mapConfigId} for layer title: ${config?.title}. \
  Derived from config.configId: ${config.configId}, \
  config.mapConfigId: ${config.mapConfigId}, \
  sessionStorage('currentMapConfigId'): ${typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("currentMapConfigId") : 'N/A'}`);  console.log(`[createCompLayer] Using mapConfigId: ${mapConfigId} for layer title: ${config?.title}`);
  
  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Comparison Map Layer",
    listMode: "show"
  });
  
  // IMPORTANT: Explicitly set the mapConfigId on the layer
  graphicsLayer.mapConfigId = mapConfigId;
  console.log(`[createCompLayer] Set mapConfigId on layer: ${mapConfigId}`);
  
  // Flag to indicate this layer has its own label graphics
  graphicsLayer.hasLabelGraphics = true;

  // --- Extract data and column information from user's provided full function ---
  const data = config?.customData?.data || [];
  const labelColumn = config?.labelColumn;
  const variable1Column = config?.variable1Column;
  const variable2Column = config?.variable2Column;
  const variable1Text = config?.variable1Text || '';
  const variable2Text = config?.variable2Text || '';
  const valueColumn = config?.valueColumn || config?.field;
  const latitudeColumn = config?.latitudeColumn;
  const longitudeColumn = config?.longitudeColumn;
  const symbol = config?.symbol || {};
  const classBreakInfos = config?.classBreakInfos || [];
  const rendererType = config?.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
  const valueFormat = config?.valueFormat;
  
  const labelOptions = config?.labelOptions || {};
  const fontSize = labelOptions.fontSize || 10;
  const includeVariables = labelOptions.includeVariables !== false; 
  const visibleAtAllZooms = labelOptions.visibleAtAllZooms || false;
  const minZoom = labelOptions.minZoom || 10;
  
  graphicsLayer.labelVisibilityTracking = { 
    enabled: !visibleAtAllZooms,
    minimumZoom: minZoom,
    currentlyVisible: false
  };

  if (!Array.isArray(data) || data.length === 0 || !latitudeColumn || !longitudeColumn) {
    console.warn("[createCompLayer] Missing required data for comp layer: customData array, latitudeColumn, or longitudeColumn. Layer will be empty.");
    // Ensure mapConfigId is included in the labelFormatInfo even for an empty layer context
    graphicsLayer.labelFormatInfo = {
        labelColumn, variable1Column, variable2Column, variable1Text, variable2Text, includeVariables,
        mapConfigId: mapConfigId // Explicitly include mapConfigId
    };
    return graphicsLayer;
  }
  
  let addedPoints = 0;
  let addedLabels = 0;
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item[latitudeColumn] || !item[longitudeColumn]) continue;
    const lat = parseFloat(item[latitudeColumn]);
    const lon = parseFloat(item[longitudeColumn]);
    if (isNaN(lat) || isNaN(lon)) continue;

    const pointValue = valueColumn ? item[valueColumn] : null;
    let pointColor = symbol.color || "#800080"; 
    
    if (pointValue !== undefined && pointValue !== null && 
        rendererType === 'classBreaks' && classBreakInfos && classBreakInfos.length > 0) {
      const numValue = Number(pointValue);
      if (!isNaN(numValue)) {
        for (const breakInfo of classBreakInfos) {
          const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined) ? Infinity : Number(breakInfo.maxValue);
          const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined) ? -Infinity : Number(breakInfo.minValue);
          if ((minVal === -Infinity || numValue >= minVal) && (maxVal === Infinity || numValue <= maxVal)) {
            pointColor = breakInfo.symbol?.color || pointColor;
            break;
          }
        }
      }
    }

    try {
      const point = new Point({ longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } });
      const pointSymbol = new SimpleMarkerSymbol({
        style: symbol.style || "circle",
        size: symbol.size !== undefined ? Number(symbol.size) : 12,
        color: new Color(pointColor),
        outline: {
          color: new Color(symbol.outline?.color || "#FFFFFF"),
          width: symbol.outline?.width !== undefined ? Number(symbol.outline.width) : 1
        }
      });

      let pointTitle = item[labelColumn] || `Point ${i}`;
      const variableParts = [];
      if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
        variableParts.push(item[variable1Column] + (variable1Text ? ' ' + variable1Text : ''));
      }
      if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
        variableParts.push(item[variable2Column] + (variable2Text ? ' ' + variable2Text : ''));
      }
      if (variableParts.length > 0 && includeVariables) {
        pointTitle += ' (' + variableParts.join(', ') + ')';
      }

      const graphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          ...item, OBJECTID: i, displayValue: pointValue, displayName: pointTitle,
          variable1Text: variable1Text, variable2Text: variable2Text, hasCustomFormat: true
        },
        popupTemplate: new PopupTemplate({
          title: "{displayName}",
          content: valueColumn ? [{
            type: "fields",
            fieldInfos: [{
              fieldName: "displayValue", label: valueColumn || "Value",
              format: valueFormat ? { digitSeparator: true, places: valueFormat.decimals ?? 0, prefix: valueFormat.prefix || '', suffix: valueFormat.suffix || '' } : { digitSeparator: true, places: 2 }
            }]
          }] : [{ type: "text", text: "No value column selected for display." }]
        })
      });
      graphicsLayer.add(graphic);
      addedPoints++;
      
      let labelText = item[labelColumn] || `Point ${i}`;
      if (includeVariables) {
        const labelVariableParts = [];
        if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) {
          labelVariableParts.push(item[variable1Column] + (variable1Text ? ' ' + variable1Text : ''));
        }
        if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) {
          labelVariableParts.push(item[variable2Column] + (variable2Text ? ' ' + variable2Text : ''));
        }
        if (labelVariableParts.length > 0) {
          labelText += ' (' + labelVariableParts.join(', ') + ')';
        }
      }
      
      const textSymbol = new TextSymbol({
        text: labelText,
        font: { size: fontSize, family: "sans-serif", weight: "normal" },
        color: new Color([0, 0, 0, 0.9]),
        haloColor: new Color([255, 255, 255, 0.9]),
        haloSize: 1,
        xoffset: 0,
        yoffset: fontSize + 4
      });
      const labelGraphic = new Graphic({
        geometry: point, symbol: textSymbol,
        attributes: {
          ...item, OBJECTID: `label-${i}`, parentID: i, isLabel: true, visible: true,
          variable1Column: variable1Column, variable2Column: variable2Column,
          variable1Text: variable1Text, variable2Text: variable2Text,
          hasCustomFormat: true, labelText: labelText, baseText: item[labelColumn] || `Point ${i}`
        },
        visible: visibleAtAllZooms
      });
      graphicsLayer.add(labelGraphic);
      addedLabels++;
    } catch (err) {
      console.error(`[createCompLayer] Error creating graphics for item ${i}:`, err);
    }
  }

  console.log(`[createCompLayer] Added ${addedPoints} points and ${addedLabels} labels to comp layer "${graphicsLayer.title}" with config ${mapConfigId}.`);
  
  graphicsLayer.variable1Text = variable1Text;
  graphicsLayer.variable2Text = variable2Text;
  // graphicsLayer.mapConfigId is already set at the beginning

  // Ensure mapConfigId is included in the labelFormatInfo
  graphicsLayer.labelFormatInfo = {
    labelColumn,
    variable1Column,
    variable2Column,
    variable1Text,
    variable2Text,
    includeVariables,
    mapConfigId: mapConfigId // Explicitly include mapConfigId
  };
  
  return graphicsLayer;
};

/**
 * Creates a pipeline map layer with enhanced label handling
 * 
 * @param {Object} config - Configuration for the pipe layer
 * @returns {GraphicsLayer} The configured pipeline graphics layer
 */
export const createPipeLayer = (config) => {
  console.log("[createPipeLayer] Creating Pipe Layer with config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));
  
    // Extract mapConfigId from config or from session storage as fallback
  let determinedMapConfigId = config.configId || config.mapConfigId;
  if (!determinedMapConfigId && typeof sessionStorage !== 'undefined') {
      determinedMapConfigId = sessionStorage.getItem("currentMapConfigId");
  }
  const mapConfigId = determinedMapConfigId; // Use the correctly determined ID

  // Add more detailed logging to confirm:
  console.log(`[createCompLayer/PipeLayer] Using mapConfigId: ${mapConfigId} for layer title: ${config?.title}. \
  Derived from config.configId: ${config.configId}, \
  config.mapConfigId: ${config.mapConfigId}, \
  sessionStorage('currentMapConfigId'): ${typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("currentMapConfigId") : 'N/A'}`);  console.log(`[createPipeLayer] Using mapConfigId: ${mapConfigId} for layer title: ${config?.title}`);
  
  // Early validation check - quit if critical data is missing
  if (!config || !config.customData || !Array.isArray(config.customData.data) || 
      config.customData.data.length === 0 || !config.latitudeColumn || !config.longitudeColumn) {
    console.warn("[createPipeLayer] Missing required data for pipeline layer: customData, latitudeColumn, or longitudeColumn. Returning empty layer.");
    // Return a valid but empty layer instead of null to avoid errors
    const emptyLayer = new GraphicsLayer({
      title: config?.title || "Pipeline Map Layer (Empty)",
      listMode: "show"
    });
    emptyLayer.mapConfigId = mapConfigId; // Set mapConfigId even on empty layer
    // Ensure labelFormatInfo is present with mapConfigId
    emptyLayer.labelFormatInfo = {
        labelColumn: config?.labelColumn,
        variable1Column: config?.variable1Column,
        variable2Column: config?.variable2Column,
        variable1Text: config?.variable1Text || '',
        variable2Text: config?.variable2Text || '',
        includeVariables: config?.labelOptions?.includeVariables !== false,
        mapConfigId: mapConfigId
    };
    return emptyLayer;
  }
  
  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Pipeline Map Layer",
    listMode: "show"
  });

  // IMPORTANT: Explicitly set the mapConfigId on the layer
  graphicsLayer.mapConfigId = mapConfigId;
  console.log(`[createPipeLayer] Set mapConfigId on layer: ${mapConfigId}`);

  // Add this flag to indicate this layer manages its own labels
  graphicsLayer.hasLabelGraphics = true;
  
  // --- Extract configuration from user's provided full function ---
  const { 
    customData, labelColumn, variable1Column, variable2Column, statusColumn, 
    valueColumn, latitudeColumn, longitudeColumn, symbol = {}, statusColors = {},
    classBreakInfos = [], 
    rendererType = classBreakInfos.length > 0 ? 'classBreaks' : (statusColumn ? 'uniqueValue' : 'simple')
  } = config;
  
  const variable1Text = config.variable1Text || '';
  const variable2Text = config.variable2Text || '';
  
  const labelOptions = config?.labelOptions || {};
  const fontSize = labelOptions.fontSize || 10;
  const includeVariables = labelOptions.includeVariables !== false;
  const avoidCollisions = labelOptions.avoidCollisions !== false;
  const visibleAtAllZooms = labelOptions.visibleAtAllZooms || false;
  const minZoom = labelOptions.minZoom || 10;
  
  graphicsLayer.labelVisibilityTracking = { 
    enabled: !visibleAtAllZooms,
    minimumZoom: minZoom,
    currentlyVisible: false
  };
  
  const defaultSymbol = { type: "simple-marker", style: "circle", size: 12, color: "#FFA500", outline: { color: "#FFFFFF", width: 1 } };
  const symbolSize = symbol.size !== undefined ? Number(symbol.size) : defaultSymbol.size;
  const completeSymbol = {
    type: symbol.type || defaultSymbol.type, style: symbol.style || defaultSymbol.style, size: symbolSize,
    color: symbol.color || defaultSymbol.color,
    outline: { color: symbol.outline?.color || defaultSymbol.outline.color, width: symbol.outline?.width !== undefined ? Number(symbol.outline.width) : defaultSymbol.outline.width }
  };
  const defaultStatusColors = { "In Progress": "#FFB900", "Approved": "#107C10", "Pending": "#0078D4", "Completed": "#107C10", "Rejected": "#D13438", "default": completeSymbol.color };
  const mergedStatusColors = { ...defaultStatusColors, ...statusColors };
  
  try {
    const dataArray = customData.data || customData; // customData might be the array itself
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn("[createPipeLayer] Pipeline layer has no valid data points after extraction. Layer will be empty.");
      graphicsLayer.labelFormatInfo = { labelColumn, variable1Column, variable2Column, variable1Text, variable2Text, includeVariables, mapConfigId: mapConfigId };
      return graphicsLayer;
    }
    
    const labelPositions = new Map();
    if (avoidCollisions) {
      const pointData = dataArray.map((item, index) => {
        if (!item[latitudeColumn] || !item[longitudeColumn]) return null;
        const lat = parseFloat(item[latitudeColumn]);
        const lon = parseFloat(item[longitudeColumn]);
        if (isNaN(lat) || isNaN(lon)) return null;
        let labelText = item[labelColumn] || `Point ${index}`;
        if (includeVariables) {
          const labelVariableParts = [];
          if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) labelVariableParts.push(item[variable1Column] + (variable1Text ? ' ' + variable1Text : ''));
          if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) labelVariableParts.push(item[variable2Column] + (variable2Text ? ' ' + variable2Text : ''));
          if (labelVariableParts.length > 0) labelText += ' (' + labelVariableParts.join(', ') + ')';
        }
        return { id: `label-${index}`, latitude: lat, longitude: lon, labelText, priority: index < 20 ? 2 : 1 };
      }).filter(Boolean);
      
      const positions = pointData.map((point, index) => {
        const offset = [0, fontSize + 4];
        const patternIndex = index % 8;
        const directions = [[0, fontSize + 4], [fontSize + 4, 0], [0, -(fontSize + 4)], [-(fontSize + 4), 0], [fontSize + 4, fontSize + 4], [-(fontSize + 4), fontSize + 4], [fontSize + 4, -(fontSize + 4)], [-(fontSize + 4), -(fontSize + 4)]];
        offset[0] = directions[patternIndex][0]; offset[1] = directions[patternIndex][1];
        return { id: point.id, x: offset[0], y: offset[1], visible: index < 50 };
      });
      positions.forEach(pos => labelPositions.set(pos.id, pos));
    }
    
    let addedCount = 0; let skippedCount = 0;
    dataArray.forEach((item, index) => {
      if (!item[latitudeColumn] || !item[longitudeColumn]) { skippedCount++; return; }
      const lat = parseFloat(item[latitudeColumn]); const lon = parseFloat(item[longitudeColumn]);
      if (isNaN(lat) || isNaN(lon)) { skippedCount++; return; }
      
      let pointColor = completeSymbol.color;
      if (rendererType === 'classBreaks' && valueColumn) {
        const pointValue = item[valueColumn];
        if (pointValue !== undefined && pointValue !== null && classBreakInfos && classBreakInfos.length > 0) {
          const numValue = Number(pointValue);
          if (!isNaN(numValue)) {
            for (const breakInfo of classBreakInfos) {
              if ((breakInfo.minValue === undefined || numValue >= breakInfo.minValue) && (breakInfo.maxValue === undefined || numValue <= breakInfo.maxValue)) {
                pointColor = breakInfo.symbol?.color || completeSymbol.color; break;
              }
            }
          }
        }
      } else if (rendererType === 'uniqueValue' || rendererType === 'uniqueValueOrSimple') {
        const status = item[statusColumn] || "default"; pointColor = mergedStatusColors[status] || mergedStatusColors.default;
      }
      
      try {
        const point = new Point({ longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } });
        const pointSymbol = new SimpleMarkerSymbol({ style: completeSymbol.style, size: completeSymbol.size, color: new Color(pointColor), outline: { color: new Color(completeSymbol.outline.color), width: completeSymbol.outline.width } });
        
        let pointTitle = item[labelColumn] || `Point ${index}`;
        const variableParts = [];
        if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) variableParts.push(item[variable1Column] + (variable1Text ? ' ' + variable1Text : ''));
        if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) variableParts.push(item[variable2Column] + (variable2Text ? ' ' + variable2Text : ''));
        if (variableParts.length > 0 && includeVariables) pointTitle += ' (' + variableParts.join(', ') + ')';
        
        const fieldInfos = [];
        if (statusColumn && item[statusColumn]) fieldInfos.push({ fieldName: "status", label: statusColumn || "Status" });
        if (valueColumn && item[valueColumn] !== undefined) fieldInfos.push({ fieldName: "value", label: valueColumn || "Value", format: config.valueFormat ? { digitSeparator: true, places: config.valueFormat.decimals || 0, prefix: config.valueFormat.prefix || '', suffix: config.valueFormat.suffix || '' } : null });
        
        const graphic = new Graphic({
          geometry: point, symbol: pointSymbol,
          attributes: { ...item, OBJECTID: index, displayName: pointTitle, status: item[statusColumn] || "Unknown", value: valueColumn ? item[valueColumn] : null, variable1Text: variable1Text, variable2Text: variable2Text, hasCustomFormat: true },
          popupTemplate: new PopupTemplate({ title: "{displayName}", content: fieldInfos.length > 0 ? [{ type: "fields", fieldInfos: fieldInfos }] : "No additional information available" })
        });
        graphicsLayer.add(graphic);
        
        let labelText = item[labelColumn] || `Point ${index}`;
        if (includeVariables) {
          const labelVariableParts = [];
          if (variable1Column && item[variable1Column] !== undefined && item[variable1Column] !== null) labelVariableParts.push(item[variable1Column] + (variable1Text ? ' ' + variable1Text : ''));
          if (variable2Column && item[variable2Column] !== undefined && item[variable2Column] !== null) labelVariableParts.push(item[variable2Column] + (variable2Text ? ' ' + variable2Text : ''));
          if (labelVariableParts.length > 0) labelText += ' (' + labelVariableParts.join(', ') + ')';
        }
        
        const labelId = `label-${index}`;
        let labelOffset = { x: 0, y: fontSize + 4, visible: true };
        if (avoidCollisions && labelPositions.has(labelId)) labelOffset = labelPositions.get(labelId);
        
        const textSymbol = new TextSymbol({ text: labelText, font: { size: fontSize, family: "sans-serif", weight: "normal" }, color: new Color([0, 0, 0, 0.9]), haloColor: new Color([255, 255, 255, 0.9]), haloSize: 1, xoffset: labelOffset.x, yoffset: labelOffset.y });
        const labelGraphic = new Graphic({
          geometry: point, symbol: textSymbol,
          attributes: { ...item, OBJECTID: `label-${index}`, parentID: index, isLabel: true, visible: labelOffset.visible, variable1Column: variable1Column, variable2Column: variable2Column, variable1Text: variable1Text, variable2Text: variable2Text, hasCustomFormat: true, labelText: labelText, baseText: item[labelColumn] || `Point ${index}` },
          visible: labelOffset.visible && visibleAtAllZooms
        });
        graphicsLayer.add(labelGraphic);
        addedCount++;
      } catch (pointError) { console.error(`[createPipeLayer] Error creating point graphic at index ${index}:`, pointError); skippedCount++; }
    });
    
    console.log(`[createPipeLayer] Pipeline layer creation complete: Added ${addedCount} points with labels, skipped ${skippedCount} invalid points for config ${mapConfigId}`);
    
    graphicsLayer.variable1Text = variable1Text;
    graphicsLayer.variable2Text = variable2Text;
    // graphicsLayer.mapConfigId is already set

    // Ensure mapConfigId is included in the labelFormatInfo
    graphicsLayer.labelFormatInfo = {
      labelColumn,
      variable1Column,
      variable2Column,
      variable1Text,
      variable2Text,
      includeVariables,
      mapConfigId: mapConfigId // Explicitly include mapConfigId
    };
    
  } catch (error) {
    console.error("[createPipeLayer] Error during pipeline layer creation:", error);
  }
  
  return graphicsLayer;
};

/**
 * Creates a graphics layer from custom data with dual-value renderer support
 * Handles complex symbol and size mappings based on multiple value columns
 * 
 * @param {Object} config - Configuration object for the custom layer
 * @returns {Promise<GraphicsLayer>} The configured custom graphics layer
 */
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

      // Default finalColorHex and finalSize
      let finalColorHex = isDualValueRender ? "#808080" : (baseSymbolConfig.color || "#FF0000"); // Default grey for unmatched dual-value
      let finalSize = isDualValueRender 
        ? (baseSymbolConfig.minSize || 6) // Default to minSize for unmatched dual-value
        : (parseFloat(baseSymbolConfig.size || 10));

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
 * Enhanced createRenderer function with comprehensive type handling and auto-detection
 * Supports both class-breaks and dot-density renderers with robust fallback logic
 * 
 * @param {Object} config - Configuration object containing renderer settings
 * @param {Object} areaType - Area type information for defaults (optional)
 * @returns {Promise<Object|null>} - ArcGIS renderer instance or null if creation fails
 */
const createRenderer = async (config, areaType = null) => {
  console.log("[createRenderer] Creating renderer with config:", {
    originalType: config?.type,
    field: config?.field,
    hasClassBreaks: !!(config?.classBreakInfos),
    hasAttributes: !!(config?.attributes),
    hasDotValue: config?.dotValue !== undefined,
    configKeys: config ? Object.keys(config) : [],
    configStructure: config ? JSON.stringify(config, null, 2).substring(0, 500) + '...' : 'null'
  });
  
  // Validate input config
  if (!config || typeof config !== 'object') {
    console.error("[createRenderer] Invalid or missing config object:", config);
    return null;
  }

  try {
    // Normalize the renderer type with fallback detection
    const normalizedType = normalizeRendererType(config.type, config);
    
    if (!normalizedType) {
      console.error("[createRenderer] Unable to determine renderer type from config:", config);
      return null;
    }
    
    console.log(`[createRenderer] Type normalized: '${config.type}' → '${normalizedType}'`);

    // Import required ArcGIS modules dynamically
    const [
      { default: ClassBreaksRenderer },
      { default: DotDensityRenderer },
      { default: SimpleFillSymbol },
      { default: SimpleLineSymbol },
      { default: Color }
    ] = await Promise.all([
      import("@arcgis/core/renderers/ClassBreaksRenderer"),
      import("@arcgis/core/renderers/DotDensityRenderer"),
      import("@arcgis/core/symbols/SimpleFillSymbol"),
      import("@arcgis/core/symbols/SimpleLineSymbol"),
      import("@arcgis/core/Color")
    ]);

    // Create Class Breaks Renderer (for heatmaps, choropleth maps)
    if (normalizedType === 'class-breaks') {
      console.log("[createRenderer] Building ClassBreaksRenderer");
      
      // Validate required properties
      const field = config.field || config.valueField || config.classificationField;
      if (!field) {
        console.error("[createRenderer] Missing required 'field' property for class-breaks renderer");
        return null;
      }

      // Enhanced class break info extraction with multiple fallback paths
      let classBreakInfos = null;
      
      // Method 1: Direct classBreakInfos property (array)
      if (config.classBreakInfos && Array.isArray(config.classBreakInfos)) {
        classBreakInfos = config.classBreakInfos;
        console.log("[createRenderer] Found classBreakInfos via direct property (array)");
      }
      // Method 1b: Nested classBreakInfos structure (object containing classBreakInfos array)
      else if (config.classBreakInfos && typeof config.classBreakInfos === 'object' && 
               config.classBreakInfos.classBreakInfos && Array.isArray(config.classBreakInfos.classBreakInfos)) {
        classBreakInfos = config.classBreakInfos.classBreakInfos;
        console.log("[createRenderer] Found classBreakInfos via nested classBreakInfos.classBreakInfos property");
      }
      // Method 2: Alternative property names
      else if (config.breaks && Array.isArray(config.breaks)) {
        classBreakInfos = config.breaks;
        console.log("[createRenderer] Found classBreakInfos via 'breaks' property");
      }
      else if (config.classBreaks && Array.isArray(config.classBreaks)) {
        classBreakInfos = config.classBreaks;
        console.log("[createRenderer] Found classBreakInfos via 'classBreaks' property");
      }
      // Method 3: Check if config itself is an array of breaks
      else if (Array.isArray(config) && config.length > 0 && config[0].symbol) {
        classBreakInfos = config;
        console.log("[createRenderer] Config itself appears to be classBreakInfos array");
      }
      // Method 4: Check for nested structure (common in complex configs)
      else if (config.renderer && config.renderer.classBreakInfos && Array.isArray(config.renderer.classBreakInfos)) {
        classBreakInfos = config.renderer.classBreakInfos;
        console.log("[createRenderer] Found classBreakInfos via nested renderer property");
      }
      // Method 5: Check for layerConfiguration structure
      else if (config.layerConfiguration && config.layerConfiguration.classBreakInfos && Array.isArray(config.layerConfiguration.classBreakInfos)) {
        classBreakInfos = config.layerConfiguration.classBreakInfos;
        console.log("[createRenderer] Found classBreakInfos via layerConfiguration property");
      }
      // Method 6: Deep nested check - sometimes the structure can be deeply nested
      else if (config.classBreakInfos && typeof config.classBreakInfos === 'object') {
        // Try to find any array property within the classBreakInfos object
        const possibleArrays = Object.values(config.classBreakInfos).filter(Array.isArray);
        if (possibleArrays.length > 0 && possibleArrays[0].length > 0 && possibleArrays[0][0].symbol) {
          classBreakInfos = possibleArrays[0];
          console.log("[createRenderer] Found classBreakInfos via deep nested search within classBreakInfos object");
        }
      }

      // Final validation of class break infos
      if (!classBreakInfos || !Array.isArray(classBreakInfos) || classBreakInfos.length === 0) {
        console.error("[createRenderer] Missing or invalid 'classBreakInfos' for class-breaks renderer", {
          configKeys: Object.keys(config),
          hasClassBreakInfos: !!config.classBreakInfos,
          classBreakInfosType: typeof config.classBreakInfos,
          classBreakInfosLength: Array.isArray(config.classBreakInfos) ? config.classBreakInfos.length : 'not array',
          hasBreaks: !!config.breaks,
          breaksType: typeof config.breaks,
          breaksLength: Array.isArray(config.breaks) ? config.breaks.length : 'not array',
          configStructureSample: JSON.stringify(config, null, 2).substring(0, 300)
        });
        return null;
      }

      console.log(`[createRenderer] Successfully extracted ${classBreakInfos.length} class break infos`);

      // Process and validate class break infos
      const defaultColors = createDefaultClassBreakSymbols(classBreakInfos.length);
      const processedBreakInfos = classBreakInfos.map((breakInfo, index) => {
        // Handle potential data format variations
        let processedBreak = breakInfo;
        
        // If breakInfo is not an object, try to construct one
        if (typeof breakInfo !== 'object' || breakInfo === null) {
          console.warn(`[createRenderer] Break info at index ${index} is not an object:`, breakInfo);
          processedBreak = { minValue: 0, maxValue: 100, label: `Class ${index + 1}` };
        }

        // Ensure min/max values are properly set with enhanced fallback logic
        let minValue = processedBreak.minValue ?? processedBreak.min ?? processedBreak.classMinValue;
        let maxValue = processedBreak.maxValue ?? processedBreak.max ?? processedBreak.classMaxValue;
        
        // Handle special cases for first and last breaks
        if (minValue === null || minValue === undefined) {
          minValue = index === 0 ? 0 : (classBreakInfos[index - 1]?.maxValue ?? index * 10);
        }
        if (maxValue === null || maxValue === undefined) {
          maxValue = minValue + 10; // Default range of 10
        }

        // Create or process symbol with enhanced error handling
        let symbol;
        try {
          if (processedBreak.symbol && typeof processedBreak.symbol === 'object') {
            // Use existing symbol structure
            const symbolColor = processedBreak.symbol.color || defaultColors[index] || [128, 128, 128, 0.8];
            const outlineColor = processedBreak.symbol.outline?.color || [255, 255, 255, 0.5];
            const outlineWidth = processedBreak.symbol.outline?.width ?? 0.5;
            
            symbol = new SimpleFillSymbol({
              color: new Color(symbolColor),
              style: processedBreak.symbol.style || "solid",
              outline: new SimpleLineSymbol({
                color: new Color(outlineColor),
                width: outlineWidth,
                style: "solid"
              })
            });
          } else {
            // Create default symbol with TCG color palette
            const colorArray = defaultColors[index] || [128, 128, 128, 0.8];
            
            symbol = new SimpleFillSymbol({
              color: new Color(colorArray),
              style: "solid",
              outline: new SimpleLineSymbol({
                color: new Color([255, 255, 255, 0.5]),
                width: 0.5,
                style: "solid"
              })
            });
          }
        } catch (symbolError) {
          console.error(`[createRenderer] Error creating symbol for break ${index}:`, symbolError);
          // Fallback to basic symbol
          const colorArray = defaultColors[index] || [128, 128, 128, 0.8];
          symbol = new SimpleFillSymbol({
            color: new Color(colorArray),
            style: "solid",
            outline: new SimpleLineSymbol({
              color: new Color([255, 255, 255, 0.5]),
              width: 0.5,
              style: "solid"
            })
          });
        }

        // Generate label if not provided with enhanced fallback logic
        let label = processedBreak.label || processedBreak.description || processedBreak.text;
        if (!label) {
          // Create a formatted label based on values
          if (minValue !== null && maxValue !== null) {
            // Format numbers for better readability
            const formatNumber = (num) => {
              if (Number.isInteger(num)) {
                return num.toLocaleString();
              } else {
                return num.toFixed(1);
              }
            };
            
            if (index === 0) {
              label = `Less than ${formatNumber(maxValue)}`;
            } else if (index === classBreakInfos.length - 1) {
              label = `${formatNumber(minValue)} or more`;
            } else {
              label = `${formatNumber(minValue)} - ${formatNumber(maxValue)}`;
            }
          } else {
            label = `Class ${index + 1}`;
          }
        }

        return {
          minValue: minValue,
          maxValue: maxValue,
          symbol: symbol,
          label: label
        };
      });

      // Filter out any invalid break infos
      const validBreakInfos = processedBreakInfos.filter(breakInfo => 
        breakInfo && breakInfo.symbol && 
        typeof breakInfo.minValue === 'number' && 
        typeof breakInfo.maxValue === 'number'
      );

      if (validBreakInfos.length === 0) {
        console.error("[createRenderer] No valid break infos after processing");
        return null;
      }

      console.log(`[createRenderer] Processed ${validBreakInfos.length} valid break infos from ${classBreakInfos.length} original breaks`);

      // Create and return the renderer
      const renderer = new ClassBreaksRenderer({
        field: field,
        classBreakInfos: validBreakInfos,
        legendOptions: {
          title: config.legendOptions?.title || 
                 config.title || 
                 config.legendTitle || 
                 field || 
                 "Classification"
        }
      });

      console.log(`[createRenderer] ClassBreaksRenderer created successfully with ${validBreakInfos.length} breaks`);
      return renderer;
    }

    // Create Dot Density Renderer
    else if (normalizedType === 'dot-density') {
      console.log("[createRenderer] Building DotDensityRenderer");
      
      // Enhanced attribute extraction with multiple fallback paths
      let attributes = null;
      
      if (config.attributes && Array.isArray(config.attributes)) {
        attributes = config.attributes;
      } else if (config.fields && Array.isArray(config.fields)) {
        attributes = config.fields;
      } else if (config.dotAttributes && Array.isArray(config.dotAttributes)) {
        attributes = config.dotAttributes;
      } else if (config.renderer && config.renderer.attributes && Array.isArray(config.renderer.attributes)) {
        attributes = config.renderer.attributes;
      }

      if (!attributes || !Array.isArray(attributes) || attributes.length === 0) {
        console.error("[createRenderer] Missing or invalid 'attributes' array for dot-density renderer", {
          configKeys: Object.keys(config),
          hasAttributes: !!config.attributes,
          attributesType: typeof config.attributes,
          attributesLength: Array.isArray(config.attributes) ? config.attributes.length : 'not array'
        });
        return null;
      }

      // Process attributes with default colors and enhanced validation
      const defaultColors = createDefaultDotDensityColors(attributes.length);
      const processedAttributes = attributes.map((attr, index) => {
        // Handle both object and string attribute formats
        const field = typeof attr === 'string' ? attr : (attr.field || attr.name || attr.fieldName);
        const label = typeof attr === 'string' ? field : (attr.label || attr.description || attr.displayName || field);
        const color = typeof attr === 'object' && attr.color ? attr.color : defaultColors[index];
        
        if (!field) {
          console.warn(`[createRenderer] Attribute at index ${index} missing field name:`, attr);
          return null;
        }

        return {
          field: field,
          color: new Color(color),
          label: label
        };
      }).filter(attr => attr !== null); // Remove invalid attributes

      if (processedAttributes.length === 0) {
        console.error("[createRenderer] No valid attributes found for dot-density renderer");
        return null;
      }

      // Set up renderer parameters with defaults
      const dotValue = config.dotValue || config.valuePerDot || config.dotsPerUnit || 
                      (areaType?.value === 12 ? 10 : 100); // Use area type for default
      const dotSize = config.dotSize || config.size || 2;
      const dotBlending = config.dotBlending || config.blendMode || "additive";

      // Create outline if specified
      let outline = null;
      if (config.outline && typeof config.outline === 'object') {
        outline = new SimpleLineSymbol({
          color: new Color(config.outline.color || [128, 128, 128, 0.3]),
          width: config.outline.width || 0.5,
          style: config.outline.style || "solid"
        });
      }

      // Create and return the renderer
      const renderer = new DotDensityRenderer({
        dotValue: dotValue,
        dotSize: dotSize,
        dotBlending: dotBlending,
        attributes: processedAttributes,
        outline: outline,
        legendOptions: {
          unit: config.legendOptions?.unit || 
                config.unit || 
                config.valueUnit || 
                "people"
        }
      });

      console.log(`[createRenderer] DotDensityRenderer created successfully with ${processedAttributes.length} attributes`);
      return renderer;
    }

    // Handle unexpected renderer types
    else {
      console.error(`[createRenderer] Unsupported normalized renderer type: '${normalizedType}'. Expected 'class-breaks' or 'dot-density'.`);
      
      // Final fallback attempt - try to auto-detect and recurse with better config
      const hasBreakStructure = config.classBreakInfos || config.breaks || config.classBreaks || 
                               (Array.isArray(config) && config[0]?.symbol);
      const hasAttributeStructure = config.attributes || config.fields || config.dotAttributes || 
                                   config.dotValue !== undefined;

      if (hasBreakStructure) {
        console.log("[createRenderer] Fallback: Attempting class-breaks based on break structure detection");
        return createRenderer({ ...config, type: 'class-breaks' }, areaType);
      } else if (hasAttributeStructure) {
        console.log("[createRenderer] Fallback: Attempting dot-density based on attribute structure detection");
        return createRenderer({ ...config, type: 'dot-density' }, areaType);
      }
      
      return null;
    }

  } catch (error) {
    console.error("[createRenderer] Critical error during renderer creation:", {
      error: error.message,
      stack: error.stack,
      config: config,
      configKeys: config ? Object.keys(config) : [],
      configType: typeof config
    });
    return null;
  }
};

/**
 * Creates and returns an appropriate layer based on visualization type
 * Handles both standard feature layers and custom graphics layers
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

    // Normalize visualization type using the enhanced normalizeRendererType function
    let effectiveVizType = normalizeRendererType(config.type, config) || config.type;
    
    // Handle legacy type normalization for special graphics layer types
    if (effectiveVizType === "pipeline") effectiveVizType = "pipe";
    if (effectiveVizType === "comps") effectiveVizType = "comp";
    
    // Handle _HEAT field suffix normalization
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
        // Create renderer for the feature layer using the enhanced createRenderer function
        const renderer = await createRenderer(config, selectedAreaType);
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