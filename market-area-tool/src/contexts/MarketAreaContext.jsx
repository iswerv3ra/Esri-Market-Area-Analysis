// src/contexts/MarketAreaContext.jsx
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
  const fetchInProgress = useRef(false);
  const initialFetchDone = useRef(false);

  const fetchMarketAreas = useCallback(async (projectId) => {
    if (!projectId) return;
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }

    // If we've already done the initial fetch, only proceed if explicitly requested
    if (initialFetchDone.current && marketAreas.length > 0) {
      console.log('Initial fetch already done and we have market areas');
      return marketAreas;
    }

    fetchInProgress.current = true;
    setIsLoading(true);
    
    try {
      console.log('Fetching market areas for project:', projectId);
      const response = await api.get(`/api/projects/${projectId}/market-areas/`);
      const areas = Array.isArray(response.data) ? response.data : [];
      
      // If we have an order, use it to sort the areas
      if (order.length > 0) {
        areas.sort((a, b) => {
          const aIndex = order.indexOf(a.id);
          const bIndex = order.indexOf(b.id);
          return aIndex - bIndex;
        });
      } else {
        // If no order exists, establish initial order from areas
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
  }, [order]);

  const addMarketArea = useCallback(async (projectId, marketAreaData) => {
    if (!projectId) throw new Error('Project ID is required');
    setIsLoading(true);
    try {
      console.log('Sending market area data:', JSON.stringify(marketAreaData, null, 2));
      const response = await api.post(
        `/api/projects/${projectId}/market-areas/`,
        marketAreaData
      );
      const newMarketArea = response.data;
      
      setMarketAreas(prev => [...prev, newMarketArea]);
      // Add new market area to the end of the order
      setOrder(prev => [...prev, newMarketArea.id]);
      
      setError(null);
      return newMarketArea;
    } catch (err) {
      console.error('Error creating market area:', err);
      if (err.response) {
        console.error('Server response:', err.response);
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
        if (err.response.data.detail) {
          setError(`Server error: ${err.response.data.detail}`);
        } else {
          setError('Failed to create market area: ' + (err.response.data.message || 'Unknown error'));
        }
      } else {
        setError('Failed to create market area: Network error');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      // Remove the deleted market area from the order
      setOrder(prev => prev.filter(id => id !== marketAreaId));
      
      setError(null);
    } catch (err) {
      console.error('Error deleting market area:', err);
      setError('Failed to delete market area');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reorderMarketAreas = useCallback(async (projectId, newOrder) => {
    if (!projectId) throw new Error('Project ID is required');
    
    // Store the previous state in case we need to rollback
    const previousMarketAreas = [...marketAreas];
    const previousOrder = [...order];
    
    try {
      // Optimistically update the UI
      const reorderedAreas = [...marketAreas].sort((a, b) => {
        const aIndex = newOrder.indexOf(a.id);
        const bIndex = newOrder.indexOf(b.id);
        return aIndex - bIndex;
      });
      
      setMarketAreas(reorderedAreas);
      setOrder(newOrder);
      setError(null);
  
      // Try to sync with the backend
      setIsLoading(true);
      try {
        await api.put(`/api/projects/${projectId}/market-areas/reorder/`, {
          order: newOrder
        });
      } catch (err) {
        console.error('Error reordering market areas:', err);
        // If backend fails, revert to previous state
        setMarketAreas(previousMarketAreas);
        setOrder(previousOrder);
        setError('Failed to save new order');
        throw err;
      }
    } catch (err) {
      console.error('Error in reorderMarketAreas:', err);
      // Revert to previous state if anything fails
      setMarketAreas(previousMarketAreas);
      setOrder(previousOrder);
      setError('Failed to reorder market areas');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [marketAreas, order]);

  // Force refresh market areas (used when needed)
  const refreshMarketAreas = useCallback(async (projectId) => {
    initialFetchDone.current = false; // Reset the initial fetch flag
    fetchInProgress.current = false;   // Reset the fetch in progress flag
    return fetchMarketAreas(projectId);
  }, [fetchMarketAreas]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = {
    marketAreas: marketAreas || [], // Ensure we always have an array
    order,
    isLoading,
    error,
    fetchMarketAreas,
    refreshMarketAreas,
    addMarketArea,
    updateMarketArea,
    deleteMarketArea,
    reorderMarketAreas
  };

  return (
    <MarketAreaContext.Provider value={value}>
      {children}
    </MarketAreaContext.Provider>
  );
};

export default MarketAreaContext;