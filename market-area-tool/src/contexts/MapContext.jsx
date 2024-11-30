// src/contexts/MapContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { ensureValidGeometry } from "../utils";
import { webMercatorToGeographic } from "@arcgis/core/geometry/support/webMercatorUtils";

const MapContext = createContext();

// Define your FEATURE_LAYERS and SYMBOLS here
const FEATURE_LAYERS = {
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
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/97",
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

export const MapProvider = ({ children }) => {
  const [mapView, setMapView] = useState(null);
  const [featureLayers, setFeatureLayers] = useState({});
  const [selectionGraphicsLayer, setSelectionGraphicsLayer] = useState(null);
  const [radiusGraphicsLayer, setRadiusGraphicsLayer] = useState(null);
  const [activeLayers, setActiveLayers] = useState([]);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [isMapSelectionActive, setIsMapSelectionActive] = useState(false);

  const formatLocationName = (feature, layerType) => {
    const attrs = feature.attributes;
    switch (layerType) {
      case "zip":
        return `${attrs.ZIP || ""} - ${attrs.PO_NAME || ""}`;
      case "county":
        return `${attrs.NAME} County, ${attrs.STATE_NAME || ""}`;
      case "tract":
        return `Tract ${attrs.TRACT}, ${attrs.COUNTY || ""} County, ${
          attrs.STATE_NAME || attrs.STATE || ""
        }`;
      case "block":
        return `Block ${attrs.BLOCK}, Tract ${attrs.TRACT}, ${attrs.COUNTY} County`;
      case "blockgroup":
        return `Block Group ${attrs.BLOCKGROUP_FIPS}, Tract ${attrs.TRACT_FIPS}, ${attrs.COUNTY_FIPS} County`;
      case "cbsa":
        return attrs.NAME || "";
      case "state":
        return attrs.STATE_NAME || "";
      case "place":
        return `${attrs.NAME}${attrs.LSADC ? ` (${attrs.LSADC})` : ""}`;
      case "usa":
        return attrs.NAME || "United States";
      default:
        return attrs.NAME || "";
    }
  };

  // Initialize graphics layers with dynamic import
  const initializeGraphicsLayers = useCallback(async () => {
    if (!mapView) return;

    try {
      const GraphicsLayerModule = await import(
        "@arcgis/core/layers/GraphicsLayer"
      );
      const GraphicsLayer = GraphicsLayerModule.default;

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

      // Add both layers to the map, ensuring radiusLayer is on top
      mapView.map.addMany([selectionLayer, radiusLayer]);
      setSelectionGraphicsLayer(selectionLayer);
      setRadiusGraphicsLayer(radiusLayer);
      console.log("[MapContext] Graphics layers initialized");
    } catch (error) {
      console.error("[MapContext] Error initializing GraphicsLayers:", error);
    }
  }, [mapView]);

  // Remove feature from selection with dynamic import
  const removeFromSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        `[MapContext] removeFromSelection called with feature:`,
        feature.attributes
      );

      if (!selectionGraphicsLayer) {
        console.warn(
          `[MapContext] Cannot remove from selection: selectionGraphicsLayer not initialized`
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

        console.log(
          `[MapContext] Unique ID field for layer ${layerType}: ${uniqueIdField}`
        );

        // Remove the graphic from selectionGraphicsLayer
        selectionGraphicsLayer.graphics.forEach((g) => {
          if (
            g.attributes[uniqueIdField] === feature.attributes[uniqueIdField]
          ) {
            selectionGraphicsLayer.remove(g);
            console.log(
              `[MapContext] Graphic removed from selectionGraphicsLayer for feature:`,
              feature.attributes
            );
          }
        });

        // Update selectedFeatures state
        setSelectedFeatures((prev) => {
          const newSelectedFeatures = prev.filter(
            (f) =>
              f.attributes[uniqueIdField] !== feature.attributes[uniqueIdField]
          );
          console.log(
            `[MapContext] Feature removed from selection:`,
            feature.attributes
          );
          return newSelectedFeatures;
        });
      } catch (error) {
        console.error("[MapContext] Error in removeFromSelection:", error);
      }
    },
    [selectionGraphicsLayer]
  );

  // Add feature to selection with dynamic import
  const addToSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        `[MapContext] addToSelection called with feature:`,
        feature.attributes
      );

      if (!selectionGraphicsLayer || !mapView) {
        console.warn(
          `[MapContext] Cannot add to selection: selectionGraphicsLayer or mapView not initialized`
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

        console.log(
          `[MapContext] Unique ID field for layer ${layerType}: ${uniqueIdField}`
        );

        // Ensure valid geometry
        const geometry = ensureValidGeometry(
          feature.geometry,
          mapView.spatialReference
        );
        if (!geometry) {
          console.warn(
            `[MapContext] Invalid geometry for feature:`,
            feature.attributes
          );
          return;
        }

        console.log(`[MapContext] Feature geometry type: ${geometry.type}`);

        // Dynamically import Graphic
        const GraphicModule = await import("@arcgis/core/Graphic");
        const Graphic = GraphicModule.default;

        // Determine symbol based on geometry type
        let symbol;
        switch (geometry.type.toLowerCase()) {
          case "point":
            symbol = SYMBOLS.selectedPoint;
            break;
          case "polyline":
            symbol = SYMBOLS.selectedPolyline;
            break;
          case "polygon":
            symbol = SYMBOLS.selectedPolygon;
            break;
          case "multipoint":
            symbol = SYMBOLS.selectedPoint;
            break;
          default:
            console.warn(
              `[MapContext] Unsupported geometry type for selection: ${geometry.type}`
            );
            return;
        }

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
          // Add the feature to selection
          const selectionGraphic = new Graphic({
            geometry,
            attributes: {
              ...feature.attributes,
              FEATURE_TYPE: layerType, // Ensure FEATURE_TYPE is set
            },
            symbol: symbol,
          });

          selectionGraphicsLayer.add(selectionGraphic);
          console.log(
            `[MapContext] Graphic added to selectionGraphicsLayer for feature:`,
            feature.attributes
          );

          // Update selectedFeatures state
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
    [selectionGraphicsLayer, mapView, selectedFeatures, removeFromSelection]
  );

  // Clear selection
  const clearSelection = useCallback(async () => {
    if (!selectionGraphicsLayer) return;
    try {
      selectionGraphicsLayer.removeAll();
      setSelectedFeatures([]);
      console.log("[MapContext] Selection cleared");
    } catch (error) {
      console.error("Error clearing selection:", error);
    }
  }, [selectionGraphicsLayer]);

  // Display features on the selection graphics layer with dynamic import
  const displayFeatures = useCallback(
    async (features) => {
      if (!selectionGraphicsLayer || !mapView) return;

      try {
        console.log(
          `Displaying ${
            features.length
          } features for layers: ${activeLayers.join(", ")}`
        );
        selectionGraphicsLayer.removeAll();

        const GraphicModule = await import("@arcgis/core/Graphic");
        const Graphic = GraphicModule.default;

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
            case "multipoint":
              symbol = SYMBOLS.defaultPoint;
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
          selectionGraphicsLayer.add(graphic);
        }
      } catch (error) {
        console.error("Error displaying features:", error);
      }
    },
    [selectionGraphicsLayer, activeLayers, mapView]
  );

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType) => {
      if (!selectionGraphicsLayer || !mapView) return;
  
      try {
        const [Graphic, geometryEngine] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/geometryEngine"),
        ]);
  
        // First completely remove all existing graphics for these market areas
        selectionGraphicsLayer.removeAll();
  
        // Group features by market area ID
        const featuresByMarketArea = features.reduce((acc, feature) => {
          const marketAreaId = feature.attributes.marketAreaId;
          if (!acc[marketAreaId]) acc[marketAreaId] = [];
          acc[marketAreaId].push(feature);
          return acc;
        }, {});
  
        // Process each market area's features
        for (const [marketAreaId, maFeatures] of Object.entries(featuresByMarketArea)) {
          const geometries = maFeatures.map(f => f.geometry);
          const unionGeometry = geometryEngine.union(geometries);
  
          if (unionGeometry) {
            const symbol = {
              type: "simple-fill",
              color: [...hexToRgb(styles.fill), styles.fillOpacity],
              outline: {
                color: styles.outline,
                width: styles.outlineWidth,
              },
            };
  
            const unionGraphic = new Graphic.default({
              geometry: unionGeometry,
              symbol: symbol,
              attributes: {
                marketAreaId,
                FEATURE_TYPE: featureType,
              },
            });
  
            selectionGraphicsLayer.add(unionGraphic);
          }
        }
      } catch (error) {
        console.error("Error updating feature styles:", error);
      }
    },
    [selectionGraphicsLayer, mapView]
  );

  // Similarly, update the drawRadius function to clear previous radius graphics
  const drawRadius = useCallback(
    async (point, style = null) => {
      if (!radiusGraphicsLayer || !point?.center || !mapView) return;

      try {
        // Clear existing radius graphics for this point
        radiusGraphicsLayer.removeAll();

        const center = ensureValidGeometry(
          point.center,
          mapView.spatialReference
        );
        if (!center) return;

        const centerPoint = webMercatorToGeographic(center);
        const radius = point.radius * 1609.34; // Convert miles to meters

        const [geometryEngine, Graphic] = await Promise.all([
          import("@arcgis/core/geometry/geometryEngine"),
          import("@arcgis/core/Graphic"),
        ]);

        // Create a buffer polygon around the center point
        const polygon = geometryEngine.geodesicBuffer(
          centerPoint,
          radius,
          "meters"
        );

        const fillRgb = style?.fillColor
          ? hexToRgb(style.fillColor)
          : [0, 123, 255];
        const outlineRgb = style?.borderColor
          ? hexToRgb(style.borderColor)
          : [0, 123, 255];

        const circleGraphic = new Graphic.default({
          geometry: polygon,
          attributes: {
            FEATURE_TYPE: "radius",
          },
          symbol: {
            type: "simple-fill",
            color: [...fillRgb, style?.fillOpacity || 0.3],
            outline: {
              color: [...outlineRgb, 1],
              width: style?.borderWidth || 2,
            },
          },
        });

        radiusGraphicsLayer.add(circleGraphic);
      } catch (error) {
        console.error("Error drawing radius:", error);
      }
    },
    [radiusGraphicsLayer, mapView]
  );

  // Initialize a feature layer with dynamic import
  const initializeFeatureLayer = useCallback(async (type) => {
    if (!type || !FEATURE_LAYERS[type]) {
      console.error(`Invalid or undefined layer type: ${type}`);
      return null;
    }

    const layerConfig = FEATURE_LAYERS[type];
    try {
      const FeatureLayerModule = await import(
        "@arcgis/core/layers/FeatureLayer"
      );
      const FeatureLayer = FeatureLayerModule.default;

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
        case "multipoint":
          symbol = SYMBOLS.defaultPoint;
          break;
        default:
          symbol = SYMBOLS.defaultPolygon;
          break;
      }

      const layer = new FeatureLayer({
        url: layerConfig.url,
        outFields: layerConfig.outFields,
        title: layerConfig.title,
        visible: false, // Initialize as hidden
        opacity: 1,
        popupEnabled: true,
        popupTemplate: layerConfig.popupTemplate,
        renderer: {
          type: "simple",
          symbol: symbol,
        },
      });

      layer.when(
        () => {
          console.log(`Layer ${type} loaded successfully`);
        },
        (error) => {
          console.error(`Error loading layer ${type}:`, error);
        }
      );

      return layer;
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
        // First, ensure all other layers are hidden
        Object.entries(featureLayers).forEach(([layerType, layer]) => {
          if (layer && !layer.destroyed && layerType !== type) {
            layer.visible = false;
            console.log(`[MapContext] Hiding layer ${layerType}`);
          }
        });

        let layer = featureLayers[type];

        // Initialize the layer if it doesn't exist
        if (!layer) {
          layer = await initializeFeatureLayer(type);
          if (layer) {
            await mapView.map.add(layer);
            setFeatureLayers((prev) => ({
              ...prev,
              [type]: layer,
            }));
            console.log(
              `[MapContext] New FeatureLayer for type ${type} added to the map.`
            );
          }
        }

        // Ensure the layer is visible and added to active layers
        if (layer && !layer.destroyed) {
          // Force layer visibility and wait for it to be ready
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
    [mapView, featureLayers, initializeFeatureLayer]
  );

  // Updated removeActiveLayer function
  const removeActiveLayer = useCallback(
    async (type) => {
      if (!mapView) {
        console.warn("Map view not initialized");
        return;
      }

      // If no type is specified, hide all feature layers but keep graphics
      if (!type) {
        Object.values(featureLayers).forEach((layer) => {
          if (layer && !layer.destroyed) {
            layer.visible = false;
            console.log(`[MapContext] FeatureLayer hidden: ${layer.title}`);
          }
        });
        setActiveLayers([]);
        console.log(`[MapContext] activeLayers cleared.`);
        return;
      }

      if (!FEATURE_LAYERS[type]) {
        console.error(`Invalid layer type: ${type}`);
        return;
      }

      setIsLayerLoading(true);

      try {
        // Hide the layer
        const layer = featureLayers[type];
        if (layer && !layer.destroyed) {
          layer.visible = false;
          console.log(`[MapContext] FeatureLayer ${type} set to hidden.`);
        }

        // Remove from activeLayers
        setActiveLayers((prev) => {
          console.log(`[MapContext] Removing layer ${type} from activeLayers.`);
          return prev.filter((l) => l !== type);
        });

        // Only remove graphics related to this layer type if specified
        if (selectionGraphicsLayer && type) {
          const remainingGraphics = selectionGraphicsLayer.graphics.filter(
            (g) => g.attributes?.FEATURE_TYPE !== type
          );
          selectionGraphicsLayer.removeAll();
          remainingGraphics.forEach((g) => selectionGraphicsLayer.add(g));
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
    [mapView, featureLayers, selectionGraphicsLayer]
  );

  // New function to hide all feature layers
  const hideAllFeatureLayers = useCallback(() => {
    console.log("[MapContext] Hiding all feature layers.");
    try {
      Object.entries(featureLayers).forEach(([type, layer]) => {
        if (layer && !layer.destroyed) {
          layer.visible = false;
          console.log(`[MapContext] FeatureLayer hidden: ${layer.title}`);
        }
      });
      setActiveLayers([]);
      console.log(`[MapContext] activeLayers cleared after hiding all layers.`);
    } catch (error) {
      console.error("[MapContext] Error hiding feature layers:", error);
    }
  }, [featureLayers]);

  // Query features
  const queryFeatures = useCallback(
    async (searchText) => {
      if (!activeLayers.length || !mapView) return [];

      const allFeatures = [];

      for (const type of activeLayers) {
        const layer = featureLayers[type];
        const layerConfig = FEATURE_LAYERS[type];

        if (!layer || !layerConfig) continue;

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
          const QueryModule = await import("@arcgis/core/rest/support/Query");
          const Query = QueryModule.default;

          const query = new Query({
            where: whereClause,
            outFields: ["*"],
            returnGeometry: true,
            geometry: mapView.extent,
            spatialRelationship: "intersects",
          });

          const results = await layer.queryFeatures(query);
          if (results.features.length > 0) {
            allFeatures.push(...results.features);
            console.log(
              `[MapContext] Query returned ${results.features.length} features for layer ${type}`
            );
          }
        } catch (error) {
          console.error(`Error querying features for layer ${type}:`, error);
        }
      }

      if (allFeatures.length > 0) {
        await displayFeatures(allFeatures);
        console.log(
          `[MapContext] Displayed ${allFeatures.length} features on the map.`
        );
      } else {
        console.log(`[MapContext] No features found for the query.`);
      }

      return allFeatures;
    },
    [activeLayers, featureLayers, mapView, displayFeatures]
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
    if (mapView && !selectionGraphicsLayer && !radiusGraphicsLayer) {
      initializeGraphicsLayers();
    }
  }, [
    mapView,
    selectionGraphicsLayer,
    radiusGraphicsLayer,
    initializeGraphicsLayers,
  ]);

  // Handle map clicks for selection
  useEffect(() => {
    if (!mapView) return;

    const handleMapClick = async (event) => {
      console.log(`[MapContext] Map clicked at:`, event.mapPoint);
      if (!isMapSelectionActive || !activeLayers.length) {
        console.log(
          `[MapContext] Map selection is not active or no active layers.`
        );
        return;
      }

      try {
        const hitResult = await mapView.hitTest(event);
        console.log(`[MapContext] hitTest result:`, hitResult);

        if (hitResult && hitResult.results.length > 0) {
          // Log all layer titles in the hitTest results
          hitResult.results.forEach((r) => {
            console.log(`[MapContext] hitTest Layer Title:`, r.layer.title);
          });

          // Find a graphic where the layer title matches the title defined in FEATURE_LAYERS for any active layer type
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
              `[MapContext] No matching graphic found in active layers.`
            );
          }
        } else {
          console.log(`[MapContext] No results from hitTest.`);
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

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      mapView,
      setMapView,
      activeLayers,
      toggleActiveLayerType,
      addActiveLayer,
      removeActiveLayer,
      hideAllFeatureLayers,
      isLayerLoading,
      queryFeatures,
      selectedFeatures,
      addToSelection,
      removeFromSelection,
      clearSelection,
      featureLayers,
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      // Optionally expose radiusGraphicsLayer if needed elsewhere
      radiusGraphicsLayer,
    }),
    [
      mapView,
      activeLayers,
      toggleActiveLayerType,
      addActiveLayer,
      removeActiveLayer,
      hideAllFeatureLayers,
      isLayerLoading,
      queryFeatures,
      selectedFeatures,
      addToSelection,
      removeFromSelection,
      clearSelection,
      featureLayers,
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      radiusGraphicsLayer,
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
