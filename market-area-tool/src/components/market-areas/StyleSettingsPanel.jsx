import React, { useState, useRef, useEffect } from 'react';
import ThemeSelector from './ThemeSelector';
import CondensedThemeSelector from './CondensedThemeSelector';

export const StyleSettingsPanel = ({
  styleSettings,
  onStyleChange,
  currentTheme = 'Default',
}) => {
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);
  const [currentThemeName, setCurrentThemeName] = useState(currentTheme);

  // State for condensed color modal (for fill, border, excel fill, excel text)
  const [isColorOnlySelectorOpen, setIsColorOnlySelectorOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState(null);

  const panelRef = useRef(null);

  // Handle the **full theme** application
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

  /**
   * When user clicks any color swatch, open the condensed color selector.
   * This only changes the color, ignoring other theme properties.
   */
  const handleColorSwatchClick = (e, targetKey) => {
    e.preventDefault();
    // If "No Fill"/"No Border" is active, skip
    if (
      (targetKey === 'fill' && styleSettings.noFill) ||
      (targetKey === 'border' && styleSettings.noBorder)
    ) {
      return;
    }
    setColorTarget(targetKey);
    setIsColorOnlySelectorOpen(true);
  };

  /**
   * Called by CondensedThemeSelector once a color has been picked.
   * We only set the relevant color property here.
   */
  const handleColorOnlySelect = (colorHex) => {
    switch (colorTarget) {
      case 'fill':
        onStyleChange('fillColor', colorHex);
        break;
      case 'border':
        onStyleChange('borderColor', colorHex);
        break;
      case 'excelFill':
        onStyleChange('excelFill', colorHex);
        break;
      case 'excelText':
        onStyleChange('excelText', colorHex);
        break;
      default:
        break;
    }
    setIsColorOnlySelectorOpen(false);
  };

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg shadow-md w-full max-w-md relative"
      ref={panelRef}
    >
      <div className="p-6 space-y-6">
        {/* Header with Theme Selection */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
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
          <span className="text-sm text-gray-800 dark:text-gray-300">
            {currentThemeName}
          </span>
        </div>

        {/* Color Settings Grid */}
        <div className="grid grid-cols-2 gap-8">
          {/* Fill Color Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Fill Color</span>
              <button
                type="button"
                onClick={(e) => handleColorSwatchClick(e, 'fill')}
                className="w-12 h-6 rounded border border-gray-300 dark:border-gray-600 
                           hover:border-blue-500 focus:outline-none"
                style={{
                  backgroundColor: styleSettings.fillColor,
                  opacity: styleSettings.noFill ? 0.5 : 1,
                }}
                disabled={styleSettings.noFill}
                aria-label="Select Fill Color"
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
              <button
                type="button"
                onClick={(e) => handleColorSwatchClick(e, 'border')}
                className="w-12 h-6 rounded border border-gray-300 dark:border-gray-600 
                           hover:border-blue-500 focus:outline-none"
                style={{
                  backgroundColor: styleSettings.borderColor,
                  opacity: styleSettings.noBorder ? 0.5 : 1,
                }}
                disabled={styleSettings.noBorder}
                aria-label="Select Border Color"
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
      value={Math.round((1 - styleSettings.fillOpacity) * 100)} // Inverted calculation
      onChange={(e) => {
        // Allow empty input for deletion
        if (e.target.value === '') {
          onStyleChange('fillOpacity', 1); // Default to fully opaque when empty
          return;
        }
        
        const transparencyValue = parseFloat(e.target.value);
        if (!isNaN(transparencyValue)) {
          // Convert transparency to opacity (inverted)
          const opacity = 1 - (Math.max(0, Math.min(100, transparencyValue)) / 100);
          onStyleChange('fillOpacity', opacity);
        }
      }}
      disabled={styleSettings.noFill}
      className="w-16 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 
                 dark:border-gray-700 rounded text-gray-800 dark:text-gray-300"
      min="0"
      max="100"
    />
  </div>
  <div className="flex justify-between items-center">
    <span className="text-sm text-gray-600 dark:text-gray-400">Border Weight</span>
    <input
      type="number"
      value={styleSettings.borderWidth}
      onChange={(e) => {
        // Allow empty input for deletion
        if (e.target.value === '') {
          onStyleChange('borderWidth', 0);
          return;
        }
        
        const value = parseFloat(e.target.value);
        if (!isNaN(value)) {
          onStyleChange('borderWidth', Math.max(0, Math.min(10, value)));
        }
      }}
      disabled={styleSettings.noBorder}
      className="w-16 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 
                 dark:border-gray-700 rounded text-gray-800 dark:text-gray-300"
      min="0"
      max="10"
    />
  </div>
</div>

        {/* Excel Settings */}
        <div className="grid grid-cols-2 gap-8">
          {/* Excel Fill */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Excel Fill</span>
              <button
                type="button"
                onClick={(e) => handleColorSwatchClick(e, 'excelFill')}
                className="w-12 h-6 rounded border border-gray-300 dark:border-gray-600 
                           hover:border-blue-500 focus:outline-none"
                style={{
                  backgroundColor: styleSettings.excelFill,
                }}
                aria-label="Select Excel Fill Color"
              />
            </div>
          </div>

          {/* Excel Text */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Excel Text</span>
              <button
                type="button"
                onClick={(e) => handleColorSwatchClick(e, 'excelText')}
                className="w-12 h-6 rounded border border-gray-300 dark:border-gray-600 
                           hover:border-blue-500 focus:outline-none"
                style={{
                  backgroundColor: styleSettings.excelText,
                }}
                aria-label="Select Excel Text Color"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full Theme Selector Modal */}
      <ThemeSelector
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
        onThemeSelect={handleThemeSelect}
      />

      <CondensedThemeSelector
        isOpen={isColorOnlySelectorOpen}
        onClose={() => setIsColorOnlySelectorOpen(false)}
        onColorOnlySelect={(hex) => {
          // e.g. set fillColor, borderColor, or excelFill, etc.
          if (colorTarget === 'fill') {
            onStyleChange('fillColor', hex);
          } else if (colorTarget === 'border') {
            onStyleChange('borderColor', hex);
          } else if (colorTarget === 'excelFill') {
            onStyleChange('excelFill', hex);
          } else if (colorTarget === 'excelText') {
            onStyleChange('excelText', hex);
          }
        }}
      />  
    </div>
  );
};

export default StyleSettingsPanel;
