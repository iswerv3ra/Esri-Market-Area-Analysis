import React, { useState, useEffect } from 'react';

// Helper function to determine text color based on background brightness
const getBrightness = (color) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
};

// Helper function to interpolate colors
const interpolateColor = (color1, color2, factor) => {
  const hex = (x) => {
    const h = Math.round(x).toString(16);
    return h.length === 1 ? '0' + h : h;
  };

  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = r1 + factor * (r2 - r1);
  const g = g1 + factor * (g2 - g1);
  const b = b1 + factor * (b2 - b1);

  return `#${hex(r)}${hex(g)}${hex(b)}`;
};

// Default color palette
const DEFAULT_COLORS = [
  '#6a51a3', '#9e9ac8', '#cbc9e2', 
  '#fef0d9', '#fdcc8a', '#fc8d59', 
  '#e34a33', '#b30000'
];

const MapConfigBuilder = ({ 
  initialConfig, 
  mapType, 
  onUpdateConfig 
}) => {
  // Normalize initial configuration
  const normalizeInitialConfig = (config) => {
    // Handle class-breaks renderer
    if (config?.type === "class-breaks" && config.classBreakInfos?.length) {
      return config.classBreakInfos.map(info => ({
        minValue: info.minValue ?? -10,
        maxValue: info.maxValue ?? 10,
        color: info.symbol?.color ?? '#cccccc',
        label: info.label ?? `${info.minValue ?? -10} to ${info.maxValue ?? 10}`
      }));
    }
    
    // Handle dot-density renderer
    if (config?.type === "dot-density" && config.attributes?.length) {
      return [{
        minValue: -10,
        maxValue: 10,
        color: config.attributes[0].color ?? '#3288bd',
        label: config.attributes[0].label ?? 'Population'
      }];
    }
    
    // Default fallback for empty or unrecognized config
    return [{
      minValue: -10,
      maxValue: 10,
      color: '#3288bd',
      label: 'Default Layer'
    }];
  };

  // Initialize steps
  const [steps, setSteps] = useState(() => normalizeInitialConfig(initialConfig));

  // Initialize global parameters
  const [globalMin, setGlobalMin] = useState(() => 
    steps[0]?.minValue ?? -10
  );
  const [globalMax, setGlobalMax] = useState(() => 
    steps[steps.length - 1]?.maxValue ?? 10
  );
  const [stepSize, setStepSize] = useState(() => 
    steps.length > 1 
      ? steps[1].minValue - steps[0].minValue 
      : 0.25
  );

  // Generate steps based on global parameters
  const generateSteps = () => {
    const newSteps = [];
    let currentValue = globalMin;
    
    while (currentValue < globalMax) {
      const nextValue = Math.min(currentValue + stepSize, globalMax);
      newSteps.push({
        minValue: currentValue,
        maxValue: nextValue,
        color: '#cccccc',
        label: `${currentValue.toFixed(2)} to ${nextValue.toFixed(2)}`
      });
      currentValue = nextValue;
    }

    // Assign colors from the gradient
    const numSteps = newSteps.length;
    newSteps.forEach((step, index) => {
      // Calculate which segment of the default colors we're in
      const factor = index / (numSteps - 1);
      const colorIndex = factor * (DEFAULT_COLORS.length - 1);
      const colorLower = DEFAULT_COLORS[Math.floor(colorIndex)];
      const colorUpper = DEFAULT_COLORS[Math.min(Math.ceil(colorIndex), DEFAULT_COLORS.length - 1)];
      const colorFactor = colorIndex - Math.floor(colorIndex);
      
      // Interpolate between the two closest default colors
      step.color = interpolateColor(colorLower, colorUpper, colorFactor);
    });
    
    setSteps(newSteps);
  };

  // Update color of a specific step
  const updateStepColor = (index, color) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], color };
    setSteps(newSteps);
  };

  // Save configuration
  const saveConfiguration = () => {
    // Prepare configuration based on map type
    let config;
    if (mapType === 'population') {
      // For population, it's a dot-density renderer
      config = {
        type: "dot-density",
        attributes: [{
          field: "DPOPDENSCY",
          color: steps[Math.floor(steps.length / 2)].color,
          label: "Population"
        }]
      };
    } else {
      // For growth and income, it's a class-breaks renderer
      config = {
        type: "class-breaks",
        field: mapType === 'growth' ? "HHGRW20CY" : "MEDHINC_CY",
        classBreakInfos: steps.map(step => ({
          minValue: step.minValue,
          maxValue: step.maxValue,
          symbol: {
            type: "simple-fill",
            color: step.color,
            outline: {
              color: [50, 50, 50, 0.2],
              width: "0.5px"
            }
          },
          label: step.label
        }))
      };
    }

    // Call the parent component's update function
    onUpdateConfig(config);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">
        Customize {
          mapType === 'population' ? 'Population' : 
          mapType === 'growth' ? 'Household Growth' : 
          'Median Income'
        } Layer
      </h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Global Min
          </label>
          <input
            type="number"
            value={globalMin}
            onChange={(e) => setGlobalMin(Number(e.target.value))}
            className="w-full p-2 border rounded"
            step="0.1"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Global Max
          </label>
          <input
            type="number"
            value={globalMax}
            onChange={(e) => setGlobalMax(Number(e.target.value))}
            className="w-full p-2 border rounded"
            step="0.1"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Step Size
          </label>
          <input
            type="number"
            value={stepSize}
            onChange={(e) => setStepSize(Number(e.target.value))}
            className="w-full p-2 border rounded"
            step="0.05"
            min="0.05"
          />
        </div>
      </div>
      
      <div className="flex space-x-4 mb-6">
        <button
          onClick={generateSteps}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Generate Steps
        </button>
        
        <button
          onClick={saveConfiguration}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Apply Configuration
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Color Steps</h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center space-x-4 bg-gray-50 p-2 rounded">
              <span className="w-40 font-medium">
                {step.minValue.toFixed(2)} to {step.maxValue.toFixed(2)}
              </span>
              <input
                type="color"
                value={step.color}
                onChange={(e) => updateStepColor(index, e.target.value)}
                className="w-20 h-8"
              />
              <div 
                className="w-8 h-8 border border-gray-300"
                style={{ backgroundColor: step.color }}
              ></div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Preview</h3>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="w-24 h-24 rounded flex items-center justify-center text-xs text-center p-1"
              style={{ 
                backgroundColor: step.color,
                color: getBrightness(step.color) > 128 ? 'black' : 'white'
              }}
            >
              {step.minValue.toFixed(2)} to {step.maxValue.toFixed(2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapConfigBuilder;