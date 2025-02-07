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
import LayerPropertiesEditor from "./LayerPropertiesEditor";
import PropTypes from 'prop-types';
import axios from 'axios';
const API_KEY =
  "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

const colorScheme = {
  level1: [255, 99, 71, 0.45],    // Salmon red
  level2: [255, 165, 0, 0.45],    // Orange
  level3: [255, 255, 144, 0.45],  // Light yellow
  level4: [144, 238, 144, 0.45],  // Light green
  level5: [135, 206, 235, 0.45],  // Sky blue
  level6: [0, 0, 139, 0.45],      // Dark blue
  level7: [128, 0, 128, 0.45]     // Purple
};

// Update the createClassBreaks function accordingly
const createClassBreaks = (breakPoints, labels) => {
  return breakPoints.map((point, index) => ({
    minValue: point.min === undefined ? -Infinity : point.min,
    maxValue: point.max === undefined ? Infinity : point.max,
    symbol: {
      type: "simple-fill",
      color: colorScheme[`level${index + 1}`],
      outline: {
        color: [50, 50, 50, 0.2],
        width: "0.5px"
      }
    },
    label: labels[index]
  }));
};
const initialLayerConfigurations = {
  population: {
    type: "dot-density",
    field: "TOTPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: {
      width: 0.5,
      color: [50, 50, 50, 0.2],
    },
    legendOptions: {
      unit: "people",
    },
    attributes: [
      {
        field: "TOTPOP_CY",
        color: "#E60049",
        label: "Total Population",
      },
    ],
  },
  income: {
    type: "class-breaks",
    field: "MEDHINC_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 35000 },
        { min: 35000, max: 65000 },
        { min: 65000, max: 95000 },
        { min: 95000, max: 125000 },
        { min: 125000, max: 155000 },
        { min: 155000, max: 200000 },
        { min: 200000 }
      ],
      [
        "Less than $35,000",
        "$35,000 - $65,000",
        "$65,000 - $95,000",
        "$95,000 - $125,000",
        "$125,000 - $155,000",
        "$155,000 - $200,000",
        "$200,000 or more"
      ]
    )
  },
  growth: {
    type: "class-breaks",
    field: "HHGRW20CY",
    classBreakInfos: createClassBreaks(
      [
        { max: -3 },
        { min: -3, max: -2 },
        { min: -2, max: -1 },
        { min: -1, max: 0 },
        { min: 0, max: 1 },
        { min: 1, max: 2 },
        { min: 2 }
      ],
      [
        "Less than -3%",
        "-3% to -2%",
        "-2% to -1%",
        "-1% to 0%",
        "0% to 1%",
        "1% to 2%",
        "2% or more"
      ]
    )
  },
  density: {
    type: "class-breaks",
    field: "POPDENS_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 7500 },
        { min: 7500, max: 10000 },
        { min: 10000, max: 15000 },
        { min: 15000 }
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 7,500",
        "7,500 - 10,000",
        "10,000 - 15,000",
        "15,000 or more"
      ]
    )
  },
  age: {
    type: "class-breaks",
    field: "MEDAGE_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 30 },
        { min: 30, max: 35 },
        { min: 35, max: 40 },
        { min: 40, max: 45 },
        { min: 45, max: 50 },
        { min: 50, max: 55 },
        { min: 55 }
      ],
      [
        "Less than 30 years",
        "30 - 35 years",
        "35 - 40 years",
        "40 - 45 years",
        "45 - 50 years",
        "50 - 55 years",
        "55 years or more"
      ]
    )
  },
  unemployment: {
    type: "class-breaks",
    field: "UNEMPRT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 9 },
        { min: 9, max: 11 },
        { min: 11, max: 13 },
        { min: 13 }
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 9%",
        "9% - 11%",
        "11% - 13%",
        "13% or more"
      ]
    )
  },
  homeValue: {
    type: "class-breaks",
    field: "MEDVAL_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200000 },
        { min: 200000, max: 350000 },
        { min: 350000, max: 500000 },
        { min: 500000, max: 750000 },
        { min: 750000, max: 1000000 },
        { min: 1000000, max: 1500000 },
        { min: 1500000 }
      ],
      [
        "Less than $200,000",
        "$200,000 - $350,000",
        "$350,000 - $500,000",
        "$500,000 - $750,000",
        "$750,000 - $1,000,000",
        "$1,000,000 - $1,500,000",
        "$1,500,000 or more"
      ]
    )
  },
  affordability: {
    type: "class-breaks",
    field: "HAI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 125 },
        { min: 125, max: 150 },
        { min: 150, max: 175 },
        { min: 175 }
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 150",
        "150 - 175",
        "175 or more"
      ]
    )
  }
};
// Update the visualization options in the dropdown
const visualizationOptions = [
  { value: "population", label: "Population Distribution" },
  { value: "income", label: "Median Household Income" },
  { value: "growth", label: "Household Growth Rate" },
  { value: "affordability", label: "Housing Affordability Index" },
  { value: "density", label: "Population Density" },
  { value: "age", label: "Median Age" },
  { value: "unemployment", label: "Unemployment Rate" },
  { value: "homeValue", label: "Median Home Value" }
];

const createLayers = (
  visualizationType,
  configOverride = null,
  layerConfigs = initialLayerConfigurations,
  selectedAreaType = areaTypes[0]
) => {
  // Validate inputs
  if (!visualizationType) {
    console.error('No visualization type provided');
    return null;
  }

  if (!selectedAreaType) {
    console.error('No area type provided, using default');
    selectedAreaType = areaTypes[0];
  }

  const config = configOverride || layerConfigs[visualizationType];

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
          attributes: config.attributes,
        };

      case "class-breaks":
        return {
          type: "class-breaks",
          field: config.field,
          defaultSymbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [50, 50, 50, 0.2], width: 0.5 },
          },
          defaultLabel: "No data",
          classBreakInfos: config.classBreakInfos,
        };

      default:
        console.error('Unsupported renderer type:', config.type);
        return null;
    }
  };

  const layerDefinitions = {
    population: {
      fieldName: "TOTPOP_CY",
      title: "Population Distribution (2024)",
      format: {
        digitSeparator: true,
        places: 0,
      },
    },
    income: {
      fieldName: "MEDHINC_CY",
      title: "Median Household Income (2024)",
      format: {
        digitSeparator: true,
        places: 0,
        type: "currency",
      },
    },
    growth: {
      fieldName: "HHGRW20CY",
      title: "Household Growth Rate (2020-2024)",
      format: {
        digitSeparator: true,
        places: 2,
      },
    },
    affordability: {
      fieldName: "HAI_CY",
      title: "Housing Affordability Index (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    density: {
      fieldName: "POPDENS_CY",
      title: "Population Density (2024)",
      format: {
        digitSeparator: true,
        places: 0,
      },
    },
    age: {
      fieldName: "MEDAGE_CY",
      title: "Median Age (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    unemployment: {
      fieldName: "UNEMPRT_CY",
      title: "Unemployment Rate (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    homeValue: {
      fieldName: "MEDVAL_CY",
      title: "Median Home Value (2024)",
      format: {
        digitSeparator: true,
        places: 0,
        type: "currency",
      },
    },
  };

  const layerConfig = layerDefinitions[visualizationType];

  // Validate layer configuration
  if (!layerConfig) {
    console.error(`No layer configuration found for visualization type: ${visualizationType}`);
    return null;
  }

  if (!config) {
    console.error(`No configuration found for visualization type: ${visualizationType}`);
    return null;
  }

  // Validate URL
  if (!selectedAreaType.url) {
    console.error('Invalid area type: No URL provided', selectedAreaType);
    return null;
  }

  // Create and return the FeatureLayer
  return new FeatureLayer({
    url: selectedAreaType.url,
    renderer: createRenderer(config),
    popupTemplate: {
      title: `${selectedAreaType.label} {NAME}`,
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: layerConfig.fieldName,
              label: layerConfig.title,
              format: layerConfig.format,
            },
          ],
        },
      ],
    },
    title: layerConfig.title,
    minScale: selectedAreaType.value === 12 ? 2500000 : 25000000, // Adjust scale based on area type
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

const areaTypes = [
  { value: 12, label: "Census Tract", url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12" },
  { value: 11, label: "County", url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/11" }
];

export default function MapComponent({ onToggleLis }) {
  const mapRef = useRef(null);
  const { setMapView, mapView } = useMap();
  const initCompleteRef = useRef(false);
  const layersRef = useRef({});
  const [legend, setLegend] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);

  // Modify storage keys to use a static default
  const AUTO_SAVE_KEY = 'autoSavedMapConfigurations_default';
  const MANUAL_SAVE_KEY = 'mapConfigurations_default';

  const [layerConfigurations, setLayerConfigurations] = useState({
    population: {
      type: "dot-density",
      field: "TOTPOP_CY",
      dotValue: 100,
      dotBlending: "additive",
      dotSize: 2,
      outline: {
        width: 0.5,
        color: [50, 50, 50, 0.2],
      },
      legendOptions: {
        unit: "people",
      },
      attributes: [
        {
          field: "TOTPOP_CY",
          color: "#E60049",
          label: "Total Population",
        },
      ],
    },
    income: {
      type: "class-breaks",
      field: "MEDHINC_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 35000 },
          { min: 35000, max: 65000 },
          { min: 65000, max: 95000 },
          { min: 95000, max: 125000 },
          { min: 125000, max: 155000 },
          { min: 155000, max: 200000 },
          { min: 200000 }
        ],
        [
          "Less than $35,000",
          "$35,000 - $65,000",
          "$65,000 - $95,000",
          "$95,000 - $125,000",
          "$125,000 - $155,000",
          "$155,000 - $200,000",
          "$200,000 or more"
        ]
      )
    },
    growth: {
      type: "class-breaks",
      field: "HHGRW20CY",
      classBreakInfos: createClassBreaks(
        [
          { max: -3 },
          { min: -3, max: -2 },
          { min: -2, max: -1 },
          { min: -1, max: 0 },
          { min: 0, max: 1 },
          { min: 1, max: 2 },
          { min: 2 }
        ],
        [
          "Less than -3%",
          "-3% to -2%",
          "-2% to -1%",
          "-1% to 0%",
          "0% to 1%",
          "1% to 2%",
          "2% or more"
        ]
      )
    },
    density: {
      type: "class-breaks",
      field: "POPDENS_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 1000 },
          { min: 1000, max: 2500 },
          { min: 2500, max: 5000 },
          { min: 5000, max: 7500 },
          { min: 7500, max: 10000 },
          { min: 10000, max: 15000 },
          { min: 15000 }
        ],
        [
          "Less than 1,000",
          "1,000 - 2,500",
          "2,500 - 5,000",
          "5,000 - 7,500",
          "7,500 - 10,000",
          "10,000 - 15,000",
          "15,000 or more"
        ]
      )
    },
    age: {
      type: "class-breaks",
      field: "MEDAGE_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 30 },
          { min: 30, max: 35 },
          { min: 35, max: 40 },
          { min: 40, max: 45 },
          { min: 45, max: 50 },
          { min: 50, max: 55 },
          { min: 55 }
        ],
        [
          "Less than 30 years",
          "30 - 35 years",
          "35 - 40 years",
          "40 - 45 years",
          "45 - 50 years",
          "50 - 55 years",
          "55 years or more"
        ]
      )
    },
    unemployment: {
      type: "class-breaks",
      field: "UNEMPRT_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 3 },
          { min: 3, max: 5 },
          { min: 5, max: 7 },
          { min: 7, max: 9 },
          { min: 9, max: 11 },
          { min: 11, max: 13 },
          { min: 13 }
        ],
        [
          "Less than 3%",
          "3% - 5%",
          "5% - 7%",
          "7% - 9%",
          "9% - 11%",
          "11% - 13%",
          "13% or more"
        ]
      )
    },
    homeValue: {
      type: "class-breaks",
      field: "MEDVAL_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 200000 },
          { min: 200000, max: 350000 },
          { min: 350000, max: 500000 },
          { min: 500000, max: 750000 },
          { min: 750000, max: 1000000 },
          { min: 1000000, max: 1500000 },
          { min: 1500000 }
        ],
        [
          "Less than $200,000",
          "$200,000 - $350,000",
          "$350,000 - $500,000",
          "$500,000 - $750,000",
          "$750,000 - $1,000,000",
          "$1,000,000 - $1,500,000",
          "$1,500,000 or more"
        ]
      )
    },
    affordability: {
      type: "class-breaks",
      field: "HAI_CY",
      classBreakInfos: createClassBreaks(
        [
          { max: 50 },
          { min: 50, max: 75 },
          { min: 75, max: 100 },
          { min: 100, max: 125 },
          { min: 125, max: 150 },
          { min: 150, max: 175 },
          { min: 175 }
        ],
        [
          "Less than 50",
          "50 - 75",
          "75 - 100",
          "100 - 125",
          "125 - 150",
          "150 - 175",
          "175 or more"
        ]
      )
    }
  });

  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: "Core Map",
      active: true,
      visualizationType: null,
      areaType: areaTypes[0],
      layerConfiguration: null
    }
  ]); const [activeTab, setActiveTab] = useState(1);
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
          constraints: {
            snapToZoom: false,
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20,
          },
          navigation: {
            mouseWheelZoomEnabled: true,
            browserTouchPanEnabled: true,
            momentumEnabled: true,
            keyboardNavigation: true,
          },
          ui: {
            components: ["attribution"],
          },
        });

        // Wait for the view to be ready before proceeding
        await view.when();

        // Add smooth zoom behavior
        view.on("mouse-wheel", (event) => {
          event.stopPropagation();
          const delta = event.deltaY;
          const currentZoom = view.zoom;
          const zoomDelta = delta > 0 ? -0.20 : 0.20;
          const newZoom = Math.min(
            Math.max(currentZoom + zoomDelta, view.constraints.minZoom),
            view.constraints.maxZoom
          );

          view.goTo(
            {
              zoom: newZoom,
              center: view.center,
            },
            {
              duration: 100,
              easing: "linear",
            }
          );
        });

        // Add non-legend widgets after view is ready
        const widgets = [
          {
            widget: new Zoom({
              view,
              zoomFactor: 1.2,
            }),
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

        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        // Create a single legend instance
        const legendWidget = new Legend({
          view,
          container: document.createElement("div"),
          layerInfos: [],
          visible: false // Start with legend hidden
        });

        // Add legend to the view but keep it hidden initially
        view.ui.add(legendWidget, "bottom-left");
        setLegend(legendWidget);

        // Key event listener for keyboard zoom control
        view.container.addEventListener("keydown", (event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            const newZoom = Math.min(view.zoom + 0.2, view.constraints.maxZoom);
            view.goTo(
              {
                zoom: newZoom,
                center: view.center,
              },
              {
                duration: 100,
                easing: "linear",
              }
            );
          } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            const newZoom = Math.max(view.zoom - 0.2, view.constraints.minZoom);
            view.goTo(
              {
                zoom: newZoom,
                center: view.center,
              },
              {
                duration: 100,
                easing: "linear",
              }
            );
          }
        });

        if (isMounted) {
          // Set map readiness flag and view in context
          view.ready = true;
          setMapView(view);
          console.log('[MapContext] Map view initialized and ready');
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

  // Style legend whenever it changes
  useEffect(() => {
    if (!legend) return;

    const styleLegend = () => {
      const legendContainer = document.querySelector(".esri-legend");
      if (legendContainer) {
        legendContainer.style.backgroundColor = "white";
        legendContainer.style.padding = "1rem";
        legendContainer.style.margin = "0.5rem";
        legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
        legendContainer.style.borderRadius = "0.375rem";
        legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

        // Style the legend title
        const legendTitle = legendContainer.querySelector(
          ".esri-legend__service-label"
        );
        if (legendTitle) {
          legendTitle.style.fontWeight = "600";
          legendTitle.style.fontSize = "0.875rem";
          legendTitle.style.marginBottom = "0.75rem";
          legendTitle.style.color = "#111827";
        }

        // Style individual legend items
        const legendItems = legendContainer.querySelectorAll(
          ".esri-legend__layer-row"
        );
        legendItems.forEach((item) => {
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.marginBottom = "0.5rem";
        });

        // Style the color swatches
        const swatches = legendContainer.querySelectorAll(
          ".esri-legend__symbol"
        );
        swatches.forEach((swatch) => {
          swatch.style.width = "1rem";
          swatch.style.height = "1rem";
          swatch.style.marginRight = "0.5rem";
        });

        // Style the labels
        const labels = legendContainer.querySelectorAll(
          ".esri-legend__layer-cell--info"
        );
        labels.forEach((label) => {
          label.style.fontSize = "0.875rem";
          label.style.color = "#4B5563";
        });
      }
    };

    styleLegend();
  }, [legend]);


  // Updated initialization effect
  useEffect(() => {
    // Load auto-saved configurations on mount
    const initConfigs = async () => {
      await loadMapConfigurations(AUTO_SAVE_KEY, false);

      // Force update visualization layers and legend for all loaded tabs
      const loadedTabs = tabs.filter(tab => tab.id !== 1 && tab.visualizationType);
      for (const tab of loadedTabs) {
        const newLayer = createLayers(
          tab.visualizationType,
          tab.layerConfiguration,
          initialLayerConfigurations,
          tab.areaType
        );

        if (newLayer && mapView?.map) {
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);

          if (legend && tab.active) {
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || tab.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    };

    initConfigs();
  }, [mapView, legend]);

  // Updated legend visibility effect
  useEffect(() => {
    if (!legend) return;

    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const hasVisualization = activeTabData?.visualizationType;
    const shouldShowLegend = activeTab !== 1 && hasVisualization && !isEditorOpen;

    // Update legend visibility
    legend.visible = shouldShowLegend;

    if (shouldShowLegend) {
      // Ensure legend is properly styled
      requestAnimationFrame(() => {
        const styleLegend = () => {
          const legendContainer = legend.container;
          if (legendContainer) {
            legendContainer.style.backgroundColor = "white";
            legendContainer.style.padding = "1rem";
            legendContainer.style.margin = "0.5rem";
            legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
            legendContainer.style.borderRadius = "0.375rem";
            legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

            // Style legend title
            const legendTitle = legendContainer.querySelector(".esri-legend__service-label");
            if (legendTitle) {
              legendTitle.style.fontWeight = "600";
              legendTitle.style.fontSize = "0.875rem";
              legendTitle.style.marginBottom = "0.75rem";
              legendTitle.style.color = "#111827";
            }

            // Style legend items
            const legendItems = legendContainer.querySelectorAll(".esri-legend__layer-row");
            legendItems.forEach((item) => {
              item.style.display = "flex";
              item.style.alignItems = "center";
              item.style.marginBottom = "0.5rem";
            });
          }
        };

        styleLegend();
      });
    }
  }, [activeTab, legend, tabs, isEditorOpen]);

  // Update legend visibility when visualization changes
  useEffect(() => {
    if (!mapView?.map || !legend) return;

    const updateLegendForLayer = async () => {
      try {
        const activeTabData = tabs.find((tab) => tab.id === activeTab);
        if (activeTab !== 1 && activeTabData?.visualizationType && !isEditorOpen) {
          const existingLegend = mapView.ui.find((widget) => widget === legend);
          if (!existingLegend) {
            mapView.ui.add(legend, "bottom-left");
          }
        }
      } catch (error) {
        console.error("Error updating legend:", error);
      }
    };

    updateLegendForLayer();
  }, [activeTab, mapView, legend, tabs, layerConfigurations]);



  const updateVisualizationLayer = async () => {
    try {
      // Remove existing visualization layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer.get("isVisualizationLayer")) {
          layersToRemove.push(layer);
        }
      });
      layersToRemove.forEach((layer) => mapView.map.remove(layer));

      // Find the active tab and its visualization type
      const activeTabData = tabs.find((tab) => tab.id === activeTab);

      // Only add new layer if we're not in the core map and have a selected type
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        const layerConfig = activeTabData.layerConfiguration;

        const newLayer = createLayers(
          activeTabData.visualizationType,
          layerConfig,
          initialLayerConfigurations,
          selectedAreaType
        );

        if (newLayer) {
          // Set the visualization flag
          newLayer.set("isVisualizationLayer", true);

          // Add the layer to the map
          mapView.map.add(newLayer, 0);

          // Update the legend configuration for this layer
          legend.layerInfos = [{
            layer: newLayer,
            title: newLayer.title || activeTabData.visualizationType,
            hideLayersNotInCurrentView: false
          }];
        }
      }
    } catch (error) {
      console.error("Error updating visualization layer:", error);
    }
  };

  // Use the tab-specific configuration when switching tabs or rendering
  useEffect(() => {
    if (!mapView?.map || !legend) return;
    updateVisualizationLayer();
  }, [
    activeTab,
    tabs,  // Added tabs to the dependency array
    mapView,
    legend,
    isEditorOpen,
    selectedAreaType
  ]);


  // Updated handleTabClick function
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    const newTabs = tabs.map((tab) => ({
      ...tab,
      active: tab.id === tabId,
      isEditing: false, // Close any open editing when switching tabs
    }));
    setTabs(newTabs);

    // Update visualization and legend for the newly selected tab
    const selectedTab = newTabs.find(tab => tab.id === tabId);
    if (selectedTab && mapView?.map) {
      if (tabId === 1) {
        // Clear visualization layers for Core Map
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach((layer) => mapView.map.remove(layer));

        // Hide legend for Core Map
        if (legend) {
          legend.visible = false;
        }
      } else if (selectedTab.visualizationType) {
        // Create and add new layer for visualization tabs
        const newLayer = createLayers(
          selectedTab.visualizationType,
          selectedTab.layerConfiguration,
          initialLayerConfigurations,
          selectedTab.areaType
        );

        if (newLayer) {
          // Remove existing visualization layers
          mapView.map.layers.forEach((layer) => {
            if (layer.get("isVisualizationLayer")) {
              mapView.map.remove(layer);
            }
          });

          // Add new layer
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);

          // Update legend
          if (legend) {
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || selectedTab.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    }
  };

  const handleAreaTypeChange = (tabId, newAreaType) => {
    // Update the area type for the specific tab
    const newTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
          ...tab,
          areaType: newAreaType
        }
        : tab
    );

    setTabs(newTabs);
    setSelectedAreaType(newAreaType);

    // Update visualization and legend if there is one active
    const activeTabData = newTabs.find((tab) => tab.id === tabId);
    if (activeTabData?.visualizationType && mapView?.map) {
      // Remove existing visualization layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer.get("isVisualizationLayer")) {
          layersToRemove.push(layer);
        }
      });
      layersToRemove.forEach((layer) => mapView.map.remove(layer));

      // Create and add new layer with updated area type
      const newLayer = createLayers(
        activeTabData.visualizationType,
        activeTabData.layerConfiguration,
        initialLayerConfigurations,
        newAreaType
      );

      if (newLayer) {
        newLayer.set("isVisualizationLayer", true);
        mapView.map.add(newLayer, 0);

        // Update legend configuration
        if (legend) {
          legend.layerInfos = [{
            layer: newLayer,
            title: newLayer.title || activeTabData.visualizationType,
            hideLayersNotInCurrentView: false
          }];
          legend.visible = true;
        }
      }
    }

    autoSaveMapConfigurations();
  };

  // Update the visualization change handler
  // Modify handleVisualizationChange to save configuration to the specific tab
  const handleVisualizationChange = (tabId, newValue) => {
    if (!newValue) {
      const newTabs = tabs.map((tab) =>
        tab.id === tabId
          ? {
            ...tab,
            visualizationType: null,
            layerConfiguration: null
          }
          : tab
      );
      setTabs(newTabs);
      autoSaveMapConfigurations();
      return;
    }

    const initialConfig = initialLayerConfigurations[newValue];
    const newTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
          ...tab,
          visualizationType: newValue,
          layerConfiguration: initialConfig
        }
        : tab
    );

    setTabs(newTabs);
    setLayerConfigurations((prev) => {
      if (!prev[newValue]) {
        return {
          ...prev,
          [newValue]: initialConfig
        };
      }
      return prev;
    });
    autoSaveMapConfigurations();
  };


  // Add this to your JSX near the visualization type dropdown
  const renderAreaTypeDropdown = () => (
    <select
      value={selectedAreaType.value}
      onChange={(e) => {
        const newAreaType = areaTypes.find(type => type.value === parseInt(e.target.value));
        setSelectedAreaType(newAreaType);

        // Trigger layer update when area type changes
        const activeTabData = tabs.find(tab => tab.id === activeTab);
        if (activeTabData?.visualizationType) {
          const currentConfig = layerConfigurations[activeTabData.visualizationType];
          const newLayer = createLayers(
            activeTabData.visualizationType,
            currentConfig,
            initialLayerConfigurations
          );
          if (newLayer && mapView?.map) {
            // Remove existing visualization layers
            const layersToRemove = [];
            mapView.map.layers.forEach((layer) => {
              if (layer.get("isVisualizationLayer")) {
                layersToRemove.push(layer);
              }
            });
            layersToRemove.forEach((layer) => mapView.map.remove(layer));

            // Add new layer
            newLayer.set("isVisualizationLayer", true);
            mapView.map.add(newLayer, 0);
          }
        }
      }}
      className="block w-36 rounded-md border border-gray-300 dark:border-gray-600 
        bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
        text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
        focus:ring-blue-500 focus:border-blue-500"
    >
      {areaTypes.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );

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

  // Updated tab management functions

  const addNewTab = () => {
    const existingTabNumbers = tabs
      .filter(tab => tab.id !== 1)
      .map(tab => {
        const match = tab.name.match(/Map (\d+)/);
        return match ? parseInt(match[1]) : 0;
      });

    const nextTabNumber = existingTabNumbers.length > 0
      ? Math.max(...existingTabNumbers) + 1
      : 2;

    const newTabId = Math.max(...tabs.map(tab => tab.id)) + 1;

    const newTabs = [
      ...tabs.map(tab => ({ ...tab, active: false })),
      {
        id: newTabId,
        name: `Map ${nextTabNumber}`,
        active: true,
        visualizationType: null,
        areaType: areaTypes[0],
        layerConfiguration: null,
        isEditing: false,
      }
    ];

    setTabs(newTabs);
    setActiveTab(newTabId);
    autoSaveMapConfigurations();
  };

  const deleteTab = (tabId, e) => {
    e.stopPropagation();
    if (tabId === 1) return;

    const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
    const newActiveTab = activeTab === tabId
      ? remainingTabs[remainingTabs.length - 1].id
      : activeTab;

    const newTabs = remainingTabs.map((tab) => ({
      ...tab,
      active: tab.id === newActiveTab,
    }));

    setTabs(newTabs);
    setActiveTab(newActiveTab);
    autoSaveMapConfigurations();
  };

  const saveMapConfigurations = () => {
    const mapConfigs = tabs
      .filter(tab => tab.id !== 1)
      .map((tab, index) => ({
        tab_name: tab.name,
        visualization_type: tab.visualizationType,
        area_type: tab.areaType?.value,
        layer_configuration: tab.layerConfiguration,
        order: index
        // Remove project_id reference
      }));
  
    try {
      // Use local storage instead of API call
      localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(mapConfigs));
      alert('Map configurations saved successfully');
    } catch (error) {
      console.error('Failed to save map configurations', error);
      alert('Failed to save map configurations');
    }
  };
  
  const loadMapConfigurations = async (key = MANUAL_SAVE_KEY, showAlert = true) => {
    try {
      // Use local storage instead of API call
      const storedConfigs = localStorage.getItem(key);
      const mapConfigs = storedConfigs ? JSON.parse(storedConfigs) : [];
  
      const newTabs = [{
        id: 1,
        name: "Core Map",
        active: true,
        visualizationType: null,
        areaType: areaTypes[0],
        layerConfiguration: null,
        isEditing: false
      }];
  
      mapConfigs.forEach((config, index) => {
        const newTabId = Math.max(...newTabs.map(tab => tab.id)) + 1;
        const areaType = areaTypes.find(type => type.value === config.area_type) || areaTypes[0];
  
        newTabs.push({
          id: newTabId,
          name: config.tab_name,
          active: false,
          visualizationType: config.visualization_type,
          areaType: areaType,
          layerConfiguration: config.layer_configuration,
          isEditing: false
        });
      });
  
      setTabs(newTabs);
      setActiveTab(1);
  
      return true;
    } catch (error) {
      console.error('Failed to load map configurations:', error);
      if (showAlert) {
        alert('Failed to load map configurations');
      }
      return false;
    }
  };

  const autoSaveMapConfigurations = () => {
    const mapConfigs = tabs
      .filter(tab => tab.id !== 1)
      .map((tab, index) => ({
        tab_name: tab.name,
        visualization_type: tab.visualizationType,
        area_type: tab.areaType?.value,
        layer_configuration: tab.layerConfiguration,
        order: index
      }));

    try {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(mapConfigs));
    } catch (error) {
      console.error('Failed to auto-save map configurations', error);
    }
  };

  // Add these useEffects after your existing ones
  useEffect(() => {
    // Load auto-saved configurations on mount
    loadMapConfigurations(AUTO_SAVE_KEY, false);
  }, []);

  useEffect(() => {
    // Auto-save whenever tabs change
    if (tabs.length > 1) {
      autoSaveMapConfigurations();
    }
  }, [tabs]);

  // Update handleLayerConfigChange to save to the specific tab
  const handleLayerConfigChange = (newConfig) => {
    const newTabs = tabs.map((tab) =>
      tab.id === activeTab && tab.visualizationType
        ? {
          ...tab,
          layerConfiguration: newConfig
        }
        : tab
    );
    setTabs(newTabs);
    updateVisualizationLayer(tabs.find(tab => tab.id === activeTab)?.visualizationType, newConfig);
    autoSaveMapConfigurations();
  };
  // Handler for configuration previews
  const handleConfigPreview = (previewConfig) => {
    if (!mapView?.map) return;

    // Remove existing visualization layers
    const layersToRemove = [];
    mapView.map.layers.forEach((layer) => {
      if (layer?.isVisualizationLayer) {
        layersToRemove.push(layer);
      }
    });
    layersToRemove.forEach((layer) => mapView.map.remove(layer));

    // Create new layer with preview config
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    if (activeTabData?.visualizationType) {
      const newLayer = createLayers(
        activeTabData.visualizationType,
        previewConfig,
        initialLayerConfigurations,
        selectedAreaType  // Explicitly pass selectedAreaType
      );
      if (newLayer) {
        newLayer.isVisualizationLayer = true;
        mapView.map.add(newLayer, 0);
      }
    }
  };

  // Add these useEffects after your existing ones
  useEffect(() => {
    // Load auto-saved configurations on mount
    loadMapConfigurations(AUTO_SAVE_KEY, false);
  }, []);

  useEffect(() => {
    // Auto-save whenever tabs change
    if (tabs.length > 1) {
      autoSaveMapConfigurations();
    }
  }, [tabs]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Tabs and New Map button on the left */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-2 overflow-x-auto">
              {tabs.map((tab) => (
                <div key={tab.id} className="flex items-center">
                  <div
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none transition-colors cursor-pointer ${tab.active
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
                          <>
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
                            <div
                              onClick={(e) => deleteTab(tab.id, e)}
                              className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                              title="Delete map"
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
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={addNewTab}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-colors duration-200 ease-in-out"
              >
                + New Map
              </button>
            </div>
          </div>

          {/* Dropdowns and Save/Load buttons on the right */}
          <div className="flex items-center space-x-2">
            {activeTab !== 1 && (
              <>
                <select
                  value={
                    tabs.find((tab) => tab.id === activeTab)?.areaType?.value ||
                    areaTypes[0].value
                  }
                  onChange={(e) => {
                    const newAreaType = areaTypes.find(
                      type => type.value === parseInt(e.target.value)
                    );
                    handleAreaTypeChange(activeTab, newAreaType);
                  }}
                  className="block w-36 rounded-md border border-gray-300 dark:border-gray-600 
                      bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
                      text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
                      focus:ring-blue-500 focus:border-blue-500"
                >
                  {areaTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={
                    tabs.find((tab) => tab.id === activeTab)?.visualizationType || ""
                  }
                  onChange={(e) => handleVisualizationChange(activeTab, e.target.value)}
                  className="block w-48 rounded-md border border-gray-300 dark:border-gray-600 
                      bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
                      text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
                      focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select visualization</option>
                  {visualizationOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
                  <button
                    onClick={() => setIsEditorOpen(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
                         dark:hover:text-gray-300 focus:outline-none"
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
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full">
            <ZoomAlert />
          </div>
        </div>

        <div className="relative">
          {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
            <div
              className={`
                w-[500px] bg-white dark:bg-gray-800 border-l border-gray-200 
                dark:border-gray-700 transform transition-all duration-300 ease-in-out
                absolute top-0 right-0 h-full
                ${isEditorOpen ? 'translate-x-0' : 'translate-x-full'}
              `}
            >
              <LayerPropertiesEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                visualizationType={
                  tabs.find((tab) => tab.id === activeTab)?.visualizationType
                }
                layerConfig={
                  tabs.find((tab) => tab.id === activeTab)?.layerConfiguration ||
                  (tabs.find((tab) => tab.id === activeTab)?.visualizationType
                    ? initialLayerConfigurations[tabs.find((tab) => tab.id === activeTab).visualizationType]
                    : null)
                }
                onConfigChange={handleLayerConfigChange}
                onPreview={handleConfigPreview}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
