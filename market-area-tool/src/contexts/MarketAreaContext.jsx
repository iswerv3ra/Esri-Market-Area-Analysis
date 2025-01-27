import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../services/api';

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
  
      // Enhanced validation and transformation
      const validatedAreas = areas.filter(area => {
        // Validate basic structure
        if (!area || typeof area !== 'object') {
          console.warn('Invalid market area structure:', area);
          return false;
        }
  
        // Check and transform locations
        if (area.locations && Array.isArray(area.locations)) {
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
          // Handle radius market areas or other types
          if (area.ma_type === 'radius' && (!area.radius_points || area.radius_points.length === 0)) {
            console.warn(`Radius market area ${area.id} missing radius points`);
            return false;
          }
        }
  
        return true;
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
  
      // Log validation results
      console.log('Market Areas Validation:', {
        totalReceived: areas.length,
        validCount: validatedAreas.length
      });
  
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
  }, []);

  const deleteMarketArea = useCallback(async (projectId, marketAreaId) => {
    if (!projectId || !marketAreaId) throw new Error('Project ID and Market Area ID are required');
    setIsLoading(true);
    try {
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
  }, [selectedMarketArea]);

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