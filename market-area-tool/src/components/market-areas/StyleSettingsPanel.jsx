import React, { useState } from 'react';
import ThemeSelector from './ThemeSelector';

export const StyleSettingsPanel = ({ styleSettings, onStyleChange }) => {
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  const handleThemeSelect = (newSettings) => {
    console.log('StyleSettingsPanel received new settings:', newSettings);
  
      onStyleChange("fillColor", newSettings.fillColor);
      onStyleChange("fillOpacity", newSettings.fillOpacity);
      onStyleChange("borderColor", newSettings.borderColor);
      onStyleChange("borderWidth", newSettings.borderWidth);
      onStyleChange("excelFill", newSettings.excelFill);
      onStyleChange("excelText", newSettings.excelText);
      onStyleChange("noFill", newSettings.noFill);
      onStyleChange("noBorder", newSettings.noBorder);
    
    setIsThemeSelectorOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Style Settings
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsThemeSelectorOpen(true);
          }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                   rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 
                   focus:ring-offset-2 focus:ring-green-500 dark:bg-gray-800 dark:text-gray-200 
                   dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Select Theme
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Fill Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styleSettings.fillColor.startsWith('rgb') ? 
                    rgbToHex(styleSettings.fillColor) : 
                    styleSettings.fillColor}
                  onChange={(e) => onStyleChange('fillColor', e.target.value)}
                  disabled={styleSettings.noFill}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={styleSettings.noFill}
                    onChange={(e) => onStyleChange('noFill', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">No Fill</span>
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Border Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styleSettings.borderColor.startsWith('rgb') ? 
                    rgbToHex(styleSettings.borderColor) : 
                    styleSettings.borderColor}
                  onChange={(e) => onStyleChange('borderColor', e.target.value)}
                  disabled={styleSettings.noBorder}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={styleSettings.noBorder}
                    onChange={(e) => onStyleChange('noBorder', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">No Border</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Transparency</label>
              <input
                type="number"
                value={Math.round(styleSettings.fillOpacity * 100)}
                onChange={(e) => onStyleChange('fillOpacity', Math.max(0, Math.min(1, e.target.value / 100)))}
                disabled={styleSettings.noFill}
                className="
                  w-20 px-2 py-1 border rounded
                  bg-white text-black     /* normal mode */
                  dark:bg-gray-600 dark:text-white  /* dark mode */
                "
                min="0"
                max="100"
              />
            </div>

            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Weight</label>
              <input
                type="number"
                value={styleSettings.borderWidth}
                onChange={(e) => onStyleChange('borderWidth', parseInt(e.target.value))}
                disabled={styleSettings.noBorder}
                className="
                  w-20 px-2 py-1 border rounded
                  bg-white text-black
                  dark:bg-gray-600 dark:text-white
                "
                min="0"
                max="10"
              />
            </div>

            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Excel Fill</label>
              <input
                type="color"
                value={styleSettings.excelFill.startsWith('#') ? 
                  styleSettings.excelFill : '#ffffff'}
                onChange={(e) => onStyleChange('excelFill', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600 dark:text-gray-400">Excel Text</label>
              <input
                type="color"
                value={styleSettings.excelText.startsWith('#') ? 
                  styleSettings.excelText : '#000000'}
                onChange={(e) => onStyleChange('excelText', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
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
  // Handle rgb(r, g, b) format
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (match) {
    const [_, r, g, b] = match;
    return '#' + 
      ('0' + parseInt(r).toString(16)).slice(-2) +
      ('0' + parseInt(g).toString(16)).slice(-2) +
      ('0' + parseInt(b).toString(16)).slice(-2);
  }
  return rgb; // Return as is if not RGB format
}

export default StyleSettingsPanel;