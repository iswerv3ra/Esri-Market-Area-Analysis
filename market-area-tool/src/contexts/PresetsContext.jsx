// src/contexts/PresetsContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stylePresetsAPI, variablePresetsAPI } from '../services/api';
import { isAuthenticated } from '../utils/auth';

// Create context with initial values
const PresetsContext = createContext({
  stylePresets: [],
  variablePresets: [],
  loading: false,
  error: null,
  refreshPresets: () => {},
  createStylePreset: async () => {},
  updateStylePreset: async () => {},
  deleteStylePreset: async () => {},
  makeStylePresetGlobal: async () => {},
  createVariablePreset: async () => {},
  updateVariablePreset: async () => {},
  deleteVariablePreset: async () => {},
  makeVariablePresetGlobal: async () => {},
});

// Custom hook to use the presets context
export const usePresets = () => {
  const context = useContext(PresetsContext);
  if (!context) {
    throw new Error('usePresets must be used within a PresetsProvider');
  }
  return context;
};

// Provider component
export const PresetsProvider = ({ children }) => {
  const [stylePresets, setStylePresets] = useState([]);
  const [variablePresets, setVariablePresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchPresets = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [styleResponse, variableResponse] = await Promise.all([
        stylePresetsAPI.getAll(),
        variablePresetsAPI.getAll()
      ]);

      setStylePresets(styleResponse.data || []);
      setVariablePresets(variableResponse.data || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
      setError(error);
      
      if (error.message === 'No refresh token available' || error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Style preset operations
  const createStylePreset = async (presetData) => {
    try {
      setLoading(true);
      const response = await stylePresetsAPI.create(presetData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error creating style preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateStylePreset = async (id, presetData) => {
    try {
      setLoading(true);
      const response = await stylePresetsAPI.update(id, presetData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error updating style preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteStylePreset = async (id) => {
    try {
      setLoading(true);
      await stylePresetsAPI.delete(id);
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting style preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const makeStylePresetGlobal = async (id) => {
    try {
      setLoading(true);
      const response = await stylePresetsAPI.makeGlobal(id);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error making style preset global:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Variable preset operations
  const createVariablePreset = async (presetData) => {
    try {
      setLoading(true);
      const response = await variablePresetsAPI.create(presetData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error creating variable preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateVariablePreset = async (id, presetData) => {
    try {
      setLoading(true);
      const response = await variablePresetsAPI.update(id, presetData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error updating variable preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteVariablePreset = async (id) => {
    try {
      setLoading(true);
      await variablePresetsAPI.delete(id);
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting variable preset:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const makeVariablePresetGlobal = async (id) => {
    try {
      setLoading(true);
      const response = await variablePresetsAPI.makeGlobal(id);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error making variable preset global:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const value = {
    stylePresets,
    variablePresets,
    loading,
    error,
    refreshPresets: fetchPresets,
    createStylePreset,
    updateStylePreset,
    deleteStylePreset,
    makeStylePresetGlobal,
    createVariablePreset,
    updateVariablePreset,
    deleteVariablePreset,
    makeVariablePresetGlobal,
  };

  return (
    <PresetsContext.Provider value={value}>
      {children}
    </PresetsContext.Provider>
  );
};

export default PresetsContext;