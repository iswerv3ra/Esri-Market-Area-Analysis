// src/pages/ManagePresetColor.jsx

import React, { useState, useEffect } from 'react';
import EditableTable from "../components/market-areas/EditableTable";
import { tcgThemesAPI, colorKeysAPI, updateColorKey, updateTcgTheme } from '../services/api';

export default function ManagePresetColor() {
  const [tcgThemes, setTcgThemes] = useState([]);
  const [colorKeys, setColorKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Sorts the colorKeys array based on key_number in ascending order.
   * Assumes key_number is a string representing a number (e.g., "1", "2", ..., "24").
   * Adjust the sorting logic if key_number has a different format.
   * 
   * @param {Array} keys - Array of colorKey objects.
   * @returns {Array} - Sorted array of colorKey objects.
   */
  const sortColorKeys = (keys) => {
    return keys.slice().sort((a, b) => {
      const numA = parseInt(a.key_number, 10);
      const numB = parseInt(b.key_number, 10);
      return numA - numB;
    });
  };

  /**
   * Fetches TcgThemes and ColorKeys from the backend on component mount.
   * Sorts the colorKeys to maintain order in the table.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesResponse, colorKeysResponse] = await Promise.all([
          tcgThemesAPI.getAll(),
          colorKeysAPI.getAll(),
        ]);
  
        console.log('Raw themes data:', themesResponse.data);
        console.log('Raw color keys data:', colorKeysResponse.data);
  
        const sortedColorKeys = sortColorKeys(colorKeysResponse.data || []);
        
        // Map the themes with their color keys
        const mappedThemes = (themesResponse.data || []).map(theme => {
          // For debugging
          console.log('Processing theme:', theme.theme_key, {
            fill_color: theme.fill_color,
            color_key: theme.color_key
          });
  
          // First try to get color from fill_color
          let fill_color = theme.fill_color;
          
          // If not available, try to get from color_key
          if (!fill_color && theme.color_key) {
            const colorKey = sortedColorKeys.find(ck => ck.id === theme.color_key);
            fill_color = colorKey?.key_number || '';
          }
  
          // For debugging
          console.log('Mapped fill_color:', fill_color);
  
          return {
            ...theme,
            fill_color,  // This should now have the correct value
            theme_name: theme.theme_name || '',
            fill: theme.fill || 'No',
            transparency: theme.transparency || '-',
            border: theme.border || 'No',
            weight: theme.weight || '-',
            excel_fill: theme.excel_fill || '',
            excel_text: theme.excel_text || ''
          };
        });
  
        console.log('Final mapped themes:', mappedThemes);
        setTcgThemes(mappedThemes);
        setColorKeys(sortedColorKeys);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data. Please try again later.');
        setLoading(false);
      }
    };
  
    fetchData();
  }, []);

  // Define column configurations for TCG Themes
  const tcgThemeColumns = [
    { field: 'theme_key', header: 'Theme Key', type: 'text', isReadOnly: true }, // Make Theme Key non-editable
    { field: 'theme_name', header: 'Theme Name', type: 'text' },
    {
      field: 'fill',
      header: 'Fill?',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    {
      field: 'fill_color',
      header: 'Fill Color (Key #)',
      type: 'select',
      options: colorKeys.map((ck) => ({
        value: ck.key_number,
        label: `${ck.key_number} - ${ck.color_name}`,
      })),
      isReadOnly: false, // Editable to allow changing the fill color
    },
    { field: 'transparency', header: 'Transparency (%)', type: 'text' },
    {
      field: 'border',
      header: 'Border?',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    { field: 'weight', header: 'Weight', type: 'text' },
    { field: 'excel_fill', header: 'Excel Fill', type: 'text' },
    { field: 'excel_text', header: 'Excel Text', type: 'text' },
    // Removed 'color_swatch' column as per requirement
  ];

  // Define column configurations for Color Keys
  const colorKeyColumns = [
    { field: 'key_number', header: 'Key #', type: 'text', isReadOnly: true }, // Make Key # non-editable
    { field: 'color_name', header: 'Color Name', type: 'text' },
    { field: 'R', header: 'R', type: 'number' },
    { field: 'G', header: 'G', type: 'number' },
    { field: 'B', header: 'B', type: 'number' },
    { field: 'Hex', header: 'Hex', type: 'text', isReadOnly: true }, // Make Hex non-editable
    { field: 'color_swatch', header: 'Swatch', type: 'color', isReadOnly: true }, // Make Swatch non-editable
  ];

  /**
   * Handles saving updates to a TcgTheme.
   * Ensures that the associated ColorKey exists and updates the TcgTheme with the correct color_key ID.
   * 
   * @param {Object} updatedTheme - The updated TcgTheme object.
   */
  const handleSaveTcgTheme = async (updatedTheme) => {
    try {
      console.log('Original theme data:', updatedTheme);
    
      // Find associated color key
      const associatedColorKey = colorKeys.find(
        (ck) => ck.key_number === updatedTheme.fill_color
      );
      console.log('Found associated color key:', associatedColorKey);
    
      // Prepare the data for the backend
      const themeData = {
        theme_key: updatedTheme.theme_key,
        theme_name: updatedTheme.theme_name,
        fill: updatedTheme.fill || 'No',
        border: updatedTheme.border || 'No',
        transparency: updatedTheme.transparency || '-',
        weight: updatedTheme.weight || '-',
        excel_fill: updatedTheme.excel_fill || '',
        excel_text: updatedTheme.excel_text || '',
        // Update these two lines:
        color_key_id: associatedColorKey?.id || null,
        fill_color: updatedTheme.fill_color // Keep this as a backup
      };
    
      console.log('Theme data to be sent:', themeData);
      
      const response = await updateTcgTheme(updatedTheme.id, themeData);
      console.log('Save response:', response);
    
      // Update local state with the response data
      setTcgThemes(prevThemes => 
        prevThemes.map(theme => 
          theme.id === updatedTheme.id ? response.data : theme
        )
      );
      
      alert('TCG Theme updated successfully!');
    } catch (err) {
      console.error('Detailed error:', err.response?.data || err);
      alert('Failed to save TCG Theme. Please try again.');
      throw err;
    }
  };

  /**
   * Handles saving updates to a ColorKey.
   * After updating, it re-sorts the colorKeys to maintain order in the table.
   * 
   * @param {Object} updatedColorKey - The updated ColorKey object.
   */
  const handleSaveColorKey = async (updatedColorKey) => {
    try {
      await updateColorKey(updatedColorKey.id, updatedColorKey);
      alert('Color Key updated successfully!');

      // After updating, sort colorKeys again to maintain order
      setColorKeys((prevColorKeys) => {
        const updatedColorKeys = prevColorKeys.map((ck) =>
          ck.id === updatedColorKey.id ? updatedColorKey : ck
        );
        return sortColorKeys(updatedColorKeys);
      });
    } catch (err) {
      console.error('Error updating ColorKey:', err);
      alert('Failed to save Color Key. Please try again.');
      throw err; // Rethrow to prevent local state update
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Manage Preset Colors
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Edit the TCG Themes and Color Keys below. For Color Keys, click edit and select a custom color in the swatch column to update R, G, B, and Hex in real time.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        {/* TCG Themes Table */}
        <EditableTable
          title="TCG Themes"
          data={tcgThemes}
          setData={setTcgThemes}
          columns={tcgThemeColumns}
          onSave={handleSaveTcgTheme}
        />

        {/* Color Keys Table */}
        <EditableTable
          title="Color Keys"
          data={colorKeys}
          setData={setColorKeys}
          columns={colorKeyColumns}
          onSave={handleSaveColorKey}
        />
      </div>
    </div>
  );
}
