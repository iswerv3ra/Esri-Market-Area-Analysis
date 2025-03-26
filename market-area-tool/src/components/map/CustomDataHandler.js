// CustomDataHandler.js
import { createClassBreaks, createCustomLayerConfig, createUniqueValueConfig, createDotDensityConfig, isValidLatitude, isValidLongitude } from './utils';

/**
 * Process and handle custom map data to create appropriate visualization
 * 
 * @param {Object} mapData - The map data configuration from the dialog
 * @returns {Object} A configuration object ready for visualization
 */
export const processCustomMapData = (mapData) => {
  if (!mapData || !mapData.customData || !mapData.nameColumn) {
    console.error("Invalid map data for processing", mapData);
    return null;
  }
  
  // Enhanced logging to debug the issue
  console.log("========== PROCESSING CUSTOM MAP DATA ==========");
  console.log("Map data details:", {
    mapDataKeys: Object.keys(mapData),
    nameColumn: mapData.nameColumn,
    valueColumn: mapData.valueColumn,
    latitudeColumn: mapData.latitudeColumn,
    longitudeColumn: mapData.longitudeColumn,
    dataRowCount: mapData.customData?.length,
    firstDataItem: mapData.customData?.[0] ? Object.keys(mapData.customData[0]) : []
  });
  
  const { customData, nameColumn, valueColumn, type } = mapData;
  
  // Get latitude and longitude columns
  let latitudeColumn = mapData.latitudeColumn;
  let longitudeColumn = mapData.longitudeColumn;
  
  // If columns weren't passed properly, try to detect them
  if (!latitudeColumn || !longitudeColumn) {
    console.log("Coordinate columns missing, attempting auto-detection");
    const firstRow = customData?.[0] || {};
    const columnNames = Object.keys(firstRow);
    
    // Try to detect latitude column with more column name variations
    if (!latitudeColumn) {
      const possibleLatColumns = ['Latitude', 'latitude', 'lat', 'LAT', 'y', 'Y', 'Lat', 'lat_y', 'LAT_Y'];
      latitudeColumn = possibleLatColumns.find(col => columnNames.includes(col)) || 
                       columnNames.find(col => col.toLowerCase().includes('lat'));
      console.log(`Auto-detected latitude column: ${latitudeColumn}`);
    }
    
    // Try to detect longitude column with more column name variations
    if (!longitudeColumn) {
      const possibleLngColumns = ['Longitude', 'longitude', 'lng', 'long', 'LONG', 'LON', 'lon', 'x', 'X', 'Lng', 'Long', 'lng_x', 'LON_X'];
      longitudeColumn = possibleLngColumns.find(col => columnNames.includes(col)) || 
                        columnNames.find(col => 
                          col.toLowerCase().includes('lon') || 
                          col.toLowerCase().includes('lng')
                        );
      console.log(`Auto-detected longitude column: ${longitudeColumn}`);
    }
  }
  
  // Check coordinate values too - in some datasets lat and long might be reversed
  if (latitudeColumn && longitudeColumn && customData.length > 0) {
    const sampleLat = Number(customData[0][latitudeColumn]);
    const sampleLng = Number(customData[0][longitudeColumn]);
    
    // If latitude appears to be a longitude value (outside normal range)
    if (!isValidLatitude(sampleLat) && isValidLongitude(sampleLat) && 
        !isValidLongitude(sampleLng) && isValidLatitude(sampleLng)) {
      console.log("Latitude/longitude columns might be swapped - fixing automatically");
      // Swap the columns
      [latitudeColumn, longitudeColumn] = [longitudeColumn, latitudeColumn];
      console.log(`Swapped columns - Now using Latitude=${latitudeColumn}, Longitude=${longitudeColumn}`);
    }
  }
  
  // Final check that we have coordinate columns
  if (!latitudeColumn || !longitudeColumn) {
    console.error("Could not determine latitude/longitude columns", {
      provided: { 
        latColumn: mapData.latitudeColumn, 
        longColumn: mapData.longitudeColumn 
      },
      autoDetected: {
        latColumn: latitudeColumn,
        longColumn: longitudeColumn
      },
      availableColumns: customData?.[0] ? Object.keys(customData[0]) : []
    });
    return null;
  }
  
  console.log(`Using coordinate columns: Latitude=${latitudeColumn}, Longitude=${longitudeColumn}`);
  
  // Process the data to ensure points have proper geometry
  const processedData = customData.map((item, index) => {
    // Try to convert coordinates to numbers
    const lat = Number(item[latitudeColumn]);
    const lng = Number(item[longitudeColumn]);
    
    // Log some items for debugging
    if (index < 5 || index % 100 === 0) {
      console.log(`Data item ${index} coordinates:`, { 
        name: item[nameColumn],
        value: item[valueColumn],
        lat, 
        lng,
        rawLat: item[latitudeColumn],
        rawLng: item[longitudeColumn]
      });
    }
    
    // Skip invalid coordinates
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      console.warn(`Invalid coordinates at index ${index}:`, { 
        lat, 
        lng, 
        item: item[nameColumn] 
      });
      return null;
    }
    
    return {
      ...item,
      // Add explicit point geometry that mapping libraries need
      geometry: {
        type: "point",
        x: lng,  // longitude is x
        y: lat,  // latitude is y
        spatialReference: { wkid: 4326 } // WGS84 coordinate system
      }
    };
  }).filter(Boolean); // Remove any null entries (invalid coordinates)
  
  console.log(`Processed ${processedData.length} valid data points out of ${customData.length} rows`);
  
  if (processedData.length === 0) {
    console.error("No valid data points to display. Please check your coordinate columns.");
    return null;
  }
  
  // Define default color scheme for visualization
  const defaultColorScheme = [
    [65, 105, 225, 0.9],  // Royal Blue with higher opacity
    [0, 191, 255, 0.9],   // Deep Sky Blue
    [0, 128, 128, 0.9],   // Teal
    [0, 128, 0, 0.9],     // Green
    [128, 0, 0, 0.9],     // Maroon
    [75, 0, 130, 0.9]     // Indigo
  ];
  
  // Choose the appropriate visualization based on data and type
  switch (type) {
    case 'heatmap':
      return createCustomLayerConfig(processedData, nameColumn, valueColumn, defaultColorScheme);
    case 'dotdensity':
      return createDotDensityConfig(processedData, nameColumn, valueColumn);
    case 'custom':
    default:
      // For custom visualization, choose between unique value or class breaks based on data
      const uniqueNames = new Set(processedData.map(item => item[nameColumn])).size;
      
      if (uniqueNames <= 10) {
        // If few unique values, use unique value renderer (different color per category)
        return createUniqueValueConfig(processedData, nameColumn, valueColumn);
      } else {
        // Otherwise use class breaks for numeric values
        return createCustomLayerConfig(processedData, nameColumn, valueColumn, defaultColorScheme);
      }
  }
};