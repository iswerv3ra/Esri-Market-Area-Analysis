// src/components/map/Map.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { Tag } from "lucide-react";
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Zoom from "@arcgis/core/widgets/Zoom"; // Keep if used directly
import Home from "@arcgis/core/widgets/Home";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import Legend from "@arcgis/core/widgets/Legend";
import Extent from "@arcgis/core/geometry/Extent"; // Keep for drawing zoom
// Import ArcGIS types needed for handlers/state if not solely used in utils
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";

// Import contexts and services
import { useMap } from "../../contexts/MapContext"; // Adjust path
import { mapConfigurationsAPI } from "../../services/api"; // Adjust path

// Import other UI components
import LayerPropertiesEditor from "./LayerPropertiesEditor";
import PropTypes from "prop-types";
import axios from "axios"; // Keep if used for non-ArcGIS calls
import SearchableDropdown from "./SearchableDropdown";
import NewMapDialog from "./NewMapDialog";
import CustomLegend from "./CustomLegend";
import ZoomAlert from "./ZoomAlert"; // Import the new component

// Import routing
import { useNavigate, useParams } from "react-router-dom";

// Import refactored utilities and configurations
import {
  initialLayerConfigurations, // Base configurations
  visualizationOptions, // Dropdown options
  areaTypes,
  createClassBreaks, // Area type definitions
} from "./mapConfig";
import {
  createLayers, // Main factory function
  createPipeLayer, // Explicitly import the pipe layer creator
  createCompLayer, // Explicitly import the comp layer creator
  createGraphicsLayerFromCustomData, // Explicitly import the custom data creator
} from "./mapLayerUtils";

import { initializeLabelLayerManager } from "./LabelLayerManager"; // Replace UniversalLabelManager import

// Replace the hardcoded API_KEY with the environment variable
const API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

export default function MapComponent({ onToggleLis }) {
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isNewMapDialogOpen, setIsNewMapDialogOpen] = useState(false);
  const mapRef = useRef(null);
  const { setMapView, mapView } = useMap();
  const initCompleteRef = useRef(false);
  const layersRef = useRef({});
  const [legend, setLegend] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const localStorageProjectId = localStorage.getItem("currentProjectId");
  const sessionStorageProjectId = sessionStorage.getItem("currentProjectId");
  const [isSaving, setIsSaving] = useState(false);
  const [customLegendContent, setCustomLegendContent] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawEndPoint, setDrawEndPoint] = useState(null);
  const rectangleRef = useRef(null);
  // Add these refs to store values for event handlers
  const isDrawingRef = useRef(false);
  const drawStartPointRef = useRef(null);
  const drawEndPointRef = useRef(null);
  const activeLayersRef = useRef({});
  const labelManagerRef = useRef(null);
  // Add this near your other state declarations
  const [isLabelEditMode, setIsLabelEditMode] = useState(false);
  // Use the first available project ID
  const projectId =
    routeProjectId || localStorageProjectId || sessionStorageProjectId;

  const renderCustomLegend = () => {
    // Only show if we have active special visualization type with valid config
    if (!customLegendContent || !customLegendContent.config) {
      return null;
    }

    // Return a single div that contains the legend
    return (
      <div className="absolute bottom-4 left-4 z-10">
        <CustomLegend
          type={customLegendContent.type}
          config={customLegendContent.config}
        />
      </div>
    );
  };

  useEffect(() => {
    if (!projectId) {
      console.error("No project ID available");
      navigate("/projects");
      return;
    }

    // Store projectId in all locations to ensure consistency
    localStorage.setItem("currentProjectId", projectId);
    sessionStorage.setItem("currentProjectId", projectId);
  }, [projectId, navigate]);

  // Ref for tracking mouse wheel scroll state
  const scrollStateRef = useRef({
    lastScrollTime: 0,
    scrollStreak: 0,
    lastScrollDirection: 0, // 1 for zoom in, -1 for zoom out, 0 for reset
    timeoutId: null,
  });

  // Modify storage keys to use a static default
  const AUTO_SAVE_KEY = "autoSavedMapConfigurations_default";
  const MANUAL_SAVE_KEY = "mapConfigurations_default";

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
          { min: 200000 },
        ],
        [
          "Less than $35,000",
          "$35,000 - $65,000",
          "$65,000 - $95,000",
          "$95,000 - $125,000",
          "$125,000 - $155,000",
          "$155,000 - $200,000",
          "$200,000 or more",
        ]
      ),
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
          { min: 2 },
        ],
        [
          "Less than -3%",
          "-3% to -2%",
          "-2% to -1%",
          "-1% to 0%",
          "0% to 1%",
          "1% to 2%",
          "2% or more",
        ]
      ),
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
          { min: 15000 },
        ],
        [
          "Less than 1,000",
          "1,000 - 2,500",
          "2,500 - 5,000",
          "5,000 - 7,500",
          "7,500 - 10,000",
          "10,000 - 15,000",
          "15,000 or more",
        ]
      ),
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
          { min: 55 },
        ],
        [
          "Less than 30 years",
          "30 - 35 years",
          "35 - 40 years",
          "40 - 45 years",
          "45 - 50 years",
          "50 - 55 years",
          "55 years or more",
        ]
      ),
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
          { min: 13 },
        ],
        [
          "Less than 3%",
          "3% - 5%",
          "5% - 7%",
          "7% - 9%",
          "9% - 11%",
          "11% - 13%",
          "13% or more",
        ]
      ),
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
          { min: 1500000 },
        ],
        [
          "Less than $200,000",
          "$200,000 - $350,000",
          "$350,000 - $500,000",
          "$500,000 - $750,000",
          "$750,000 - $1,000,000",
          "$1,000,000 - $1,500,000",
          "$1,500,000 or more",
        ]
      ),
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
          { min: 175 },
        ],
        [
          "Less than 50",
          "50 - 75",
          "75 - 100",
          "100 - 125",
          "125 - 150",
          "150 - 175",
          "175 or more",
        ]
      ),
    },
  });

  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: "Core Map",
      active: true,
      visualizationType: null,
      areaType: areaTypes[0],
      layerConfiguration: null,
    },
  ]);
  const [activeTab, setActiveTab] = useState(1);
  const [visualizationType, setVisualizationType] = useState(null);

  const sidebarWidth = 350; // Your standard sidebar width
  const padding = 20; // Additional padding

  const initializeDrawingTools = (view) => {
    // Create rectangle element if it doesn't exist
    if (!rectangleRef.current) {
      const rect = document.createElement("div");
      rect.className = "draw-rectangle";
      rect.style.position = "absolute";
      rect.style.border = "2px dashed #0078fa";
      rect.style.backgroundColor = "rgba(0, 120, 250, 0.1)";
      rect.style.pointerEvents = "none";
      rect.style.display = "none";
      rect.style.zIndex = "100";

      if (mapRef.current) {
        mapRef.current.appendChild(rect);
        rectangleRef.current = rect;
      } else {
        console.error("Map container ref is not available");
        return;
      }
    }

    // Store event handlers for proper cleanup
    const handlers = {
      mousedown: (e) => {
        // Right mouse button only
        if (e.button !== 2 || isDrawingRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const startPoint = { x: e.offsetX, y: e.offsetY };

        // Update state
        isDrawingRef.current = true;
        drawStartPointRef.current = startPoint;
        drawEndPointRef.current = startPoint;

        setIsDrawing(true);
        setDrawStartPoint(startPoint);
        setDrawEndPoint(startPoint);

        // Show rectangle
        const rect = rectangleRef.current;
        if (rect) {
          rect.style.left = `${startPoint.x}px`;
          rect.style.top = `${startPoint.y}px`;
          rect.style.width = "0px";
          rect.style.height = "0px";
          rect.style.display = "block";
        }
      },

      contextmenu: (e) => {
        e.preventDefault();
      },

      mousemove: (e) => {
        if (!isDrawingRef.current || !drawStartPointRef.current) return;

        const currentPoint = { x: e.offsetX, y: e.offsetY };
        drawEndPointRef.current = currentPoint;
        setDrawEndPoint(currentPoint);

        // Update rectangle
        const rect = rectangleRef.current;
        if (rect) {
          const start = drawStartPointRef.current;
          const left = Math.min(start.x, currentPoint.x);
          const top = Math.min(start.y, currentPoint.y);
          const width = Math.abs(currentPoint.x - start.x);
          const height = Math.abs(currentPoint.y - start.y);

          rect.style.left = `${left}px`;
          rect.style.top = `${top}px`;
          rect.style.width = `${width}px`;
          rect.style.height = `${height}px`;
        }
      },

      mouseup: async (e) => {
        // Only handle right button
        if (e.button !== 2) return;

        e.preventDefault();
        e.stopPropagation();

        // Get state before resetting
        const wasDrawing = isDrawingRef.current;
        const startPoint = drawStartPointRef.current;

        // Reset state
        isDrawingRef.current = false;
        drawStartPointRef.current = null;
        drawEndPointRef.current = null;
        setIsDrawing(false);
        setDrawStartPoint(null);
        setDrawEndPoint(null);

        // Hide rectangle
        if (rectangleRef.current) {
          rectangleRef.current.style.display = "none";
        }

        // Skip if not drawing or no start point
        if (!wasDrawing || !startPoint) return;

        const endPoint = { x: e.offsetX, y: e.offsetY };

        // Validate drag size
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        const minDragSize = 10;

        if (width < minDragSize || height < minDragSize) return;

        try {
          // Load Extent class
          const { default: Extent } = await import(
            "@arcgis/core/geometry/Extent"
          );

          // Calculate screen and map coordinates
          const screenTopLeft = {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y),
          };
          const screenBottomRight = {
            x: Math.max(startPoint.x, endPoint.x),
            y: Math.max(startPoint.y, endPoint.y),
          };

          // Convert to map coordinates
          const mapTopLeft = view.toMap(screenTopLeft);
          const mapBottomRight = view.toMap(screenBottomRight);

          if (!mapTopLeft || !mapBottomRight) return;

          // Validate coordinates
          if (
            isNaN(mapTopLeft.x) ||
            isNaN(mapTopLeft.y) ||
            isNaN(mapBottomRight.x) ||
            isNaN(mapBottomRight.y)
          ) {
            return;
          }

          // Create extent for zoom
          const targetExtent = new Extent({
            xmin: Math.min(mapTopLeft.x, mapBottomRight.x),
            ymin: Math.min(mapTopLeft.y, mapBottomRight.y),
            xmax: Math.max(mapTopLeft.x, mapBottomRight.x),
            ymax: Math.max(mapTopLeft.y, mapBottomRight.y),
            spatialReference: view.spatialReference,
          });

          // Perform zoom
          console.log("Zooming to extent:", targetExtent.toJSON());

          // Cancel any pending animations first
          if (view.goTo.cancelable) {
            view.goTo.cancel();
          }

          await view.goTo(targetExtent, { animate: false });

          // Apply padding trick to force redraw
          requestAnimationFrame(() => {
            if (view) {
              const originalPadding = JSON.parse(
                JSON.stringify(
                  view.padding || { top: 0, right: 0, bottom: 0, left: 0 }
                )
              );
              view.padding = {
                ...originalPadding,
                bottom: (originalPadding.bottom || 0) + 1,
              };
              requestAnimationFrame(() => {
                if (view) view.padding = originalPadding;
              });
            }
          });
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Error during zoom:", error);
          }
        }
      },

      mouseleave: () => {
        if (isDrawingRef.current) {
          // Reset state
          isDrawingRef.current = false;
          drawStartPointRef.current = null;
          drawEndPointRef.current = null;
          setIsDrawing(false);
          setDrawStartPoint(null);
          setDrawEndPoint(null);

          // Hide rectangle
          if (rectangleRef.current) {
            rectangleRef.current.style.display = "none";
          }
        }
      },
    };

    // Add event listeners
    view.container.addEventListener("mousedown", handlers.mousedown);
    view.container.addEventListener("contextmenu", handlers.contextmenu);
    view.container.addEventListener("mousemove", handlers.mousemove);
    view.container.addEventListener("mouseup", handlers.mouseup);
    view.container.addEventListener("mouseleave", handlers.mouseleave);

    // Store handlers for cleanup
    view.drawingHandlers = handlers;
  };

  /**
   * Handles pipe visualization with advanced label management
   * @param {Object} tabData - The tab data containing the tab ID and other properties
   * @param {Object} layer - Optional direct layer reference for visualization
   * @returns {Promise<void>}
   */
  const handlePipeVisualization = async (tabData, layer = null) => {
    const tabId = tabData?.id;
    let targetLayer = null;

    console.log(
      `[handlePipeVisualization] Handling visualization for tab ${tabId}. Direct layer passed: ${!!layer}`
    );

    // Priority 1: Check layer reference first (most reliable)
    if (activeLayersRef.current[tabId]) {
      targetLayer = activeLayersRef.current[tabId];
      console.log(
        `[handlePipeVisualization] Found layer in ref for tab ${tabId}:`,
        targetLayer.id
      );
    }
    // Priority 2: Use directly passed layer parameter
    else if (layer) {
      targetLayer = layer;
      console.log(
        `[handlePipeVisualization] Using directly passed layer for tab ${tabId}:`,
        targetLayer.id
      );
    }
    // Priority 3: Fallback to map search (least reliable)
    else {
      console.warn(
        `[handlePipeVisualization] Layer not in ref or passed directly for tab ${tabId}. Attempting map find...`
      );
      targetLayer = mapView?.map?.layers.find(
        (l) =>
          l &&
          l.isVisualizationLayer === true &&
          l.visualizationType === "pipe" &&
          l instanceof GraphicsLayer
      );

      if (targetLayer) {
        console.log(
          `[handlePipeVisualization] Found target layer ID: ${targetLayer.id}`
        );
      } else {
        console.error(
          `[handlePipeVisualization] FAILED TO FIND TARGET LAYER for tab ${tabId}`
        );
        return; // Prevent further errors
      }
    }

    console.log(
      `[handlePipeVisualization] Using final target Pipe layer: "${targetLayer.title}" (ID: ${targetLayer.id})`
    );

    // Apply specialized label settings for pipe visualization
    if (labelManagerRef.current) {
      // Configure label settings using the unified API
      labelManagerRef.current.configureLayerSettings("pipe");
      console.log(
        "[handlePipeVisualization] Applied pipe-specific label settings"
      );
    }

    // Additional pipe visualization logic can be added here
  };
/**
 * Handles composite visualization with advanced label management
 * @param {Object} tabData - The tab data containing the tab ID and other properties
 * @param {Object} layer - Optional direct layer reference for visualization
 * @returns {Promise<void>}
 */
const handleCompVisualization = async (tabData, layer = null) => {
  const tabId = tabData?.id;
  console.log(
    `[handleCompVisualization] Finding and zooming to Comp Map layer for tab: ${tabId}`
  );

  if (!mapView?.map) {
    console.warn("[handleCompVisualization] Map view not available.");
    return;
  }

  if (!tabData) {
    console.warn("[handleCompVisualization] Missing tabData.");
    return;
  }

  try {
    // Find the layer using different methods in priority order
    let compLayer = null;
    
    // Priority 1: Use directly passed layer parameter (most reliable)
    if (layer) {
      compLayer = layer;
      console.log(`[handleCompVisualization] Using directly passed layer for tab ${tabId}:`, compLayer.id);
    }
    // Priority 2: Check stored reference in activeLayersRef
    else if (activeLayersRef.current[tabId]) {
      compLayer = activeLayersRef.current[tabId];
      console.log(`[handleCompVisualization] Found layer in ref for tab ${tabId}:`, compLayer.id);
    }
    // Priority 3: Find by visualization type attribute (least reliable)
    else {
      compLayer = mapView.map.layers.find(
        (l) =>
          l &&
          l.isVisualizationLayer === true &&
          l.visualizationType === "comp" &&
          (l instanceof GraphicsLayer || l.type === "graphics")
      );

      if (compLayer) {
        console.log(`[handleCompVisualization] Found target Comp layer: "${compLayer.title}"`);
        // Store in ref for future use
        activeLayersRef.current[tabId] = compLayer;
      } else {
        console.error(`[handleCompVisualization] No comp layer found for tab ${tabId}`);
        return; // Prevent further errors
      }
    }

    // Get the layer configuration for labels
    const layerConfig = tabData.layerConfiguration || {};
    const labelOptions = layerConfig.labelOptions || {};

    // Apply specialized settings for comp map visualization
    if (labelManagerRef.current) {
      try {
        // Configure label settings using the unified API
        labelManagerRef.current.configureLayerSettings("comp");
        console.log(`[handleCompVisualization] Applied comp-specific label settings`);

        // Force a scan of this specific layer for labels
        if (typeof labelManagerRef.current._findAndIntegrateExistingLabels === "function") {
          setTimeout(() => {
            // Mark the layer to prevent removal during state updates
            if (compLayer) {
              compLayer._preventRemoval = true;
              compLayer._isProcessed = true;
            }
            
            console.log(`[handleCompVisualization] Scanning comp layer for labels`);
            labelManagerRef.current._findAndIntegrateExistingLabels(compLayer);

            // Force a refresh after a short delay
            setTimeout(() => {
              if (labelManagerRef.current && typeof labelManagerRef.current.refreshLabels === "function") {
                labelManagerRef.current.refreshLabels();
                console.log(`[handleCompVisualization] Refreshed labels for comp layer`);
              }
            }, 200);
          }, 100);
        }

        // Apply any custom label settings from the configuration
        if (labelOptions && typeof labelManagerRef.current.updateOptions === "function") {
          const labelSettings = {
            fontSize: labelOptions.fontSize || 10,
            includeVariables: labelOptions.includeVariables !== false,
            avoidCollisions: labelOptions.avoidCollisions !== false,
            visibleAtAllZooms: !!labelOptions.visibleAtAllZooms,
            minZoom: labelOptions.minZoom || 8,
            maxLabelsVisible: labelOptions.maxLabelsVisible || 60,
          };
          
          labelManagerRef.current.updateOptions(labelSettings);
          console.log(`[handleCompVisualization] Applied custom label settings:`, labelSettings);
        }
      } catch (labelError) {
        console.error(`[handleCompVisualization] Error configuring labels:`, labelError);
      }
    } else {
      console.warn(`[handleCompVisualization] Label manager not available for comp layer`);
    }

    // Ensure the layer is visible and protected from automatic removal
    if (compLayer) {
      compLayer.visible = true;
      compLayer._preventRemoval = true; // Add protection flag
      
      // Set a flag on the layer to prevent duplicate processing
      if (!compLayer._processedByCompVisualization) {
        compLayer._processedByCompVisualization = true;
        console.log(`[handleCompVisualization] Marked comp layer as processed to prevent duplicate handling`);
      }
    }

    // ENHANCEMENT: Set a flag to skip the next layer removal attempt
    // This will be checked in updateVisualizationLayer before removing layers
    window._skipNextLayerRemoval = true;
    console.log(`[handleCompVisualization] Set flag to skip next automatic layer removal`);
    
    setTimeout(() => {
      window._skipNextLayerRemoval = false; // Reset after a delay
    }, 1000);

  } catch (error) {
    console.error("[handleCompVisualization] Error during comp visualization handling:", error);
  }
};

  /**
   * Toggles label editing mode and handles related state updates
   */
  const toggleLabelEditMode = () => {
    // If we're already in the editor, just switch modes
    if (isEditorOpen) {
      setIsLabelEditMode(!isLabelEditMode);
      return;
    }

    // Otherwise, open the editor and set label edit mode
    setIsEditorOpen(true);
    setIsLabelEditMode(true);

    // Configure label manager for editing if available
    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.toggleEditingMode === "function"
    ) {
      const isEditingEnabled = labelManagerRef.current.toggleEditingMode();
      console.log(
        `[MapComponent] Label editing mode ${
          isEditingEnabled ? "enabled" : "disabled"
        }`
      );
    }
  };

  const handleCustomDataVisualization = async (tabData) => {
    console.log("Attempting to visualize Custom Data Map with data:", tabData);
  
    if (!mapView?.map) {
      console.warn("Map view not available for custom data visualization.");
      return;
    }
    if (!tabData || !tabData.layerConfiguration) {
      console.warn(
        "Custom data visualization cancelled: Missing tabData or layerConfiguration."
      );
      return;
    }
  
    // Find the GraphicsLayer for 'custom' visualization
    const customLayer = mapView.map.layers.find(
      (l) =>
        l && l.isVisualizationLayer === true && l.visualizationType === "custom"
    );
  
    if (!customLayer) {
      console.error(
        "Custom Data GraphicsLayer not found on the map. Cannot update graphics."
      );
      return;
    }
    console.log(`Found target Custom Data layer: "${customLayer.title}"`);
  
    // Always clear existing graphics to ensure a fresh start
    customLayer.removeAll();
    console.log(`Cleared existing graphics from layer "${customLayer.title}".`);
  
    // Extract configuration data
    const config = tabData.layerConfiguration;
    const customData = config?.customData?.data || []; // Get data array
    const nameColumn = config?.customData?.nameColumn; // Column for popup title
    const valueColumn = config?.field || config?.customData?.valueColumn; // Use field or valueColumn
    const latitudeColumn = config?.customData?.latitudeColumn || "latitude";
    const longitudeColumn = config?.customData?.longitudeColumn || "longitude";
    const symbolConfig = config?.symbol;
  
    console.log(
      `Processing ${
        customData.length
      } custom points using name='${nameColumn}', value='${
        valueColumn || "N/A"
      }', lat='${latitudeColumn}', lon='${longitudeColumn}'`
    );
  
    if (!Array.isArray(customData) || customData.length === 0) {
      console.log("No custom data points found for visualization.");
      return;
    }
  
    try {
      // Ensure required modules are imported
      const [
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol },
        { default: PopupTemplate },
        { default: Color },
      ] = await Promise.all([
        import("@arcgis/core/Graphic"),
        import("@arcgis/core/geometry/Point"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol"),
        import("@arcgis/core/PopupTemplate"),
        import("@arcgis/core/Color"),
      ]);
  
      // Create popup template
      const popupTemplate = nameColumn
        ? new PopupTemplate({
            title: `{${nameColumn}}`,
            content: [
              {
                type: "fields",
                fieldInfos: [
                  { fieldName: nameColumn, label: nameColumn },
                  { fieldName: valueColumn, label: valueColumn || "Value" },
                ],
              },
            ],
          })
        : null;
  
      // Create symbol from config
      let pointSymbol = null;
      if (symbolConfig) {
        try {
          if (symbolConfig.type === "simple-marker") {
            pointSymbol = new SimpleMarkerSymbol({
              style: symbolConfig.style || "circle",
              color: new Color(symbolConfig.color || "#FF0000"), // Default red for custom
              size: symbolConfig.size || "10px",
              outline: symbolConfig.outline
                ? {
                    color: new Color(symbolConfig.outline.color || "#FFFFFF"),
                    width: symbolConfig.outline.width || 1,
                  }
                : null,
            });
          } else {
            pointSymbol = new SimpleMarkerSymbol({
              color: "#FF0000",
              size: "10px",
            });
          }
        } catch (symbolError) {
          console.error(
            "Error creating symbol from config:",
            symbolError,
            "Using default."
          );
          pointSymbol = new SimpleMarkerSymbol({
            color: "#FF0000",
            size: "10px",
          });
        }
      } else {
        pointSymbol = new SimpleMarkerSymbol({
          color: "#FF0000",
          size: "10px",
        });
      }
  
      // Create and add graphics
      const graphicsToAdd = [];
      let addedCount = 0;
      let errorCount = 0;
  
      customData.forEach((item, index) => {
        // Get coordinates
        let latitude, longitude;
        if (
          item[latitudeColumn] !== undefined &&
          item[longitudeColumn] !== undefined
        ) {
          latitude = parseFloat(item[latitudeColumn]);
          longitude = parseFloat(item[longitudeColumn]);
        } else if (
          item.geometry &&
          typeof item.geometry.y === "number" &&
          typeof item.geometry.x === "number"
        ) {
          latitude = item.geometry.y;
          longitude = item.geometry.x;
        } else if (
          typeof item["lat"] === "number" &&
          typeof item["lon"] === "number"
        ) {
          latitude = item["lat"];
          longitude = item["lon"];
        } else {
          console.warn(
            `Skipping custom item ${index} - missing valid coordinates`
          );
          errorCount++;
          return;
        }
  
        if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Skipping custom item ${index} - invalid coordinates`);
          errorCount++;
          return;
        }
  
        try {
          const point = new Point({
            longitude: longitude,
            latitude: latitude,
            spatialReference: { wkid: 4326 },
          });
  
          const attributes = {
            ...item,
            _internalId: `custom-${index}`,
            // Add these attributes to help with label creation
            isCustomPoint: true,
            labelText: item[nameColumn] || item.name || item.title || String(index + 1),
          };
          if (nameColumn) attributes[nameColumn] = item[nameColumn] ?? "N/A";
          if (valueColumn) attributes[valueColumn] = item[valueColumn] ?? null;
  
          const graphic = new Graphic({
            geometry: point,
            symbol: pointSymbol,
            attributes: attributes,
            popupTemplate: popupTemplate,
          });
  
          graphicsToAdd.push(graphic);
          addedCount++;
        } catch (graphicError) {
          console.error(
            `Error creating graphic for custom item ${index}:`,
            graphicError
          );
          errorCount++;
        }
      });
  
      // *** CRITICAL FIX: Actually add the graphics to the layer! ***
      if (graphicsToAdd.length > 0) {
        customLayer.addMany(graphicsToAdd);
        console.log(`Added ${graphicsToAdd.length} graphics to custom layer`);
        
        // Force label creation after adding points
        if (labelManagerRef.current) {
          setTimeout(() => {
            try {
              console.log("Triggering label creation for new graphics...");
              labelManagerRef.current._findAndIntegrateExistingLabels(customLayer);
              
              // Force refresh all labels after a delay to ensure they appear
              setTimeout(() => {
                if (labelManagerRef.current.refreshLabels) {
                  labelManagerRef.current.refreshLabels();
                  console.log(`Refreshed labels for custom layer`);
                }
              }, 500);
            } catch (err) {
              console.error("Error creating labels for custom layer:", err);
            }
          }, 100);
        }
      } else {
        console.warn("No valid graphics were created to add to the custom layer");
      }
      
      console.log(`Custom visualization complete: Added ${addedCount} points, ${errorCount} errors`);
    } catch (error) {
      console.error("Error during custom data visualization:", error);
    }
  };

  /**
   * Enhanced updateVisualizationLayer function with improved label integration
   *
   * @returns {Promise<void>}
   */
  const updateVisualizationLayer = async () => {
    if (!mapView?.map || isConfigLoading) {
      console.log(
        "Map not ready or configs still loading, skipping visualization update"
      );
      return;
    }

    try {
      // --- Layer Removal ---
      const layersToRemove = [];
      if (!window._skipNextLayerRemoval) { // Check for the protection flag
        mapView.map.layers.forEach((layer) => {
          if (layer && layer.isVisualizationLayer === true && !layer._preventRemoval) {
            layersToRemove.push(layer);
          }
        });
      
        if (layersToRemove.length > 0) {
          console.log(`Removing ${layersToRemove.length} existing visualization layers.`);
          mapView.map.removeMany(layersToRemove);
        }
      } else {
        console.log(`Skipping visualization layer removal due to protection flag`);
        window._skipNextLayerRemoval = false; // Reset the flag
      }

      // Find the active tab and its visualization type
      const activeTabData = tabs.find((tab) => tab.id === activeTab);

      // Only add new layer if we're not in the core map and have a selected type
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        // --- Normalize visualizationType ---
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") {
          console.log("Mapping 'pipeline' type to 'pipe'");
          vizType = "pipe";
        }
        if (vizType === "comps") vizType = "comp";
        // --- End Normalization ---

        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;
        console.log(`Creating/Updating visualization for: ${vizType}`, {
          config,
          areaType: areaType?.label,
        });

        // --- Extract label options from configuration ---
        const labelOptions = config?.labelOptions || {};
        console.log(`Extracted label options for ${vizType}:`, labelOptions);

        // --- Type-Specific Handling using proper imports ---
        let newLayer = null;
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(vizType);

        if (isSpecialType) {
          if (vizType === "pipe") {
            // Make sure createPipeLayer is imported at the top
            newLayer = await createPipeLayer(config);
          } else if (vizType === "comp") {
            // Make sure createCompLayer is imported at the top
            newLayer = await createCompLayer(config);
          } else if (vizType === "custom") {
            // Make sure createGraphicsLayerFromCustomData is imported at the top
            newLayer = await createGraphicsLayerFromCustomData(config);
          }

          if (newLayer) {
            // Ensure properties are properly set
            newLayer.isVisualizationLayer = true;
            newLayer.visualizationType = vizType;

            console.log(
              `Adding GraphicsLayer titled "${newLayer.title}" for type "${vizType}"`
            );
            mapView.map.add(newLayer, 0);

            // Store reference to layer
            activeLayersRef.current[activeTab] = newLayer;

            // --- Enhanced Label Management Integration ---
            if (labelManagerRef.current) {
              try {
                // Configure label manager for this specific layer type with the provided options
                if (
                  typeof labelManagerRef.current.configureLayerSettings ===
                  "function"
                ) {
                  labelManagerRef.current.configureLayerSettings(vizType);
                }

                // Scan this layer specifically for labels
                if (
                  typeof labelManagerRef.current
                    ._findAndIntegrateExistingLabels === "function"
                ) {
                  setTimeout(() => {
                    labelManagerRef.current._findAndIntegrateExistingLabels(
                      newLayer
                    );

                    // Force a refresh of all labels after label integration
                    setTimeout(() => {
                      if (
                        typeof labelManagerRef.current.refreshLabels ===
                        "function"
                      ) {
                        labelManagerRef.current.refreshLabels();
                        console.log(
                          `[updateVisualizationLayer] Refreshed labels for ${vizType} layer`
                        );
                      }
                    }, 500);
                  }, 200);
                }

                console.log(
                  `[updateVisualizationLayer] Configured label manager for ${vizType}`
                );
              } catch (labelError) {
                console.error(
                  `[updateVisualizationLayer] Error setting up labels for ${vizType}:`,
                  labelError
                );
              }
            } else {
              console.warn(
                `[updateVisualizationLayer] Label manager not available for ${vizType}`
              );
            }
            // --- End Enhanced Label Management ---

            // Call specific handlers
            if (vizType === "pipe")
              await handlePipeVisualization(activeTabData, newLayer);
            else if (vizType === "comp")
              await handleCompVisualization(activeTabData, newLayer);
            else if (vizType === "custom")
              await handleCustomDataVisualization(activeTabData, newLayer);
          } else {
            console.error(
              `Failed to create GraphicsLayer for type: ${vizType}`
            );
          }
        } else {
          // Standard Heatmap/Dot Density use FeatureLayer through createLayers
          // Make sure createLayers is imported at the top
          newLayer = await createLayers(
            vizType,
            config,
            initialLayerConfigurations,
            areaType
          );

          if (newLayer) {
            console.log(
              `Adding FeatureLayer titled "${newLayer.title}" for type "${vizType}"`
            );
            mapView.map.add(newLayer, 0);

            // Store reference to layer
            activeLayersRef.current[activeTab] = newLayer;
          } else {
            console.error(`Failed to create FeatureLayer for type: ${vizType}`);
          }
        }
        // --- End Type-Specific Handling ---

        // Update Legend for the newly added layer
        if (newLayer && legend) {
          try {
            await newLayer.when();
            console.log(
              "Updating legend for layer:",
              newLayer.title || vizType
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen;
          } catch (layerError) {
            console.error(
              "Error waiting for new layer or updating legend:",
              layerError
            );
            legend.visible = false;
          }
        } else if (legend) {
          console.log(
            "Hiding legend: No new layer created or legend object missing."
          );
          legend.visible = false;
        }
      } else {
        // Hide legend if no visualization
        if (legend) {
          console.log(
            "Hiding legend: Core Map active or no visualization type selected."
          );
          legend.visible = false;
        }
      }
    } catch (error) {
      console.error("Error updating visualization layer:", error);
      if (legend) {
        legend.visible = false;
      }
    }
  };

  /**
   * Handle switching between tabs, including proper layer management and label persistence
   *
   * @param {number|string} tabId - The ID of the tab to switch to
   * @returns {Promise<void>}
   */
  const handleTabClick = async (tabId) => {
    console.log(`Switching to tab: ${tabId}`);

    // Update active tab state first to ensure UI responsiveness
    setActiveTab(tabId);

    // Update the tabs array state, ensuring only one tab is active and closing any editors
    const newTabs = tabs.map((tab) => ({
      ...tab,
      active: tab.id === tabId,
      isEditing: false, // Close any open editing when switching tabs
    }));
    setTabs(newTabs);

    // Get the selected tab data from our newly updated tabs array
    const selectedTab = newTabs.find((tab) => tab.id === tabId);
    if (!selectedTab) {
      console.error(`Could not find tab data for ID: ${tabId}`);
      return;
    }

    // Verify the map is ready
    if (!mapView?.map) {
      console.warn("Map view not ready during tab click.");
      return;
    }

    // --- Important: Save any pending label edits before switching tabs ---
    if (labelManagerRef.current) {
      console.log("[TabClick] Saving label positions before switching tabs");
      try {
        // Force save to ensure nothing is lost
        const savedResult = labelManagerRef.current.savePositions(true);
        console.log("[TabClick] Label position save result:", savedResult);
      } catch (err) {
        console.error("[TabClick] Error saving label positions:", err);
      }
    }

    // --- Remove Existing Visualization Layers ---
    const layersToRemove = [];
    mapView.map.layers.forEach((layer) => {
      if (layer && layer.isVisualizationLayer === true) {
        layersToRemove.push(layer);
      }
    });

    if (layersToRemove.length > 0) {
      console.log(
        `[TabClick] Removing ${layersToRemove.length} existing visualization layers.`
      );
      mapView.map.removeMany(layersToRemove);
    }

    // --- Reset Legend ---
    if (legend) {
      legend.layerInfos = []; // Clear legend infos
      legend.visible = false; // Hide legend initially
      console.log("[TabClick] Cleared and hid legend.");
    }

    // --- Add New Layer if Applicable ---
    if (tabId !== 1 && selectedTab.visualizationType) {
      console.log(
        `[TabClick] Tab ${tabId} has visualization: ${selectedTab.visualizationType}. Creating layer.`
      );

      // Normalize visualization type
      let vizType = selectedTab.visualizationType;
      if (vizType === "pipeline") vizType = "pipe";
      if (vizType === "comps") vizType = "comp";

      try {
        // Create and add new layer for visualization tabs
        const newLayer = await createLayers(
          vizType,
          selectedTab.layerConfiguration,
          initialLayerConfigurations,
          selectedTab.areaType
        );

        if (
          !newLayer ||
          !(
            newLayer instanceof FeatureLayer ||
            newLayer instanceof GraphicsLayer
          )
        ) {
          throw new Error(
            `Failed to create layer for visualization type: ${vizType}`
          );
        }

        console.log(
          `[TabClick] Created new layer: "${newLayer.title}". Adding to map.`
        );

        // Ensure visualization properties are set
        newLayer.isVisualizationLayer = true;
        newLayer.visualizationType = vizType;

        // Add layer to map
        mapView.map.add(newLayer, 0);

        // Store reference to active layer if needed
        if (activeLayersRef?.current) {
          activeLayersRef.current[tabId] = newLayer;
          console.log(`[TabClick] Stored layer reference for tab ${tabId}`);
        }

        // --- Handle Special Layer Types ---
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(vizType);

        if (isSpecialType) {
          // Type-specific handling
          if (vizType === "pipe") {
            await handlePipeVisualization(selectedTab, newLayer);
          } else if (vizType === "comp") {
            await handleCompVisualization(selectedTab);
          } else if (vizType === "custom") {
            await handleCustomDataVisualization(selectedTab);
          }

          // Handle custom legend for special types if needed
          setCustomLegendContent({
            type: vizType,
            config: selectedTab.layerConfiguration,
          });
        }

        // --- Update Legend ---
        if (legend && !isSpecialType) {
          try {
            await newLayer.when();
            console.log(
              "[TabClick] Updating Esri legend for layer:",
              newLayer.title
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen;
          } catch (layerError) {
            console.error("[TabClick] Error setting up legend:", layerError);
            legend.visible = false;
          }
        }

        // --- Critical: Load saved label positions after layer creation ---
        if (labelManagerRef.current) {
          // Give the layer a moment to fully initialize
          setTimeout(() => {
            try {
              console.log(
                `[TabClick] Loading saved label positions for ${vizType} layer`
              );
              const loadResult = labelManagerRef.current.loadPositions(
                true,
                true
              );
              console.log(
                `[TabClick] Loaded ${
                  loadResult.count || 0
                } saved label positions`
              );

              // Configure label manager for specific visualization type
              labelManagerRef.current.configureLayerSettings(vizType);
            } catch (err) {
              console.error(
                "[TabClick] Error loading saved label positions:",
                err
              );
            }
          }, 500);
        }
      } catch (error) {
        console.error(`[TabClick] Error creating or configuring layer:`, error);
        if (legend) legend.visible = false;
        setCustomLegendContent(null);
      }
    } else {
      // Core Map or no visualization case
      console.log(
        `[TabClick] Tab ${tabId} is Core Map or has no visualization. No layer added.`
      );
      if (legend) legend.visible = false;
      setCustomLegendContent(null);
    }

    console.log(
      `[TabClick] Finished handling click for tab ${tabId}. Active tab is now ${tabId}.`
    );
  };

  const handleAreaTypeChange = async (tabId, newAreaType) => {
    // Make async
    console.log(`Area type changed for tab ${tabId} to:`, newAreaType);

    // Update the area type for the specific tab
    const newTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            areaType: newAreaType,
          }
        : tab
    );
    setTabs(newTabs);

    // Update the general selectedAreaType state if the changed tab is the active one
    if (tabId === activeTab) {
      setSelectedAreaType(newAreaType);
    }

    // --- Update visualization and legend only if the changed tab is active ---
    const activeTabData = newTabs.find((tab) => tab.id === activeTab); // Use activeTab here

    // Proceed only if the *active* tab is the one that was changed AND it has a visualization
    if (
      tabId === activeTab &&
      activeTabData?.visualizationType &&
      mapView?.map
    ) {
      console.log(
        `Updating visualization for active tab ${activeTab} due to area type change.`
      );

      let vizType = activeTabData.visualizationType;
      if (vizType === "pipeline") vizType = "pipe"; // Normalize
      if (vizType === "comps") vizType = "comp"; // Normalize

      // --- Layer Removal ---
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer);
        }
      });
      if (layersToRemove.length > 0) {
        console.log(
          `[AreaChange] Removing ${layersToRemove.length} existing visualization layers.`
        );
        mapView.map.removeMany(layersToRemove);
      }
      // --- End Layer Removal ---

      // Create the new layer with the updated area type
      const newLayer = await createLayers(
        vizType, // Use normalized type
        activeTabData.layerConfiguration, // Use the config from the tab
        initialLayerConfigurations, // Base configs
        newAreaType // Pass the NEW area type
      );

      if (
        newLayer &&
        (newLayer instanceof FeatureLayer || newLayer instanceof GraphicsLayer)
      ) {
        console.log(
          `[AreaChange] Created new layer: "${newLayer.title}". Adding to map.`
        );
        // *** Direct property assignment (already done in createLayers) ***
        newLayer.isVisualizationLayer = true;
        // newLayer.visualizationType set in createLayers

        mapView.map.add(newLayer, 0); // Add new layer

        // Update legend only for standard types
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(newLayer.visualizationType);

        if (legend && !isSpecialType) {
          // Only update standard legend for FeatureLayers
          try {
            await newLayer.when(); // Wait for layer
            console.log(
              "[AreaChange] Updating Esri legend for FeatureLayer:",
              newLayer.title
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen; // Show if editor isn't open
          } catch (layerError) {
            console.error(
              "[AreaChange] Error waiting for FeatureLayer or updating legend:",
              layerError
            );
            legend.visible = false;
          }
        } else if (legend) {
          console.log(
            "[AreaChange] Keeping standard Esri legend hidden for special layer type:",
            newLayer.visualizationType
          );
          legend.visible = false; // Hide standard legend for special types
        }
      } else {
        console.error(
          `[AreaChange] Failed to create layer for visualization type: ${vizType} with new area type.`
        );
        if (legend) legend.visible = false; // Ensure legend is hidden on failure
      }
    } else {
      console.log(
        `[AreaChange] No visualization update needed. Changed tab ${tabId} is not active (${activeTab}) or has no visualization.`
      );
    }
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
              layerConfiguration: null,
            }
          : tab
      );
      setTabs(newTabs);
      return;
    }

    const initialConfig = initialLayerConfigurations[newValue];
    const newTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            visualizationType: newValue,
            layerConfiguration: initialConfig,
          }
        : tab
    );

    setTabs(newTabs);
    setLayerConfigurations((prev) => {
      if (!prev[newValue]) {
        return {
          ...prev,
          [newValue]: initialConfig,
        };
      }
      return prev;
    });
  };

  // Add this to your JSX near the visualization type dropdown
  const renderAreaTypeDropdown = () => (
    <select
      value={selectedAreaType.value}
      onChange={(e) => {
        const newAreaType = areaTypes.find(
          (type) => type.value === parseInt(e.target.value)
        );
        setSelectedAreaType(newAreaType);

        // Trigger layer update when area type changes
        const activeTabData = tabs.find((tab) => tab.id === activeTab);
        if (activeTabData?.visualizationType) {
          const currentConfig =
            layerConfigurations[activeTabData.visualizationType];
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
      {areaTypes.map((type) => (
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

  // In your MapComponent, update the handleNameChange function:
  const handleNameChange = (tabId, newName) => {
    // Only update if we have a non-empty name and it's different from the current name
    const currentTab = tabs.find((tab) => tab.id === tabId);
    if (newName.trim() && currentTab && newName.trim() !== currentTab.name) {
      setTabs(
        tabs.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                originalName: tab.originalName || tab.name, // Store the original name
                name: newName.trim(),
                isEditing: false,
              }
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

  // Replace the existing addNewTab function with this updated version
  const addNewTab = () => {
    // Open the dialog instead of immediately creating a tab
    setIsNewMapDialogOpen(true);
  };
  /**
   * Enhanced handleCreateMap function with improved label handling
   * This will properly integrate label options from the dialog into the layer configuration
   */
  const handleCreateMap = (mapData) => {
    // Log the data received from the dialog
    console.log(
      "[MapComponent handleCreateMap] Received map data:",
      JSON.stringify(
        mapData,
        (k, v) => (k === "data" ? `[${v?.length} items]` : v),
        2
      )
    );

    // --- Calculate the next default map number (e.g., "Map 2", "Map 3") ---
    const existingTabNumbers = tabs
      .filter((tab) => tab.id !== 1 && tab.name && tab.name.startsWith("Map ")) // Filter non-core tabs named like "Map X"
      .map((tab) => parseInt(tab.name.replace("Map ", ""), 10)) // Extract the number
      .filter((num) => !isNaN(num)); // Keep only valid numbers

    let nextTabNumber = 2; // Start default numbering at 2 (since "Core Map" is 1)
    if (existingTabNumbers.length > 0) {
      // Find the maximum existing number and add 1
      nextTabNumber = Math.max(...existingTabNumbers) + 1;
    }
    // Find the lowest available number starting from 2 if there are gaps
    let currentNum = 2;
    const sortedNumbers = existingTabNumbers.sort((a, b) => a - b);
    for (const num of sortedNumbers) {
      if (num === currentNum) {
        currentNum++;
      } else {
        // Found a gap
        nextTabNumber = currentNum;
        break;
      }
    }
    if (currentNum > Math.max(...sortedNumbers, 0)) {
      nextTabNumber = currentNum; // Use the next number if no gaps found
    }
    // --- End calculating next tab number ---

    // Generate a unique ID for the new tab
    const newTabId = Date.now();

    // --- Determine the Tab Name ---
    // Use the name from the dialog if provided and not empty, otherwise use the calculated default name.
    const newTabName = mapData.name?.trim()
      ? mapData.name.trim()
      : `Map ${nextTabNumber}`;
    // --- End Determine Tab Name ---

    // --- Process map type and configuration ---
    let vizType = mapData.visualizationType || mapData.type; // Get type from mapData
    // Normalize type names if needed (e.g., pipeline -> pipe)
    if (vizType === "pipeline") vizType = "pipe";
    if (vizType === "comps") vizType = "comp";
    console.log(
      `[MapComponent handleCreateMap] Normalized visualization type: ${vizType}`
    );

    let layerConfiguration = mapData.layerConfiguration; // Start with config from dialog
    const areaType = mapData.areaType || areaTypes[0]; // Use areaType from dialog or default

    // If it's a standard heatmap/dot density, Map.jsx might need to look up the initial config
    // The dialog *should* pass null for layerConfiguration in this case.
    if (
      (mapData.type === "heatmap" || mapData.type === "dotdensity") &&
      vizType &&
      !layerConfiguration
    ) {
      console.log(
        `[MapComponent handleCreateMap] Looking up initial config for standard type: ${vizType}`
      );
      layerConfiguration = initialLayerConfigurations[vizType];
      // Ensure the 'type' property is set within the looked-up config if it wasn't already
      if (layerConfiguration && !layerConfiguration.type) {
        layerConfiguration.type = vizType;
      }
    } else if (layerConfiguration) {
      // Ensure the 'type' property is consistent in the passed config
      if (!layerConfiguration.type) {
        layerConfiguration.type = vizType;
      }
      // Log the configuration being used for pipe/comp/custom
      console.log(
        `[MapComponent handleCreateMap] Using layerConfiguration passed from dialog for type ${vizType}:`,
        layerConfiguration
      );
    } else {
      console.warn(
        `[MapComponent handleCreateMap] No layerConfiguration found or determined for type: ${vizType}`
      );
      // Assign null explicitly if configuration couldn't be determined
      layerConfiguration = null;
    }

    // --- Enhanced: Ensure labelOptions are properly handled ---
    if (layerConfiguration && mapData.labelOptions) {
      // Make sure labelOptions from the dialog are included in the layer configuration
      layerConfiguration.labelOptions = {
        ...mapData.labelOptions,
        // Include defaults for any missing values
        fontSize: mapData.labelOptions.fontSize || 10,
        includeVariables: mapData.labelOptions.includeVariables !== false,
        avoidCollisions: mapData.labelOptions.avoidCollisions !== false,
        visibleAtAllZooms: !!mapData.labelOptions.visibleAtAllZooms,
      };
      console.log(
        `[MapComponent handleCreateMap] Applied label options to configuration:`,
        layerConfiguration.labelOptions
      );
    }
    // --- End Process map type and configuration ---

    // Create the new tab object to add to the state
    const newTab = {
      id: newTabId,
      configId: null, // Database ID will be assigned after saving
      name: newTabName,
      originalName: newTabName, // Store original name for editing
      active: true, // Set the new tab as active
      visualizationType: vizType,
      areaType: areaType, // Use the determined areaType object
      layerConfiguration: layerConfiguration, // Use the determined configuration
      isEditing: false,
    };
    console.log(
      "[MapComponent handleCreateMap] Creating new tab object:",
      newTab
    );

    // Update the tabs state: deactivate old tabs, add the new active tab
    const newTabs = [...tabs.map((tab) => ({ ...tab, active: false })), newTab];
    setTabs(newTabs);

    // Set the active tab ID state
    setActiveTab(newTabId);

    // Close the dialog
    setIsNewMapDialogOpen(false);

    // --- Enhanced: Ensure immediate layer creation with labels ---
    setTimeout(() => {
      // Force immediate update to ensure the layer is created with labels
      updateVisualizationLayer();

      // Schedule a second update to guarantee labels are applied
      setTimeout(() => {
        if (labelManagerRef.current && labelManagerRef.current.refreshLabels) {
          console.log(
            "[MapComponent handleCreateMap] Refreshing labels after layer creation"
          );
          labelManagerRef.current.refreshLabels();
        }
      }, 1000);
    }, 100);
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

  const deleteTab = async (tabId, e) => {
    e.stopPropagation();
    if (tabId === 1) return; // Don't delete core map

    try {
      // Find the tab to get its configId
      const tabToDelete = tabs.find((tab) => tab.id === tabId);

      // Delete from database if it has a configId
      if (tabToDelete?.configId) {
        console.log(
          "Deleting configuration from database:",
          tabToDelete.configId
        );
        await mapConfigurationsAPI.delete(tabToDelete.configId);
      }

      // Update local state
      const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
      const newActiveTab =
        activeTab === tabId
          ? remainingTabs[remainingTabs.length - 1].id
          : activeTab;

      const newTabs = remainingTabs.map((tab) => ({
        ...tab,
        active: tab.id === newActiveTab,
      }));

      // Update UI state
      setTabs(newTabs);
      setActiveTab(newActiveTab);

      // Clear visualization if deleted tab was active
      if (activeTab === tabId && mapView?.map) {
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach((layer) => mapView.map.remove(layer));

        // Hide legend
        if (legend) {
          legend.visible = false;
        }
      }
    } catch (error) {
      console.error("Error deleting tab configuration:", error);
      alert("Failed to delete map configuration");
    }
  };

  const convertAreaTypeToString = (value) => {
    if (typeof value === "string") return value;
    return value === 12 ? "tract" : value === 11 ? "county" : "tract"; // default to tract
  };

  // Helper function to convert area type string to numeric value
  const convertAreaTypeToNumber = (value) => {
    if (typeof value === "number") return value;
    return value === "tract" ? 12 : value === "county" ? 11 : 12; // default to tract (12)
  };

  // Updated saveMapConfigurations function
  const saveMapConfigurations = () => {
    const mapConfigs = tabs
      .filter((tab) => tab.id !== 1)
      .map((tab, index) => ({
        tab_name: tab.name,
        visualization_type: tab.visualizationType,
        area_type: convertAreaTypeToString(tab.areaType?.value),
        layer_configuration: tab.layerConfiguration,
        order: index,
      }));

    try {
      localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(mapConfigs));
      alert("Map configurations saved successfully");
    } catch (error) {
      console.error("Failed to save map configurations", error);
      alert("Failed to save map configurations");
    }
  };

  const handleLayerConfigChange = useCallback(
    (newConfig) => {
      console.log(
        "[ConfigChange] Updating tabs state with new config:",
        newConfig
      );

      setTabs((prevTabs) => {
        return prevTabs.map((tab) =>
          tab.id === activeTab && tab.visualizationType
            ? {
                ...tab,
                layerConfiguration: {
                  ...newConfig,
                  // Preserve symbol structure if not explicitly changed by newConfig
                  symbol: newConfig.symbol || tab.layerConfiguration?.symbol,
                  // Ensure type is consistent
                  type:
                    newConfig.type ||
                    tab.layerConfiguration?.type ||
                    tab.visualizationType,
                },
              }
            : tab
        );
      });

      // --- REMOVED onPreview CALL ---
      // The main useEffect watching `tabs` will now handle re-rendering
      // the layer based on this state update when the user implicitly
      // confirms the change (e.g., by closing editor or saving).
      // If live preview *on the main map* is essential during editing,
      // the `onPreview` prop and `handleConfigPreview` function need
      // careful implementation to manage temporary layers without
      // conflicting with the main state/useEffect loop.
      console.log(
        "[ConfigChange] Tabs state update triggered. Main useEffect will handle layer update."
      );
    },
    [activeTab, setTabs, tabs]
  ); // Include dependencies for useCallback

  // Add this function to extract style properties consistently:
  const extractSymbolProperties = (config) => {
    const symbol = config?.symbol || {};
    return {
      size: symbol.size !== undefined ? Number(symbol.size) : 12,
      color: symbol.color || "#800080", // Default purple for comp
      outline: {
        color: symbol.outline?.color || "#FFFFFF",
        width:
          symbol.outline?.width !== undefined
            ? Number(symbol.outline.width)
            : 1,
      },
      style: symbol.style || "circle",
    };
  };

  // Handler for configuration previews
  const handleConfigPreview = async (previewConfig) => {
    if (!mapView?.map) {
      console.warn("[Preview] Map view not ready.");
      return;
    }
    if (!previewConfig) {
      console.warn("[Preview] No preview config provided.");
      return;
    }

    console.log(
      "[Preview] Starting preview with config:",
      JSON.stringify(previewConfig, (k, v) =>
        k === "customData" ? `[${v?.data?.length} items]` : v
      )
    );

    try {
      // --- Layer Removal ---
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer);
        }
      });
      if (layersToRemove.length > 0) {
        console.log(
          `[Preview] Removing ${layersToRemove.length} existing visualization layers.`
        );
        mapView.map.removeMany(layersToRemove);
      }
      // --- End Layer Removal ---

      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      if (!activeTabData) {
        console.error("[Preview] Could not find active tab data.");
        await updateVisualizationLayer(); // Restore original
        return;
      }

      // --- Determine Effective Type FROM PREVIEW CONFIG ---
      let effectiveType = previewConfig.type; // Prioritize type from preview config
      if (!effectiveType) {
        console.warn(
          "[Preview] Preview config missing 'type'. Attempting to infer or use active tab type."
        );
        effectiveType = activeTabData.visualizationType; // Fallback to active tab type
        if (previewConfig.customData && !effectiveType)
          effectiveType = "custom"; // Infer if custom data exists
        if (!effectiveType) {
          console.error(
            "[Preview] Could not determine effective type for preview."
          );
          await updateVisualizationLayer(); // Restore original
          return;
        }
      }

      // Normalize type
      if (effectiveType === "pipeline") effectiveType = "pipe";
      if (effectiveType === "comps") effectiveType = "comp";
      if (effectiveType && effectiveType.endsWith("_HEAT"))
        effectiveType = "class-breaks";

      console.log(`[Preview] Effective Preview Type: ${effectiveType}`);
      // --- End Determine Effective Type ---

      // Create the new layer using the PREVIEW configuration and determined type
      let newLayer = null;
      const specialTypes = ["pipe", "comp", "custom"];
      const isSpecialType =
        specialTypes.includes(effectiveType) ||
        (previewConfig.customData &&
          !["class-breaks", "dot-density"].includes(effectiveType));

      if (isSpecialType) {
        // Ensure the preview config has the correct type set for the creator function
        const configForCreator = { ...previewConfig, type: effectiveType };
        console.log(
          `[Preview] Creating GraphicsLayer (${effectiveType}) using preview config.`
        );

        if (effectiveType === "pipe") {
          newLayer = createPipeLayer(configForCreator);
        } else if (effectiveType === "comp") {
          newLayer = createCompLayer(configForCreator);
        } else {
          // Assume custom if not pipe or comp
          newLayer = await createGraphicsLayerFromCustomData(configForCreator);
        }
      } else {
        // Standard visualization type (heatmap, dot-density)
        console.log(
          `[Preview] Creating FeatureLayer (${effectiveType}) using preview config.`
        );
        newLayer = await createLayers(
          effectiveType, // Pass the determined type
          previewConfig, // Pass the PREVIEW configuration object
          initialLayerConfigurations,
          activeTabData.areaType || selectedAreaType // Use area type from the active tab
        );
      }

      // --- Add Layer and Update Legend ---
      if (
        newLayer &&
        (newLayer instanceof FeatureLayer || newLayer instanceof GraphicsLayer)
      ) {
        console.log(
          `[Preview] Successfully created layer: "${newLayer.title}", type: "${
            newLayer.visualizationType || effectiveType
          }". Adding to map.`
        );
        // Ensure flag is set (should be done in creators)
        newLayer.isVisualizationLayer = true;

        mapView.map.add(newLayer, 0);

        // Update legend
        if (legend) {
          try {
            await newLayer.when();
            console.log(
              "[Preview] Updating legend for preview layer:",
              newLayer.title
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: `${newLayer.title || effectiveType} (Preview)`,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = true;
          } catch (legendError) {
            console.error("[Preview] Error updating legend:", legendError);
            legend.visible = false;
          }
        }
      } else {
        console.error(
          `[Preview] Failed to create layer for preview type ${effectiveType}.`
        );
        await updateVisualizationLayer(); // Restore original state
      }
      // --- End Add Layer and Update Legend ---
    } catch (error) {
      console.error("[Preview] Error during preview:", error);
      await updateVisualizationLayer(); // Restore original state
    } finally {
      console.log("[Preview] Preview update finished.");
    }
  };

  /**
   * Creates properly formatted graphics for a market area with valid geometries
   * Resolves the "Invalid property value" error by ensuring proper geometry objects
   *
   * @param {string} marketAreaId - ID of the market area
   * @param {Object|Array} geometryData - Geometry data from the market area
   * @returns {Promise<Array>} - Array of ArcGIS Graphic objects
   */
  const createMarketAreaGraphics = async (marketAreaId, geometryData) => {
    // Skip if no valid geometry data
    if (!geometryData) {
      console.warn(
        `[MapContext] No geometry data for market area ${marketAreaId}`
      );
      return [];
    }

    try {
      // Dynamically import needed ArcGIS modules
      const [
        { default: Graphic },
        { default: Polygon },
        { default: SimpleFillSymbol },
      ] = await Promise.all([
        import("@arcgis/core/Graphic"),
        import("@arcgis/core/geometry/Polygon"),
        import("@arcgis/core/symbols/SimpleFillSymbol"),
      ]);

      // Create a proper Polygon geometry from raw data
      const createValidPolygon = (geomData) => {
        // Ensure we have valid rings data
        if (!geomData || !geomData.rings || !Array.isArray(geomData.rings)) {
          console.warn(
            `[MapContext] Invalid polygon data for market area ${marketAreaId}`,
            geomData
          );
          return null;
        }

        // Create a proper ArcGIS Polygon geometry object
        return new Polygon({
          rings: geomData.rings,
          spatialReference: geomData.spatialReference || { wkid: 4326 },
        });
      };

      // Create the appropriate symbol for market areas
      const symbol = new SimpleFillSymbol({
        color: [0, 120, 255, 0.2],
        outline: {
          color: [0, 120, 255, 0.8],
          width: 2,
        },
      });

      const graphics = [];

      // Handle array of geometries or single geometry
      const geometries = Array.isArray(geometryData)
        ? geometryData
        : [geometryData];

      for (const geomData of geometries) {
        const polygon = createValidPolygon(geomData);
        if (!polygon) continue; // Skip invalid geometries

        // Create a properly formatted Graphic with the valid polygon
        const graphic = new Graphic({
          geometry: polygon,
          symbol: symbol,
          attributes: {
            marketAreaId: marketAreaId,
            isMarketArea: true,
          },
        });

        graphics.push(graphic);
      }

      console.log(
        `[MapContext] Created ${graphics.length} graphics for market area ${marketAreaId}`
      );
      return graphics;
    } catch (error) {
      console.error(
        `[MapContext] Error creating graphics for market area ${marketAreaId}:`,
        error
      );
      return []; // Return empty array on error
    }
  };

  /**
   * Enhanced configuration loading function with improved error handling
   * Properly handles API data, cleans up resources, and manages state updates
   *
   * @returns {Promise<boolean>} - Success/failure indicator
   */
  const loadMapConfigurations = async () => {
    // Guard clause for missing project ID
    if (!projectId) {
      console.warn(
        "[loadMapConfigurations] No project ID available, cannot load."
      );

      // Set default state with Core Map
      setTabs([
        {
          id: 1,
          name: "Core Map",
          active: true,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false,
        },
      ]);
      setActiveTab(1);
      setIsConfigLoading(false);

      // Clear any existing visualization layers
      if (mapView?.map) {
        const layersToRemove = mapView.map.layers
          .filter((layer) => layer?.isVisualizationLayer === true)
          .toArray();

        if (layersToRemove.length > 0) {
          console.log(
            `[loadMapConfigurations] Removing ${layersToRemove.length} visualization layers due to missing project ID.`
          );
          mapView.map.removeMany(layersToRemove);
        }

        if (legend) legend.visible = false;
      }

      return false;
    }

    console.log(
      `[loadMapConfigurations] Loading configurations for project: ${projectId}`
    );
    setIsConfigLoading(true);

    try {
      // Clear any existing visualization layers before fetching new data
      if (mapView?.map) {
        const existingLayers = mapView.map.layers
          .filter((layer) => layer?.isVisualizationLayer === true)
          .toArray();

        if (existingLayers.length > 0) {
          console.log(
            `[loadMapConfigurations] Removing ${existingLayers.length} existing layers before loading new config.`
          );
          mapView.map.removeMany(existingLayers);
        }
      }

      // Fetch configurations from API
      const response = await mapConfigurationsAPI.getAll(projectId);
      const mapConfigs = response?.data || [];

      console.log(
        "[loadMapConfigurations] Loaded map configurations:",
        Array.isArray(mapConfigs)
          ? `${mapConfigs.length} configs`
          : "invalid data"
      );

      // Handle empty or invalid response
      if (!Array.isArray(mapConfigs) || mapConfigs.length === 0) {
        console.log(
          "[loadMapConfigurations] No configurations found, using default Core Map"
        );

        // Update state atomically
        const defaultTabs = [
          {
            id: 1,
            name: "Core Map",
            active: true,
            visualizationType: null,
            areaType: areaTypes[0],
            layerConfiguration: null,
            isEditing: false,
          },
        ];

        setTabs(defaultTabs);
        setActiveTab(1);

        // Ensure legend is hidden
        if (legend) {
          legend.visible = false;
        }

        setIsConfigLoading(false);
        return false;
      }

      // Process configurations into tabs
      const processedTabs = [
        // Always include Core Map as the first tab
        {
          id: 1,
          name: "Core Map",
          active: true, // Start with Core Map active
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false,
        },
      ];

      // Track any processing errors for logging
      const processingErrors = [];

      // Process each configuration
      mapConfigs.forEach((config, index) => {
        try {
          // Skip invalid configurations
          if (!config || !config.id) {
            processingErrors.push(
              `Config at index ${index} is invalid or missing ID`
            );
            return;
          }

          // Process area type
          let areaType = areaTypes[0]; // Default to first area type

          if (config.area_type != null) {
            const areaTypeStr = String(config.area_type).toLowerCase();

            // Try to match by value or label
            const foundType = areaTypes.find(
              (type) =>
                String(type.value).toLowerCase() === areaTypeStr ||
                type.label.toLowerCase() === areaTypeStr
            );

            if (foundType) {
              areaType = foundType;
            } else {
              processingErrors.push(
                `Could not resolve area type "${config.area_type}" for tab "${config.tab_name}"`
              );
            }
          }

          // Validate visualization type
          let vizType = config.visualization_type;
          if (vizType === "pipeline") vizType = "pipe"; // Normalize type
          if (vizType === "comps") vizType = "comp"; // Normalize type

          // Create tab object
          const newTab = {
            id: config.id,
            configId: config.id,
            name: config.tab_name || `Map ${index + 1}`, // Fallback name if missing
            active: false, // Only Core Map will be active initially
            visualizationType: vizType,
            areaType: areaType,
            layerConfiguration: config.layer_configuration, // Use as-is from API
            isEditing: false,
          };

          processedTabs.push(newTab);
        } catch (err) {
          processingErrors.push(
            `Error processing config at index ${index}: ${err.message}`
          );
        }
      });

      // Log any processing errors
      if (processingErrors.length > 0) {
        console.warn(
          "[loadMapConfigurations] Encountered issues while processing configs:",
          processingErrors
        );
      }

      // Update component state with processed tabs
      console.log("[loadMapConfigurations] Setting tabs:", processedTabs);
      setTabs(processedTabs);
      setActiveTab(1); // Ensure Core Map is active

      // Visualization will be handled by the useEffect hook that watches activeTab and tabs
      // Don't need explicit updateVisualizationLayer() call here

      setIsConfigLoading(false);
      console.log("[loadMapConfigurations] Configuration loading complete");
      return true;
    } catch (error) {
      // Handle all errors
      console.error(
        "[loadMapConfigurations] Error loading configurations:",
        error.response?.data || error.message || error
      );

      // Reset to safe default state
      setTabs([
        {
          id: 1,
          name: "Core Map",
          active: true,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false,
        },
      ]);
      setActiveTab(1);

      // Clean up any visualization layers that might exist
      if (mapView?.map) {
        const layersToRemove = mapView.map.layers
          .filter((layer) => layer?.isVisualizationLayer === true)
          .toArray();

        if (layersToRemove.length > 0) {
          console.log(
            "[loadMapConfigurations] Cleaning up visualization layers after error"
          );
          mapView.map.removeMany(layersToRemove);
        }
      }

      // Hide legend
      if (legend) legend.visible = false;

      setIsConfigLoading(false);
      return false;
    }
  };

  /**
   * Helper function to get map configurations - used with the API
   *
   * @param {string} projectId - ID of the project to get configurations for
   * @returns {Promise<Array>} - Configurations from the API
   */
  const getMapConfigurations = async (projectId) => {
    try {
      const response = await mapConfigurationsAPI.getAll(projectId);
      console.log("Full API Response:", response);
      return response.data;
    } catch (error) {
      console.error("Error fetching map configurations:", error);
      throw error;
    }
  };

  /**
   * Notify the label manager about a new visualization layer
   * This function should be called after a new layer is created and added to the map
   *
   * @param {Object} layer - The newly created layer
   * @param {string} layerType - The type of layer ('comp', 'pipe', 'custom', etc.)
   * @param {Object} labelOptions - Label configuration options
   * @returns {Promise<void>}
   */
  const notifyLabelManagerAboutLayer = async (
    layer,
    layerType,
    labelOptions = {}
  ) => {
    if (!layer || !labelManagerRef.current) {
      console.log(
        `[MapComponent] Cannot notify label manager: ${
          !layer ? "layer is missing" : "label manager not initialized"
        }`
      );
      return;
    }

    console.log(
      `[MapComponent] Notifying label manager about new ${layerType} layer:`,
      {
        layerId: layer.id,
        title: layer.title,
        graphicsCount: layer.graphics?.length || 0,
        labelOptions,
      }
    );

    try {
      // First, ensure the label manager has the appropriate settings for this layer type
      labelManagerRef.current.configureLayerSettings(layerType);

      // Special handling for different layer types
      if (
        layerType === "pipe" ||
        layerType === "comp" ||
        layerType === "custom"
      ) {
        // Enhanced label options for these point-based layers
        const enhancedOptions = {
          fontSize: labelOptions?.fontSize || 10,
          includeVariables: labelOptions?.includeVariables !== false,
          avoidCollisions: labelOptions?.avoidCollisions !== false,
          visibleAtAllZooms: !!labelOptions?.visibleAtAllZooms,
          // Add specific settings for each layer type
          ...(layerType === "pipe"
            ? {
                padding: 8,
                minDistanceBetweenLabels: 18,
                maxLabelsVisible: 80,
              }
            : layerType === "comp"
            ? {
                padding: 12,
                minDistanceBetweenLabels: 24,
                maxLabelsVisible: 60,
              }
            : {
                padding: 10,
                minDistanceBetweenLabels: 20,
                maxLabelsVisible: 75,
              }),
        };

        console.log(
          `[MapComponent] Applying enhanced label options for ${layerType}:`,
          enhancedOptions
        );

        // Set the min/max zoom for label visibility based on configuration
        if (enhancedOptions.visibleAtAllZooms) {
          // Make labels visible at all zoom levels
          if (labelManagerRef.current.updateOptions) {
            labelManagerRef.current.updateOptions({
              labelMinZoom: 0, // Visible at all zoom levels
            });
          }
        }

        // Force a scan of this layer for labels
        setTimeout(() => {
          if (
            labelManagerRef.current &&
            labelManagerRef.current._findAndIntegrateExistingLabels
          ) {
            labelManagerRef.current._findAndIntegrateExistingLabels(layer);
            console.log(
              `[MapComponent] Integrated existing labels from ${layerType} layer`
            );

            // Refresh all labels after a short delay to ensure proper display
            setTimeout(() => {
              if (
                labelManagerRef.current &&
                labelManagerRef.current.refreshLabels
              ) {
                labelManagerRef.current.refreshLabels();
                console.log(
                  `[MapComponent] Refreshed labels for ${layerType} layer`
                );
              }
            }, 500);
          }
        }, 200);
      }

      // Mark this layer as managed by the label manager
      layer._labelManagerIntegrated = true;
    } catch (error) {
      console.error(
        `[MapComponent] Error notifying label manager about ${layerType} layer:`,
        error
      );
    }
  };

  /**
   * Updated version of setupLabelManagement to ensure it's properly handling all layer types
   */
  const setupLabelManagement = useCallback(() => {
    if (!mapView || !mapView.ready || labelManagerRef.current) {
      // Skip if mapView not ready OR label manager already exists
      return;
    }

    console.log("[MapComponent] Setting up label layer management for map");

    // Initialize the label layer manager with settings that work well with existing labels
    labelManagerRef.current = initializeLabelLayerManager(mapView, {
      labelMinZoom: 8, // Lower zoom level to make labels visible earlier
      fontSizeRange: [9, 14], // Size range
      haloSize: 2.5, // Halo for better visibility
      haloColor: [255, 255, 255, 0.95],
      padding: 10,
      minDistanceBetweenLabels: 20,
      maxLabelsVisible: 100, // Higher limit for dense maps
      // Enhanced scanning capabilities
      autoScanLayers: true, // Automatically scan all layers
      scanInterval: 2000, // Scan for new labels every 2 seconds
      scanCustomTypes: ["comp", "pipe", "custom"], // Look for these custom layer types
    });

    // Process the map to ensure all existing labels are integrated
    setTimeout(() => {
      // Force the manager to scan all layers for existing labels
      if (labelManagerRef.current) {
        // Look for visualization layers first
        mapView.map.layers.forEach((layer) => {
          if (layer.isVisualizationLayer && layer.visualizationType) {
            console.log(
              `[MapComponent] Found visualization layer to integrate: ${layer.title} (${layer.visualizationType})`
            );
            if (labelManagerRef.current._findAndIntegrateExistingLabels) {
              labelManagerRef.current._findAndIntegrateExistingLabels(layer);
            }
          }
        });

        // Then refresh all labels
        labelManagerRef.current.refreshLabels();
        console.log("[MapComponent] Forced initial label refresh");
      }
    }, 1500); // Increased delay to ensure all layer processing completes

    console.log("[MapComponent] Label layer management initialized");
  }, [mapView]);

  // With this:
  if (labelManagerRef.current) {
    try {
      // Save any pending changes
      labelManagerRef.current.saveLabels();
      // Clean up
      labelManagerRef.current.destroy();
      labelManagerRef.current = null;
    } catch (err) {
      console.error("[Map] Error during label manager cleanup:", err);
    }
  }

  // Add this cleanup in your main component unmount useEffect
  useEffect(() => {
    // Existing initialization code

    return () => {
      // Clean up event listeners for drawing tools
      if (mapView?.drawingHandlers) {
        const { mousedown, contextmenu, mousemove, mouseup, mouseleave } =
          mapView.drawingHandlers;
        if (mapView.container) {
          mapView.container.removeEventListener("mousedown", mousedown);
          mapView.container.removeEventListener("contextmenu", contextmenu);
          mapView.container.removeEventListener("mousemove", mousemove);
          mapView.container.removeEventListener("mouseup", mouseup);
          mapView.container.removeEventListener("mouseleave", mouseleave);
        }
      }

      // Enhanced label manager cleanup
      if (labelManagerRef.current) {
        try {
          // First ensure edits are properly marked for persistence
          if (
            typeof labelManagerRef.current.markSavedPositionsAsEdited ===
            "function"
          ) {
            labelManagerRef.current.markSavedPositionsAsEdited();
          }

          // Force save with maximum persistence
          if (typeof labelManagerRef.current.savePositions === "function") {
            const result = labelManagerRef.current.savePositions(true);
            console.log(
              `[Map] Final save of ${
                result?.count || 0
              } label positions before component unmount`
            );
          }

          // Then destroy
          labelManagerRef.current.destroy();
          labelManagerRef.current = null;
        } catch (err) {
          console.error(
            "[Map] Error during enhanced label manager cleanup:",
            err
          );
        }
      }

      // Clean up rectangle element
      if (rectangleRef.current && mapRef.current) {
        if (mapRef.current.contains(rectangleRef.current)) {
          mapRef.current.removeChild(rectangleRef.current);
        }
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        console.log("Starting map initialization...");

        // Validate API Key
        const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        if (!apiKey) {
          console.error("ArcGIS API Key is missing");
          return;
        }

        // Configure ArcGIS
        esriConfig.apiKey = apiKey;
        esriConfig.assetsPath =
          "https://js.arcgis.com/4.31/@arcgis/core/assets/";

        // Create map with standard basemap
        const map = new Map({
          basemap: "streets-navigation-vector",
        });

        // Create view with comprehensive error handling
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-98, 39],
          zoom: 4,
          constraints: {
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20,
          },
          navigation: {
            actionMap: {
              mouseWheel: {
                enabled: false,
              },
            },
            browserTouchPanEnabled: true,
            momentumEnabled: true,
            keyboardNavigation: true,
          },
        });

        console.log("Waiting for view to be ready...");
        // Wait for the view to be ready before proceeding
        await view.when();
        console.log("View is now ready!");

        // Custom mouse wheel zoom handler
        view.constraints.snapToZoom = false; // Allow fractional zoom levels

        // Enhanced mouse wheel zoom handler with DEBUG LOGGING
        view.on("mouse-wheel", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const state = scrollStateRef.current;
          const now = Date.now();
          const timeDiff = now - (state.lastScrollTime || now); // Handle initial scroll

          const scrollDeltaY = event.native.deltaY;
          const currentDirection = scrollDeltaY < 0 ? 1 : -1; // 1 = zoom in, -1 = zoom out

          console.log(`\n--- Wheel Event ---`); // Separator for clarity
          console.log(
            `Time: ${now}, LastTime: ${state.lastScrollTime}, Diff: ${timeDiff}ms`
          );
          console.log(
            `Direction: ${currentDirection}, LastDirection: ${state.lastScrollDirection}, Current Streak: ${state.scrollStreak}`
          );

          // --- Streak Logic ---
          const resetThreshold = 250; // ms - Pause threshold
          const accelerateThreshold = 120; // ms - Continuous scroll threshold

          // Clear previous reset timer
          if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            state.timeoutId = null; // Clear the ID
          }

          let streakIncremented = false;
          if (
            timeDiff < resetThreshold &&
            currentDirection === state.lastScrollDirection &&
            state.lastScrollDirection !== 0
          ) {
            // Scrolling continued in the same direction without too long a pause
            if (timeDiff < accelerateThreshold) {
              // Fast enough to increase streak
              state.scrollStreak++;
              streakIncremented = true;
              console.log(
                `   Streak INCREMENTED to: ${state.scrollStreak} (timeDiff < accelerateThreshold)`
              );
            } else {
              // Scrolled again in same direction, but paused slightly - MAINTAIN streak (removed reset to 1)
              console.log(
                `   Streak MAINTAINED at: ${state.scrollStreak} (accelerateThreshold <= timeDiff < resetThreshold)`
              );
              // Keep state.scrollStreak as is, don't reset to 1
            }
          } else {
            // Direction changed or paused too long - reset streak
            console.log(
              `   Streak RESET to 1 (timeDiff >= resetThreshold or direction changed)`
            );
            state.scrollStreak = 1;
          }
          // --- End Streak Logic ---

          // --- Calculate Zoom Delta ---
          const baseZoomDelta = 0.08;
          const streakBonus = 0.2; // Slightly increased bonus for testing
          const maxAccelerationFactor = 5.0;

          // Acceleration factor increases only AFTER the first scroll in a streak
          const accelerationFactor = Math.min(
            1 + streakBonus * Math.max(0, state.scrollStreak - 1),
            maxAccelerationFactor
          );

          const finalZoomDelta =
            baseZoomDelta * accelerationFactor * currentDirection;
          console.log(
            `   BaseDelta: ${baseZoomDelta}, AccelFactor: ${accelerationFactor.toFixed(
              2
            )}, FinalDelta: ${finalZoomDelta.toFixed(4)}`
          );
          // --- End Calculate Zoom Delta ---

          // --- Apply Zoom ---
          const currentZoom = view.zoom;
          let newZoom = currentZoom + finalZoomDelta;
          newZoom = Math.min(
            Math.max(newZoom, view.constraints.minZoom),
            view.constraints.maxZoom
          );
          console.log(
            `   CurrentZoom: ${currentZoom.toFixed(
              4
            )}, NewZoom Clamped: ${newZoom.toFixed(4)}`
          );

          if (Math.abs(newZoom - currentZoom) > 0.001) {
            console.log(`   Applying goTo with zoom: ${newZoom.toFixed(4)}`);
            view
              .goTo(
                { zoom: newZoom, center: view.center },
                { duration: 60, easing: "linear", animate: true }
              )
              .catch((error) => {
                if (error.name !== "AbortError")
                  console.error("goTo Error:", error);
              });
          } else {
            console.log(`   Skipping goTo (zoom change too small)`);
          }
          // --- End Apply Zoom ---

          // --- Update State for Next Event ---
          state.lastScrollTime = now;
          state.lastScrollDirection = currentDirection;

          // Set a timer to reset the streak if the user stops scrolling
          state.timeoutId = setTimeout(() => {
            console.log(
              `--- Wheel Timeout (${resetThreshold}ms): Resetting streak ---`
            );
            state.scrollStreak = 0;
            state.lastScrollDirection = 0;
            state.timeoutId = null;
          }, resetThreshold);
          // --- End Update State ---
        });

        // Initialize the rectangle drawing functionality
        initializeDrawingTools(view);

        console.log("Adding UI widgets...");
        // Add non-legend widgets first
        const widgets = [
          {
            widget: new Home({ view }),
            position: "top-left",
          },
          {
            widget: new ScaleBar({
              view,
              unit: "imperial",
            }),
            position: "top-left",
          },
        ];

        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        if (isMounted) {
          console.log("Finalizing map setup...");
          // Set map readiness flag and view in context
          view.ready = true;
          setMapView(view);
          console.log("[MapContext] Map view initialized and ready");

          // Initialize legend after map is ready
          const legendWidget = new Legend({
            view,
            container: document.createElement("div"),
            layerInfos: [],
            visible: false,
          });

          // Add legend to the view but keep it hidden initially
          view.ui.add(legendWidget, "bottom-left");
          setLegend(legendWidget);

          // Initialize the universal label manager with enhanced options
          if (!labelManagerRef.current) {
            console.log("[Map] Initializing universal label manager");
            labelManagerRef.current = initializeUniversalLabelManager(view, {
              // Universal settings that work well in all scenarios
              labelMinZoom: 8, // Lower value to show labels earlier when zooming
              layoutStrategy: "advanced",
              maxLabelsVisible: 80, // Increased to show more labels
              fontSizeRange: [9, 14], // Allow slightly larger fonts
              haloSize: 2,
              haloColor: [255, 255, 255, 0.95], // Increased opacity for better visibility
              padding: 10,
              minDistanceBetweenLabels: 18, // Reduced to allow more labels in dense areas
              priorityAttributes: ["TotalUnits", "value", "priority"],
              densityAware: true,
              useSpatialClustering: true,
              textTransform: "none",
              deduplicateLabels: true,
              maxLabelDistance: 70,
              preventLabelOverlap: true,
              labelPlacementPreference: [
                "top",
                "right",
                "bottom",
                "left",
                "top-right",
                "bottom-right",
                "bottom-left",
                "top-left",
              ],
              // CRITICAL: Add auto-loading of saved positions
              autoLoadPositions: true,
              autoSaveInterval: 15000, // Auto-save every 15 seconds
            });

            console.log(
              "[Map] Universal label manager initialized with auto-loading"
            );

            // Explicitly trigger the first load with a slight delay
            setTimeout(() => {
              try {
                if (
                  labelManagerRef.current &&
                  labelManagerRef.current.loadPositions
                ) {
                  console.log("[Map] Initial loading of saved label positions");
                  const loadResult = labelManagerRef.current.loadPositions(
                    true,
                    true
                  );
                  console.log(
                    `[Map] Loaded ${
                      loadResult.count || 0
                    } saved label positions`
                  );
                }
              } catch (err) {
                console.error(
                  "[Map] Error loading initial label positions:",
                  err
                );
              }
            }, 1000);
          }
        }
      } catch (error) {
        console.error("[Map] Error initializing map:", error, error.stack);
      }
    };

    // Trigger map initialization
    initializeMap();

    // Enhanced cleanup function
    return () => {
      isMounted = false;
      if (labelManagerRef.current) {
        try {
          // First mark all positions as edited to ensure persistence
          if (
            typeof labelManagerRef.current.markSavedPositionsAsEdited ===
            "function"
          ) {
            labelManagerRef.current.markSavedPositionsAsEdited();
            console.log(
              "[Map] Marked saved label positions as edited before unmounting"
            );
          }

          // Then save all positions with forced persistence
          labelManagerRef.current.savePositions(true);
          console.log("[Map] Saved label positions before unmounting");

          // Destroy the label manager
          labelManagerRef.current.destroy();
          labelManagerRef.current = null;
        } catch (err) {
          console.error("[Map] Error cleaning up label manager:", err);
        }
      }
    };
  }, []);

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
      const loadedTabs = tabs.filter(
        (tab) => tab.id !== 1 && tab.visualizationType
      );
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
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || tab.visualizationType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = true;
          }
        }
      }
    };

    initConfigs();
  }, [mapView, legend]);

  useEffect(() => {
    return () => {
      // Remove the rectangle element when component unmounts
      if (rectangleRef.current && mapRef.current) {
        if (mapRef.current.contains(rectangleRef.current)) {
          mapRef.current.removeChild(rectangleRef.current);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!legend || !mapView?.ready) return;

    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const hasVisualization = activeTabData?.visualizationType;
    const shouldShowLegend =
      activeTab !== 1 && hasVisualization && !isEditorOpen;

    // Update legend visibility
    legend.visible = shouldShowLegend;

    if (shouldShowLegend) {
      requestAnimationFrame(() => {
        const styleLegend = () => {
          const legendContainer = legend.container;
          if (legendContainer) {
            // Apply styles
            legendContainer.style.backgroundColor = "white";
            legendContainer.style.padding = "1rem";
            legendContainer.style.margin = "0.5rem";
            legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
            legendContainer.style.borderRadius = "0.375rem";
            legendContainer.style.boxShadow =
              "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

            // Style legend title
            const legendTitle = legendContainer.querySelector(
              ".esri-legend__service-label"
            );
            if (legendTitle) {
              legendTitle.style.fontWeight = "600";
              legendTitle.style.fontSize = "0.875rem";
              legendTitle.style.marginBottom = "0.75rem";
              legendTitle.style.color = "#111827";
            }

            // Style legend items
            const legendItems = legendContainer.querySelectorAll(
              ".esri-legend__layer-row"
            );
            legendItems.forEach((item) => {
              item.style.display = "flex";
              item.style.alignItems = "center";
              item.style.marginBottom = "0.5rem";
            });

            // Style color swatches
            const swatches = legendContainer.querySelectorAll(
              ".esri-legend__symbol"
            );
            swatches.forEach((swatch) => {
              swatch.style.width = "1rem";
              swatch.style.height = "1rem";
              swatch.style.marginRight = "0.5rem";
            });

            // Style labels
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
      });
    }
  }, [activeTab, legend, tabs, isEditorOpen, mapView?.ready]);

  /**
   * Enhanced visualization layer effect for handling map layer updates with proper label persistence
   * This effect runs when active tab, tabs array, or map state changes to update visualization layers
   * and ensures label edits are preserved across updates
   */
  useEffect(() => {
    console.log(
      "[VizUpdate Effect] TRIGGERED. Active Tab:",
      activeTab,
      "Tabs Count:",
      tabs.length
    );

    // Skip update if prerequisites not met
    if (!mapView?.map || isConfigLoading || !legend) {
      console.log(
        "[VizUpdate Effect] Map/Legend not ready or configs loading, skipping update."
      );
      return;
    }

    // Track component mounted state for async operations
    let isMounted = true;
    const abortController = new AbortController();

    const updateVisualizationAndLegend = async () => {
      console.log("[VizUpdate Effect] Starting update...");

      try {
        // --- Save current label positions before layer changes with enhanced persistence ---
        if (labelManagerRef.current) {
          try {
            console.log("[VizUpdate Effect] Saving current label positions");
            const saveResult = labelManagerRef.current.savePositions(true);
            console.log(
              `[VizUpdate Effect] Saved ${
                saveResult.count || 0
              } label positions`
            );

            // Mark saved positions as edited to ensure they persist through layer changes
            if (
              typeof labelManagerRef.current.markSavedPositionsAsEdited ===
              "function"
            ) {
              labelManagerRef.current.markSavedPositionsAsEdited();
              console.log(
                "[VizUpdate Effect] Marked saved positions as edited for persistence"
              );
            }
          } catch (err) {
            console.error(
              "[VizUpdate Effect] Error saving label positions:",
              err
            );
          }
        }

        // --- Remove existing visualization layers ---
        const layersToRemove = [];
        const remainingLayerIds = new Set();

        mapView.map.layers.forEach((layer) => {
          if (layer && layer.isVisualizationLayer === true) {
            layersToRemove.push(layer);
          } else if (layer) {
            remainingLayerIds.add(layer.id);
          }
        });

        if (layersToRemove.length > 0) {
          console.log(
            `[VizUpdate Effect] Removing ${layersToRemove.length} existing visualization layers.`
          );
          mapView.map.removeMany(layersToRemove);

          // Clean up refs for removed layers
          if (activeLayersRef?.current) {
            Object.keys(activeLayersRef.current).forEach((tabIdKey) => {
              const layerInstance = activeLayersRef.current[tabIdKey];
              if (layerInstance && !remainingLayerIds.has(layerInstance.id)) {
                console.log(
                  `[VizUpdate Effect] Clearing ref for removed layer (Tab ID: ${tabIdKey})`
                );
                delete activeLayersRef.current[tabIdKey];
              }
            });
          }
        }

        // Get active tab data
        const activeTabData = tabs.find((tab) => tab.id === activeTab);

        if (!activeTabData) {
          console.warn("[VizUpdate Effect] Could not find active tab data.");
          return;
        }

        console.log("[VizUpdate Effect] Active Tab Data:", {
          id: activeTabData.id,
          name: activeTabData.name,
          type: activeTabData.visualizationType,
        });

        // Only create new layer if needed
        if (activeTab !== 1 && activeTabData.visualizationType && isMounted) {
          // Normalize visualization type
          let vizType = activeTabData.visualizationType;
          if (vizType === "pipeline") vizType = "pipe";
          if (vizType === "comps") vizType = "comp";

          const config = activeTabData.layerConfiguration;
          const areaType = activeTabData.areaType;

          try {
            console.log(`[VizUpdate Effect] Creating layer for: ${vizType}`);

            // Create layer with timeout to prevent infinite loading
            const layerPromise = createLayers(
              vizType,
              config,
              initialLayerConfigurations,
              areaType
            );
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Layer creation timeout")),
                10000
              )
            );

            const newLayer = await Promise.race([layerPromise, timeoutPromise]);

            if (!isMounted) return;

            if (newLayer) {
              console.log(
                `[VizUpdate Effect] Adding layer "${newLayer.title}" to map.`
              );

              // Ensure visualization flags are set
              newLayer.isVisualizationLayer = true;
              newLayer.visualizationType = vizType;

              // Add to map
              mapView.map.add(newLayer, 0);

              // Store in ref
              if (activeLayersRef?.current) {
                activeLayersRef.current[activeTab] = newLayer;
                console.log(
                  `[VizUpdate Effect] Stored layer in ref for tab ${activeTab}:`,
                  newLayer.id
                );
              }

              // Wait for layer to be ready
              await newLayer.when();

              if (!isMounted) return;

              // Handle special layer types
              const specialTypes = ["pipe", "comp", "custom"];
              const isSpecialType = specialTypes.includes(vizType);

              if (isSpecialType && config) {
                setCustomLegendContent({
                  type: vizType,
                  config: config,
                });
                if (legend) legend.visible = false;
              } else if (legend && !isEditorOpen) {
                // Standard Esri legend for non-special types
                legend.layerInfos = [
                  {
                    layer: newLayer,
                    title: newLayer.title || vizType,
                    hideLayersNotInCurrentView: false,
                  },
                ];
                legend.visible = true;
                setCustomLegendContent(null);
              }

              // --- Critical: Load saved label positions after layer creation with enhanced edit preservation ---
              if (labelManagerRef.current) {
                // Give the layer a moment to fully initialize
                setTimeout(() => {
                  try {
                    console.log(
                      `[VizUpdate Effect] Loading saved label positions for ${vizType} layer`
                    );

                    // Pass true as third parameter to preserve edits when loading positions
                    const loadResult = labelManagerRef.current.loadPositions(
                      true,
                      true,
                      true
                    );
                    console.log(
                      `[VizUpdate Effect] Loaded ${
                        loadResult.count || 0
                      } saved label positions with edit preservation`
                    );

                    // Configure label manager for specific visualization type
                    labelManagerRef.current.configureLayerSettings(vizType);
                  } catch (err) {
                    console.error(
                      "[VizUpdate Effect] Error loading saved label positions:",
                      err
                    );
                  }
                }, 500);
              }
            } else {
              console.error(
                `[VizUpdate Effect] Failed to create layer for type: ${vizType}`
              );
              if (legend) legend.visible = false;
              setCustomLegendContent(null);
            }
          } catch (error) {
            console.error(`[VizUpdate Effect] Error creating layer:`, error);
            if (legend) legend.visible = false;
            setCustomLegendContent(null);
          }
        } else {
          console.log(
            "[VizUpdate Effect] Core Map active or no visualization selected. No layer added."
          );
          if (legend) legend.visible = false;
          setCustomLegendContent(null);
        }
      } catch (error) {
        console.error("[VizUpdate Effect] Unhandled error:", error);
        if (legend) legend.visible = false;
        setCustomLegendContent(null);
      }

      console.log("[VizUpdate Effect] Update finished.");
    };

    // Execute update immediately
    updateVisualizationAndLegend();

    // Clean up on unmount or dependencies change
    return () => {
      isMounted = false;
      abortController.abort();

      // Save any pending edits before cleanup
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.savePositions === "function"
      ) {
        try {
          console.log(
            "[VizUpdate Effect] Saving label positions during cleanup"
          );
          labelManagerRef.current.savePositions(true);
        } catch (err) {
          console.error(
            "[VizUpdate Effect] Error saving positions during cleanup:",
            err
          );
        }
      }

      console.log(
        "[VizUpdate Effect] Cleanup: Component unmounted or dependencies changed."
      );
    };
  }, [
    activeTab,
    tabs,
    mapView,
    legend,
    isEditorOpen,
    isConfigLoading,
    initialLayerConfigurations,
  ]);

  useEffect(() => {
    try {
      console.log(
        "ArcGIS API Key:",
        import.meta.env.VITE_ARCGIS_API_KEY ? "Loaded" : "Not Found"
      );

      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

      if (!esriConfig.apiKey) {
        console.error("ArcGIS API Key is missing or undefined");
        // Optionally show a user-friendly error message
        return;
      }

      esriConfig.assetsPath = "https://js.arcgis.com/4.31/@arcgis/core/assets/";

      // CORS configuration
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
        "services8.arcgis.com",
      ];

      serversToAdd.forEach((server) => {
        if (!esriConfig.request.corsEnabledServers.includes(server)) {
          esriConfig.request.corsEnabledServers.push(server);
        }
      });

      // Add request interceptor for debugging
      esriConfig.request.interceptors.push({
        before: (params) => {
          console.log("ArcGIS Request Interceptor:", {
            url: params.url,
            method: params.method,
            headers: params.headers,
          });
        },
        error: (error) => {
          console.error("ArcGIS Request Error:", error);
        },
      });
    } catch (error) {
      console.error("ArcGIS Configuration Error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
  }, []);

  // Use the tab-specific configuration when switching tabs or rendering
  useEffect(() => {
    if (!mapView?.map || !legend) return;
    updateVisualizationLayer();
  }, [
    activeTab,
    tabs, // Added tabs to the dependency array
    mapView,
    legend,
    isEditorOpen,
    selectedAreaType,
  ]);

  useEffect(() => {
    // Define the async function inside the effect
    const initializeConfigurations = async () => {
      // Guard clauses: Ensure necessary dependencies are ready
      if (!projectId) {
        console.log(
          "[Effect] No project ID available, skipping configuration initialization."
        );
        // Set default tabs if no project ID is found, ensure UI is consistent
        setTabs([
          {
            id: 1,
            name: "Core Map",
            active: true,
            visualizationType: null,
            areaType: areaTypes[0],
            layerConfiguration: null,
            isEditing: false,
          },
        ]);
        setActiveTab(1);
        setIsConfigLoading(false); // Mark loading as complete
        return; // Exit early
      }

      if (!mapView?.map || !legend) {
        // Wait for map and legend to be ready
        console.log(
          "[Effect] Waiting for map view and legend to initialize..."
        );
        // Optional: Set loading state here if not already set
        // setIsConfigLoading(true);
        return; // Exit and wait for dependencies to update
      }

      // Proceed with loading configurations
      console.log(
        `[Effect] Initializing configurations for project: ${projectId}`
      );
      setIsConfigLoading(true); // Set loading state

      try {
        // Fetch configurations using the API helper
        const response = await mapConfigurationsAPI.getAll(projectId); // Already includes logging
        const configs = response?.data; // Safely access data

        console.log("[Effect] Received configurations from API:", configs);

        // Check if the fetched data is valid
        if (!Array.isArray(configs) || configs.length === 0) {
          console.log(
            "[Effect] No configurations found in API response, using default tabs."
          );
          setTabs([
            {
              id: 1,
              name: "Core Map",
              active: true, // Core Map starts active if no others exist
              visualizationType: null,
              areaType: areaTypes[0],
              layerConfiguration: null,
              isEditing: false,
            },
          ]);
          setActiveTab(1); // Ensure Core Map is the active tab
          // Clean up any stray visualization layers from previous state
          const layersToRemove = mapView.map.layers
            .filter((layer) => layer?.isVisualizationLayer)
            .toArray();
          if (layersToRemove.length > 0) mapView.map.removeMany(layersToRemove);
          legend.visible = false; // Hide legend
          setIsConfigLoading(false); // Mark loading as complete
          return; // Exit after setting defaults
        }

        // Create the base tabs array starting with Core Map (inactive initially)
        const newTabs = [
          {
            id: 1, // Keep consistent ID for Core Map
            name: "Core Map",
            active: false, // Will be activated later if it's the only tab or first tab
            visualizationType: null,
            areaType: areaTypes[0], // Default area type for Core Map
            layerConfiguration: null,
            isEditing: false,
          },
        ];

        // Process each configuration from the API response
        configs.forEach((config) => {
          if (!config || !config.id) {
            // Check if config and its ID exist
            console.warn(
              "[Effect] Skipping invalid config object received from API:",
              config
            );
            return; // Skip this config
          }

          console.log("[Effect] Processing config:", config);

          // Determine the next available ID (simple increment, ensure no conflicts with Core Map ID 1)
          // Using API config.id is generally better if available and unique
          const newTabId = config.id; // Use the ID from the database

          // --- Robust Area Type Handling ---
          const configAreaType = config.area_type; // e.g., 'tract', 'county', 11, 12
          let areaType = areaTypes[0]; // Default to the first area type

          if (configAreaType !== null && configAreaType !== undefined) {
            const areaTypeStr = String(configAreaType).toLowerCase();
            const foundType = areaTypes.find(
              (type) =>
                String(type.value) === areaTypeStr || // Match numeric value as string
                type.label.toLowerCase() === areaTypeStr // Match label (tract, county)
            );
            if (foundType) {
              areaType = foundType;
            } else {
              console.warn(
                `[Effect] Could not resolve area type "${configAreaType}", using default "${areaType.label}".`
              );
            }
          } else {
            console.warn(
              `[Effect] Config ${config.tab_name} missing area_type, using default "${areaType.label}".`
            );
          }
          // --- End Area Type Handling ---

          console.log(
            `[Effect] Config: ${config.tab_name}, Backend AreaType: ${configAreaType}, Resolved AreaType:`,
            areaType
          );

          // Create the new tab object
          const newTab = {
            id: newTabId, // Use the actual ID from the database
            configId: config.id, // Explicitly store the database config ID
            name: config.tab_name,
            active: false, // Set active status later
            visualizationType: config.visualization_type,
            areaType: areaType, // Use the resolved areaType object
            layerConfiguration: config.layer_configuration, // Use the config from DB
            isEditing: false,
          };

          console.log("[Effect] Created new tab:", newTab);
          newTabs.push(newTab);
        });

        // Activate the first tab (which will be Core Map if no others, or the first loaded config if Core Map isn't first)
        // Let's always activate Core Map initially if configs were loaded.
        if (newTabs.length > 0) {
          newTabs[0].active = true; // Activate Core Map
          setActiveTab(1); // Set active tab ID to Core Map's ID
        }

        console.log(
          "[Effect] Setting tabs state after initialization:",
          newTabs
        );
        setTabs(newTabs); // Update the state with all tabs

        // No need to explicitly call updateVisualizationLayer here,
        // as changing `tabs` and `activeTab` state will trigger the other useEffect
        // that depends on them, ensuring the correct layer is displayed for the active tab (which is Core Map initially).
      } catch (error) {
        console.error("[Effect] Error initializing configurations:", error);
        // Set default tabs state on error to prevent broken UI
        setTabs([
          {
            id: 1,
            name: "Core Map",
            active: true,
            visualizationType: null,
            areaType: areaTypes[0],
            layerConfiguration: null,
            isEditing: false,
          },
        ]);
        setActiveTab(1);
      } finally {
        setIsConfigLoading(false); // Ensure loading state is always turned off
        console.log("[Effect] Configuration initialization complete.");
      }
    };

    // Call the initialization function
    initializeConfigurations();

    // No cleanup needed in this effect unless subscribing to something
    // return () => { /* cleanup logic */ };

    // Dependencies: Re-run when projectId, mapView, or legend changes/becomes available
  }, [projectId, mapView, legend]); // Make sure all external dependencies used are listed

  useEffect(() => {
    if (mapView?.ready) {
      setupLabelManagement();

      // Enhanced cleanup with improved edit persistence
      return () => {
        if (labelManagerRef.current) {
          try {
            // Save any pending changes
            console.log("[MapComponent] Saving labels before cleanup");
            labelManagerRef.current.saveLabels();
            // Clean up
            labelManagerRef.current.destroy();
            labelManagerRef.current = null;
          } catch (err) {
            console.error(
              "[MapComponent] Error during label manager cleanup:",
              err
            );
          }
        }
      };
    }
  }, [mapView?.ready, setupLabelManagement]);

  // Update the useEffect that calls loadMapConfigurations
  useEffect(() => {
    if (mapView?.map) {
      loadMapConfigurations();
    }
  }, [mapView]);

  // Add these useEffects after your existing ones
  useEffect(() => {
    // Load auto-saved configurations on mount
    loadMapConfigurations(AUTO_SAVE_KEY, false);
  }, []);

  // In MapComponent.jsx - Add this useEffect to listen for refresh events
  useEffect(() => {
    // Event listener for forced visualization refreshes
    const handleRefreshVisualization = (event) => {
      const { tabId, config } = event.detail;
      console.log(
        "[RefreshEvent] Received refresh event for tab",
        tabId,
        "with config:",
        config
      );

      if (!tabId || !mapView?.map) return;

      // Get the tab data
      const tabData = tabs.find((tab) => tab.id === tabId);
      if (!tabData) {
        console.error("[RefreshEvent] Could not find tab data for ID:", tabId);
        return;
      }

      // Get the visualization type
      let vizType = tabData.visualizationType;
      if (!vizType) return;

      // Normalize visualization type
      if (vizType === "pipeline") vizType = "pipe";
      if (vizType === "comps") vizType = "comp";

      console.log(
        `[RefreshEvent] Refreshing visualization for tab ${tabId}, type: ${vizType}`
      );

      // Force layer removal first
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer);
        }
      });

      if (layersToRemove.length > 0) {
        console.log(
          `[RefreshEvent] Removing ${layersToRemove.length} existing visualization layers`
        );
        mapView.map.removeMany(layersToRemove);
      }

      // Create a new layer with the updated configuration
      createLayers(
        vizType,
        config || tabData.layerConfiguration,
        initialLayerConfigurations,
        tabData.areaType
      )
        .then((newLayer) => {
          if (!newLayer) {
            console.error("[RefreshEvent] Failed to create new layer");
            return;
          }

          // Add the new layer to the map
          console.log(`[RefreshEvent] Adding new ${vizType} layer to map`);
          mapView.map.add(newLayer, 0);

          // Special handling for specific layer types
          if (vizType === "pipe") {
            console.log("[RefreshEvent] Refreshing pipe visualization");
            handlePipeVisualization(tabData);
          } else if (vizType === "comp") {
            console.log("[RefreshEvent] Refreshing comp visualization");
            handleCompVisualization(tabData);
          } else if (vizType === "custom") {
            console.log("[RefreshEvent] Refreshing custom visualization");
            handleCustomDataVisualization(tabData);
          }

          // Update legend if necessary
          if (legend) {
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen;
          }
        })
        .catch((error) => {
          console.error(
            "[RefreshEvent] Error creating or updating layer:",
            error
          );
        });
    };

    // Add event listener for refresh events
    window.addEventListener("refreshVisualization", handleRefreshVisualization);

    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener(
        "refreshVisualization",
        handleRefreshVisualization
      );
    };
  }, [
    mapView,
    tabs,
    legend,
    isEditorOpen,
    handlePipeVisualization,
    handleCompVisualization,
    handleCustomDataVisualization,
  ]);

  useEffect(() => {
    if (!mapView || !mapView.ready) return;

    // Load saved label positions once the map is ready with enhanced edit preservation
    const loadSavedLabelPositions = () => {
      if (labelManagerRef.current && labelManagerRef.current.loadPositions) {
        try {
          console.log("[Map] Loading saved label positions after map ready");
          // Pass true as third parameter to preserve edited labels
          const loadResult = labelManagerRef.current.loadPositions(
            true,
            true,
            true
          );
          console.log(
            `[Map] Loaded ${
              loadResult.count || 0
            } label positions after map ready with edit preservation`
          );

          // Ensure edits are properly marked for future session persistence
          if (
            typeof labelManagerRef.current.markSavedPositionsAsEdited ===
            "function"
          ) {
            labelManagerRef.current.markSavedPositionsAsEdited();
            console.log(
              "[Map] Marked loaded positions as edited for persistence"
            );
          }
        } catch (err) {
          console.error(
            "[Map] Error loading label positions after map ready:",
            err
          );
        }
      }
    };

    // Add a short delay to ensure everything is initialized
    const timeoutId = setTimeout(loadSavedLabelPositions, 1000);

    // Clean up the timeout on unmount
    return () => clearTimeout(timeoutId);
  }, [mapView?.ready]);

  return (
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left Side: Tabs and New Map button */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-2 overflow-x-auto">
              {/* Map through tabs */}
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
                      // Input field for renaming tab
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
                              t.id === tab.id
                                ? { ...t, name: e.target.value }
                                : t
                            )
                          )
                        }
                        onKeyDown={(e) => handleNameKeyDown(tab.id, e)}
                        onBlur={(e) => handleNameChange(tab.id, e.target.value)}
                        className="bg-transparent border-none focus:outline-none text-inherit w-24 px-1"
                        autoFocus
                      />
                    ) : (
                      // Display tab name and controls
                      <div className="flex items-center">
                        <span>{tab.name}</span>
                        {/* Show controls only for non-core tabs */}
                        {tab.id !== 1 && (
                          <>
                            {/* Edit Tab Name Icon (Pencil) */}
                            <div
                              onClick={(e) => startEditing(tab.id, e)}
                              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                              title="Edit tab name"
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
                            {/* Delete Tab Icon (X) */}
                            <div
                              onClick={(e) => deleteTab(tab.id, e)}
                              className="ml-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
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
              {/* New Map Button */}
              <button
                onClick={addNewTab}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-colors duration-200 ease-in-out"
              >
                + New Map
              </button>
            </div>
          </div>

          {/* Right Side: Conditional Dropdowns, Edit Button, Save Button */}
          <div className="flex items-center space-x-2">
            {/* IIFE to manage scope and conditional rendering */}
            {activeTab !== 1 &&
              (() => {
                // Only show controls if not the Core Map tab
                const activeTabData = tabs.find((tab) => tab.id === activeTab);
                // Find the corresponding visualization option to check its type
                const activeVisOption = visualizationOptions.find(
                  (opt) => opt.value === activeTabData?.visualizationType
                );
                // Dropdowns shown only if the active visualization option is heat or dot density
                const showDropdowns =
                  activeVisOption &&
                  (activeVisOption.type === "class-breaks" ||
                    activeVisOption.type === "dot-density");
                // Edit button shown if the active tab is NOT the core map (ID 1)
                const showEditButton = activeTab !== 1;

                return (
                  <>
                    {/* Conditionally render Area Type and Visualization Dropdowns */}
                    {showDropdowns && (
                      <>
                        <select
                          value={
                            activeTabData?.areaType?.value || areaTypes[0].value
                          }
                          onChange={(e) => {
                            const newAreaType = areaTypes.find(
                              (type) => type.value === parseInt(e.target.value)
                            );
                            handleAreaTypeChange(activeTab, newAreaType);
                          }}
                          className="block w-36 rounded-md border border-gray-300 dark:border-gray-600
                                   bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium
                                   text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2
                                   focus:ring-blue-500 focus:border-blue-500"
                        >
                          {areaTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        <SearchableDropdown
                          options={visualizationOptions}
                          value={activeTabData?.visualizationType || ""}
                          onChange={(newValue) =>
                            handleVisualizationChange(activeTab, newValue)
                          }
                          placeholder="Select visualization"
                          searchPlaceholder="Search visualizations..."
                          className="w-56"
                        />
                      </>
                    )}

                    {showEditButton && ( // Now shows for ANY non-core tab
                      <div className="flex">
                        <button
                          onClick={() => {
                            setIsLabelEditMode(false); // Ensure we're not in label edit mode
                            setIsEditorOpen(true);
                          }}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-l hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                          title="Edit layer properties"
                        >
                          Edit Map/Legend
                        </button>

                        {/* Add the Edit Labels button */}
                        <button
                          onClick={toggleLabelEditMode}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-r border-l border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none flex items-center"
                          title="Edit map labels"
                        >
                          <Tag className="h-3.5 w-3.5 mr-1" />
                          Edit Labels
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

            {/* Save Button (Always visible) */}
            <button
              onClick={async () => {
                // --- Existing Save Logic ---
                try {
                  setIsSaving(true);
                  const configurations = tabs
                    .filter((tab) => tab.id !== 1)
                    .map((tab, index) => ({
                      project_id: projectId,
                      project: projectId,
                      tab_name: tab.name,
                      visualization_type: tab.visualizationType || "",
                      area_type: convertAreaTypeToString(
                        tab.id === activeTab
                          ? selectedAreaType.value
                          : tab.areaType?.value
                      ),
                      layer_configuration: tab.layerConfiguration,
                      order: index,
                    }));

                  const existingConfigsResponse =
                    await mapConfigurationsAPI.getAll(projectId);
                  const existingConfigs = existingConfigsResponse?.data;

                  if (
                    Array.isArray(existingConfigs) &&
                    existingConfigs.length > 0
                  ) {
                    await Promise.all(
                      existingConfigs.map((config) =>
                        mapConfigurationsAPI
                          .delete(config.id)
                          .catch((err) =>
                            console.error(
                              `Failed to delete config ${config.id}:`,
                              err
                            )
                          )
                      )
                    );
                    console.log(
                      `Deleted ${existingConfigs.length} existing configurations.`
                    );
                  }

                  const createdConfigs = []; // Store created config IDs
                  for (const config of configurations) {
                    // Ensure project field is sent if API requires it
                    const response = await mapConfigurationsAPI.create(
                      projectId,
                      { ...config, project: projectId }
                    );
                    if (response.data && response.data.id) {
                      createdConfigs.push({
                        tabName: config.tab_name,
                        configId: response.data.id,
                      });
                    }
                  }

                  // Update tab state with new config IDs
                  setTabs((prevTabs) =>
                    prevTabs.map((t) => {
                      const created = createdConfigs.find(
                        (c) => c.tabName === t.name
                      );
                      // Make sure configId is updated or kept if it already existed
                      const existingConfigId = t.configId;
                      const newConfigId = created
                        ? created.configId
                        : existingConfigId;
                      return { ...t, configId: newConfigId };
                    })
                  );

                  console.log(
                    `Saved ${configurations.length} map configurations.`
                  );
                  alert("Map configurations saved successfully");
                } catch (error) {
                  console.error(
                    "[Save] Error saving map configurations:",
                    error.response?.data || error.message || error
                  );
                  alert(
                    "Failed to save map configurations. Check console for details."
                  );
                } finally {
                  setIsSaving(false);
                }
                // --- End Existing Save Logic ---
              }}
              className={`p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400
                          dark:hover:text-gray-300 focus:outline-none ${
                            isSaving
                              ? "opacity-50 cursor-not-allowed animate-pulse"
                              : ""
                          }`}
              title="Save map configurations"
              disabled={isSaving}
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
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full">
            {/* Zoom Alert Overlay */}
            <ZoomAlert />
            {renderCustomLegend()}
          </div>
        </div>

        {/* Layer Properties Editor Panel */}
        <div className="relative">
          {" "}
          {/* Keep this relative for absolute positioning of the child */}
          {/* Conditionally render editor panel container - check activeTab !== 1 */}
          {activeTab !== 1 && (
            <div
              className={`
                w-[500px] bg-white dark:bg-gray-800 border-l border-gray-200
                dark:border-gray-700 transform transition-transform duration-300 ease-in-out
                absolute h-full z-20 /* Ensure editor is above map */
                ${isEditorOpen ? "translate-x-0" : "translate-x-full"}
              `}
              // --- Restore specific positioning ---
              style={{
                right: "440px", // Position 440px from the right edge of the parent
                top: "0",
              }}
              // --- End Restore specific positioning ---
            >
              <LayerPropertiesEditor
                isOpen={isEditorOpen}
                onClose={() => {
                  // Save any pending label edits before closing
                  if (labelManagerRef.current) {
                    try {
                      console.log(
                        "Saving label positions before closing editor"
                      );
                      const saveResult =
                        labelManagerRef.current.savePositions(true);
                      console.log(
                        `Saved ${saveResult.count || 0} label positions`
                      );

                      // Force reload saved positions to ensure they're applied
                      setTimeout(() => {
                        try {
                          const loadResult =
                            labelManagerRef.current.loadPositions(true, true);
                          console.log(
                            `Loaded ${
                              loadResult.count || 0
                            } saved label positions after editor close`
                          );

                          // Force refresh for proper visualization
                          labelManagerRef.current._throttledUpdateLabelPositions();
                        } catch (err) {
                          console.error(
                            "Error reloading label positions after editor close:",
                            err
                          );
                        }
                      }, 300);
                    } catch (err) {
                      console.error(
                        "Error saving label positions before closing editor:",
                        err
                      );
                    }
                  }

                  // Close the editor
                  setIsEditorOpen(false);
                  setIsLabelEditMode(false); // Reset label edit mode when closing editor

                  // Apply any pending label changes and update the map
                  if (labelManagerRef.current) {
                    labelManagerRef.current._throttledUpdateLabelPositions();
                  }
                }}
                visualizationType={
                  tabs.find((tab) => tab.id === activeTab)?.visualizationType
                }
                layerConfig={
                  tabs.find((tab) => tab.id === activeTab)
                    ?.layerConfiguration ||
                  (tabs.find((tab) => tab.id === activeTab)?.visualizationType
                    ? initialLayerConfigurations[
                        tabs.find((tab) => tab.id === activeTab)
                          .visualizationType
                      ]
                    : null)
                }
                selectedAreaType={
                  tabs.find((tab) => tab.id === activeTab)?.areaType ||
                  areaTypes[0]
                }
                onConfigChange={handleLayerConfigChange}
                onPreview={handleConfigPreview}
                projectId={projectId}
                activeTab={activeTab}
                tabs={tabs}
                // Add these new props
                mapView={mapView}
                labelManager={labelManagerRef.current}
                isLabelEditMode={isLabelEditMode}
                onLabelEditModeChange={setIsLabelEditMode}
                activeLayer={activeLayersRef.current[activeTab]}
              />
            </div>
          )}
        </div>
      </div>

      {/* New Map Dialog */}
      <NewMapDialog
        isOpen={isNewMapDialogOpen}
        onClose={() => setIsNewMapDialogOpen(false)}
        onCreateMap={handleCreateMap}
        visualizationOptions={visualizationOptions}
        areaTypes={areaTypes}
      />
    </div>
  );
}
