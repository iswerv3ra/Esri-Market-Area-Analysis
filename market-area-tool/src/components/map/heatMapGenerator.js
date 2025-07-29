// heatMapGenerator.js - Dedicated Heat Map Generator with Value Formatting
// Contains all logic for creating data-driven heat maps with quantile breaks and proper value formatting

/**
 * Value formatting configurations for different field types
 * Used to apply appropriate prefixes, suffixes, and decimal places to legend labels
 */
export const valueFormats = {
  income: { prefix: "$", decimals: 0, multiplier: 1 },
  homeValue: { prefix: "$", decimals: 0, multiplier: 1 },
  growth: { prefix: "", suffix: "%", decimals: 1, multiplier: 1 },
  density: { prefix: "", suffix: "/sq mi", decimals: 0, multiplier: 1 },
  age: { prefix: "", suffix: " yrs", decimals: 1, multiplier: 1 },
  unemployment: { prefix: "", suffix: "%", decimals: 1, multiplier: 1 },
  affordability: { prefix: "", decimals: 0, multiplier: 1 },
  totalPopulation: { prefix: "", decimals: 0, multiplier: 1 },
  totalHouseholds: { prefix: "", decimals: 0, multiplier: 1 },
  percentage: { prefix: "", suffix: "%", decimals: 1, multiplier: 1 },
  currency: { prefix: "$", decimals: 0, multiplier: 1 },
  ratio: { prefix: "", decimals: 2, multiplier: 1 },
  index: { prefix: "", decimals: 0, multiplier: 1 },
  default: { prefix: "", suffix: "", decimals: 2, multiplier: 1 },
};

/**
 * Determines the appropriate value format based on field name analysis
 * Analyzes field names to detect data types and apply correct formatting
 * Enhanced with common census and demographic field abbreviations
 * 
 * @param {string} fieldName - The field name to analyze for format detection
 * @returns {Object} Format object with prefix, suffix, decimals, and multiplier properties
 */
export const getValueFormat = (fieldName) => {
  if (!fieldName || typeof fieldName !== 'string') {
    return valueFormats.default;
  }
  
  const fieldLower = fieldName.toLowerCase();
  
  // Income and earnings detection - enhanced with common abbreviations
  if (fieldLower.includes('income') || 
      fieldLower.includes('earnings') || 
      fieldLower.includes('wage') || 
      fieldLower.includes('salary') ||
      fieldLower.includes('disposable') ||
      // Enhanced: Common census field abbreviations for income
      fieldLower.includes('medhinc') ||     // Median Household Income
      fieldLower.includes('medinc') ||      // Median Income
      fieldLower.includes('avghinc') ||     // Average Household Income
      fieldLower.includes('avginc') ||      // Average Income
      fieldLower.includes('tothinc') ||     // Total Household Income
      fieldLower.includes('totinc') ||      // Total Income
      fieldLower.includes('percapinc') ||   // Per Capita Income
      fieldLower.includes('pcinc') ||       // Per Capita Income (short)
      fieldLower.includes('hhinc') ||       // Household Income
      fieldLower.includes('faminc') ||      // Family Income
      fieldLower.includes('medfaminc') ||   // Median Family Income
      fieldLower.includes('avgfaminc') ||   // Average Family Income
      // Pattern matching for income ranges and brackets
      (fieldLower.includes('inc') && (fieldLower.includes('_cy') || fieldLower.includes('_est'))) ||
      // Common income field patterns
      fieldLower.match(/^(med|avg|tot|per|hh|fam).*inc.*$/)) {
    return valueFormats.income;
  }
  
  // Home and property value detection - enhanced with abbreviations
  if ((fieldLower.includes('home') && fieldLower.includes('value')) ||
      (fieldLower.includes('property') && fieldLower.includes('value')) ||
      (fieldLower.includes('house') && fieldLower.includes('value')) ||
      fieldLower.includes('homevalue') ||
      // Enhanced: Common real estate field abbreviations
      fieldLower.includes('medhval') ||     // Median Home Value
      fieldLower.includes('medval') ||      // Median Value
      fieldLower.includes('avghval') ||     // Average Home Value
      fieldLower.includes('avgval') ||      // Average Value
      fieldLower.includes('tothval') ||     // Total Home Value
      fieldLower.includes('propval') ||     // Property Value
      fieldLower.includes('realest') ||     // Real Estate
      fieldLower.includes('apprval') ||     // Appraised Value
      // Pattern matching for value fields
      (fieldLower.includes('val') && (fieldLower.includes('_cy') || fieldLower.includes('_est'))) ||
      fieldLower.match(/^(med|avg|tot).*val.*$/)) {
    return valueFormats.homeValue;
  }
  
  // Growth rate and CAGR detection - enhanced
  if (fieldLower.includes('growth') || 
      fieldLower.includes('cagr') ||
      fieldLower.includes('change') ||
      fieldLower.includes('increase') ||
      fieldLower.includes('decrease') ||
      (fieldLower.includes('rate') && !fieldLower.includes('unemployment')) ||
      // Enhanced: Growth-related abbreviations
      fieldLower.includes('grwth') ||
      fieldLower.includes('chng') ||
      fieldLower.includes('incr') ||
      fieldLower.includes('decr') ||
      // Pattern for growth fields
      fieldLower.match(/.*_(grw|chg|inc|dec).*/) ||
      fieldLower.match(/^(pop|hh|emp).*growth.*$/)) {
    return valueFormats.growth;
  }
  
  // Percentage fields detection - enhanced
  if (fieldLower.includes('percent') ||
      fieldLower.includes('pct') ||
      fieldLower.includes('%') ||
      fieldLower.includes('unemployment') && fieldLower.includes('rate') ||
      fieldLower.includes('vacancy') && fieldLower.includes('rate') ||
      fieldLower.includes('homeownership') && fieldLower.includes('rate') ||
      // Enhanced: Common percentage abbreviations
      fieldLower.includes('unemprt') ||     // Unemployment Rate
      fieldLower.includes('unempr') ||      // Unemployment Rate
      fieldLower.includes('vacrt') ||       // Vacancy Rate
      fieldLower.includes('ownrt') ||       // Ownership Rate
      fieldLower.includes('rentrt') ||      // Rental Rate
      fieldLower.includes('pvrtyrt') ||     // Poverty Rate
      fieldLower.includes('povrt') ||       // Poverty Rate
      // Pattern matching for rate fields
      fieldLower.match(/.*_(rt|rate|pct).*$/) ||
      fieldLower.match(/^(unemp|vac|own|rent|pov).*r(ate|t)$/)) {
    return valueFormats.percentage;
  }
  
  // Density fields detection - enhanced
  if (fieldLower.includes('density') ||
      fieldLower.includes('dens') ||
      fieldLower.includes('persqmi') ||
      fieldLower.includes('per_sq_mi') ||
      // Pattern for density fields
      fieldLower.match(/.*_dens.*/) ||
      fieldLower.match(/.*_d$/)) {
    return valueFormats.density;
  }
  
  // Age fields detection - enhanced
  if (fieldLower.includes('age') && !fieldLower.includes('average') && !fieldLower.includes('percentage') ||
      fieldLower.includes('medage') ||      // Median Age
      fieldLower.includes('avgage') ||      // Average Age
      fieldLower.includes('meanage') ||     // Mean Age
      // Pattern for age fields
      fieldLower.match(/^(med|avg|mean).*age.*$/)) {
    return valueFormats.age;
  }
  
  // Index and ratio detection - enhanced
  if (fieldLower.includes('index') ||
      fieldLower.includes('gini') ||
      fieldLower.includes('diversity') ||
      fieldLower.includes('idx') ||
      // Pattern for index fields
      fieldLower.match(/.*_(idx|index).*$/)) {
    return valueFormats.index;
  }
  
  if (fieldLower.includes('ratio') ||
      fieldLower.includes('dependency') ||
      fieldLower.includes('rt') && !fieldLower.includes('rate') ||
      // Pattern for ratio fields
      fieldLower.match(/.*_ratio.*$/)) {
    return valueFormats.ratio;
  }
  
  // Population count fields (not density, not percentage) - enhanced
  if (fieldLower.includes('population') && 
      !fieldLower.includes('density') && 
      !fieldLower.includes('percent') ||
      fieldLower.includes('totpop') ||      // Total Population
      fieldLower.includes('pop_') ||        // Population prefix
      fieldLower.includes('popul') ||       // Population variations
      // Pattern for population fields
      fieldLower.match(/^(tot|total).*pop.*/) ||
      fieldLower.match(/^pop(_|.*[0-9])/)) {
    return valueFormats.totalPopulation;
  }
  
  // Household count fields (not income related) - enhanced
  if (fieldLower.includes('households') && 
      !fieldLower.includes('income') && 
      !fieldLower.includes('percent') ||
      fieldLower.includes('tothh') ||       // Total Households
      fieldLower.includes('tothhld') ||     // Total Households
      fieldLower.includes('hh_') ||         // Household prefix
      fieldLower.includes('hhlds') ||       // Households
      // Pattern for household count fields
      fieldLower.match(/^(tot|total).*h(h|ousehold).*/) ||
      fieldLower.match(/^hh(_|[0-9])/)) {
    return valueFormats.totalHouseholds;
  }
  
  // Housing units detection - enhanced
  if (fieldLower.includes('housing') && fieldLower.includes('units') ||
      fieldLower.includes('hunits') ||      // Housing Units
      fieldLower.includes('hu_') ||         // Housing Units prefix
      fieldLower.includes('housingunits') ||
      // Pattern for housing unit fields
      fieldLower.match(/^(tot|total).*h(u|ousing).*unit.*/) ||
      fieldLower.match(/^hu(_|[0-9])/)) {
    return valueFormats.totalHouseholds; // Same format as household counts
  }
  
  // Default fallback
  return valueFormats.default;
};

/**
 * Formats a numeric value according to the specified format configuration
 * Handles currency symbols, percentage signs, decimal places, and locale formatting
 * 
 * @param {number} value - The numeric value to format
 * @param {Object} format - Format object containing prefix, suffix, decimals, and multiplier
 * @returns {string} Properly formatted value string ready for display
 */
export const formatValue = (value, format = valueFormats.default) => {
  // Handle non-numeric or invalid values
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return String(value);
  }
  
  // Apply multiplier if specified
  const adjustedValue = value * (format.multiplier || 1);
  
  // Round to specified decimal places
  const decimals = format.decimals !== undefined ? format.decimals : 2;
  const roundedValue = Number(adjustedValue.toFixed(decimals));
  
  // Format with locale-specific thousand separators
  const formattedNumber = roundedValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  // Combine prefix, number, and suffix
  const prefix = format.prefix || '';
  const suffix = format.suffix || '';
  
  return `${prefix}${formattedNumber}${suffix}`;
};

/**
 * Creates formatted range labels for class breaks with proper value formatting
 * Handles special cases for first and last breaks, and ensures consistent formatting
 * 
 * @param {number} minValue - Minimum value of the range
 * @param {number} maxValue - Maximum value of the range
 * @param {number} index - Index of this break in the total breaks array
 * @param {number} totalBreaks - Total number of breaks being created
 * @param {Object} format - Value format configuration object
 * @returns {string} Formatted label string for the class break
 */
export const createFormattedLabel = (minValue, maxValue, index, totalBreaks, format = valueFormats.default) => {
  // Handle single break case
  if (totalBreaks === 1) {
    if (minValue === maxValue) {
      return formatValue(minValue, format);
    }
    return `${formatValue(minValue, format)} - ${formatValue(maxValue, format)}`;
  }
  
  // Handle first break - "Less than" format
  if (index === 0) {
    return `Less than ${formatValue(maxValue, format)}`;
  }
  
  // Handle last break - "or more" format
  if (index === totalBreaks - 1) {
    return `${formatValue(minValue, format)} or more`;
  }
  
  // Handle middle breaks - standard range format
  return `${formatValue(minValue, format)} - ${formatValue(maxValue, format)}`;
};

/**
 * Intelligently rounds numbers based on their magnitude for better display in visualizations
 * Uses different rounding strategies based on the scale of the input value
 * 
 * @param {number} value - Value to round
 * @return {number} Rounded value appropriate for the magnitude
 */
const smartRound = (value) => {
  if (typeof value !== 'number' || isNaN(value) || value === Infinity) return value;
  if (Math.abs(value) < 10) return Math.round(value);
  if (Math.abs(value) < 100) return Math.round(value / 10) * 10;
  if (Math.abs(value) < 1000) return Math.round(value / 100) * 100;
  if (Math.abs(value) < 10000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 10000) * 10000;
};

/**
 * Determines the optimal number of breaks based on total data point count
 * Uses exact thresholds from specifications for consistent visualization
 * 
 * @param {number} dataCount - Total number of data points
 * @return {number} Optimal number of breaks (1-10)
 */
const determineBreakCountByAreas = (dataCount) => {
  if (dataCount <= 1) return 1;
  if (dataCount <= 5) return 2;
  if (dataCount <= 9) return 3;
  if (dataCount <= 16) return 4;
  if (dataCount <= 25) return 5;
  if (dataCount <= 30) return 6;
  if (dataCount <= 42) return 7;
  if (dataCount <= 56) return 8;
  if (dataCount <= 81) return 9;
  return 10; // For 82+ data points
};

// Define the 7-level color scheme with carefully selected colors and opacities
const colorScheme = {
  level1: [128, 0, 128, 0.15], // Purple
  level2: [0, 0, 139, 0.15], // Dark blue
  level3: [135, 206, 235, 0.35], // Sky blue
  level4: [144, 238, 144, 0.35], // Light green
  level5: [255, 255, 144, 0.35], // Light yellow
  level6: [255, 165, 0, 0.20], // Orange
  level7: [255, 99, 71, 0.35], // Salmon red
};

/**
 * Helper function to get color from the 7-level color scheme
 * Maps break indices to appropriate color levels for consistent visualization
 * 
 * @param {number} index - The break index (0-based)
 * @param {number} totalBreaks - Total number of breaks
 * @returns {Array} Color array [r, g, b, a]
 */
const getColorFromScheme = (index, totalBreaks) => {
  // Map the index to one of the 7 color levels
  const colorLevel = Math.min(index + 1, 7);
  return colorScheme[`level${colorLevel}`];
};

/**
 * Generate realistic generic class breaks with proper population ranges and formatting
 * Provides fallback breaks when data-driven analysis is not possible
 * 
 * @param {Object} valueFormat - Optional format configuration for values
 * @returns {Array} Array of 7 class break objects with realistic population ranges
 */
const generateGeneric7LevelBreaks = (valueFormat = valueFormats.default) => {
  console.log(`[HeatMap] Generating 7 realistic generic breaks with formatting:`, valueFormat);
  
  const breaks = [];
  const breakCount = 7;
  
  // Realistic population ranges for census tracts - adjust based on format type
  let populationRanges;
  
  if (valueFormat === valueFormats.income || valueFormat === valueFormats.homeValue) {
    // Income/home value ranges
    populationRanges = [
      { min: 0, max: 25000 },
      { min: 25001, max: 50000 },
      { min: 50001, max: 75000 },
      { min: 75001, max: 100000 },
      { min: 100001, max: 150000 },
      { min: 150001, max: 200000 },
      { min: 200001, max: 500000 }
    ];
  } else if (valueFormat === valueFormats.percentage || valueFormat === valueFormats.growth) {
    // Percentage ranges
    populationRanges = [
      { min: 0, max: 5 },
      { min: 5.1, max: 10 },
      { min: 10.1, max: 20 },
      { min: 20.1, max: 30 },
      { min: 30.1, max: 50 },
      { min: 50.1, max: 75 },
      { min: 75.1, max: 100 }
    ];
  } else {
    // Default population ranges
    populationRanges = [
      { min: 0, max: 500 },
      { min: 501, max: 1500 },
      { min: 1501, max: 3000 },
      { min: 3001, max: 5000 },
      { min: 5001, max: 8000 },
      { min: 8001, max: 12000 },
      { min: 12001, max: 50000 }
    ];
  }
  
  for (let i = 0; i < breakCount; i++) {
    const range = populationRanges[i];
    const colorArray = getColorFromScheme(i, breakCount);
    
    // Use the new formatting function for labels
    const label = createFormattedLabel(range.min, range.max, i, breakCount, valueFormat);
    
    // For the last break, set maxValue to null
    const isLastBreak = i === breakCount - 1;
    const maxValue = isLastBreak ? null : range.max;
    
    const breakInfo = {
      minValue: range.min,
      maxValue: maxValue,
      label: label,
      symbol: {
        type: "simple-fill",
        style: "solid",
        color: [...colorArray],
        outline: {
          color: 'rgba(255, 255, 255, 0.5)',
          width: 0.5
        }
      },
      preserveOpacity: true,
      originalOpacity: colorArray[3],
      hasCustomOpacities: true,
      colorSchemeLevel: `level${Math.min(i + 1, 7)}`,
      valueFormat: valueFormat
    };
    
    breaks.push(breakInfo);
    console.log(`[HeatMap] Generic break ${i}: ${label} using ${breakInfo.colorSchemeLevel}`);
  }
  
  console.log(`[HeatMap] Generated ${breaks.length} realistic generic breaks with proper formatting`);
  return breaks;
};

/**
 * Intelligently rounds a number to a "clean" value for use in legends
 * making them easier for users to read and understand
 * 
 * @param {number} num - The number to round
 * @returns {number} The rounded, more readable number
 */
const smartRoundInLegend = (num) => {
  if (num <= 100) return Math.round(num); // Round to nearest integer for small numbers
  if (num < 1000) return Math.round(num / 10) * 10; // Round to nearest 10
  if (num < 10000) return Math.round(num / 100) * 100; // Round to nearest 100
  if (num < 100000) return Math.round(num / 1000) * 1000; // Round to nearest 1,000
  return Math.round(num / 5000) * 5000; // Round to nearest 5,000 for large numbers
};


/**
 * Enhanced data-driven heat map breaks that uses the URL directly from the areaType config
 * with intelligent value formatting based on field type detection
 * 
 * FIXED: Last break now uses actual maxValue instead of null for proper ArcGIS rendering
 * 
 * @param {string} fieldName - The field to analyze (e.g., "TOTPOP_CY")
 * @param {Object} areaType - The area type object { value, label, url } from mapConfig.js
 * @param {Object} mapView - Optional map view to limit query to current extent
 * @return {Promise<Array>} Promise resolving to array of class break objects with proper formatting
 */
const generateDataDrivenHeatMapBreaks = async (fieldName, areaType, mapView = null) => {
  const areaTypeName = areaType?.label || 'the selected area';
  console.log(`[DataDrivenBreaks] Starting quantile-based analysis for ${fieldName} in ${areaTypeName}`);
  
  // Determine the appropriate value format for this field
  const valueFormat = getValueFormat(fieldName);
  console.log(`[DataDrivenBreaks] Detected format for ${fieldName}:`, valueFormat);
  
  const serviceUrl = areaType?.url;

  if (!serviceUrl) {
    console.error(`[DataDrivenBreaks] No URL defined for area type: ${areaTypeName}. Falling back to generic breaks.`);
    return generateGeneric7LevelBreaks(valueFormat);
  }

  try {
    console.log(`[DataDrivenBreaks] Using configured service URL: ${serviceUrl}`);
    
    const [{ default: FeatureLayer }, { default: Query }, { default: StatisticDefinition }] = await Promise.all([
      import("@arcgis/core/layers/FeatureLayer"),
      import("@arcgis/core/rest/support/Query"),
      import("@arcgis/core/rest/support/StatisticDefinition")
    ]);

    const normalizeFieldName = (field) => field.toUpperCase().replace(/_HEAT$/, '');
    const normalizedFieldName = normalizeFieldName(fieldName);

    const workingLayer = new FeatureLayer({
      url: serviceUrl,
      outFields: ["*"] 
    });

    await workingLayer.load();
    const availableFields = workingLayer.fields.map(f => f.name);

    const findBestField = (targetField, availableFields) => {
        const target = targetField.toUpperCase();
        const exactMatch = availableFields.find(f => f.toUpperCase() === target);
        if (exactMatch) return exactMatch;
        const baseName = target.replace(/_CY$/, '');
        const fuzzyMatch = availableFields.find(f => f.toUpperCase().includes(baseName));
        return fuzzyMatch || null;
    };

    const actualFieldName = findBestField(normalizedFieldName, availableFields);

    if (!actualFieldName) {
      console.error(`[DataDrivenBreaks] Could not find a suitable field for "${normalizedFieldName}" in the service at ${serviceUrl}.`);
      console.log(`[DataDrivenBreaks] Available fields:`, availableFields.slice(0, 30));
      workingLayer.destroy();
      return generateGeneric7LevelBreaks(valueFormat);
    }
    
    console.log(`[DataDrivenBreaks] ✅ Using matched field: ${actualFieldName}`);
    
    const executeStatisticsQuery = async () => {
        const statsQuery = new Query({
            where: `${actualFieldName} IS NOT NULL AND ${actualFieldName} >= 0`,
            returnGeometry: false,
            outStatistics: [
              new StatisticDefinition({ statisticType: "min", onStatisticField: actualFieldName, outStatisticFieldName: "minValue" }),
              new StatisticDefinition({ statisticType: "max", onStatisticField: actualFieldName, outStatisticFieldName: "maxValue" }),
              new StatisticDefinition({ statisticType: "count", onStatisticField: actualFieldName, outStatisticFieldName: "totalCount" }),
              new StatisticDefinition({ statisticType: "avg", onStatisticField: actualFieldName, outStatisticFieldName: "avgValue" }),
              new StatisticDefinition({ statisticType: "stddev", onStatisticField: actualFieldName, outStatisticFieldName: "stdDev" })
            ]
        });

        let spatiallyFiltered = false;
        if (mapView && mapView.extent) {
            statsQuery.geometry = mapView.extent;
            statsQuery.spatialRelationship = "intersects";
            spatiallyFiltered = true;
            console.log(`[DataDrivenBreaks] Query spatially filtered to current map view extent.`);
        }

        const statsResult = await workingLayer.queryFeatures(statsQuery);
        if (!statsResult.features || statsResult.features.length === 0) throw new Error('No statistics returned.');
        const stats = statsResult.features[0].attributes;
        
        return {
            minValue: Number(stats.minValue) || 0,
            maxValue: Number(stats.maxValue) || 0,
            totalCount: Number(stats.totalCount) || 0,
            avgValue: Number(stats.avgValue) || 0,
            stdDev: Number(stats.stdDev) || 0,
            spatiallyFiltered,
            actualFieldUsed: actualFieldName,
        };
    };

    const stats = await executeStatisticsQuery();
    
    if (stats.totalCount < 2 || stats.minValue === stats.maxValue) {
      console.warn(`[DataDrivenBreaks] Insufficient data variation for ${actualFieldName}.`);
      workingLayer.destroy();
      return generateGeneric7LevelBreaks(valueFormat);
    }
        
    const generateOptimizedBreaks = async (stats, workingLayer, actualFieldName, mapView, breakCount = 7) => {
      const { minValue, maxValue, totalCount } = stats;
      
      // Get absolute field bounds to ensure complete map coverage
      const getAbsoluteFieldBounds = (fieldName) => {
          const fieldType = fieldName.toLowerCase();
          const valueFormat = getValueFormat(fieldName);
          
          // Set absolute minimums (usually 0 for most demographic data)
          let absoluteMin = 0;
          
          // Set reasonable absolute maximums based on field type
          let absoluteMax;
          if (valueFormat === valueFormats.age) {
              absoluteMax = 100; // Age rarely goes above 100
          } else if (valueFormat === valueFormats.percentage || valueFormat === valueFormats.growth) {
              absoluteMax = 100; // Percentages cap at 100%
          } else if (valueFormat === valueFormats.income) {
              absoluteMax = 1000000; // $1M+ income threshold
          } else if (valueFormat === valueFormats.homeValue) {
              absoluteMax = 5000000; // $5M+ home value threshold
          } else if (fieldType.includes('population') || fieldType.includes('households')) {
              // For population/household counts, use a generous upper bound
              absoluteMax = Math.max(maxValue * 3, 100000);
          } else {
              // For other numeric fields, use a generous multiplier
              absoluteMax = Math.max(maxValue * 2, 50000);
          }
          
          return { absoluteMin, absoluteMax };
      };
      
      const { absoluteMin, absoluteMax } = getAbsoluteFieldBounds(actualFieldName);
      
      console.log(`[DataDrivenBreaks] QUANTILE DISTRIBUTION: Creating ${breakCount} ranges`);
      console.log(`[DataDrivenBreaks] Data range: ${minValue} to ${maxValue}`);
      console.log(`[DataDrivenBreaks] Absolute bounds: ${absoluteMin} to ${absoluteMax} (ensures complete map coverage)`);

      if (maxValue <= minValue || totalCount < breakCount) {
          console.warn(`[DataDrivenBreaks] Insufficient data variation or count for quantile breaks, using simple range.`);
          return [{ min: absoluteMin, max: absoluteMax }];
      }

      console.log(`[DataDrivenBreaks] Querying all ${totalCount} values for quantile distribution...`);
      
      const valuesQuery = new Query({
          where: `${actualFieldName} IS NOT NULL AND ${actualFieldName} >= 0`,
          returnGeometry: false,
          outFields: [actualFieldName],
          orderByFields: [`${actualFieldName} ASC`]
      });

      if (mapView && mapView.extent) {
          valuesQuery.geometry = mapView.extent;
          valuesQuery.spatialRelationship = "intersects";
      }

      const valuesResult = await workingLayer.queryFeatures(valuesQuery);
      
      if (!valuesResult.features || valuesResult.features.length < breakCount) {
          console.warn(`[DataDrivenBreaks] Insufficient features for quantile breaks, using equal intervals.`);
          
          // Create equal intervals within actual data range, but extend bounds
          const dataRange = maxValue - minValue;
          const interval = dataRange / (breakCount - 2); // -2 because first and last ranges extend beyond data
          
          const breakPoints = [absoluteMin];
          
          // Add interior break points based on actual data
          for (let i = 1; i < breakCount - 1; i++) {
              const point = minValue + ((i - 1) * interval);
              const roundedPoint = smartRoundInLegend(point);
              breakPoints.push(roundedPoint);
          }
          
          breakPoints.push(absoluteMax); // Use absolute max for complete coverage
          
          const overlappingRanges = [];
          for (let i = 0; i < breakPoints.length - 1; i++) {
              overlappingRanges.push({ 
                  min: breakPoints[i], 
                  max: breakPoints[i + 1]
              });
          }
          
          return overlappingRanges;
      }

      const allValues = valuesResult.features
          .map(feature => Number(feature.attributes[actualFieldName]))
          .filter(value => !isNaN(value) && value >= 0)
          .sort((a, b) => a - b);

      const actualCount = allValues.length;
      console.log(`[DataDrivenBreaks] Processing ${actualCount} sorted values for quantile distribution`);

      // Create quantile break points for the middle ranges (not including absolute bounds)
      const quantileBreakPoints = [];
      for (let i = 1; i < breakCount - 1; i++) {
          const percentile = i / (breakCount - 1); // Adjust for the fact that we're adding absolute bounds
          let index = Math.floor(percentile * actualCount);
          
          if (index >= actualCount) index = actualCount - 1;
          if (index < 0) index = 0;
          
          const breakValue = allValues[index];
          quantileBreakPoints.push(breakValue);
      }

      // Create break points: absoluteMin + quantile points + absoluteMax
      const rawBreakPoints = [absoluteMin, ...quantileBreakPoints, absoluteMax];
      
      console.log(`[DataDrivenBreaks] Raw break points with absolute bounds:`, rawBreakPoints);
      console.log(`[DataDrivenBreaks] First range: ${absoluteMin} to ${quantileBreakPoints[0]} (covers below data minimum)`);
      console.log(`[DataDrivenBreaks] Last range: ${quantileBreakPoints[quantileBreakPoints.length - 1]} to ${absoluteMax} (covers above data maximum)`);
      
      // Apply smart rounding to quantile points only (preserve absolute bounds)
      const dataRange = maxValue - minValue;
      let processedBreakPoints = [absoluteMin]; // Keep absolute min as-is
      
      let roundedQuantilePoints;
      if (dataRange <= 10) {
          // Small range - use 1 decimal place for precision
          roundedQuantilePoints = quantileBreakPoints.map(value => Math.round(value * 10) / 10);
      } else if (dataRange <= 100) {
          // Medium range - use whole numbers
          roundedQuantilePoints = quantileBreakPoints.map(value => Math.round(value));
      } else {
          // Large range - use smart rounding
          roundedQuantilePoints = quantileBreakPoints.map(value => smartRoundInLegend(value));
      }
      
      processedBreakPoints.push(...roundedQuantilePoints);
      processedBreakPoints.push(absoluteMax); // Keep absolute max as-is
      
      // Remove duplicates and sort
      let uniqueBreakPoints = [...new Set(processedBreakPoints)].sort((a, b) => a - b);
      
      console.log(`[DataDrivenBreaks] Processed break points with absolute bounds:`, uniqueBreakPoints);
      
      // Handle case where rounding created too few unique points
      if (uniqueBreakPoints.length < 4) {
          console.log(`[DataDrivenBreaks] Too few unique break points after rounding, using higher precision`);
          processedBreakPoints = [absoluteMin];
          
          if (dataRange <= 10) {
              roundedQuantilePoints = quantileBreakPoints.map(value => Math.round(value * 100) / 100);
          } else {
              roundedQuantilePoints = quantileBreakPoints.map(value => Math.round(value * 10) / 10);
          }
          
          processedBreakPoints.push(...roundedQuantilePoints);
          processedBreakPoints.push(absoluteMax);
          uniqueBreakPoints = [...new Set(processedBreakPoints)].sort((a, b) => a - b);
      }
      
      // Create ranges from the break points
      const overlappingRanges = [];
      for (let i = 0; i < uniqueBreakPoints.length - 1; i++) {
          const min = uniqueBreakPoints[i];
          const max = uniqueBreakPoints[i + 1];
          
          if (min < max) {
              overlappingRanges.push({ 
                  min: min, 
                  max: max
              });
          }
      }
      
      // CRITICAL: Ensure the last range uses the absolute maximum
      if (overlappingRanges.length > 0) {
          const lastRange = overlappingRanges[overlappingRanges.length - 1];
          const firstRange = overlappingRanges[0];
          
          // Force absolute bounds on first and last ranges
          firstRange.min = absoluteMin;
          lastRange.max = absoluteMax;
          
          console.log(`[DataDrivenBreaks] FORCED absolute bounds:`);
          console.log(`[DataDrivenBreaks] - First range: ${absoluteMin} to ${firstRange.max}`);
          console.log(`[DataDrivenBreaks] - Last range: ${lastRange.min} to ${absoluteMax}`);
      }

      // Ensure we have the desired number of ranges
      while (overlappingRanges.length < breakCount && overlappingRanges.length > 0) {
          // Find the largest range (excluding the first and last which are our buffer ranges)
          let largestRangeIndex = 1; // Start from index 1 to avoid splitting the bottom buffer
          let largestRangeSize = 0;
          
          const endIndex = Math.min(overlappingRanges.length - 1, overlappingRanges.length - 1); // Avoid last range too
          for (let i = 1; i < endIndex; i++) {
              const rangeSize = overlappingRanges[i].max - overlappingRanges[i].min;
              if (rangeSize > largestRangeSize) {
                  largestRangeSize = rangeSize;
                  largestRangeIndex = i;
              }
          }
          
          // Split the largest range in half
          const rangeToSplit = overlappingRanges[largestRangeIndex];
          const midPoint = (rangeToSplit.min + rangeToSplit.max) / 2;
          const roundedMidPoint = smartRoundInLegend(midPoint);
          
          // Replace the large range with two smaller ranges
          overlappingRanges.splice(largestRangeIndex, 1, 
              { min: rangeToSplit.min, max: roundedMidPoint },
              { min: roundedMidPoint, max: rangeToSplit.max }
          );
      }

      // If we have more than desired ranges, keep the first ones
      if (overlappingRanges.length > breakCount) {
          overlappingRanges.splice(breakCount);
      }

      // FINAL PROTECTION: Always ensure absolute bounds are preserved
      if (overlappingRanges.length > 0) {
          overlappingRanges[0].min = absoluteMin;
          overlappingRanges[overlappingRanges.length - 1].max = absoluteMax;
          
          console.log(`[DataDrivenBreaks] FINAL PROTECTION applied:`);
          console.log(`[DataDrivenBreaks] - First range: ${absoluteMin} to ${overlappingRanges[0].max}`);
          console.log(`[DataDrivenBreaks] - Last range: ${overlappingRanges[overlappingRanges.length - 1].min} to ${absoluteMax}`);
      }

      console.log("[DataDrivenBreaks] Final ranges with absolute bounds:", overlappingRanges);
      return overlappingRanges;
  };

    const breakRanges = await generateOptimizedBreaks(stats, workingLayer, actualFieldName, mapView, 7);
    
    // FIXED: Create class break objects with proper maxValue for all breaks including the last one
    const classBreaks = breakRanges.map((range, index) => {
    const colorArray = getColorFromScheme(index, breakRanges.length);
    
    // Use the enhanced formatting function for labels
    const label = createFormattedLabel(range.min, range.max, index, breakRanges.length, valueFormat);
    
    // *** CRITICAL FIX: Always use the actual range.max value for ArcGIS renderer ***
    // Keep the "or more" label for UI display, but provide real maxValue for renderer
    const isLastBreak = index === breakRanges.length - 1;
    const maxValue = range.max; // ALWAYS use the actual max value from the range
    
    // Store the absolute maximum for reference and label generation
    const absoluteMax = range.max;
    
    console.log(`[DataDrivenBreaks] FIXED: Break ${index + 1}: min=${range.min}, max=${maxValue} (was null for last break)`);
    
    return {
        minValue: range.min,
        maxValue: maxValue, // FIXED: Now always has a real numeric value
        label: label, // This will still show "X or more" for the last break
        symbol: {
        type: "simple-fill",
        style: "solid",
        color: [...colorArray],
        outline: {
            color: 'rgba(255, 255, 255, 0.5)',
            width: 0.5
        }
        },
        dataSource: 'arcgis_query_quantile',
        valueFormat: valueFormat,
        // Store metadata about this being the last break
        isLastBreak: isLastBreak,
        absoluteMax: absoluteMax, // Store the absolute max for reference
        // Enhanced metadata
        dataStats: {
            ...stats,
            serviceUrl: serviceUrl,
            requestedField: fieldName,
            breakType: 'quantile',
            usedSmartRounding: true,
            valueFormat: valueFormat,
            generatedAt: new Date().toISOString(),
            // Add fix metadata
            hasFixedMaxValue: true,
            originalMaxValueWasNull: isLastBreak, // Track which break was originally null
        }
    };
    });

    workingLayer.destroy();
    
    console.log(`[DataDrivenBreaks] FIXED: Successfully generated ${classBreaks.length} class breaks with proper maxValue for all breaks`);
    console.log(`[DataDrivenBreaks] Sample fixed breaks:`, classBreaks.slice(-2).map(b => `${b.minValue}-${b.maxValue}: ${b.label}`));
    
    return classBreaks;

  } catch (error) {
    console.error(`[DataDrivenBreaks] Critical error during quantile analysis:`, error);
    return generateGeneric7LevelBreaks(valueFormat); 
  }
};

// Helper function to convert area type to string
const convertAreaTypeToString = (value) => {
  if (value === null || value === undefined) {
    return 'tract';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? convertAreaTypeToString(value[0]) : 'tract';
  }
  if (typeof value === 'object' && value.value !== undefined) {
    return convertAreaTypeToString(value.value);
  }
  if (typeof value === 'string') {
    const validAreaTypes = ['tract', 'county', 'block_group', 'msa', 'state'];
    if (validAreaTypes.includes(value.toLowerCase())) return value.toLowerCase();
    return 'tract';
  }
  if (typeof value === 'number') {
    switch (value) {
      case 11: return 'county';
      case 12: return 'tract';
      case 150: return 'block_group';
      default: 
        return 'tract';
    }
  }
  return 'tract';
};

// Helper to get specific config from initialLayerConfigurations
const getInitialConfigForVisualization = (visualizationValue) => {
  return null;
};

/**
 * Enhanced createDataDrivenHeatMap with map view-based optimization, quantile breaks, and value formatting
 * Automatically detects field types and applies appropriate formatting to legend labels
 * When called from map regeneration context, automatically uses current map view
 * 
 * @param {string} selectedVisualization - The visualization field name
 * @param {Object} selectedAreaType - The area type configuration object
 * @param {string} mapName - Name for the generated map
 * @param {Object} mapView - Optional map view for spatial optimization 
 * @param {Function} mapViewGetter - Optional function to get map view
 * @param {Object} options - Additional options including value formatting
 * @returns {Object} Complete map configuration with formatted class breaks
 */
export const createDataDrivenHeatMap = async (selectedVisualization, selectedAreaType, mapName, mapView = null, mapViewGetter = null, options = {}) => {
  console.log("[HeatMapGenerator] Creating enhanced data-driven heat map with quantile breaks and value formatting...");
  
  try {
    // Convert area type to string format
    const areaTypeString = convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract');
    
    // Extract the actual field name (remove any UI suffixes like _HEAT)
    const actualFieldName = selectedVisualization.replace(/_HEAT$|_DOT$|_VIZ$|_MAP$/g, '');
    
    // Determine value format - use provided format or auto-detect
    const valueFormat = options.valueFormat || getValueFormat(actualFieldName);
    
    console.log(`[HeatMapGenerator] Processing field: ${actualFieldName}, area type: ${areaTypeString}, format:`, valueFormat);
    
    // COMPREHENSIVE MAP VIEW DETECTION SYSTEM
    let currentMapView = mapView;
    let detectionMethod = 'parameter';
    
    if (!currentMapView) {
      console.log(`[HeatMapGenerator] No mapView parameter provided, attempting comprehensive detection...`);
      
      // Strategy 1: Use provided getter function
      if (mapViewGetter && typeof mapViewGetter === 'function') {
        try {
          currentMapView = mapViewGetter();
          if (currentMapView && currentMapView.extent) {
            detectionMethod = 'getter_function';
            console.log(`[HeatMapGenerator] ✅ Map view obtained via getter function`);
          }
        } catch (e) {
          console.warn(`[HeatMapGenerator] Getter function failed:`, e);
        }
      }
      
      // Strategy 2: Check for common React patterns
      if (!currentMapView) {
        try {
          const reactFiberNode = document.querySelector('[data-reactroot]') || 
                                document.querySelector('#root') || 
                                document.querySelector('.map-container');
          
          if (reactFiberNode && reactFiberNode._reactInternalFiber) {
            const findMapViewInFiber = (fiber) => {
              if (!fiber) return null;
              
              if (fiber.stateNode) {
                const state = fiber.stateNode.state || {};
                const props = fiber.stateNode.props || {};
                
                if (state.mapView && state.mapView.extent) return state.mapView;
                if (props.mapView && props.mapView.extent) return props.mapView;
                if (state.view && state.view.extent) return state.view;
                if (props.view && props.view.extent) return props.view;
              }
              
              if (fiber.ref && fiber.ref.current && fiber.ref.current.extent) {
                return fiber.ref.current;
              }
              
              let child = fiber.child;
              while (child) {
                const result = findMapViewInFiber(child);
                if (result) return result;
                child = child.sibling;
              }
              
              return null;
            };
            
            currentMapView = findMapViewInFiber(reactFiberNode._reactInternalFiber);
            if (currentMapView) {
              detectionMethod = 'react_fiber';
              console.log(`[HeatMapGenerator] ✅ Map view found via React fiber tree`);
            }
          }
        } catch (e) {
          console.log(`[HeatMapGenerator] React fiber detection failed:`, e);
        }
      }
      
      // Strategy 3: Enhanced global scope detection
      if (!currentMapView && typeof window !== 'undefined') {
        try {
          const globalNames = [
            'mapView', 'view', 'map', 'esriView', 'arcgisView', 'gisView',
            'mapComponent', 'mapInstance', 'applicationView', 'webMapView'
          ];
          
          for (const name of globalNames) {
            if (window[name] && window[name].extent) {
              currentMapView = window[name];
              detectionMethod = `global_${name}`;
              console.log(`[HeatMapGenerator] ✅ Map view found via window.${name}`);
              break;
            }
            if (window[name] && window[name].view && window[name].view.extent) {
              currentMapView = window[name].view;
              detectionMethod = `global_${name}.view`;
              console.log(`[HeatMapGenerator] ✅ Map view found via window.${name}.view`);
              break;
            }
          }
          
          if (!currentMapView) {
            const scanDepth = (obj, path = '', depth = 0) => {
              if (depth > 3 || !obj || typeof obj !== 'object') return null;
              
              try {
                if (obj.extent && obj.zoom !== undefined && obj.scale !== undefined && 
                    obj.spatialReference && typeof obj.goTo === 'function') {
                  return obj;
                }
                
                for (const key in obj) {
                  if (key.toLowerCase().includes('map') || key.toLowerCase().includes('view')) {
                    const result = scanDepth(obj[key], `${path}.${key}`, depth + 1);
                    if (result) return result;
                  }
                }
              } catch (e) {
                // Ignore errors during scanning
              }
              
              return null;
            };
            
            currentMapView = scanDepth(window);
            if (currentMapView) {
              detectionMethod = 'deep_scan';
              console.log(`[HeatMapGenerator] ✅ Map view found via deep object scan`);
            }
          }
        } catch (e) {
          console.warn(`[HeatMapGenerator] Global scope detection failed:`, e);
        }
      }
      
      // Strategy 4: Check DOM for ArcGIS map containers
      if (!currentMapView) {
        try {
          const mapContainers = document.querySelectorAll('[data-esri-map], .esri-view, .esri-map-view, #map, .map-container');
          
          for (const container of mapContainers) {
            if (container.__esri_view) {
              currentMapView = container.__esri_view;
              detectionMethod = 'dom_esri_view';
              console.log(`[HeatMapGenerator] ✅ Map view found via DOM __esri_view`);
              break;
            }
            
            const reactKey = Object.keys(container).find(key => key.startsWith('__reactInternalInstance'));
            if (reactKey && container[reactKey]) {
              const reactInstance = container[reactKey];
              if (reactInstance.ref && reactInstance.ref.current && reactInstance.ref.current.extent) {
                currentMapView = reactInstance.ref.current;
                detectionMethod = 'dom_react_ref';
                console.log(`[HeatMapGenerator] ✅ Map view found via DOM React ref`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`[HeatMapGenerator] DOM detection failed:`, e);
        }
      }
    }
    
    // VALIDATION AND LOGGING
    if (currentMapView && currentMapView.extent) {
      console.log(`[HeatMapGenerator] ✅ Map view successfully detected via: ${detectionMethod}`);
      console.log(`[HeatMapGenerator] Current view covers:`, {
        extent: {
          xmin: Math.round(currentMapView.extent.xmin),
          ymin: Math.round(currentMapView.extent.ymin),
          xmax: Math.round(currentMapView.extent.xmax),
          ymax: Math.round(currentMapView.extent.ymax)
        },
        zoom: currentMapView.zoom,
        scale: Math.round(currentMapView.scale),
        spatialReference: currentMapView.spatialReference?.wkid || 'unknown',
        detectionMethod
      });
    } else {
      console.warn(`[HeatMapGenerator] ❌ No map view available - will use broader area statistics with formatting`);
      console.log(`[HeatMapGenerator] Detection methods attempted:`, {
        providedParameter: !!mapView,
        getterFunction: !!(mapViewGetter && typeof mapViewGetter === 'function'),
        reactFiber: 'attempted',
        globalScope: 'attempted',
        domScan: 'attempted'
      });
    }
    
    // Attempt quantile-based data-driven generation with detected map view and formatting
    const dataDrivenBreaks = await generateDataDrivenHeatMapBreaks(
      actualFieldName, 
      selectedAreaType,
      currentMapView
    );
    
    // Enhanced validation with field matching verification
    const isDataDriven = dataDrivenBreaks.some(b => b.dataSource === 'arcgis_query_quantile');
    const hasReasonableRanges = dataDrivenBreaks.some(b => b.maxValue > 100);
    const isSpatiallyOptimized = dataDrivenBreaks.some(b => b.dataStats?.spatiallyFiltered);
    const usedCorrectField = dataDrivenBreaks.length > 0 && 
      dataDrivenBreaks[0].dataStats && 
      (dataDrivenBreaks[0].dataStats.fieldName === actualFieldName || 
      dataDrivenBreaks[0].dataStats.requestedField === actualFieldName);
    const usedSmartRounding = dataDrivenBreaks.some(b => b.dataStats?.usedSmartRounding);
    const hasProperFormatting = dataDrivenBreaks.some(b => b.valueFormat && b.valueFormat !== valueFormats.default);
    
    console.log(`[HeatMapGenerator] Quantile-based data-driven generation result:`, {
      isDataDriven,
      hasReasonableRanges,
      isSpatiallyOptimized,
      usedCorrectField,
      usedSmartRounding,
      hasProperFormatting,
      valueFormat: valueFormat,
      breakCount: dataDrivenBreaks.length,
      fieldRequested: actualFieldName,
      fieldActuallyUsed: dataDrivenBreaks[0]?.dataStats?.fieldName,
      breakType: 'quantile',
      firstBreak: dataDrivenBreaks[0]?.label,
      lastBreak: dataDrivenBreaks[dataDrivenBreaks.length - 1]?.label,
      dataRange: `${dataDrivenBreaks[0]?.minValue} to ${dataDrivenBreaks[dataDrivenBreaks.length - 1]?.maxValue}`,
      optimizationType: isSpatiallyOptimized ? 'Current View + Quantile Distribution + Smart Rounding + Value Formatting' : 'Broad Area + Quantile Distribution + Smart Rounding + Value Formatting',
      mapViewDetection: detectionMethod
    });
    
    // CRITICAL: Alert about field matching issues
    if (!usedCorrectField && dataDrivenBreaks[0]?.dataStats) {
      console.error(`[HeatMapGenerator] 🚨 FIELD MISMATCH DETECTED 🚨`);
      console.error(`[HeatMapGenerator] Requested field: ${actualFieldName}`);
      console.error(`[HeatMapGenerator] Actually used field: ${dataDrivenBreaks[0].dataStats.fieldName}`);
      console.error(`[HeatMapGenerator] This will cause incorrect data visualization!`);
    }
    
    // Get base configuration if available
    const visualizationConfig = getInitialConfigForVisualization ? 
      getInitialConfigForVisualization(selectedVisualization) || {} : 
      {};
    
    // Create final configuration with comprehensive metadata including formatting
    const mapConfiguration = {
      ...visualizationConfig,
      field: actualFieldName,
      visualizationKey: selectedVisualization,
      type: 'class-breaks',
      areaType: areaTypeString,
      classBreakInfos: dataDrivenBreaks,
      hasCustomOpacities: true,
      preserveOpacity: true,
      valueFormat: valueFormat, // Include formatting information
      dataOptimized: isDataDriven && hasReasonableRanges,
      spatiallyOptimized: isSpatiallyOptimized,
      fieldMatchingSuccess: usedCorrectField,
      usedSmartRounding: usedSmartRounding,
      hasProperFormatting: hasProperFormatting,
      breakType: 'quantile',
      optimizationStats: isDataDriven ? dataDrivenBreaks[0]?.dataStats : null,
      regenerationContext: {
        canRegenerateWithMapView: true,
        lastGeneratedAt: new Date().toISOString(),
        usedMapView: !!currentMapView,
        mapViewDetectionMethod: detectionMethod,
        viewZoom: currentMapView?.zoom,
        viewScale: currentMapView?.scale,
        spatiallyFiltered: isSpatiallyOptimized,
        fieldMatchingSuccess: usedCorrectField,
        usedSmartRounding: usedSmartRounding,
        hasProperFormatting: hasProperFormatting,
        valueFormat: valueFormat,
        breakMethod: 'quantile'
      }
    };
    
    console.log(`[HeatMapGenerator] ✅ Successfully created quantile-based heat map configuration with value formatting:`, {
      dataOptimized: mapConfiguration.dataOptimized,
      spatiallyOptimized: mapConfiguration.spatiallyOptimized,
      fieldMatchingSuccess: mapConfiguration.fieldMatchingSuccess,
      usedSmartRounding: mapConfiguration.usedSmartRounding,
      hasProperFormatting: mapConfiguration.hasProperFormatting,
      valueFormat: mapConfiguration.valueFormat,
      usedMapView: mapConfiguration.regenerationContext.usedMapView,
      detectionMethod,
      breakCount: dataDrivenBreaks.length,
      breakType: 'quantile',
      fieldCorrect: usedCorrectField,
      rangesCovered: `${dataDrivenBreaks[0]?.minValue} to ${dataDrivenBreaks[dataDrivenBreaks.length - 1]?.maxValue}`,
      optimizationType: isSpatiallyOptimized ? 'Current View + Quantile Distribution + Smart Rounding + Value Formatting' : 'Broad Area + Quantile Distribution + Smart Rounding + Value Formatting',
      sampleLabels: dataDrivenBreaks.slice(0, 3).map(b => b.label)
    });
    
    return mapConfiguration;
    
  } catch (error) {
    console.error("[HeatMapGenerator] Critical error in createDataDrivenHeatMap:", error);
    
    // Ultimate fallback with realistic ranges and proper formatting
    const fieldName = selectedVisualization.replace(/_HEAT$|_DOT$|_VIZ$|_MAP$/g, '');
    const valueFormat = getValueFormat(fieldName);
    const fallbackBreaks = generateGeneric7LevelBreaks(valueFormat);
    
    return {
      field: fieldName,
      visualizationKey: selectedVisualization,
      type: 'class-breaks',
      areaType: convertAreaTypeToString(selectedAreaType?.value || selectedAreaType || 'tract'),
      classBreakInfos: fallbackBreaks,
      hasCustomOpacities: true,
      preserveOpacity: true,
      valueFormat: valueFormat,
      dataOptimized: false,
      spatiallyOptimized: false,
      fieldMatchingSuccess: false,
      usedSmartRounding: false,
      hasProperFormatting: true, // Fallback still has proper formatting
      breakType: 'fallback',
      optimizationStats: null,
      regenerationContext: {
        canRegenerateWithMapView: true,
        lastGeneratedAt: new Date().toISOString(),
        usedMapView: false,
        fallbackReason: error.message,
        mapViewDetectionMethod: 'failed',
        usedSmartRounding: false,
        hasProperFormatting: true,
        valueFormat: valueFormat,
        breakMethod: 'fallback'
      }
    };
  }
};