import React, { useState } from 'react';

const ColorSwatchCell = ({ value, row, isEditing, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  
  // Convert RGB to Hex
  const rgbToHex = (r, g, b) => {
    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Convert Hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const handleColorChange = (e) => {
    const hex = e.target.value;
    const rgb = hexToRgb(hex);
    if (rgb) {
      onChange({
        R: rgb.r,
        G: rgb.g,
        B: rgb.b,
        Hex: hex
      });
    }
  };

  const currentHex = row.Hex || rgbToHex(row.R, row.G, row.B);

  return (
    <div className="flex items-center space-x-2">
      <div 
        className="w-8 h-8 rounded border border-gray-300"
        style={{ backgroundColor: currentHex }}
      />
      {isEditing && (
        <input
          type="color"
          value={currentHex}
          onChange={handleColorChange}
          className="w-8 h-8"
        />
      )}
    </div>
  );
};

export default ColorSwatchCell;