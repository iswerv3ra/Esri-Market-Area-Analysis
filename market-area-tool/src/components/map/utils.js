// utils.js - Map visualization utility functions

/**
 * Create class breaks renderer configuration
 * 
 * @param {Array} breakPoints - Array of objects with min/max values for breaks
 * @param {Array} labels - Array of labels for each break
 * @param {Array} colorScheme - Optional color scheme for the breaks
 * @returns {Array} Array of class break objects for renderer
 */
export const createClassBreaks = (breakPoints, labels, colorScheme) => {
    // Default color scheme if one is not provided
    const defaultColors = [
      [237, 248, 251],  // Light blue
      [204, 236, 230],  // Lighter blue-green
      [153, 216, 201],  // Light green
      [102, 194, 164],  // Medium green
      [44, 162, 95],    // Dark green
      [0, 109, 44]      // Very dark green
    ];
    
    // Use provided colorScheme or default to the colors above
    const colors = (colorScheme && Array.isArray(colorScheme) && colorScheme.length >= breakPoints.length) 
      ? colorScheme 
      : defaultColors;
    
    return breakPoints.map((point, index) => ({
      minValue: point.min === undefined ? -Infinity : point.min,
      maxValue: point.max === undefined ? Infinity : point.max,
      symbol: {
        type: "simple-marker",  // For points use marker instead of fill
        size: 28, // Increased size for better visibility (was 8)
        color: colors[index] || colors[0],
        outline: {
          color: [0, 0, 0, 0.8],  // Darker outline for visibility
          width: 2  // Thicker outline
        }
      },
      label: labels[index]
    }));
  };
  
  /**
   * Create class breaks specifically for polygon-based renderers (census tracts, counties)
   * 
   * @param {Array} breakPoints - Array of objects with min/max values for breaks
   * @param {Array} labels - Array of labels for each break
   * @param {Object} colorScheme - Optional color scheme object with level keys
   * @returns {Array} Array of class break objects for polygon renderer
   */
  export const createPolygonClassBreaks = (breakPoints, labels, colorScheme) => {
    // Default color scheme if none is provided
    const defaultColorScheme = {
      level1: [128, 0, 128, 0.45],      // Purple
      level2: [0, 0, 139, 0.45],        // Dark blue
      level3: [135, 206, 235, 0.45],    // Sky blue
      level4: [144, 238, 144, 0.45],    // Light green
      level5: [255, 255, 144, 0.45],    // Light yellow
      level6: [255, 165, 0, 0.45],      // Orange
      level7: [255, 99, 71, 0.45]       // Salmon red
    };
  
    const colorObj = colorScheme || defaultColorScheme;
    
    return breakPoints.map((point, index) => ({
      minValue: point.min === undefined ? -Infinity : point.min,
      maxValue: point.max === undefined ? Infinity : point.max,
      symbol: {
        type: "simple-fill",
        color: colorObj[`level${index + 1}`],
        outline: {
          color: [50, 50, 50, 0.2],
          width: "0.5px"
        }
      },
      label: labels[index]
    }));
  };
  
  /**
   * Create a unique value renderer configuration for custom data points
   * 
   * @param {Array} data - The parsed data array
   * @param {String} nameColumn - The column to use for names/labels
   * @param {String} valueColumn - The column to use for values
   * @returns {Object} A unique value renderer configuration
   */
  export const createUniqueValueConfig = (data, nameColumn, valueColumn) => {
    if (!data || !data.length || !nameColumn) {
      console.error("Invalid custom data for unique value renderer");
      return null;
    }
    
    try {
      // Get unique values for the name column
      const uniqueNames = [...new Set(data.map(item => item[nameColumn]))];
      console.log(`Creating unique value renderer with ${uniqueNames.length} unique values`);
      
      // Generate a color for each unique value
      const uniqueValueInfos = uniqueNames.map((name, index) => {
        // Generate colors in a rainbow pattern
        const hue = (index / uniqueNames.length) * 360;
        return {
          value: name,
          symbol: {
            type: "simple-marker", // Point marker for custom data
            size: 28, // MUCH LARGER for visibility
            color: `hsla(${hue}, 80%, 60%, 0.9)`, // Increased opacity and saturation
            outline: {
              color: `hsl(${hue}, 90%, 40%)`, // Darker outline for contrast
              width: 3 // Thicker outline for visibility
            }
          },
          label: name
        };
      });
      
      return {
        type: "unique-value",
        field: nameColumn,
        uniqueValueInfos,
        geometryType: "point",
        customData: {
          data,
          nameColumn,
          valueColumn,
          uniqueValues: uniqueNames.length
        }
      };
    } catch (error) {
      console.error("Error creating unique value configuration:", error);
      return null;
    }
  };
  
  /**
   * Process custom CSV data to create a layer configuration for class breaks
   * 
   * @param {Array} data - The parsed CSV data
   * @param {String} nameColumn - The column to use for names/labels
   * @param {String} valueColumn - The column to use for values
   * @param {Array} colorScheme - Optional custom color scheme
   * @returns {Object} A layer configuration object for class breaks
   */
  export const createCustomLayerConfig = (data, nameColumn, valueColumn, colorScheme) => {
    if (!data || !data.length || !nameColumn || !valueColumn) {
      console.error("Invalid custom data, missing required parameters");
      return null;
    }
  
    try {
      // Extract numeric values
      const values = data
        .map(item => Number(item[valueColumn]))
        .filter(val => !isNaN(val));
      
      if (!values.length) {
        console.error("No valid numeric values found in the data");
        return null;
      }
  
      // Calculate statistics for breaks
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const range = maxValue - minValue;
      
      // Create break points - divide the range into 6 equal intervals
      const step = range / 6;
      const breakPoints = [
        { max: minValue + step },
        { min: minValue + step, max: minValue + 2 * step },
        { min: minValue + 2 * step, max: minValue + 3 * step },
        { min: minValue + 3 * step, max: minValue + 4 * step },
        { min: minValue + 4 * step, max: minValue + 5 * step },
        { min: minValue + 5 * step }
      ];
      
      // Create labels for the breaks
      const formatValue = (val) => {
        // Format based on the magnitude of the value
        if (Math.abs(val) < 0.01) return val.toExponential(2);
        if (Math.abs(val) < 1) return val.toFixed(2);
        if (Math.abs(val) < 10) return val.toFixed(1);
        return Math.round(val).toLocaleString();
      };
      
      const labels = [
        `Less than ${formatValue(minValue + step)}`,
        `${formatValue(minValue + step)} - ${formatValue(minValue + 2 * step)}`,
        `${formatValue(minValue + 2 * step)} - ${formatValue(minValue + 3 * step)}`,
        `${formatValue(minValue + 3 * step)} - ${formatValue(minValue + 4 * step)}`,
        `${formatValue(minValue + 4 * step)} - ${formatValue(minValue + 5 * step)}`,
        `${formatValue(minValue + 5 * step)} or more`
      ];
      
      // Generate the class breaks renderer configuration
      return {
        type: "class-breaks",
        field: valueColumn,
        classBreakInfos: createClassBreaks(breakPoints, labels, colorScheme),
        // Specify it's a point geometry
        geometryType: "point",
        renderer: {
          type: "class-breaks",
          field: valueColumn,
          defaultSymbol: {
            type: "simple-marker",
            size: 28, // Larger for visibility
            color: [128, 128, 128, 0.7], // More visible gray
            outline: {
              color: [0, 0, 0, 0.7], // Black outline
              width: 2 // Thicker
            }
          }
        },
        // Store original data for reference
        customData: {
          data,
          nameColumn,
          valueColumn,
          statistics: {
            min: minValue,
            max: maxValue,
            count: values.length
          }
        }
      };
    } catch (error) {
      console.error("Error creating custom layer configuration:", error);
      return null;
    }
  };
  
  /**
   * Process custom data into a dot density configuration
   * 
   * @param {Array} data - The parsed CSV data
   * @param {String} nameColumn - The column to use for names/labels
   * @param {String} valueColumn - The column to use for values
   * @returns {Object} A dot density configuration
   */
  export const createDotDensityConfig = (data, nameColumn, valueColumn) => {
    if (!data || !data.length || !nameColumn || !valueColumn) {
      console.error("Invalid custom data for dot density");
      return null;
    }
    
    try {
      // Extract numeric values
      const values = data
        .map(item => Number(item[valueColumn]))
        .filter(val => !isNaN(val));
      
      if (!values.length) {
        console.error("No valid numeric values found in the data");
        return null;
      }
      
      // Calculate appropriate dot value based on data range
      const maxValue = Math.max(...values);
      let dotValue = 1;
      
      // Scale dotValue based on the maximum value
      if (maxValue > 10000) dotValue = 100;
      else if (maxValue > 1000) dotValue = 10;
      
      // Create dot density attributes
      const attributes = data.map((item, index) => {
        // Generate a color with hue based on the index
        const hue = (index / data.length) * 360;
        return {
          field: nameColumn,
          value: item[nameColumn],
          color: `hsl(${hue}, 80%, 50%)`,
          label: `${item[nameColumn]}: ${item[valueColumn]}`
        };
      });
      
      return {
        type: "dot-density",
        field: valueColumn,
        dotValue,
        dotBlending: "additive",
        dotSize: 4, // Increased from 2 for better visibility
        outline: {
          width: 1,
          color: [0, 0, 0, 0.4] // Darker outline
        },
        legendOptions: {
          unit: "values"
        },
        attributes,
        // Store original data for reference
        customData: {
          data,
          nameColumn,
          valueColumn,
          statistics: {
            max: maxValue,
            count: values.length
          }
        }
      };
    } catch (error) {
      console.error("Error creating dot density configuration:", error);
      return null;
    }
  };
  
  /**
   * Check if a given value is a valid latitude
   * @param {number} value - The value to check
   * @returns {boolean} - True if value is a valid latitude
   */
  export const isValidLatitude = (value) => {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && Math.abs(num) <= 90;
  };
  
  /**
   * Check if a given value is a valid longitude
   * @param {number} value - The value to check
   * @returns {boolean} - True if value is a valid longitude
   */
  export const isValidLongitude = (value) => {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && Math.abs(num) <= 180;
  };