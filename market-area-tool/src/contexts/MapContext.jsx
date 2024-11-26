// src/contexts/MapContext.jsx

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ensureValidGeometry } from '../utils'; // Ensure this utility is correctly implemented
import { webMercatorToGeographic } from "@arcgis/core/geometry/support/webMercatorUtils"; // Imported correctly

const MapContext = createContext();

// Define your FEATURE_LAYERS and SYMBOLS here
const FEATURE_LAYERS = {
  zip: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_ZIP_Codes/FeatureServer/0",
    outFields: ["ZIP", "PO_NAME"],
    uniqueIdField: "OBJECTID",
    title: "ZIP Codes",
    geometryType: "polygon",
    popupTemplate: {
      title: "ZIP Code: {ZIP}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "ZIP", label: "ZIP Code" },
            { fieldName: "PO_NAME", label: "Post Office Name" }
          ]
        }
      ]
    }
  },
  county: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties/FeatureServer/0",
    outFields: ["NAME", "STATE_NAME"],
    uniqueIdField: "OBJECTID",
    title: "Counties",
    geometryType: "polygon",
    popupTemplate: {
      title: "{NAME} County",
      content: [{
        type: "fields",
        fieldInfos: [
          { fieldName: "NAME", label: "County Name" },
          { fieldName: "STATE_NAME", label: "State" }
        ]
      }]
    }
  },
  tract: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Tracts/FeatureServer/0",
    outFields: ["OBJECTID", "TRACT", "STATE_FIPS", "CNTY_FIPS"],
    uniqueIdField: "OBJECTID",
    title: "Census Tracts",
    geometryType: "polygon",
    popupTemplate: {
      title: "Census Tract {TRACT}",
      content: [{
        type: "fields",
        fieldInfos: [
          { fieldName: "TRACT", label: "Tract" },
          { fieldName: "CNTY_FIPS", label: "County" },
          { fieldName: "STATE_FIPS", label: "State" }
        ]
      }]
    }
  },
  block: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/14",
    outFields: ["GEOID", "BLOCK", "TRACT", "COUNTY", "STATE"],
    uniqueIdField: "GEOID",
    title: "Census Blocks",
    geometryType: "polygon",
    popupTemplate: {
      title: "Block {BLOCK}",
      content: [{
        type: "fields",
        fieldInfos: [
          { fieldName: "BLOCK", label: "Block" },
          { fieldName: "TRACT", label: "Tract" },
          { fieldName: "COUNTY", label: "County" },
          { fieldName: "STATE", label: "State" }
        ]
      }]
    }
  },
  streetsSample: { 
    url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/2",
    outFields: ["STATE_NAME", "SUB_REGION"],
    uniqueIdField: "FID",
    title: "USA Roads (Sample)",
    geometryType: "polyline",
    popupTemplate: {
      title: "{STATE_NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "STATE_NAME", label: "State Name" },
            { fieldName: "SUB_REGION", label: "Sub Region" }
          ]
        }
      ]
    }
  }
  // ... any additional layers ...
};

const SYMBOLS = {
  defaultPolygon: {
    type: "simple-fill",
    color: [0, 0, 0, 0],
    outline: {
      color: [128, 128, 128, 1],
      width: 1
    }
  },
  selectedPolygon: {
    type: "simple-fill",
    color: [0, 123, 255, 0.3],
    outline: {
      color: [0, 123, 255, 1],
      width: 2
    }
  },
  defaultPolyline: {
    type: "simple-line",
    color: [128, 128, 128, 1],
    width: 1
  },
  selectedPolyline: {
    type: "simple-line",
    color: [0, 123, 255, 1],
    width: 2
  },
  defaultPoint: {
    type: "simple-marker",
    color: [0, 123, 255, 0.5],
    outline: {
      color: [0, 123, 255, 1],
      width: 1
    }
  },
  selectedPoint: {
    type: "simple-marker",
    color: [0, 123, 255, 0.7],
    outline: {
      color: [0, 123, 255, 1],
      width: 2
    }
  }
};

// Helper function for converting hex to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMap must be used within a MapProvider");
  return context;
};

export const MapProvider = ({ children }) => {
  const [mapView, setMapView] = useState(null);
  const [featureLayers, setFeatureLayers] = useState({});
  const [graphicsLayer, setGraphicsLayer] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const activeWatchHandle = useRef(null);
  const [layerInitializationQueue, setLayerInitializationQueue] = useState(new Set());

  // Initialize graphics layer with dynamic import
  const initializeGraphicsLayer = useCallback(async () => {
    if (!mapView) return;

    try {
      const GraphicsLayerModule = await import('@arcgis/core/layers/GraphicsLayer');
      const GraphicsLayer = GraphicsLayerModule.default;

      const layer = new GraphicsLayer({
        title: "Selection Graphics",
        listMode: "hide",
        elevationInfo: {
          mode: "relative-to-ground",
          offset: 1
        }
      });

      mapView.map.add(layer);
      setGraphicsLayer(layer);
      console.log("[MapContext] Graphics layer initialized");
    } catch (error) {
      console.error("[MapContext] Error initializing GraphicsLayer:", error);
    }
  }, [mapView]);

  // Add feature to selection with dynamic import
  const addToSelection = useCallback(async (feature) => {
    if (!graphicsLayer || !mapView) return;

    try {
      const currentLayerConfig = FEATURE_LAYERS[activeLayer];
      if (!currentLayerConfig) {
        console.error(`Active layer configuration not found for layer type: ${activeLayer}`);
        return;
      }
      const uniqueIdField = currentLayerConfig.uniqueIdField;

      // Check if feature is already selected
      const isAlreadySelected = selectedFeatures.some(f => f.attributes[uniqueIdField] === feature.attributes[uniqueIdField]);
      if (isAlreadySelected) return;

      // Ensure valid geometry
      const geometry = ensureValidGeometry(feature.geometry, mapView.spatialReference);
      if (!geometry) return;

      // Dynamically import Graphic
      const GraphicModule = await import('@arcgis/core/Graphic');
      const Graphic = GraphicModule.default;

      // Determine symbol based on geometry type
      let symbol;
      switch (geometry.type.toLowerCase()) {
        case 'point':
          symbol = SYMBOLS.selectedPoint;
          break;
        case 'polyline':
          symbol = SYMBOLS.selectedPolyline;
          break;
        case 'polygon':
          symbol = SYMBOLS.selectedPolygon;
          break;
        case 'multipoint':
          symbol = SYMBOLS.selectedPoint;
          break;
        default:
          console.warn(`Unsupported geometry type for selection: ${geometry.type}`);
          return;
      }

      // Create a new graphic with selection symbol
      const selectionGraphic = new Graphic({
        geometry,
        attributes: feature.attributes,
        symbol: symbol
      });

      graphicsLayer.add(selectionGraphic);
      setSelectedFeatures(prev => [...prev, feature]);
      console.log(`[MapContext] Feature added to selection: ${uniqueIdField} = ${feature.attributes[uniqueIdField]}`);
    } catch (error) {
      console.error('Error adding to selection:', error);
    }
  }, [graphicsLayer, activeLayer, selectedFeatures, mapView]);

  // Remove feature from selection with dynamic import
  const removeFromSelection = useCallback(async (feature) => {
    if (!graphicsLayer) return;

    try {
      const currentLayerConfig = FEATURE_LAYERS[activeLayer];
      if (!currentLayerConfig) {
        console.error(`Active layer configuration not found for layer type: ${activeLayer}`);
        return;
      }
      const uniqueIdField = currentLayerConfig.uniqueIdField;

      const graphics = graphicsLayer.graphics.filter(g => 
        g.attributes[uniqueIdField] !== feature.attributes[uniqueIdField]
      );
      graphicsLayer.removeAll();
      graphics.forEach(g => graphicsLayer.add(g));

      setSelectedFeatures(prev => 
        prev.filter(f => f.attributes[uniqueIdField] !== feature.attributes[uniqueIdField])
      );
      console.log(`[MapContext] Feature removed from selection: ${uniqueIdField} = ${feature.attributes[uniqueIdField]}`);
    } catch (error) {
      console.error('Error removing from selection:', error);
    }
  }, [graphicsLayer, activeLayer]);

  // Clear selection
  const clearSelection = useCallback(async () => {
    if (!graphicsLayer) return;
    try {
      graphicsLayer.removeAll();
      setSelectedFeatures([]);
      console.log("[MapContext] Selection cleared");
    } catch (error) {
      console.error('Error clearing selection:', error);
    }
  }, [graphicsLayer]);

  // Display features on the graphics layer with dynamic import
  const displayFeatures = useCallback(async (features) => {
    if (!graphicsLayer) return;

    try {
      console.log(`Displaying ${features.length} features for layer: ${activeLayer}`);
      graphicsLayer.removeAll();

      const currentLayerConfig = FEATURE_LAYERS[activeLayer];
      if (!currentLayerConfig) {
        console.error(`Active layer configuration not found for layer type: ${activeLayer}`);
        return;
      }
      const uniqueIdField = currentLayerConfig.uniqueIdField;

      // Dynamically import Graphic
      const GraphicModule = await import('@arcgis/core/Graphic');
      const Graphic = GraphicModule.default;

      for (const feature of features) {
        console.log('Processing feature:', feature);
        const geometry = ensureValidGeometry(feature.geometry, mapView.spatialReference);
        if (!geometry) continue;

        // Determine symbol based on geometry type
        let symbol;
        switch (geometry.type.toLowerCase()) {
          case 'point':
            symbol = SYMBOLS.defaultPoint;
            break;
          case 'polyline':
            symbol = SYMBOLS.defaultPolyline;
            break;
          case 'polygon':
            symbol = SYMBOLS.defaultPolygon;
            break;
          case 'multipoint':
            symbol = SYMBOLS.defaultPoint;
            break;
          default:
            console.warn(`Unsupported geometry type for display: ${geometry.type}`);
            continue;
        }

        const graphic = new Graphic({
          geometry,
          attributes: feature.attributes,
          symbol: symbol
        });
        graphicsLayer.add(graphic);
      }
      console.log("[MapContext] Features displayed on graphics layer");
    } catch (error) {
      console.error('Error displaying features:', error);
    }
  }, [graphicsLayer, activeLayer, mapView]);

  // Update feature styles function with dynamic import
  const updateFeatureStyles = useCallback(async (features, styles) => {
    if (!graphicsLayer || !features.length || !mapView) return;

    try {
      graphicsLayer.removeAll();

      const fillRgb = hexToRgb(styles.fill);
      const outlineRgb = hexToRgb(styles.outline);

      // Dynamically import Graphic
      const GraphicModule = await import('@arcgis/core/Graphic');
      const Graphic = GraphicModule.default;

      for (const feature of features) {
        const geometry = ensureValidGeometry(feature.geometry, mapView.spatialReference);
        if (!geometry) continue;

        let symbol;

        switch (geometry.type.toLowerCase()) {
          case 'point':
            symbol = {
              type: "simple-marker",
              color: [...fillRgb, styles.fillOpacity],
              outline: {
                color: [...outlineRgb, 1],
                width: styles.outlineWidth
              }
            };
            break;
          case 'polyline':
            symbol = {
              type: "simple-line",
              color: [...outlineRgb, 1],
              width: styles.outlineWidth
            };
            break;
          case 'polygon':
            symbol = {
              type: "simple-fill",
              color: [...fillRgb, styles.fillOpacity],
              outline: {
                color: [...outlineRgb, 1],
                width: styles.outlineWidth
              }
            };
            break;
          case 'multipoint':
            symbol = {
              type: "simple-marker",
              color: [...fillRgb, styles.fillOpacity],
              outline: {
                color: [...outlineRgb, 1],
                width: styles.outlineWidth
              }
            };
            break;
          default:
            console.warn(`Unsupported geometry type for styling: ${geometry.type}`);
            continue;
        }

        const graphic = new Graphic({
          geometry,
          attributes: feature.attributes || { id: feature.id },
          symbol
        });

        graphicsLayer.add(graphic);
      }
      console.log("[MapContext] Feature styles updated");
    } catch (error) {
      console.error('Error updating feature styles:', error);
    }
  }, [graphicsLayer, mapView]);

  // Draw radius around a point with dynamic import
  const drawRadius = useCallback(async (point, style = null) => {
    if (!graphicsLayer || !point?.center || !mapView) return;

    try {
      // Ensure valid center point
      const center = ensureValidGeometry(point.center, mapView.spatialReference);
      if (!center) return;

      const centerPoint = webMercatorToGeographic(center);
      const radius = point.radius * 1609.34; // Convert miles to meters

      // Dynamically import Circle and Graphic
      const CircleModule = await import('@arcgis/core/geometry/Circle');
      const Circle = CircleModule.default;
      const GraphicModule = await import('@arcgis/core/Graphic');
      const Graphic = GraphicModule.default;

      const circle = new Circle({
        center: centerPoint,
        geodesic: true,
        radius: radius,
        radiusUnit: "meters",
        spatialReference: mapView.spatialReference
      });

      const fillRgb = style?.fillColor ? hexToRgb(style.fillColor) : [0, 123, 255];
      const outlineRgb = style?.borderColor ? hexToRgb(style.borderColor) : [0, 123, 255];

      const circleGraphic = new Graphic({
        geometry: circle,
        symbol: {
          type: "simple-fill",
          color: [...fillRgb, style?.fillOpacity || 0.3],
          outline: {
            color: [...outlineRgb, 1],
            width: style?.borderWidth || 2
          }
        }
      });

      graphicsLayer.add(circleGraphic);
      console.log("[MapContext] Radius drawn on map");
    } catch (error) {
      console.error('Error drawing radius:', error);
    }
  }, [graphicsLayer, mapView]);

  // Initialize a feature layer with dynamic import
  const initializeFeatureLayer = useCallback(async (type) => {
    if (!FEATURE_LAYERS[type]) {
      console.error(`Invalid layer type: ${type}`);
      return null;
    }

    const layerConfig = FEATURE_LAYERS[type];

    // Check if the URL is a FeatureServer endpoint
    const isFeatureService = layerConfig.url.toLowerCase().includes('/featureserver/');
    if (!isFeatureService) {
      console.warn(`Layer type ${type} does not point to a FeatureServer. It may not support queries.`);
    }

    try {
      // Dynamically import FeatureLayer
      const FeatureLayerModule = await import('@arcgis/core/layers/FeatureLayer');
      const FeatureLayer = FeatureLayerModule.default;

      // Determine symbol based on geometry type
      let symbol;
      switch (layerConfig.geometryType.toLowerCase()) {
        case 'point':
          symbol = SYMBOLS.defaultPoint;
          break;
        case 'polyline':
          symbol = SYMBOLS.defaultPolyline;
          break;
        case 'polygon':
          symbol = SYMBOLS.defaultPolygon;
          break;
        case 'multipoint':
          symbol = SYMBOLS.defaultPoint;
          break;
        default:
          symbol = SYMBOLS.defaultPolygon;
          console.warn(`Unsupported geometry type: ${layerConfig.geometryType}. Using default polygon symbol.`);
          break;
      }

      const layer = new FeatureLayer({
        url: layerConfig.url,
        outFields: layerConfig.outFields,
        title: layerConfig.title,
        visible: true,
        opacity: 1,
        popupEnabled: true,
        popupTemplate: layerConfig.popupTemplate,
        renderer: {
          type: "simple",
          symbol: symbol
        }
      });

      // Add layer load handlers
      layer.when(() => {
        console.log(`Layer ${type} loaded successfully`);
      }, (error) => {
        console.error(`Error loading layer ${type}:`, error);
        // Optionally, set a flag or state to indicate layer load failure
      });

      return layer;
    } catch (error) {
      console.error(`Error initializing FeatureLayer for type ${type}:`, error);
      return null;
    }
  }, []);

  // Function to set active layer type without zoom logic
  const setActiveLayerTypeFunc = useCallback(
    async (type) => {
      try {
        if (!mapView) {
          console.warn("Map view not initialized");
          return;
        }

        setIsLayerLoading(true);
        console.log(`[MapContext] Setting active layer to: ${type}`);

        // Store current view state
        const currentExtent = mapView.extent.clone();
        const currentCenter = mapView.center.clone();
        const currentZoom = mapView.zoom;

        // Clear graphics and selections
        if (graphicsLayer) {
          graphicsLayer.removeAll();
          console.log("[MapContext] Graphics layer cleared");
        }
        setSelectedFeatures([]);
        console.log("[MapContext] Selected features cleared");

        // Hide all current feature layers
        Object.entries(featureLayers).forEach(([layerType, layers]) => {
          if (Array.isArray(layers)) {
            layers.forEach(layer => {
              if (layer && !layer.destroyed) {
                layer.visible = false;
                console.log(`[MapContext] Layer ${layerType} hidden`);
              }
            });
          } else if (layers && !layers.destroyed) {
            layers.visible = false;
            console.log(`[MapContext] Layer ${layerType} hidden`);
          }
        });

        if (!type) {
          setActiveLayer(null);
          console.log("[MapContext] Active layer cleared");
          return;
        }

        // Initialize or show layers with proper error handling
        const initializeOrShowLayer = async () => {
          if (layerInitializationQueue.has(type)) {
            console.log(`Layer ${type} is already being initialized`);
            return;
          }

          try {
            setLayerInitializationQueue(prev => new Set([...prev, type]));
            console.log(`[MapContext] Initializing layer: ${type}`);

            if (!featureLayers[type]) {
              const newLayer = await initializeFeatureLayer(type);

              if (newLayer) {
                // Check if the layer is already in the map
                const existingLayer = mapView.map.layers.find(l => l.url === newLayer.url);
                if (!existingLayer) {
                  await mapView.map.add(newLayer);
                  console.log(`[MapContext] Layer ${type} added to map`);
                } else {
                  console.log(`[MapContext] Layer ${type} already exists in map`);
                }

                // Dynamically import Graphic for event listener
                const GraphicModule = await import('@arcgis/core/Graphic');
                const Graphic = GraphicModule.default;

                // Add click event listener
                newLayer.on("click", (event) => {
                  event.stopPropagation();
                  if (event.graphic) {
                    addToSelection(event.graphic);
                  }
                });
                console.log(`[MapContext] Click event listener added to layer ${type}`);

                setFeatureLayers(prev => ({
                  ...prev,
                  [type]: newLayer
                }));
              }
            } else {
              // Show existing layer
              const layer = featureLayers[type];
              if (layer && !layer.destroyed) {
                layer.visible = true;
                console.log(`[MapContext] Layer ${type} made visible`);
              }
            }
          } catch (error) {
            console.error(`Error initializing or showing layer ${type}:`, error);
          } finally {
            setLayerInitializationQueue(prev => {
              const newQueue = new Set(prev);
              newQueue.delete(type);
              return newQueue;
            });
          }
        };

        await initializeOrShowLayer();

        // Restore view state
        try {
          await mapView.goTo(
            {
              target: currentCenter,
              zoom: currentZoom,
              extent: currentExtent
            },
            {
              duration: 500,
              easing: "ease-out"
            }
          ).catch(() => {
            console.log("View update handled gracefully");
          });
          console.log("[MapContext] View state restored");
        } catch (error) {
          console.log("View navigation handled:", error);
        }

        setActiveLayer(type);
        console.log(`[MapContext] Active layer set to: ${type}`);

      } catch (error) {
        console.error("Error setting active layer:", error);
        // Optionally handle errors related to setting active layer
      } finally {
        setIsLayerLoading(false);
        console.log(`[MapContext] Layer loading state set to: ${isLayerLoading}`);
      }
    },
    [
      mapView,
      activeLayer,
      featureLayers,
      graphicsLayer,
      initializeFeatureLayer,
      addToSelection,
      activeWatchHandle,
      layerInitializationQueue
    ]
  );

  // Query features with dynamic import
  const queryFeatures = useCallback(async (searchText) => {
    if (!activeLayer || !featureLayers[activeLayer]) return [];

    if (!mapView) {
      console.error("Map view not initialized");
      return [];
    }

    const layer = featureLayers[activeLayer];
    const layerConfig = FEATURE_LAYERS[activeLayer];
    const uniqueIdField = layerConfig.uniqueIdField;
    let whereClause;

    switch (activeLayer) {
      case 'zip':
        whereClause = /^\d+$/.test(searchText) 
          ? `ZIP LIKE '${searchText}%'` 
          : `PO_NAME LIKE '%${searchText}%'`;
        break;
      case 'county':
        whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%') OR UPPER(STATE_NAME) LIKE UPPER('%${searchText}%')`;
        break;
      case 'streetsSample':
        whereClause = `UPPER(STATE_NAME) LIKE UPPER('%${searchText}%') OR UPPER(SUB_REGION) LIKE UPPER('%${searchText}%')`;
        break;
      default:
        whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
    }

    console.log(`Querying ${activeLayer} with where clause:`, whereClause);

    try {
      // Dynamically import Query
      const QueryModule = await import('@arcgis/core/rest/support/Query');
      const Query = QueryModule.default;

      const query = new Query({
        where: whereClause,
        outFields: ["*"],
        returnGeometry: true,
        geometry: mapView.extent, // mapView is confirmed to be initialized
        spatialRelationship: "intersects"
      });

      const results = await layer.queryFeatures(query);
      console.log(`Query returned ${results.features.length} features`);

      if (results.features.length > 0) {
        await displayFeatures(results.features);
      }

      return results.features;
    } catch (error) {
      console.error('Error querying features:', error);
      return [];
    }
  }, [activeLayer, featureLayers, mapView, displayFeatures]);

  // Initialize graphics layer when mapView is set
  useEffect(() => {
    if (mapView && !graphicsLayer) {
      console.log("[MapContext] Initializing graphics layer");
      initializeGraphicsLayer();
    }
  }, [mapView, graphicsLayer, initializeGraphicsLayer]);

  // Update the context value
  const value = {
    mapView,
    setMapView, // Ensure this is correctly called in your Map.jsx
    activeLayer,
    setActiveLayerType: setActiveLayerTypeFunc,
    isLayerLoading,
    queryFeatures,
    selectedFeatures,
    addToSelection,
    removeFromSelection,
    clearSelection,
    featureLayers,
    updateFeatureStyles,
    drawRadius,
    // Removed zoomMessage and isOutsideZoomRange from context
  };

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
};

export default MapContext;
