import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

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
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/projects/${projectId}/market-areas/`);
      setMarketAreas(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch market areas');
      console.error('Error fetching market areas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMarketArea = useCallback(async (projectId, marketAreaData) => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/market-areas/`,
        marketAreaData
      );
      setMarketAreas(prev => [...prev, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError('Failed to create market area');
      console.error('Error creating market area:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateMarketArea = useCallback(async (projectId, marketAreaId, updateData) => {
    setIsLoading(true);
    try {
      const response = await axios.patch(
        `/api/projects/${projectId}/market-areas/${marketAreaId}/`,
        updateData
      );
      setMarketAreas(prev => 
        prev.map(ma => ma.id === marketAreaId ? response.data : ma)
      );
      setError(null);
      return response.data;
    } catch (err) {
      setError('Failed to update market area');
      console.error('Error updating market area:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteMarketArea = useCallback(async (projectId, marketAreaId) => {
    setIsLoading(true);
    try {
      await axios.delete(`/api/projects/${projectId}/market-areas/${marketAreaId}/`);
      setMarketAreas(prev => prev.filter(ma => ma.id !== marketAreaId));
      setError(null);
    } catch (err) {
      setError('Failed to delete market area');
      console.error('Error deleting market area:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    marketAreas,
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