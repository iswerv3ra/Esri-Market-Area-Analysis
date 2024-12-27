// src/contexts/PresetsContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tcgThemesAPI, colorKeysAPI, variablePresetsAPI } from '../services/api';
import { isAuthenticated } from '../utils/auth';

// Create context with initial values
const PresetsContext = createContext({
  tcgThemes: [],
  variablePresets: [],
  loading: false,
  error: null,
  refreshPresets: () => {},
  createTcgTheme: async () => {},
  updateTcgTheme: async () => {},
  deleteTcgTheme: async () => {},
  makeTcgThemeGlobal: async () => {},

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
  const [tcgThemes, setTcgThemes] = useState([]);
  const [variablePresets, setVariablePresets] = useState([]);
  const [colorKeys, setColorKeys] = useState([]); // Added to manage ColorKeys
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchPresets = async () => {
    // If not authenticated, redirect to login
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch TCG Themes, Color Keys, and Variable Presets in parallel
      const [themesResponse, colorKeysResponse, variableResponse] = await Promise.all([
        tcgThemesAPI.getAll(),
        colorKeysAPI.getAll(),
        variablePresetsAPI.getAll(),
      ]);

      // themesResponse.data / colorKeysResponse.data / variableResponse.data holds the arrays from your API
      setTcgThemes(themesResponse.data || []);
      setColorKeys(colorKeysResponse.data || []);
      setVariablePresets(variableResponse.data || []);
    } catch (error) {
      console.error('Error fetching TCG Themes / Variable Presets:', error);
      setError(error);

      // Handle "No refresh token" or 401 logic
      if (error.message === 'No refresh token available' || error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // TCG Themes operations
  const createTcgTheme = async (themeData) => {
    try {
      setLoading(true);
      const response = await tcgThemesAPI.create(themeData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error creating TCG Theme:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTcgTheme = async (id, themeData) => {
    try {
      setLoading(true);
      const response = await tcgThemesAPI.update(id, themeData);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error updating TCG Theme:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTcgTheme = async (id) => {
    try {
      setLoading(true);
      await tcgThemesAPI.delete(id);
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting TCG Theme:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // If you have an endpoint for making a TCG Theme global:
  const makeTcgThemeGlobal = async (id) => {
    try {
      setLoading(true);
      // In your API file, if you have something like:
      //   tcgThemesAPI.makeGlobal(id)
      // you can call it here. Otherwise, remove this method.
      const response = await tcgThemesAPI.makeGlobal(id);
      await fetchPresets();
      return response.data;
    } catch (error) {
      console.error('Error making TCG Theme global:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Variable Preset operations
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

  // Load TCG Themes & Variable Presets on mount
  useEffect(() => {
    fetchPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    // TCG Themes
    tcgThemes,
    createTcgTheme,
    updateTcgTheme,
    deleteTcgTheme,
    makeTcgThemeGlobal,

    // Variable Presets
    variablePresets,
    createVariablePreset,
    updateVariablePreset,
    deleteVariablePreset,
    makeVariablePresetGlobal,

    // Color Keys
    colorKeys,

    // Common
    loading,
    error,
    refreshPresets: fetchPresets,
  };

  return (
    <PresetsContext.Provider value={value}>
      {children}
    </PresetsContext.Provider>
  );
};

export default PresetsContext;
