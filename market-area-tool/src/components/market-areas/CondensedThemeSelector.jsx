import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-hot-toast";
import { tcgThemesAPI } from "../../services/api"; // Use real API

//
// 1) THEME DATA CACHING
//
// We'll store the grouped themes in a static variable so it's fetched once.
// Subsequent openings of CondensedThemeSelector won't hit the API again.
let themeCache = null;

// We skip storing these in "recent" if user picks them
const STANDARD_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
];

// Keep track of up to 10 recently used colors
function addToRecentColors(color, prevColors) {
  const idx = prevColors.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  // If color is already in the list, move it to the front
  if (idx >= 0) {
    const updated = [...prevColors];
    updated.splice(idx, 1);
    updated.unshift(color);
    return updated.slice(0, 10);
  }
  // Otherwise, just prepend
  return [color, ...prevColors].slice(0, 10);
}

// Determine category for a theme (same logic as your ThemeSelector)
function getCategory(themeName) {
  const submarketMatch = themeName.match(/Submarket\s+(\d+)/i);
  if (themeName.includes("Subject MSA") || !themeName.match(/Submarket|MSA/i)) {
    return "Core Study";
  } else if (submarketMatch) {
    const num = parseInt(submarketMatch[1], 10);
    return num <= 11 ? "Submarkets 1-11" : "Submarkets 12-16";
  } else if (themeName.includes("MSA")) {
    return "Additional MSAs";
  }
  return "Other";
}

// Categories in your desired order
const categoryOrder = [
  "Core Study",
  "Submarkets 1-11",
  "Submarkets 12-16",
  "Additional MSAs",
  "Other",
];

//
// 2) COLOR CONVERSION UTILS (HSB <-> RGB <-> HEX)
//
function hsbToRgb(h, s, v) {
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let [r, g, b] = [0, 0, 0];

  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh >= 1 && hh < 2) [r, g, b] = [x, c, 0];
  else if (hh >= 2 && hh < 3) [r, g, b] = [0, c, x];
  else if (hh >= 3 && hh < 4) [r, g, b] = [0, x, c];
  else if (hh >= 4 && hh < 5) [r, g, b] = [x, 0, c];
  else if (hh >= 5 && hh <= 6) [r, g, b] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(r, g, b) {
  const rr = r.toString(16).padStart(2, "0");
  const gg = g.toString(16).padStart(2, "0");
  const bb = b.toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`.toUpperCase();
}

function hexToRgb(hex) {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  } else if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.substring(0, 2), 16),
      g: parseInt(cleaned.substring(2, 4), 16),
      b: parseInt(cleaned.substring(4, 6), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

function rgbToHsb(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const cmax = Math.max(rr, gg, bb);
  const cmin = Math.min(rr, gg, bb);
  const delta = cmax - cmin;

  let h = 0;
  if (delta !== 0) {
    if (cmax === rr) {
      h = 60 * (((gg - bb) / delta) % 6);
    } else if (cmax === gg) {
      h = 60 * ((bb - rr) / delta + 2);
    } else {
      h = 60 * ((rr - gg) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = cmax === 0 ? 0 : delta / cmax;
  const v = cmax;

  return { h, s, v };
}

//
// 3) HUE SLIDER (THIN SPECTRUM)
//
function HueStrip({ hue, onChange, width = 300, height = 16 }) {
  const canvasRef = useRef(null);

  // Redraw whenever size or hue changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const imageData = ctx.createImageData(width, height);

    // We'll do a left-to-right hue from 0..360
    for (let x = 0; x < width; x++) {
      const curHue = (360 * x) / (width - 1);
      const { r, g, b } = hsbToRgb(curHue, 1, 1); // full sat, full val
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        imageData.data[idx + 0] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw small marker line for the current hue
    const markerX = Math.round((hue / 360) * (width - 1));
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(markerX, 0);
    ctx.lineTo(markerX, height);
    ctx.stroke();
  }, [hue, width, height]);

  const handlePointer = (evt) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(evt.clientX - rect.left, width - 1));
    const newHue = (x / (width - 1)) * 360;
    onChange(newHue);
  };

  const handleMouseDown = (evt) => {
    handlePointer(evt);
    const move = (e) => handlePointer(e);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ cursor: "crosshair", userSelect: "none" }}
      onMouseDown={handleMouseDown}
    />
  );
}

//
// 4) SATURATION-BRIGHTNESS SQUARE
//
function SaturationBrightnessSquare({
  hue,
  saturation,
  brightness,
  onChange,
  size = 200,
}) {
  const canvasRef = useRef(null);

  // Redraw the square whenever hue or size changes
  // S = x from 0..1, B = y from 1..0
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const imageData = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const b = 1 - y / (size - 1);
      for (let x = 0; x < size; x++) {
        const s = x / (size - 1);
        const { r, g, b: rb } = hsbToRgb(hue, s, b);
        const idx = (y * size + x) * 4;
        imageData.data[idx + 0] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = rb;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw the marker for current S/B
    const xPos = Math.round(saturation * (size - 1));
    const yPos = Math.round((1 - brightness) * (size - 1));
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xPos, yPos, 5, 0, 2 * Math.PI);
    ctx.stroke();
  }, [hue, saturation, brightness, size]);

  const handlePointer = (evt) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(evt.clientX - rect.left, size - 1));
    const y = Math.max(0, Math.min(evt.clientY - rect.top, size - 1));

    const newS = x / (size - 1);
    const newB = 1 - y / (size - 1);
    onChange({ s: newS, v: newB });
  };

  const handleMouseDown = (evt) => {
    handlePointer(evt);
    const move = (e) => handlePointer(e);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ cursor: "crosshair", userSelect: "none" }}
      onMouseDown={handleMouseDown}
    />
  );
}

//
// 5) MAIN CondensedThemeSelector
//
const CondensedThemeSelector = ({
  isOpen,
  onClose,
  onColorOnlySelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [themes, setThemes] = useState({});

  // "recently used" custom colors
  const [recentColors, setRecentColors] = useState([]);

  // Show/hide the advanced color section
  const [showMoreColors, setShowMoreColors] = useState(false);

  // HSB state for advanced picking
  const [hsb, setHsb] = useState({ h: 0, s: 0, v: 1 }); // default to #FFFFFF

  // Convert to RGB => Hex for user display
  const { r, g, b } = hsbToRgb(hsb.h, hsb.s, hsb.v);
  const advancedHex = rgbToHex(r, g, b);

  // Fields for R/G/B + Hex
  const [rgbFields, setRgbFields] = useState({ r, g, b });
  const [hexField, setHexField] = useState(advancedHex);

  // Keep fields in sync with HSB changes
  useEffect(() => {
    const { r, g, b } = hsbToRgb(hsb.h, hsb.s, hsb.v);
    setRgbFields({ r, g, b });
    setHexField(rgbToHex(r, g, b));
  }, [hsb]);

  // If user changes R/G/B
  const handleRgbChange = (chan, val) => {
    const n = Math.max(0, Math.min(parseInt(val, 10) || 0, 255));
    const updated = { ...rgbFields, [chan]: n };
    setRgbFields(updated);
    const hex = rgbToHex(updated.r, updated.g, updated.b);
    setHexField(hex);
    const newHSB = rgbToHsb(updated.r, updated.g, updated.b);
    setHsb(newHSB);
  };

  // If user changes Hex
  const handleHexChange = (val) => {
    setHexField(val);
    const { r, g, b } = hexToRgb(val);
    setRgbFields({ r, g, b });
    setHsb(rgbToHsb(r, g, b));
  };

  // If user picks from Hue strip
  const handleHueChange = (newHue) => {
    setHsb((old) => ({ ...old, h: newHue }));
  };

  // If user picks from Sat/Bri square
  const handleSBChange = ({ s, v }) => {
    setHsb((old) => ({ ...old, s, v }));
  };

  // Confirm advanced color
  const confirmAdvancedColor = () => {
    handleColorClick(advancedHex, "Advanced");
  };

  // Common color click
  const handleColorClick = (color, label = "") => {
    const isStandard = STANDARD_COLORS.some((std) => std.toLowerCase() === color.toLowerCase());
    if (!isStandard) {
      setRecentColors((prev) => addToRecentColors(color, prev));
    }
    onColorOnlySelect(color);
    onClose();
    toast.success(label ? `Color applied from ${label}` : `Color applied: ${color}`);
  };

  // Toggle advanced panel
  const toggleMoreColors = () => {
    setShowMoreColors((prev) => !prev);
  };

  // Load/cached themes
  useEffect(() => {
    if (!isOpen) return;
    // If we already have themeCache, use it instantly
    if (themeCache) {
      setThemes(themeCache);
      setLoading(false);
      return;
    }

    // Otherwise fetch from the API
    setLoading(true);
    setError(null);

    async function loadThemes() {
      try {
        const resp = await tcgThemesAPI.getAll();
        const data = resp.data;
        // Group them
        const grouped = data.reduce((acc, theme) => {
          const cat = getCategory(theme.theme_name);
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(theme);
          return acc;
        }, {});

        // Sort each category
        Object.keys(grouped).forEach((cat) => {
          grouped[cat].sort((a, b) => {
            const aNum = parseInt(a.theme_name.match(/\d+/)?.[0] || "0", 10);
            const bNum = parseInt(b.theme_name.match(/\d+/)?.[0] || "0", 10);
            return aNum - bNum;
          });
        });

        themeCache = grouped; // store in static var
        setThemes(grouped);
        setLoading(false);
      } catch (err) {
        console.error("Error loading themes:", err);
        setError("Failed to load themes");
        setLoading(false);
      }
    }

    loadThemes();
  }, [isOpen]);

  if (!isOpen) return null;

  // Prevent clicks inside the modal from closing it
  const handleDialogClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col p-6"
        onClick={handleDialogClick}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select a Color
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* MAIN CONTENT */}
        {loading ? (
          <div className="text-gray-500 dark:text-gray-300">Loading colors...</div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="overflow-auto flex-1">
            {/* THEMES BY CATEGORY */}
            {categoryOrder.map((cat) => {
              const catThemes = themes[cat];
              if (!catThemes || catThemes.length === 0) return null;
              return (
                <div key={cat} className="mb-6">
                  <div className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-200">
                    {cat}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {catThemes.map((theme) => {
                      // Each theme has a color_key with a Hex
                      const hexColor = theme.color_key?.Hex || "#0078D4";
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 hover:opacity-75"
                          style={{ backgroundColor: hexColor }}
                          title={`${theme.theme_name} (${hexColor})`}
                          onClick={() => handleColorClick(hexColor, theme.theme_name)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* RECENTLY USED */}
            {recentColors.length > 0 && (
              <div className="mb-6">
                <div className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-200">
                  Recently Used
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 hover:opacity-75"
                      style={{ backgroundColor: color }}
                      title={`Recent: ${color}`}
                      onClick={() => handleColorClick(color, "Recent")}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* MORE COLORS (HUE STRIP + S/B SQUARE) */}
            <button
              type="button"
              className="text-blue-600 dark:text-blue-400 hover:underline mb-6"
              onClick={(e) => {
                e.stopPropagation();
                toggleMoreColors();
              }}
            >
              More Colors
            </button>

            {showMoreColors && (
              <div className="border border-gray-200 dark:border-gray-700 p-4 rounded">
                <div className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-200">
                  Pick a Custom Color
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  {/* LEFT: Big S/B Square + Thin Hue Strip */}
                  <div className="flex flex-col items-center gap-2">
                    <SaturationBrightnessSquare
                      hue={hsb.h}
                      saturation={hsb.s}
                      brightness={hsb.v}
                      onChange={handleSBChange}
                      size={200}
                    />
                    <HueStrip
                      hue={hsb.h}
                      onChange={handleHueChange}
                      width={200}
                      height={16} 
                    />
                  </div>

                  {/* RIGHT: Manual R/G/B/Hex fields */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Hex:
                      <input
                        type="text"
                        className="ml-2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded w-24"
                        value={hexField}
                        onChange={(e) => handleHexChange(e.target.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        R:
                        <input
                          type="number"
                          min={0}
                          max={255}
                          className="ml-1 w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                          value={rgbFields.r}
                          onChange={(e) => handleRgbChange("r", e.target.value)}
                        />
                      </label>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        G:
                        <input
                          type="number"
                          min={0}
                          max={255}
                          className="ml-1 w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                          value={rgbFields.g}
                          onChange={(e) => handleRgbChange("g", e.target.value)}
                        />
                      </label>
                      <label className="text-sm text-gray-600 dark:text-gray-400">
                        B:
                        <input
                          type="number"
                          min={0}
                          max={255}
                          className="ml-1 w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                          value={rgbFields.b}
                          onChange={(e) => handleRgbChange("b", e.target.value)}
                        />
                      </label>
                    </div>

                    {/* Preview + Confirm Buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded"
                        style={{ backgroundColor: advancedHex }}
                        title={`Preview: ${advancedHex}`}
                      />
                      <button
                        type="button"
                        className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 focus:outline-none"
                        onClick={confirmAdvancedColor}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMoreColors();
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CondensedThemeSelector;
