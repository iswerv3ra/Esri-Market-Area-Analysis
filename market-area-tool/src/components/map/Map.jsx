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

  const updateInProgressRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const lastProcessedTabRef = useRef(null);
  const lastProcessedTimeRef = useRef(0);
  const lastEffectTimeRef = useRef(0);

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
   * Enhanced handleCreateMap function with duplicate save prevention
   * This function processes map data, normalizes configurations, ensures proper field mapping,
   * and handles API persistence intelligently (skipping if already saved by NewMapDialog)
   */
  const handleCreateMap = async (mapData) => {
    console.log("[Map] Processing new map creation:", {
      name: mapData.name,
      type: mapData.type,
      hasConfig: !!mapData.layerConfiguration,
      configId: mapData.configId,
      hasOriginalFormData: !!mapData.originalFormData,
      alreadySaved: !!mapData.configId,
    });

    try {
      // Validate required inputs early
      if (!projectId) {
        throw new Error("Project ID is required to create map configuration");
      }

      if (!mapData.name || !mapData.name.trim()) {
        throw new Error("Map name is required");
      }

      // Check if this configuration was already saved by NewMapDialog
      const isAlreadySaved = !!(
        mapData.configId && mapData.configId !== "temp"
      );
      const tabId = isAlreadySaved ? mapData.configId : Date.now();

      console.log("[Map] Configuration save status:", {
        isAlreadySaved,
        configId: mapData.configId,
        usingTabId: tabId,
      });

      // Extract and validate the layer configuration
      const layerConfig = mapData.layerConfiguration;
      if (!layerConfig) {
        throw new Error("Layer configuration is missing from map data");
      }

      // Helper function to extract actual field name from visualization identifier
      const extractActualFieldName = (visualizationId) => {
        if (!visualizationId) return null;

        // Remove common UI suffixes that don't exist in the actual data
        const suffixesToRemove = ["_HEAT", "_DOT", "_VIZ", "_MAP"];
        let fieldName = visualizationId;

        for (const suffix of suffixesToRemove) {
          if (fieldName.endsWith(suffix)) {
            fieldName = fieldName.replace(suffix, "");
            console.log(
              `[Map] Stripped suffix '${suffix}' from field name: ${visualizationId} -> ${fieldName}`
            );
            break;
          }
        }

        return fieldName;
      };

      // Normalize visualization type and extract proper field name
      let normalizedVisualizationType = mapData.type;
      let actualFieldName = null;

      if (mapData.type === "heatmap" || mapData.type === "dotdensity") {
        const originalFormData = mapData.originalFormData;

        if (originalFormData?.selectedVisualization) {
          // Keep the full visualization identifier for UI purposes
          normalizedVisualizationType = originalFormData.selectedVisualization;
          // Extract the actual field name for the data layer
          actualFieldName = extractActualFieldName(
            originalFormData.selectedVisualization
          );

          console.log("[Map] Field mapping:", {
            selectedVisualization: originalFormData.selectedVisualization,
            normalizedVisualizationType: normalizedVisualizationType,
            actualFieldName: actualFieldName,
          });
        } else if (layerConfig.visualizationKey) {
          normalizedVisualizationType = layerConfig.visualizationKey;
          actualFieldName = extractActualFieldName(
            layerConfig.visualizationKey
          );
        } else if (layerConfig.field) {
          // If field is already set, extract the actual field name from it
          actualFieldName = extractActualFieldName(layerConfig.field);
          normalizedVisualizationType = layerConfig.field;
        }

        // Ensure we have a valid field name
        if (!actualFieldName) {
          throw new Error(
            `Could not determine actual field name from visualization: ${normalizedVisualizationType}`
          );
        }
      }

      // Process and validate area type for the new tab
      let processedAreaType = areaTypes[0]; // Default fallback

      if (mapData.areaType) {
        if (
          typeof mapData.areaType === "object" &&
          mapData.areaType.value !== undefined
        ) {
          processedAreaType = mapData.areaType;
        } else if (typeof mapData.areaType === "string") {
          const foundAreaType = areaTypes.find(
            (at) =>
              at.label.toLowerCase() === mapData.areaType.toLowerCase() ||
              at.value.toString() === mapData.areaType
          );
          processedAreaType = foundAreaType || areaTypes[0];
        } else if (typeof mapData.areaType === "number") {
          const foundAreaType = areaTypes.find(
            (at) => at.value === mapData.areaType
          );
          processedAreaType = foundAreaType || areaTypes[0];
        }
      } else if (mapData.originalFormData?.selectedAreaType) {
        processedAreaType = mapData.originalFormData.selectedAreaType;
      }

      // Enhanced area type conversion with better validation
      const convertAreaTypeToString = (value) => {
        if (!value) return "tract"; // Default fallback

        if (typeof value === "string") {
          const cleanValue = value.toLowerCase().trim();
          // Validate against known area types
          const validAreaTypes = [
            "county",
            "tract",
            "block_group",
            "zip",
            "place",
            "cbsa",
            "state",
          ];
          return validAreaTypes.includes(cleanValue) ? cleanValue : "tract";
        }

        if (typeof value === "number") {
          switch (value) {
            case 11:
              return "county";
            case 12:
              return "tract";
            case 150:
              return "block_group";
            default:
              return "tract";
          }
        }

        if (typeof value === "object" && value?.value !== undefined) {
          return convertAreaTypeToString(value.value);
        }

        return "tract"; // Final fallback
      };

      // Create enhanced layer configuration with proper field mapping
      const enhancedLayerConfig = {
        ...layerConfig,
        // Use the ACTUAL field name for data querying, not the UI identifier
        field:
          actualFieldName || layerConfig.field || normalizedVisualizationType,
        // Keep the full visualization key for UI/legend purposes
        visualizationKey: normalizedVisualizationType,
        // Ensure proper type mapping for the renderer
        type:
          mapData.type === "heatmap"
            ? "class-breaks"
            : mapData.type === "dotdensity"
            ? "dot-density"
            : layerConfig.type,
        // Add area type for proper layer creation
        areaType: convertAreaTypeToString(
          processedAreaType?.value || processedAreaType || "tract"
        ),
        // Add metadata for context
        mapConfigId: tabId,
        originalMapType: mapData.type,
        // Store the original visualization selection for reference
        originalVisualizationSelection:
          mapData.originalFormData?.selectedVisualization,
      };

      console.log("[Map] Enhanced layer configuration:", {
        field: enhancedLayerConfig.field,
        visualizationKey: enhancedLayerConfig.visualizationKey,
        type: enhancedLayerConfig.type,
        originalMapType: enhancedLayerConfig.originalMapType,
        areaType: enhancedLayerConfig.areaType,
      });

      // Create the new tab object with comprehensive configuration
      const newTab = {
        id: tabId,
        configId: isAlreadySaved ? mapData.configId : null, // Use existing ID if already saved
        mapConfigId: isAlreadySaved ? mapData.configId : null, // Use existing ID if already saved
        name: mapData.name.trim(), // Ensure no whitespace issues
        active: false, // Will be activated after creation
        visualizationType: normalizedVisualizationType,
        areaType: processedAreaType,
        layerConfiguration: enhancedLayerConfig,
        isEditing: false,
        hasBeenRendered: false, // Flag to track if this tab has been rendered
        originalFormData: mapData.originalFormData,
      };

      console.log("[Map] Created new tab object:", {
        id: newTab.id,
        name: newTab.name,
        visualizationType: newTab.visualizationType,
        areaType: newTab.areaType?.label,
        hasConfig: !!newTab.layerConfiguration,
        configField: newTab.layerConfiguration?.field,
        configType: newTab.layerConfiguration?.type,
        configVisualizationKey: newTab.layerConfiguration?.visualizationKey,
        isAlreadySaved: isAlreadySaved,
      });

      // SMART API SAVE: Only save if not already saved by NewMapDialog
      if (isAlreadySaved) {
        console.log(
          "[Map] Configuration already saved by NewMapDialog, using existing ID:",
          mapData.configId
        );

        // Update the layer config with the existing ID
        enhancedLayerConfig.mapConfigId = mapData.configId;
        newTab.layerConfiguration = enhancedLayerConfig;
      } else {
        console.log("[Map] Configuration not yet saved, saving to API...");

        // Validate required fields before API call
        const areaTypeString = convertAreaTypeToString(processedAreaType);
        if (!areaTypeString) {
          throw new Error("Could not determine valid area type for API save");
        }

        if (
          !normalizedVisualizationType ||
          normalizedVisualizationType.trim() === ""
        ) {
          throw new Error("Visualization type is required for API save");
        }

        // Prepare configuration for API save with enhanced validation
        const configurationToSave = {
          project: projectId,
          tab_name: newTab.name.trim(),
          visualization_type: normalizedVisualizationType.trim(),
          area_type: areaTypeString,
          layer_configuration: enhancedLayerConfig,
          order: tabs.length,
        };

        // Additional validation before API call
        if (configurationToSave.tab_name.length > 100) {
          throw new Error("Map name is too long (maximum 100 characters)");
        }

        console.log("[Map] Prepared configuration for API save:", {
          project: configurationToSave.project,
          tab_name: configurationToSave.tab_name,
          visualization_type: configurationToSave.visualization_type,
          area_type: configurationToSave.area_type,
          order: configurationToSave.order,
          hasLayerConfig: !!configurationToSave.layer_configuration,
          layerConfigType: configurationToSave.layer_configuration?.type,
          layerConfigField: configurationToSave.layer_configuration?.field,
        });

        try {
          // Save the configuration to the API
          const saveResponse = await mapConfigurationsAPI.create(
            projectId,
            configurationToSave
          );

          if (saveResponse && saveResponse.data && saveResponse.data.id) {
            // Update the tab with the returned configuration ID
            newTab.configId = saveResponse.data.id;
            newTab.mapConfigId = saveResponse.data.id;
            newTab.id = saveResponse.data.id; // Use the API-generated ID as the tab ID

            // Update the layer config with the new ID as well
            enhancedLayerConfig.mapConfigId = saveResponse.data.id;
            newTab.layerConfiguration = enhancedLayerConfig;

            console.log(
              "[Map] Successfully saved new map configuration to API:",
              {
                apiId: saveResponse.data.id,
                tabName: newTab.name,
                visualizationType: normalizedVisualizationType,
              }
            );

            console.log(
              `[Map] Map "${newTab.name}" created and saved successfully`
            );
          } else {
            console.warn(
              "[Map] API save succeeded but no ID returned, using local ID"
            );
            throw new Error("API response missing configuration ID");
          }
        } catch (apiError) {
          console.error(
            "[Map] Failed to save new map configuration to API:",
            apiError
          );

          // Enhanced error handling with more specific error messages
          let errorMessage = "Unknown error occurred";

          if (apiError.response?.data) {
            const errorData = apiError.response.data;
            if (typeof errorData === "object") {
              const errorMessages = [];

              // Check for field-specific errors
              Object.keys(errorData).forEach((field) => {
                const fieldErrors = errorData[field];
                if (Array.isArray(fieldErrors)) {
                  errorMessages.push(`${field}: ${fieldErrors.join(", ")}`);
                } else if (typeof fieldErrors === "string") {
                  errorMessages.push(`${field}: ${fieldErrors}`);
                }
              });

              if (errorMessages.length > 0) {
                errorMessage = errorMessages.join("; ");
              } else if (errorData.detail) {
                errorMessage = errorData.detail;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              }
            } else if (typeof errorData === "string") {
              errorMessage = errorData;
            }
          } else if (apiError.message) {
            errorMessage = apiError.message;
          }

          // Show detailed error to user
          alert(
            `Failed to save map configuration to server:\n\n${errorMessage}\n\nThe map will be created locally but may not persist on reload.`
          );

          // Continue with local creation even if API save fails
          console.log(
            "[Map] Continuing with local map creation despite API save failure"
          );
        }
      }

      // Clear any existing visualization layers before switching
      if (mapView?.map) {
        const layersToRemove = mapView.map.layers
          .filter((layer) => layer?.isVisualizationLayer === true)
          .toArray();

        if (layersToRemove.length > 0) {
          console.log(
            `[Map] Removing ${layersToRemove.length} existing visualization layers`
          );
          mapView.map.removeMany(layersToRemove);

          // Wait a moment for layers to be fully removed
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Reset timing references to ensure immediate update
      lastEffectTimeRef.current = 0;
      lastProcessedTabRef.current = null;
      lastProcessedTimeRef.current = 0;

      console.log("[Map] Reset timing references for immediate rendering");

      // Update tabs state atomically to prevent race conditions
      setTabs((prevTabs) => {
        const updatedTabs = prevTabs.map((tab) => ({
          ...tab,
          active: false, // Deactivate all existing tabs
        }));

        // Add the new tab as active
        updatedTabs.push({
          ...newTab,
          active: true,
        });

        console.log(
          "[Map] Updated tabs array, new tab count:",
          updatedTabs.length
        );
        return updatedTabs;
      });

      // Switch to the new tab
      setActiveTab(newTab.id);
      console.log("[Map] Set active tab to:", newTab.id);

      // Update layer configurations to ensure proper rendering
      setLayerConfigurations((prev) => ({
        ...prev,
        [normalizedVisualizationType]: enhancedLayerConfig,
      }));

      // Dispatch success event for other components to listen to
      window.dispatchEvent(
        new CustomEvent("mapCreated", {
          detail: {
            tabId: newTab.id,
            configId: newTab.configId,
            name: newTab.name,
            visualizationType: normalizedVisualizationType,
            success: true,
            savedToAPI: !!newTab.configId,
            wasAlreadySaved: isAlreadySaved,
          },
        })
      );

      console.log(
        "[Map] Map creation completed successfully. New tab activated:",
        newTab.id
      );
    } catch (error) {
      console.error("[Map] Error processing map creation:", error);

      // Show error to user with specific details
      const errorMessage = error.message || "Unknown error occurred";
      alert(`Failed to create map: ${errorMessage}`);

      // Reset any partial state changes
      if (mapView?.map) {
        const layersToRemove = mapView.map.layers
          .filter((layer) => layer?.isVisualizationLayer === true)
          .toArray();

        if (layersToRemove.length > 0) {
          mapView.map.removeMany(layersToRemove);
        }
      }

      // Dispatch failure event
      window.dispatchEvent(
        new CustomEvent("mapCreationFailed", {
          detail: {
            error: errorMessage,
            mapData: mapData,
          },
        })
      );
    }
  };

  const handlePipeVisualization = async (tabData, layer = null) => {
    const tabId = tabData?.id;
    console.log(
      `[handlePipeVisualization] Processing pipe layer for tab ${tabId}`
    );

    try {
      // Extract and validate context information
      const mapConfigId =
        tabData?.configId ||
        tabData?.id ||
        tabData?.mapConfigId ||
        sessionStorage.getItem("currentMapConfigId");

      const projectId =
        localStorage.getItem("currentProjectId") ||
        sessionStorage.getItem("currentProjectId");

      if (!projectId) {
        throw new Error("Project ID is required for pipe visualization");
      }

      if (!mapConfigId) {
        console.warn(
          "[handlePipeVisualization] No mapConfigId found - labels may not persist correctly"
        );
      }

      // Find target layer with comprehensive search
      let targetLayer = layer || activeLayersRef.current?.[tabId];

      if (!targetLayer && mapView?.map?.layers) {
        targetLayer = mapView.map.layers.find(
          (l) =>
            l &&
            ((l.isVisualizationLayer === true &&
              l.visualizationType === "pipe") ||
              l.mapConfigId === mapConfigId ||
              l.title === tabData?.name)
        );
      }

      if (!targetLayer) {
        console.error(
          `[handlePipeVisualization] No pipe layer found for tab ${tabId}`
        );
        return { success: false, error: "No pipe layer found" };
      }

      console.log(
        `[handlePipeVisualization] Using pipe layer: "${targetLayer.title}" (ID: ${targetLayer.id})`
      );

      // Ensure layer has proper context metadata
      if (mapConfigId && !targetLayer.mapConfigId) {
        targetLayer.mapConfigId = mapConfigId;
        targetLayer.mapType = "pipe";
        console.log(
          `[handlePipeVisualization] Applied context metadata to layer`
        );
      }

      // Configure LabelManager context with comprehensive validation
      if (labelManagerRef.current) {
        try {
          // Store current context for comparison
          const previousContext = {
            projectId: labelManagerRef.current.projectId,
            mapConfigId: labelManagerRef.current.mapConfigId,
            mapType: labelManagerRef.current.mapType,
          };

          // Set new context
          labelManagerRef.current.setContext(projectId, mapConfigId, "pipe");

          // Verify context was applied correctly
          const newContext = {
            projectId: labelManagerRef.current.projectId,
            mapConfigId: labelManagerRef.current.mapConfigId,
            mapType: labelManagerRef.current.mapType,
          };

          const contextChanged =
            previousContext.mapConfigId !== newContext.mapConfigId ||
            previousContext.mapType !== newContext.mapType;

          console.log(
            `[handlePipeVisualization] LabelManager context updated:`,
            {
              previous: previousContext,
              new: newContext,
              changed: contextChanged,
            }
          );

          // Configure pipe-specific settings
          if (
            typeof labelManagerRef.current.configureLayerSettings === "function"
          ) {
            labelManagerRef.current.configureLayerSettings("pipe");
          }
        } catch (contextError) {
          console.error(
            "[handlePipeVisualization] Error configuring LabelManager context:",
            contextError
          );
          throw contextError;
        }
      } else {
        throw new Error("LabelManager not available");
      }

      // Process pipe labels with comprehensive error handling and optimization
      if (!targetLayer._pipeLabelsProcessed) {
        targetLayer._pipeLabelsProcessed = true;
        targetLayer._isBeingProcessed = true;

        try {
          // Process layer with delay to ensure graphics are fully loaded
          await new Promise((resolve) => setTimeout(resolve, 100));

          console.log(`[handlePipeVisualization] Processing pipe layer labels`);
          const processedLabels =
            labelManagerRef.current.processLayer(targetLayer);

          const processingResult = {
            layerId: targetLayer.id,
            layerTitle: targetLayer.title,
            processedLabelCount: Array.isArray(processedLabels)
              ? processedLabels.length
              : 0,
            totalGraphics: targetLayer.graphics?.length || 0,
            success: true,
          };

          console.log(
            `[handlePipeVisualization] Label processing completed:`,
            processingResult
          );

          // Apply optimization for pipe networks with many labels
          if (processingResult.processedLabelCount > 5) {
            setTimeout(async () => {
              try {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.optimizeAllLabels ===
                    "function"
                ) {
                  console.log(
                    `[handlePipeVisualization] Running optimization for ${processingResult.processedLabelCount} pipe labels`
                  );
                  labelManagerRef.current.optimizeAllLabels();
                }
              } catch (optimizationError) {
                console.warn(
                  "[handlePipeVisualization] Label optimization failed:",
                  optimizationError
                );
              }
            }, 300);
          }

          // Refresh labels after processing
          setTimeout(async () => {
            try {
              if (
                labelManagerRef.current &&
                typeof labelManagerRef.current.refreshLabels === "function"
              ) {
                labelManagerRef.current.refreshLabels();
                console.log(
                  "[handlePipeVisualization] Labels refreshed successfully"
                );
              }
            } catch (refreshError) {
              console.warn(
                "[handlePipeVisualization] Label refresh failed:",
                refreshError
              );
            } finally {
              // Clear processing flag
              if (targetLayer) {
                targetLayer._isBeingProcessed = false;
              }
            }
          }, 500);

          return {
            success: true,
            layerId: targetLayer.id,
            labelsProcessed: processingResult.processedLabelCount,
            result: processingResult,
          };
        } catch (processingError) {
          console.error(
            "[handlePipeVisualization] Error processing pipe labels:",
            processingError
          );
          targetLayer._isBeingProcessed = false;
          targetLayer._pipeLabelsProcessed = false; // Reset to allow retry
          throw processingError;
        }
      } else {
        console.log(
          "[handlePipeVisualization] Pipe layer already processed, skipping"
        );
        return { success: true, skipped: true, reason: "Already processed" };
      }
    } catch (error) {
      console.error(
        "[handlePipeVisualization] Critical error in pipe visualization:",
        error
      );
      return {
        success: false,
        error: error.message,
        tabId: tabId,
      };
    }
  };

  const handleCompVisualization = async (tabData, layer = null) => {
    const tabId = tabData?.id;
    console.log(
      `[handleCompVisualization] Processing comp layer for tab: ${tabId}`
    );

    if (!mapView?.map || !tabData) {
      const error = "Map view or tabData not available";
      console.warn(`[handleCompVisualization] ${error}`);
      return { success: false, error: error };
    }

    try {
      // Extract and validate context information
      const mapConfigId =
        tabData?.configId ||
        tabData?.id ||
        tabData?.mapConfigId ||
        sessionStorage.getItem("currentMapConfigId");

      const projectId =
        localStorage.getItem("currentProjectId") ||
        sessionStorage.getItem("currentProjectId");

      if (!projectId) {
        throw new Error("Project ID is required for comp visualization");
      }

      console.log(`[handleCompVisualization] Context extracted:`, {
        projectId,
        mapConfigId,
        tabId,
      });

      // Find the comp layer with enhanced search logic
      let compLayer = null;
      if (layer) {
        compLayer = layer;
      } else if (activeLayersRef.current?.[tabId]) {
        compLayer = activeLayersRef.current[tabId];
      } else if (mapView.map.layers) {
        // Search through all layers for matching comp layer
        compLayer = mapView.map.layers.find(
          (l) =>
            l &&
            ((l.isVisualizationLayer === true &&
              l.visualizationType === "comp") ||
              l.mapConfigId === mapConfigId ||
              l.title === tabData?.name)
        );
      }

      if (!compLayer) {
        const error = `No comp layer found for tab ${tabId}`;
        console.error(`[handleCompVisualization] ${error}`);
        return { success: false, error: error };
      }

      console.log(
        `[handleCompVisualization] Processing comp layer: "${compLayer.title}" (ID: ${compLayer.id})`
      );

      // Ensure layer has proper context metadata
      if (mapConfigId && !compLayer.mapConfigId) {
        compLayer.mapConfigId = mapConfigId;
        compLayer.mapType = "comp";
        console.log(
          `[handleCompVisualization] Applied context metadata to comp layer`
        );
      }

      // Configure LabelManager with comprehensive validation
      if (labelManagerRef.current) {
        try {
          // Store context information for tracking
          const contextInfo = {
            projectId: projectId,
            mapConfigId: mapConfigId,
            mapType: "comp",
            timestamp: Date.now(),
          };

          // Update session storage
          sessionStorage.setItem("currentMapConfigId", mapConfigId);
          sessionStorage.setItem("currentMapType", "comp");
          sessionStorage.setItem("currentProjectId", projectId);

          // Set LabelManager context
          labelManagerRef.current.setContext(projectId, mapConfigId, "comp");

          // Verify context was applied correctly
          const verificationResult = {
            success: labelManagerRef.current.mapConfigId === mapConfigId,
            managerConfigId: labelManagerRef.current.mapConfigId,
            expectedConfigId: mapConfigId,
            managerType: labelManagerRef.current.mapType,
          };

          if (!verificationResult.success) {
            throw new Error(
              `LabelManager context verification failed. Expected: ${mapConfigId}, Got: ${labelManagerRef.current.mapConfigId}`
            );
          }

          console.log(
            `[handleCompVisualization] LabelManager context verified successfully:`,
            verificationResult
          );

          // Configure comp-specific settings
          if (
            typeof labelManagerRef.current.configureLayerSettings === "function"
          ) {
            labelManagerRef.current.configureLayerSettings("comp");
          }
        } catch (contextError) {
          console.error(
            "[handleCompVisualization] Error configuring LabelManager:",
            contextError
          );
          throw contextError;
        }
      } else {
        throw new Error("LabelManager not available");
      }

      // Process layer with comprehensive error handling and optimization
      if (!compLayer._isBeingProcessed) {
        compLayer._isBeingProcessed = true;

        try {
          // Allow graphics to fully load before processing
          await new Promise((resolve) => setTimeout(resolve, 150));

          console.log(`[handleCompVisualization] Processing comp layer labels`);
          const processedLabels =
            labelManagerRef.current.processLayer(compLayer);

          const processingResult = {
            layerId: compLayer.id,
            layerTitle: compLayer.title,
            processedLabelCount: Array.isArray(processedLabels)
              ? processedLabels.length
              : 0,
            totalGraphics: compLayer.graphics?.length || 0,
            context: {
              mapConfigId: mapConfigId,
              mapType: "comp",
            },
            success: true,
          };

          console.log(
            `[handleCompVisualization] Comp layer processing completed:`,
            processingResult
          );

          // Trigger global optimization for comp layers with many labels
          if (processingResult.processedLabelCount > 8) {
            console.log(
              `[handleCompVisualization] Triggering global optimization for ${processingResult.processedLabelCount} comp labels`
            );

            setTimeout(async () => {
              try {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.optimizeAllLabels ===
                    "function"
                ) {
                  labelManagerRef.current.optimizeAllLabels();
                  console.log(
                    "[handleCompVisualization] Global optimization completed"
                  );
                }
              } catch (optimizationError) {
                console.warn(
                  "[handleCompVisualization] Global optimization failed:",
                  optimizationError
                );
              }
            }, 400);
          }

          // Refresh labels after processing with comprehensive error handling
          setTimeout(async () => {
            try {
              if (
                labelManagerRef.current &&
                typeof labelManagerRef.current.refreshLabels === "function"
              ) {
                labelManagerRef.current.refreshLabels();
                console.log(
                  "[handleCompVisualization] Labels refreshed successfully"
                );
              }
            } catch (refreshError) {
              console.warn(
                "[handleCompVisualization] Label refresh failed:",
                refreshError
              );
            } finally {
              // Always clear processing flag
              compLayer._isBeingProcessed = false;
            }
          }, 600);

          // Set layer protection flags
          compLayer.visible = true;
          compLayer._preventRemoval = true;
          compLayer._processedByCompVisualization = true;

          return {
            success: true,
            layerId: compLayer.id,
            labelsProcessed: processingResult.processedLabelCount,
            result: processingResult,
          };
        } catch (processingError) {
          console.error(
            `[handleCompVisualization] Error processing comp layer:`,
            processingError
          );
          compLayer._isBeingProcessed = false;
          throw processingError;
        }
      } else {
        console.log(
          "[handleCompVisualization] Comp layer already being processed, skipping"
        );
        return { success: true, skipped: true, reason: "Already processing" };
      }
    } catch (error) {
      console.error(
        "[handleCompVisualization] Critical error during comp visualization:",
        error
      );
      return {
        success: false,
        error: error.message,
        tabId: tabId,
      };
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

  /**
   * Enhanced handleCustomDataVisualization with label optimization
   */
  const handleCustomDataVisualization = async (tabData) => {
    console.log("Processing Custom Data Map with optimization:", tabData);

    if (!mapView?.map || !tabData?.layerConfiguration) {
      console.warn(
        "Custom data visualization cancelled: Missing requirements."
      );
      return;
    }

    const customLayer = mapView.map.layers.find(
      (l) =>
        l && l.isVisualizationLayer === true && l.visualizationType === "custom"
    );

    if (!customLayer) {
      console.error("Custom Data GraphicsLayer not found.");
      return;
    }

    // Clear existing graphics
    customLayer.removeAll();

    const config = tabData.layerConfiguration;
    const customData = config?.customData?.data || [];
    const nameColumn = config?.customData?.nameColumn || config?.labelColumn;

    // Check if labels should be disabled
    const disableLayerLabels =
      config.labelColumn === null || config.hasNoLabels || config.hideAllLabels;

    if (customLayer.labelsVisible !== undefined) {
      customLayer.labelsVisible = !disableLayerLabels;
    }
    customLayer._hasNoLabels = disableLayerLabels;

    console.log(
      `Processing ${customData.length} custom points, labels disabled: ${disableLayerLabels}`
    );

    if (!Array.isArray(customData) || customData.length === 0) {
      return;
    }

    try {
      // Import required modules
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

      // Create graphics
      const symbolConfig = config?.symbol;
      let pointSymbol = new SimpleMarkerSymbol({
        style: symbolConfig?.style || "circle",
        color: new Color(symbolConfig?.color || "#FF0000"),
        size: symbolConfig?.size || "10px",
        outline: symbolConfig?.outline
          ? {
              color: new Color(symbolConfig.outline.color || "#FFFFFF"),
              width: symbolConfig.outline.width || 1,
            }
          : null,
      });

      const popupTemplate = nameColumn
        ? new PopupTemplate({
            title: `{${nameColumn}}`,
            content: [
              {
                type: "fields",
                fieldInfos: [
                  { fieldName: nameColumn, label: nameColumn },
                  {
                    fieldName: config?.valueColumn,
                    label: config?.valueColumn || "Value",
                  },
                ],
              },
            ],
          })
        : null;

      const graphicsToAdd = [];

      customData.forEach((item, index) => {
        const latitude = parseFloat(item[config?.latitudeColumn || "latitude"]);
        const longitude = parseFloat(
          item[config?.longitudeColumn || "longitude"]
        );

        if (isNaN(latitude) || isNaN(longitude)) return;

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

        // Handle label configuration
        if (!disableLayerLabels) {
          attributes.labelText =
            item[nameColumn] || item.name || item.title || String(index + 1);
        } else {
          attributes.noLabel = true;
          attributes._hideLabel = true;
          attributes.labelText = null;
        }

        if (nameColumn) attributes[nameColumn] = item[nameColumn] ?? "N/A";
        if (config?.valueColumn)
          attributes[config.valueColumn] = item[config.valueColumn] ?? null;

        const graphic = new Graphic({
          geometry: point,
          symbol: pointSymbol,
          attributes: attributes,
          popupTemplate: popupTemplate,
        });

        graphicsToAdd.push(graphic);
      });

      // Add graphics to layer
      if (graphicsToAdd.length > 0) {
        customLayer.addMany(graphicsToAdd);
        console.log(`Added ${graphicsToAdd.length} graphics to custom layer`);

        // Process with label manager and optimization
        if (labelManagerRef.current && !disableLayerLabels) {
          setTimeout(() => {
            try {
              console.log(
                "Processing custom layer labels with optimization..."
              );

              const labelCount =
                labelManagerRef.current.processLayer(customLayer);

              // Run optimization for custom data if we have multiple points
              if (labelCount > 3) {
                setTimeout(() => {
                  if (
                    labelManagerRef.current &&
                    typeof labelManagerRef.current.optimizeAllLabels ===
                      "function"
                  ) {
                    console.log(
                      `Running optimization for ${labelCount} custom labels`
                    );
                    labelManagerRef.current.optimizeAllLabels();
                  }
                }, 400);
              }

              // Refresh labels after optimization
              setTimeout(() => {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  labelManagerRef.current.refreshLabels();
                  console.log(
                    `Refreshed custom layer labels (labels disabled: ${disableLayerLabels})`
                  );
                }
              }, 600);
            } catch (err) {
              console.error("Error processing labels for custom layer:", err);
            }
          }, 200);
        }
      }

      console.log(
        `Custom visualization complete: Added ${graphicsToAdd.length} points, labels disabled: ${disableLayerLabels}`
      );
    } catch (error) {
      console.error("Error during custom data visualization:", error);
    }
  };

  const updateVisualizationLayer = async () => {
    if (!mapView?.map || isConfigLoading) {
      console.log(
        "Map not ready or configs still loading, skipping visualization update"
      );
      return;
    }

    try {
      // [existing layer removal code...]

      const activeTabData = tabs.find((tab) => tab.id === activeTab);

      // Update legend visibility based on visualization type
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") vizType = "pipe";
        if (vizType === "comps") vizType = "comp";

        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(vizType);

        // Standard visualization types should show the standard legend
        const isStandardViz =
          vizType === "class-breaks" || vizType === "dot-density";

        // Hide legend for special types or when in editing mode
        if (legend) {
          if (isSpecialType) {
            // Custom legend types use customLegendContent
            legend.visible = false;

            // Set custom legend content for special types
            setCustomLegendContent({
              type: vizType,
              config: activeTabData.layerConfiguration,
            });
          } else if (isStandardViz && !isEditorOpen && !isLabelEditorOpen) {
            // Standard legend for regular feature layers
            legend.visible = true;
            styleLegend(legend.container);
            setCustomLegendContent(null);
          } else {
            // Hide for Core Map or in editing mode
            legend.visible = false;
            setCustomLegendContent(null);
          }
        }
      } else {
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

  /**
   * Comprehensive function to clear all visualization layers from the map
   * This ensures comp/pipe/custom layers are completely removed when switching tabs
   */
  const clearAllVisualizationLayers = useCallback(() => {
    if (!mapView?.map) {
      console.log("[clearAllVisualizationLayers] MapView not available");
      return { removed: 0, errors: [] };
    }

    const errors = [];
    let removedCount = 0;

    try {
      console.log(
        "[clearAllVisualizationLayers] Starting comprehensive layer removal..."
      );

      // Get all layers as array to avoid modification during iteration
      const allLayers = mapView.map.layers.toArray();
      console.log(
        `[clearAllVisualizationLayers] Found ${allLayers.length} total layers on map`
      );

      // Identify layers to remove with multiple criteria
      const layersToRemove = allLayers.filter((layer) => {
        if (!layer) return false;

        // Primary criteria: isVisualizationLayer flag
        if (layer.isVisualizationLayer === true) {
          console.log(
            `[clearAllVisualizationLayers] Found visualization layer: "${
              layer.title || layer.id
            }" (type: ${layer.type})`
          );
          return true;
        }

        // Secondary criteria: layer type and naming patterns
        if (layer.type === "graphics") {
          // Check for graphics layers that might be visualization layers
          const title = layer.title || "";
          const id = layer.id || "";

          // Check for common visualization layer patterns
          const isVisualizationByName =
            title.toLowerCase().includes("comp") ||
            title.toLowerCase().includes("pipe") ||
            title.toLowerCase().includes("custom") ||
            title.toLowerCase().includes("visualization") ||
            id.includes("visualization") ||
            layer.visualizationType; // Check for visualizationType property

          if (isVisualizationByName) {
            console.log(
              `[clearAllVisualizationLayers] Found potential visualization graphics layer: "${title}" (id: ${id})`
            );
            return true;
          }
        }

        // Tertiary criteria: layers with specific visualization properties
        if (layer.visualizationType || layer._isCustomVisualization) {
          console.log(
            `[clearAllVisualizationLayers] Found layer with visualization properties: "${
              layer.title || layer.id
            }"`
          );
          return true;
        }

        return false;
      });

      console.log(
        `[clearAllVisualizationLayers] Identified ${layersToRemove.length} layers for removal`
      );

      // Remove layers one by one for better error handling
      layersToRemove.forEach((layer, index) => {
        try {
          const layerTitle = layer.title || layer.id || `Layer ${index}`;

          // Clear any graphics first if it's a graphics layer
          if (
            layer.type === "graphics" &&
            layer.graphics &&
            layer.graphics.length > 0
          ) {
            const graphicsCount = layer.graphics.length;
            layer.removeAll();
            console.log(
              `[clearAllVisualizationLayers] Cleared ${graphicsCount} graphics from layer: ${layerTitle}`
            );
          }

          // Remove the layer from the map
          mapView.map.remove(layer);
          removedCount++;
          console.log(
            `[clearAllVisualizationLayers] Successfully removed layer: ${layerTitle}`
          );

          // Clear any references to this layer
          if (activeLayersRef.current) {
            Object.keys(activeLayersRef.current).forEach((tabId) => {
              if (activeLayersRef.current[tabId] === layer) {
                delete activeLayersRef.current[tabId];
                console.log(
                  `[clearAllVisualizationLayers] Cleared reference for tab ${tabId}`
                );
              }
            });
          }
        } catch (layerError) {
          const errorMsg = `Error removing layer ${layer.title || layer.id}: ${
            layerError.message
          }`;
          errors.push(errorMsg);
          console.error(
            `[clearAllVisualizationLayers] ${errorMsg}`,
            layerError
          );
        }
      });

      // Additional cleanup: remove any orphaned graphics from map view
      if (mapView.graphics && mapView.graphics.length > 0) {
        const tempGraphics = mapView.graphics.filter(
          (graphic) =>
            graphic.attributes &&
            (graphic.attributes.isVisualization ||
              graphic.attributes.isComp ||
              graphic.attributes.isPipe ||
              graphic.attributes.isCustomPoint ||
              graphic.attributes.isTemporary ||
              graphic.attributes.isMarketArea)
        );

        if (tempGraphics.length > 0) {
          mapView.graphics.removeMany(tempGraphics);
          console.log(
            `[clearAllVisualizationLayers] Removed ${tempGraphics.length} orphaned graphics from map view`
          );
        }
      }

      // Force map refresh to ensure UI is updated
      if (typeof mapView.refresh === "function") {
        mapView.refresh();
      }

      console.log(
        `[clearAllVisualizationLayers] Completed: Removed ${removedCount} layers, ${errors.length} errors`
      );

      return {
        removed: removedCount,
        errors: errors,
        success: errors.length === 0,
      };
    } catch (error) {
      const errorMsg = `Critical error during layer removal: ${error.message}`;
      console.error(`[clearAllVisualizationLayers] ${errorMsg}`, error);
      errors.push(errorMsg);

      return {
        removed: removedCount,
        errors: errors,
        success: false,
      };
    }
  }, [mapView, activeLayersRef]);

  /**
   * Enhanced clearSelection function that also removes visualization layers
   * This is the comprehensive clearing function for tab switches
   */
  const clearSelectionAndLayers = useCallback(() => {
    if (!mapView) {
      console.log("[clearSelectionAndLayers] MapView not available");
      return;
    }

    try {
      console.log(
        "[clearSelectionAndLayers] Starting comprehensive map clearing..."
      );

      // First, clear all selections (existing logic)
      if (mapView.popup && mapView.popup.visible) {
        mapView.popup.close();
        console.log("[clearSelectionAndLayers] Closed map popup");
      }

      // Clear highlight on the map view
      if (typeof mapView.highlightOptions !== "undefined") {
        mapView.highlightOptions = null;
      }

      // Clear selections from remaining layers (before removal)
      mapView.map.layers.forEach((layer) => {
        try {
          if (
            layer.type === "feature" &&
            typeof layer.clearSelection === "function"
          ) {
            layer.clearSelection();
          }

          if (layer.type === "graphics" && layer.graphics) {
            layer.graphics.forEach((graphic) => {
              if (graphic.attributes && graphic.attributes._isSelected) {
                graphic.attributes._isSelected = false;
              }
            });
          }
        } catch (layerError) {
          console.warn(
            `[clearSelectionAndLayers] Error clearing selection from layer:`,
            layerError
          );
        }
      });

      // Now remove all visualization layers
      const removalResult = clearAllVisualizationLayers();
      console.log(
        `[clearSelectionAndLayers] Layer removal result:`,
        removalResult
      );

      // Clear label manager selections if available
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.clearAllSelections === "function"
      ) {
        try {
          labelManagerRef.current.clearAllSelections();
          console.log(
            "[clearSelectionAndLayers] Cleared label manager selections"
          );
        } catch (labelError) {
          console.warn(
            "[clearSelectionAndLayers] Error clearing label manager selections:",
            labelError
          );
        }
      }

      // Reset interaction states
      if (isZoomToolActive && setIsZoomToolActive) {
        setIsZoomToolActive(false);
      }
      if (isPlacingSiteLocation) {
        setIsPlacingSiteLocation(false);
      }
      if (isMarketAreaInteractionActive) {
        setIsMarketAreaInteractionActive(false);
      }

      // Reset cursor
      if (mapView.container) {
        mapView.container.style.cursor = "default";
      }

      console.log(
        "[clearSelectionAndLayers] Comprehensive clearing completed successfully"
      );
    } catch (error) {
      console.error(
        "[clearSelectionAndLayers] Error during comprehensive clearing:",
        error
      );
    }
  }, [
    mapView,
    clearAllVisualizationLayers,
    isZoomToolActive,
    setIsZoomToolActive,
    isPlacingSiteLocation,
    setIsPlacingSiteLocation,
    isMarketAreaInteractionActive,
    setIsMarketAreaInteractionActive,
    labelManagerRef,
  ]);

  /**
   * Enhanced tab click handler with proper optimization triggering
   */
  const handleTabClick = async (tabId) => {
    console.log(`[TabClick] Switching to tab: ${tabId}`);

    const clickedTabData = tabs.find((tab) => tab.id === tabId);
    if (!clickedTabData) {
      console.error(`[TabClick] Tab data not found for tab ID: ${tabId}`);
      return;
    }

    const mapConfigId = tabId;
    const currentProjectId =
      projectId || localStorage.getItem("currentProjectId");

    // Save current label positions before switching
    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.savePositions === "function"
    ) {
      console.log("[TabClick] Saving label positions before tab change...");
      try {
        await labelManagerRef.current.savePositions(true);
      } catch (saveError) {
        console.error("[TabClick] Error saving label positions:", saveError);
      }
    }

    // Close editors if open
    if (isLabelEditorOpen) {
      setIsLabelEditorOpen(false);
      if (
        labelManagerRef.current &&
        typeof labelManagerRef.current.toggleEditingMode === "function"
      ) {
        labelManagerRef.current.toggleEditingMode(false);
      }
    }
    if (isEditorOpen) {
      setIsEditorOpen(false);
    }

    // Update active tab
    setActiveTab(tabId);
    setTabs((prevTabs) =>
      prevTabs.map((tab) => ({
        ...tab,
        active: tab.id === tabId,
      }))
    );

    clearSelectionAndLayers();

    // Update session storage and label manager context
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("currentMapConfigId", mapConfigId);
    }

    if (
      labelManagerRef.current &&
      typeof labelManagerRef.current.setContext === "function"
    ) {
      try {
        labelManagerRef.current.setContext(currentProjectId, mapConfigId);
      } catch (contextError) {
        console.error(
          "[TabClick] Error updating label manager context:",
          contextError
        );
      }
    }

    // Update visualization with optimization
    try {
      const config = clickedTabData.layerConfiguration || {};
      if (config && typeof config === "object") {
        config.mapConfigId = mapConfigId;
      }

      const isStandardViz =
        config.type === "class-breaks" ||
        config.type === "dot-density" ||
        config.dotValue !== undefined ||
        config.classBreakInfos !== undefined;

      if (isStandardViz && legend) {
        updateVisualizationLayer();

        // Schedule legend and optimization updates
        setTimeout(() => {
          const activeLayer = activeLayersRef.current?.[tabId];
          if (activeLayer && legend) {
            legend.layerInfos = [
              {
                layer: activeLayer,
                title: activeLayer.title || clickedTabData.visualizationType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = true;
            styleLegend(legend.container);
          }
        }, 500);
      } else {
        updateVisualizationLayer();
      }
    } catch (updateError) {
      console.error(
        "[TabClick] Error during visualization update:",
        updateError
      );
      updateVisualizationLayer();
    }

    // Process labels for the new configuration
    setTimeout(() => {
      if (labelManagerRef.current) {
        try {
          // Process graphics layers for labels
          if (mapView?.map) {
            const graphicsLayers = mapView.map.layers
              .filter(
                (layer) =>
                  layer.type === "graphics" &&
                  ["comp", "pipe", "custom"].includes(layer.visualizationType)
              )
              .toArray();

            console.log(
              `[TabClick] Processing ${graphicsLayers.length} graphics layers for labels with config ${mapConfigId}`
            );

            let totalLabelCount = 0;
            graphicsLayers.forEach((layer) => {
              if (!layer.mapConfigId) {
                layer.mapConfigId = mapConfigId;
              }
              if (layer.labelFormatInfo && !layer.labelFormatInfo.mapConfigId) {
                layer.labelFormatInfo.mapConfigId = mapConfigId;
              }

              if (typeof labelManagerRef.current.processLayer === "function") {
                const labelCount = labelManagerRef.current.processLayer(layer);
                totalLabelCount += labelCount;
              }
            });

            // Run global optimization if we have multiple labels across layers
            if (totalLabelCount > 8) {
              setTimeout(() => {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.optimizeAllLabels ===
                    "function"
                ) {
                  console.log(
                    `[TabClick] Running global optimization for ${totalLabelCount} total labels`
                  );
                  labelManagerRef.current.optimizeAllLabels();
                }
              }, 400);
            }
          }

          // Refresh all labels
          setTimeout(() => {
            if (typeof labelManagerRef.current.refreshLabels === "function") {
              labelManagerRef.current.refreshLabels();
              console.log(
                "[TabClick] Refreshed labels after tab change for config " +
                  mapConfigId
              );
            }
          }, 600);
        } catch (labelError) {
          console.error("[TabClick] Error processing labels:", labelError);
        }
      }
    }, 800);

    console.log(`[TabClick] Tab switch process complete for tab: ${tabId}`);
  };

  /**
   * Updates the legend visibility and content based on the active tab's visualization type.
   * Properly handles field names vs. visualization types to ensure legends display correctly.
   *
   * @param {Object} tabData - The tab data for the active tab
   * @returns {Promise<void>}
   */
  const updateLegendForTab = async (tabData) => {
    if (!tabData || !mapView || !legend) {
      console.log("[updateLegendForTab] Missing required dependencies", {
        hasTabData: !!tabData,
        hasMapView: !!mapView,
        hasLegend: !!legend,
      });
      return;
    }

    try {
      // Core Map has no visualization and no legend
      if (tabData.id === 1 || !tabData.visualizationType) {
        console.log(
          "[updateLegendForTab] Core Map or no visualization type - hiding legend"
        );
        legend.visible = false;
        setCustomLegendContent(null);
        return;
      }

      // Log original visualization type for debugging
      console.log(
        `[updateLegendForTab] Tab data visualization type: ${tabData.visualizationType}`
      );

      // Determine the actual visualization type by examining config and field patterns
      const config = tabData.layerConfiguration || {};
      const fieldName = tabData.visualizationType;

      // Detect the actual visualization type
      let actualVizType;

      // Check if it's a known special type first
      if (
        [
          "pipe",
          "pipeline",
          "comp",
          "comps",
          "custom",
          "site_location",
        ].includes(fieldName)
      ) {
        actualVizType =
          fieldName === "pipeline"
            ? "pipe"
            : fieldName === "comps"
            ? "comp"
            : fieldName;
      }
      // Explicitly check for type in the config
      else if (
        config.type &&
        ["class-breaks", "dot-density"].includes(config.type)
      ) {
        actualVizType = config.type;
      }
      // Check for dot-density indicators
      else if (
        config.dotValue !== undefined ||
        config.dotSize !== undefined ||
        (config.attributes && Array.isArray(config.attributes))
      ) {
        actualVizType = "dot-density";
      }
      // Check for class-breaks indicators
      else if (
        config.classBreakInfos ||
        config.field ||
        fieldName.endsWith("_HEAT")
      ) {
        actualVizType = "class-breaks";
      }
      // If still not determined, use field name as last resort
      else {
        actualVizType = fieldName;
      }

      console.log(
        `[updateLegendForTab] Determined actual visualization type: ${actualVizType}`
      );

      // Check if this is a special visualization type that uses custom legends
      const specialTypes = ["pipe", "comp", "custom", "site_location"];
      const isSpecialType = specialTypes.includes(actualVizType);

      // Check if this is a standard visualization type that should use the Esri legend
      const standardTypes = ["class-breaks", "dot-density"];
      const isStandardType =
        standardTypes.includes(actualVizType) ||
        actualVizType.endsWith("_HEAT");

      // Find or create the active layer
      let activeLayer = activeLayersRef.current?.[tabData.id];

      if (!activeLayer) {
        console.log(
          "[updateLegendForTab] No active layer found yet, will be created by updateVisualizationLayer"
        );

        // Trigger visualization update to create layer if needed
        updateVisualizationLayer();

        // Get the layer if it was just created
        activeLayer = activeLayersRef.current?.[tabData.id];

        if (!activeLayer) {
          console.log(
            "[updateLegendForTab] Layer not yet available, legend will be updated when layer is created"
          );
          return;
        }
      }

      // Update legend based on the type of visualization
      if (isSpecialType && tabData.layerConfiguration) {
        // Set custom legend for special types
        console.log(
          `[updateLegendForTab] Setting custom legend for ${actualVizType}`
        );
        setCustomLegendContent({
          type: actualVizType,
          config: tabData.layerConfiguration,
        });
        legend.visible = false; // Hide standard Esri legend for special types
      } else if (isStandardType) {
        // Handle standard Esri legend for feature layers (class-breaks, dot-density)
        try {
          console.log(
            `[updateLegendForTab] Updating standard Esri legend for ${actualVizType}`
          );

          // Make sure layer is fully ready
          if (activeLayer) {
            await activeLayer.when();

            // Update the legend configuration
            legend.layerInfos = [
              {
                layer: activeLayer,
                title: activeLayer.title || actualVizType,
                hideLayersNotInCurrentView: false,
              },
            ];

            // Make legend visible and apply styling
            legend.visible = true;
            styleLegend(legend.container);
            setCustomLegendContent(null); // Clear custom legend content for standard types

            console.log(
              `[updateLegendForTab] Standard legend configured and displayed for ${actualVizType}`
            );
          } else {
            console.warn(
              "[updateLegendForTab] Active layer not available for legend configuration"
            );
          }
        } catch (legendError) {
          console.error(
            "[updateLegendForTab] Error configuring standard legend:",
            legendError
          );
          legend.visible = false;
        }
      } else {
        // Hide legend for unknown/unsupported types
        console.log(
          `[updateLegendForTab] Unsupported visualization type: ${actualVizType} - hiding legend`
        );
        legend.visible = false;
        setCustomLegendContent(null);
      }
    } catch (error) {
      console.error("[updateLegendForTab] Error updating legend:", error);
      if (legend) legend.visible = false;
      setCustomLegendContent(null);
    }
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
   * Enhanced configuration loading function with field name normalization
   * Properly handles API data, cleans up resources, manages state updates,
   * and normalizes field names for compatibility with ArcGIS data sources
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

    // Helper function to extract actual field name from visualization identifier
    const extractActualFieldName = (visualizationId) => {
      if (!visualizationId) return null;

      // Remove common UI suffixes that don't exist in the actual data
      const suffixesToRemove = ["_HEAT", "_DOT", "_VIZ", "_MAP"];
      let fieldName = visualizationId;

      for (const suffix of suffixesToRemove) {
        if (fieldName.endsWith(suffix)) {
          fieldName = fieldName.replace(suffix, "");
          console.log(
            `[loadMapConfigurations] Stripped suffix '${suffix}' from field name: ${visualizationId} -> ${fieldName}`
          );
          break;
        }
      }

      return fieldName;
    };

    // Helper function to normalize layer configuration field names
    const normalizeLayerConfiguration = (config, visualizationType) => {
      if (!config || typeof config !== "object") {
        return config;
      }

      // Create a deep copy to avoid modifying the original
      const normalizedConfig = JSON.parse(JSON.stringify(config));

      // Normalize field names for heat map and dot density configurations
      if (
        visualizationType === "heatmap" ||
        visualizationType === "dotdensity" ||
        config.type === "class-breaks" ||
        config.type === "dot-density"
      ) {
        // Normalize the main field property
        if (normalizedConfig.field) {
          const actualFieldName = extractActualFieldName(
            normalizedConfig.field
          );
          if (actualFieldName && actualFieldName !== normalizedConfig.field) {
            console.log(
              `[loadMapConfigurations] Normalizing field: ${normalizedConfig.field} -> ${actualFieldName}`
            );
            normalizedConfig.field = actualFieldName;
          }
        }

        // Normalize visualizationKey if it exists (keep original for UI purposes)
        if (normalizedConfig.visualizationKey) {
          // Keep the original visualization key for UI/legend purposes
          // but ensure the field property uses the actual field name
          if (!normalizedConfig.field) {
            const actualFieldName = extractActualFieldName(
              normalizedConfig.visualizationKey
            );
            if (actualFieldName) {
              normalizedConfig.field = actualFieldName;
              console.log(
                `[loadMapConfigurations] Set field from visualizationKey: ${actualFieldName}`
              );
            }
          }
        }

        // Normalize field names in attributes array for dot density
        if (
          normalizedConfig.attributes &&
          Array.isArray(normalizedConfig.attributes)
        ) {
          normalizedConfig.attributes = normalizedConfig.attributes.map(
            (attr) => {
              if (attr.field) {
                const actualFieldName = extractActualFieldName(attr.field);
                if (actualFieldName && actualFieldName !== attr.field) {
                  console.log(
                    `[loadMapConfigurations] Normalizing attribute field: ${attr.field} -> ${actualFieldName}`
                  );
                  return {
                    ...attr,
                    field: actualFieldName,
                  };
                }
              }
              return attr;
            }
          );
        }

        // Ensure proper type mapping for the renderer
        if (!normalizedConfig.type) {
          if (visualizationType === "heatmap") {
            normalizedConfig.type = "class-breaks";
          } else if (visualizationType === "dotdensity") {
            normalizedConfig.type = "dot-density";
          }
        }
      }

      return normalizedConfig;
    };

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

      // Process configurations into tabs with field name normalization
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

      // Process each configuration with enhanced normalization
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

          // Validate and normalize visualization type
          let vizType = config.visualization_type;
          if (vizType === "pipeline") vizType = "pipe"; // Normalize type
          if (vizType === "comps") vizType = "comp"; // Normalize type

          // ENHANCED: Normalize layer configuration with field name fixes
          let normalizedLayerConfig = null;
          if (config.layer_configuration) {
            try {
              // Parse if it's a string, otherwise use as-is
              const rawConfig =
                typeof config.layer_configuration === "string"
                  ? JSON.parse(config.layer_configuration)
                  : config.layer_configuration;

              // Apply field name normalization
              normalizedLayerConfig = normalizeLayerConfiguration(
                rawConfig,
                vizType
              );

              // Ensure the configuration has the correct metadata
              normalizedLayerConfig.mapConfigId = config.id;
              normalizedLayerConfig.areaType = config.area_type;

              console.log(
                `[loadMapConfigurations] Normalized config for "${config.tab_name}":`,
                {
                  originalField: rawConfig?.field,
                  normalizedField: normalizedLayerConfig?.field,
                  visualizationKey: normalizedLayerConfig?.visualizationKey,
                  type: normalizedLayerConfig?.type,
                }
              );
            } catch (parseError) {
              console.error(
                `[loadMapConfigurations] Error parsing layer config for "${config.tab_name}":`,
                parseError
              );
              normalizedLayerConfig = config.layer_configuration;
              processingErrors.push(
                `Failed to parse layer configuration for "${config.tab_name}": ${parseError.message}`
              );
            }
          }

          // Create tab object with normalized configuration
          const newTab = {
            id: config.id,
            configId: config.id,
            name: config.tab_name || `Map ${index + 1}`, // Fallback name if missing
            active: false, // Only Core Map will be active initially
            visualizationType: vizType,
            areaType: areaType,
            layerConfiguration: normalizedLayerConfig, // Use normalized config
            isEditing: false,
          };

          processedTabs.push(newTab);

          console.log(
            `[loadMapConfigurations] Processed tab "${newTab.name}" with normalized field names`
          );
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
      console.log(
        "[loadMapConfigurations] Setting tabs with normalized configurations:",
        processedTabs.length
      );
      setTabs(processedTabs);
      setActiveTab(1); // Ensure Core Map is active

      // Update layer configurations with normalized field names
      const normalizedLayerConfigurations = {};
      processedTabs.forEach((tab) => {
        if (tab.visualizationType && tab.layerConfiguration) {
          normalizedLayerConfigurations[tab.visualizationType] =
            tab.layerConfiguration;
        }
      });

      if (Object.keys(normalizedLayerConfigurations).length > 0) {
        setLayerConfigurations((prev) => ({
          ...prev,
          ...normalizedLayerConfigurations,
        }));
        console.log(
          "[loadMapConfigurations] Updated layer configurations with normalized field names"
        );
      }

      setIsConfigLoading(false);
      console.log(
        "[loadMapConfigurations] Configuration loading complete with field normalization"
      );
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
   * Enhanced function to notify label manager and trigger optimization
   * @param {Object} layer - The newly created layer
   * @param {string} layerType - The type of layer ('comp', 'pipe', 'custom', etc.)
   * @param {Object} labelOptions - Label configuration options
   * @returns {Promise<void>}
   */
  const notifyLabelManagerAboutLayer = useCallback(
    async (layer, layerType, labelOptions = {}) => {
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
        // Configure layer-specific settings
        if (
          typeof labelManagerRef.current.configureLayerSettings === "function"
        ) {
          labelManagerRef.current.configureLayerSettings(layerType);
        }

        // Process the layer for labels
        if (typeof labelManagerRef.current.processLayer === "function") {
          setTimeout(() => {
            if (
              labelManagerRef.current &&
              typeof labelManagerRef.current.processLayer === "function"
            ) {
              // Process the layer - this now includes optimization for new labels
              const foundLabels = labelManagerRef.current.processLayer(layer);
              console.log(
                `[MapComponent] Processed ${foundLabels.length} labels from ${layerType} layer`
              );

              // For graphics layers with multiple labels, run global optimization
              if (
                foundLabels.length > 5 &&
                ["comp", "pipe", "custom"].includes(layerType)
              ) {
                console.log(
                  `[MapComponent] Running global optimization for ${layerType} layer with ${foundLabels.length} labels`
                );

                // Add a small delay to ensure all graphics are rendered
                setTimeout(() => {
                  if (
                    labelManagerRef.current &&
                    typeof labelManagerRef.current.optimizeAllLabels ===
                      "function"
                  ) {
                    labelManagerRef.current.optimizeAllLabels();
                    console.log(
                      `[MapComponent] Global optimization completed for ${layerType} layer`
                    );
                  }
                }, 300);
              }

              // Refresh labels after processing and optimization
              setTimeout(() => {
                if (
                  labelManagerRef.current &&
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  labelManagerRef.current.refreshLabels();
                  console.log(
                    `[MapComponent] Refreshed labels for ${layerType} layer after optimization`
                  );
                }
              }, 500);
            }
          }, 200);
        }

        // Mark layer as managed
        layer._labelManagerIntegrated = true;
      } catch (error) {
        console.error(
          `[MapComponent] Error notifying label manager about ${layerType} layer:`,
          error
        );
      }
    },
    []
  );

  // Update the styleLegend function to properly handle hidden legends
  const styleLegend = (legendContainer) => {
    if (!legendContainer) {
      console.warn("[styleLegend] Legend container not provided");
      return;
    }

    try {
      // Get the visibility status before applying styles
      const isLegendVisible = legendContainer.style.display !== "none";

      // Store original display state to detect visibility issues
      const originalDisplay = legendContainer.style.display;

      // Force visibility during styling if the legend should be visible
      if (isLegendVisible) {
        legendContainer.style.display = "block";
      }

      // Basic container styling
      legendContainer.style.backgroundColor = "white";
      legendContainer.style.padding = "1rem";
      legendContainer.style.margin = "0 0 1rem 1rem"; // Bottom and left margins
      legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
      legendContainer.style.borderRadius = "0.375rem";
      legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

      // Size constraints
      legendContainer.style.maxHeight = "40vh"; // Limit height to 40% of viewport
      legendContainer.style.overflowY = "auto"; // Make scrollable if needed
      legendContainer.style.maxWidth = "280px"; // Control width
      legendContainer.style.minWidth = "180px"; // Ensure visibility

      // Positioning and visibility
      legendContainer.style.zIndex = "1000"; // Ensure it's above other map elements

      // Don't override display property if we're intentionally hiding it
      if (!isLegendVisible) {
        legendContainer.style.display = "none";
        legendContainer.style.visibility = "hidden"; // Double protection
      } else {
        legendContainer.style.opacity = "1"; // Force visibility for visible legends
      }

      // Find and style the parent to ensure proper positioning
      const parentContainer = legendContainer.parentElement;
      if (parentContainer) {
        parentContainer.style.position = "absolute";
        parentContainer.style.bottom = "10px";
        parentContainer.style.left = "10px";
        parentContainer.style.zIndex = "1000"; // Ensure it's visible

        // Only apply display property if we should show the legend
        if (!isLegendVisible) {
          parentContainer.style.display = "none";
          parentContainer.style.visibility = "hidden"; // Double protection
        } else {
          parentContainer.style.display = "block";
          parentContainer.style.opacity = "1";
        }
      }

      // Only apply other styles if legend should be visible
      if (isLegendVisible) {
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
        const swatches = legendContainer.querySelectorAll(
          ".esri-legend__symbol"
        );
        swatches.forEach((swatch) => {
          swatch.style.width = "1rem";
          swatch.style.height = "1rem";
          swatch.style.marginRight = "0.5rem";
          swatch.style.flexShrink = "0"; // Prevent swatch from shrinking
        });

        // Label styles
        const labels = legendContainer.querySelectorAll(
          ".esri-legend__layer-cell--info"
        );
        labels.forEach((label) => {
          label.style.fontSize = "0.875rem";
          label.style.color = "#4B5563";
          label.style.wordBreak = "break-word"; // Allow wrapping for long text
        });

        // Sometimes we need to find and style additional containers
        const legacyContainers = legendContainer.querySelectorAll(
          ".esri-legend__service"
        );
        legacyContainers.forEach((container) => {
          container.style.margin = "0";
          container.style.padding = "0";
        });

        // Make sure widget panels have proper transparency
        const widgetPanels = legendContainer.querySelectorAll(
          ".esri-widget--panel"
        );
        widgetPanels.forEach((panel) => {
          panel.style.backgroundColor = "white";
          panel.style.opacity = "1";
          panel.style.display = "block";
        });
      }

      // Restore original display if it wasn't "none" and we should show the legend
      if (originalDisplay !== "none" && isLegendVisible) {
        legendContainer.style.display = originalDisplay;
      }

      console.log(
        `[styleLegend] Legend styling applied successfully. Visibility: ${
          isLegendVisible ? "visible" : "hidden"
        }`
      );
    } catch (error) {
      console.error("[styleLegend] Error styling legend:", error);
    }
  };

  // Add this function to ensure legend is fully hidden or shown
  // Helper function for legend visibility with DOM manipulation, DEBUG RED BORDER, and 30% smaller size
  const setLegendVisibility = (legendWidget, visible) => {
    if (!legendWidget) return;

    try {
      legendWidget.visible = visible;

      if (legendWidget.container) {
        legendWidget.container.style.display = visible ? "block" : "none";
        legendWidget.container.style.visibility = visible
          ? "visible"
          : "hidden";

        const parentElement = legendWidget.container.parentElement;
        if (parentElement) {
          parentElement.style.display = visible ? "block" : "none";
          parentElement.style.visibility = visible ? "visible" : "hidden";
        }
      }

      console.log(
        `[setLegendVisibility] Legend ${
          visible ? "shown at 85% scale in bottom left corner" : "hidden"
        } with DOM manipulations and DEBUG RED BORDER`
      );
    } catch (error) {
      console.error(
        "[setLegendVisibility] Error setting legend visibility:",
        error
      );
    }
  };

  /**
   * Forces the legend to update for the current active layer.
   * Useful when the legend doesn't automatically appear for standard visualizations.
   *
   * @returns {Promise<void>}
   */
  const forceUpdateLegend = async () => {
    if (!mapView || !legend) {
      console.log("[forceUpdateLegend] Missing map view or legend");
      return;
    }

    try {
      // Get the active tab data
      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      if (!activeTabData) {
        console.log("[forceUpdateLegend] No active tab data found");
        return;
      }

      // Find the active layer
      const activeLayer = activeLayersRef.current?.[activeTab];
      if (!activeLayer) {
        console.log("[forceUpdateLegend] No active layer found");
        return;
      }

      console.log(
        `[forceUpdateLegend] Forcing legend update for layer: ${activeLayer.title}`
      );

      // Update the legend
      legend.layerInfos = [
        {
          layer: activeLayer,
          title: activeLayer.title || activeTabData.visualizationType,
          hideLayersNotInCurrentView: false,
        },
      ];

      // Make visible and style
      legend.visible = true;
      styleLegend(legend.container);

      console.log("[forceUpdateLegend] Legend forcefully updated");
    } catch (error) {
      console.error("[forceUpdateLegend] Error forcing legend update:", error);
    }
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
    const now = Date.now();

    // Prevent concurrent updates and rate limiting
    if (updateInProgressRef.current || now - lastUpdateTimeRef.current < 500) {
      console.log(
        "[updateVisualizationAndLegend] Skipping: Update in progress or too frequent"
      );
      return null;
    }

    // Set update flags
    updateInProgressRef.current = true;
    lastUpdateTimeRef.current = now;

    console.log(
      "[updateVisualizationAndLegend] Starting update for Active Tab:",
      activeTab
    );
    let labelLoadTimeoutId = null;

    // Enhanced type normalization function
    const normalizeVisualizationType = (type) => {
      if (!type) return type;

      // Convert string to lowercase for consistent comparison
      const lowerType = String(type).toLowerCase();

      // Handle all known type variations
      if (lowerType === "pipeline") return "pipe";
      if (lowerType === "comps") return "comp";
      if (lowerType === "dotdensity") return "dot-density"; // KEY FIX: Handle dotdensity -> dot-density
      if (lowerType === "classbreaks" || lowerType === "class_breaks")
        return "class-breaks";
      if (lowerType === "dotdensitymap") return "dot-density";
      if (lowerType === "heatmap") return "class-breaks";

      // Handle field names that end with suffixes
      if (lowerType.endsWith("_heat")) return "class-breaks";
      if (lowerType.endsWith("_dot")) return "dot-density";
      if (lowerType.endsWith("_viz")) return type.replace(/_viz$/i, "");
      if (lowerType.endsWith("_map")) return type.replace(/_map$/i, "");

      // Return original if no normalization needed
      return type;
    };

    // Helper function to find visualization option by various criteria
    const findVisualizationOption = (config, effectiveType, tabData) => {
      console.log("🔍 [findVisualizationOption] === DETAILED DEBUG START ===");
      console.log("🔍 [findVisualizationOption] Input parameters:");
      console.log("🔍   - config:", JSON.stringify(config, null, 2));
      console.log("🔍   - effectiveType:", effectiveType);
      console.log("🔍   - tabData:", JSON.stringify(tabData, null, 2));

      if (!visualizationOptions || !Array.isArray(visualizationOptions)) {
        console.log(
          "🔍 [findVisualizationOption] ❌ EARLY EXIT: visualizationOptions not available or not array"
        );
        return null;
      }

      console.log(
        "🔍 [findVisualizationOption] ✅ visualizationOptions available with",
        visualizationOptions.length,
        "entries"
      );

      let matchingOption = null;

      // Method 1: Match by config field/attribute name
      console.log(
        "🔍 [findVisualizationOption] === METHOD 1: Config Field Match ==="
      );
      if (config?.field) {
        console.log("🔍   - Searching for config.field:", config.field);
        matchingOption = visualizationOptions.find(
          (opt) => opt.value === config.field
        );
        console.log(
          "🔍   - Method 1 result:",
          matchingOption
            ? `✅ FOUND: ${matchingOption.label} (${matchingOption.value})`
            : "❌ NOT FOUND"
        );
      }

      // Method 2: Match by visualization key/identifier
      console.log(
        "🔍 [findVisualizationOption] === METHOD 2: Visualization Key Match ==="
      );
      if (!matchingOption && config?.visualizationKey) {
        console.log(
          "🔍   - Searching for config.visualizationKey:",
          config.visualizationKey
        );
        matchingOption = visualizationOptions.find(
          (opt) => opt.value === config.visualizationKey
        );
        console.log(
          "🔍   - Method 2 result:",
          matchingOption
            ? `✅ FOUND: ${matchingOption.label} (${matchingOption.value})`
            : "❌ NOT FOUND"
        );
      }

      // Method 3: Match by config type and look for corresponding heat/dot density version
      console.log(
        "🔍 [findVisualizationOption] === METHOD 3: Type-based Match ==="
      );
      if (!matchingOption && effectiveType) {
        console.log("🔍   - effectiveType:", effectiveType);

        if (
          effectiveType === "class-breaks" ||
          effectiveType.endsWith("_HEAT")
        ) {
          console.log("🔍   - Looking for class-breaks/heat map matches");
          const heatMapOptions = visualizationOptions.filter(
            (opt) => opt.type === "class-breaks"
          );
          console.log(
            "🔍   - Available class-breaks options:",
            heatMapOptions.map((opt) => `${opt.value} (${opt.label})`)
          );

          matchingOption = visualizationOptions.find(
            (opt) =>
              opt.type === "class-breaks" &&
              (config?.field
                ? opt.value === config.field
                : config?.attribute
                ? opt.value === config.attribute
                : false)
          );
        } else if (effectiveType === "dot-density") {
          console.log("🔍   - Looking for dot-density matches");
          const dotDensityOptions = visualizationOptions.filter(
            (opt) => opt.type === "dot-density"
          );
          console.log(
            "🔍   - Available dot-density options:",
            dotDensityOptions.map((opt) => `${opt.value} (${opt.label})`)
          );

          matchingOption = visualizationOptions.find(
            (opt) =>
              opt.type === "dot-density" &&
              (config?.field
                ? opt.value === config.field
                : config?.dotValue
                ? opt.value === config.dotValue
                : false)
          );
        }

        console.log(
          "🔍   - Method 3 result:",
          matchingOption
            ? `✅ FOUND: ${matchingOption.label} (${matchingOption.value})`
            : "❌ NOT FOUND"
        );
      }

      // Method 4: Match by activeTabData properties
      console.log(
        "🔍 [findVisualizationOption] === METHOD 4: ActiveTabData Match ==="
      );
      if (!matchingOption && tabData) {
        if (tabData.field) {
          matchingOption = visualizationOptions.find(
            (opt) => opt.value === tabData.field
          );
        } else if (tabData.visualizationKey) {
          matchingOption = visualizationOptions.find(
            (opt) => opt.value === tabData.visualizationKey
          );
        }

        console.log(
          "🔍   - Method 4 result:",
          matchingOption
            ? `✅ FOUND: ${matchingOption.label} (${matchingOption.value})`
            : "❌ NOT FOUND"
        );
      }

      console.log("🔍 [findVisualizationOption] === FINAL RESULT ===");
      if (matchingOption) {
        console.log("🔍 ✅ FINAL MATCH FOUND:", {
          value: matchingOption.value,
          label: matchingOption.label,
          type: matchingOption.type,
          category: matchingOption.category,
        });
      } else {
        console.log("🔍 ❌ NO MATCH FOUND - Will use fallback title logic");
      }
      console.log("🔍 [findVisualizationOption] === DETAILED DEBUG END ===");

      return matchingOption;
    };

    // Helper function for legend visibility with DOM manipulation
    const setLegendVisibility = (legendWidget, visible) => {
      if (!legendWidget) return;

      try {
        legendWidget.visible = visible;

        if (legendWidget.container) {
          legendWidget.container.style.display = visible ? "block" : "none";
          legendWidget.container.style.visibility = visible
            ? "visible"
            : "hidden";

          const parentElement = legendWidget.container.parentElement;
          if (parentElement) {
            parentElement.style.display = visible ? "block" : "none";
            parentElement.style.visibility = visible ? "visible" : "hidden";
          }
        }

        console.log(
          `[setLegendVisibility] Legend ${
            visible ? "shown" : "hidden"
          } with DOM manipulations`
        );
      } catch (error) {
        console.error(
          "[setLegendVisibility] Error setting legend visibility:",
          error
        );
      }
    };

    try {
      // Prerequisites validation
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

      // Find active tab and validate
      const activeTabData = tabs.find((tab) => tab.id === activeTab);

      // Check for redundant processing
      if (
        activeTabData &&
        lastProcessedTabRef.current === activeTabData.id &&
        Date.now() - lastProcessedTimeRef.current < 2000
      ) {
        console.log(
          `[updateVisualizationAndLegend] Tab ${activeTabData.id} already processed recently, skipping`
        );
        return null;
      }

      // Update tracking references
      if (activeTabData) {
        lastProcessedTabRef.current = activeTabData.id;
        lastProcessedTimeRef.current = Date.now();
      }

      // Extract and establish context for label management
      let mapConfigId = null;
      let mapType = null;

      if (activeTabData) {
        mapConfigId =
          activeTabData.configId ||
          activeTabData.id ||
          activeTabData.mapConfigId ||
          sessionStorage.getItem("currentMapConfigId");

        // ENHANCED: Apply type normalization to the raw visualization type
        const rawVisualizationType =
          activeTabData.visualizationType ||
          activeTabData.type ||
          sessionStorage.getItem("currentMapType");

        mapType = normalizeVisualizationType(rawVisualizationType);

        console.log(
          `[updateVisualizationAndLegend] Type normalization: ${rawVisualizationType} -> ${mapType}`
        );
      }

      // Establish LabelManager context before any layer operations
      if (labelManagerRef.current && mapConfigId) {
        try {
          const projectId =
            localStorage.getItem("currentProjectId") ||
            sessionStorage.getItem("currentProjectId");

          if (projectId) {
            // Store context in session storage
            sessionStorage.setItem("currentMapConfigId", mapConfigId);
            sessionStorage.setItem("currentMapType", mapType);
            sessionStorage.setItem("currentProjectId", projectId);

            // Set LabelManager context
            labelManagerRef.current.setContext(projectId, mapConfigId, mapType);

            // Verify context
            const contextVerification = {
              success: labelManagerRef.current.mapConfigId === mapConfigId,
              managerConfigId: labelManagerRef.current.mapConfigId,
              expectedConfigId: mapConfigId,
              managerType: labelManagerRef.current.mapType,
            };

            if (contextVerification.success) {
              console.log(
                `[updateVisualizationAndLegend] LabelManager context established:`,
                {
                  projectId,
                  mapConfigId,
                  mapType,
                }
              );
            } else {
              console.error(
                `[updateVisualizationAndLegend] LabelManager context verification failed:`,
                contextVerification
              );
            }
          }
        } catch (contextError) {
          console.error(
            "[updateVisualizationAndLegend] Error establishing LabelManager context:",
            contextError
          );
        }
      }

      // Save existing label positions before layer modifications
      saveLabelPositions(true);

      // Remove existing visualization layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer?.isVisualizationLayer === true && !layer?._preventRemoval) {
          layersToRemove.push(layer);
        }
      });

      if (layersToRemove.length > 0) {
        console.log(
          `[updateVisualizationAndLegend] Removing ${layersToRemove.length} visualization layers`
        );
        mapView.map.removeMany(layersToRemove);
      }

      // Handle Core Map (activeTab === 1)
      if (activeTab === 1) {
        console.log(
          "[updateVisualizationAndLegend] Core Map detected, ensuring legend is hidden"
        );
        setLegendVisibility(legend, false);
        setCustomLegendContent(null);
        return null;
      }

      // Process visualization for active tab
      if (activeTabData?.visualizationType) {
        // ENHANCED: Apply comprehensive type normalization
        let vizType = normalizeVisualizationType(
          activeTabData.visualizationType
        );

        // Additional normalization for site_location
        if (vizType === "site_location") vizType = "site_location";

        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;

        console.log(
          `[updateVisualizationAndLegend] Preparing layer creation for normalized type: ${vizType} (original: ${activeTabData.visualizationType})`
        );

        const effectiveType = vizType || config?.type;
        if (!effectiveType) {
          console.error(
            "[updateVisualizationAndLegend] Cannot create layer: Missing visualization type"
          );
          setLegendVisibility(legend, false);
          setCustomLegendContent(null);
          return null;
        }

        let newLayer = null;
        try {
          // Determine visualization category with normalized types
          const specialTypes = ["pipe", "comp", "custom", "site_location"];
          const isSpecialType =
            specialTypes.includes(effectiveType) ||
            (config?.customData &&
              !["class-breaks", "dot-density"].includes(effectiveType));

          const standardTypes = ["class-breaks", "dot-density"];
          const isStandardViz =
            standardTypes.includes(effectiveType) ||
            (config?.type && standardTypes.includes(config.type)) ||
            config?.dotValue !== undefined ||
            config?.classBreakInfos !== undefined ||
            effectiveType.endsWith("_HEAT");

          // Create layer with proper context metadata
          if (isSpecialType) {
            const configForCreator = {
              ...(config || {}),
              type: effectiveType,
              configId: mapConfigId,
              mapConfigId: mapConfigId,
              // Add context metadata for label management
              contextMetadata: {
                mapConfigId: mapConfigId,
                mapType: effectiveType,
                projectId: localStorage.getItem("currentProjectId"),
                createdAt: Date.now(),
              },
            };

            switch (effectiveType) {
              case "pipe":
                newLayer = await createPipeLayer(configForCreator);
                break;
              case "comp":
                newLayer = await createCompLayer(configForCreator);
                break;
              case "site_location":
                const { default: GraphicsLayer } = await import(
                  "@arcgis/core/layers/GraphicsLayer"
                );
                newLayer = new GraphicsLayer({
                  title: "Site Location",
                  visualizationType: "site_location",
                  isVisualizationLayer: true,
                  listMode: "hide",
                  mapConfigId: mapConfigId,
                  mapType: "site_location",
                });
                break;
              default:
                newLayer = await createGraphicsLayerFromCustomData(
                  configForCreator
                );
                break;
            }
          } else {
            // Create standard feature layers with normalized type
            newLayer = await createLayers(
              effectiveType,
              config,
              initialLayerConfigurations,
              areaType
            );
          }

          // Configure layer with context metadata
          if (
            newLayer &&
            (newLayer instanceof FeatureLayer ||
              newLayer instanceof GraphicsLayer)
          ) {
            // Set visualization properties with normalized type
            newLayer.isVisualizationLayer = true;
            newLayer.visualizationType = effectiveType; // Use normalized type
            newLayer._updateId = `update-${Date.now()}`;

            // Set context metadata for label management
            newLayer.mapConfigId = mapConfigId;
            newLayer.mapType = effectiveType; // Use normalized type
            newLayer.projectId = localStorage.getItem("currentProjectId");

            // Ensure labelFormatInfo has context
            newLayer.labelFormatInfo = {
              ...newLayer.labelFormatInfo,
              mapConfigId: mapConfigId,
              mapType: effectiveType, // Use normalized type
            };

            // Apply context metadata to all graphics
            if (newLayer.graphics && newLayer.graphics.length > 0) {
              newLayer.graphics.forEach((graphic) => {
                if (graphic.attributes) {
                  graphic.attributes.mapConfigId = mapConfigId;
                  graphic.attributes.mapType = effectiveType; // Use normalized type

                  if (graphic.symbol?.type === "text") {
                    graphic.attributes.isLabel = true;
                  }
                }
              });
            }

            // Add layer to map
            mapView.map.add(newLayer, 0);
            console.log(
              `[updateVisualizationAndLegend] Added layer "${
                newLayer.title || newLayer.id
              }" to map with normalized type: ${effectiveType}`
            );

            // Store layer reference
            if (activeLayersRef.current) {
              activeLayersRef.current[activeTab] = newLayer;
            }

            // Wait for layer to be ready
            await newLayer.when();
            console.log(
              `[updateVisualizationAndLegend] Layer "${
                newLayer.title || newLayer.id
              }" is ready`
            );

            // Handle legend and label processing
            const showStandardLegend =
              isStandardViz &&
              !isSpecialType &&
              !isEditorOpen &&
              !isLabelEditorOpen;

            if (isSpecialType && activeTabData.layerConfiguration) {
              // Handle custom legend for special types
              console.log(
                `[updateVisualizationAndLegend] Setting custom legend for type: ${effectiveType}`
              );
              setCustomLegendContent({
                type: effectiveType,
                config: activeTabData.layerConfiguration,
              });

              setLegendVisibility(legend, false);

              // Notify label manager about layer
              await notifyLabelManagerAboutLayer(
                newLayer,
                effectiveType,
                activeTabData.layerConfiguration?.labelOptions
              );

              // Process labels with enhanced context management
              if (labelManagerRef.current) {
                console.log(
                  `[updateVisualizationAndLegend] Processing layer ${newLayer.id} with Label Manager`
                );

                newLayer._isBeingProcessed = true;

                try {
                  // Ensure context is correct before processing
                  if (labelManagerRef.current.mapConfigId !== mapConfigId) {
                    console.warn(
                      "[updateVisualizationAndLegend] Context mismatch detected, correcting..."
                    );
                    const projectId = localStorage.getItem("currentProjectId");
                    labelManagerRef.current.setContext(
                      projectId,
                      mapConfigId,
                      effectiveType
                    );
                  }

                  // Process layer with temporary auto-save disable
                  const originalSaveMethod =
                    labelManagerRef.current.savePositions;
                  if (typeof originalSaveMethod === "function") {
                    labelManagerRef.current.savePositions = () => ({
                      count: 0,
                      skipped: true,
                    });
                    const processedLabels =
                      labelManagerRef.current.processLayer(newLayer);
                    labelManagerRef.current.savePositions = originalSaveMethod;

                    console.log(
                      `[updateVisualizationAndLegend] Processed ${
                        Array.isArray(processedLabels)
                          ? processedLabels.length
                          : 0
                      } labels`
                    );
                  } else {
                    labelManagerRef.current.processLayer(newLayer);
                  }
                } catch (processingError) {
                  console.error(
                    "[updateVisualizationAndLegend] Error processing layer with LabelManager:",
                    processingError
                  );
                } finally {
                  // Clear processing flag
                  setTimeout(() => {
                    if (newLayer) newLayer._isBeingProcessed = false;
                  }, 500);
                }

                // Schedule label refresh
                if (
                  typeof labelManagerRef.current.refreshLabels === "function"
                ) {
                  labelLoadTimeoutId = setTimeout(() => {
                    if (updateInProgressRef.current) {
                      console.log(
                        "[updateVisualizationAndLegend] Skipping scheduled refresh - update in progress"
                      );
                      return;
                    }

                    if (
                      labelManagerRef.current &&
                      typeof labelManagerRef.current.refreshLabels ===
                        "function"
                    ) {
                      labelManagerRef.current.refreshLabels();
                      console.log(
                        `[updateVisualizationAndLegend] Refreshed labels after processing ${effectiveType} layer`
                      );
                    }
                  }, 800);
                }
              }
            } else if (showStandardLegend || isStandardViz) {
              // Handle standard legend for feature layers
              try {
                const currentConfig = activeTabData?.layerConfiguration;
                let displayTitle = newLayer.title || effectiveType; // Default title

                // --- ENHANCED MODIFICATION FOR VISUALIZATION OPTIONS ---
                // Priority 1: Use legendTitle from the layer's configuration if it exists
                if (currentConfig && currentConfig.legendTitle) {
                  displayTitle = currentConfig.legendTitle;
                  console.log(
                    `[updateVisualizationAndLegend] Using config legendTitle: "${displayTitle}"`
                  );
                }
                // Priority 2: Look up visualization option and use its label
                else {
                  const matchingVisualizationOption = findVisualizationOption(
                    currentConfig,
                    effectiveType,
                    activeTabData
                  );

                  if (
                    matchingVisualizationOption &&
                    matchingVisualizationOption.label
                  ) {
                    displayTitle = matchingVisualizationOption.label;
                    console.log(
                      `[updateVisualizationAndLegend] Using visualization option label: "${displayTitle}" (matched by ${matchingVisualizationOption.value})`
                    );
                  }
                  // Priority 3: Specific fallback cases (keep existing logic for backwards compatibility)
                  else if (
                    displayTitle === "2024 Renter Occupied Housing Units (Esri)"
                  ) {
                    displayTitle =
                      "2024 Renter Occupied Housing Units (New Title)";
                    console.log(
                      `[updateVisualizationAndLegend] Using fallback title: "${displayTitle}"`
                    );
                  }
                  // Priority 4: Default to layer title or effective type
                  else {
                    console.log(
                      `[updateVisualizationAndLegend] Using default title: "${displayTitle}" (no visualization option match found)`
                    );
                  }
                }
                // --- END ENHANCED MODIFICATION ---

                console.log(
                  `[updateVisualizationAndLegend] Updating standard Esri legend for layer: "${
                    newLayer.title || effectiveType
                  }" (displaying as: "${displayTitle}")`
                );

                // Set the layer's title property directly - this is crucial for the legend widget
                newLayer.title = displayTitle;
                console.log(
                  `[updateVisualizationAndLegend] Set layer.title to: "${displayTitle}"`
                );

                // Also set the legend layerInfos for additional control
                legend.layerInfos = [
                  {
                    layer: newLayer,
                    title: displayTitle, // Use the determined title
                    hideLayersNotInCurrentView: false,
                  },
                ];

                // Force legend refresh to pick up the new title
                if (legend.refresh && typeof legend.refresh === "function") {
                  legend.refresh();
                  console.log(
                    `[updateVisualizationAndLegend] Forced legend refresh`
                  );
                }

                setLegendVisibility(legend, true);

                // Apply custom styling to hide layer subtitle and clean up legend appearance
                if (legend.container) {
                  styleLegend(legend.container);

                  // Add CSS to hide the layer subtitle and remove extra white space
                  const style = document.createElement("style");
                  style.textContent = `
                        .esri-legend__layer-caption,
                        .esri-legend__layer-title,
                        .esri-legend__layer-child-title {
                          display: none !important;
                        }
                        .esri-legend__service {
                          margin-top: 0 !important;
                          margin-bottom: 0 !important;
                          padding: 0 !important;
                        }
                        .esri-legend__layer-table {
                          margin-top: 0 !important;
                          margin-bottom: 0 !important;
                          padding: 0 !important;
                        }
                        .esri-legend {
                          padding: 8px !important;
                          margin: 0 !important;
                          width: fit-content !important;
                          min-width: auto !important;
                          max-width: none !important;
                        }
                        .esri-legend__layer {
                          margin: 0 !important;
                          padding: 0 !important;
                        }
                        .esri-legend__layer-body {
                          margin: 0 !important;
                          padding: 0 !important;
                        }
                        .esri-legend__layer-table tbody {
                          margin: 0 !important;
                          padding: 0 !important;
                        }
                        .esri-legend__layer-table tr {
                          margin: 0 !important;
                          padding: 2px 0 !important;
                        }
                        .esri-legend__layer-table td {
                          padding: 2px 4px !important;
                          margin: 0 !important;
                        }
                        .esri-legend__symbol {
                          margin-right: 6px !important;
                          margin-left: 0 !important;
                        }
                        .esri-legend__layer-cell--symbols {
                          padding-right: 6px !important;
                          padding-left: 0 !important;
                        }
                        .esri-legend__layer-cell--info {
                          padding-left: 6px !important;
                          padding-right: 0 !important;
                        }
                      `;

                  // Remove any existing legend subtitle styles first
                  const existingStyle = legend.container.querySelector(
                    "#legend-subtitle-hide-style"
                  );
                  if (existingStyle) {
                    existingStyle.remove();
                  }

                  // Add the new style with ID for future removal
                  style.id = "legend-subtitle-hide-style";
                  legend.container.appendChild(style);

                  console.log(
                    `[updateVisualizationAndLegend] Applied CSS to hide legend subtitle and remove extra white space`
                  );
                }
                setCustomLegendContent(null);

                console.log(
                  `[updateVisualizationAndLegend] Successfully displayed standard legend for ${effectiveType} with title "${displayTitle}"`
                );
              } catch (layerError) {
                console.error(
                  "[updateVisualizationAndLegend] Error updating legend:",
                  layerError
                );
                setLegendVisibility(legend, false);
              }
            } else {
              // Hide legend for other cases
              console.log(
                "[updateVisualizationAndLegend] Hiding standard Esri legend"
              );
              setLegendVisibility(legend, false);
              setCustomLegendContent(null);
            }

            // Handle type-specific post-processing with guards (using normalized types)
            if (effectiveType === "pipe" && !newLayer._pipeHandled) {
              newLayer._pipeHandled = true;
              setTimeout(
                () => handlePipeVisualization(activeTabData, newLayer),
                100
              );
            } else if (effectiveType === "comp" && !newLayer._compHandled) {
              newLayer._compHandled = true;
              setTimeout(
                () => handleCompVisualization(activeTabData, newLayer),
                100
              );
            } else if (effectiveType === "custom" && !newLayer._customHandled) {
              newLayer._customHandled = true;
              setTimeout(
                () => handleCustomDataVisualization(activeTabData, newLayer),
                100
              );
            }
          } else {
            console.error(
              `[updateVisualizationAndLegend] Failed to create layer for type: ${effectiveType}`
            );
            setLegendVisibility(legend, false);
            setCustomLegendContent(null);
          }
        } catch (error) {
          console.error(
            `[updateVisualizationAndLegend] Error during layer creation for type ${effectiveType}:`,
            error
          );
          setLegendVisibility(legend, false);
          setCustomLegendContent(null);
        }
      } else {
        console.log(
          `[updateVisualizationAndLegend] No visualization to display for tab ${activeTab}`
        );
        setLegendVisibility(legend, false);
        setCustomLegendContent(null);
      }
    } catch (error) {
      console.error("[updateVisualizationAndLegend] Critical error:", error);
      setLegendVisibility(legend, false);
      setCustomLegendContent(null);
    } finally {
      // Reset update flag with delay
      setTimeout(() => {
        updateInProgressRef.current = false;
        console.log("[updateVisualizationAndLegend] Update lock released");
      }, 500);
    }

    return labelLoadTimeoutId;
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
    notifyLabelManagerAboutLayer,
    setCustomLegendContent,
    styleLegend,
    handlePipeVisualization,
    handleCompVisualization,
    handleCustomDataVisualization,
  ]);

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

  // Map initialization effect
  useEffect(() => {
    let isMounted = true;
    console.log("[Map] Starting map initialization...");

    // Use local variables within this effect's scope for instances
    // that need to be accessed in the cleanup function
    let localMapView = null;
    let localZoomToolButtonRoot = null;
    let siteLocationClickHandler = null;
    let labelDragEventHandlers = [];
    let localScaleBar = null; // Track scale bar instance for cleanup
    let localLegend = null; // Track legend instance for cleanup

    const initializeMap = async () => {
      try {
        // Create map with reliable basemap
        const map = new Map({
          basemap: "arcgis-navigation", // Using reliable basemap to avoid AbortError
        });

        // Create view with map container
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-98, 39], // Default center on US
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

        console.log("[Map] Waiting for view to be ready...");
        await view.when();
        console.log("[Map] View is now ready!");

        // Custom mouse wheel zoom handler with improved physics
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
                  console.error("[Map] goTo Error:", error);
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

        // Store scrollHandler for cleanup
        if (typeof scrollHandler?.remove === "function") {
          labelDragEventHandlers.push(scrollHandler);
        }

        // IMPORTANT: Create and add ScaleBar AFTER view is ready
        try {
          const { default: ScaleBar } = await import(
            "@arcgis/core/widgets/ScaleBar"
          );

          // Create the scale bar with explicit options
          const scaleBar = new ScaleBar({
            view: view,
            unit: "imperial",
            style: "ruler", // Use ruler style for better visibility
            anchor: "bottom-right", // Explicitly set anchor position
            visible: true, // Ensure it's visible
          });

          // Add scale bar to the bottom right of the map
          view.ui.add(scaleBar, "bottom-right");

          // Store reference for cleanup
          localScaleBar = scaleBar;

          console.log(
            "[Map] Scale bar successfully added to bottom-right of map"
          );

          // Apply custom styling to ensure visibility
          setTimeout(() => {
            const scaleBarContainer = document.querySelector(
              ".esri-scale-bar__container"
            );
            if (scaleBarContainer) {
              scaleBarContainer.style.backgroundColor =
                "rgba(255, 255, 255, 0.8)";
              scaleBarContainer.style.padding = "4px";
              scaleBarContainer.style.border = "1px solid rgba(0, 0, 0, 0.2)";
              scaleBarContainer.style.borderRadius = "4px";
              scaleBarContainer.style.marginBottom = "10px";
              scaleBarContainer.style.marginRight = "10px";
              console.log("[Map] Applied custom styling to scale bar");
            } else {
              console.warn("[Map] Scale bar container not found for styling");
            }
          }, 500);
        } catch (scaleBarError) {
          console.error("[Map] Error creating scale bar:", scaleBarError);
        }

        // Site location placement click handler
        siteLocationClickHandler = view.on(
          "click",
          handleSiteLocationPlacement
        );

        // Setup label drag handling
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

        // Initialize Legend widget - position in BOTTOM LEFT
        // IMPORTANT: For Core Map, we create the legend but start with visibility=false
        try {
          const { default: Legend } = await import(
            "@arcgis/core/widgets/Legend"
          );

          // Get the active tab to determine if we're on the Core Map
          const activeTabId = activeTab || 1; // Default to Core Map if not set
          const isCoreMappVisible = activeTabId === 1;

          // Create legend with visibility set to false for Core Map
          const legendWidget = new Legend({
            view,
            container: document.createElement("div"),
            layerInfos: [],
            visible: false, // Always start hidden, will be shown if needed
          });

          // Add to BOTTOM LEFT position
          view.ui.add(legendWidget, "bottom-left");

          // Store for cleanup
          localLegend = legendWidget;

          if (isMounted) {
            setLegend(legendWidget);

            // Apply initial styling after a short delay, but only if not on Core Map
            setTimeout(() => {
              if (legendWidget.container) {
                // Apply styling but keep visibility according to current tab
                styleLegend(legendWidget.container);

                // The actual visibility is managed by the other effects and functions
                // that update the legend based on the active tab and visualization type
                console.log(
                  `[Map] Legend initialized with visibility: ${legendWidget.visible}`
                );
              }
            }, 500);

            console.log(
              "[Map] Legend widget initialized in bottom-left position"
            );
          }
        } catch (legendError) {
          console.error("[Map] Error initializing legend widget:", legendError);
        }

        // Trigger market area loading/rendering if ready
        if (isMounted) {
          // Set view in context or state
          setMapView(view);

          // Notify of successful map ready state
          if (typeof onMapReady === "function") {
            try {
              onMapReady(view);
              console.log("[Map] onMapReady callback executed successfully");
            } catch (mapReadyError) {
              console.error(
                "[Map] Error in onMapReady callback:",
                mapReadyError
              );
            }
          }
        }
      } catch (error) {
        console.error("[Map] Critical error during map initialization:", error);
      }
    };

    // Start initialization if map container is available
    if (mapRef.current) {
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

      // Cleanup Scale Bar instance
      if (localScaleBar && typeof localScaleBar.destroy === "function") {
        try {
          localScaleBar.destroy();
          console.log("[Map] Scale bar destroyed during cleanup");
        } catch (scaleBarError) {
          console.error("[Map] Error destroying scale bar:", scaleBarError);
        }
      }

      // Cleanup Legend instance
      if (localLegend && typeof localLegend.destroy === "function") {
        try {
          localLegend.destroy();
          console.log("[Map] Legend widget destroyed during cleanup");
        } catch (legendError) {
          console.error("[Map] Error destroying legend:", legendError);
        }
      }

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
  }, []);

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

  // Legend Visibility Effect
  useEffect(() => {
    if (!legend || !mapView?.ready) return;

    // Determine if legend should be visible
    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const isCoreMappTab = activeTab === 1;
    const hasVisualization = activeTabData?.visualizationType;
    const hasCustomLegend = !!customLegendContent;

    // Legend should hide if:
    // 1. It's the Core Map (tab ID 1), OR
    // 2. Either editor panel is open, OR
    // 3. There's a custom legend showing instead
    const shouldShowStandardLegend =
      !isCoreMappTab &&
      hasVisualization &&
      !hasCustomLegend &&
      !isEditorOpen &&
      !isLabelEditorOpen;

    // Update legend visibility with DOM manipulation
    setLegendVisibility(legend, shouldShowStandardLegend);

    // Apply styling if visible
    if (shouldShowStandardLegend && legend.container) {
      requestAnimationFrame(() => {
        // Ensure container exists before styling
        if (legend.container) {
          styleLegend(legend.container);
        }
      });
    }

    console.log(
      `[Legend Effect] Legend visibility set to ${shouldShowStandardLegend} (Core Map: ${isCoreMappTab})`
    );
  }, [
    activeTab,
    legend,
    tabs,
    mapView?.ready,
    isEditorOpen,
    isLabelEditorOpen,
    customLegendContent,
  ]);

  /**
   * Effect to manage visualization updates with debouncing and loop prevention.
   * Implements robust safeguards against infinite update cycles.
   */
  useEffect(() => {
    // Enhanced timing and state tracking for better control
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - (lastEffectTimeRef.current || 0);

    // Get active tab data for context
    const activeTabData = tabs.find((tab) => tab.id === activeTab);

    // Enhanced criteria for when to skip debouncing
    const isNewMapCreation = activeTabData && !activeTabData.hasBeenRendered;
    const isTabSwitch =
      activeTabData && lastProcessedTabRef.current !== activeTabData.id;
    const forceUpdate = isNewMapCreation || isTabSwitch;

    // Skip debouncing for critical scenarios but still prevent excessive updates
    const shouldSkipDebounce = forceUpdate && timeSinceLastUpdate > 50; // Minimum 50ms gap
    const shouldDebounce = !shouldSkipDebounce && timeSinceLastUpdate < 200;

    if (shouldDebounce) {
      console.log("[VizUpdate Effect] Skipping: Too soon after last update", {
        timeSinceLastUpdate,
        threshold: 200,
        activeTab,
        isNewMapCreation,
        isTabSwitch,
      });
      return;
    }

    // Update timing tracker
    lastEffectTimeRef.current = currentTime;

    // Skip if an update is already in progress
    if (updateInProgressRef.current) {
      console.log("[VizUpdate Effect] Skipping: Update already in progress");
      return;
    }

    console.log("[VizUpdate Effect] TRIGGERED by dependency change", {
      activeTab,
      isNewMapCreation,
      isTabSwitch,
      forceUpdate,
      timeSinceLastUpdate,
    });

    // Track active timeouts for proper cleanup
    let currentLabelLoadTimeoutId = null;
    let updateDebounceTimeoutId = null;
    let isEffectMounted = true;

    // Enhanced debounce logic with different timeouts based on scenario
    const debounceTime = forceUpdate ? 100 : 300; // Faster for new maps/tab switches

    updateDebounceTimeoutId = setTimeout(async () => {
      // Skip if component unmounted during timeout
      if (!isEffectMounted) {
        console.log(
          "[VizUpdate Effect] Skipping update: Component unmounted during debounce"
        );
        return;
      }

      // Skip if update in progress
      if (updateInProgressRef.current) {
        console.log(
          "[VizUpdate Effect] Skipping debounced update: Another update in progress"
        );
        return;
      }

      // Check if label manager is ready
      if (!isLabelManagerReady) {
        console.log(
          "[VizUpdate Effect] Skipping update: Label Manager not ready yet"
        );
        return;
      }

      console.log("[VizUpdate Effect] Calling updateVisualizationAndLegend", {
        labelManagerReady: isLabelManagerReady,
        debounceTime,
        forceUpdate,
      });

      // Track the active tab for redundancy checking
      const currentActiveTabData = tabs.find((tab) => tab.id === activeTab);
      const currentActiveTabId = currentActiveTabData?.id;

      // Enhanced redundancy check with forced update bypass
      if (
        !forceUpdate &&
        currentActiveTabId &&
        lastProcessedTabRef.current === currentActiveTabId &&
        Date.now() - lastProcessedTimeRef.current < 2000
      ) {
        console.log(
          `[VizUpdate Effect] Tab ${currentActiveTabId} already processed recently, skipping`
        );
        return;
      }

      // Mark tab as being processed
      if (currentActiveTabData) {
        currentActiveTabData.hasBeenRendered = true;
      }

      // Call the update function and track any timeout it returns
      const timeoutId = await updateVisualizationAndLegend();

      // Only store the timeout ID if the effect is still considered "mounted"
      if (isEffectMounted && timeoutId) {
        currentLabelLoadTimeoutId = timeoutId;
        console.log(
          `[VizUpdate Effect] Stored label refresh timeout ID: ${currentLabelLoadTimeoutId}`
        );
      } else if (!isEffectMounted && timeoutId) {
        console.log(
          `[VizUpdate Effect] Clearing timeout ${timeoutId} immediately as effect unmounted during update`
        );
        clearTimeout(timeoutId);
      } else {
        console.log(
          "[VizUpdate Effect] Update finished (no timeout needed or effect unmounted)"
        );
      }
    }, debounceTime);

    // Enhanced cleanup function for this effect
    return () => {
      console.log("[VizUpdate Effect] CLEANUP running");
      isEffectMounted = false;

      // Clear debounce timeout if exists
      if (updateDebounceTimeoutId) {
        clearTimeout(updateDebounceTimeoutId);
      }

      // Clear label refresh timeout if exists
      if (currentLabelLoadTimeoutId) {
        console.log(
          "[VizUpdate Effect] Clearing label refresh timeout in cleanup:",
          currentLabelLoadTimeoutId
        );
        clearTimeout(currentLabelLoadTimeoutId);
        currentLabelLoadTimeoutId = null;
      }

      // Save positions on cleanup - crucial for catching changes before unmount/re-render
      // But only if we're not in the middle of another update to avoid loops
      if (!updateInProgressRef.current) {
        console.log("[VizUpdate Effect] Saving positions during cleanup");
        saveLabelPositions(true); // Force save using memoized function
      } else {
        console.log(
          "[VizUpdate Effect] Skipping position save during cleanup - update in progress"
        );
      }

      console.log("[VizUpdate Effect] Cleanup finished");
    };
  }, [
    updateVisualizationAndLegend,
    isLabelManagerReady,
    activeTab,
    tabs,
    saveLabelPositions,
  ]);

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
                className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-colors duration-200 ease-in-out"
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

                // Determine filter category based on visualization type
                let filterCategory = null;
                if (activeVisOption) {
                  switch (activeVisOption.type) {
                    case "class-breaks":
                      filterCategory = "Heat Map";
                      break;
                    case "dot-density":
                      filterCategory = "Dot Density Map";
                      break;
                    default:
                      filterCategory = null;
                  }
                }

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
                          placeholder={
                            filterCategory
                              ? `Select ${filterCategory.toLowerCase()}`
                              : "Select visualization"
                          }
                          searchPlaceholder={
                            filterCategory
                              ? `Search ${filterCategory.toLowerCase()}s...`
                              : "Search visualizations..."
                          }
                          className="w-56"
                          filterCategory={filterCategory}
                        />
                      </>
                    )}

                    {showEditButton && (
                      <div className="flex space-x-2">
                        <button
                          onClick={openLayerPropertiesEditor}
                          className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                          title="Edit layer properties"
                        >
                          Edit Map/Legend
                        </button>
                        <button
                          onClick={openLabelEditor}
                          className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none flex items-center"
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
