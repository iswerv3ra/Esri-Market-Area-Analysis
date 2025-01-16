import React, { useEffect, useRef, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Legend from '@arcgis/core/widgets/Legend';

const API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

// Default color palettes and step configurations
const DEFAULT_COLOR_PALETTES = {
  population: {
    type: "dot-density",
    attributes: [{
      field: "DPOPDENSCY",
      color: "#3288bd",
      label: "Population"
    }]
  },
  growth: {
    type: "class-breaks",
    field: "HHGRW20CY",
    classBreakInfos: [
      {
        minValue: -10,
        maxValue: -3,
        color: "#9e9ac8",
        label: "Less than -3%"
      },
      {
        minValue: -3,
        maxValue: -2,
        color: "#cde0c4",
        label: "-3% to -2%"
      },
      {
        minValue: -2,
        maxValue: -1,
        color: "#fff7bc",
        label: "-2% to -1%"
      },
      {
        minValue: -1,
        maxValue: 0,
        color: "#fdd49e",
        label: "-1% to 0%"
      },
      {
        minValue: 0,
        maxValue: 1,
        color: "#fc8d59",
        label: "0% to 1%"
      },
      {
        minValue: 1,
        maxValue: 10,
        color: "#d7301f",
        label: "More than 1%"
      }
    ]
  },
  income: {
    type: "class-breaks",
    field: "MEDHINC_CY",
    classBreakInfos: [
      {
        minValue: 0,
        maxValue: 50000,
        color: "#9e9ac8",
        label: "$50K or Less"
      },
      {
        minValue: 50000,
        maxValue: 75000,
        color: "#cde0c4",
        label: "$50K - $75K"
      },
      {
        minValue: 75000,
        maxValue: 100000,
        color: "#fff7bc",
        label: "$75K - $100K"
      },
      {
        minValue: 100000,
        maxValue: 125000,
        color: "#fdd49e",
        label: "$100K - $125K"
      },
      {
        minValue: 125000,
        maxValue: 150000,
        color: "#fc8d59",
        label: "$125K - $150K"
      },
      {
        minValue: 150000,
        maxValue: 500000,
        color: "#d7301f",
        label: "$150K or More"
      }
    ]
  }
};

const MapConfigBuilder = ({ initialConfig, mapType, onUpdateConfig }) => {
  const [steps, setSteps] = useState([]);

  // Effect to update steps when initialConfig changes
  useEffect(() => {
    // Handle class-breaks renderer
    if (initialConfig.type === "class-breaks" && initialConfig.classBreakInfos) {
      const newSteps = initialConfig.classBreakInfos.map(info => ({
        minValue: info.minValue,
        maxValue: info.maxValue,
        // Use color directly if available, or from symbol if exists
        color: (info.color || (info.symbol && info.symbol.color) || '#cccccc'),
        label: info.label
      }));
      setSteps(newSteps);
    }
    
    // Handle dot-density renderer
    else if (initialConfig.type === "dot-density" && initialConfig.attributes) {
      setSteps([{
        minValue: -10,
        maxValue: 10,
        color: (initialConfig.attributes[0].color || '#3288bd'),
        label: initialConfig.attributes[0].label || 'Population'
      }]);
    }
    
    // Fallback to default configuration
    else {
      setSteps([{
        minValue: -10,
        maxValue: 10,
        color: '#3288bd',
        label: 'Default Layer'
      }]);
    }
  }, [initialConfig]);

  // Initialize state with current steps
  const [globalMin, setGlobalMin] = useState(-10);
  const [globalMax, setGlobalMax] = useState(10);
  const [stepSize, setStepSize] = useState(0.25);

  // Update global parameters when steps change
  useEffect(() => {
    if (steps.length > 0) {
      setGlobalMin(steps[0].minValue);
      setGlobalMax(steps[steps.length - 1].maxValue);
      
      if (steps.length > 1) {
        setStepSize(steps[1].minValue - steps[0].minValue);
      }
    }
  }, [steps]);

  // Default color palette
  const defaultColors = [
    '#6a51a3', '#9e9ac8', '#cbc9e2', 
    '#fef0d9', '#fdcc8a', '#fc8d59', 
    '#e34a33', '#b30000'
  ];

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

  // Helper function to determine text color based on background brightness
  const getBrightness = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return ((r * 299) + (g * 587) + (b * 114)) / 1000;
  };

  const generateSteps = () => {
    const newSteps = [];
    let currentValue = globalMin;
    
    while (currentValue < globalMax) {
      const nextValue = Math.min(currentValue + stepSize, globalMax);
      newSteps.push({
        minValue: currentValue,
        maxValue: nextValue,
        color: '#cccccc',
        label: `${currentValue.toFixed(2)}% to ${nextValue.toFixed(2)}%`
      });
      currentValue = nextValue;
    }

    // Assign colors from the gradient
    const numSteps = newSteps.length;
    newSteps.forEach((step, index) => {
      // Calculate which segment of the default colors we're in
      const factor = index / (numSteps - 1);
      const colorIndex = factor * (defaultColors.length - 1);
      const colorLower = defaultColors[Math.floor(colorIndex)];
      const colorUpper = defaultColors[Math.min(Math.ceil(colorIndex), defaultColors.length - 1)];
      const colorFactor = colorIndex - Math.floor(colorIndex);
      
      // Interpolate between the two closest default colors
      step.color = interpolateColor(colorLower, colorUpper, colorFactor);
    });
    
    setSteps(newSteps);
  };

  const updateStepColor = (index, color) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], color };
    setSteps(newSteps);
  };

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
        Customize {mapType === 'population' ? 'Population' : 
                   mapType === 'growth' ? 'Household Growth' : 
                   'Median Income'} Layer
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
                {step.minValue.toFixed(2)}% to {step.maxValue.toFixed(2)}%
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
              {step.minValue.toFixed(2)}% to {step.maxValue.toFixed(2)}%
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// SwitchableMap Component
const SwitchableMap = () => {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const [mapType, setMapType] = useState('population');
  const [layerConfigurations, setLayerConfigurations] = useState(DEFAULT_COLOR_PALETTES);
  const [showConfigBuilder, setShowConfigBuilder] = useState(false);

  const createLayers = () => {
    const createRenderer = (config) => {
      if (config.type === "dot-density") {
        return {
          type: "dot-density",
          dotValue: 100,
          outline: null,
          referenceScale: 577790,
          dotBlendingEnabled: true,
          legendOptions: {
            unit: "people per square mile"
          },
          attributes: config.attributes
        };
      }
  
      if (config.type === "class-breaks") {
        return {
          type: "class-breaks",
          field: config.field,
          classBreakInfos: config.classBreakInfos.map(breakInfo => ({
            minValue: breakInfo.minValue,
            maxValue: breakInfo.maxValue,
            symbol: {
              type: "simple-fill",
              color: breakInfo.color,
              outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
            },
            label: breakInfo.label
          }))
        };
      }
    };
  
    return {
      population: new FeatureLayer({
        url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
        renderer: createRenderer(layerConfigurations[mapType]),
        popupTemplate: {
          title: "Census Tract {NAME}",
          content: [{
            type: "fields",
            fieldInfos: [{
              fieldName: "DPOPDENSCY",
              label: "Daytime Population Density (2024)",
              format: {
                digitSeparator: true,
                places: 0
              }
            }]
          }]
        },
        title: "Daytime Population Density (2024)",
        minScale: 300000
      }),
      growth: new FeatureLayer({
        url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
        renderer: createRenderer(layerConfigurations[mapType]),
        popupTemplate: {
          title: "Census Tract {NAME}",
          content: [{
            type: "fields",
            fieldInfos: [{
              fieldName: "HHGRW20CY",
              label: "Household Growth Rate (2020-2024)",
              format: {
                digitSeparator: true,
                places: 2
              }
            }]
          }]
        },
        title: "Household Growth Rate (2020-2024)",
        minScale: 300000
      }),
      income: new FeatureLayer({
        url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
        renderer: createRenderer(layerConfigurations[mapType]),
        popupTemplate: {
          title: "Census Tract {NAME}",
          content: [{
            type: "fields",
            fieldInfos: [{
              fieldName: "MEDHINC_CY",
              label: "Median Household Income (2024)",
              format: {
                digitSeparator: true,
                places: 0,
                type: "currency"
              }
            }]
          }]
        },
        title: "Median Household Income (2024)",
        minScale: 300000
      })
    };
  };

  useEffect(() => {
    esriConfig.apiKey = API_KEY;
    
    const initializeMap = async () => {
      try {
        // Get layers
        const layers = createLayers();

        // Create the map with initial layer
        const map = new Map({
          basemap: "arcgis-topographic"
        });

        // Create the view
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-117.83, 33.7175],
          zoom: 12,
          constraints: {
            minZoom: 2,
            maxZoom: 15
          },
          popup: {
            dockEnabled: true,
            dockOptions: {
              position: "auto",
              breakpoint: false
            }
          }
        });

        viewRef.current = view;

        // Wait for view to load
        await view.when();

        // Add initial layer
        map.layers.add(layers.population);

        // Add legend
        const legend = new Legend({
          view: view,
          style: "classic"
        });
        
        view.ui.add(legend, "bottom-left");

        // Style the legend
        const styleLegend = () => {
          const legendContainer = document.querySelector(".esri-legend");
          if (legendContainer) {
            legendContainer.style.backgroundColor = "white";
            legendContainer.style.border = "1px solid black";
            legendContainer.style.padding = "10px";
            legendContainer.style.margin = "10px";
            
            const legendItems = legendContainer.querySelectorAll(".esri-legend__layer-cell--info");
            legendItems.forEach(item => {
              item.style.fontSize = "16px";
              item.style.fontWeight = "900";
              item.style.color = "#000000";
            });

            const swatches = legendContainer.querySelectorAll(".esri-legend__symbol");
            swatches.forEach(swatch => {
              swatch.style.width = "30px";
              swatch.style.height = "30px";
              swatch.style.margin = "5px";
            });
          }
        };

        setTimeout(styleLegend, 100);

        // Switch layers based on mapType
        const switchLayer = () => {
          // Preserve current view state
          const { center, zoom } = view;

          // Remove existing layers
          map.layers.removeAll();
          
          // Add the selected layer
          let selectedLayer;
          switch(mapType) {
            case 'population':
              selectedLayer = layers.population;
              break;
            case 'growth':
              selectedLayer = layers.growth;
              break;
            case 'income':
              selectedLayer = layers.income;
              break;
            default:
              selectedLayer = layers.population;
          }

          // Add the new layer
          map.layers.add(selectedLayer);

          // Restore view state
          view.center = center;
          view.zoom = zoom;
        };

        // Initial layer switch
        switchLayer();

        return () => {
          // Cleanup function
          view.destroy();
        };

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, [mapType, layerConfigurations]);

  // Update layer configuration
  const updateLayerConfiguration = (mapType, newConfig) => {
    setLayerConfigurations(prev => ({
      ...prev,
      [mapType]: newConfig
    }));
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        <select 
          value={mapType}
          onChange={(e) => setMapType(e.target.value)}
          className="bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <option value="population">Population Density</option>
          <option value="growth">Household Growth</option>
          <option value="income">Median Income</option>
        </select>
        
        <button 
          onClick={() => setShowConfigBuilder(!showConfigBuilder)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showConfigBuilder ? 'Hide' : 'Customize'} Layer
        </button>
      </div>

      {showConfigBuilder && (
        <div className="absolute top-20 right-4 z-10 w-96 max-h-[calc(100%-10rem)] overflow-y-auto">
          <MapConfigBuilder 
            initialConfig={layerConfigurations[mapType]}
            mapType={mapType}
            onUpdateConfig={(newConfig) => updateLayerConfiguration(mapType, newConfig)}
          />
        </div>
      )}

      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ 
          minHeight: "500px",
          backgroundColor: "#f5f5f5"
        }}
      />
    </div>
  );
};

export default SwitchableMap;