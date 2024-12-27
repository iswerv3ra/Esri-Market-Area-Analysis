import React, { useState } from 'react';
import ThemeSelector from './ThemeSelector';

export const StyleSettingsPanel = ({
  styleSettings,
  onStyleChange,
  currentTheme = 'Default',
}) => {
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);
  const [currentThemeName, setCurrentThemeName] = useState(currentTheme);

  const handleThemeSelect = (newSettings) => {
    console.log('StyleSettingsPanel received new settings:', newSettings);

    onStyleChange('fillColor', newSettings.fillColor);
    onStyleChange('fillOpacity', newSettings.fillOpacity);
    onStyleChange('borderColor', newSettings.borderColor);
    onStyleChange('borderWidth', newSettings.borderWidth);
    onStyleChange('excelFill', newSettings.excelFill);
    onStyleChange('excelText', newSettings.excelText);
    onStyleChange('noFill', newSettings.noFill);
    onStyleChange('noBorder', newSettings.noBorder);

    if (newSettings.themeName) {
      setCurrentThemeName(newSettings.themeName);
    }
    setIsThemeSelectorOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md w-full max-w-md">
      <div className="p-6 space-y-6">
        {/* Header with Theme Selection */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Style Settings
          </h3>
          <button
            type="button"
            onClick={() => setIsThemeSelectorOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 
                     rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 
                     focus:ring-offset-2 focus:ring-green-500 dark:ring-offset-gray-900"
          >
            Select Theme
          </button>
        </div>

        {/* Current Theme */}
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Current Theme</span>
          <span className="text-sm text-gray-800 dark:text-gray-300">{currentThemeName}</span>
        </div>

        {/* Color Settings Grid */}
        <div className="grid grid-cols-2 gap-8">
          {/* Fill Color Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Fill Color</span>
              <input
                type="color"
                value={styleSettings.fillColor.startsWith('rgb') ? 
                  rgbToHex(styleSettings.fillColor) : 
                  styleSettings.fillColor}
                onChange={(e) => onStyleChange('fillColor', e.target.value)}
                disabled={styleSettings.noFill}
                className="w-12 h-6 rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-start">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={styleSettings.noFill}
                  onChange={(e) => onStyleChange('noFill', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">No Fill</span>
              </label>
            </div>
          </div>

          {/* Border Color Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Border Color</span>
              <input
                type="color"
                value={styleSettings.borderColor.startsWith('rgb') ? 
                  rgbToHex(styleSettings.borderColor) : 
                  styleSettings.borderColor}
                onChange={(e) => onStyleChange('borderColor', e.target.value)}
                disabled={styleSettings.noBorder}
                className="w-12 h-6 rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-start">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={styleSettings.noBorder}
                  onChange={(e) => onStyleChange('noBorder', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">No Border</span>
              </label>
            </div>
          </div>
        </div>

        {/* Transparency and Weight */}
        <div className="grid grid-cols-2 gap-8">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Transparency</span>
            <input
              type="number"
              value={Math.round(styleSettings.fillOpacity * 100)}
              onChange={(e) => onStyleChange('fillOpacity', Math.max(0, Math.min(1, e.target.value / 100)))}
              disabled={styleSettings.noFill}
              className="w-16 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-800 dark:text-gray-300"
              min="0"
              max="100"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Border Weight</span>
            <input
              type="number"
              value={styleSettings.borderWidth}
              onChange={(e) => onStyleChange('borderWidth', parseInt(e.target.value))}
              disabled={styleSettings.noBorder}
              className="w-16 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-800 dark:text-gray-300"
              min="0"
              max="10"
            />
          </div>
        </div>

        {/* Excel Settings */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Excel Fill</span>
            <input
              type="color"
              value={styleSettings.excelFill.startsWith('#') ? 
                styleSettings.excelFill : '#ffffff'}
              onChange={(e) => onStyleChange('excelFill', e.target.value)}
              className="w-12 h-6 rounded cursor-pointer"
            />
          </div>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Excel Text</span>
            <input
              type="color"
              value={styleSettings.excelText.startsWith('#') ? 
                styleSettings.excelText : '#000000'}
              onChange={(e) => onStyleChange('excelText', e.target.value)}
              className="w-12 h-6 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <ThemeSelector
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
        onThemeSelect={handleThemeSelect}
      />
    </div>
  );
};

// Helper function to convert RGB to Hex
function rgbToHex(rgb) {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (match) {
    const [_, r, g, b] = match;
    return '#' + 
      ('0' + parseInt(r).toString(16)).slice(-2) +
      ('0' + parseInt(g).toString(16)).slice(-2) +
      ('0' + parseInt(b).toString(16)).slice(-2);
  }
  return rgb;
}

export default StyleSettingsPanel;