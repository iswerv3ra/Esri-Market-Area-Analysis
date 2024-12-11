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
    if (!projectId) return;
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping');
      return;
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
      let areas = Array.isArray(response.data) ? response.data : [];
  
      // Add the type property to geometry objects if they exist
      areas = areas.map(area => {
        if (area.locations && area.locations.length > 0) {
          area.locations = area.locations.map(loc => {
            if (loc.geometry && !loc.geometry.type && loc.geometry.rings) {
              loc.geometry.type = "polygon";
            }
            return loc;
          });
        }
  
        // If you have radius_points, check and set type as needed
        // if (area.radius_points && area.radius_points.length > 0) {
        //   // Here you would set type for point geometries if needed
        // }
  
        return area;
      });
  
      if (order.length > 0) {
        areas.sort((a, b) => {
          const aIndex = order.indexOf(a.id);
          const bIndex = order.indexOf(b.id);
          return aIndex - bIndex;
        });
      } else {
        setOrder(areas.map(area => area.id));
      }
  
      setMarketAreas(areas);
      setError(null);
      initialFetchDone.current = true;
      return areas;
    } catch (err) {
      console.error('Error fetching market areas:', err);
      setError('Failed to fetch market areas');
      setMarketAreas([]); 
      setOrder([]);
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