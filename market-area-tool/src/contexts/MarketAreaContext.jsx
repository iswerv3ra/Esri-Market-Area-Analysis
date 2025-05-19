import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { useMap } from './MapContext';

const MarketAreaContext = createContext();

export const useMarketAreas = () => {
  const context = useContext(MarketAreaContext);
  if (!context) {
    throw new Error('useMarketAreas must be used within a MarketAreaProvider');
  }
  return context;
};

export const MarketAreaProvider = ({ children }) => {
  const [marketAreas, setMarketAreas] = useState([]);
  const [order, setOrder] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMarketArea, setSelectedMarketArea] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const fetchInProgress = useRef(false);
  const initialFetchDone = useRef(false);
  const { clearMarketAreaGraphics } = useMap();

  const fetchMarketAreas = useCallback(async (projectId) => {
    if (!projectId) {
      console.warn('No project ID provided');
      return [];
    }
  
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping');
      return marketAreas;
    }
  
    if (initialFetchDone.current && marketAreas.length > 0) {
      console.log('Initial fetch already done and we have market areas');
      return marketAreas;
    }
  
    fetchInProgress.current = true;
    setIsLoading(true);
     
    try {
      console.log('Fetching market areas for project:', projectId);
      const response = await api.get(`/api/projects/${projectId}/market-areas/`);
      
      // Robust array checking and transformation
      let areas = Array.isArray(response.data) ? response.data : [];
  
      // Enhanced logging to help debug what we're receiving
      console.log('Received market areas:', {
        count: areas.length,
        types: areas.map(a => a.ma_type)
      });
  
      // Enhanced validation and transformation
      const validatedAreas = areas.filter(area => {
        // Validate basic structure
        if (!area || typeof area !== 'object') {
          console.warn('Invalid market area structure:', area);
          return false;
        }
  
        // Special handling for radius market areas
        if (area.ma_type === 'radius') {
          console.log('Processing radius market area:', area.id);
          
          // First check if this is actually a drive time area saved as radius
          if (area.original_type === 'drivetime' || 
              (area.drive_time_points && area.drive_time_points.length > 0) ||
              (area.radius_points && area.radius_points.some(p => p.isDriveTime))) {
            
            console.log(`Detected drive time area saved as radius: ${area.id}`);
            // Restore the original type
            area.ma_type = 'drivetime';
            
            // If we have drive_time_points stored, ensure they're properly formatted
            if (area.drive_time_points && area.drive_time_points.length > 0) {
              console.log(`Using ${area.drive_time_points.length} stored drive time points`);
              
              // Normalize drive time points if needed
              try {
                if (typeof area.drive_time_points === 'string') {
                  area.drive_time_points = JSON.parse(area.drive_time_points);
                }
                
                // Ensure it's an array
                if (!Array.isArray(area.drive_time_points)) {
                  area.drive_time_points = [area.drive_time_points];
                }
                
                // Validate each point
                area.drive_time_points = area.drive_time_points.filter(point => {
                  if (!point || !point.center) return false;
                  if (!point.travelTimeMinutes) {
                    point.travelTimeMinutes = 15; // Default
                  }
                  return true;
                });
                
                // Area is valid if it has at least one drive time point
                return area.drive_time_points.length > 0;
              } catch (e) {
                console.error(`Error processing drive_time_points for market area ${area.id}:`, e);
              }
            }
            // If no valid drive_time_points, try to reconstruct from radius_points
            else if (area.radius_points && area.radius_points.length > 0) {
              console.log(`Reconstructing drive time points from radius points for ${area.id}`);
              
              try {
                if (typeof area.radius_points === 'string') {
                  area.radius_points = JSON.parse(area.radius_points);
                }
                
                if (!Array.isArray(area.radius_points)) {
                  area.radius_points = [area.radius_points];
                }
                
                // Convert radius points to drive time points
                area.drive_time_points = area.radius_points.map(point => ({
                  center: point.center || point.point,
                  travelTimeMinutes: Array.isArray(point.radii) ? point.radii[0] : (point.radius || 15)
                  // Note: driveTimePolygon will be calculated on demand when rendering
                }));
                
                return area.drive_time_points.length > 0;
              } catch (e) {
                console.error(`Error converting radius_points to drive_time_points for ${area.id}:`, e);
              }
            }
          }
          
          // Normal radius area processing
          // Ensure we have radius_points data
          if (!area.radius_points) {
            console.warn(`Radius market area ${area.id} missing radius_points`);
            
            // Check if we need to parse radius data from other fields
            if (area.ma_geometry_data) {
              try {
                const geoData = typeof area.ma_geometry_data === 'string' 
                  ? JSON.parse(area.ma_geometry_data) 
                  : area.ma_geometry_data;
                  
                if (geoData) {
                  // Create radius_points from geometry data
                  area.radius_points = [{
                    center: geoData.center || geoData.point,
                    radii: geoData.radii || [geoData.radius || 5],
                    style: geoData.style
                  }];
                  console.log(`Created radius_points for market area ${area.id} from ma_geometry_data`);
                }
              } catch (e) {
                console.warn(`Error parsing ma_geometry_data for market area ${area.id}:`, e);
              }
            }
            
            // If we still don't have radius points, this is invalid
            if (!area.radius_points) {
              return false;
            }
          }
          
          // Ensure radius_points is properly formatted
          try {
            if (typeof area.radius_points === 'string') {
              area.radius_points = JSON.parse(area.radius_points);
            }
            
            // Normalize to array
            if (!Array.isArray(area.radius_points)) {
              area.radius_points = [area.radius_points];
            }
            
            // Validate each point has necessary info
            area.radius_points = area.radius_points.filter(point => {
              if (!point) return false;
              
              // Ensure we have center coordinates
              if (!point.center && !point.point) {
                console.warn(`Radius point in market area ${area.id} missing center/point`);
                return false;
              }
              
              // Ensure we have radius information
              if (!point.radii && !point.radius) {
                console.log(`Radius point in market area ${area.id} missing radius/radii, using default`);
                point.radii = [5]; // Default 5-mile radius
              } else if (point.radius && !point.radii) {
                // Convert single radius to array format
                point.radii = [point.radius];
              }
              
              return true;
            });
            
            // Market area is valid if it has at least one valid radius point
            return area.radius_points.length > 0;
          } catch (e) {
            console.error(`Error processing radius_points for market area ${area.id}:`, e);
            return false;
          }
        }
        
        // Special handling for drive time market areas
        else if (area.ma_type === 'drivetime') {
          console.log('Processing drive time market area:', area.id);
          
          // First, check drive_time_points property
          if (area.drive_time_points) {
            try {
              // Normalize drive_time_points to proper format
              if (typeof area.drive_time_points === 'string') {
                area.drive_time_points = JSON.parse(area.drive_time_points);
              }
              
              // Convert to array if it's not already
              if (!Array.isArray(area.drive_time_points)) {
                area.drive_time_points = [area.drive_time_points];
              }
              
              // Validate each point has basic requirements
              area.drive_time_points = area.drive_time_points.filter(point => {
                if (!point) return false;
                
                // Ensure center coordinates exist
                if (!point.center) {
                  if (point.longitude !== undefined && point.latitude !== undefined) {
                    point.center = {
                      longitude: point.longitude,
                      latitude: point.latitude
                    };
                  } else if (point.x !== undefined && point.y !== undefined) {
                    point.center = {
                      longitude: point.x,
                      latitude: point.y
                    };
                  } else {
                    console.warn(`Drive time point in ${area.id} missing center coordinates`);
                    return false;
                  }
                }
                
                // Ensure we have travel time minutes
                if (!point.travelTimeMinutes && !point.timeRanges && !point.timeRange) {
                  point.travelTimeMinutes = 15; // Default 15-minute drive time
                } else if (point.timeRanges && !point.travelTimeMinutes) {
                  point.travelTimeMinutes = Array.isArray(point.timeRanges) ? 
                    point.timeRanges[0] : point.timeRanges;
                } else if (point.timeRange && !point.travelTimeMinutes) {
                  point.travelTimeMinutes = point.timeRange;
                }
                
                return true;
              });
              
              // Area is valid if it has at least one drive time point
              return area.drive_time_points.length > 0;
            } catch (e) {
              console.error(`Error processing drive_time_points for ${area.id}:`, e);
            }
          }
          
          // If still not valid, try to extract from geometry if available
          if (area.geometry && area.geometry.rings && area.geometry.rings.length > 0) {
            try {
              // Create a drive time point from the geometry centroid
              const ring = area.geometry.rings[0];
              let sumX = 0, sumY = 0;
              
              for (const point of ring) {
                sumX += point[0];
                sumY += point[1];
              }
              
              area.drive_time_points = [{
                center: {
                  longitude: sumX / ring.length,
                  latitude: sumY / ring.length
                },
                travelTimeMinutes: 15,
                polygon: area.geometry
              }];
              
              console.log(`Created drive time point from geometry for ${area.id}`);
              return true;
            } catch (e) {
              console.error(`Error creating drive time from geometry for ${area.id}:`, e);
            }
          }
          
          console.warn(`Drive time market area ${area.id} has no valid points or geometry`);
          return false;
        }
        
        // Special handling for site_location market areas
        else if (area.ma_type === 'site_location') {
          console.log('Processing site location market area:', area.id);
          
          // Validate site_location_data exists
          if (!area.site_location_data) {
            console.warn(`Site location market area ${area.id} missing site_location_data`);
            return false;
          }
          
          try {
            // Parse if it's a string
            if (typeof area.site_location_data === 'string') {
              area.site_location_data = JSON.parse(area.site_location_data);
            }
            
            // Validate required properties
            if (!area.site_location_data.point || 
                !area.site_location_data.point.latitude || 
                !area.site_location_data.point.longitude) {
              console.warn(`Site location market area ${area.id} missing point coordinates`);
              return false;
            }
            
            // Ensure size exists, or provide default
            if (area.site_location_data.size === undefined) {
              console.log(`Site location market area ${area.id} missing size, using default`);
              area.site_location_data.size = 24; // Default size
            }
            
            // Ensure color exists, or provide default
            if (!area.site_location_data.color) {
              console.log(`Site location market area ${area.id} missing color, using default`);
              area.site_location_data.color = "#FFD700"; // Default yellow color
            }
            
            return true;
          } catch (e) {
            console.error(`Error processing site_location_data for market area ${area.id}:`, e);
            return false;
          }
        }

        // Handle polygon-based market areas
        else if (area.locations && Array.isArray(area.locations)) {
          area.locations = area.locations.filter(loc => {
            // Validate location geometry
            if (!loc.geometry) {
              console.warn(`Market area ${area.id} has location without geometry`);
              return false;
            }
  
            // Add type to geometry if missing
            if (!loc.geometry.type && loc.geometry.rings) {
              loc.geometry.type = "Polygon";
            }
  
            // Additional geometry validation
            if (loc.geometry.type === "Polygon" && 
                (!loc.geometry.rings || loc.geometry.rings.length === 0)) {
              console.warn(`Market area ${area.id} has Polygon geometry without rings`);
              return false;
            }
  
            return true;
          });
  
          // Ensure at least one valid location remains
          if (area.locations.length === 0) {
            console.warn(`Market area ${area.id} has no valid locations`);
            return false;
          }
        } else {
          // No locations and not a radius or drivetime or site_location - invalid
          console.warn(`Market area ${area.id} has no locations and is not a radius, drivetime, or site_location type`);
          return false;
        }
  
        return true;
      });
  
      // Log validation results with site_location included
      console.log('Market Areas Validation:', {
        totalReceived: areas.length,
        validCount: validatedAreas.length,
        byType: {
          radius: validatedAreas.filter(a => a.ma_type === 'radius').length,
          drivetime: validatedAreas.filter(a => a.ma_type === 'drivetime').length,
          site_location: validatedAreas.filter(a => a.ma_type === 'site_location').length,
          other: validatedAreas.filter(a => !['radius', 'drivetime', 'site_location'].includes(a.ma_type)).length
        }
      });
  
      // Sort based on existing order or create new order
      if (order.length > 0) {
        validatedAreas.sort((a, b) => {
          const aIndex = order.indexOf(a.id);
          const bIndex = order.indexOf(b.id);
          return aIndex - bIndex;
        });
      } else {
        setOrder(validatedAreas.map(area => area.id));
      }
  
      // Update state
      setMarketAreas(validatedAreas);
      setError(null);
      initialFetchDone.current = true;
  
      return validatedAreas;
    } catch (err) {
      console.error('Comprehensive error fetching market areas:', {
        error: err,
        projectId,
        errorMessage: err.response?.data?.detail || err.message
      });
  
      // More detailed error handling
      setError({
        message: 'Failed to fetch market areas',
        details: err.response?.data?.detail || err.message
      });
  
      // Reset states
      setMarketAreas([]);
      setOrder([]);
  
      // Rethrow to allow caller to handle
      throw err;
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [order, marketAreas.length]);

  // Add this before resetMarketAreas
  const refreshMarketAreas = useCallback(async (projectId) => {
    initialFetchDone.current = false;
    fetchInProgress.current = false;
    return fetchMarketAreas(projectId);
  }, [fetchMarketAreas]);

  const resetMarketAreas = useCallback(() => {
    setMarketAreas([]);
    setOrder([]);
    setSelectedMarketArea(null);
    setIsEditing(false);
    setError(null);
    fetchInProgress.current = false;
    initialFetchDone.current = false;
    
    localStorage.removeItem('marketAreas');
    localStorage.removeItem('selectedMarketArea');
    localStorage.removeItem('marketAreaOrder');
    
    console.log('[MarketAreaContext] Market areas reset successfully');
  }, []);

  const addMarketArea = useCallback(async (projectId, marketAreaData) => {
    if (!projectId) throw new Error('Project ID is required');
    setIsLoading(true);
    try {
      let newMarketArea;
      
      // Handle site_location type before sending to API
      if (marketAreaData.ma_type === 'site_location') {
        // Ensure site_location_data is properly formatted
        if (!marketAreaData.site_location_data) {
          marketAreaData.site_location_data = {};
        }
        
        // Make sure the point exists
        if (!marketAreaData.site_location_data.point) {
          throw new Error('Site location requires coordinates (point with latitude/longitude)');
        }
        
        // Apply defaults if needed
        if (marketAreaData.site_location_data.size === undefined) {
          marketAreaData.site_location_data.size = 24;
        }
        
        if (!marketAreaData.site_location_data.color) {
          marketAreaData.site_location_data.color = "#FFD700";
        }
        
        // Clear other geometry fields that should be empty for site_location type
        marketAreaData.locations = [];
        marketAreaData.radius_points = [];
        marketAreaData.drive_time_points = [];
      }
  
      if (marketAreaData.id) {
        // Existing market area: update it
        const response = await api.patch(
          `/api/projects/${projectId}/market-areas/${marketAreaData.id}/`,
          marketAreaData
        );
        newMarketArea = response.data;
        
        setMarketAreas(prev => prev.map(ma => ma.id === newMarketArea.id ? newMarketArea : ma));
        // The order array probably doesn't need to change for an update.
  
      } else {
        // New market area: add it
        // Determine the current maximum order among existing market areas
        const maxOrder = marketAreas.length > 0 
          ? Math.max(...marketAreas.map(ma => ma.order)) 
          : 0;
  
        // Assign the new market area an order number higher than the current maximum
        marketAreaData.order = maxOrder + 1;
  
        const response = await api.post(
          `/api/projects/${projectId}/market-areas/`,
          marketAreaData
        );
        newMarketArea = response.data;
  
        // Prepend the new market area to the start of the arrays so it appears at the top
        setMarketAreas(prev => [newMarketArea, ...prev]);
        setOrder(prev => [newMarketArea.id, ...prev]);
      }
  
      setError(null);
      return newMarketArea;
    } catch (err) {
      console.error('Error creating/updating market area:', err);
      if (err.response?.data?.detail) {
        setError(`Server error: ${err.response.data.detail}`);
      } else {
        setError('Failed to create/update market area: ' + (err.response?.data?.message || 'Network error'));
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [marketAreas]);
  
  const updateMarketArea = useCallback(async (projectId, marketAreaId, updateData) => {
    if (!projectId || !marketAreaId) throw new Error('Project ID and Market Area ID are required');
    setIsLoading(true);
    try {
      // Special handling for site_location type updates
      if (updateData.ma_type === 'site_location') {
        // Ensure site_location_data exists
        if (!updateData.site_location_data) {
          updateData.site_location_data = {};
        }
        
        // If changing to site_location type, make sure we have default data
        if (!updateData.site_location_data.point) {
          const existingArea = marketAreas.find(ma => ma.id === marketAreaId);
          
          // Try to initialize from existing geometry if possible
          if (existingArea && existingArea.ma_type === 'radius' && existingArea.radius_points?.[0]?.center) {
            updateData.site_location_data.point = {
              latitude: existingArea.radius_points[0].center.latitude,
              longitude: existingArea.radius_points[0].center.longitude
            };
          } else if (existingArea && existingArea.ma_type === 'drivetime' && existingArea.drive_time_points?.[0]?.center) {
            updateData.site_location_data.point = {
              latitude: existingArea.drive_time_points[0].center.latitude,
              longitude: existingArea.drive_time_points[0].center.longitude
            };
          }
        }
        
        // Apply defaults for size and color if needed
        if (updateData.site_location_data.size === undefined) {
          updateData.site_location_data.size = 24;
        }
        
        if (!updateData.site_location_data.color) {
          updateData.site_location_data.color = "#FFD700";
        }
        
        // Clear other geometry fields
        updateData.locations = [];
        updateData.radius_points = [];
        updateData.drive_time_points = [];
      }
      
      const response = await api.patch(
        `/api/projects/${projectId}/market-areas/${marketAreaId}/`,
        updateData
      );
      const updatedArea = response.data;
      
      setMarketAreas(prev => prev.map(ma => 
        ma.id === marketAreaId ? updatedArea : ma
      ));
      
      setError(null);
      return updatedArea;
    } catch (err) {
      console.error('Error updating market area:', err);
      setError('Failed to update market area');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [marketAreas]);

  const deleteMarketArea = useCallback(async (projectId, marketAreaId) => {
    if (!projectId || !marketAreaId) throw new Error('Project ID and Market Area ID are required');
    setIsLoading(true);
    try {
      // First, ensure all graphics are removed from the map
      if (clearMarketAreaGraphics) {
        clearMarketAreaGraphics(marketAreaId);
      }
      
      // Then delete from the API
      await api.delete(`/api/projects/${projectId}/market-areas/${marketAreaId}/`);
      
      setMarketAreas(prev => prev.filter(ma => ma.id !== marketAreaId));
      setOrder(prev => prev.filter(id => id !== marketAreaId));
      
      if (selectedMarketArea?.id === marketAreaId) {
        setSelectedMarketArea(null);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error deleting market area:', err);
      setError('Failed to delete market area');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [selectedMarketArea, clearMarketAreaGraphics]);

  const reorderMarketAreas = useCallback(async (projectId, newOrder) => {
    if (!projectId) throw new Error('Project ID is required');
    
    const previousMarketAreas = [...marketAreas];
    const previousOrder = [...order];
    
    try {
      const reorderedAreas = [...marketAreas].sort((a, b) => {
        const aIndex = newOrder.indexOf(a.id);
        const bIndex = newOrder.indexOf(b.id);
        return aIndex - bIndex;
      });
      
      setMarketAreas(reorderedAreas);
      setOrder(newOrder);
      setError(null);
  
      setIsLoading(true);
      try {
        await api.put(`/api/projects/${projectId}/market-areas/reorder/`, {
          order: newOrder
        });
      } catch (err) {
        console.error('Error reordering market areas:', err);
        setMarketAreas(previousMarketAreas);
        setOrder(previousOrder);
        setError('Failed to save new order');
        throw err;
      }
    } catch (err) {
      console.error('Error in reorderMarketAreas:', err);
      setMarketAreas(previousMarketAreas);
      setOrder(previousOrder);
      setError('Failed to reorder market areas');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [marketAreas, order]);

  const value = {
    marketAreas: marketAreas || [],
    order,
    isLoading,
    error,
    selectedMarketArea,
    setSelectedMarketArea,
    isEditing,
    setIsEditing,
    fetchMarketAreas,
    refreshMarketAreas,
    addMarketArea,
    updateMarketArea,
    deleteMarketArea,
    reorderMarketAreas,
    resetMarketAreas,
  };

  return (
    <MarketAreaContext.Provider value={value}>
      {children}
    </MarketAreaContext.Provider>
  );
};

export default MarketAreaContext;