// src/components/map/SingleSymbolLegend.jsx
'use client';

import React from 'react';
// *** CORRECTED IMPORT ***
import Color from "@arcgis/core/Color";

// Helper to convert symbol color (hex string or rgba array) to a CSS background style
const getSymbolStyle = (symbolConfig) => {
  if (!symbolConfig || !symbolConfig.color) {
    // Default gray with subtle checkerboard pattern if no color defined
    return {
        backgroundColor: 'rgba(128, 128, 128, 0.5)',
        backgroundImage: 'linear-gradient(45deg, #cccccc 25%, transparent 25%), linear-gradient(-45deg, #cccccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cccccc 75%), linear-gradient(-45deg, transparent 75%, #cccccc 75%)',
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
        border: '1px solid rgba(50, 50, 50, 0.2)',
        borderRadius: '2px'
    };
  }

  try {
    // Use Esri Color class for robust parsing
    const color = new Color(symbolConfig.color);
    const rgbaColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a ?? 0.75})`; // Default alpha if needed

    // Base style with checkerboard background
    let style = {
        backgroundColor: rgbaColor,
        backgroundImage: 'linear-gradient(45deg, #cccccc 25%, transparent 25%), linear-gradient(-45deg, #cccccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cccccc 75%), linear-gradient(-45deg, transparent 75%, #cccccc 75%)',
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
    };

    // Add border if outline exists in config
    if (symbolConfig.outline && symbolConfig.outline.color && symbolConfig.outline.width !== undefined) {
        const outlineColor = new Color(symbolConfig.outline.color);
         const outlineRgba = `rgba(${outlineColor.r}, ${outlineColor.g}, ${outlineColor.b}, ${outlineColor.a ?? 1})`;
        style.border = `${symbolConfig.outline.width}px solid ${outlineRgba}`;
    } else {
         // Add a default subtle border if no outline specified
         style.border = '1px solid rgba(50, 50, 50, 0.2)';
    }

    // Handle symbol style (circle/square) for border-radius
    if (symbolConfig.style === 'circle') {
        style.borderRadius = '50%';
    } else {
        style.borderRadius = '2px'; // Slight rounding for square, cross, etc.
    }

    return style;
  } catch (error) {
      console.error("Error parsing symbol color/outline for legend:", symbolConfig, error);
      // Fallback gray style on error
      return {
          backgroundColor: 'rgba(128, 128, 128, 0.5)',
          backgroundImage: 'linear-gradient(45deg, #cccccc 25%, transparent 25%), linear-gradient(-45deg, #cccccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cccccc 75%), linear-gradient(-45deg, transparent 75%, #cccccc 75%)',
          backgroundSize: '10px 10px',
          backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
          border: '1px solid rgba(50, 50, 50, 0.2)',
          borderRadius: '2px'
      };
  }
};

const SingleSymbolLegend = ({ symbol, label }) => {
  // Don't render if essential info is missing
  if (!symbol || !label) {
    console.warn("SingleSymbolLegend: Missing symbol or label prop.");
    return null;
  }

  const symbolStyle = getSymbolStyle(symbol);

  return (
    <div className="space-y-2">
      {/* Mimic the structure of one break row */}
      <div className="flex items-center space-x-3 py-1">
        {/* Symbol Preview */}
        <div
          className="w-6 h-6 flex-shrink-0" // Adjust size as needed
          style={symbolStyle}
          title={`Symbol Style: ${label}`}
        >
          {/* Empty div uses background/border for styling */}
        </div>

        {/* Label */}
        <div className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate" title={label}>
          {label}
        </div>
      </div>
    </div>
  );
};

export default SingleSymbolLegend;