import {
  geodesicBuffer,
  simplify,
  union,
} from "@arcgis/core/geometry/geometryEngine";
import { toast } from "react-hot-toast";
import { updateMarketArea } from "@/services/api"; // adjust import path
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
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/82",
    layerId: 82,
    outFields: ["OBJECTID", "GEOID", "STATE", "COUNTY", "NAME", "BASENAME", "COUNTYCC", "MTFCC"],
    uniqueIdField: "OBJECTID",
    title: "Counties",
    geometryType: "polygon",
    definitionExpression: "MTFCC = 'G4020' AND COUNTYCC = 'H1'",
    popupTemplate: {
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "County Name" },
            { fieldName: "BASENAME", label: "Base Name" },
            { fieldName: "STATE", label: "State" },
            { fieldName: "GEOID", label: "GEOID" },
          ],
        },
      ],
    },
    minScale: 12000000,
    maxScale: 100
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
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/80",
    outFields: [
      "OBJECTID",
      "GEOID",
      "STATE",
      "NAME",
      "BASENAME",
      "STUSAB",
      "REGION",
      "DIVISION",
    ],
    uniqueIdField: "OBJECTID",
    title: "States",
    geometryType: "polygon",
    popupTemplate: {
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "State Name" },
            { fieldName: "STUSAB", label: "State Abbreviation" },
            { fieldName: "REGION", label: "Region" },
            { fieldName: "DIVISION", label: "Division" },
            { fieldName: "GEOID", label: "GEOID" },
          ],
        },
      ],
    },
    minScale: 591657527.591555,
    maxScale: 100,
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
  const [editingMarketArea, setEditingMarketArea] = useState(null);

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

  const STATE_ABBR_BY_FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
    "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
    "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
    "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY"
  };
  
  const STATE_NAME_BY_FIPS = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
    "08": "Colorado", "09": "Connecticut", "10": "Delaware", "11": "District of Columbia",
    "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
    "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana",
    "23": "Maine", "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
    "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York", "37": "North Carolina",
    "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania",
    "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota", "47": "Tennessee",
    "48": "Texas", "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
    "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming"
  };
  
  // Map LSADC codes to their corresponding place type
  const LSADC_TO_PLACETYPE = {
    "21": "Borough",
    "25": "City",
    "43": "Town",
    "47": "Village"
  };
  
  const formatLocationName = useCallback((feature, layerType) => {
    const attrs = feature.attributes;
    switch (layerType) {
      case "zip": {
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
      }
      case "county": {
        let countyName = attrs.NAME || "";
        const stateFips = attrs.STATE || "";
        const stateAbbr = STATE_NAME_BY_FIPS[stateFips] ? STATE_NAME_BY_FIPS[stateFips] : "";
        
        // Remove trailing ", number"
        countyName = countyName.replace(/,\s*\d+$/, "").trim();
        return stateAbbr ? `${countyName} County, ${stateAbbr}` : countyName;
      }
      case "tract":
        return `Tract ${attrs.TRACT_FIPS || attrs.TRACT || ""}`;
      case "block":
        return `Block ${attrs.BLOCK || ""}`;
      case "blockgroup":
        return `Block Group ${attrs.BLOCKGROUP_FIPS || ""}`;
      case "place": {
        const placeName = attrs.NAME || attrs.BASENAME || "";
        const stateFips = attrs.STATE || "";
        const stateName = STATE_NAME_BY_FIPS[stateFips] || "";
        const lsadcCode = attrs.LSADC || "";
        
        // Determine place type from LSADC code
        const placeType = LSADC_TO_PLACETYPE[lsadcCode] || "";
  
        // Remove any generic place descriptors from the placeName to avoid duplication.
        // This removes words like "city", "village", "borough", "town" if they appear at word boundaries.
        let cleanPlaceName = placeName.replace(/\b(city|village|borough|town)\b/i, "").trim();
        // If we end up with extra spaces or trailing commas after removal, clean them up
        cleanPlaceName = cleanPlaceName.replace(/,\s*$/, "").trim();
  
        if (cleanPlaceName && stateName && placeType) {
          return `${cleanPlaceName}, ${placeType}, ${stateName}`;
        } else if (cleanPlaceName && stateName) {
          return `${cleanPlaceName}, ${stateName}`;
        } else {
          return cleanPlaceName;
        }
      }
      case "state":
        return attrs.NAME || "";
      case "cbsa":
        return attrs.NAME || attrs.BASENAME || "";
      case "usa":
        return "United States";
      case "md":
        return attrs.BASENAME || attrs.NAME || "";
      default:
        return attrs.NAME || "";
    }
  }, []);
  

  const [layersReady, setLayersReady] = useState(false);


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
  
      // Update refs inside try block
      selectionGraphicsLayerRef.current = selectionLayer;
      radiusGraphicsLayerRef.current = radiusLayer;
  
      console.log("[MapContext] Graphics layers initialized");
    } catch (error) {
      console.error("[MapContext] Error initializing GraphicsLayers:", error);
    }
  
    // Do not reference selectionLayer or radiusLayer here
    // since they are defined inside try block.
  
    setLayersReady(true); 
  }, [mapView]);

  // Helper function to get label configuration based on layer type
  const getLabelingInfo = (type) => {
    let label;
    switch (type) {
      case "zip":
        label = {
          field: "ZIP",
          expressionInfo: {
            expression: "$feature.ZIP", // Direct reference to ZIP field
          },
        };
        break;
      case "county":
        label = {
          field: "NAME",
          expressionInfo: {
            expression: "$feature.NAME + ' County'",
          },
        };
        break;
      case "tract":
        label = {
          field: "TRACT_FIPS",
          expressionInfo: {
            expression: "$feature.TRACT_FIPS",
          },
        };
        break;
      case "block":
        label = {
          field: "BLOCK",
          expressionInfo: {
            expression: "$feature.BLOCK",
          },
        };
        break;
      case "blockgroup":
        label = {
          field: "BLOCKGROUP_FIPS",
          expressionInfo: {
            expression: "'Block Group ' + $feature.BLOCKGROUP_FIPS",
          },
        };
        break;
      case "place":
        label = {
          field: "NAME",
          expressionInfo: {
            expression: "$feature.NAME",
          },
        };
        break;
      case "state":
        label = {
          field: "STATE_NAME",
          expressionInfo: {
            expression: "$feature.STATE_NAME",
          },
        };
        break;
      case "cbsa":
        label = {
          field: "NAME",
          expressionInfo: {
            expression: "$feature.NAME",
          },
        };
        break;
      case "md":
        label = {
          field: "BASENAME",
          expressionInfo: {
            expression: "$feature.BASENAME",
          },
        };
        break;
      case "usa":
        label = {
          field: "STATE_NAME",
          expressionInfo: {
            expression: "'United States'",
          },
        };
        break;
      default:
        return undefined;
    }

    return [
      {
        labelPlacement: "always-horizontal",
        symbol: {
          type: "text",
          color: [0, 0, 0, 1], // Pure black
          haloColor: [255, 255, 255, 1],
          haloSize: 2,
          font: {
            size: 14, // Increased font size
            family: "Noto Sans",
            weight: "bold", // Made text bold
          },
        },
        minScale:
          type === "state" || type === "usa"
            ? 20000000
            : type === "cbsa" || type === "md"
            ? 5000000
            : type === "county"
            ? 2000000
            : type === "place"
            ? 1000000
            : type === "zip"
            ? 300000
            : type === "tract"
            ? 100000
            : type === "blockgroup"
            ? 50000
            : type === "block"
            ? 25000
            : 300000,
        maxScale: 0,
        where: null,
        labelExpressionInfo: label.expressionInfo,
        labelOverplap: false,
        deconflictionStrategy: "static",
        labelSpacing: type === "zip" ? 8 : 4,
      },
    ];
  };

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
        // In the initializeFeatureLayer function
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
          labelingInfo: getLabelingInfo(type),
          // Add label optimization settings
          labelsVisible: true,
          labelsOptimizationThreshold: 1000000,
          minScale: layerConfig.minScale,
          maxScale: layerConfig.maxScale,
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
      if (type === "radius") {
        // Radius is not a server-based layer, just skip
        return;
      }

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

  // UPDATED removeFromSelection
  const removeFromSelection = useCallback(
    async (feature, layerType) => {
      console.log("[MapContext] removeFromSelection called with feature:", feature.attributes);

      if (!selectionGraphicsLayerRef.current) {
        console.warn("[MapContext] Cannot remove from selection: selectionGraphicsLayer not initialized");
        return;
      }

      try {
        const currentLayerConfig = FEATURE_LAYERS[layerType];
        if (!currentLayerConfig) {
          console.error(`[MapContext] Layer configuration not found for layer type: ${layerType}`);
          return;
        }
        const uniqueIdField = currentLayerConfig.uniqueIdField;

        // Find and remove the graphic from selectionGraphicsLayer
        const graphicsToRemove = selectionGraphicsLayerRef.current.graphics.filter(
          (g) =>
            g.attributes[uniqueIdField] === feature.attributes[uniqueIdField] &&
            (!g.attributes?.marketAreaId ||
              (editingMarketArea && g.attributes.marketAreaId === editingMarketArea.id))
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
              f.attributes[uniqueIdField] !== feature.attributes[uniqueIdField] ||
              (f.attributes?.marketAreaId &&
                (!editingMarketArea || f.attributes.marketAreaId !== editingMarketArea.id))
          );
          console.log("[MapContext] Feature removed from selection:", feature.attributes);

          // If this was the last non-market-area feature, clear all temporary selection graphics
          if (
            newSelectedFeatures.length === 0 ||
            newSelectedFeatures.every((f) => f.attributes?.marketAreaId)
          ) {
            const graphicsToKeep = selectionGraphicsLayerRef.current.graphics.filter(
              (g) => g.attributes?.marketAreaId
            );
            selectionGraphicsLayerRef.current.removeAll();
            graphicsToKeep.forEach((g) => selectionGraphicsLayerRef.current.add(g));
          }

          // ***** SAVE CHANGES HERE *****
          // If we're in editing mode, persist the updated array
          if (editingMarketArea) {
            const updatedLocations = newSelectedFeatures.map((f) => ({
              geometry: f.geometry,
              attributes: f.attributes,
            }));
            saveMarketAreaChanges(editingMarketArea.id, { locations: updatedLocations });
          }

          return newSelectedFeatures;
        });
      } catch (error) {
        console.error("[MapContext] Error in removeFromSelection:", error);
      }
    },
    [editingMarketArea]
  );

  // UPDATED addToSelection
  const addToSelection = useCallback(
    async (feature, layerType) => {
      console.log("[MapContext] addToSelection called with feature:", feature.attributes);

      if (!mapView) {
        console.warn("[MapContext] Cannot add to selection: mapView not initialized");
        return;
      }

      try {
        const currentLayerConfig = FEATURE_LAYERS[layerType];
        if (!currentLayerConfig) {
          console.error(`[MapContext] Layer configuration not found for layer type: ${layerType}`);
          return;
        }
        const uniqueIdField = currentLayerConfig.uniqueIdField;

        // Check if feature is already selected
        const isAlreadySelected = selectedFeatures.some(
          (f) => f.attributes[uniqueIdField] === feature.attributes[uniqueIdField]
        );

        if (isAlreadySelected) {
          console.log("[MapContext] Feature already selected:", feature.attributes);
          await removeFromSelection(feature, layerType);
        } else {
          // Only add if not already selected and not part of another market area (or belongs to the one we're editing)
          if (
            !feature.attributes?.marketAreaId ||
            (editingMarketArea && feature.attributes.marketAreaId === editingMarketArea.id)
          ) {
            setSelectedFeatures((prev) => {
              // Double-check we're not duplicating
              if (
                !prev.some((f) => f.attributes[uniqueIdField] === feature.attributes[uniqueIdField])
              ) {
                console.log("[MapContext] Feature added to selection:", feature.attributes);
                const newSelectedFeatures = [...prev, feature];

                // ***** SAVE CHANGES HERE *****
                // Example: build an array for 'locations' that you PATCH to the MarketArea
                if (editingMarketArea) {
                  const updatedLocations = newSelectedFeatures.map((f) => ({
                    geometry: f.geometry, // or f.geometry.toJSON() / your desired format
                    attributes: f.attributes,
                  }));
                  // Call our helper to persist changes
                  saveMarketAreaChanges(editingMarketArea.id, { locations: updatedLocations });
                }

                return newSelectedFeatures;
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error("[MapContext] Error in addToSelection:", error);
      }
    },
    [mapView, selectedFeatures, removeFromSelection, editingMarketArea]
  );
  
  
  // Update the clearSelection function to better handle existing selections
  const clearSelection = useCallback((preserveEditingId = null) => {
    if (!selectionGraphicsLayerRef.current) return;

    try {
      // If we're editing, preserve both existing market areas and current editing session
      if (preserveEditingId) {
        const graphicsToKeep =
          selectionGraphicsLayerRef.current.graphics.filter((graphic) => {
            // Keep graphics that either:
            // 1. Belong to any market area (including current editing session)
            // 2. Are part of the current editing session
            return graphic.attributes?.marketAreaId;
          });

        selectionGraphicsLayerRef.current.removeAll();
        graphicsToKeep.forEach((g) => selectionGraphicsLayerRef.current.add(g));

        // Update selectedFeatures to match
        setSelectedFeatures((prev) =>
          prev.filter((f) => f.attributes?.marketAreaId)
        );
      } else {
        // If not editing, only keep existing market area graphics
        const existingMarketAreas =
          selectionGraphicsLayerRef.current.graphics.filter(
            (graphic) => graphic.attributes?.marketAreaId
          );

        selectionGraphicsLayerRef.current.removeAll();
        existingMarketAreas.forEach((g) =>
          selectionGraphicsLayerRef.current.add(g)
        );

        // Update selectedFeatures to match
        setSelectedFeatures((prev) =>
          prev.filter((f) => f.attributes?.marketAreaId)
        );
      }
    } catch (error) {
      console.error("Error clearing selection:", error);
    }
  }, []);

  // Update toggleMarketAreaEditMode to properly handle selections
  const toggleMarketAreaEditMode = useCallback(
    async (marketAreaId) => {
      if (!marketAreaId || !selectionGraphicsLayerRef.current) return;

      try {
        // Find the market area being edited
        const marketArea = marketAreas.find((ma) => ma.id === marketAreaId);

        // Set the editing state
        setEditingMarketArea(marketArea || null);

        // Get all graphics
        const graphics = selectionGraphicsLayerRef.current.graphics.toArray();
        const radiusGraphics =
          radiusGraphicsLayerRef.current?.graphics.toArray() || [];

        // Update the selectedFeatures state to include the locations from the market area
        if (marketArea && marketArea.locations) {
          setSelectedFeatures((prev) => {
            // Remove any existing selections for this market area
            const filtered = prev.filter(
              (f) => f.attributes?.marketAreaId !== marketAreaId
            );

            // Add all locations from the market area
            return [
              ...filtered,
              ...marketArea.locations.map((loc) => ({
                geometry: loc.geometry,
                attributes: {
                  ...loc,
                  marketAreaId: marketAreaId,
                  FEATURE_TYPE: marketArea.ma_type,
                },
              })),
            ];
          });
        }

        // Update interaction state for both selection and radius graphics
        [...graphics, ...radiusGraphics].forEach((graphic) => {
          const isEditingArea =
            graphic.attributes?.marketAreaId === marketAreaId;
          const isMarketArea = graphic.attributes?.marketAreaId;

          if (isMarketArea) {
            graphic.visible = true;
            graphic.interactive = isEditingArea;

            if (isEditingArea) {
              graphic.symbol = {
                ...graphic.symbol,
                opacity: 1,
              };
            } else {
              graphic.symbol = {
                ...graphic.symbol,
                opacity: 0.5,
              };
            }
          }
        });

        // Update feature layer interactivity
        Object.values(featureLayersRef.current).forEach((layer) => {
          if (layer && !layer.destroyed) {
            if (Array.isArray(layer.featureLayers)) {
              layer.featureLayers.forEach((subLayer) => {
                if (subLayer && !subLayer.destroyed) {
                  subLayer.interactive = true;
                }
              });
            } else {
              layer.interactive = true;
            }
          }
        });

        console.log("[MapContext] Market area edit mode toggled", {
          marketAreaId,
          totalGraphics: graphics.length + radiusGraphics.length,
          editableGraphics: graphics.filter(
            (g) => g.attributes?.marketAreaId === marketAreaId
          ).length,
          editingMarketArea: marketArea,
        });
      } catch (error) {
        console.error("Error toggling market area edit mode:", error);
      }
    },
    [marketAreas]
  );

  // In MapContext.jsx
  const displayFeatures = useCallback(
    async (features) => {
      if (!selectionGraphicsLayerRef.current || !mapView) return;

      try {
        console.log(
          `[MapContext] Displaying ${
            features.length
          } features for layers: ${activeLayers.join(", ")}`
        );

        // Preserve market area graphics
        const existingMarketAreaGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (graphic) => graphic.attributes?.marketAreaId
          );

        // Get existing selection graphics that we want to keep (ones not being toggled)
        const existingSelectionGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (graphic) =>
              !graphic.attributes?.marketAreaId &&
              !features.some((f) => f.attributes.FID === graphic.attributes.FID)
          );

        // Clear the graphics layer
        selectionGraphicsLayerRef.current.removeAll();

        // Add back existing market area graphics
        existingMarketAreaGraphics.forEach((g) =>
          selectionGraphicsLayerRef.current.add(g)
        );

        // Add back existing selection graphics we're keeping
        existingSelectionGraphics.forEach((g) =>
          selectionGraphicsLayerRef.current.add(g)
        );

        const { default: Graphic } = await import("@arcgis/core/Graphic");

        // Add new or updated features
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
                `Unsupported geometry type for display: ${geometry.type}`
              );
              continue;
          }

          // Only add if it's not already selected (preventing duplicate visuals)
          const isAlreadySelected = existingSelectionGraphics.some(
            (g) => g.attributes.FID === feature.attributes.FID
          );

          if (!isAlreadySelected) {
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
        }
      } catch (error) {
        console.error("[MapContext] Error displaying features:", error);
      }
    },
    [activeLayers, mapView]
  );

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType) => {
      if (!selectionGraphicsLayerRef.current || !mapView) return;
  
      try {
        const [{ default: Graphic }, geometryEngineAsync, geometryEngine] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/geometryEngineAsync"),
          import("@arcgis/core/geometry/geometryEngine"),
        ]);
        const { default: Polygon } = await import("@arcgis/core/geometry/Polygon");
  
        // Group features by their marketAreaId
        const newFeaturesByMarketArea = features.reduce((acc, feature) => {
          const marketAreaId = feature.attributes.marketAreaId;
          if (!acc[marketAreaId]) acc[marketAreaId] = [];
          acc[marketAreaId].push(feature);
          return acc;
        }, {});
  
        // Keep existing graphics from other market areas
        const marketAreaIds = new Set(Object.keys(newFeaturesByMarketArea));
        const existingGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) => !marketAreaIds.has(g.attributes.marketAreaId)
          );
  
        // Clear existing graphics for these market areas
        selectionGraphicsLayerRef.current.removeAll();
  
        // Add back existing graphics from other market areas
        existingGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));
  
        const repairGeometry = async (geom) => {
          let repaired = geom;
          try {
            repaired = await geometryEngineAsync.simplify(repaired);
          } catch (err) {
            console.warn("Failed to simplify geometry:", err);
          }
          try {
            // buffer(0) often fixes self-intersections
            repaired = await geometryEngineAsync.buffer(repaired, 0);
          } catch (err) {
            console.warn("Failed buffer(0) repair on geometry:", err);
          }
          return repaired || geom;
        };
  
        const incrementalUnion = async (geometries) => {
          if (geometries.length === 1) {
            return geometries[0];
          }
  
          // Sort by area (largest first)
          geometries = geometries.slice().sort((a, b) => {
            const areaA = geometryEngine.planarArea(a);
            const areaB = geometryEngine.planarArea(b);
            return areaB - areaA;
          });
  
          let unionGeom = geometries[0];
          for (let i = 1; i < geometries.length; i++) {
            let current = geometries[i];
            // Attempt union
            try {
              unionGeom = await geometryEngineAsync.union([unionGeom, current]);
            } catch (err) {
              console.warn(`Error unioning polygon at index ${i}:`, err, "Trying repairs...");
              // Try repairing both geometries and re-union
              unionGeom = await repairGeometry(unionGeom);
              current = await repairGeometry(current);
  
              try {
                unionGeom = await geometryEngineAsync.union([unionGeom, current]);
              } catch (finalErr) {
                console.warn(`Union failed after repairs. Skipping polygon at index ${i}`, finalErr);
                // Skip this polygon
              }
            }
  
            // Try simplifying after each union
            try {
              unionGeom = await geometryEngineAsync.simplify(unionGeom);
            } catch (simplifyErr) {
              console.warn("Error simplifying after union:", simplifyErr);
            }
  
            // Additional repair steps
            try {
              unionGeom = await geometryEngineAsync.buffer(unionGeom, 0);
            } catch (bufferErr) {
              console.warn("Buffer(0) repair failed after union:", bufferErr);
            }
          }
  
          return unionGeom;
        };
  
        for (const [marketAreaId, maFeatures] of Object.entries(newFeaturesByMarketArea)) {
          let geometries = maFeatures.map((f) => f.geometry).filter((g) => g != null);
  
          // Repair each geometry before union
          geometries = await Promise.all(
            geometries.map(async (geom) => {
              return await repairGeometry(geom);
            })
          );
  
          if (geometries.length === 0) continue;
  
          // Perform incremental union on all geometries
          let unionGeometry = await incrementalUnion(geometries);
  
          if (!unionGeometry) {
            console.warn(`No valid union geometry created for market area ${marketAreaId}`);
            continue;
          }
  
          // Final repairs on the union
          try {
            unionGeometry = await geometryEngineAsync.simplify(unionGeometry);
          } catch (err) {
            console.warn("Final simplify failed:", err);
          }
  
          try {
            unionGeometry = await geometryEngineAsync.buffer(unionGeometry, 0);
          } catch (err) {
            console.warn("Final buffer(0) repair failed:", err);
          }
  
          // If union results in multiple disconnected polygons, ArcGIS represents this
          // as a multi-part polygon. We need to break it into separate polygon parts.
          // Each polygon part consists of one outer ring (counterclockwise) and zero or more inner rings (clockwise).
  
          // Extract outer polygons from multi-part polygon
          // We'll consider any clockwise ring as a hole and discard it for a clean boundary.
          // We'll create one graphic per outer polygon ring.
  
          // Identify outer rings (counterclockwise) to form separate polygons
          const outSR = unionGeometry.spatialReference;
          const rings = unionGeometry.rings || [];
          let currentPolygonRings = [];
          const polygonsToAdd = [];
          
          // Helper to check ring orientation (true if counterclockwise)
          const isCounterClockwise = (ring) => {
            // Using planarArea of a polygon created by the ring
            const testPoly = new Polygon({rings:[ring], spatialReference: outSR});
            const area = geometryEngine.planarArea(testPoly, "square-meters");
            // If area > 0, ring is counterclockwise (ArcGIS: counterclockwise yields a positive area)
            return area > 0;
          };
  
          for (const ring of rings) {
            if (isCounterClockwise(ring)) {
              // This is an outer boundary of a new disconnected polygon part
              // If we have a currentPolygonRings, push as a polygon and start a new one
              if (currentPolygonRings.length > 0) {
                // Construct a polygon from the current rings (outer ring + no holes)
                const poly = new Polygon({
                  spatialReference: outSR,
                  rings: currentPolygonRings
                });
                polygonsToAdd.push(poly);
                currentPolygonRings = [];
              }
              // Start a new polygon with this outer ring
              currentPolygonRings.push(ring);
            } else {
              // This ring is clockwise, representing a hole
              // We are removing holes for a clean boundary, so skip it.
            }
          }
  
          // Add the last set of rings if any
          if (currentPolygonRings.length > 0) {
            const poly = new Polygon({
              spatialReference: outSR,
              rings: currentPolygonRings
            });
            polygonsToAdd.push(poly);
          }
  
          // If for some reason no polygons were extracted, just skip
          if (polygonsToAdd.length === 0) {
            console.warn(`No polygons extracted from market area ${marketAreaId}`);
            continue;
          }
  
          // Create a graphic for each polygon part
          for (const poly of polygonsToAdd) {
            const symbol = {
              type: "simple-fill",
              color: [...hexToRgb(styles.fill), styles.fillOpacity],
              outline: {
                color: styles.outline,
                width: styles.outlineWidth,
              },
            };
  
            const unionGraphic = new Graphic({
              geometry: poly,
              symbol: symbol,
              attributes: {
                marketAreaId,
                FEATURE_TYPE: featureType,
                order: maFeatures[0].attributes.order,
              },
            });
  
            selectionGraphicsLayerRef.current.add(unionGraphic);
          }
        }
  
        // Sort all graphics so that higher order market areas appear above lower order ones
        const allGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
        allGraphics.sort((a, b) => (b.attributes.order || 0) - (a.attributes.order || 0));
        selectionGraphicsLayerRef.current.removeAll();
        allGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));
  
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
      // This function now only relies on the parameters passed in.
      // No references to formState, maType, or radiusPoints.
      if (!radiusGraphicsLayerRef.current || !point?.center || !point?.radii || !mapView) {
        return;
      }
  
      try {
        const { default: Graphic } = await import("@arcgis/core/Graphic");
  
        // Use provided style or fallback
        const fillRgb = style?.fillColor ? hexToRgb(style.fillColor) : [255, 255, 255];
        const outlineRgb = style?.borderColor ? hexToRgb(style.borderColor) : [0, 0, 0];
        const fillOpacity = style?.fillOpacity !== undefined ? style.fillOpacity : 0.3;
        const borderWidth = style?.borderWidth !== undefined ? style.borderWidth : 2;
  
        const center = ensureValidGeometry(point.center, mapView.spatialReference);
        if (!center) return;
  
        const centerPoint = webMercatorToGeographic(center);
  
        const otherAreaGraphics = radiusGraphicsLayerRef.current.graphics.filter(
          (g) => g.attributes?.marketAreaId && marketAreaId && g.attributes.marketAreaId !== marketAreaId
        );
  
        radiusGraphicsLayerRef.current.removeAll();
        otherAreaGraphics.forEach((g) => radiusGraphicsLayerRef.current.add(g));
  
        const { geodesicBuffer } = await import("@arcgis/core/geometry/geometryEngine");
        const newGraphics = [];
  
        const effectiveMarketAreaId = marketAreaId || "tempRadiusId";
  
        for (let i = 0; i < point.radii.length; i++) {
          const radiusMiles = point.radii[i];
          const radiusMeters = radiusMiles * 1609.34;
  
          const uniqueMarketAreaId = `${effectiveMarketAreaId}-radius-${i}`;
  
          const polygon = geodesicBuffer(centerPoint, radiusMeters, "meters");
          const symbol = {
            type: "simple-fill",
            color: fillOpacity > 0 ? [...fillRgb, fillOpacity] : [0, 0, 0, 0],
            outline: borderWidth > 0 ? { color: outlineRgb, width: borderWidth } : null,
          };
  
          const circleGraphic = new Graphic({
            geometry: polygon,
            attributes: {
              FEATURE_TYPE: "radius",
              marketAreaId: uniqueMarketAreaId,
              originalMarketAreaId: marketAreaId,
              radiusMiles: radiusMiles,
              order,
            },
            symbol,
          });
          newGraphics.push(circleGraphic);
        }
  
        const allGraphics = [
          ...radiusGraphicsLayerRef.current.graphics.toArray(),
          ...newGraphics,
        ];
        allGraphics.sort((a, b) => (b.attributes.order || 0) - (a.attributes.order || 0));
  
        radiusGraphicsLayerRef.current.removeAll();
        allGraphics.forEach((graphic) => radiusGraphicsLayerRef.current.add(graphic));
  
      } catch (error) {
        console.error("Error drawing radius:", error);
      }
    },
    [mapView]
  );
  
  
  const saveMarketAreaChanges = useCallback(
    async (marketAreaId, updates) => {
      if (!marketAreaId) {
        console.warn("No market area ID provided, cannot save changes.");
        return;
      }
      if (!editingMarketArea) {
        console.warn("No editing market area in context, cannot save changes.");
        return;
      }
  
      try {
        // The relevant Project ID is usually stored in editingMarketArea.project or something similar
        // Or you may have it in a separate piece of state (like currentProjectId)
        const projectId = editingMarketArea.project; 
        // If editingMarketArea.project is the entire object, you'll need projectId = editingMarketArea.project.id
  
        const responseData = await updateMarketArea(projectId, marketAreaId, updates);
  
        // Optionally update your local state if you store MarketAreas in context
        // e.g. if you fetch MarketAreas on mount and keep them in state:
        // setMarketAreas(prev => {
        //   return prev.map(ma => ma.id === marketAreaId ? {...ma, ...responseData} : ma);
        // });
  
        console.log("[MapContext] Successfully saved MarketArea changes:", responseData);
      } catch (err) {
        console.error("[MapContext] Error saving MarketArea changes:", err);
        // You can also show a toast / notification
      }
    },
    [editingMarketArea] // or [editingMarketArea, setMarketAreas], etc.
  );


  const removeActiveLayer = useCallback(
    async (type) => {
      if (!type || type === "radius") {
        return;
      }
  
      if (!mapView) {
        console.warn("Map view not initialized");
        return;
      }
  
      if (!FEATURE_LAYERS[type]) {
        console.error(`Invalid layer type: ${type}`);
        return;
      }
  
      setIsLayerLoading(true);
  
      try {
        const layer = featureLayersRef.current[type];
        if (layer && !layer.destroyed && mapView.map.layers.includes(layer)) {
          // Remove the layer completely from the map
          mapView.map.remove(layer);
          console.log(`[MapContext] Removed layer ${type} from the map.`);
          delete featureLayersRef.current[type];
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
  
        // Optionally hide all feature layers to ensure none remain visible
        hideAllFeatureLayers();
  
      } catch (error) {
        console.error(`Error removing layer ${type}:`, error);
      } finally {
        setIsLayerLoading(false);
      }
    },
    [mapView, hideAllFeatureLayers]
  );
  

  const clearMarketAreaGraphics = useCallback((marketAreaId) => {
    try {
      if (!marketAreaId) {
        // Remove ALL market area graphics
        if (radiusGraphicsLayerRef.current) {
          radiusGraphicsLayerRef.current.removeAll();
        }
        if (selectionGraphicsLayerRef.current) {
          const nonMarketGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) => !g.attributes?.marketAreaId
            );
          selectionGraphicsLayerRef.current.removeAll();
          nonMarketGraphics.forEach((g) =>
            selectionGraphicsLayerRef.current.add(g)
          );
        }
        console.log("[MapContext] Cleared all market area graphics.");
        return;
      }
  
      // Remove radius graphics for this marketAreaId
      if (radiusGraphicsLayerRef.current) {
        const remainingRadiusGraphics =
          radiusGraphicsLayerRef.current.graphics.filter(
            (g) => g.attributes?.marketAreaId !== marketAreaId
          );
        radiusGraphicsLayerRef.current.removeAll();
        remainingRadiusGraphics.forEach((g) => radiusGraphicsLayerRef.current.add(g));
      }
  
      // Remove selection graphics for this marketAreaId
      if (selectionGraphicsLayerRef.current) {
        const remainingSelectionGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) => g.attributes?.marketAreaId !== marketAreaId
          );
        selectionGraphicsLayerRef.current.removeAll();
        remainingSelectionGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));
      }
  
      console.log(
        `[MapContext] Cleared graphics for market area ${marketAreaId}`
      );
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
              whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
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
        console.log(
          `[MapContext] Found ${allFeatures.length} total features for the query`
        );
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

  // Updated toggleActiveLayerType to skip 'radius'
  const toggleActiveLayerType = useCallback(
    async (type) => {
      if (type === "radius") {
        // Radius doesn't correspond to a server-based layer, do nothing
        return;
      }

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

  useEffect(() => {
    if (!mapView) return;
  
    // Safely disable popup behaviors
    if (mapView.popup) {
      mapView.popup.autoOpenEnabled = false;
      mapView.popup.dockEnabled = false;
      mapView.popup.defaultPopupTemplateEnabled = false;
    }
  
    // Disable popups on all feature layers
    Object.values(featureLayersRef.current).forEach((layer) => {
      if (layer) {
        if (Array.isArray(layer.featureLayers)) {
          // Handle group layers
          layer.featureLayers.forEach((subLayer) => {
            if (subLayer && !subLayer.destroyed) {
              subLayer.popupEnabled = false;
              if (subLayer.popupTemplate) {
                subLayer.popupTemplate = null;
              }
            }
          });
        } else if (!layer.destroyed) {
          // Handle single layers
          layer.popupEnabled = false;
          if (layer.popupTemplate) {
            layer.popupTemplate = null;
          }
        }
      }
    });
  
    const handleMapClick = async (event) => {
      event.stopPropagation();
  
      // If map selection is not active or there are no active layers, do nothing.
      if (!isMapSelectionActive || !activeLayers.length) {
        return;
      }
  
      try {
        const hitResult = await mapView.hitTest(event);
  
        if (hitResult && hitResult.results.length > 0) {
          const validResults = hitResult.results.filter((result) => {
            const graphic = result.graphic;
            const graphicMarketAreaId = graphic.attributes?.marketAreaId;
            // Only allow selection if feature doesn't belong to another market area or belongs to the one being edited
            return (
              !graphicMarketAreaId ||
              (editingMarketArea && graphicMarketAreaId === editingMarketArea.id)
            );
          });
  
          if (validResults.length > 0) {
            const graphicResult = validResults.find((r) =>
              activeLayers.some(
                (type) => FEATURE_LAYERS[type].title === r.layer.title
              )
            );
  
            if (graphicResult && graphicResult.graphic) {
              const graphic = graphicResult.graphic;
              const existingMarketAreaId = graphic.attributes?.marketAreaId;
              if (
                existingMarketAreaId &&
                (!editingMarketArea ||
                  existingMarketAreaId !== editingMarketArea.id)
              ) {
                console.log(
                  "Cannot select feature - belongs to another market area:",
                  existingMarketAreaId
                );
                return;
              }
  
              const matchedLayerType = activeLayers.find(
                (type) => FEATURE_LAYERS[type].title === graphicResult.layer.title
              );
  
              await addToSelection(graphic, matchedLayerType);
            }
          }
        } 
        // If click hits no feature, do nothing here (no radius logic in this context).
      } catch (error) {
        console.error("[MapContext] Error handling map click:", error);
      }
    };
  
    const handler = mapView.on("click", handleMapClick);
    return () => {
      handler.remove();
      // Re-enable popups on cleanup if needed
    };
  }, [mapView, isMapSelectionActive, activeLayers, addToSelection, editingMarketArea]);
  

  useEffect(() => {
    // Ensure conditions are met before running
    if (
      mapView &&
      marketAreas &&
      marketAreas.length > 0 &&
      visibleMarketAreaIds &&
      visibleMarketAreaIds.length > 0 &&
      layersReady // ensure this is true
    ) {
      showVisibleMarketAreas();
    }
  }, [mapView, marketAreas, visibleMarketAreaIds, drawRadius, updateFeatureStyles, layersReady]);
  
  useEffect(() => {
    if (mapView && marketAreas.length > 0 && visibleMarketAreaIds.length > 0 && layersReady) {
      showVisibleMarketAreas();
    }
  }, [mapView, marketAreas, visibleMarketAreaIds, layersReady]);
  
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
    Object.values(featureLayersRef.current).forEach((layer) => {
      if (layer && !layer.destroyed) {
        try {
          // Handle both single layers and group layers
          if (Array.isArray(layer.featureLayers)) {
            layer.featureLayers.forEach((subLayer) => {
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
    localStorage.removeItem("mapState");
    localStorage.removeItem("lastMapExtent");

    console.log("[MapContext] Map state reset successfully");
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
      resetMapState,
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
      clearMarketAreaGraphics,
      toggleMarketAreaEditMode,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      radiusGraphicsLayer: radiusGraphicsLayerRef.current,
      selectionGraphicsLayer: selectionGraphicsLayerRef.current,
      visibleMarketAreaIds,
      setVisibleMarketAreaIds,
      editingMarketArea,
      setEditingMarketArea,
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
      toggleMarketAreaEditMode,
      removeFromSelection,
      clearSelection,
      clearMarketAreaGraphics,
      updateFeatureStyles,
      drawRadius,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      visibleMarketAreaIds,
      editingMarketArea,
      setEditingMarketArea,
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
export { FEATURE_LAYERS };
