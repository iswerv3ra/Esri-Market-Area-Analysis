// src/contexts/MapContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { webMercatorToGeographic } from "@arcgis/core/geometry/support/webMercatorUtils";

const MapContext = createContext();

const FEATURE_LAYERS = {
  md: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/74",
    outFields: [
      "OBJECTID",
      "GEOID",
      "NAME",
      "BASENAME",
      "CSA",
      "CBSA",
      "LSADC",
      "POP100",
      "HU100",
    ],
    uniqueIdField: "OBJECTID",
    title: "Metropolitan Divisions",
    geometryType: "polygon",
    popupTemplate: {
      title: "{BASENAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "BASENAME", label: "Division Name" },
            { fieldName: "NAME", label: "Full Name" },
            { fieldName: "POP100", label: "Population" },
            { fieldName: "HU100", label: "Housing Units" },
            { fieldName: "CBSA", label: "CBSA Code" },
            { fieldName: "CSA", label: "CSA Code" },
            { fieldName: "LSADC", label: "Statistical Area Type" },
          ],
        },
      ],
    },
    returnGeometry: true,
    mode: "ondemand",
    minScale: 6000000,
    maxScale: 100,
  },
  zip: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_ZIP_Codes/FeatureServer/0",
    outFields: ["ZIP", "PO_NAME"],
    uniqueIdField: "FID",
    title: "ZIP Codes",
    geometryType: "polygon",
    popupTemplate: {
      title: "ZIP Code: {ZIP}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "ZIP", label: "ZIP Code" },
            { fieldName: "PO_NAME", label: "Post Office Name" },
          ],
        },
      ],
    },
  },
  county: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties/FeatureServer/0",
    outFields: ["NAME", "STATE_NAME"],
    uniqueIdField: "FID",
    title: "Counties",
    geometryType: "polygon",
    popupTemplate: {
      title: "{NAME} County",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "County Name" },
            { fieldName: "STATE_NAME", label: "State" },
          ],
        },
      ],
    },
  },
  tract: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Census_Tracts/FeatureServer/0",
    outFields: ["OBJECTID", "TRACT_FIPS", "STATE_ABBR", "COUNTY_FIPS"],
    uniqueIdField: "OBJECTID",
    title: "Census Tracts",
    geometryType: "polygon",
    popupTemplate: {
      title: "Census Tract {TRACT_FIPS}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "TRACT_FIPS", label: "TRACT" },
            { fieldName: "COUNTY_FIPS", label: "County" },
            { fieldName: "STATE_ABBR", label: "State" },
          ],
        },
      ],
    },
  },
  block: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2",
    outFields: ["OID", "GEOID", "STATE", "COUNTY", "TRACT", "BLOCK"],
    uniqueIdField: "OID",
    title: "Census Blocks",
    geometryType: "polygon",
    popupTemplate: {
      title: "Block {BLOCK}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "BLOCK", label: "Block" },
            { fieldName: "TRACT", label: "Tract" },
            { fieldName: "COUNTY", label: "County" },
            { fieldName: "STATE", label: "State" },
            { fieldName: "GEOID", label: "GEOID" },
          ],
        },
      ],
    },
    minScale: 18056,
    maxScale: 0,
  },
  blockgroup: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Census_BlockGroups/FeatureServer/0",
    outFields: [
      "OBJECTID",
      "BLOCKGROUP_FIPS",
      "TRACT_FIPS",
      "COUNTY_FIPS",
      "STATE_FIPS",
    ],
    uniqueIdField: "OBJECTID",
    title: "Block Groups",
    geometryType: "polygon",
    popupTemplate: {
      title: "Block Group {BLOCKGROUP_FIPS}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "BLOCKGROUP_FIPS", label: "Block Group" },
            { fieldName: "TRACT_FIPS", label: "Tract" },
            { fieldName: "COUNTY_FIPS", label: "County" },
            { fieldName: "STATE_FIPS", label: "State" },
          ],
        },
      ],
    },
  },
  place: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/28",
    outFields: [
      "OBJECTID",
      "GEOID",
      "STATE",
      "PLACE",
      "NAME",
      "BASENAME",
      "LSADC",
    ],
    uniqueIdField: "OBJECTID",
    title: "Places",
    geometryType: "polygon",
    popupTemplate: {
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "Place Name" },
            { fieldName: "STATE", label: "State" },
            { fieldName: "LSADC", label: "Legal/Statistical Area Description" },
            { fieldName: "BASENAME", label: "Base Name" },
          ],
        },
      ],
    },
  },
  state: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized/FeatureServer/0",
    outFields: ["STATE_NAME", "STATE_ABBR"],
    uniqueIdField: "FID",
    title: "States",
    geometryType: "polygon",
    popupTemplate: {
      title: "{STATE_NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "STATE_NAME", label: "State" },
            { fieldName: "STATE_ABBR", label: "Abbreviation" },
          ],
        },
      ],
    },
  },
  cbsa: {
    urls: [
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/91",
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/93",
    ],
    outFields: [
      "OBJECTID",
      "GEOID",
      "NAME",
      "BASENAME",
      "CSA",
      "LSADC",
      "POP100",
      "HU100",
    ],
    uniqueIdField: "OBJECTID",
    title: "Combined Statistical Areas",
    geometryType: "polygon",
    popupTemplate: {
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "Area Name" },
            { fieldName: "POP100", label: "Population" },
            { fieldName: "HU100", label: "Housing Units" },
            { fieldName: "CSA", label: "CSA Code" },
            { fieldName: "LSADC", label: "Statistical Area Type" },
          ],
        },
      ],
    },
    minScale: 22000000,
    maxScale: 100,
  },
  usa: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_State_Boundaries/MapServer/0",
    outFields: ["FID", "SUB_REGION", "STATE_NAME", "POPULATION "],
    uniqueIdField: "FID",
    title: "United States Boundary",
    geometryType: "polygon",
    popupTemplate: {
      title: "United States",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "FID", label: "FID" },
            { fieldName: "POPULATION ", label: "Population" },
            { fieldName: "SUB_REGION", label: "Sub Region" },
            { fieldName: "STATE_NAME", label: "State" },
          ],
        },
      ],
    },
    definitionExpression: "GEOID = '010'",
  },
};

const SYMBOLS = {
  defaultPolygon: {
    type: "simple-fill",
    color: [0, 0, 0, 0],
    outline: {
      color: [128, 128, 128, 1],
      width: 1,
    },
  },
  selectedPolygon: {
    type: "simple-fill",
    color: [0, 123, 255, 0.3],
    outline: {
      color: [0, 123, 255, 1],
      width: 2,
    },
  },
  defaultPolyline: {
    type: "simple-line",
    color: [128, 128, 128, 1],
    width: 1,
  },
  selectedPolyline: {
    type: "simple-line",
    color: [0, 123, 255, 1],
    width: 2,
  },
  defaultPoint: {
    type: "simple-marker",
    color: [0, 123, 255, 0.5],
    outline: {
      color: [0, 123, 255, 1],
      width: 1,
    },
  },
  selectedPoint: {
    type: "simple-marker",
    color: [0, 123, 255, 0.7],
    outline: {
      color: [0, 123, 255, 1],
      width: 2,
    },
  },
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMap must be used within a MapProvider");
  return context;
};

export const MapProvider = ({ children, marketAreas = [] }) => {
  const [mapView, setMapView] = useState(null);
  const featureLayersRef = useRef({});
  const selectionGraphicsLayerRef = useRef(null);
  const radiusGraphicsLayerRef = useRef(null);
  const [activeLayers, setActiveLayers] = useState([]);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [isMapSelectionActive, setIsMapSelectionActive] = useState(false);
  const [visibleMarketAreaIds, setVisibleMarketAreaIds] = useState([]);
  const [selectedMarketArea, setSelectedMarketArea] = useState(null);

  // Move hideAllFeatureLayers here, at component body level
  const hideAllFeatureLayers = useCallback(() => {
    if (!mapView) return;

    Object.values(featureLayersRef.current).forEach((layer) => {
      if (layer && !layer.destroyed) {
        if (Array.isArray(layer.featureLayers)) {
          // Handle GroupLayer case
          layer.featureLayers.forEach((subLayer) => {
            if (subLayer && !subLayer.destroyed) {
              subLayer.visible = false;
            }
          });
        } else {
          // Handle single FeatureLayer case
          layer.visible = false;
        }
        console.log(`[MapContext] Hiding layer ${layer.title}`);
      }
    });

    setActiveLayers([]);
  }, [mapView]);

  const formatLocationName = useCallback((feature, layerType) => {
    const attrs = feature.attributes;
    switch (layerType) {
      case "zip":
        const zip = attrs.ZIP || "";
        const poName = attrs.PO_NAME || "";
        if (zip && poName) {
          return `${zip} - ${poName}`;
        } else if (zip) {
          return zip;
        } else if (poName) {
          return poName;
        } else {
          return "";
        }
      case "county":
        return `${attrs.NAME || ""}, ${attrs.STATE_NAME || ""}`;
      case "tract":
        return `Tract ${attrs.TRACT_FIPS || attrs.TRACT || ""}`;
      case "block":
        return `Block ${attrs.BLOCK || ""}`;
      case "blockgroup":
        return `Block Group ${attrs.BLOCKGROUP_FIPS || ""}`;
      case "place":
        return attrs.NAME || attrs.BASENAME || "";
      case "state":
        return attrs.STATE_NAME || "";
      case "cbsa":
        return attrs.NAME || attrs.BASENAME || "";
      case "usa":
        return "United States";
      default:
        return attrs.NAME || "";
    }
  }, []);

  // Initialize graphics layers
  const initializeGraphicsLayers = useCallback(async () => {
    if (!mapView) return;

    try {
      const { default: GraphicsLayer } = await import(
        "@arcgis/core/layers/GraphicsLayer"
      );

      // Selection Graphics Layer
      const selectionLayer = new GraphicsLayer({
        title: "Selection Graphics",
        listMode: "hide",
        elevationInfo: {
          mode: "relative-to-ground",
          offset: 1,
        },
      });

      // Radius Graphics Layer
      const radiusLayer = new GraphicsLayer({
        title: "Radius Graphics",
        listMode: "hide",
        elevationInfo: {
          mode: "relative-to-ground",
          offset: 1,
        },
      });

      // Add both layers to the map
      mapView.map.addMany([selectionLayer, radiusLayer]);

      // Update refs
      selectionGraphicsLayerRef.current = selectionLayer;
      radiusGraphicsLayerRef.current = radiusLayer;

      console.log("[MapContext] Graphics layers initialized");
    } catch (error) {
      console.error("[MapContext] Error initializing GraphicsLayers:", error);
    }
  }, [mapView]);

  const initializeFeatureLayer = useCallback(async (type) => {
    if (!type || !FEATURE_LAYERS[type]) {
      console.error(`Invalid or undefined layer type: ${type}`);
      return null;
    }

    const layerConfig = FEATURE_LAYERS[type];
    try {
      const { default: FeatureLayer } = await import(
        "@arcgis/core/layers/FeatureLayer"
      );
      const { default: GroupLayer } = await import(
        "@arcgis/core/layers/GroupLayer"
      );

      let symbol;
      switch (layerConfig.geometryType.toLowerCase()) {
        case "point":
          symbol = SYMBOLS.defaultPoint;
          break;
        case "polyline":
          symbol = SYMBOLS.defaultPolyline;
          break;
        case "polygon":
          symbol = SYMBOLS.defaultPolygon;
          break;
        default:
          symbol = SYMBOLS.defaultPolygon;
          break;
      }

      if (layerConfig.urls) {
        // Create a group layer to hold all the feature layers
        const groupLayer = new GroupLayer({
          title: layerConfig.title,
          visible: false,
          listMode: "hide",
        });

        // Create a feature layer for each URL
        const featureLayers = layerConfig.urls.map(
          (url) =>
            new FeatureLayer({
              url: url,
              outFields: layerConfig.outFields,
              visible: true,
              opacity: 1,
              popupEnabled: true,
              popupTemplate: layerConfig.popupTemplate,
              renderer: {
                type: "simple",
                symbol: symbol,
              },
              // Set the title to match the one in FEATURE_LAYERS
              title: layerConfig.title,
            })
        );

        // Add all feature layers to the group layer
        groupLayer.addMany(featureLayers);

        // Store feature layers for reference
        groupLayer.featureLayers = featureLayers;

        return groupLayer;
      } else {
        // Single URL case
        const layer = new FeatureLayer({
          url: layerConfig.url,
          outFields: layerConfig.outFields,
          title: layerConfig.title,
          visible: false,
          opacity: 1,
          popupEnabled: true,
          popupTemplate: layerConfig.popupTemplate,
          renderer: {
            type: "simple",
            symbol: symbol,
          },
        });

        return layer;
      }
    } catch (error) {
      console.error(`Error initializing FeatureLayer for type ${type}:`, error);
      return null;
    }
  }, []);

  // Function to add a layer to activeLayers
  const addActiveLayer = useCallback(
    async (type) => {
      if (!type || !FEATURE_LAYERS[type] || !mapView) {
        console.error(`Invalid layer type or map not initialized: ${type}`);
        return;
      }

      setIsLayerLoading(true);

      try {
        // Hide other layers
        Object.entries(featureLayersRef.current).forEach(
          ([layerType, layer]) => {
            if (layer && !layer.destroyed && layerType !== type) {
              layer.visible = false;
              console.log(`[MapContext] Hiding layer ${layerType}`);
            }
          }
        );

        let layer = featureLayersRef.current[type];

        // Initialize the layer if it doesn't exist
        if (!layer) {
          layer = await initializeFeatureLayer(type);
          if (layer) {
            await mapView.map.add(layer);
            featureLayersRef.current[type] = layer;
            console.log(
              `[MapContext] New FeatureLayer for type ${type} added to the map.`
            );
          }
        }

        // Ensure the layer is visible and added to active layers
        if (layer && !layer.destroyed) {
          try {
            await layer.when();
            layer.visible = true;
            console.log(`[MapContext] FeatureLayer ${type} set to visible.`);
          } catch (error) {
            console.error(
              `[MapContext] Error setting layer visibility for ${type}:`,
              error
            );
          }

          setActiveLayers((prev) => {
            if (!prev.includes(type)) {
              console.log(`[MapContext] Adding layer ${type} to activeLayers.`);
              return [...prev, type];
            }
            return prev;
          });
        }
      } catch (error) {
        console.error(`Error adding active layer ${type}:`, error);
        throw error;
      } finally {
        setIsLayerLoading(false);
      }
    },
    [mapView, initializeFeatureLayer]
  );

  const removeFromSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        "[MapContext] removeFromSelection called with feature:",
        feature.attributes
      );

      if (!selectionGraphicsLayerRef.current) {
        console.warn(
          "[MapContext] Cannot remove from selection: selectionGraphicsLayer not initialized"
        );
        return;
      }

      try {
        const currentLayerConfig = FEATURE_LAYERS[layerType];
        if (!currentLayerConfig) {
          console.error(
            `[MapContext] Layer configuration not found for layer type: ${layerType}`
          );
          return;
        }
        const uniqueIdField = currentLayerConfig.uniqueIdField;

        // Find and remove the graphic from selectionGraphicsLayer
        const graphicsToRemove =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) =>
              g.attributes[uniqueIdField] === feature.attributes[uniqueIdField]
          );

        graphicsToRemove.forEach((g) => {
          selectionGraphicsLayerRef.current.remove(g);
          console.log(
            "[MapContext] Graphic removed from selectionGraphicsLayer for feature:",
            g.attributes
          );
        });

        // Update selectedFeatures state
        setSelectedFeatures((prev) => {
          const newSelectedFeatures = prev.filter(
            (f) =>
              f.attributes[uniqueIdField] !== feature.attributes[uniqueIdField]
          );
          console.log(
            "[MapContext] Feature removed from selection:",
            feature.attributes
          );
          return newSelectedFeatures;
        });
      } catch (error) {
        console.error("[MapContext] Error in removeFromSelection:", error);
      }
    },
    [selectedFeatures]
  );

  const addToSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        `[MapContext] addToSelection called with feature:`,
        feature.attributes
      );

      if (!mapView) {
        console.warn(
          `[MapContext] Cannot add to selection: mapView not initialized`
        );
        return;
      }

      try {
        const currentLayerConfig = FEATURE_LAYERS[layerType];
        if (!currentLayerConfig) {
          console.error(
            `[MapContext] Layer configuration not found for layer type: ${layerType}`
          );
          return;
        }
        const uniqueIdField = currentLayerConfig.uniqueIdField;

        // Check if feature is already selected
        const isAlreadySelected = selectedFeatures.some(
          (f) =>
            f.attributes[uniqueIdField] === feature.attributes[uniqueIdField]
        );

        if (isAlreadySelected) {
          console.log(
            `[MapContext] Feature already selected:`,
            feature.attributes
          );
          // Remove the feature from selection
          await removeFromSelection(feature, layerType);
        } else {
          // Update selectedFeatures state only
          setSelectedFeatures((prev) => {
            console.log(
              `[MapContext] Feature added to selection:`,
              feature.attributes
            );
            return [...prev, feature];
          });
        }
      } catch (error) {
        console.error("[MapContext] Error in addToSelection:", error);
      }
    },
    [mapView, selectedFeatures, removeFromSelection]
  );
  
// Modified clearSelection function for MapContext.jsx
const clearSelection = useCallback(
  (preserveEditingId = null) => {
    if (!selectionGraphicsLayerRef.current) return;
    try {
      // Keep:
      // 1. Graphics that are part of any market area (have marketAreaId)
      // 2. Graphics that are part of the currently editing market area
      // 3. Graphics from the radius layer if they belong to a market area
      const graphicsToKeep = selectionGraphicsLayerRef.current.graphics.filter((graphic) => {
        const isMarketArea = graphic.attributes?.marketAreaId;
        const isCurrentlyEditing = preserveEditingId && 
          (graphic.attributes?.marketAreaId === preserveEditingId || 
           (graphic.attributes?.FEATURE_TYPE === activeLayers[0] && !graphic.attributes?.marketAreaId));
        
        // If we're not in editing mode (preserveEditingId is null), keep all market area graphics
        if (!preserveEditingId) {
          return isMarketArea;
        }
        
        return isMarketArea || isCurrentlyEditing;
      });

      // Preserve the existing graphics layer order
      const orderedGraphics = [...graphicsToKeep].sort((a, b) => 
        (b.attributes?.order || 0) - (a.attributes?.order || 0)
      );

      selectionGraphicsLayerRef.current.removeAll();
      orderedGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));

      // Update selectedFeatures state while preserving market areas
      setSelectedFeatures((prev) =>
        prev.filter((f) => {
          const isMarketArea = f.attributes?.marketAreaId;
          const isCurrentlyEditing = preserveEditingId && 
            (f.attributes?.marketAreaId === preserveEditingId ||
             (f.attributes?.FEATURE_TYPE === activeLayers[0] && !f.attributes?.marketAreaId));
          
          // If we're not in editing mode, keep all market area features
          if (!preserveEditingId) {
            return isMarketArea;
          }
          
          return isMarketArea || isCurrentlyEditing;
        })
      );

      console.log(
        "[MapContext] Selection cleared while preserving market areas and editing state",
        { 
          preserveEditingId, 
          keptGraphicsCount: orderedGraphics.length,
          mode: preserveEditingId ? 'editing' : 'normal'
        }
      );
    } catch (error) {
      console.error("Error clearing selection:", error);
    }
  },
  [activeLayers]
);

// Additional helper function to manage market area visibility during editing
const toggleMarketAreaEditMode = useCallback((marketAreaId) => {
  if (!marketAreaId || !selectionGraphicsLayerRef.current) return;

  try {
    // When entering edit mode for a specific market area:
    // 1. Keep all existing market area graphics visible
    // 2. Allow selection/editing only for the target market area
    const currentGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
    
    // Update the visibility/interaction state without removing other graphics
    currentGraphics.forEach((graphic) => {
      const isEditingArea = graphic.attributes?.marketAreaId === marketAreaId;
      const isMarketArea = graphic.attributes?.marketAreaId;
      
      // Keep all market areas visible but adjust interaction state
      if (isMarketArea) {
        graphic.visible = true;
        graphic.interactive = isEditingArea; // Only the editing area should be interactive
      }
    });

    console.log(
      "[MapContext] Market area edit mode toggled",
      { 
        marketAreaId,
        totalGraphics: currentGraphics.length,
        editableGraphics: currentGraphics.filter(g => g.attributes?.marketAreaId === marketAreaId).length
      }
    );
  } catch (error) {
    console.error("Error toggling market area edit mode:", error);
  }
}, []);


  // Display features
  const displayFeatures = useCallback(
    async (features) => {
      if (!selectionGraphicsLayerRef.current || !mapView) return;

      try {
        console.log(
          `Displaying ${
            features.length
          } features for layers: ${activeLayers.join(", ")}`
        );
        selectionGraphicsLayerRef.current.removeAll();

        const { default: Graphic } = await import("@arcgis/core/Graphic");

        for (const feature of features) {
          const geometry = ensureValidGeometry(
            feature.geometry,
            mapView.spatialReference
          );
          if (!geometry) continue;

          // Determine symbol based on geometry type
          let symbol;
          switch (geometry.type.toLowerCase()) {
            case "point":
              symbol = SYMBOLS.defaultPoint;
              break;
            case "polyline":
              symbol = SYMBOLS.defaultPolyline;
              break;
            case "polygon":
              symbol = SYMBOLS.defaultPolygon;
              break;
            default:
              console.warn(
                `Unsupported geometry type for display: ${geometry.type}`
              );
              continue;
          }

          const graphic = new Graphic({
            geometry,
            attributes: {
              ...feature.attributes,
              FEATURE_TYPE: activeLayers[activeLayers.length - 1],
            },
            symbol,
          });
          selectionGraphicsLayerRef.current.add(graphic);
        }
      } catch (error) {
        console.error("Error displaying features:", error);
      }
    },
    [activeLayers, mapView]
  );

  // MapContext.jsx
  // MapContext.jsx

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType) => {
      if (!selectionGraphicsLayerRef.current || !mapView) return;

      try {
        const [{ default: Graphic }, geometryEngineAsync] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/geometryEngineAsync"),
        ]);

        // Get the market area IDs being updated
        const marketAreaIds = new Set(
          features.map((f) => f.attributes.marketAreaId)
        );

        // Keep existing graphics from other market areas
        const existingGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) => !marketAreaIds.has(g.attributes.marketAreaId)
          );

        // Clear existing graphics
        selectionGraphicsLayerRef.current.removeAll();

        // Add back existing graphics from other market areas
        existingGraphics.forEach((g) =>
          selectionGraphicsLayerRef.current.add(g)
        );

        // Process features by market area
        const newFeaturesByMarketArea = features.reduce((acc, feature) => {
          const marketAreaId = feature.attributes.marketAreaId;
          if (!acc[marketAreaId]) acc[marketAreaId] = [];
          acc[marketAreaId].push(feature);
          return acc;
        }, {});

        for (const [marketAreaId, maFeatures] of Object.entries(
          newFeaturesByMarketArea
        )) {
          let geometries = maFeatures
            .map((f) => f.geometry)
            .filter((g) => g != null);

          if (geometries.length === 0) continue;

          // Simplify and repair geometries before union
          geometries = await Promise.all(
            geometries.map(async (geometry) => {
              let simplified = await geometryEngineAsync.simplify(geometry);
              // Repair geometry using buffer(0)
              let repaired = await geometryEngineAsync.buffer(simplified, 0);
              return repaired || simplified;
            })
          );

          // Union geometries asynchronously
          let unionGeometry;
          try {
            unionGeometry = await geometryEngineAsync.union(geometries);
          } catch (e) {
            console.error("Error during union operation:", e);
            // Fallback to iterative union if union fails
            unionGeometry = geometries[0];
            for (let i = 1; i < geometries.length; i++) {
              try {
                unionGeometry = await geometryEngineAsync.union([
                  unionGeometry,
                  geometries[i],
                ]);
              } catch (err) {
                console.error(`Error unioning geometry at index ${i}:`, err);
                // Continue with the next geometry
              }
            }
          }

          // Simplify the unioned geometry
          unionGeometry = await geometryEngineAsync.simplify(unionGeometry);

          if (unionGeometry) {
            const symbol = {
              type: "simple-fill",
              color: [...hexToRgb(styles.fill), styles.fillOpacity],
              outline: {
                color: styles.outline,
                width: styles.outlineWidth,
              },
            };

            const unionGraphic = new Graphic({
              geometry: unionGeometry,
              symbol: symbol,
              attributes: {
                marketAreaId,
                FEATURE_TYPE: featureType,
                order: maFeatures[0].attributes.order,
              },
            });

            // Add the new graphic
            selectionGraphicsLayerRef.current.add(unionGraphic);
          }
        }
      } catch (error) {
        console.error("Error updating feature styles:", error);
      }
    },
    [mapView]
  );

  // Helper function to handle geometry validation
  const ensureValidGeometry = (geometry, spatialReference) => {
    if (!geometry) return null;

    try {
      // Ensure the geometry is properly projected
      if (geometry.spatialReference.wkid !== spatialReference.wkid) {
        geometry = webMercatorToGeographic(geometry);
      }
      return geometry;
    } catch (error) {
      console.error("Error validating geometry:", error);
      return null;
    }
  };

  const drawRadius = useCallback(
    async (point, style = null, marketAreaId = null, order = 0) => {
      if (
        !radiusGraphicsLayerRef.current ||
        !point?.center ||
        !point?.radii ||
        !mapView
      )
        return;

      try {
        // Remove only the graphics for this specific market area for real-time updates
        const existingGraphics = radiusGraphicsLayerRef.current.graphics.filter(
          (g) => g.attributes.marketAreaId !== marketAreaId
        );
        radiusGraphicsLayerRef.current.removeAll();

        // First add back all existing graphics from other market areas
        existingGraphics.forEach((g) => radiusGraphicsLayerRef.current.add(g));

        const center = ensureValidGeometry(
          point.center,
          mapView.spatialReference
        );
        if (!center) return;
        const centerPoint = webMercatorToGeographic(center);

        const [geometryEngine, { default: Graphic }] = await Promise.all([
          import("@arcgis/core/geometry/geometryEngine"),
          import("@arcgis/core/Graphic"),
        ]);

        const fillRgb = style?.fillColor
          ? hexToRgb(style.fillColor)
          : [0, 123, 255];
        const outlineRgb = style?.borderColor
          ? hexToRgb(style.borderColor)
          : [0, 123, 255];
        const fillOpacity =
          style?.fillOpacity !== undefined ? style.fillOpacity : 0.3;
        const borderWidth =
          style?.borderWidth !== undefined ? style.borderWidth : 2;

        // Create new graphics for this market area
        const newGraphics = [];
        for (const radiusMiles of point.radii) {
          const radiusMeters = radiusMiles * 1609.34;
          const polygon = geometryEngine.geodesicBuffer(
            centerPoint,
            radiusMeters,
            "meters"
          );

          const symbol = {
            type: "simple-fill",
            color: fillOpacity > 0 ? [...fillRgb, fillOpacity] : [0, 0, 0, 0],
            outline:
              borderWidth > 0
                ? {
                    color: outlineRgb,
                    width: borderWidth,
                  }
                : null,
          };

          const circleGraphic = new Graphic({
            geometry: polygon,
            attributes: {
              FEATURE_TYPE: "radius",
              marketAreaId,
              order,
            },
            symbol: symbol,
          });

          newGraphics.push(circleGraphic);
        }

        // Add new graphics in correct order based on their order value
        if (newGraphics.length > 0) {
          const allGraphics = [...existingGraphics, ...newGraphics];
          allGraphics.sort(
            (a, b) => (b.attributes.order || 0) - (a.attributes.order || 0)
          );
          radiusGraphicsLayerRef.current.removeAll();
          allGraphics.forEach((graphic) =>
            radiusGraphicsLayerRef.current.add(graphic)
          );
        }
      } catch (error) {
        console.error("Error drawing radius:", error);
      }
    },
    [mapView]
  );

  // Remove an active layer
  const removeActiveLayer = useCallback(
    async (type) => {
      if (!mapView) {
        console.warn("Map view not initialized");
        return;
      }

      // If no type is provided, do nothing and return
      if (!type) {
        console.warn(
          "[MapContext] No layer type provided to removeActiveLayer"
        );
        return;
      }

      if (!FEATURE_LAYERS[type]) {
        console.error(`Invalid layer type: ${type}`);
        return;
      }

      setIsLayerLoading(true);

      try {
        const layer = featureLayersRef.current[type];
        if (layer && !layer.destroyed) {
          layer.visible = false;
          console.log(`[MapContext] FeatureLayer ${type} set to hidden.`);
        }

        setActiveLayers((prev) => {
          console.log(`[MapContext] Removing layer ${type} from activeLayers.`);
          return prev.filter((l) => l !== type);
        });

        // Only remove graphics for this specific type
        if (selectionGraphicsLayerRef.current && type) {
          const remainingGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) => g.attributes?.FEATURE_TYPE !== type
            );
          selectionGraphicsLayerRef.current.removeAll();
          remainingGraphics.forEach((g) =>
            selectionGraphicsLayerRef.current.add(g)
          );
          console.log(
            `[MapContext] Removed graphics related to layer ${type} from selectionGraphicsLayer.`
          );
        }
      } catch (error) {
        console.error(`Error removing layer ${type}:`, error);
      } finally {
        setIsLayerLoading(false);
      }
    },
    [mapView]
  );

// MapContext.jsx - Add these helper functions
const clearMarketAreaGraphics = useCallback((marketAreaId) => {
  if (!marketAreaId) return;

  try {
    if (radiusGraphicsLayerRef.current) {
      const remainingGraphics = radiusGraphicsLayerRef.current.graphics.filter(
        (g) => g.attributes?.marketAreaId !== marketAreaId
      );
      radiusGraphicsLayerRef.current.removeAll();
      remainingGraphics.forEach((g) => radiusGraphicsLayerRef.current.add(g));
    }

    if (selectionGraphicsLayerRef.current) {
      const remainingGraphics = selectionGraphicsLayerRef.current.graphics.filter(
        (g) => g.attributes?.marketAreaId !== marketAreaId
      );
      selectionGraphicsLayerRef.current.removeAll();
      remainingGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));
    }
  } catch (error) {
    console.error("Error clearing market area graphics:", error);
  }
}, []);


  const queryFeatures = useCallback(
    async (searchText) => {
      if (!activeLayers.length || !mapView) return [];

      const allFeatures = [];

      for (const type of activeLayers) {
        const layer = featureLayersRef.current[type];
        const layerConfig = FEATURE_LAYERS[type];

        if (!layer || !layerConfig) continue;

        // Build layer-specific where clause
        let whereClause;
        switch (type) {
          case "zip":
            whereClause = /^\d+$/.test(searchText)
              ? `ZIP LIKE '${searchText}%'`
              : `PO_NAME LIKE '%${searchText}%'`;
            break;
          case "county":
            whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%') OR UPPER(STATE_NAME) LIKE UPPER('%${searchText}%')`;
            break;
          default:
            whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
        }

        try {
          const { default: Query } = await import(
            "@arcgis/core/rest/support/Query"
          );

          const query = new Query({
            where: whereClause,
            outFields: ["*"],
            returnGeometry: true,
            // Remove spatial constraints
            // geometry: mapView.extent,
            // spatialRelationship: "intersects",
            num: 100, // Limit results per layer for performance
            distance: 0,
            units: "meters",
            spatialRel: "esriSpatialRelIntersects",
          });

          let layersToQuery = [];
          if (layer.featureLayers) {
            // If it's a group layer with multiple feature layers
            layersToQuery = layer.featureLayers;
          } else {
            // If it's a single feature layer
            layersToQuery = [layer];
          }

          // Query all relevant layers with progress tracking
          const queryPromises = layersToQuery.map(async (l) => {
            try {
              console.log(
                `[MapContext] Querying layer ${type} with where clause:`,
                whereClause
              );
              const result = await l.queryFeatures(query);
              console.log(
                `[MapContext] Query completed for layer ${type}, found ${result.features.length} features`
              );
              return result;
            } catch (error) {
              console.error(
                `[MapContext] Error querying individual layer in ${type}:`,
                error
              );
              return { features: [] };
            }
          });

          const results = await Promise.all(queryPromises);

          // Combine all results and filter out duplicates
          results.forEach((result) => {
            if (result.features.length > 0) {
              // Add unique features based on ObjectID or similar identifier
              const uniqueFeatures = result.features.filter((feature) => {
                const featureId =
                  feature.attributes.OBJECTID || feature.attributes.FID;
                return !allFeatures.some(
                  (existingFeature) =>
                    (existingFeature.attributes.OBJECTID ||
                      existingFeature.attributes.FID) === featureId
                );
              });

              allFeatures.push(...uniqueFeatures);
              console.log(
                `[MapContext] Added ${uniqueFeatures.length} unique features for layer ${type}`
              );
            }
          });
        } catch (error) {
          console.error(
            `[MapContext] Error querying features for layer ${type}:`,
            error
          );
          toast.error(`Error searching in ${type} layer`);
        }
      }

      if (allFeatures.length > 0) {
        try {
          await displayFeatures(allFeatures);
          console.log(
            `[MapContext] Successfully displayed ${allFeatures.length} total features on the map`
          );
        } catch (error) {
          console.error("[MapContext] Error displaying features:", error);
          toast.error("Error displaying search results");
        }
      } else {
        console.log("[MapContext] No features found for the query");
      }

      // Sort features by name if possible
      allFeatures.sort((a, b) => {
        const nameA = (
          a.attributes.NAME ||
          a.attributes.PO_NAME ||
          ""
        ).toUpperCase();
        const nameB = (
          b.attributes.NAME ||
          b.attributes.PO_NAME ||
          ""
        ).toUpperCase();
        return nameA.localeCompare(nameB);
      });

      return allFeatures;
    },
    [activeLayers, mapView, displayFeatures]
  );

  // Toggle active layer type
  const toggleActiveLayerType = useCallback(
    async (type) => {
      if (activeLayers.includes(type)) {
        await removeActiveLayer(type);
      } else {
        await addActiveLayer(type);
      }
    },
    [activeLayers, addActiveLayer, removeActiveLayer]
  );

  // Initialize graphics layers when mapView is set
  useEffect(() => {
    if (
      mapView &&
      !selectionGraphicsLayerRef.current &&
      !radiusGraphicsLayerRef.current
    ) {
      initializeGraphicsLayers();
    }
  }, [mapView, initializeGraphicsLayers]);

  // Handle map clicks for selection
  useEffect(() => {
    if (!mapView) return;

    const handleMapClick = async (event) => {
      console.log("[MapContext] Map clicked at:", event.mapPoint);
      if (!isMapSelectionActive || !activeLayers.length) {
        console.log(
          "[MapContext] Map selection is not active or no active layers."
        );
        return;
      }

      try {
        const hitResult = await mapView.hitTest(event);
        console.log("[MapContext] hitTest result:", hitResult);

        if (hitResult && hitResult.results.length > 0) {
          hitResult.results.forEach((r) => {
            console.log("[MapContext] hitTest Layer Title:", r.layer.title);
          });

          const graphicResult = hitResult.results.find((r) =>
            activeLayers.some(
              (type) => FEATURE_LAYERS[type].title === r.layer.title
            )
          );

          if (graphicResult && graphicResult.graphic) {
            const graphic = graphicResult.graphic;
            const matchedLayerType = activeLayers.find(
              (type) => FEATURE_LAYERS[type].title === graphicResult.layer.title
            );
            console.log(
              `[MapContext] Graphic found on layer ${matchedLayerType}:`,
              graphic.attributes
            );
            await addToSelection(graphic, matchedLayerType);
          } else {
            console.log(
              "[MapContext] No matching graphic found in active layers."
            );
          }
        } else {
          console.log("[MapContext] No results from hitTest.");
        }
      } catch (error) {
        console.error("[MapContext] Error handling map click:", error);
      }
    };

    const handler = mapView.on("click", handleMapClick);

    return () => {
      handler.remove();
    };
  }, [mapView, isMapSelectionActive, activeLayers, addToSelection]);

// Also update the showVisibleMarketAreas effect to ensure proper rendering order
  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      if (!marketAreas.length) return;

      try {
        // Don't clear all market areas, instead preserve existing ones
        // Sort market areas by order field to control rendering order
        const sortedAreas = [...marketAreas].sort((a, b) => a.order - b.order);

        // Render each market area
        for (const marketArea of sortedAreas) {
          if (!visibleMarketAreaIds.includes(marketArea.id)) continue;

          // Check if graphics for this market area already exist
          const existingGraphics = selectionGraphicsLayerRef.current?.graphics.filter(
            (g) => g.attributes?.marketAreaId === marketArea.id
          );

          // Only redraw if no graphics exist for this market area
          if (!existingGraphics?.length) {
            if (marketArea.ma_type === "radius" && marketArea.radius_points) {
              for (const point of marketArea.radius_points) {
                await drawRadius(
                  point,
                  marketArea.style_settings,
                  marketArea.id,
                  marketArea.order
                );
              }
            } else if (marketArea.locations) {
              const features = marketArea.locations.map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  id: loc.id,
                  marketAreaId: marketArea.id,
                  order: marketArea.order,
                },
              }));

              await updateFeatureStyles(
                features,
                {
                  fill: marketArea.style_settings?.fillColor,
                  fillOpacity: marketArea.style_settings?.fillOpacity,
                  outline: marketArea.style_settings?.borderColor,
                  outlineWidth: marketArea.style_settings?.borderWidth,
                },
                marketArea.ma_type
              );
            }
          }
        }
      } catch (error) {
        console.error("Error in showVisibleMarketAreas:", error);
      }
    };

    showVisibleMarketAreas();
  }, [marketAreas, visibleMarketAreaIds, drawRadius, updateFeatureStyles]);

  const resetMapState = useCallback(() => {
    // Reset all state
    setMapView(null);
    setActiveLayers([]);
    setIsLayerLoading(false);
    setSelectedFeatures([]);
    setIsMapSelectionActive(false);
    setVisibleMarketAreaIds([]);

    // Clear graphics layers
    if (selectionGraphicsLayerRef.current) {
      selectionGraphicsLayerRef.current.removeAll();
    }
    if (radiusGraphicsLayerRef.current) {
      radiusGraphicsLayerRef.current.removeAll();
    }

    // Clear feature layers
    Object.values(featureLayersRef.current).forEach(layer => {
      if (layer && !layer.destroyed) {
        try {
          // Handle both single layers and group layers
          if (Array.isArray(layer.featureLayers)) {
            layer.featureLayers.forEach(subLayer => {
              if (subLayer && !subLayer.destroyed) {
                subLayer.visible = false;
              }
            });
          } else {
            layer.visible = false;
          }
        } catch (error) {
          console.error("Error clearing layer:", error);
        }
      }
    });

    // Clear storage
    localStorage.removeItem('mapState');
    localStorage.removeItem('lastMapExtent');
    
    console.log('[MapContext] Map state reset successfully');
  }, []);

  // Update visibleMarketAreaIds when marketAreas changes
  useEffect(() => {
    if (marketAreas.length > 0) {
      setVisibleMarketAreaIds(marketAreas.map((ma) => ma.id));
    }
  }, [marketAreas]);

  const value = useMemo(
    () => ({
      mapView,
      setMapView,
      activeLayers,
      resetMapState, // Replace resetMarketAreas with resetMapState
      toggleActiveLayerType,
      addActiveLayer,
      removeActiveLayer,
      hideAllFeatureLayers,
      isLayerLoading,
      queryFeatures,
      hideAllFeatureLayers, // Add this
      selectedFeatures,
      addToSelection,
      removeFromSelection,
      clearSelection,
      featureLayers: featureLayersRef.current,
      updateFeatureStyles,
      drawRadius,
      clearMarketAreaGraphics,
      toggleMarketAreaEditMode,      // Add to dependencies
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      radiusGraphicsLayer: radiusGraphicsLayerRef.current,
      visibleMarketAreaIds,
      setVisibleMarketAreaIds,
      clearMarketAreaGraphics,  // Make sure this is included
    }),
    [
      mapView,
      activeLayers,
      toggleActiveLayerType,
      addActiveLayer,
      removeActiveLayer,
      isLayerLoading,
      resetMapState, 
      queryFeatures,
      selectedFeatures,
      addToSelection,
      hideAllFeatureLayers,
      toggleMarketAreaEditMode,      // Add to dependencies
      removeFromSelection,
      clearSelection,
      clearMarketAreaGraphics,
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      visibleMarketAreaIds,
      clearMarketAreaGraphics,  // Make sure this is included
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
export { FEATURE_LAYERS };
