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
import { ensureValidGeometry } from "../utils";
import { webMercatorToGeographic } from "@arcgis/core/geometry/support/webMercatorUtils";

const MapContext = createContext();

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
      // Handle other layer types as needed
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

  // Initialize a feature layer
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

  // Remove feature from selection
  const removeFromSelection = useCallback(async (feature, layerType) => {
    console.log(
      `[MapContext] removeFromSelection called with feature:`,
      feature.attributes
    );

    if (!selectionGraphicsLayerRef.current) {
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

      // Remove the graphic from selectionGraphicsLayer
      selectionGraphicsLayerRef.current.graphics.forEach((g) => {
        if (g.attributes[uniqueIdField] === feature.attributes[uniqueIdField]) {
          selectionGraphicsLayerRef.current.remove(g);
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
  }, []);

  // Add feature to selection
  const addToSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        `[MapContext] addToSelection called with feature:`,
        feature.attributes
      );

      if (!selectionGraphicsLayerRef.current || !mapView) {
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

        // Dynamically import Graphic
        const { default: Graphic } = await import("@arcgis/core/Graphic");

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
              FEATURE_TYPE: layerType,
            },
            symbol: symbol,
          });

          selectionGraphicsLayerRef.current.add(selectionGraphic);
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
    [mapView, selectedFeatures, removeFromSelection]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    if (!selectionGraphicsLayerRef.current) return;
    try {
      selectionGraphicsLayerRef.current.removeAll();
      setSelectedFeatures([]);
      console.log("[MapContext] Selection cleared");
    } catch (error) {
      console.error("Error clearing selection:", error);
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

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType) => {
      if (!selectionGraphicsLayerRef.current || !mapView) {
        console.log("Selection layer or map view not initialized");
        return;
      }

      try {
        const [{ default: Graphic }, { default: Polygon }, geometryEngine] =
          await Promise.all([
            import("@arcgis/core/Graphic"),
            import("@arcgis/core/geometry/Polygon"),
            import("@arcgis/core/geometry/geometryEngine"),
          ]);

        // Group features by market area ID
        const featuresByMarketArea = features.reduce((acc, feature) => {
          const marketAreaId = feature.attributes?.marketAreaId || "default";
          if (!acc[marketAreaId]) acc[marketAreaId] = [];
          acc[marketAreaId].push(feature);
          return acc;
        }, {});

        // Clear existing graphics only for the market areas we're updating
        const marketAreaIds = new Set(Object.keys(featuresByMarketArea));
        const graphicsToKeep =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) => !marketAreaIds.has(g.attributes?.marketAreaId)
          );

        selectionGraphicsLayerRef.current.removeAll();
        graphicsToKeep.forEach((g) => selectionGraphicsLayerRef.current.add(g));

        // Sort market areas by order (if available)
        const sortedMarketAreaIds = Object.keys(featuresByMarketArea).sort(
          (a, b) => {
            const orderA = featuresByMarketArea[a][0]?.attributes?.order ?? 0;
            const orderB = featuresByMarketArea[b][0]?.attributes?.order ?? 0;
            return orderA - orderB;
          }
        );

        // Process each market area in order
        for (const marketAreaId of sortedMarketAreaIds) {
          const maFeatures = featuresByMarketArea[marketAreaId];

          try {
            // Create polygons for all features in this market area
            const polygons = maFeatures
              .map((feature) => {
                const rings =
                  feature.geometry?.rings ||
                  feature.geometry?.toJSON?.()?.rings ||
                  (feature.geometry?.type === "polygon"
                    ? feature.geometry.coordinates
                    : null);

                if (rings) {
                  return new Polygon({
                    rings: rings,
                    spatialReference: mapView.spatialReference,
                  });
                }
                return null;
              })
              .filter((p) => p !== null);

            if (polygons.length === 0) continue;

            // Find separate, non-contiguous sections using geometryEngine
            let sections = [];
            let remainingPolygons = [...polygons];

            while (remainingPolygons.length > 0) {
              let currentSection = remainingPolygons[0];
              remainingPolygons = remainingPolygons.slice(1);

              let foundIntersection;
              do {
                foundIntersection = false;
                for (let i = remainingPolygons.length - 1; i >= 0; i--) {
                  const testPolygon = remainingPolygons[i];
                  if (geometryEngine.intersects(currentSection, testPolygon)) {
                    currentSection = geometryEngine.union([
                      currentSection,
                      testPolygon,
                    ]);
                    remainingPolygons.splice(i, 1);
                    foundIntersection = true;
                  }
                }
              } while (foundIntersection);

              sections.push(currentSection);
            }

            // Create graphics for each section with z-index based on order
            sections.forEach((section, index) => {
              const order = maFeatures[0]?.attributes?.order ?? 0;

              // Create the fill graphic (no border)
              const fillGraphic = new Graphic({
                geometry: section,
                symbol: {
                  type: "simple-fill",
                  color: [...hexToRgb(styles.fill), styles.fillOpacity],
                  outline: {
                    color: [0, 0, 0, 0],
                    width: 0,
                  },
                },
                attributes: {
                  marketAreaId,
                  FEATURE_TYPE: featureType,
                  sectionIndex: index,
                  order, // Include order in attributes
                },
              });

              // Create the border graphic (no fill)
              if (styles.outlineWidth !== -1) {
                const borderGraphic = new Graphic({
                  geometry: section,
                  symbol: {
                    type: "simple-line",
                    color: styles.outline,
                    width: styles.outlineWidth,
                    style: "solid",
                  },
                  attributes: {
                    marketAreaId,
                    FEATURE_TYPE: featureType,
                    sectionIndex: index,
                    order, // Include order in attributes
                    isBorder: true,
                  },
                });

                // Add graphics with higher order (top of list) appearing on top
                selectionGraphicsLayerRef.current.add(borderGraphic);
              }

              selectionGraphicsLayerRef.current.add(fillGraphic);
            });
          } catch (error) {
            console.error(
              `Error processing market area ${marketAreaId}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error("Error in updateFeatureStyles:", error);
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

  // Draw radius
  const drawRadius = useCallback(
    async (point, style = null) => {
      if (!radiusGraphicsLayerRef.current || !point?.center || !mapView) return;

      try {
        // Clear existing radius graphics for this point
        radiusGraphicsLayerRef.current.removeAll();

        const center = ensureValidGeometry(
          point.center,
          mapView.spatialReference
        );
        if (!center) return;
        const centerPoint = webMercatorToGeographic(center);
        const radius = point.radius * 1609.34; // Convert miles to meters

        const [{ default: geometryEngine }, { default: Graphic }] =
          await Promise.all([
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

        const circleGraphic = new Graphic({
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

        radiusGraphicsLayerRef.current.add(circleGraphic);
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

      if (!type) {
        Object.values(featureLayersRef.current).forEach((layer) => {
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
        const layer = featureLayersRef.current[type];
        if (layer && !layer.destroyed) {
          layer.visible = false;
          console.log(`[MapContext] FeatureLayer ${type} set to hidden.`);
        }

        setActiveLayers((prev) => {
          console.log(`[MapContext] Removing layer ${type} from activeLayers.`);
          return prev.filter((l) => l !== type);
        });

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

  // Hide all feature layers
  const hideAllFeatureLayers = useCallback(() => {
    console.log("[MapContext] Hiding all feature layers.");
    try {
      Object.entries(featureLayersRef.current).forEach(([type, layer]) => {
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
  }, []);

  // Query features
  const queryFeatures = useCallback(
    async (searchText) => {
      if (!activeLayers.length || !mapView) return [];

      const allFeatures = [];

      for (const type of activeLayers) {
        const layer = featureLayersRef.current[type];
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
          const { default: Query } = await import(
            "@arcgis/core/rest/support/Query"
          );

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
          hitResult.results.forEach((r) => {
            console.log(`[MapContext] hitTest Layer Title:`, r.layer.title);
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

  useEffect(() => {
    const showVisibleMarketAreas = async () => {
      if (!marketAreas.length) return;

      // Clear all market areas first
      hideAllFeatureLayers();

      // Sort market areas by order field to control rendering order
      const sortedAreas = [...marketAreas].sort((a, b) => a.order - b.order);

      // Now render each market area
      for (const marketArea of sortedAreas) {
        if (!visibleMarketAreaIds.includes(marketArea.id)) continue;

        if (marketArea.ma_type === "radius" && marketArea.radius_points) {
          for (const point of marketArea.radius_points) {
            await drawRadius(point, marketArea.style_settings);
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
    };

    showVisibleMarketAreas();
  }, [
    marketAreas,
    visibleMarketAreaIds,
    hideAllFeatureLayers,
    drawRadius,
    updateFeatureStyles,
  ]);

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
      featureLayers: featureLayersRef.current,
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      radiusGraphicsLayer: radiusGraphicsLayerRef.current,
      visibleMarketAreaIds,
      setVisibleMarketAreaIds,
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
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      visibleMarketAreaIds,
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
