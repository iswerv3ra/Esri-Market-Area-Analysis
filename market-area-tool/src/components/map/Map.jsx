// src/components/map/Map.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { Tag, Maximize } from "lucide-react"; // Added Maximize for the new button icon
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Zoom from "@arcgis/core/widgets/Zoom";
import Home from "@arcgis/core/widgets/Home";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import Legend from "@arcgis/core/widgets/Legend";
import Extent from "@arcgis/core/geometry/Extent";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import LabelManager from "../../services/SimplifiedLabelManager";
import SimpleLabelDragger from "@/services/SimpleLabelDragger";
import { useMap } from "../../contexts/MapContext";
import { mapConfigurationsAPI } from "../../services/api";
import LayerPropertiesEditor from "./LayerPropertiesEditor";
import LabelEditor from "./LabelEditor";
import PropTypes from "prop-types";
import axios from "axios";
import SearchableDropdown from "./SearchableDropdown";
import NewMapDialog from "./NewMapDialog";
import CustomLegend from "./CustomLegend";
import ZoomAlert from "./ZoomAlert";
import { useNavigate, useParams } from "react-router-dom";
import {
  initialLayerConfigurations,
  visualizationOptions,
  areaTypes,
  createClassBreaks,
} from "./mapConfig";
import {
  createLayers,
  createPipeLayer,
  createCompLayer,
  createGraphicsLayerFromCustomData,
} from "./mapLayerUtils";

// Import ReactDOM for rendering the custom button
import ReactDOM from "react-dom/client";
import { useZoomTool } from "./ZoomTool";
import MapZoomToolButton from "./MapZoomToolButton";

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

  // Drawing rectangle zoom state
  const rectangleRef = useRef(null);
  const isDrawingRef = useRef(false);
  const drawStartPointRef = useRef(null);
  const drawEndPointRef = useRef(null);

  const activeLayersRef = useRef({});
  const labelManagerRef = useRef(null);
  const [isLabelManagerReady, setIsLabelManagerReady] = useState(false);
  const [isLabelEditorOpen, setIsLabelEditorOpen] = useState(false);
  const [labelDragger, setLabelDragger] = useState(null);
  const [isPlacingSiteLocation, setIsPlacingSiteLocation] = useState(false);
  const [siteLocationMarker, setSiteLocationMarker] = useState(null);
  const [isMarketAreaInteractionActive, setIsMarketAreaInteractionActive] =
    useState(false);

  const projectId =
    routeProjectId || localStorageProjectId || sessionStorageProjectId;

  const {
    isZoomToolActive,
    setIsZoomToolActive,
    isDrawing,
    drawStartPoint,
    drawEndPoint,
  } = useZoomTool(mapView, mapRef);
  const [zoomToolButtonRoot, setZoomToolButtonRoot] = useState(null);

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

  useEffect(() => {
    // Check if both the button root and mapView are available
    if (zoomToolButtonRoot && mapView?.ready) {
      try {
        // Render the MapZoomToolButton component in the root
        zoomToolButtonRoot.render(
          <MapZoomToolButton
            isActive={isZoomToolActive}
            onClick={() => setIsZoomToolActive(!isZoomToolActive)}
          />
        );
      } catch (error) {
        console.error("[Map] Error rendering zoom tool button:", error);
      }
    }
  }, [zoomToolButtonRoot, isZoomToolActive, mapView?.ready]);
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

  /**
   * Toggles site location placement mode for market areas
   * Controls both UI state and map interaction behavior
   *
   * @param {boolean} isActive - Whether to activate or deactivate placement mode
   * @param {Object} options - Additional options for placement
   * @returns {void}
   */
  const toggleSiteLocationPlacement = useCallback(
    (isActive, options = {}) => {
      console.log(
        `[Map] ${
          isActive ? "Activating" : "Deactivating"
        } site location placement mode`,
        options
      );

      // Update internal state
      setIsPlacingSiteLocation(isActive);
      setIsMarketAreaInteractionActive(isActive);

      // Clear any existing temporary marker when deactivating
      if (!isActive && siteLocationMarker) {
        try {
          // Remove the marker from the map
          if (
            mapView?.graphics &&
            typeof mapView.graphics.remove === "function"
          ) {
            mapView.graphics.remove(siteLocationMarker);
          }
          setSiteLocationMarker(null);
        } catch (error) {
          console.error("[Map] Error clearing site location marker:", error);
        }
      }

      // Update cursor style to indicate placement mode
      if (mapView?.container) {
        mapView.container.style.cursor = isActive ? "crosshair" : "default";
      }

      // If we have a MapContext reference, inform it of the mode change
      if (
        window.mapContextInstance &&
        typeof window.mapContextInstance.setPlacementMode === "function"
      ) {
        window.mapContextInstance.setPlacementMode(
          "siteLocation",
          isActive,
          options
        );
      } else {
        console.warn(
          "[Map] MapContext instance not available for site location mode change"
        );
      }
    },
    [mapView, siteLocationMarker]
  );

  /**
   * Handles map clicks when in site location placement mode
   * Creates a temporary marker and notifies listeners of the coordinates
   *
   * @param {Object} event - Map click event object
   * @returns {Promise<void>}
   */
  const handleSiteLocationPlacement = useCallback(
    async (event) => {
      if (!isPlacingSiteLocation || !mapView) return;

      try {
        // Prevent default map behavior
        event.stopPropagation();

        console.log(
          "[Map] Processing site location placement at",
          event.mapPoint
        );

        // Get the click coordinates
        const point = event.mapPoint;
        const latitude = point.latitude;
        const longitude = point.longitude;

        // Import necessary modules
        const [
          { default: Graphic },
          { default: Point },
          { default: SimpleMarkerSymbol },
          { default: Color },
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/Point"),
          import("@arcgis/core/symbols/SimpleMarkerSymbol"),
          import("@arcgis/core/Color"),
        ]);

        // Remove any existing temporary marker
        if (siteLocationMarker && mapView.graphics) {
          mapView.graphics.remove(siteLocationMarker);
        }

        // Create a new marker symbol
        const markerSymbol = new SimpleMarkerSymbol({
          style: "diamond",
          color: new Color([255, 215, 0, 0.8]), // Gold color with transparency
          size: 14,
          outline: {
            color: new Color([255, 140, 0, 1]), // Dark orange outline
            width: 2,
          },
        });

        // Create the point geometry
        const pointGeometry = new Point({
          latitude,
          longitude,
          spatialReference: { wkid: 4326 },
        });

        // Create the graphic
        const graphic = new Graphic({
          geometry: pointGeometry,
          symbol: markerSymbol,
          attributes: {
            isTemporary: true,
            isMarketAreaSiteLocation: true,
            latitude,
            longitude,
          },
        });

        // Add to map
        mapView.graphics.add(graphic);
        setSiteLocationMarker(graphic);

        // Dispatch custom event to notify listeners (MarketAreaForm)
        const siteLocationEvent = new CustomEvent("siteLocationPlaced", {
          detail: {
            latitude,
            longitude,
            isTemporary: true,
          },
        });
        document.dispatchEvent(siteLocationEvent);

        // Also notify MapContext if available
        if (
          window.mapContextInstance &&
          typeof window.mapContextInstance.handleSiteLocationPlaced ===
            "function"
        ) {
          window.mapContextInstance.handleSiteLocationPlaced(
            latitude,
            longitude
          );
        }

        // Automatically exit placement mode after successful placement
        setTimeout(() => {
          toggleSiteLocationPlacement(false);
        }, 300);
      } catch (error) {
        console.error("[Map] Error during site location placement:", error);
        toggleSiteLocationPlacement(false);
      }
    },
    [
      isPlacingSiteLocation,
      mapView,
      siteLocationMarker,
      toggleSiteLocationPlacement,
    ]
  );

  const setupLabelDragHandling = (view) => {
    if (!view || !view.map) return;

    console.log("[Map] Setting up enhanced label drag handling");

    // Track if we're currently dragging a label
    let isDraggingLabel = false;
    let draggedLabel = null;
    let dragStartPoint = null;
    let originalOffset = null;
    let originalNavState = null;

    // Store handlers for proper cleanup
    const handlers = [];

    handlers.push(pointerDownHandler);

    // Handle pointer move for drag operation
    const pointerMoveHandler = view.on("pointer-move", (event) => {
      if (
        !isDraggingLabel ||
        !draggedLabel ||
        !dragStartPoint ||
        !originalOffset
      )
        return;

      // Prevent map interaction
      event.stopPropagation();

      // Calculate new position
      const dx = event.x - dragStartPoint.x;
      const dy = event.y - dragStartPoint.y;

      const newPosition = {
        x: originalOffset.x + dx,
        y: originalOffset.y - dy, // Invert Y for correct direction
      };

      try {
        // Update label position
        if (draggedLabel.symbol) {
          const newSymbol = draggedLabel.symbol.clone();
          newSymbol.xoffset = newPosition.x;
          newSymbol.yoffset = newPosition.y;
          draggedLabel.symbol = newSymbol;

          // Force refresh if needed
          if (typeof view.graphics?.refresh === "function") {
            view.graphics.refresh();
          }
        }
      } catch (error) {
        console.error(
          "[Map] Error updating label position during drag:",
          error
        );
      }
    });
    handlers.push(pointerMoveHandler);

    // Handle pointer up to end drag operation
    const pointerUpHandler = view.on("pointer-up", (event) => {
      if (!isDraggingLabel) return;

      // Prevent map interaction
      event.stopPropagation();

      try {
        // Save the final position to LabelManager if available
        if (window.labelManagerInstance) {
          if (
            typeof window.labelManagerInstance.updateLabelPosition ===
              "function" &&
            draggedLabel
          ) {
            const finalPosition = {
              x: draggedLabel.symbol?.xoffset || 0,
              y: draggedLabel.symbol?.yoffset || 0,
            };
            window.labelManagerInstance.updateLabelPosition(
              draggedLabel,
              finalPosition
            );
          }

          // Auto-save positions
          if (typeof window.labelManagerInstance.savePositions === "function") {
            window.labelManagerInstance.savePositions(true);
          }
        }

        // Restore cursor
        if (view.container) {
          view.container.style.cursor = "default";
        }

        // Restore map navigation
        if (view.navigation && originalNavState) {
          view.navigation.browserTouchPanEnabled =
            originalNavState.browserTouchPanEnabled;
          if (originalNavState.keyboardNavigation !== undefined) {
            view.navigation.keyboardNavigation =
              originalNavState.keyboardNavigation;
          }
        }
      } catch (error) {
        console.error("[Map] Error finishing label drag operation:", error);
      } finally {
        // Reset drag state
        isDraggingLabel = false;
        draggedLabel = null;
        dragStartPoint = null;
        originalOffset = null;
        originalNavState = null;
      }
    });
    handlers.push(pointerUpHandler);

    // Handle pointer leave to cancel drag
    const pointerLeaveHandler = view.on("pointer-leave", (event) => {
      if (!isDraggingLabel) return;

      try {
        // Restore cursor
        if (view.container) {
          view.container.style.cursor = "default";
        }

        // Restore map navigation
        if (view.navigation && originalNavState) {
          view.navigation.browserTouchPanEnabled =
            originalNavState.browserTouchPanEnabled;
          if (originalNavState.keyboardNavigation !== undefined) {
            view.navigation.keyboardNavigation =
              originalNavState.keyboardNavigation;
          }
        }
      } catch (error) {
        console.error(
          "[Map] Error handling pointer leave during label drag:",
          error
        );
      } finally {
        // Reset drag state
        isDraggingLabel = false;
        draggedLabel = null;
        dragStartPoint = null;
        originalOffset = null;
        originalNavState = null;
      }
    });
    handlers.push(pointerLeaveHandler);

    // Store handlers on view for cleanup
    view.labelDragHandlers = handlers;

    console.log(
      "[Map] Label drag handling initialized with",
      handlers.length,
      "handlers"
    );

    // Make the Label Manager instance globally available
    // (You'll need to set this when creating the label manager)
    if (labelManagerRef.current) {
      window.labelManagerInstance = labelManagerRef.current;
      console.log("[Map] Exposed label manager instance globally");
    }

    return handlers;
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

    // --- Added Defensive Check ---
    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.setContext === "function"
    ) {
      // Set context with project ID and get the correct configId from the provided tabData
      const projectId =
        localStorage.getItem("currentProjectId") ||
        sessionStorage.getItem("currentProjectId");
      if (projectId) {
        // Use tabData instead of undefined activeTabData
        labelManagerRef.current.setContext(projectId, tabData?.configId);
      }
    } else {
      console.warn(
        "[handlePipeVisualization] Label manager ref or setContext method not available."
      );
    }
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
        console.log(
          `[handleCompVisualization] Using directly passed layer for tab ${tabId}:`,
          compLayer.id
        );
      }
      // Priority 2: Check stored reference in activeLayersRef
      else if (activeLayersRef.current[tabId]) {
        compLayer = activeLayersRef.current[tabId];
        console.log(
          `[handleCompVisualization] Found layer in ref for tab ${tabId}:`,
          compLayer.id
        );
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
          console.log(
            `[handleCompVisualization] Found target Comp layer: "${compLayer.title}"`
          );
          // Store in ref for future use
          activeLayersRef.current[tabId] = compLayer;
        } else {
          console.error(
            `[handleCompVisualization] No comp layer found for tab ${tabId}`
          );
          return; // Prevent further errors
        }
      }

      // Get the layer configuration for labels
      const layerConfig = tabData.layerConfiguration || {};
      const labelOptions = layerConfig.labelOptions || {};

      // --- Added Defensive Checks ---
      // Apply specialized settings for comp map visualization
      if (labelManagerRef.current) {
        try {
          // Configure label settings using the unified API
          if (
            typeof labelManagerRef.current.configureLayerSettings === "function"
          ) {
            labelManagerRef.current.configureLayerSettings("comp");
            console.log(
              `[handleCompVisualization] Applied comp-specific label settings`
            );
          } else {
            console.warn(
              "[handleCompVisualization] configureLayerSettings method not found on label manager."
            );
          }

          // Force a processing of this specific layer for labels
          // --- CORRECTED CALL ---
          if (typeof labelManagerRef.current.processLayer === "function") {
            setTimeout(() => {
              // Mark the layer to prevent removal during state updates
              if (compLayer) {
                compLayer._preventRemoval = true;
                compLayer._isProcessed = true; // Use consistent flag name if possible
              }

              console.log(
                `[handleCompVisualization] Processing comp layer with Label Manager`
              );
              // Add defensive check inside timeout
              if (
                labelManagerRef.current &&
                typeof labelManagerRef.current.processLayer === "function"
              ) {
                labelManagerRef.current.processLayer(compLayer); // Use public method
              } else {
                console.warn(
                  "[handleCompVisualization] processLayer method unavailable inside timeout."
                );
              }

              // Force a refresh after a short delay
              setTimeout(() => {
                // Add defensive check inside timeout
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  labelManagerRef.current.refreshLabels();
                  console.log(
                    `[handleCompVisualization] Refreshed labels for comp layer`
                  );
                } else {
                  console.warn(
                    "[handleCompVisualization] refreshLabels method unavailable inside timeout."
                  );
                }
              }, 200);
            }, 100);
          } else {
            console.warn(
              "[handleCompVisualization] processLayer method not found on label manager."
            );
          }
          // --- END CORRECTION ---

          // Apply any custom label settings from the configuration
          // (Removed call to non-existent updateOptions)
          // You might apply specific overrides here using updateLabelFontSize/Text if needed,
          // but generally configureLayerSettings should handle the basics.
          if (labelOptions) {
            console.log(
              "[handleCompVisualization] Custom label options found:",
              labelOptions
            );
            // If you need to apply these *after* initial processing:
            // setTimeout(() => { /* apply fontSize etc. using updateLabel... methods */ }, 300);
          }
        } catch (labelError) {
          console.error(
            `[handleCompVisualization] Error configuring labels:`,
            labelError
          );
        }
      } else {
        console.warn(
          `[handleCompVisualization] Label manager not available for comp layer`
        );
      }
      // --- End Defensive Checks ---

      // Ensure the layer is visible and protected from automatic removal
      if (compLayer) {
        compLayer.visible = true;
        compLayer._preventRemoval = true; // Add protection flag

        // Set a flag on the layer to prevent duplicate processing
        if (!compLayer._processedByCompVisualization) {
          compLayer._processedByCompVisualization = true;
          console.log(
            `[handleCompVisualization] Marked comp layer as processed to prevent duplicate handling`
          );
        }
      }

      // ENHANCEMENT: Set a flag to skip the next layer removal attempt
      // This will be checked in updateVisualizationLayer before removing layers
      window._skipNextLayerRemoval = true;
      console.log(
        `[handleCompVisualization] Set flag to skip next automatic layer removal`
      );

      setTimeout(() => {
        window._skipNextLayerRemoval = false; // Reset after a delay
      }, 1000);
    } catch (error) {
      console.error(
        "[handleCompVisualization] Error during comp visualization handling:",
        error
      );
    }
  };

  // --- Consolidated Open/Close Handlers ---
  const openLayerPropertiesEditor = () => {
    setIsLabelEditorOpen(false); // Close label editor if open
    setIsEditorOpen(true); // Open the main properties editor
  };

  const openLabelEditor = () => {
    setIsEditorOpen(false); // Close properties editor if open
    setIsLabelEditorOpen(true); // Open the label editor

    // Enable editing mode in the manager instance
    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.toggleEditingMode === "function"
    ) {
      try {
        labelManagerRef.current.toggleEditingMode(true);
        console.log(
          `[MapComponent] Label editing mode explicitly enabled for LabelEditor.`
        );
      } catch (error) {
        console.error("Error enabling label manager edit mode:", error);
      }
    } else {
      console.warn(
        "Cannot enable label manager mode: Ref invalid or toggleEditingMode method missing."
      );
    }
  };

  const closeSidePanel = () => {
    console.log("[closeSidePanel] Starting side panel closure...");

    // Save label positions if the label editor was open
    if (isLabelEditorOpen) {
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.savePositions === "function"
      ) {
        try {
          // Get size of editedLabels map before saving (for debugging)
          const editedLabelsSize =
            labelManagerRef.current.editedLabels?.size || 0;
          console.log(
            `[closeSidePanel] About to save ${editedLabelsSize} edited labels.`
          );

          // CRITICAL: Force immediate save with true parameter
          const saveResult = labelManagerRef.current.savePositions(true);
          console.log(
            `[closeSidePanel] Saved label positions before closing: ${saveResult.count} labels saved.`
          );

          // CRITICAL: Store a flag in localStorage to force reapplication on next refresh
          localStorage.setItem("labelStylesUpdated", "true");

          // If no positions were saved but we had edits, something is wrong
          if (saveResult.count === 0 && editedLabelsSize > 0) {
            console.warn(
              "[closeSidePanel] Warning: Had edited labels but none were saved!"
            );

            // Attempt second force save after delay
            setTimeout(() => {
              if (
                labelManagerRef.current &&
                typeof labelManagerRef.current.savePositions === "function"
              ) {
                try {
                  const retryResult =
                    labelManagerRef.current.savePositions(true);
                  console.log(
                    `[closeSidePanel] Retry save result: ${retryResult.count} labels saved`
                  );
                } catch (retryError) {
                  console.error(
                    "[closeSidePanel] Error in retry save:",
                    retryError
                  );
                }
              }
            }, 100);
          }
        } catch (error) {
          console.error("Error saving label positions:", error);
        }

        // AFTER saving, ensure editing mode is off
        if (typeof labelManagerRef.current.toggleEditingMode === "function") {
          try {
            labelManagerRef.current.toggleEditingMode(false, false); // Second param - don't clear selection
            console.log(
              "[closeSidePanel] Label editing mode disabled, selection preserved."
            );
          } catch (toggleError) {
            console.error(
              "Error toggling label manager mode off:",
              toggleError
            );
          }
        }
      }
    }

    // Close both panels
    setIsEditorOpen(false);
    setIsLabelEditorOpen(false);
    console.log("[closeSidePanel] Closed side panel(s).");

    // CRITICAL: Reapply styles with multiple refresh attempts to ensure they stick
    const refreshAttempts = () => {
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.refreshLabels === "function"
      ) {
        try {
          labelManagerRef.current.refreshLabels();
          console.log(
            "[closeSidePanel] Refreshed all labels after panel closure."
          );

          // First follow-up refresh after a short delay
          setTimeout(() => {
            if (
              labelManagerRef.current &&
              typeof labelManagerRef.current.refreshLabels === "function"
            ) {
              labelManagerRef.current.refreshLabels();
              console.log("[closeSidePanel] Second refresh completed");

              // Final refresh after everything has settled
              setTimeout(() => {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  labelManagerRef.current.refreshLabels();
                  console.log("[closeSidePanel] Final refresh completed");
                }
              }, 1000);
            }
          }, 200);
        } catch (refreshError) {
          console.error(
            "Error refreshing labels after panel closure:",
            refreshError
          );
        }
      }
    };

    // Delay the initial refresh to ensure UI updates first
    setTimeout(refreshAttempts, 100);
  };

  // --- End Consolidated Handlers ---

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
    const nameColumn = config?.customData?.nameColumn || config?.labelColumn; // Use labelColumn as fallback
    const valueColumn =
      config?.field || config?.customData?.valueColumn || config?.valueColumn; // Use field or valueColumn
    const latitudeColumn =
      config?.customData?.latitudeColumn ||
      config?.latitudeColumn ||
      "latitude";
    const longitudeColumn =
      config?.customData?.longitudeColumn ||
      config?.longitudeColumn ||
      "longitude";
    const symbolConfig = config?.symbol;
  
    // CRITICAL ENHANCEMENT: Check if labels should be disabled for the entire layer
    const disableLayerLabels = config.labelColumn === null || config.hasNoLabels || config.hideAllLabels;

  
    // Set the custom layer's labelsVisible property explicitly
    if (customLayer.labelsVisible !== undefined) {
      customLayer.labelsVisible = !disableLayerLabels;
      console.log(`Set custom layer labelsVisible to: ${!disableLayerLabels}`);
    }
  
    // Add layer-level flag to help label manager recognize this as a no-labels layer
    customLayer._hasNoLabels = disableLayerLabels;
    customLayer._hideAllLabels = disableLayerLabels;
  
    console.log(
      `Processing ${
        customData.length
      } custom points using name='${nameColumn || "N/A"}', value='${
        valueColumn || "N/A"
      }', lat='${latitudeColumn}', lon='${longitudeColumn}', labels disabled: ${disableLayerLabels}`
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
            isCustomPoint: true,
          };
  
          // Apply label settings based on configuration
          if (!disableLayerLabels) {
            // Normal case: If labels are enabled, set the label text
            attributes.labelText = item[nameColumn] || item.name || item.title || String(index + 1);
          } else {
            // CRITICAL FIX: When "None" is selected for labels, explicitly disable labels for this point
            attributes.noLabel = true;
            attributes._hideLabel = true;
            attributes._noLabelDisplay = true; // Additional flag for other label processors
            attributes.labelText = null; // Explicitly set to null to override defaults
          }
  
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
  
      // Add the graphics to the layer
      if (graphicsToAdd.length > 0) {
        customLayer.addMany(graphicsToAdd);
        console.log(`Added ${graphicsToAdd.length} graphics to custom layer`);
  
        // Process layer with label manager if needed
        if (labelManagerRef.current) {
          setTimeout(() => {
            try {
              console.log("Triggering label processing for new graphics...");
              
              // CRITICAL: Set label exclusion flags on the layer manager before processing
              if (disableLayerLabels && typeof labelManagerRef.current.setLayerLabelOptions === "function") {
                labelManagerRef.current.setLayerLabelOptions(customLayer.id, {
                  disableLabels: true,
                  hideAllLabels: true
                });
              }
              
              // CORRECTED CALL
              if (typeof labelManagerRef.current.processLayer === "function") {
                // Pass disableLabels flag as second parameter to processLayer
                labelManagerRef.current.processLayer(customLayer, disableLayerLabels);
              } else {
                console.warn(
                  "[handleCustomDataVisualization] processLayer method unavailable."
                );
              }
  
              // Force refresh all labels after a delay to ensure they appear - or don't appear if disabled
              setTimeout(() => {
                // Re-check ref
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  // Check correct method name
                  labelManagerRef.current.refreshLabels();
                  console.log(`Refreshed labels for custom layer (labels disabled: ${disableLayerLabels})`);
                } else {
                  console.warn(
                    "[handleCustomDataVisualization] refreshLabels method unavailable inside timeout."
                  );
                }
              }, 500);
            } catch (err) {
              console.error("Error processing labels for custom layer:", err);
            }
          }, 100);
        } else {
          console.warn(
            "[handleCustomDataVisualization] Label manager ref unavailable for label creation."
          );
        }
      } else {
        console.warn(
          "No valid graphics were created to add to the custom layer"
        );
      }
  
      console.log(
        `Custom visualization complete: Added ${addedCount} points, ${errorCount} errors, labels disabled: ${disableLayerLabels}`
      );
    } catch (error) {
      console.error("Error during custom data visualization:", error);
    }
  };

  const updateVisualizationLayer = async () => {
    if (!mapView?.map || isConfigLoading) {
      console.log("Map not ready or configs still loading, skipping visualization update");
      return;
    }
  
    try {
      // [existing layer removal code...]
  
      const activeTabData = tabs.find((tab) => tab.id === activeTab);
  
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") vizType = "pipe";
        if (vizType === "comps") vizType = "comp";
        
        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;
        
        // Add clear logging of the critical renderer type
        console.log(`[updateVisualizationLayer] Creating layer for: ${vizType} with renderer: ${config?.rendererType || 'default'}`, {
          configType: config?.type,
          customData: config?.customData ? `${config.customData.data?.length || 0} items` : 'none',
          valueColumn1: config?.valueColumn1,
          valueColumn2: config?.valueColumn2
        });
  
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(vizType);
  
        let newLayer = null;
  
        if (isSpecialType) {
          // For "custom" type, always ensure renderer type is preserved
          if (vizType === "custom") {
            // Make a deep copy to prevent issues
            const layerConfig = JSON.parse(JSON.stringify(config));
            
            // Ensure renderer type is explicitly set
            if (!layerConfig.rendererType && config.rendererType) {
              layerConfig.rendererType = config.rendererType;
            }
            
            // Log the renderer type being used
            console.log(`[updateVisualizationLayer] Using renderer type: ${layerConfig.rendererType || 'default'} for custom layer`);
            
            // Create the custom layer with the preserved renderer type
            newLayer = await createGraphicsLayerFromCustomData(layerConfig);
          }
          else if (vizType === "pipe") {
            newLayer = await createPipeLayer(config);
          } 
          else if (vizType === "comp") {
            newLayer = await createCompLayer(config);
          }
  
          if (newLayer) {
            // Ensure layer properties are set
            newLayer.isVisualizationLayer = true;
            newLayer.visualizationType = vizType;
            newLayer.rendererType = config.rendererType; // Store renderer type
  
            console.log(`[updateVisualizationLayer] Adding ${vizType} layer to map with ${newLayer.graphics?.length || 0} graphics`);
            mapView.map.add(newLayer, 0);
            activeLayersRef.current[activeTab] = newLayer;
  
            // Handle specific custom-dual-value legend
            if (vizType === 'custom' && config.rendererType === 'custom-dual-value') {
              setCustomLegendContent({ 
                type: 'custom-dual-value', 
                config: config 
              });
              
              if (legend) legend.visible = false;
              console.log("[updateVisualizationLayer] Set custom legend for custom-dual-value type");
            }
            // Other special types handling
            else if (vizType === "pipe") {
              await handlePipeVisualization(activeTabData, newLayer);
            } 
            else if (vizType === "comp") {
              await handleCompVisualization(activeTabData, newLayer);
            }
  
            // [existing label manager code...]
          }
        } 
        else {
          // [existing feature layer code...]
        }
      } 
      else {
        // [existing core map code...]
      }
    } catch (error) {
      console.error("Error updating visualization layer:", error);
      if (legend) legend.visible = false;
      setCustomLegendContent(null);
    }
  };

  /**
   * Apply saved label positions to a newly created layer
   * @param {Object} layer - The newly created layer
   */
  const applyLabelsToLayer = (layer) => {
    if (!layer) return;

    try {
      // Get any saved positions from localStorage
      const storageKey = "customLabelPositions";
      const storedPositions = JSON.parse(
        localStorage.getItem(storageKey) || "{}"
      );
      const positionCount = Object.keys(storedPositions).length;

      if (positionCount === 0) {
        console.log("[Map] No saved label positions found in localStorage");
        return;
      }

      console.log(
        `[Map] Found ${positionCount} saved label positions in localStorage`
      );

      // Wait for layer items to be accessible
      setTimeout(() => {
        if (!layer.graphics?.items) {
          console.warn("[Map] Layer graphics not accessible");
          return;
        }

        // Find all labels in this layer
        const labelGraphics = layer.graphics.items.filter(
          (graphic) =>
            graphic.symbol?.type === "text" ||
            graphic.attributes?.isLabel === true
        );

        console.log(
          `[Map] Found ${labelGraphics.length} label graphics in layer ${layer.id}`
        );

        let appliedCount = 0;

        // Apply positions to each label graphic
        labelGraphics.forEach((label) => {
          if (!label?.symbol) return;

          // Generate the label ID the same way LabelEditor does
          const labelId = (() => {
            if (!label || !label.attributes) return null;

            // First check for layer information
            const layerPrefix = label.layer?.id ? `${label.layer.id}-` : "";

            // Prioritize explicit IDs
            if (label.attributes?.labelId)
              return `${layerPrefix}explicit-${label.attributes.labelId}`;
            if (label.attributes?.id)
              return `${layerPrefix}${label.attributes.id}`;

            // Check for OBJECTID (most common scenario)
            if (label.attributes?.OBJECTID) {
              if (label.attributes?.isLabel) {
                // Label with parent ID reference
                if (label.attributes.parentID !== undefined) {
                  return `${layerPrefix}oid-label-${label.attributes.parentID}`;
                } else {
                  return `${layerPrefix}oid-${label.attributes.OBJECTID}`;
                }
              } else {
                return `${layerPrefix}oid-${label.attributes.OBJECTID}`;
              }
            }

            // Check for parentID which is commonly used for labels
            if (label.attributes?.parentID) {
              return `${layerPrefix}oid-label-${label.attributes.parentID}`;
            }

            // Last resort - this is used when nothing else is available
            return `${layerPrefix}graphic-uid-${label.uid}`;
          })();

          // Check if we have a saved position for this label
          if (labelId && storedPositions[labelId]) {
            const savedPos = storedPositions[labelId];

            // Create a new symbol with the saved position
            try {
              const newSymbol = label.symbol.clone();

              // Apply position
              if (savedPos.position) {
                newSymbol.xoffset = savedPos.position.x;
                newSymbol.yoffset = savedPos.position.y;
              }

              // Apply font size if available
              if (savedPos.fontSize && newSymbol.font) {
                newSymbol.font = {
                  ...newSymbol.font,
                  size: savedPos.fontSize,
                };
              }

              // Apply text if available
              if (savedPos.text) {
                newSymbol.text = savedPos.text;
              }

              // Mark as edited with flags
              if (label.attributes) {
                label.attributes._isEdited = true;
                label.attributes._permanentEdit = true;
                label.attributes._userEdited = true;
                label.attributes._preserveOnRefresh = true;
                label.attributes._preventAutoHide = true;
              }

              // Apply the updated symbol
              label.symbol = newSymbol;
              label.visible = savedPos.visible !== false;

              appliedCount++;
            } catch (err) {
              console.error(
                `[Map] Error applying saved position to label ${labelId}:`,
                err
              );
            }
          }
        });

        console.log(
          `[Map] Applied ${appliedCount} saved positions to labels in layer ${layer.id}`
        );

        // Refresh the layer to show the changes
        if (appliedCount > 0 && typeof layer.refresh === "function") {
          layer.refresh();
          console.log(
            `[Map] Refreshed layer ${layer.id} after applying saved positions`
          );
        }
      }, 500); // Delay to ensure graphics are loaded
    } catch (error) {
      console.error("[Map] Error applying saved label positions:", error);
    }
  };

  const handleTabClick = async (tabId) => {
    console.log(
      `[TabClick] Clicked tab: ${tabId}. Current label editor open: ${isLabelEditorOpen}`
    );

    // CRITICAL: Always save pending edits first, even if not in label edit mode
    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.savePositions === "function"
    ) {
      console.log("[TabClick] Saving all label positions before tab change...");
      try {
        // Force immediate save
        await labelManagerRef.current.savePositions(true);
        console.log("[TabClick] Successfully saved all label positions");

        // Immediately persist to storage as well
        if (typeof localStorage !== "undefined") {
          try {
            // Force the browser to sync localStorage to disk
            const event = new Event("storage");
            window.dispatchEvent(event);
          } catch (localStorageErr) {
            // Ignore errors with storage event
          }
        }
      } catch (saveError) {
        console.error("[TabClick] Error saving label positions:", saveError);
      }
    }

    // Exit label edit mode if active
    if (isLabelEditorOpen) {
      console.log("[TabClick] Was in label edit mode. Closing editor...");
      setIsLabelEditorOpen(false); // Close the editor panel

      // Turn off editing mode in the manager
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.toggleEditingMode === "function"
      ) {
        try {
          labelManagerRef.current.toggleEditingMode(false);
        } catch (toggleError) {
          console.error(
            "[TabClick] Error toggling label manager mode off:",
            toggleError
          );
        }
      }
    }

    // Update the active tab state
    console.log(`[TabClick] Setting active tab to: ${tabId}`);
    setActiveTab(tabId);

    // Update tabs array to mark the clicked tab as active and others as inactive
    setTabs((prevTabs) =>
      prevTabs.map((tab) => ({
        ...tab,
        active: tab.id === tabId,
      }))
    );

    // CRITICAL: Ensure layer refresh happens AFTER tab change is complete
    setTimeout(() => {
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.refreshLabels === "function"
      ) {
        try {
          labelManagerRef.current.refreshLabels();
          console.log("[TabClick] Refreshed labels after tab change");
        } catch (refreshError) {
          console.error("[TabClick] Error refreshing labels:", refreshError);
        }
      }
    }, 300);

    console.log(`[TabClick] Tab switch process complete for tab: ${tabId}`);
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
        // FIX: Use optional chaining
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
            legend.visible = !isEditorOpen && !isLabelEditorOpen; // Show if NO editor is open
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
              // FIX: Use optional chaining
              if (layer?.isVisualizationLayer) {
                layersToRemove.push(layer);
              }
            });
            layersToRemove.forEach((layer) => mapView.map.remove(layer));

            // Add new layer
            newLayer.isVisualizationLayer = true; // Set directly
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

  // In Map.jsx, update handleCreateMap function
  const handleCreateMap = (mapData) => {
    // Simplified log for clarity
    console.log("[MapComponent handleCreateMap] Received map data:", mapData);

    // Ensure mapData is valid before proceeding
    if (!mapData || typeof mapData !== "object") {
      console.error(
        "[MapComponent handleCreateMap] Invalid mapData received:",
        mapData
      );
      setIsNewMapDialogOpen(false); // Close dialog even on error
      return;
    }

    // Create the new tab object
    const newTabId = Date.now(); // Simple unique ID for frontend
    const newTabName = mapData.name?.trim()
      ? mapData.name.trim()
      : `Map ${nextTabNumber}`;

    // Process visualization type and configuration
    let vizType = mapData.visualizationType || mapData.type;
    if (vizType === "pipeline") vizType = "pipe";
    if (vizType === "comps") vizType = "comp";

    // Ensure variable text is preserved in the configuration
    let layerConfiguration = mapData.layerConfiguration;
    if (layerConfiguration) {
      // Make sure variable text is stored correctly
      if (mapData.layerConfiguration.variable1Text !== undefined) {
        layerConfiguration.variable1Text =
          mapData.layerConfiguration.variable1Text;
      }
      if (mapData.layerConfiguration.variable2Text !== undefined) {
        layerConfiguration.variable2Text =
          mapData.layerConfiguration.variable2Text;
      }

      // Also store title format if available
      if (mapData.layerConfiguration.titleFormat) {
        layerConfiguration.titleFormat = mapData.layerConfiguration.titleFormat;
      }

      console.log(
        "[MapComponent handleCreateMap] Variable text fields preserved:",
        {
          variable1Text: layerConfiguration.variable1Text,
          variable2Text: layerConfiguration.variable2Text,
        }
      );
    }

    // Create the new tab object
    const newTab = {
      id: newTabId,
      configId: null, // Will be set after saving to backend
      name: newTabName,
      originalName: newTabName,
      active: true, // Set the new tab as active
      visualizationType: vizType,
      areaType: mapData.areaType || areaTypes[0],
      layerConfiguration: layerConfiguration,
      isEditing: false,
    };

    // Update the tabs state
    const newTabs = [...tabs.map((tab) => ({ ...tab, active: false })), newTab];
    setTabs(newTabs);
    setActiveTab(newTabId);
    setIsNewMapDialogOpen(false);
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

      // Ensure remainingTabs is not empty before accessing last element
      if (remainingTabs.length === 0) {
        console.error("Cannot delete the last tab."); // Or handle appropriately
        return;
      }

      const newActiveTab =
        activeTab === tabId
          ? remainingTabs[remainingTabs.length - 1].id // Activate last remaining
          : activeTab; // Keep current active if it wasn't the deleted one

      const newTabs = remainingTabs.map((tab) => ({
        ...tab,
        active: tab.id === newActiveTab,
      }));

      // Update UI state
      setTabs(newTabs);
      setActiveTab(newActiveTab); // Set the new active tab state

      // Clear visualization if deleted tab was active and the new active tab is different
      // Or if the deleted tab was the only one left besides Core Map
      if (activeTab === tabId && mapView?.map) {
        console.log("Removing visualization layers after deleting active tab.");
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          // FIX: Use optional chaining
          if (layer?.isVisualizationLayer) {
            layersToRemove.push(layer);
          }
        });
        if (layersToRemove.length > 0) {
          mapView.map.removeMany(layersToRemove);
        }

        // Hide legend
        if (legend) {
          legend.visible = false;
        }
        // Clear custom legend content
        setCustomLegendContent(null);
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

      console.log(
        "[ConfigChange] Tabs state update triggered. Main useEffect will handle layer update."
      );
    },
    [activeTab] // Removed tabs from dependencies as setTabs handles closure correctly
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
        // FIX: Use optional chaining
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
          newLayer = await createPipeLayer(configForCreator); // Make await
        } else if (effectiveType === "comp") {
          newLayer = await createCompLayer(configForCreator); // Make await
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
  const notifyLabelManagerAboutLayer = useCallback(
    async (layer, layerType, labelOptions = {}) => {
      // --- Added Defensive Checks ---
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
        if (
          typeof labelManagerRef.current.configureLayerSettings === "function"
        ) {
          labelManagerRef.current.configureLayerSettings(layerType);
        } else {
          console.warn(
            "[MapComponent] configureLayerSettings method not found on label manager."
          );
        }

        // Special handling for different layer types
        if (
          layerType === "pipe" ||
          layerType === "comp" ||
          layerType === "custom"
        ) {
          // (Removed call to non-existent updateOptions)
          // Enhanced options logic removed as updateOptions doesn't exist.
          // Settings are applied via configureLayerSettings.

          // Force a processing of this layer for labels after a short delay
          // --- CORRECTED CALL ---
          if (typeof labelManagerRef.current.processLayer === "function") {
            setTimeout(() => {
              // Re-check ref inside timeout
              if (
                labelManagerRef.current &&
                typeof labelManagerRef.current.processLayer === "function"
              ) {
                labelManagerRef.current.processLayer(layer); // Use public method
                console.log(
                  `[MapComponent] Processed labels from ${layerType} layer`
                );

                // Refresh all labels after integration if method exists
                setTimeout(() => {
                  // Re-check ref inside timeout
                  if (
                    labelManagerRef.current &&
                    typeof labelManagerRef.current.refreshLabels === "function"
                  ) {
                    labelManagerRef.current.refreshLabels();
                    console.log(
                      `[MapComponent] Refreshed labels for ${layerType} layer after notification`
                    );
                  } else if (labelManagerRef.current) {
                    console.warn(
                      "[MapComponent] refreshLabels method not found on label manager (inner timeout - notify)."
                    );
                  }
                }, 500); // Delay for refresh
              } else if (labelManagerRef.current) {
                console.warn(
                  "[MapComponent] processLayer method not found on label manager (outer timeout - notify)."
                );
              }
            }, 200); // Delay for processing
          } else {
            console.warn(
              "[MapComponent] processLayer method not found on label manager."
            );
          }
          // --- END CORRECTION ---
        }

        // Mark this layer as managed by the label manager (optional flag)
        layer._labelManagerIntegrated = true;
      } catch (error) {
        console.error(
          `[MapComponent] Error notifying label manager about ${layerType} layer:`,
          error
        );
      }
    },
    []
  ); // Empty dependency array is likely sufficient as it primarily uses the ref

  // Extract legend styling into a reusable function
  const styleLegend = (legendContainer) => {
    if (!legendContainer) return;

    // Container styles
    legendContainer.style.backgroundColor = "white";
    legendContainer.style.padding = "1rem";
    legendContainer.style.margin = "0.5rem";
    legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
    legendContainer.style.borderRadius = "0.375rem";
    legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

    // Title styles
    const legendTitle = legendContainer.querySelector(
      ".esri-legend__service-label"
    );
    if (legendTitle) {
      legendTitle.style.fontWeight = "600";
      legendTitle.style.fontSize = "0.875rem";
      legendTitle.style.marginBottom = "0.75rem";
      legendTitle.style.color = "#111827";
    }

    // Item styles
    const legendItems = legendContainer.querySelectorAll(
      ".esri-legend__layer-row"
    );
    legendItems.forEach((item) => {
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.marginBottom = "0.5rem";
    });

    // Swatch styles
    const swatches = legendContainer.querySelectorAll(".esri-legend__symbol");
    swatches.forEach((swatch) => {
      swatch.style.width = "1rem";
      swatch.style.height = "1rem";
      swatch.style.marginRight = "0.5rem";
    });

    // Label styles
    const labels = legendContainer.querySelectorAll(
      ".esri-legend__layer-cell--info"
    );
    labels.forEach((label) => {
      label.style.fontSize = "0.875rem";
      label.style.color = "#4B5563";
    });
  };

  const saveLabelPositions = useCallback((force = true) => {
    // --- Added Defensive Checks ---
    if (!labelManagerRef.current) {
      console.warn(
        "[Labels] Cannot save: Label manager ref is not set.",
        new Error().stack
      ); // Log stack trace
      return { count: 0 }; // Return a default object indicating no save occurred
    }
    try {
      if (typeof labelManagerRef.current.savePositions === "function") {
        const result = labelManagerRef.current.savePositions(force);
        // console.log(`[Labels] Saved ${result?.count || 0} label positions`); // Reduced logging noise
        return result;
      }
      console.warn(
        "[Labels] savePositions function not available on label manager instance."
      );
      return { count: 0 };
    } catch (err) {
      console.error("[Labels] Error saving label positions:", err);
      return { count: 0, error: err };
    }
  }, []); // Empty dependency array - only uses the ref

  // Around line 3019
  const loadLabelPositions = useCallback(
    (force = true, preserveEdits = true) => {
      // --- Added Defensive Checks ---
      if (!labelManagerRef.current) {
        console.warn("[Labels] Cannot load: Label manager ref is not set.");
        return { count: 0 }; // Return default object
      }
      try {
        if (typeof labelManagerRef.current.loadPositions === "function") {
          const result = labelManagerRef.current.loadPositions(
            force,
            preserveEdits
          );
          // console.log(`[Labels] Loaded ${result?.count || 0} saved label positions`); // Reduced logging noise
          return result;
        }
        console.warn(
          "[Labels] loadPositions function not available on label manager instance."
        );
        return { count: 0 };
      } catch (err) {
        console.error("[Labels] Error loading label positions:", err);
        return { count: 0, error: err };
      }
    },
    []
  ); // Empty dependency array

  // Around line 3037
  const destroyLabelManager = useCallback(() => {
    // --- Added Defensive Checks ---
    if (!labelManagerRef.current) {
      // console.log("[Labels] No label manager instance to destroy."); // Can be noisy
      return; // Exit if no manager to destroy
    }
    try {
      // Attempt to save positions before destroying
      if (typeof labelManagerRef.current.savePositions === "function") {
        // console.log("[Labels] Saving positions before destroying label manager"); // Can be noisy
        labelManagerRef.current.savePositions(true); // Force final save
      } else {
        console.warn(
          "[Labels] savePositions not available, skipping final save during destroy."
        );
      }

      // Attempt to destroy the manager instance
      if (typeof labelManagerRef.current.destroy === "function") {
        // console.log("[Labels] Destroying label manager instance"); // Can be noisy
        labelManagerRef.current.destroy();
      } else {
        console.warn("[Labels] Label manager instance missing destroy method.");
      }
    } catch (err) {
      console.error("[Labels] Error during label manager cleanup:", err);
    } finally {
      // CRUCIAL: Always nullify the reference after attempting cleanup
      labelManagerRef.current = null;
      // console.log("[Labels] Label manager reference cleared."); // Can be noisy
    }
  }, []); // Empty dependency array

  const updateVisualizationAndLegend = useCallback(async () => {
    // Prerequisites check
    if (!mapView?.map || isConfigLoading || !legend || !isLabelManagerReady) {
      console.log(
        "[updateVisualizationAndLegend] Skipping: Prerequisites not met.",
        {
          isConfigLoading,
          mapReady: !!mapView?.map,
          legendReady: !!legend,
          labelManagerReady: isLabelManagerReady,
        }
      );
      return null;
    }
    // ... (keep existing initial checks, saveLabels, layer removal) ...
    console.log(
      "[updateVisualizationAndLegend] Starting update (Label Manager Ready) for Active Tab:",
      activeTab
    );
    let labelLoadTimeoutId = null;
    try {
      saveLabelPositions(true); // Save before changing layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        // FIX: Use optional chaining
        if (layer?.isVisualizationLayer === true && !layer?._preventRemoval) {
          layersToRemove.push(layer);
        }
      });
      if (layersToRemove.length > 0) {
        console.log(
          `[updateVisualizationAndLegend] Removing ${layersToRemove.length} layers`
        );
        mapView.map.removeMany(layersToRemove);
      }
      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      if (!activeTabData) {
        console.log("[updateVisualizationAndLegend] No active tab data found.");
        return null;
      }

      if (activeTab !== 1 && activeTabData.visualizationType) {
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") vizType = "pipe";
        if (vizType === "comps") vizType = "comp";
        if (vizType === "site_location") vizType = "site_location"; // Support for site location type

        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;
        console.log(
          `[updateVisualizationAndLegend] Preparing layer creation for type: ${vizType}`
        );

        // Ensure type is present either in vizType or config
        const effectiveType = vizType || config?.type;
        if (!effectiveType) {
          console.error(
            "[updateVisualizationAndLegend] Cannot create layer: Missing visualization type."
          );
          if (legend) legend.visible = false;
          setCustomLegendContent(null);
          return null;
        }

        let newLayer = null;
        try {
          const specialTypes = ["pipe", "comp", "custom", "site_location"]; // Add site_location to special types
          const isSpecialType =
            specialTypes.includes(effectiveType) ||
            (config?.customData &&
              !["class-breaks", "dot-density"].includes(effectiveType));

          if (isSpecialType) {
            const configForCreator = { ...(config || {}), type: effectiveType };
            if (effectiveType === "pipe")
              newLayer = await createPipeLayer(configForCreator);
            else if (effectiveType === "comp")
              newLayer = await createCompLayer(configForCreator);
            else if (effectiveType === "site_location") {
              // Create a graphics layer for site location visualization
              const { default: GraphicsLayer } = await import(
                "@arcgis/core/layers/GraphicsLayer"
              );
              newLayer = new GraphicsLayer({
                title: "Site Location",
                visualizationType: "site_location",
                isVisualizationLayer: true,
                listMode: "hide",
              });

              // If there's specific site data in the config, display it
              if (config?.siteData?.point) {
                const siteData = {
                  point: config.siteData.point,
                  size: config.siteData.size || 20,
                  color: config.siteData.color || "#FFD700",
                };

                // We'll draw the site point after adding the layer to the map
                setTimeout(() => {
                  if (mapView && newLayer) {
                    const drawSite = async () => {
                      try {
                        const { default: Graphic } = await import(
                          "@arcgis/core/Graphic"
                        );
                        const { default: Point } = await import(
                          "@arcgis/core/geometry/Point"
                        );
                        const { default: SimpleMarkerSymbol } = await import(
                          "@arcgis/core/symbols/SimpleMarkerSymbol"
                        );
                        const { default: Color } = await import(
                          "@arcgis/core/Color"
                        );

                        const pointGeom = new Point({
                          longitude:
                            siteData.point.longitude || siteData.point.x,
                          latitude: siteData.point.latitude || siteData.point.y,
                          spatialReference: { wkid: 4326 },
                        });

                        const symbol = new SimpleMarkerSymbol({
                          style: "star",
                          size: siteData.size,
                          color: new Color(siteData.color),
                          outline: {
                            color: new Color("#000000"),
                            width: 1,
                          },
                        });

                        const graphic = new Graphic({
                          geometry: pointGeom,
                          symbol: symbol,
                          attributes: {
                            FEATURE_TYPE: "site_location",
                            id: "site-location-default",
                            isVisualization: true,
                          },
                        });

                        newLayer.add(graphic);
                      } catch (error) {
                        console.error(
                          "[Site Location] Error drawing site point:",
                          error
                        );
                      }
                    };

                    drawSite();
                  }
                }, 500);
              }
            } else
              newLayer = await createGraphicsLayerFromCustomData(
                configForCreator
              );
          } else {
            newLayer = await createLayers(
              effectiveType,
              config,
              initialLayerConfigurations,
              areaType
            );
          }

          if (
            newLayer &&
            (newLayer instanceof FeatureLayer ||
              newLayer instanceof GraphicsLayer)
          ) {
            newLayer.isVisualizationLayer = true;
            newLayer.visualizationType = effectiveType; // Use the determined type
            mapView.map.add(newLayer, 0);
            console.log(
              `[updateVisualizationAndLegend] Added layer "${
                newLayer.title || newLayer.id
              }" to map.`
            );
            if (activeLayersRef.current)
              activeLayersRef.current[activeTab] = newLayer;
            await newLayer.when();
            console.log(
              `[updateVisualizationAndLegend] Layer "${
                newLayer.title || newLayer.id
              }" is ready.`
            );

            // --- Legend and Label Handling ---
            const showStandardLegend =
              !isSpecialType && !isEditorOpen && !isLabelEditorOpen; // Hide if EITHER editor is open

            if (isSpecialType && activeTabData.layerConfiguration) {
              console.log(
                `[updateVisualizationAndLegend] Setting custom legend for type: ${effectiveType}`
              );
              setCustomLegendContent({
                type: effectiveType,
                config: activeTabData.layerConfiguration,
              });
              if (legend) legend.visible = false;

              // Notify manager (should succeed now)
              await notifyLabelManagerAboutLayer(
                newLayer,
                effectiveType,
                activeTabData.layerConfiguration?.labelOptions
              );

              // Explicitly process the new layer and refresh
              if (labelManagerRef.current) {
                console.log(
                  `[updateVisualizationAndLegend] Explicitly processing layer ${newLayer.id} with Label Manager.`
                );
                // --- CORRECTED CALL ---
                if (
                  typeof labelManagerRef.current.processLayer === "function"
                ) {
                  labelManagerRef.current.processLayer(newLayer); // Use public method
                } else {
                  console.warn(
                    "[updateVisualizationAndLegend] processLayer method not found on label manager."
                  );
                }
                // --- END CORRECTION ---

                if (
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  // Use setTimeout to allow graphics rendering/processing to settle
                  labelLoadTimeoutId = setTimeout(() => {
                    if (
                      labelManagerRef.current &&
                      typeof labelManagerRef.current.refreshLabels ===
                        "function"
                    ) {
                      labelManagerRef.current.refreshLabels();
                      console.log(
                        `[updateVisualizationAndLegend] Explicitly refreshed labels after processing ${effectiveType} layer.`
                      );
                    } else {
                      console.warn(
                        "[updateVisualizationAndLegend] refreshLabels method not found on label manager (timeout)."
                      );
                    }
                    labelLoadTimeoutId = null; // Clear timeout ID after execution
                  }, 500); // 500ms delay
                } else {
                  console.warn(
                    "[updateVisualizationAndLegend] refreshLabels method not found on label manager."
                  );
                }
              } else {
                console.warn(
                  "[updateVisualizationAndLegend] Label Manager not available for explicit layer processing."
                );
              }
            } else if (legend && showStandardLegend) {
              console.log(
                `[updateVisualizationAndLegend] Updating standard Esri legend for layer: ${
                  newLayer.title || effectiveType
                }`
              );
              legend.layerInfos = [
                {
                  layer: newLayer,
                  title: newLayer.title || effectiveType,
                  hideLayersNotInCurrentView: false,
                },
              ];
              legend.visible = true;
              styleLegend(legend.container); // Apply style
              setCustomLegendContent(null);
              if (labelLoadTimeoutId) clearTimeout(labelLoadTimeoutId); // Clear timeout if standard legend shown
            } else if (legend) {
              console.log(
                `[updateVisualizationAndLegend] Hiding standard Esri legend. SpecialType: ${isSpecialType}, EditorOpen: ${isEditorOpen}, LabelEditorOpen: ${isLabelEditorOpen}`
              );
              legend.visible = false;
              setCustomLegendContent(null);
              if (labelLoadTimeoutId) clearTimeout(labelLoadTimeoutId); // Clear timeout if legend hidden
            }

            // Removed the separate labelLoadTimeoutId for loadPositions - rely on refreshLabels after processing
          } else {
            console.error(
              `[updateVisualizationAndLegend] Failed to create layer for type: ${effectiveType}`
            );
            if (legend) legend.visible = false;
            setCustomLegendContent(null);
          }
        } catch (error) {
          console.error(
            `[updateVisualizationAndLegend] Error during layer creation for type ${effectiveType}:`,
            error
          );
          if (legend) legend.visible = false;
          setCustomLegendContent(null);
        }
      } else {
        // Handle Core Map or no visualization selected
        console.log(
          `[updateVisualizationAndLegend] No visualization to display for tab ${activeTab}`
        );
        if (legend) legend.visible = false;
        setCustomLegendContent(null);
        if (labelLoadTimeoutId) clearTimeout(labelLoadTimeoutId);
      }
    } catch (error) {
      console.error("[updateVisualizationAndLegend] Outer error:", error);
      if (legend) legend.visible = false;
      setCustomLegendContent(null);
      if (labelLoadTimeoutId) clearTimeout(labelLoadTimeoutId);
    }

    return labelLoadTimeoutId; // Return timeout ID or null
  }, [
    activeTab,
    tabs,
    mapView,
    legend,
    isEditorOpen,
    isLabelEditorOpen,
    isConfigLoading,
    isLabelManagerReady,
    initialLayerConfigurations,
    saveLabelPositions,
    loadLabelPositions,
    notifyLabelManagerAboutLayer,
    setCustomLegendContent,
    createLayers,
    createPipeLayer,
    createCompLayer,
    createGraphicsLayerFromCustomData,
  ]); // End of useCallback

  // --- CONSOLIDATED EFFECT HOOKS ---

  // Site Location market area placement event listener
  useEffect(() => {
    const handlePlacementRequest = (event) => {
      const { activate, options } = event.detail || {};
      console.log(
        `[Map] Received site location placement request. Activate: ${activate}`
      );
      toggleSiteLocationPlacement(activate, options);
    };

    // Listen for the custom event from MarketAreaForm
    document.addEventListener(
      "requestSiteLocationPlacement",
      handlePlacementRequest
    );

    return () => {
      document.removeEventListener(
        "requestSiteLocationPlacement",
        handlePlacementRequest
      );
    };
  }, [toggleSiteLocationPlacement]);

  // 1. Project change event handler
  useEffect(() => {
    const handleProjectChange = () => {
      const projectId =
        localStorage.getItem("currentProjectId") ||
        sessionStorage.getItem("currentProjectId");

      // Find the active tab data
      const activeTabData = tabs.find((tab) => tab.active);

      // --- Added Defensive Check ---
      if (
        projectId &&
        labelManagerRef.current &&
        typeof labelManagerRef.current.setContext === "function"
      ) {
        labelManagerRef.current.setContext(projectId, activeTabData?.configId);
        loadLabelPositions(true); // Reload positions for the new context
      } else {
        console.warn(
          "[ProjectChange Effect] Cannot set context: Label manager ref or method missing."
        );
      }
    };

    window.addEventListener("projectChanged", handleProjectChange);

    return () => {
      window.removeEventListener("projectChanged", handleProjectChange);
    };
  }, [tabs, loadLabelPositions]); // Added loadLabelPositions dependency

  // 2. ArcGIS Configuration
  useEffect(() => {
    try {
      console.log(
        "ArcGIS API Key:",
        import.meta.env.VITE_ARCGIS_API_KEY ? "Loaded" : "Not Found"
      );

      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

      if (!esriConfig.apiKey) {
        console.error("ArcGIS API Key is missing or undefined");
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
      // esriConfig.request.interceptors.push({
      //   before: (params) => {
      //     console.log("ArcGIS Request Interceptor:", {
      //       url: params.url,
      //       method: params.method,
      //       headers: params.headers,
      //     });
      //   },
      //   error: (error) => {
      //     console.error("ArcGIS Request Error:", error);
      //   },
      // });
    } catch (error) {
      console.error("ArcGIS Configuration Error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
  }, []); // Empty deps - runs once on mount

  useEffect(() => {
    let isMounted = true;
    console.log("Starting map initialization...");

    // Use local variables within this effect's scope for instances
    // that need to be accessed in the cleanup function.
    let localMapView = null;
    let localZoomToolButtonRoot = null;
    let siteLocationClickHandler = null;
    let labelDragEventHandlers = [];

    const initializeMap = async () => {
      try {

        // Create map with reliable basemap
        const map = new Map({
          basemap: "arcgis-navigation", // Changed from streets-navigation-vector which was causing AbortError
        });

        // Create view with map container
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-98, 39], // Default center
          zoom: 4, // Default zoom
          constraints: {
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20,
          },
          navigation: {
            actionMap: { mouseWheel: { enabled: false } }, // Disable default wheel
            browserTouchPanEnabled: true,
            momentumEnabled: true,
            keyboardNavigation: true,
          },
        });

        // Store view for cleanup
        localMapView = view;

        console.log("Waiting for view to be ready...");
        await view.when();
        console.log("View is now ready!");

        // Custom mouse wheel zoom handler
        view.constraints.snapToZoom = false; // Allow fractional zoom levels
        const scrollHandler = view.on("mouse-wheel", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const state = scrollStateRef.current;
          const now = Date.now();
          const timeDiff = now - (state.lastScrollTime || now);
          const scrollDeltaY = event.native.deltaY;
          const currentDirection = scrollDeltaY < 0 ? 1 : -1; // 1 for zoom in, -1 for zoom out
          const resetThreshold = 250, // ms to reset scroll streak
            accelerateThreshold = 120; // ms for faster acceleration

          if (state.timeoutId) clearTimeout(state.timeoutId);

          if (
            timeDiff < resetThreshold &&
            currentDirection === state.lastScrollDirection &&
            state.lastScrollDirection !== 0 // Ensure there was a previous direction
          ) {
            if (timeDiff < accelerateThreshold) state.scrollStreak++;
            // else maintain streak but don't increment as fast
          } else {
            state.scrollStreak = 1; // Reset streak
          }

          const baseZoomDelta = 0.08; // Base zoom increment per scroll step
          const streakBonus = 0.2; // How much each streak count adds to acceleration
          const maxAccelerationFactor = 5.0;
          const accelerationFactor = Math.min(
            1 + streakBonus * Math.max(0, state.scrollStreak - 1),
            maxAccelerationFactor
          );
          const finalZoomDelta =
            baseZoomDelta * accelerationFactor * currentDirection;
          const currentZoom = view.zoom;
          let newZoom = Math.min(
            Math.max(currentZoom + finalZoomDelta, view.constraints.minZoom),
            view.constraints.maxZoom
          );

          if (Math.abs(newZoom - currentZoom) > 0.001) {
            // Only zoom if change is significant
            view
              .goTo(
                { zoom: newZoom, center: view.center },
                { duration: 60, easing: "linear", animate: true }
              )
              .catch((error) => {
                if (error.name !== "AbortError")
                  // Ignore AbortErrors from rapid scrolling
                  console.error("goTo Error:", error);
              });
          }

          state.lastScrollTime = now;
          state.lastScrollDirection = currentDirection;
          state.timeoutId = setTimeout(() => {
            state.scrollStreak = 0;
            state.lastScrollDirection = 0;
            state.timeoutId = null;
          }, resetThreshold);
        });

        // Store scrollHandler if view.on returns a removable handler object
        if (typeof scrollHandler?.remove === "function") {
          labelDragEventHandlers.push(scrollHandler);
        }

        // Site location placement click handler
        siteLocationClickHandler = view.on(
          "click",
          handleSiteLocationPlacement
        );

        // Fixed: Setup label drag handling with properly defined pointerDownHandler
        try {
          // Define a function to handle label dragging
          const setupLabelDragHandlingFixed = (view) => {
            if (!view || !view.map) return [];

            console.log("[Map] Setting up enhanced label drag handling");

            // Track if we're currently dragging a label
            let isDraggingLabel = false;
            let draggedLabel = null;
            let dragStartPoint = null;
            let originalOffset = null;
            let originalNavState = null;

            // Store handlers for proper cleanup
            const handlers = [];

            // Define pointerDownHandler properly
            const pointerDownHandler = view.on("pointer-down", (event) => {
              // Skip if already dragging
              if (isDraggingLabel) return;

              // Skip if zoom tool is active
              if (isZoomToolActive) {
                return;
              }

              // Existing label drag code...
              view
                .hitTest(event.screenPoint)
                .then((response) => {
                  const labelHit = response.results.find(
                    (result) =>
                      result.graphic &&
                      (result.graphic.symbol?.type === "text" ||
                        result.graphic.attributes?.isLabel === true)
                  );

                  if (labelHit) {
                    // Found a label - start dragging logic
                    isDraggingLabel = true;
                    draggedLabel = labelHit.graphic;
                    dragStartPoint = event.screenPoint;

                    // Store original offset
                    if (draggedLabel.symbol) {
                      originalOffset = {
                        x: draggedLabel.symbol.xoffset || 0,
                        y: draggedLabel.symbol.yoffset || 0,
                      };
                    } else {
                      originalOffset = { x: 0, y: 0 };
                    }

                    // Store original navigation state
                    originalNavState = {
                      browserTouchPanEnabled:
                        view.navigation?.browserTouchPanEnabled || true,
                      keyboardNavigation:
                        view.navigation?.keyboardNavigation || true,
                    };

                    // Disable map navigation during drag
                    if (view.navigation) {
                      view.navigation.browserTouchPanEnabled = false;
                      if (
                        typeof view.navigation.keyboardNavigation !==
                        "undefined"
                      ) {
                        view.navigation.keyboardNavigation = false;
                      }
                    }

                    // Set cursor
                    if (view.container) {
                      view.container.style.cursor = "move";
                    }

                    // Prevent default
                    event.stopPropagation();
                  }
                })
                .catch((error) => {
                  console.error("[Map] Error during label hit test:", error);
                });
            });

            handlers.push(pointerDownHandler);

            // Handle pointer move for drag operation
            const pointerMoveHandler = view.on("pointer-move", (event) => {
              if (
                !isDraggingLabel ||
                !draggedLabel ||
                !dragStartPoint ||
                !originalOffset
              ) {
                return;
              }

              // Prevent map interaction
              event.stopPropagation();

              // Calculate new position
              const dx = event.x - dragStartPoint.x;
              const dy = event.y - dragStartPoint.y;

              const newPosition = {
                x: originalOffset.x + dx,
                y: originalOffset.y - dy, // Invert Y for correct direction
              };

              try {
                // Update label position
                if (draggedLabel.symbol) {
                  const newSymbol = draggedLabel.symbol.clone();
                  newSymbol.xoffset = newPosition.x;
                  newSymbol.yoffset = newPosition.y;
                  draggedLabel.symbol = newSymbol;

                  // Force refresh if needed
                  if (typeof view.graphics?.refresh === "function") {
                    view.graphics.refresh();
                  }
                }
              } catch (error) {
                console.error(
                  "[Map] Error updating label position during drag:",
                  error
                );
              }
            });

            handlers.push(pointerMoveHandler);

            // Handle pointer up to end drag operation
            const pointerUpHandler = view.on("pointer-up", (event) => {
              if (!isDraggingLabel) return;

              // Prevent map interaction
              event.stopPropagation();

              try {
                // Save the final position to LabelManager if available
                if (window.labelManagerInstance) {
                  if (
                    typeof window.labelManagerInstance.updateLabelPosition ===
                      "function" &&
                    draggedLabel
                  ) {
                    const finalPosition = {
                      x: draggedLabel.symbol?.xoffset || 0,
                      y: draggedLabel.symbol?.yoffset || 0,
                    };
                    window.labelManagerInstance.updateLabelPosition(
                      draggedLabel,
                      finalPosition
                    );
                  }

                  // Auto-save positions
                  if (
                    typeof window.labelManagerInstance.savePositions ===
                    "function"
                  ) {
                    window.labelManagerInstance.savePositions(true);
                  }
                }

                // Restore cursor
                if (view.container) {
                  view.container.style.cursor = "default";
                }

                // Restore map navigation
                if (view.navigation && originalNavState) {
                  view.navigation.browserTouchPanEnabled =
                    originalNavState.browserTouchPanEnabled;
                  if (originalNavState.keyboardNavigation !== undefined) {
                    view.navigation.keyboardNavigation =
                      originalNavState.keyboardNavigation;
                  }
                }
              } catch (error) {
                console.error(
                  "[Map] Error finishing label drag operation:",
                  error
                );
              } finally {
                // Reset drag state
                isDraggingLabel = false;
                draggedLabel = null;
                dragStartPoint = null;
                originalOffset = null;
                originalNavState = null;
              }
            });

            handlers.push(pointerUpHandler);

            // Handle pointer leave to cancel drag
            const pointerLeaveHandler = view.on("pointer-leave", (event) => {
              if (!isDraggingLabel) return;

              try {
                // Restore cursor
                if (view.container) {
                  view.container.style.cursor = "default";
                }

                // Restore map navigation
                if (view.navigation && originalNavState) {
                  view.navigation.browserTouchPanEnabled =
                    originalNavState.browserTouchPanEnabled;
                  if (originalNavState.keyboardNavigation !== undefined) {
                    view.navigation.keyboardNavigation =
                      originalNavState.keyboardNavigation;
                  }
                }
              } catch (error) {
                console.error(
                  "[Map] Error handling pointer leave during label drag:",
                  error
                );
              } finally {
                // Reset drag state
                isDraggingLabel = false;
                draggedLabel = null;
                dragStartPoint = null;
                originalOffset = null;
                originalNavState = null;
              }
            });

            handlers.push(pointerLeaveHandler);

            // Store handlers on view for cleanup
            view.labelDragHandlers = handlers;

            console.log(
              "[Map] Label drag handling initialized with",
              handlers.length,
              "handlers"
            );

            // Make the Label Manager instance globally available
            if (labelManagerRef.current) {
              window.labelManagerInstance = labelManagerRef.current;
              console.log("[Map] Exposed label manager instance globally");
            }

            return handlers;
          };

          // Call the fixed function
          labelDragEventHandlers = setupLabelDragHandlingFixed(view);
        } catch (labelDragError) {
          console.error(
            "[Map] Error setting up label drag handling:",
            labelDragError
          );
          labelDragEventHandlers = [];
        }

        // --- Zoom Tool Button Integration ---
        try {
          // Create a container for the button and add it to the map UI
          const zoomToolButtonContainer = document.createElement("div");
          view.ui.add(zoomToolButtonContainer, "top-left");

          if (isMounted) {
            // Create the React root for the button
            const root = ReactDOM.createRoot(zoomToolButtonContainer);
            // Store in local var and state
            localZoomToolButtonRoot = root;
            setZoomToolButtonRoot(root);
          }
        } catch (buttonError) {
          console.error("[Map] Error creating zoom tool button:", buttonError);
        }
        // --- End Zoom Tool Button Integration ---

        // Add scale bar
        const scaleBar = new ScaleBar({ view, unit: "imperial" });
        view.ui.add(scaleBar, "bottom-left");

        if (isMounted) {
          // Set view in context or state
          setMapView(view);

          // Initialize Legend widget
          const legendWidget = new Legend({
            view,
            container: document.createElement("div"),
            layerInfos: [],
            visible: false,
          });
          view.ui.add(legendWidget, "bottom-right");
          setLegend(legendWidget);

          // Trigger market area loading/rendering
          // This will load market areas via the context once the map is ready
          if (typeof onMapReady === "function") {
            try {
              onMapReady(view);
            } catch (mapReadyError) {
              console.error(
                "[Map] Error in onMapReady callback:",
                mapReadyError
              );
            }
          }
        }
      } catch (error) {
        console.error("[Map] Error during map initialization:", error);
        if (isMounted) {
          // Handle error state appropriately
        }
      }
    };

    if (mapRef.current) {
      // Ensure map container ref is available
      initializeMap();
    } else {
      console.error(
        "[Map] mapRef.current is not available for initialization."
      );
    }

    // --- Cleanup Function ---
    return () => {
      console.log(
        "[Map] Component unmounting or re-running effect, performing cleanup..."
      );
      isMounted = false; // Prevent state updates after unmount/during cleanup

      // Cleanup Label Manager (uses its own destroyLabelManager function)
      if (typeof destroyLabelManager === "function") {
        try {
          destroyLabelManager();
        } catch (labelManagerError) {
          console.error(
            "[Map] Error destroying label manager:",
            labelManagerError
          );
        }
      }

      // Clean up site location click handler
      if (
        siteLocationClickHandler &&
        typeof siteLocationClickHandler.remove === "function"
      ) {
        try {
          siteLocationClickHandler.remove();
          siteLocationClickHandler = null;
          console.log("[Map] Site location click handler removed.");
        } catch (handlerError) {
          console.error(
            "[Map] Error removing site location click handler:",
            handlerError
          );
        }
      }

      // Clean up label drag handlers
      if (labelDragEventHandlers && labelDragEventHandlers.length > 0) {
        try {
          labelDragEventHandlers.forEach((handler) => {
            if (handler && typeof handler.remove === "function") {
              handler.remove();
            }
          });
          labelDragEventHandlers = []; // Clear the array
          console.log("[Map] Label drag event handlers removed.");
        } catch (dragHandlerError) {
          console.error(
            "[Map] Error removing label drag handlers:",
            dragHandlerError
          );
        }
      }

      // --- Cleanup Zoom Tool Button's React Root ---
      if (localZoomToolButtonRoot) {
        try {
          localZoomToolButtonRoot.unmount();
          console.log("[Map] ZoomToolButton React root unmounted.");
        } catch (unmountError) {
          console.error(
            "[Map] Error unmounting zoom tool button:",
            unmountError
          );
        }
        localZoomToolButtonRoot = null; // Clear local ref
      }

      // Destroy the MapView instance to release its resources
      if (localMapView && typeof localMapView.destroy === "function") {
        try {
          localMapView.destroy();
          console.log("[Map] MapView instance destroyed.");
        } catch (destroyError) {
          console.error("[Map] Error destroying MapView:", destroyError);
        }
      }
      localMapView = null; // Clear local ref

      console.log("[Map] Map initialization cleanup finished.");
    };
  }, []); // Empty dependency array: runs once on mount and cleanup on unmount.

  // --- Effect for Label Manager Initialization and Readiness ---
  useEffect(() => {
    // Check if map view is ready and manager isn't already initialized
    if (mapView?.ready && !labelManagerRef.current && !isLabelManagerReady) {
      console.log("[MapComponent] Initializing LabelManager...");
      try {
        // Create instance, passing the view
        labelManagerRef.current = new LabelManager(mapView, {
          /* Add any initial options */
        });
        console.log(
          "[MapComponent] LabelManager instance CREATED:",
          labelManagerRef.current
        );

        // Set readiness state to true AFTER successful initialization
        setIsLabelManagerReady(true);
        console.log("[MapComponent] Label Manager IS READY.");

        // Load initial positions after manager is ready
        const loadTimeout = setTimeout(() => {
          // Re-check ref and readiness inside timeout
          if (
            labelManagerRef.current &&
            isLabelManagerReady &&
            typeof labelManagerRef.current.loadPositions === "function"
          ) {
            try {
              labelManagerRef.current.loadPositions(true, true); // Force load, preserve edits
              console.log(
                "[MapComponent] Initial label positions loaded after manager creation."
              );
            } catch (loadErr) {
              console.error(
                "[MapComponent] Error loading initial label positions:",
                loadErr
              );
            }
          } else {
            console.warn(
              "[MapComponent] Cannot load initial positions: Ref invalid, not ready, or method missing after timeout."
            );
          }
        }, 1000); // Delay might still be useful for complex scenarios

        // Return cleanup for the timeout
        return () => clearTimeout(loadTimeout);
      } catch (err) {
        console.error("[MapComponent] Error initializing LabelManager:", err);
        labelManagerRef.current = null; // Nullify ref on error
        setIsLabelManagerReady(false); // Ensure readiness is false on error
      }
    }
    // Note: No cleanup needed here specifically for the manager instance,
    // as the main unmount cleanup effect handles calling destroyLabelManager.
  }, [mapView?.ready, isLabelManagerReady]); // Dependencies: map readiness and the readiness state itself

  // --- Cleanup effect specifically for the Label Manager ---
  useEffect(() => {
    // This effect's *sole* purpose is to run the cleanup when the component unmounts
    return () => {
      console.log("[MapComponent] Label Manager Cleanup Effect running.");
      // Use the memoized destroy function which handles saving and nullifying the ref
      destroyLabelManager();
      // Reset the readiness state as part of cleanup
      setIsLabelManagerReady(false);
      console.log("[MapComponent] Label Manager Cleanup Effect finished.");
    };
  }, [destroyLabelManager]); // Dependency: the memoized destroy function

  // --- Legend Visibility Effect ---
  useEffect(() => {
    if (!legend || !mapView?.ready) return;

    // Determine if legend should be visible
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const hasVisualization = activeTabData?.visualizationType;
    const hasCustomLegend = !!customLegendContent;
    // Legend should hide if EITHER editor panel is open OR if there's a custom legend
    const shouldShowStandardLegend =
      activeTab !== 1 &&
      hasVisualization &&
      !hasCustomLegend && // Hide if custom legend is showing
      !isEditorOpen &&
      !isLabelEditorOpen;

    // Update legend visibility
    legend.visible = shouldShowStandardLegend;

    // Apply styling if visible
    if (shouldShowStandardLegend && legend.container) {
      requestAnimationFrame(() => {
        // Ensure container exists before styling
        if (legend.container) {
          styleLegend(legend.container);
        }
      });
    }
  }, [
    activeTab,
    legend,
    tabs,
    mapView?.ready,
    isEditorOpen,
    isLabelEditorOpen,
    customLegendContent,
  ]); // Added dependencies

  // --- Visualization Update Effect ---
  useEffect(() => {
    // Simplified log for clarity
    console.log("[VizUpdate Effect] TRIGGERED by dependency change.");

    let currentLabelLoadTimeoutId = null;
    let isEffectMounted = true;

    const runUpdate = async () => {
      // *** CHECK FOR LABEL MANAGER READY STATE ***
      if (!isLabelManagerReady) {
        console.log(
          "[VizUpdate Effect] Skipping update: Label Manager not ready yet."
        );
        return; // Exit early if manager isn't ready
      }

      console.log(
        "[VizUpdate Effect] Calling updateVisualizationAndLegend (Label Manager Ready)..."
      );
      // Call the extracted and memoized logic function
      const timeoutId = await updateVisualizationAndLegend();

      // Only store the timeout ID if the effect is still considered "mounted"
      if (isEffectMounted && timeoutId) {
        currentLabelLoadTimeoutId = timeoutId;
        console.log(
          `[VizUpdate Effect] Stored label refresh timeout ID: ${currentLabelLoadTimeoutId}`
        );
      } else if (!isEffectMounted && timeoutId) {
        console.log(
          `[VizUpdate Effect] Clearing timeout ${timeoutId} immediately as effect unmounted during update.`
        );
        clearTimeout(timeoutId);
      } else {
        console.log(
          "[VizUpdate Effect] Update finished (no timeout needed or effect unmounted)."
        );
      }
    };

    runUpdate();

    // --- Cleanup function for this useEffect ---
    return () => {
      console.log("[VizUpdate Effect] CLEANUP running.");
      isEffectMounted = false;

      if (currentLabelLoadTimeoutId) {
        console.log(
          "[VizUpdate Effect] Clearing label refresh timeout in cleanup:",
          currentLabelLoadTimeoutId
        );
        clearTimeout(currentLabelLoadTimeoutId);
        currentLabelLoadTimeoutId = null;
      }

      // Save positions on cleanup - crucial for catching changes before unmount/re-render
      console.log(
        "[VizUpdate Effect] Attempting to save positions during cleanup."
      );
      saveLabelPositions(true); // Force save using memoized function

      console.log("[VizUpdate Effect] Cleanup finished.");
    };
    // --- End Cleanup function ---
  }, [updateVisualizationAndLegend, isLabelManagerReady]); // <<< ADD isLabelManagerReady

  // --- Initial Config Loading Effect ---
  useEffect(() => {
    // Skip if map isn't ready
    if (!mapView?.map || !projectId) {
      // Added projectId check
      console.log(
        "[Config Load Effect] Skipping: MapView not ready or no Project ID."
      );
      return;
    }

    // Load configurations from API
    console.log("[Config Load Effect] Loading map configurations...");
    loadMapConfigurations(); // This function now handles projectId internally
  }, [mapView?.map, projectId]); // Depend on map and projectId

  // 11. Visualization refresh event handler (Ensure label manager checks)
  useEffect(() => {
    const handleRefreshVisualization = (event) => {
      const { tabId, config } = event.detail;
      if (!tabId || !mapView?.map) return;
      const tabData = tabs.find((tab) => tab.id === tabId);
      if (!tabData || !tabData.visualizationType) return;
      let vizType = tabData.visualizationType; // ... normalize ...

      // --- Added Defensive Check ---
      saveLabelPositions(true); // Save before refresh

      // Remove layers
      const layersToRemove = mapView.map.layers
        .filter((l) => l?.isVisualizationLayer)
        .toArray();
      if (layersToRemove.length > 0) mapView.map.removeMany(layersToRemove);

      createLayers(
        vizType,
        config || tabData.layerConfiguration,
        initialLayerConfigurations,
        tabData.areaType
      )
        .then(async (newLayer) => {
          // Make async
          if (!newLayer) return;
          mapView.map.add(newLayer, 0);
          // Specific handlers
          if (vizType === "pipe")
            await handlePipeVisualization(tabData, newLayer);
          else if (vizType === "comp")
            await handleCompVisualization(tabData, newLayer);
          else if (vizType === "custom")
            await handleCustomDataVisualization(tabData, newLayer);
          // Update legend
          if (legend && !isEditorOpen && !isLabelEditorOpen) {
            // Check BOTH editors
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = true;
            styleLegend(legend.container); // Apply style
          } else if (legend) {
            legend.visible = false;
          }
          // Load positions after refresh (use the function)
          setTimeout(() => loadLabelPositions(true, true), 500);
        })
        .catch((err) => console.error("Error refreshing visualization:", err));
    };
    window.addEventListener("refreshVisualization", handleRefreshVisualization);
    return () =>
      window.removeEventListener(
        "refreshVisualization",
        handleRefreshVisualization
      );
  }, [
    mapView,
    tabs,
    legend,
    isEditorOpen, // Added dependency
    isLabelEditorOpen, // Added dependency
    // Assuming these handlers are stable (defined outside or memoized)
    // handlePipeVisualization, handleCompVisualization, handleCustomDataVisualization,
    saveLabelPositions, // Added dependency
    loadLabelPositions, // Added dependency
    initialLayerConfigurations, // Added dependency
    createLayers, // Added dependency
  ]);

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
                        defaultValue={tab.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
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
                const activeTabData = tabs.find((tab) => tab.id === activeTab);
                const activeVisOption = visualizationOptions.find(
                  (opt) => opt.value === activeTabData?.visualizationType
                );
                const showDropdowns =
                  activeVisOption &&
                  (activeVisOption.type === "class-breaks" ||
                    activeVisOption.type === "dot-density");
                const showEditButton = activeTab !== 1;

                return (
                  <>
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

                    {showEditButton && (
                      <div className="flex">
                        <button
                          onClick={openLayerPropertiesEditor}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-l hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                          title="Edit layer properties"
                        >
                          Edit Map/Legend
                        </button>
                        <button
                          onClick={openLabelEditor}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-r border-l border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none flex items-center"
                          title="Edit map labels"
                          disabled={!isLabelManagerReady}
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
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.savePositions === "function"
                ) {
                  try {
                    await labelManagerRef.current.savePositions(true);
                    console.log(
                      "[Save Button] Label positions saved before saving map configs."
                    );
                  } catch (labelSaveError) {
                    console.error(
                      "Error saving label positions before map config save:",
                      labelSaveError
                    );
                    alert(
                      "Warning: Could not save label positions. Proceeding with map config save."
                    );
                  }
                } else {
                  console.warn(
                    "[Save Button] Label manager not available to save positions."
                  );
                }
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

                  const createdConfigs = [];
                  for (const config of configurations) {
                    const response = await mapConfigurationsAPI.create(
                      projectId,
                      { ...config, project: projectId }
                    );
                    if (response.data && response.data.id) {
                      createdConfigs.push({
                        tabName: config.tab_name,
                        configId: response.data.id,
                        originalTabId: tabs.find(
                          (t) => t.name === config.tab_name
                        )?.id,
                      });
                    }
                  }
                  setTabs((prevTabs) =>
                    prevTabs.map((t) => {
                      const created = createdConfigs.find(
                        (c) => c.originalTabId === t.id
                      );
                      return {
                        ...t,
                        configId: created ? created.configId : t.configId,
                      };
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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Map container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full">
            <ZoomAlert />
            {renderCustomLegend()}

            {isPlacingSiteLocation && (
              <div className="absolute top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-md z-30 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Click on the map to place site location
                <button
                  onClick={() => toggleSiteLocationPlacement(false)}
                  className="ml-2 p-1 bg-yellow-600 rounded-full hover:bg-yellow-700"
                  aria-label="Cancel site location placement"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
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
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Consolidated Side Panel (Positioned RIGHT) */}
        <div
          className={`
            absolute top-0 right-[440px] h-full 
            w-[500px] 
            bg-white dark:bg-gray-800 
            border-l border-gray-200 dark:border-gray-700 
            transform transition-transform duration-300 ease-in-out 
            z-20 
            ${
              isEditorOpen || isLabelEditorOpen
                ? "translate-x-0"
                : "translate-x-full"
            } 
          `}
        >
          {isEditorOpen && (
            <LayerPropertiesEditor
              isOpen={isEditorOpen}
              onClose={closeSidePanel}
              visualizationType={
                tabs.find((tab) => tab.id === activeTab)?.visualizationType
              }
              layerConfig={
                tabs.find((tab) => tab.id === activeTab)?.layerConfiguration ||
                (tabs.find((tab) => tab.id === activeTab)?.visualizationType
                  ? initialLayerConfigurations[
                      tabs.find((tab) => tab.id === activeTab).visualizationType
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
              mapView={mapView}
              activeLayer={activeLayersRef.current[activeTab]}
              labelManager={labelManagerRef.current}
              isLabelEditMode={isLabelEditorOpen}
              onLabelEditModeChange={setIsLabelEditorOpen}
            />
          )}

          {isLabelEditorOpen && isLabelManagerReady && (
            <LabelEditor
              isOpen={isLabelEditorOpen}
              onClose={closeSidePanel}
              mapView={mapView}
              labelManager={labelManagerRef.current}
              labelDragger={labelDragger}
              activeLayer={activeLayersRef.current[activeTab]}
            />
          )}
          {isLabelEditorOpen && !isLabelManagerReady && (
            <div className="p-4 text-center text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300">
              Label Manager is initializing... Please wait.
            </div>
          )}
        </div>
      </div>

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

// --- Add PropTypes ---
MapComponent.propTypes = {
  onToggleLis: PropTypes.func,
};
