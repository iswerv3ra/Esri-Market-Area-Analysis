import { useEffect, useRef, useState } from "react";
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Zoom from "@arcgis/core/widgets/Zoom";
import Home from "@arcgis/core/widgets/Home";
import BasemapToggle from "@arcgis/core/widgets/BasemapToggle";
import Locate from "@arcgis/core/widgets/Locate";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Legend from "@arcgis/core/widgets/Legend";
import { useMap } from "../../contexts/MapContext";
import LayerPropertiesEditor from './LayerPropertiesEditor';

const API_KEY =
  "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

  const layerConfigurations = {
    population: {
      type: "dot-density",
      field: "TOTPOP_CY",
      dotValue: 100,
      dotBlending: "additive",
      dotSize: 2,
      outline: {
        width: 0.5,
        color: [50, 50, 50, 0.2]
      },
      legendOptions: {
        unit: "people"
      },
      attributes: [{
        field: "TOTPOP_CY",
        color: "#E60049",
        label: "Total Population"
      }]
    },
    income: {
      type: "class-breaks",
      field: "MEDHINC_CY",
      classBreakInfos: [
        {
          minValue: -Infinity,
          maxValue: 50000,
          symbol: {
            type: "simple-fill",
            color: "#8083D6", // Purple
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$50K or Less"
        },
        {
          minValue: 50000,
          maxValue: 75000,
          symbol: {
            type: "simple-fill",
            color: "#90EE90", // Light green
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$50K - $75K"
        },
        {
          minValue: 75000,
          maxValue: 100000,
          symbol: {
            type: "simple-fill",
            color: "#FFFF8F", // Light yellow
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$75K - $100K"
        },
        {
          minValue: 100000,
          maxValue: 125000,
          symbol: {
            type: "simple-fill",
            color: "#FFB6B6", // Light salmon
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$100K - $125K"
        },
        {
          minValue: 125000,
          maxValue: 150000,
          symbol: {
            type: "simple-fill",
            color: "#FF7F7F", // Lighter red
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$125K - $150K"
        },
        {
          minValue: 150000,
          maxValue: Infinity,
          symbol: {
            type: "simple-fill",
            color: "#FF4040", // Red
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$150K or More"
        }
      ]
    },
    growth: {
      type: "class-breaks",
      field: "HHGRW20CY",
      classBreakInfos: [
        {
          minValue: -Infinity,
          maxValue: -3,
          symbol: {
            type: "simple-fill",
            color: "#8083D6", // Purple
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "Less than -3%"
        },
        {
          minValue: -3,
          maxValue: -2,
          symbol: {
            type: "simple-fill",
            color: "#90EE90", // Light green
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "-3% to -2%"
        },
        {
          minValue: -2,
          maxValue: -1,
          symbol: {
            type: "simple-fill",
            color: "#FFFF8F", // Light yellow
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "-2% to -1%"
        },
        {
          minValue: -1,
          maxValue: 0,
          symbol: {
            type: "simple-fill",
            color: "#FFE5CC", // Lightest orange
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "-1% to 0%"
        },
        {
          minValue: 0,
          maxValue: 1,
          symbol: {
            type: "simple-fill",
            color: "#FF7F7F", // Light red
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "0% to 1%"
        },
        {
          minValue: 1,
          maxValue: Infinity,
          symbol: {
            type: "simple-fill",
            color: "#FF4040", // Red
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "More than 1%"
        }
      ]
    }
  };

  // Function to create layers based on visualization type and optional config override
  const createLayers = (visualizationType, configOverride = null) => {
    const config = configOverride || layerConfigurations[visualizationType];
    
    const createRenderer = (config) => {
      if (!config) return null;
    
      switch (config.type) {
        case "dot-density":
          return {
            type: "dot-density",
            field: config.field,
            dotValue: config.dotValue,
            dotBlending: config.dotBlending,
            dotSize: config.dotSize,
            outline: config.outline,
            legendOptions: config.legendOptions,
            attributes: config.attributes
          };
    
        case "class-breaks":
          return {
            type: "class-breaks",
            field: config.field,
            defaultSymbol: {
              type: "simple-fill",
              color: [0, 0, 0, 0],
              outline: { color: [50, 50, 50, 0.2], width: 0.5 }
            },
            defaultLabel: "No data",
            classBreakInfos: config.classBreakInfos
          };
      }
    };

    const layerDefinitions = {
      population: {
        fieldName: "TOTPOP_CY",
        title: "Population Distribution (2024)",
        format: {
          digitSeparator: true,
          places: 0
        }
      },
      income: {
        fieldName: "MEDHINC_CY",
        title: "Median Household Income (2024)",
        format: {
          digitSeparator: true,
          places: 0,
          type: "currency"
        }
      },
      growth: {
        fieldName: "HHGRW20CY",
        title: "Household Growth Rate (2020-2024)",
        format: {
          digitSeparator: true,
          places: 2
        }
      }
    };

    const layerConfig = layerDefinitions[visualizationType];
    if (!layerConfig) return null;

    return new FeatureLayer({
      url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
      renderer: createRenderer(config),
      popupTemplate: {
        title: "Census Tract {NAME}",
        content: [{
          type: "fields",
          fieldInfos: [{
            fieldName: layerConfig.fieldName,
            label: layerConfig.title,
            format: layerConfig.format
          }]
        }]
      },
      title: layerConfig.title,
      minScale: 300000,
    });
  };
// ZoomAlert Component
const ZoomAlert = () => {
  const { isOutsideZoomRange, zoomMessage } = useMap();

  if (!isOutsideZoomRange || !zoomMessage) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">{zoomMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MapComponent({ onToggleList }) {
  const mapRef = useRef(null);
  const { setMapView, mapView } = useMap();
  const initCompleteRef = useRef(false);
  const layersRef = useRef({});
  const [legend, setLegend] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  // Initialize layer configurations state
  const [layerConfigurations, setLayerConfigurations] = useState({
    population: {
      type: "dot-density",
      field: "TOTPOP_CY",
      dotValue: 100,
      dotBlending: "additive",
      dotSize: 2,
      outline: {
        width: 0.5,
        color: [50, 50, 50, 0.2]
      },
      legendOptions: {
        unit: "people"
      },
      attributes: [{
        field: "TOTPOP_CY",
        color: "#E60049",
        label: "Total Population"
      }]
    },
    income: {
      type: "class-breaks",
      field: "MEDHINC_CY",
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 35000,
          symbol: {
            type: "simple-fill",
            color: "#fee5d9",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "< $35,000"
        },
        {
          minValue: 35000,
          maxValue: 75000,
          symbol: {
            type: "simple-fill",
            color: "#fcae91",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$35,000 - $75,000"
        },
        {
          minValue: 75000,
          maxValue: 125000,
          symbol: {
            type: "simple-fill",
            color: "#fb6a4a",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$75,000 - $125,000"
        },
        {
          minValue: 125000,
          maxValue: 200000,
          symbol: {
            type: "simple-fill",
            color: "#de2d26",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "$125,000 - $200,000"
        },
        {
          minValue: 200000,
          maxValue: Infinity,
          symbol: {
            type: "simple-fill",
            color: "#a50f15",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "> $200,000"
        }
      ]
    },
    growth: {
      type: "class-breaks",
      field: "HHGRW20CY",
      classBreakInfos: [
        {
          minValue: -Infinity,
          maxValue: 0,
          symbol: {
            type: "simple-fill",
            color: "#d73027",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "Negative Growth"
        },
        {
          minValue: 0,
          maxValue: 2,
          symbol: {
            type: "simple-fill",
            color: "#fc8d59",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "0% - 2%"
        },
        {
          minValue: 2,
          maxValue: 5,
          symbol: {
            type: "simple-fill",
            color: "#fee08b",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "2% - 5%"
        },
        {
          minValue: 5,
          maxValue: 10,
          symbol: {
            type: "simple-fill",
            color: "#91cf60",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "5% - 10%"
        },
        {
          minValue: 10,
          maxValue: Infinity,
          symbol: {
            type: "simple-fill",
            color: "#1a9850",
            outline: { color: [50, 50, 50, 0.2], width: "0.5px" }
          },
          label: "> 10%"
        }
      ]
    }
  });

  const [tabs, setTabs] = useState([
    { id: 1, name: "Core Map", active: true },
  ]);
  const [activeTab, setActiveTab] = useState(1);
  const [visualizationType, setVisualizationType] = useState(null);

  useEffect(() => {
    try {
      esriConfig.apiKey = API_KEY;
      esriConfig.assetsPath = "https://js.arcgis.com/4.31/@arcgis/core/assets/";

      if (!esriConfig.request.corsEnabledServers) {
        esriConfig.request.corsEnabledServers = [];
      }

      const serversToAdd = [
        "geocode-api.arcgis.com",
        "route-api.arcgis.com",
        "services.arcgis.com",
        "basemaps.arcgis.com",
        "basemaps-api.arcgis.com",
        "tiles.arcgis.com",
      ];

      serversToAdd.forEach((server) => {
        if (!esriConfig.request.corsEnabledServers.includes(server)) {
          esriConfig.request.corsEnabledServers.push(server);
        }
      });
    } catch (error) {
      console.error("[Map] Error initializing ArcGIS configuration:", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        const map = new Map({
          basemap: "arcgis-navigation",
        });

        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-117.8311, 33.7175],
          zoom: 11,
          constraints: {
            snapToZoom: false,
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20,
          },
          ui: {
            components: ["attribution"],
          },
        });

        // Add non-legend widgets
        const widgets = [
          {
            widget: new Zoom({ view }),
            position: "top-left",
          },
          {
            widget: new Home({ view }),
            position: "top-left",
          },
          {
            widget: new BasemapToggle({
              view,
              nextBasemap: "arcgis-imagery",
            }),
            position: "bottom-right",
          },
          {
            widget: new Locate({
              view,
              useHeadingEnabled: false,
              goToOverride: (view, options) => {
                options.target.scale = 1500;
                return view.goTo(options.target, {
                  duration: 1000,
                  easing: "ease-in-out",
                });
              },
            }),
            position: "top-left",
          },
          {
            widget: new ScaleBar({
              view,
              unit: "imperial",
            }),
            position: "bottom-right",
          },
        ];

        // Add all non-legend widgets
        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        // Create legend but don't add it yet
        const legendWidget = new Legend({
          view,
          style: "card",
        });

        setLegend(legendWidget);

        if (isMounted) {
          setMapView(view);
        }
      } catch (error) {
        console.error("[Map] Error initializing map:", error);
      }
    };

    initializeMap();
    return () => {
      isMounted = false;
    };
  }, [setMapView]);

  // Style the legend whenever it changes
  useEffect(() => {
    if (!legend) return;

    const styleLegend = () => {
      const legendContainer = document.querySelector(".esri-legend");
      if (legendContainer) {
        legendContainer.style.backgroundColor = "white";
        legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
        legendContainer.style.borderRadius = "0.375rem";
        legendContainer.style.padding = "0.5rem";
        legendContainer.style.margin = "0.5rem";
        legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
        
        const legendTitle = legendContainer.querySelector(".esri-legend__title");
        if (legendTitle) {
          legendTitle.style.fontWeight = "600";
          legendTitle.style.fontSize = "0.875rem";
          legendTitle.style.marginBottom = "0.5rem";
          legendTitle.style.color = "#111827";
        }

        const legendItems = legendContainer.querySelectorAll(".esri-legend__layer-cell");
        legendItems.forEach(item => {
          const label = item.querySelector(".esri-legend__layer-cell--info");
          if (label) {
            label.style.fontSize = "0.75rem";
            label.style.color = "#4B5563";
          }
        });

        const swatches = legendContainer.querySelectorAll(".esri-legend__symbol");
        swatches.forEach(swatch => {
          swatch.style.width = "1.5rem";
          swatch.style.height = "1.5rem";
          swatch.style.margin = "0.25rem";
          swatch.style.borderRadius = "0.25rem";
        });
      }
    };

    styleLegend();
  }, [legend]);

  // Handle legend visibility based on active tab
  useEffect(() => {
    if (!mapView || !legend) return;

    if (activeTab === 1) {
      // Remove legend for core map
      mapView.ui.remove(legend);
    } else {
      // Add legend for other maps if not already present
      if (!mapView.ui.find(widget => widget === legend)) {
        mapView.ui.add(legend, "bottom-left");
      }
    }
  }, [activeTab, mapView, legend]);

  useEffect(() => {
    if (!mapView?.map) return;

    const updateVisualizationLayer = async () => {
      try {
        // Remove existing visualization layers
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            mapView.map.remove(layer);
          }
        });

        // Only add new layer if we're not in the core map and have a selected type
        if (activeTab !== 1 && visualizationType) {
          const newLayer = createLayers(visualizationType);

          if (newLayer) {
            newLayer.set("isVisualizationLayer", true);
            // Add the new layer at index 0 to ensure it's at the bottom
            mapView.map.add(newLayer, 0);
          }
        }
      } catch (error) {
        console.error("Error updating visualization layer:", error);
      }
    };

    updateVisualizationLayer();
  }, [visualizationType, mapView, activeTab]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setTabs(
      tabs.map((tab) => ({
        ...tab,
        active: tab.id === tabId,
        isEditing: false, // Close any open editing when switching tabs
      }))
    );
  };

  const handleVisualizationChange = (newValue) => {
    setTabs(
      tabs.map((tab) =>
        tab.id === activeTab
          ? { ...tab, visualizationType: newValue || null }
          : tab
      )
    );
  };

  const startEditing = (tabId, e) => {
    e.stopPropagation(); // Prevent tab activation when clicking edit button
    setTabs(
      tabs.map((tab) => ({
        ...tab,
        isEditing: tab.id === tabId,
      }))
    );
  };

  const handleNameChange = (tabId, newName) => {
    // Only update if we have a non-empty name and it's different from the current name
    const currentTab = tabs.find((tab) => tab.id === tabId);
    if (newName.trim() && currentTab && newName.trim() !== currentTab.name) {
      setTabs(
        tabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, name: newName.trim(), isEditing: false }
            : tab
        )
      );
    } else if (currentTab) {
      // If invalid name, revert to original name and exit editing
      setTabs(
        tabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, name: currentTab.name, isEditing: false }
            : tab
        )
      );
    }
  };

  const handleNameKeyDown = (tabId, e) => {
    if (e.key === "Enter") {
      handleNameChange(tabId, e.target.value);
    } else if (e.key === "Escape") {
      setTabs(
        tabs.map((tab) =>
          tab.id === tabId ? { ...tab, isEditing: false } : tab
        )
      );
    }
  };

  const addNewTab = () => {
    const newTabId = tabs.length + 1;
    setTabs([
      ...tabs,
      {
        id: newTabId,
        name: `Map ${newTabId}`,
        active: false,
        visualizationType: null,
        isEditing: false,
      },
    ]);
  };

  // Effect for updating visualization layer
  useEffect(() => {
    if (!mapView?.map) return;

    const updateVisualizationLayer = async () => {
      try {
        // Remove existing visualization layers
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer?.isVisualizationLayer) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach(layer => mapView.map.remove(layer));

        // Find the active tab and its visualization type
        const activeTabData = tabs.find((tab) => tab.id === activeTab);

        // Only add new layer if we're not in the core map and have a selected type
        if (activeTab !== 1 && activeTabData?.visualizationType) {
          const currentConfig = layerConfigurations[activeTabData.visualizationType];
          const newLayer = createLayers(activeTabData.visualizationType, currentConfig);

          if (newLayer) {
            newLayer.isVisualizationLayer = true;
            mapView.map.add(newLayer, 0);
          }
        }
      } catch (error) {
        console.error("Error updating visualization layer:", error);
      }
    };

    updateVisualizationLayer();
  }, [activeTab, tabs, mapView, layerConfigurations]);


  const handleLayerConfigChange = (newConfig) => {
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    if (activeTabData?.visualizationType) {
      setLayerConfigurations(prev => ({
        ...prev,
        [activeTabData.visualizationType]: newConfig
      }));
      
      // Immediately update the layer with new configuration
      if (mapView?.map) {
        // Remove existing visualization layers
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer?.isVisualizationLayer) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach(layer => mapView.map.remove(layer));

        // Create and add new layer with updated config
        const newLayer = createLayers(activeTabData.visualizationType, newConfig);
        if (newLayer) {
          newLayer.isVisualizationLayer = true;
          mapView.map.add(newLayer, 0);
        }
      }
    }
  };
  
  const handleConfigPreview = (previewConfig) => {
    if (!mapView?.map) return;
  
    // Remove existing visualization layers
    const layersToRemove = [];
    mapView.map.layers.forEach((layer) => {
      if (layer?.isVisualizationLayer) {
        layersToRemove.push(layer);
      }
    });
    layersToRemove.forEach(layer => mapView.map.remove(layer));
  
    // Create new layer with preview config
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    if (activeTabData?.visualizationType) {
      const newLayer = createLayers(activeTabData.visualizationType, previewConfig);
      if (newLayer) {
        newLayer.isVisualizationLayer = true;
        mapView.map.add(newLayer, 0);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2 overflow-x-auto">
            {tabs.map((tab) => (
              <div key={tab.id} className="flex items-center">
                <div
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none transition-colors cursor-pointer ${
                    tab.active
                      ? "bg-blue-500 dark:bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {tab.isEditing ? (
                    <input
                      type="text"
                      value={tab.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onChange={(e) =>
                        setTabs(
                          tabs.map((t) =>
                            t.id === tab.id ? { ...t, name: e.target.value } : t
                          )
                        )
                      }
                      onKeyDown={(e) => handleNameKeyDown(tab.id, e)}
                      onBlur={(e) => handleNameChange(tab.id, e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-inherit w-24 px-1"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center">
                      <span>{tab.name}</span>
                      {tab.id !== 1 && (
                        <div
                          onClick={(e) => startEditing(tab.id, e)}
                          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={addNewTab}
              className="ml-2 px-3 py-1 text-sm bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none transition-colors"
            >
              + New Map
            </button>
          </div>
          {activeTab !== 1 && (
            <div className="ml-4 flex items-center space-x-2">
              <select
                value={
                  tabs.find((tab) => tab.id === activeTab)?.visualizationType ||
                  ""
                }
                onChange={(e) => handleVisualizationChange(e.target.value)}
                className="block w-48 rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
                         text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
                         focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select visualization</option>
                <option value="population">Population Density</option>
                <option value="income">Median Income</option>
                <option value="growth">Household Growth</option>
              </select>
              {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none"
                  title="Edit layer properties"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-grow relative">
        <div ref={mapRef} className="w-full h-full relative">
          <ZoomAlert />
        </div>
      </div>

      {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
        <LayerPropertiesEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          visualizationType={tabs.find((tab) => tab.id === activeTab)?.visualizationType}
          layerConfig={layerConfigurations[tabs.find((tab) => tab.id === activeTab)?.visualizationType]}
          onConfigChange={handleLayerConfigChange}
          onPreview={handleConfigPreview}
        />
      )}
    </div>
  );
}
