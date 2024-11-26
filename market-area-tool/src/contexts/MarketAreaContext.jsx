import React, { createContext, useContext, useState, useCallback } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMarketAreas = useCallback(async (projectId) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/api/projects/${projectId}/market-areas/`);
      setMarketAreas(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching market areas:', err);
      setError('Failed to fetch market areas');
      setMarketAreas([]); // Ensure it's always an array
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMarketArea = useCallback(async (projectId, marketAreaData) => {
    if (!projectId) throw new Error('Project ID is required');
    setIsLoading(true);
    try {
      const response = await api.post(
        `/api/projects/${projectId}/market-areas/`,
        marketAreaData
      );
      const newMarketArea = response.data;
      setMarketAreas(prev => [...prev, newMarketArea]);
      setError(null);
      return newMarketArea;
    } catch (err) {
      console.error('Error creating market area:', err);
      setError('Failed to create market area');
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
      setError(null);
    } catch (err) {
      console.error('Error deleting market area:', err);
      setError('Failed to delete market area');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    marketAreas: marketAreas || [], // Ensure we always have an array
    isLoading,
    error,
    fetchMarketAreas,
    addMarketArea,
    updateMarketArea,
    deleteMarketArea
  };

  return (
    <MarketAreaContext.Provider value={value}>
      {children}
    </MarketAreaContext.Provider>
  );
};