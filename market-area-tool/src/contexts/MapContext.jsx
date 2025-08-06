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
import {
  webMercatorToGeographic,
  geographicToWebMercator,
} from "@arcgis/core/geometry/support/webMercatorUtils";
import * as geometryEngineAsync from "@arcgis/core/geometry/geometryEngineAsync";
import { useMarketAreas } from "../contexts/MarketAreaContext";
import { default as SpatialReference } from "@arcgis/core/geometry/SpatialReference";
import { default as ProjectParameters } from "@arcgis/core/rest/support/ProjectParameters";
import * as geometryService from "@arcgis/core/rest/geometryService";
import {
  unifyBoundaries,
  detectAndAlignSharedBorders,
  groupFeaturesBySharedAttributes,
} from "./IncrementalUnion";
import TileLayer from "@arcgis/core/layers/TileLayer";

const MapContext = createContext();

const FEATURE_LAYERS = {
  md: {
    url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/Metropolitan_Divisions_v1/FeatureServer/0",
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
  drivetime: {
    // Use ArcGIS Living Atlas service or your own hosted feature service
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Drive_Time_Areas/FeatureServer/0",
    outFields: [
      "OBJECTID",
      "travelTimeMinutes",
      "centerLongitude",
      "centerLatitude",
      "marketAreaId",
      "name",
    ],
    uniqueIdField: "OBJECTID",
    title: "Drive Time Areas",
    geometryType: "polygon",
    popupTemplate: {
      title: "{name}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "name", label: "Area Name" },
            { fieldName: "travelTimeMinutes", label: "Travel Time (Minutes)" },
            { fieldName: "centerLongitude", label: "Center Longitude" },
            { fieldName: "centerLatitude", label: "Center Latitude" },
          ],
        },
      ],
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 120, 212, 0.35], // Semi-transparent blue
        outline: {
          color: [0, 120, 212, 1], // Solid blue
          width: 2,
        },
      },
    },
    labelingInfo: [
      {
        labelExpressionInfo: {
          expression: "$feature.travelTimeMinutes + ' min'",
        },
        labelPlacement: "always-horizontal",
        symbol: {
          type: "text",
          color: [50, 50, 50, 1],
          haloColor: [255, 255, 255, 0.9],
          haloSize: 2,
          font: {
            size: 12,
            family: "Noto Sans",
            weight: "bold",
          },
        },
      },
    ],
    returnGeometry: true,
    mode: "ondemand",
    minScale: 0,
    maxScale: 0,
  },
  // Country feature layer configuration
  country: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries/FeatureServer/0",
    outFields: [
      "OBJECTID",
      "COUNTRY", // Country name
      "ISO", // ISO country code
      "REGION", // Region
      "CONTINENT", // Continent
      "POP_CNTRY", // Population
      "SQKM", // Area in square kilometers
      "Shape_Area", // Shape area
      "Shape_Length", // Shape length
    ],
    uniqueIdField: "OBJECTID",
    title: "Countries",
    geometryType: "polygon",
    popupTemplate: {
      title: "{COUNTRY}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "COUNTRY", label: "Country Name" },
            { fieldName: "ISO", label: "ISO Code" },
            { fieldName: "CONTINENT", label: "Continent" },
            { fieldName: "REGION", label: "Region" },
            { fieldName: "POP_CNTRY", label: "Population" },
            { fieldName: "SQKM", label: "Area (sq km)" },
          ],
        },
      ],
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0], // Transparent fill
        outline: {
          color: [70, 70, 70, 0.9], // Dark gray border
          width: 1.5,
        },
      },
    },
    labelingInfo: [
      {
        labelExpressionInfo: {
          expression: "$feature.COUNTRY",
        },
        labelPlacement: "always-horizontal",
        symbol: {
          type: "text",
          color: [50, 50, 50, 1],
          haloColor: [255, 255, 255, 0.9],
          haloSize: 2,
          font: {
            size: 14,
            family: "Noto Sans",
            weight: "bold",
          },
        },
        minScale: 100000000,
        maxScale: 0,
      },
    ],
    // Parameters to control geometry detail level
    minScale: 500000000,
    maxScale: 0,
    maxAllowableOffset: 1000, // Control geometry simplification (in meters)
    simplificationTolerance: 1000, // Larger tolerance for countries (global scale)
    quantizationParameters: {
      mode: "view",
      originPosition: "upper-left",
      tolerance: 1000, // Higher value = less detail
    },
  },
  zip: {
    url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Census_ZIP_Code_Tabulation_Areas_2010_v1/FeatureServer/0",
    outFields: [
      "ZCTA5",
      "NAME",
      "GEOID",
      "POP100",
      "HU100",
      "INTPTLAT",
      "INTPTLON",
      "OBJECTID",
    ],
    uniqueIdField: "OBJECTID", // Using OBJECTID as it's the system-maintained unique ID
    identifierField: "ZCTA5", // Using ZCTA5 for ZIP code identification
    title: "ZIP Codes",
    geometryType: "polygon",
    popupTemplate: {
      title: "ZIP Code: {ZCTA5}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "ZCTA5", label: "ZIP Code" },
            { fieldName: "NAME", label: "Name" },
            { fieldName: "POP100", label: "Population" },
            { fieldName: "HU100", label: "Housing Units" },
            { fieldName: "INTPTLAT", label: "Latitude" },
            { fieldName: "INTPTLON", label: "Longitude" },
          ],
        },
      ],
    },
  },
  county: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/82",
    layerId: 82,
    outFields: [
      "OBJECTID",
      "GEOID",
      "STATE",
      "COUNTY",
      "NAME",
      "BASENAME",
      "COUNTYCC",
      "MTFCC",
    ],
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
    maxScale: 100,
  },
  place: {
    urls: [
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/28",
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/30",
    ],
    outFields: [
      "OBJECTID",
      "GEOID",
      "STATE",
      "PLACE",
      "NAME",
      "BASENAME",
      "LSADC",
      "FUNCSTAT",
      "PLACECC",
      "AREALAND",
      "AREAWATER",
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
            { fieldName: "FUNCSTAT", label: "Functional Status" },
            { fieldName: "PLACECC", label: "Place Class Code" },
            { fieldName: "AREALAND", label: "Land Area" },
            { fieldName: "AREAWATER", label: "Water Area" },
          ],
        },
      ],
    },
    minScale: 1400000,
    maxScale: 100,
  },
  tract: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Census_Tracts/FeatureServer/0",
    outFields: [
      "OBJECTID",
      "FIPS", // Add this field to get the complete FIPS code
      "STATE_ABBR",
      "STATE_FIPS",
      "COUNTY_FIPS",
      "TRACT_FIPS",
    ],
    uniqueIdField: "OBJECTID",
    title: "Census Tracts",
    geometryType: "polygon",
    popupTemplate: {
      title: "Census Tract {FIPS}", // Updated to use FIPS
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "FIPS", label: "FIPS Code" },
            { fieldName: "STATE_ABBR", label: "State" },
            { fieldName: "COUNTY_FIPS", label: "County" },
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
      "FIPS", // Added FIPS field for complete code
      "STATE_ABBR",
      "COUNTY_FIPS",
      "TRACT_FIPS",
      "BLOCKGROUP_FIPS",
    ],
    uniqueIdField: "OBJECTID",
    title: "Block Groups",
    geometryType: "polygon",
    popupTemplate: {
      title: "Block Group {FIPS}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "FIPS", label: "FIPS Code" },
            { fieldName: "STATE_ABBR", label: "State" },
            { fieldName: "COUNTY_FIPS", label: "County" },
            { fieldName: "TRACT_FIPS", label: "Tract" },
            { fieldName: "BLOCKGROUP_FIPS", label: "Block Group" },
          ],
        },
      ],
    },
  },
  // Modified state layer configuration with reduced detail
  // Modified state layer configuration with aggressive geometry simplification
  // Replace the existing 'state' configuration in FEATURE_LAYERS object

  state: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/80",

    // Reduced output fields to minimize data transfer and improve performance
    outFields: [
      "OBJECTID",
      "GEOID", // State FIPS code
      "STUSAB", // State abbreviation
      "NAME", // State name
      "CENTLAT", // Centroid latitude
      "CENTLON", // Centroid longitude
      // Removed REGION, DIVISION, AREALAND, AREAWATER to reduce payload
    ],

    uniqueIdField: "OBJECTID",
    title: "States",
    geometryType: "esriGeometryPolygon",

    popupTemplate: {
      title: "{NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "NAME", label: "State Name" },
            { fieldName: "STUSAB", label: "State Abbreviation" },
            { fieldName: "GEOID", label: "State FIPS Code" },
            // Removed detailed area fields from popup to keep it simple
          ],
        },
      ],
    },

    labelingInfo: [
      {
        labelExpressionInfo: {
          expression: "$feature.NAME",
        },
        labelPlacement: "always-horizontal",
        symbol: {
          type: "text",
          color: [0, 0, 0, 1],
          haloColor: [255, 255, 255, 1],
          haloSize: 2,
          font: {
            size: 14,
            family: "Noto Sans",
            weight: "bold",
          },
        },
        // Only show labels at medium to large scales to reduce rendering load
        minScale: 50000000,
        maxScale: 0,
      },
    ],

    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0], // Transparent fill
        outline: {
          color: [110, 110, 110, 255],
          width: 1.5, // Reduced from 2 to 1.5 for better performance
        },
      },
    },

    // Aggressive scale-dependent rendering to limit when layer draws
    minScale: 200000000, // Only show when zoomed out significantly (was 5.91657527591555E8)
    maxScale: 1000, // Hide when zoomed in too close (was 100)

    spatialReference: {
      wkid: 102100,
    },

    // AGGRESSIVE geometry simplification parameters for performance
    maxAllowableOffset: 2500, // Increased from 500 to 5000 meters - very aggressive simplification
    simplificationTolerance: 2500, // Increased from 500 to 5000 meters

    // Enhanced quantization parameters for maximum performance
    quantizationParameters: {
      mode: "view",
      originPosition: "upper-left",
      tolerance: 2500, // Increased from 500 to 5000 - very aggressive
      extent: null, // Let the service determine optimal extent
    },

    // Additional performance optimization parameters
    definitionExpression: null, // No filtering to keep queries simple

    // Limit the maximum number of features returned
    maxRecordCount: 100, // Reasonable limit for all US states

    // Optimize for performance over precision
    geometryPrecision: 2, // Reduce coordinate precision (2 decimal places)

    // Additional service-level optimizations
    useViewTime: false, // Disable time-based queries
    refreshInterval: 0, // No auto-refresh

    // Cache settings for better performance
    cacheHint: true, // Enable client-side caching if supported

    // Reduce detail at different zoom levels
    levelOfDetail: {
      // At very small scales, use maximum simplification
      0: { tolerance: 10000 },
      1: { tolerance: 8000 },
      2: { tolerance: 6000 },
      3: { tolerance: 5000 },
      4: { tolerance: 3000 },
      // At larger scales, use moderate simplification
      5: { tolerance: 2000 },
      6: { tolerance: 1500 },
      7: { tolerance: 1000 },
      8: { tolerance: 500 },
    },
  },
  cbsa: {
    // TWO sub-layer URLs: 91 (Micropolitan), 93 (Metropolitan)
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
    color: [0, 0, 0, 0], // Transparent fill
    outline: {
      color: [128, 128, 128, 1], // Gray border
      width: 1,
    },
  },
  selectedPolygon: {
    type: "simple-fill",
    color: [0, 0, 0, 0], // Transparent fill
    outline: {
      color: [0, 0, 0, 0], // Transparent border
      width: 0,
    },
  },
  defaultPolyline: {
    type: "simple-line",
    color: [128, 128, 128, 1], // Gray line
    width: 1,
  },
  selectedPolyline: {
    type: "simple-line",
    color: [0, 0, 0, 0], // Transparent
    width: 0,
  },
  defaultPoint: {
    type: "simple-marker",
    color: [0, 0, 0, 0], // Transparent fill
    outline: {
      color: [128, 128, 128, 1], // Gray border
      width: 1,
    },
  },
  selectedPoint: {
    type: "simple-marker",
    color: [0, 0, 0, 0], // Transparent
    outline: {
      color: [0, 0, 0, 0], // Transparent
      width: 0,
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
  const [activeLayers, setActiveLayers] = useState([]);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [isMapSelectionActive, setIsMapSelectionActive] = useState(false);
  const [visibleMarketAreaIds, setVisibleMarketAreaIds] = useState([]);
  const [selectedMarketArea, setSelectedMarketArea] = useState(null);
  const [editingMarketArea, setEditingMarketArea] = useState(null);
  const STAR_SVG_PATH =
    "M 0 -10 L 2.939 -4.045 L 9.511 -3.09 L 4.755 1.18 L 5.878 8.09 L 0 5 L -5.878 8.09 L -4.755 1.18 L -9.511 -3.09 L -2.939 -4.045 Z";

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
    "01": "AL",
    "02": "AK",
    "04": "AZ",
    "05": "AR",
    "06": "CA",
    "08": "CO",
    "09": "CT",
    10: "DE",
    11: "DC",
    12: "FL",
    13: "GA",
    15: "HI",
    16: "ID",
    17: "IL",
    18: "IN",
    19: "IA",
    20: "KS",
    21: "KY",
    22: "LA",
    23: "ME",
    24: "MD",
    25: "MA",
    26: "MI",
    27: "MN",
    28: "MS",
    29: "MO",
    30: "MT",
    31: "NE",
    32: "NV",
    33: "NH",
    34: "NJ",
    35: "NM",
    36: "NY",
    37: "NC",
    38: "ND",
    39: "OH",
    40: "OK",
    41: "OR",
    42: "PA",
    44: "RI",
    45: "SC",
    46: "SD",
    47: "TN",
    48: "TX",
    49: "UT",
    50: "VT",
    51: "VA",
    53: "WA",
    54: "WV",
    55: "WI",
    56: "WY",
  };

  const STATE_NAME_BY_FIPS = {
    "01": "Alabama",
    "02": "Alaska",
    "04": "Arizona",
    "05": "Arkansas",
    "06": "California",
    "08": "Colorado",
    "09": "Connecticut",
    10: "Delaware",
    11: "District of Columbia",
    12: "Florida",
    13: "Georgia",
    15: "Hawaii",
    16: "Idaho",
    17: "Illinois",
    18: "Indiana",
    19: "Iowa",
    20: "Kansas",
    21: "Kentucky",
    22: "Louisiana",
    23: "Maine",
    24: "Maryland",
    25: "Massachusetts",
    26: "Michigan",
    27: "Minnesota",
    28: "Mississippi",
    29: "Missouri",
    30: "Montana",
    31: "Nebraska",
    32: "Nevada",
    33: "New Hampshire",
    34: "New Jersey",
    35: "New Mexico",
    36: "New York",
    37: "North Carolina",
    38: "North Dakota",
    39: "Ohio",
    40: "Oklahoma",
    41: "Oregon",
    42: "Pennsylvania",
    44: "Rhode Island",
    45: "South Carolina",
    46: "South Dakota",
    47: "Tennessee",
    48: "Texas",
    49: "Utah",
    50: "Vermont",
    51: "Virginia",
    53: "Washington",
    54: "West Virginia",
    55: "Wisconsin",
    56: "Wyoming",
  };

  // Map LSADC codes to their corresponding place type
  const LSADC_TO_PLACETYPE = {
    21: "Borough",
    25: "City",
    43: "Town",
    47: "Village",
  };

  function formatLocationName(feature, type) {
    if (!feature || !feature.attributes) return "Unknown Location";

    const { attributes } = feature;

    // Helper for state FIPS handling
    function getValidStateFips() {
      // 1) If GEOID exists and is long enough to contain state code, use first 2 digits
      if (attributes.GEOID && attributes.GEOID.length >= 2) {
        const stateFips = attributes.GEOID.substring(0, 2);
        return stateFips !== "00" ? stateFips : null;
      }

      // 2) Try the attributes.STATE field
      const maybeState = attributes.STATE;
      if (maybeState && maybeState !== "00") return maybeState;

      // 3) Return null if no valid state code found
      return null;
    }

    // Common attributes with fallbacks
    const stateFips = getValidStateFips();
    const countyFips = attributes.COUNTY || "";
    const tractFips = attributes.TRACT || "";
    const blockGroupFips = attributes.BLOCKGROUP_FIPS || "";
    const blockVal = attributes.BLOCK || "";
    const zipCode = attributes.ZCTA5 || "";

    // Original location name from attributes
    let rawName = attributes.NAME || attributes.BASENAME || "";

    function sanitizeName(name) {
      return name
        .replace(/,\s*$/, "")
        .replace(/\s+(county|city|town|village|borough)$/i, "")
        .trim();
    }

    const locationName = sanitizeName(rawName);

    function pad(value, length) {
      return String(value || "").padStart(length, "0");
    }

    // For "place", handle LSADC-coded place type
    let placeType = "";
    if (type === "place" && attributes.LSADC) {
      const codeNum = parseInt(attributes.LSADC, 10);
      if (LSADC_TO_PLACETYPE[codeNum]) {
        placeType = LSADC_TO_PLACETYPE[codeNum];
      }
    }

    // For counties, places, and zips, use the STATE field directly to get state abbreviation
    let stateAbbr;
    if (["county", "place"].includes(type)) {
      if (!attributes.STATE) {
        return "Invalid Location - Missing State Information";
      }
      stateAbbr = STATE_ABBR_BY_FIPS[attributes.STATE] || attributes.STATE;
    } else if (type === "zip") {
      // For ZIP codes, we might not have a direct STATE field, use "Unknown" as fallback
      stateAbbr = "US"; // Default for ZIP codes when state is unknown
    } else {
      stateAbbr =
        attributes.STATE_ABBR ||
        (stateFips ? STATE_ABBR_BY_FIPS[stateFips] : "Unknown");
    }

    switch (type) {
      case "county":
        if (!locationName) return "Invalid Location - Missing County Name";
        return `${locationName} County, ${stateAbbr}`;

      case "place":
        if (!locationName) return "Invalid Location - Missing Place Name";
        if (placeType) {
          return `${locationName} ${placeType}, ${stateAbbr}`;
        }
        return `${locationName}, ${stateAbbr}`;

      case "zip":
        if (!attributes.ZCTA5) return "Invalid Location - Missing ZIP Code";

        // Always return only the ZIP code without state information
        return `${attributes.ZCTA5}`;

      case "tract":
        return attributes.FIPS || "Invalid Tract - Missing FIPS Code";

      case "blockgroup":
        return attributes.FIPS || "Invalid Block Group - Missing FIPS Code";

      case "block":
        if (attributes.GEOID) return attributes.GEOID;
        if (!stateFips) return "Invalid Block - Missing State Information";
        const s = pad(stateFips, 2);
        const c = pad(countyFips, 3);
        const t = pad(tractFips, 6);
        const numericPart = blockVal.replace(/[^\d]/g, "");
        const letterPart = blockVal.replace(/\d/g, "");
        const paddedBlock = pad(numericPart, 4) + letterPart;
        return `${s}${c}${t}${paddedBlock}`;

      case "country":
        if (attributes.COUNTRY) {
          return attributes.COUNTRY;
        }
        if (attributes.ISO) {
          return `${locationName} (${attributes.ISO})`;
        }
        return locationName || "Unknown Country";

      case "state":
        return locationName || "Unknown State";

      default:
        return locationName || "Unknown Location";
    }
  }

  const [layersReady, setLayersReady] = useState(false);
  
  
  const initializeGraphicsLayers = useCallback(async () => {
      console.log("🔍 [MapContext] Initializing the application's graphics layer...");

      if (!mapView || mapView.destroyed) {
        console.log("🔍 [MapContext] Cannot initialize: mapView is missing or destroyed.");
        return;
      }

      try {
        // Ensure the view is ready before proceeding
        await mapView.when();

        // Dynamically import GraphicsLayer right when it's needed
        const { default: GraphicsLayer } = await import("@arcgis/core/layers/GraphicsLayer");

        // If a graphics layer from a previous session exists, remove it.
        if (selectionGraphicsLayerRef.current) {
          mapView.map.remove(selectionGraphicsLayerRef.current);
        }

        // Create the graphics layer.
        const selectionLayer = new GraphicsLayer({
          title: "Market Area and Selection Graphics",
          listMode: "hide"
        });

        // Add the layer to the map.
        mapView.map.add(selectionLayer);
        await selectionLayer.when();

        // Store the reference and set the ready state.
        selectionGraphicsLayerRef.current = selectionLayer;
        setLayersReady(true);
        
        console.log("🔍 [MapContext] ✅ Graphics layer is ready.");

      } catch (error) {
          console.error("🔍 [MapContext] A critical error during graphics layer initialization:", error);
          setLayersReady(false);
      }
    }, [mapView]);


  const extractRadiusInfo = useCallback((marketArea) => {
    if (!marketArea) return null;

    try {
      // Case 1: Direct radius_points property
      if (marketArea.radius_points) {
        let radiusPoints;

        // Parse if it's a string
        if (typeof marketArea.radius_points === "string") {
          try {
            radiusPoints = JSON.parse(marketArea.radius_points);
          } catch (e) {
            console.warn(
              `Failed to parse radius_points for market area ${marketArea.id}:`,
              e
            );
            return null;
          }
        } else {
          radiusPoints = marketArea.radius_points;
        }

        // Normalize to array format
        if (!Array.isArray(radiusPoints)) {
          radiusPoints = [radiusPoints];
        }

        // Validate and normalize each point
        return radiusPoints
          .map((point) => {
            if (!point) return null;

            // Create a normalized point structure
            const normalizedPoint = {
              center: point.center || point.point || null,
              radii: Array.isArray(point.radii)
                ? point.radii
                : point.radius
                ? [point.radius]
                : [5], // Default 5-mile radius
              style: point.style || marketArea.style || null,
            };

            // Skip invalid points
            if (!normalizedPoint.center) {
              console.warn(
                `Invalid radius point in market area ${marketArea.id}: missing center`
              );
              return null;
            }

            return normalizedPoint;
          })
          .filter(Boolean); // Remove any null entries
      }

      // Case 2: Check for ma_geometry_data
      else if (marketArea.ma_geometry_data) {
        let geoData;

        // Parse if it's a string
        if (typeof marketArea.ma_geometry_data === "string") {
          try {
            geoData = JSON.parse(marketArea.ma_geometry_data);
          } catch (e) {
            console.warn(
              `Failed to parse ma_geometry_data for market area ${marketArea.id}:`,
              e
            );
            return null;
          }
        } else {
          geoData = marketArea.ma_geometry_data;
        }

        // Convert to radius point format
        if (geoData.center || geoData.point) {
          return [
            {
              center: geoData.center || geoData.point,
              radii: Array.isArray(geoData.radii)
                ? geoData.radii
                : geoData.radius
                ? [geoData.radius]
                : [5], // Default 5-mile radius
              style: geoData.style || marketArea.style || null,
            },
          ];
        }
      }

      // Case 3: Check for geometry property that might contain coordinates
      else if (marketArea.geometry) {
        // Try to extract center point from geometry
        const geo = marketArea.geometry;

        if (geo.x !== undefined && geo.y !== undefined) {
          // Web Mercator or similar coordinates
          return [
            {
              center: {
                x: geo.x,
                y: geo.y,
                spatialReference: geo.spatialReference,
              },
              radii: [5], // Default 5-mile radius
              style: marketArea.style || null,
            },
          ];
        } else if (geo.longitude !== undefined && geo.latitude !== undefined) {
          // Geographic coordinates
          return [
            {
              center: {
                longitude: geo.longitude,
                latitude: geo.latitude,
                spatialReference: geo.spatialReference,
              },
              radii: [5], // Default 5-mile radius
              style: marketArea.style || null,
            },
          ];
        } else if (geo.rings && geo.rings.length > 0) {
          // Polygon - we could calculate centroid here if needed
          console.warn(
            "Polygon geometry found where radius expected:",
            marketArea.id
          );
          return null;
        }
      }

      // Case 4: Last resort - create a default radius in a reasonable location
      console.warn(
        `No valid radius data found for market area ${marketArea.id}, using default`
      );
      return [
        {
          center: {
            longitude: -117.8311, // Orange County location
            latitude: 33.7175,
          },
          radii: [5], // Default 5-mile radius
          style: marketArea.style || null,
        },
      ];
    } catch (error) {
      console.error(
        `Error extracting radius info for market area ${marketArea.id}:`,
        error
      );
      return null;
    }
  }, []);

// =======================================================================================
// COMPLETE REPLACEMENT FOR ensureValidGeometry FUNCTION
// Replace your existing ensureValidGeometry function with this enhanced version
// =======================================================================================

const ensureValidGeometry = async (geometry, spatialReference) => {
  console.log("🔍 [GEOMETRY DEBUG] ensureValidGeometry - Starting validation:", {
    hasGeometry: !!geometry,
    geometryType: geometry?.type,
    hasRings: !!geometry?.rings,
    ringsLength: geometry?.rings?.length,
    hasSpatialReference: !!geometry?.spatialReference,
    providedSpatialReference: !!spatialReference
  });

  if (!geometry) {
    console.warn("🔍 [GEOMETRY DEBUG] Geometry is null or undefined");
    return null;
  }

  try {
    // Import required geometry modules
    const [
      { default: Point },
      { default: Polygon },
      { default: Polyline },
      { default: SpatialReference }
    ] = await Promise.all([
      import("@arcgis/core/geometry/Point"),
      import("@arcgis/core/geometry/Polygon"),
      import("@arcgis/core/geometry/Polyline"),
      import("@arcgis/core/geometry/SpatialReference")
    ]);

    // Ensure we have a valid spatial reference
    let validSpatialReference;
    if (spatialReference instanceof SpatialReference) {
      validSpatialReference = spatialReference;
    } else if (spatialReference && typeof spatialReference === 'object') {
      validSpatialReference = new SpatialReference(spatialReference);
    } else if (geometry.spatialReference) {
      if (geometry.spatialReference instanceof SpatialReference) {
        validSpatialReference = geometry.spatialReference;
      } else {
        validSpatialReference = new SpatialReference(geometry.spatialReference);
      }
    } else {
      // Default to Web Mercator
      validSpatialReference = new SpatialReference({ wkid: 102100 });
    }

    console.log("🔍 [GEOMETRY DEBUG] Using spatial reference:", {
      wkid: validSpatialReference.wkid,
      latestWkid: validSpatialReference.latestWkid
    });

    // Handle different geometry input formats
    let validatedGeometry = null;

    // Case 1: Already a valid ArcGIS geometry object
    if (geometry.type && (geometry instanceof Point || geometry instanceof Polygon || geometry instanceof Polyline)) {
      console.log("🔍 [GEOMETRY DEBUG] Geometry is already a valid ArcGIS geometry object");
      
      // Ensure it has the correct spatial reference
      if (!geometry.spatialReference || 
          geometry.spatialReference.wkid !== validSpatialReference.wkid) {
        
        // Create new geometry with correct spatial reference
        if (geometry instanceof Polygon) {
          validatedGeometry = new Polygon({
            rings: geometry.rings,
            spatialReference: validSpatialReference
          });
        } else if (geometry instanceof Point) {
          validatedGeometry = new Point({
            x: geometry.x,
            y: geometry.y,
            spatialReference: validSpatialReference
          });
        } else if (geometry instanceof Polyline) {
          validatedGeometry = new Polyline({
            paths: geometry.paths,
            spatialReference: validSpatialReference
          });
        }
        
        console.log("🔍 [GEOMETRY DEBUG] Updated spatial reference on existing geometry");
      } else {
        validatedGeometry = geometry;
        console.log("🔍 [GEOMETRY DEBUG] Using existing geometry as-is");
      }
    }
    
    // Case 2: Point-like object with coordinates
    else if (geometry.longitude !== undefined && geometry.latitude !== undefined) {
      console.log("🔍 [GEOMETRY DEBUG] Creating Point from longitude/latitude");
      validatedGeometry = new Point({
        longitude: geometry.longitude,
        latitude: geometry.latitude,
        spatialReference: validSpatialReference,
      });
    }
    
    // Case 3: Point-like object with x/y coordinates
    else if (geometry.x !== undefined && geometry.y !== undefined) {
      console.log("🔍 [GEOMETRY DEBUG] Creating Point from x/y coordinates");
      validatedGeometry = new Point({
        x: geometry.x,
        y: geometry.y,
        spatialReference: validSpatialReference,
      });
    }
    
    // Case 4: Polygon with rings
    else if (geometry.rings && Array.isArray(geometry.rings) && geometry.rings.length > 0) {
      console.log("🔍 [GEOMETRY DEBUG] Creating Polygon from rings:", {
        ringCount: geometry.rings.length,
        firstRingLength: geometry.rings[0]?.length
      });
      
      // Validate rings structure
      const validRings = geometry.rings.filter(ring => {
        return Array.isArray(ring) && ring.length >= 3 && 
               ring.every(coord => Array.isArray(coord) && coord.length >= 2);
      });
      
      if (validRings.length === 0) {
        console.error("🔍 [GEOMETRY DEBUG] No valid rings found in polygon geometry");
        return null;
      }
      
      validatedGeometry = new Polygon({
        rings: validRings,
        spatialReference: validSpatialReference,
      });
    }
    
    // Case 5: Polyline with paths  
    else if (geometry.paths && Array.isArray(geometry.paths) && geometry.paths.length > 0) {
      console.log("🔍 [GEOMETRY DEBUG] Creating Polyline from paths");
      validatedGeometry = new Polyline({
        paths: geometry.paths,
        spatialReference: validSpatialReference,
      });
    }
    
    // Case 6: Plain object that might need to be converted to proper geometry
    else if (geometry.type) {
      console.log("🔍 [GEOMETRY DEBUG] Converting plain object to geometry:", geometry.type);
      
      switch (geometry.type.toLowerCase()) {
        case 'point':
          if (geometry.coordinates && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
            validatedGeometry = new Point({
              x: geometry.coordinates[0],
              y: geometry.coordinates[1],
              spatialReference: validSpatialReference,
            });
          }
          break;
          
        case 'polygon':
          if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
            validatedGeometry = new Polygon({
              rings: geometry.coordinates,
              spatialReference: validSpatialReference,
            });
          }
          break;
          
        case 'linestring':
        case 'polyline':
          if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
            validatedGeometry = new Polyline({
              paths: [geometry.coordinates],
              spatialReference: validSpatialReference,
            });
          }
          break;
          
        default:
          console.warn("🔍 [GEOMETRY DEBUG] Unrecognized geometry type:", geometry.type);
      }
    }
    
    // Case 7: Last resort - try to extract any usable coordinate data
    else {
      console.log("🔍 [GEOMETRY DEBUG] Attempting last resort geometry extraction");
      
      // Look for any coordinate-like properties
      const keys = Object.keys(geometry);
      console.log("🔍 [GEOMETRY DEBUG] Available geometry properties:", keys);
      
      // Try to find coordinates in various formats
      for (const key of ['coordinates', 'coords', 'points', 'vertices']) {
        if (geometry[key] && Array.isArray(geometry[key])) {
          console.log(`🔍 [GEOMETRY DEBUG] Found coordinates in property: ${key}`);
          
          // Simple point coordinates
          if (geometry[key].length === 2 && typeof geometry[key][0] === 'number') {
            validatedGeometry = new Point({
              x: geometry[key][0],
              y: geometry[key][1],
              spatialReference: validSpatialReference,
            });
            break;
          }
          // Polygon rings
          else if (Array.isArray(geometry[key][0])) {
            validatedGeometry = new Polygon({
              rings: geometry[key],
              spatialReference: validSpatialReference,
            });
            break;
          }
        }
      }
    }

    // Final validation
    if (!validatedGeometry) {
      console.error("🔍 [GEOMETRY DEBUG] Failed to create valid geometry from input:", {
        inputType: typeof geometry,
        inputKeys: Object.keys(geometry || {}),
        hasType: !!geometry?.type,
        hasRings: !!geometry?.rings,
        hasCoordinates: !!geometry?.coordinates
      });
      return null;
    }

    // Verify the geometry is properly constructed
    if (!validatedGeometry.type) {
      console.error("🔍 [GEOMETRY DEBUG] Created geometry missing type property");
      return null;
    }

    console.log("🔍 [GEOMETRY DEBUG] Successfully created valid geometry:", {
      type: validatedGeometry.type,
      hasSpatialReference: !!validatedGeometry.spatialReference,
      spatialReferenceWkid: validatedGeometry.spatialReference?.wkid,
      extent: validatedGeometry.extent ? {
        xmin: validatedGeometry.extent.xmin,
        ymin: validatedGeometry.extent.ymin,
        xmax: validatedGeometry.extent.xmax,
        ymax: validatedGeometry.extent.ymax
      } : null
    });

    return validatedGeometry;

  } catch (error) {
    console.error("🔍 [GEOMETRY DEBUG] Error in ensureValidGeometry:", error);
    console.error("🔍 [GEOMETRY DEBUG] Input geometry that caused error:", geometry);
    return null;
  }
};

  // Add these function implementations before your useMemo context value in MapContext.jsx

  // Basic point drawing function
  const drawPoint = useCallback(
    async (center, pointStyle, marketAreaId = "temporary", order = 0) => {
      if (!center?.longitude || !center?.latitude) {
        console.error("Invalid center point", center);
        return null;
      }

      try {
        const { default: Graphic } = await import("@arcgis/core/Graphic");
        const { default: Point } = await import("@arcgis/core/geometry/Point");
        const { default: SimpleMarkerSymbol } = await import(
          "@arcgis/core/symbols/SimpleMarkerSymbol"
        );
        const { default: Color } = await import("@arcgis/core/Color");

        // Ensure selection graphics layer exists
        if (!selectionGraphicsLayerRef.current) {
          console.error("Selection graphics layer not initialized");
          return null;
        }

        // Create the point geometry
        const pointGeometry = new Point({
          longitude: center.longitude,
          latitude: center.latitude,
          spatialReference: center.spatialReference || { wkid: 4326 },
        });

        // Create the point symbol
        const pointSymbol = new SimpleMarkerSymbol({
          color: new Color(pointStyle?.color || "#0078D4"),
          size: pointStyle?.size || 10,
          outline: {
            color: new Color(pointStyle?.outline?.color || "#ffffff"),
            width: pointStyle?.outline?.width || 1,
          },
        });

        // Create the point graphic
        const pointGraphic = new Graphic({
          geometry: pointGeometry,
          symbol: pointSymbol,
          attributes: {
            FEATURE_TYPE: "drivetime_point",
            marketAreaId: marketAreaId,
            order: order,
            isTemporary:
              marketAreaId === "temporary" || marketAreaId === "temp",
          },
        });

        // Add the graphic to the selection layer
        selectionGraphicsLayerRef.current.add(pointGraphic);

        return pointGraphic;
      } catch (error) {
        console.error("Error drawing point:", error);
        throw error;
      }
    },
    [selectionGraphicsLayerRef]
  );

  const calculateDriveTimePolygon = useCallback(async (point) => {
    try {
      // Load required ESRI modules with the correct approach
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const { default: FeatureSet } = await import(
        "@arcgis/core/rest/support/FeatureSet"
      );
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      const { default: ServiceAreaParameters } = await import(
        "@arcgis/core/rest/support/ServiceAreaParameters"
      );
      const serviceAreaModule = await import("@arcgis/core/rest/serviceArea");

      // Get the API key
      const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
      if (!apiKey) {
        throw new Error("ArcGIS API Key is missing");
      }

      // Create point geometry
      const pointGeom = new Point({
        longitude: point.center.longitude,
        latitude: point.center.latitude,
        spatialReference: { wkid: 4326 },
      });

      console.log("Calculating drive time area for point:", {
        longitude: pointGeom.longitude,
        latitude: pointGeom.latitude,
        minutes: point.travelTimeMinutes,
      });

      // Create point graphic for the feature set
      const pointGraphic = new Graphic({
        geometry: pointGeom,
      });

      // Create a feature set with the point
      const featureSet = new FeatureSet({
        features: [pointGraphic],
      });

      // The service URL
      const serviceUrl =
        "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World";

      console.log("Calling service area solve");

      // Update the params object in calculateDriveTimePolygon
      const params = new ServiceAreaParameters({
        facilities: featureSet,
        defaultBreaks: [parseInt(point.travelTimeMinutes)],
        outSpatialReference: { wkid: 4326 },
        returnPolygons: true,
        travelMode: {
          attributeParameterValues: [], // Add this - required even if empty
          description: "Driving time for cars",
          impedanceAttributeName: "TravelTime",
          simplificationToleranceUnits: "meters", // Change from "esriMeters"
          type: "automobile", // Change from "AUTOMOBILE" - lowercase is required
          useHierarchy: true,
          restrictUTurns: "esriNFSBAtDeadEndsAndIntersections",
          simplificationTolerance: 2,
          timeAttributeName: "TravelTime",
          distanceAttributeName: "Miles",
          name: "Driving Time",
        },
      });
      // Make the request with proper authentication
      const requestOptions = {
        query: {
          f: "json",
          token: apiKey,
        },
      };

      // Call the service area with the correct module approach
      const result = await serviceAreaModule.solve(
        serviceUrl,
        params,
        requestOptions
      );

      // Extract the polygon from the result
      if (result?.serviceAreaPolygons?.features?.length > 0) {
        const polygon = result.serviceAreaPolygons.features[0].geometry;
        console.log("Successfully generated drive time polygon");
        return polygon;
      } else {
        console.warn(
          "Service area response did not contain polygon data, using fallback"
        );
        return createFallbackBuffer(pointGeom, point.travelTimeMinutes);
      }
    } catch (error) {
      console.error("Error calculating drive time polygon:", error);
      // Use fallback buffer
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const pointGeom = new Point({
        longitude: point.center.longitude,
        latitude: point.center.latitude,
        spatialReference: { wkid: 4326 },
      });
      return createFallbackBuffer(pointGeom, point.travelTimeMinutes);
    }
  }, []);

  const drawDriveTimePolygon = useCallback(
    async (
      point,
      styleSettings = {
        fillColor: "#0078D4",
        fillOpacity: 0.35,
        borderColor: "#0078D4",
        borderWidth: 3,
      },
      marketAreaId = "temporary",
      order = 0
    ) => {
      console.log("🔍 [LAYER ORDER DEBUG] drawDriveTimePolygon - Starting");
      console.log("🔍 [LAYER ORDER DEBUG] Drive time polygon info:", {
        marketAreaId,
        hasPoint: !!point,
        hasCenter: !!point?.center,
        styleSettings,
        currentGraphicsCount:
          selectionGraphicsLayerRef.current?.graphics?.length || 0,
      });

      try {
        // CRITICAL: Add comprehensive null checks at the beginning
        if (!mapView) {
          console.error("🔍 [LAYER ORDER DEBUG] MapView is not available - cannot draw drive time polygon");
          throw new Error("MapView is not initialized");
        }

        if (!mapView.map) {
          console.error("🔍 [LAYER ORDER DEBUG] MapView.map is not available - cannot draw drive time polygon");
          throw new Error("Map is not initialized on MapView");
        }

        if (!selectionGraphicsLayerRef.current) {
          console.error("🔍 [LAYER ORDER DEBUG] Selection graphics layer not initialized");
          throw new Error("Selection graphics layer is not available");
        }

        // Verify mapView is ready before proceeding
        if (mapView.destroyed) {
          console.error("🔍 [LAYER ORDER DEBUG] MapView has been destroyed");
          throw new Error("MapView has been destroyed");
        }

        // Log current layer position with safe access
        const layerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
        console.log("🔍 [LAYER ORDER DEBUG] Graphics layer current position:", {
          index: layerIndex,
          totalLayers: mapView.map.layers.length,
        });

        if (!point || (!point.polygon && !point.center)) {
          console.error("🔍 [LAYER ORDER DEBUG] Invalid drive time point:", point);
          return;
        }

        let polygon = point.polygon || point.driveTimePolygon;

        if (!polygon && point.center) {
          try {
            console.log("🔍 [LAYER ORDER DEBUG] Calculating drive time polygon for:", {
              longitude: point.center.longitude,
              latitude: point.center.latitude,
              minutes: point.travelTimeMinutes || point.timeRanges?.[0] || 15,
            });
            polygon = await calculateDriveTimePolygon({
              center: point.center,
              travelTimeMinutes:
                point.travelTimeMinutes || point.timeRanges?.[0] || 15,
            });
          } catch (calcError) {
            console.error("🔍 [LAYER ORDER DEBUG] Error calculating drive time polygon:", calcError);
            return;
          }
        }

        if (!polygon) {
          console.error("🔍 [LAYER ORDER DEBUG] No polygon found or calculated for drive time point");
          return;
        }

        const [
          { default: Graphic },
          { default: Polygon },
          { default: SimpleFillSymbol },
          { default: SimpleLineSymbol },
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/Polygon"),
          import("@arcgis/core/symbols/SimpleFillSymbol"),
          import("@arcgis/core/symbols/SimpleLineSymbol"),
        ]);

        console.log("🔍 [LAYER ORDER DEBUG] Drawing drive time polygon with styles:", {
          fillColor: styleSettings.fillColor,
          fillOpacity: styleSettings.fillOpacity,
          borderColor: styleSettings.borderColor,
          borderWidth: styleSettings.borderWidth,
          isNoFill: styleSettings.fillOpacity === 0,
          isNoBorder: styleSettings.borderWidth === 0,
        });

        // Remove existing drive time graphics for this market area
        if (marketAreaId !== "temporary") {
          const existingGraphics = selectionGraphicsLayerRef.current.graphics.filter(
            (g) =>
              g.attributes?.marketAreaId === marketAreaId &&
              (g.attributes?.FEATURE_TYPE === "drivetime" ||
                g.attributes?.FEATURE_TYPE === "drivetime_point")
          );

          if (existingGraphics.length > 0) {
            console.log(
              `🔍 [LAYER ORDER DEBUG] Removing ${existingGraphics.length} existing drive time graphics for ${marketAreaId}`
            );
            selectionGraphicsLayerRef.current.removeMany(existingGraphics);
          }
        }

        const fillSymbol = new SimpleFillSymbol({
          color:
            styleSettings.fillOpacity > 0
              ? [
                  parseInt(styleSettings.fillColor.slice(1, 3), 16),
                  parseInt(styleSettings.fillColor.slice(3, 5), 16),
                  parseInt(styleSettings.fillColor.slice(5, 7), 16),
                  styleSettings.fillOpacity,
                ]
              : [0, 0, 0, 0],
          outline: new SimpleLineSymbol({
            color: styleSettings.borderColor,
            width: styleSettings.borderWidth,
            style: styleSettings.borderWidth === 0 ? "none" : "solid",
          }),
        });

        // Ensure polygon is properly formatted
        if (!(polygon instanceof Polygon)) {
          if (polygon.rings || polygon.paths) {
            polygon = new Polygon({
              rings: polygon.rings || polygon.paths,
              spatialReference: polygon.spatialReference || { wkid: 4326 },
            });
          } else {
            console.error("🔍 [LAYER ORDER DEBUG] Invalid polygon format:", polygon);
            return;
          }
        }

        const polygonGraphic = new Graphic({
          geometry: polygon,
          symbol: fillSymbol,
          attributes: {
            marketAreaId,
            order,
            FEATURE_TYPE: "drivetime",
            travelTimeMinutes:
              point.travelTimeMinutes || point.timeRanges?.[0] || 15,
            isTemporary:
              marketAreaId === "temporary" || marketAreaId === "temp",
          },
        });

        // Final safety check before adding to layer
        if (!selectionGraphicsLayerRef.current || selectionGraphicsLayerRef.current.destroyed) {
          console.error("🔍 [LAYER ORDER DEBUG] Graphics layer became unavailable during polygon creation");
          throw new Error("Graphics layer is no longer available");
        }

        selectionGraphicsLayerRef.current.add(polygonGraphic);

        console.log("🔍 [LAYER ORDER DEBUG] Added drive time polygon graphic:", {
          marketAreaId,
          totalGraphicsNow: selectionGraphicsLayerRef.current.graphics.length,
          graphicsLayerIndex: mapView.map.layers.indexOf(selectionGraphicsLayerRef.current),
          symbolType: fillSymbol.type,
        });

        return polygon;
      } catch (error) {
        console.error("🔍 [LAYER ORDER DEBUG] Error drawing drive time polygon:", error);
        throw error;
      }
    },
    [selectionGraphicsLayerRef, calculateDriveTimePolygon, mapView] // Added mapView to dependencies
  );

  // Helper function to create a fallback buffer
  const createFallbackBuffer = async (pointGeom, minutes) => {
    try {
      const { geodesicBuffer } = await import(
        "@arcgis/core/geometry/geometryEngine"
      );

      console.log("Creating fallback buffer for", minutes, "minutes");

      // Create a buffer with a reasonable approximation of driving distance
      // ~800-1000 meters per minute in average driving conditions
      const radiusMeters = minutes * 800;
      const buffer = geodesicBuffer(pointGeom, radiusMeters, "meters");

      console.log("Successfully created fallback buffer");
      return buffer;
    } catch (bufferError) {
      console.error("Error creating fallback buffer:", bufferError);

      // Last resort: create a simple square around the point
      try {
        const { default: Polygon } = await import(
          "@arcgis/core/geometry/Polygon"
        );

        const lon = pointGeom.longitude;
        const lat = pointGeom.latitude;
        const offset = (0.01 * minutes) / 10; // Simple scaling

        return new Polygon({
          rings: [
            [
              [lon - offset, lat - offset],
              [lon + offset, lat - offset],
              [lon + offset, lat + offset],
              [lon - offset, lat + offset],
              [lon - offset, lat - offset],
            ],
          ],
          spatialReference: { wkid: 4326 },
        });
      } catch (finalError) {
        console.error("All fallbacks failed");
        throw new Error("Unable to create drive time area");
      }
    }
  };

  const zoomToExtent = useCallback(
    async (extent) => {
      if (!mapView) {
        console.log(
          "[MapContext] Cannot zoom to extent: mapView not initialized"
        );
        return;
      }

      try {
        await mapView.goTo(extent, {
          duration: 1000,
          easing: "ease-in-out",
        });
        console.log("[MapContext] Successfully zoomed to extent");
      } catch (error) {
        console.error("[MapContext] Error zooming to extent:", error);
      }
    },
    [mapView]
  );

  const zoomToMarketArea = useCallback(
    async (marketAreaId) => {
      if (!mapView || !selectionGraphicsLayerRef.current) {
        console.log(
          "[MapContext] Cannot zoom to market area: prerequisites not met"
        );
        return;
      }

      try {
        // Find all graphics associated with this market area
        const marketAreaGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (graphic) => graphic.attributes?.marketAreaId === marketAreaId
          );

        if (marketAreaGraphics.length === 0) {
          console.log(
            `[MapContext] No graphics found for market area: ${marketAreaId}`
          );
          return;
        }

        // Create a union of all geometries or get first geometry's extent
        let targetExtent;

        if (marketAreaGraphics.length === 1) {
          targetExtent = marketAreaGraphics[0].geometry.extent;
        } else {
          const geometries = marketAreaGraphics
            .map((g) => g.geometry)
            .filter(Boolean);

          if (geometries.length > 0) {
            try {
              // Try to get a union of all geometries
              const union = await geometryEngineAsync.union(geometries);
              targetExtent = union.extent;
            } catch (error) {
              console.warn(
                "[MapContext] Failed to union geometries, using first geometry extent",
                error
              );
              targetExtent = geometries[0].extent;
            }
          }
        }

        if (targetExtent) {
          // Add a buffer to the extent for better visibility
          targetExtent.expand(1.2);

          await mapView.goTo(targetExtent, {
            duration: 1000,
            easing: "ease-in-out",
          });
          console.log(
            `[MapContext] Successfully zoomed to market area: ${marketAreaId}`
          );
        }
      } catch (error) {
        console.error("[MapContext] Error zooming to market area:", error);
      }
    },
    [mapView]
  );

  // Add these state variables near the top of your component with the other useState declarations
  const [isOutsideZoomRange, setIsOutsideZoomRange] = useState(false);
  const [zoomMessage, setZoomMessage] = useState("");

  // Add this effect to monitor zoom range
  useEffect(() => {
    if (!mapView) return;

    const checkZoomRange = () => {
      const currentZoom = mapView.zoom;
      const currentScale = mapView.scale;

      // Set your zoom/scale constraints here
      if (currentZoom < 6) {
        setIsOutsideZoomRange(true);
        setZoomMessage("Zoom in to see more detail");
      } else if (currentZoom > 20) {
        setIsOutsideZoomRange(true);
        setZoomMessage("Zoom out to see more context");
      } else {
        setIsOutsideZoomRange(false);
        setZoomMessage("");
      }
    };

    // Check initially
    checkZoomRange();

    // Check when zoom changes
    const zoomHandler = mapView.watch("zoom", checkZoomRange);

    return () => {
      if (zoomHandler) {
        zoomHandler.remove();
      }
    };
  }, [mapView]);

  const drawRadius = useCallback(
    async (point, style = null, marketAreaId = null, order = 0) => {
      console.log(
        "🔍 [LAYER ORDER DEBUG] drawRadius - Starting to draw radius"
      );
      console.log("🔍 [LAYER ORDER DEBUG] Current graphics layer info:", {
        hasGraphicsLayer: !!selectionGraphicsLayerRef.current,
        graphicsCount: selectionGraphicsLayerRef.current?.graphics?.length || 0,
        layerTitle: selectionGraphicsLayerRef.current?.title,
      });

      if (!selectionGraphicsLayerRef.current || !point || !mapView) {
        console.warn(
          "🔍 [LAYER ORDER DEBUG] Cannot draw radius: Missing requirements"
        );
        return;
      }

      if (selectionGraphicsLayerRef.current) {
        const layerIndex = mapView.map.layers.indexOf(
          selectionGraphicsLayerRef.current
        );
        console.log(
          "🔍 [LAYER ORDER DEBUG] Graphics layer position in map layers:",
          {
            index: layerIndex,
            totalMapLayers: mapView.map.layers.length,
          }
        );
      }

      try {
        const [
          { default: Graphic },
          { geodesicBuffer },
          { webMercatorToGeographic },
          { default: Point },
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/geometryEngine"),
          import("@arcgis/core/geometry/support/webMercatorUtils"),
          import("@arcgis/core/geometry/Point"),
        ]);

        let centerLon, centerLat;
        if (
          point.center.longitude !== undefined &&
          point.center.latitude !== undefined
        ) {
          centerLon = point.center.longitude;
          centerLat = point.center.latitude;
        } else if (
          point.center.x !== undefined &&
          point.center.y !== undefined
        ) {
          centerLon = point.center.x;
          centerLat = point.center.y;
        } else if (Array.isArray(point.center) && point.center.length >= 2) {
          centerLon = point.center[0];
          centerLat = point.center[1];
        } else {
          console.error(
            "🔍 [LAYER ORDER DEBUG] Could not extract valid coordinates from point:",
            point.center
          );
          return;
        }

        console.log("🔍 [LAYER ORDER DEBUG] DrawRadius using coordinates:", {
          longitude: centerLon,
          latitude: centerLat,
          marketAreaId,
          radiiCount: point.radii?.length,
        });

        const centerPoint = new Point({
          longitude: centerLon,
          latitude: centerLat,
          spatialReference:
            point.center.spatialReference || mapView.spatialReference,
        });

        let geographicPoint = centerPoint;
        const isWebMercator =
          centerPoint.spatialReference &&
          (centerPoint.spatialReference.wkid === 102100 ||
            centerPoint.spatialReference.wkid === 3857 ||
            centerPoint.spatialReference.latestWkid === 3857);

        if (isWebMercator) {
          try {
            geographicPoint = webMercatorToGeographic(centerPoint);
            console.log(
              "🔍 [LAYER ORDER DEBUG] Converted to geographic coordinates"
            );
          } catch (error) {
            console.warn(
              "🔍 [LAYER ORDER DEBUG] Failed to convert to geographic coordinates:",
              error
            );
          }
        }

        if (marketAreaId) {
          const existingRadiusGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) =>
                g.attributes?.marketAreaId === marketAreaId &&
                g.attributes?.FEATURE_TYPE === "radius"
            );

          if (existingRadiusGraphics.length > 0) {
            console.log(
              `🔍 [LAYER ORDER DEBUG] Removing ${existingRadiusGraphics.length} existing radius graphics for ${marketAreaId}`
            );
            selectionGraphicsLayerRef.current.removeMany(
              existingRadiusGraphics
            );
          }
        }

        const fillRgb = style?.fillColor
          ? hexToRgb(style.fillColor)
          : [0, 120, 212];
        const outlineRgb = style?.borderColor
          ? hexToRgb(style.borderColor)
          : [0, 120, 212];
        const fillOpacity =
          style?.fillOpacity !== undefined ? style.fillOpacity : 0.35;
        const borderWidth =
          style?.borderWidth !== undefined ? style.borderWidth : 2;

        for (let i = 0; i < point.radii.length; i++) {
          const radiusMiles = point.radii[i];
          const radiusMeters = radiusMiles * 1609.34;

          const polygon = geodesicBuffer(
            geographicPoint,
            radiusMeters,
            "meters"
          );

          if (!polygon) {
            console.warn(
              `🔍 [LAYER ORDER DEBUG] Failed to create buffer for radius ${radiusMiles} miles`
            );
            continue;
          }

          // **START CORRECTION**
          // Corrected symbol definition to handle zero-width borders properly.
          const symbol = {
            type: "simple-fill",
            color: [...fillRgb, fillOpacity],
            outline: {
              color: outlineRgb,
              width: borderWidth,
              style: borderWidth > 0 ? "solid" : "none", // Set style to "none" if width is 0
            },
          };
          // **END CORRECTION**

          const graphic = new Graphic({
            geometry: polygon,
            symbol: symbol,
            attributes: {
              FEATURE_TYPE: "radius",
              marketAreaId: marketAreaId || "temp",
              radiusMiles,
              order,
              circleId: `${marketAreaId || "temp"}-radius-${i}`,
              centerLon,
              centerLat,
            },
          });

          selectionGraphicsLayerRef.current.add(graphic);
          console.log(
            `🔍 [LAYER ORDER DEBUG] Added radius graphic ${i} to graphics layer. Total graphics now: ${selectionGraphicsLayerRef.current.graphics.length}`
          );
        }

        console.log(
          `🔍 [LAYER ORDER DEBUG] Completed drawing radius for market area ${marketAreaId}:`,
          {
            totalGraphicsInLayer:
              selectionGraphicsLayerRef.current.graphics.length,
            radiiDrawn: point.radii.length,
            graphicsLayerIndex: mapView.map.layers.indexOf(
              selectionGraphicsLayerRef.current
            ),
          }
        );
      } catch (error) {
        console.error("🔍 [LAYER ORDER DEBUG] Error in drawRadius:", error);
      }
    },
    [mapView, hexToRgb, selectionGraphicsLayerRef]
  );

  const displayFeatures = useCallback(async (featuresToDraw) => {
    console.log("🔍 [LAYER ORDER DEBUG] displayFeatures - Starting to display features");
    console.log("🔍 [LAYER ORDER DEBUG] Display features input:", {
      featureCount: featuresToDraw.length,
      featureTypes: featuresToDraw.map(f => f.attributes?.FEATURE_TYPE || f.attributes?.ma_type || f.attributes?.type).filter(Boolean),
      marketAreaIds: [...new Set(featuresToDraw.map(f => f.attributes?.marketAreaId).filter(Boolean))]
    });

    if (!mapView || !selectionGraphicsLayerRef.current || !layersReady) {
      console.log("🔍 [LAYER ORDER DEBUG] Cannot display features - prerequisites not met", {
        hasMapView: !!mapView,
        hasGraphicsLayer: !!selectionGraphicsLayerRef.current,
        layersReady
      });
      return;
    }

    // CRITICAL: Verify basemap reference layers before proceeding
    const referenceLayersCount = mapView.map.basemap.referenceLayers.length;
    if (referenceLayersCount === 0) {
      console.warn("🔍 [LAYER ORDER DEBUG] WARNING: No basemap reference layers detected during feature display!");
      console.warn("🔍 [LAYER ORDER DEBUG] Graphics may appear above missing labels. Consider re-initializing graphics layer.");
    }

    // Log current layer state before displaying features
    const layerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
    console.log("🔍 [LAYER ORDER DEBUG] Graphics layer state before display:", {
      index: layerIndex,
      totalMapLayers: mapView.map.layers.length,
      currentGraphicsCount: selectionGraphicsLayerRef.current.graphics.length,
      basemapReferenceLayersCount: referenceLayersCount,
      referenceLayersVisible: mapView.map.basemap.referenceLayers.map(l => l.visible).toArray()
    });

    try {
      const radiusFeatures = featuresToDraw.filter(
        feature => feature.attributes?.FEATURE_TYPE === 'radius' ||
          feature.attributes?.ma_type === 'radius' ||
          feature.attributes?.type === 'radius'
      );

      const polygonFeatures = featuresToDraw.filter(
        feature => feature.attributes?.FEATURE_TYPE !== 'radius' &&
          feature.attributes?.ma_type !== 'radius' &&
          feature.attributes?.type !== 'radius'
      );

      console.log("🔍 [LAYER ORDER DEBUG] Feature categorization:", {
        radiusFeatures: radiusFeatures.length,
        polygonFeatures: polygonFeatures.length
      });

      // Preserve market area graphics that aren't being updated
      const existingMarketAreaGraphics = selectionGraphicsLayerRef.current.graphics.filter(
        (graphic) => {
          const graphicId = graphic.attributes?.marketAreaId;
          return graphicId && !featuresToDraw.some(f => f.attributes?.marketAreaId === graphicId);
        }
      );

      const existingSelectionGraphics = selectionGraphicsLayerRef.current.graphics.filter(
        (graphic) =>
          !graphic.attributes?.marketAreaId &&
          !featuresToDraw.some(
            (f) => f.attributes.FID === graphic.attributes.FID ||
              f.attributes.OBJECTID === graphic.attributes.OBJECTID
          )
      );

      console.log("🔍 [LAYER ORDER DEBUG] Preserving existing graphics:", {
        marketAreaGraphics: existingMarketAreaGraphics.length,
        selectionGraphics: existingSelectionGraphics.length
      });

      // Clear and rebuild graphics while preserving reference layers
      selectionGraphicsLayerRef.current.removeAll();
      
      // Re-add preserved graphics
      existingMarketAreaGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));
      existingSelectionGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));

      const { default: Graphic } = await import("@arcgis/core/Graphic");

      // Process polygon features
      for (const feat of polygonFeatures) {
        try {
          console.log("🔍 [GEOMETRY DEBUG] Processing polygon feature:", {
            hasGeometry: !!feat.geometry,
            geometryType: feat.geometry?.type,
            hasAttributes: !!feat.attributes,
            marketAreaId: feat.attributes?.marketAreaId
          });

          const geometry = await ensureValidGeometry(feat.geometry, mapView.spatialReference);
          
          if (!geometry) {
            console.warn("🔍 [GEOMETRY DEBUG] Skipping feature - invalid geometry:", feat.attributes);
            continue;
          }

          const symbol = SYMBOLS.selectedPolygon;
          
          // Validate symbol before creating graphic
          if (!symbol || !symbol.type) {
            console.error("🔍 [GEOMETRY DEBUG] Invalid symbol for polygon feature");
            continue;
          }

          console.log("🔍 [GEOMETRY DEBUG] Creating graphic with valid geometry and symbol");
          
          const graphic = new Graphic({
            geometry,
            attributes: feat.attributes || {},
            symbol,
          });

          // Validate graphic before adding
          if (!graphic.geometry || !graphic.geometry.type) {
            console.error("🔍 [GEOMETRY DEBUG] Created graphic has invalid geometry");
            continue;
          }

          selectionGraphicsLayerRef.current.add(graphic);
          console.log("🔍 [GEOMETRY DEBUG] Successfully added polygon graphic to layer");
          
        } catch (error) {
          console.error("🔍 [GEOMETRY DEBUG] Error processing polygon feature:", error);
          console.error("🔍 [GEOMETRY DEBUG] Problematic feature:", feat);
          // Continue with next feature instead of failing completely
          continue;
        }
      }

      console.log("🔍 [LAYER ORDER DEBUG] Added polygon features:", polygonFeatures.length);

      // Process radius features
      for (const radiusFeature of radiusFeatures) {
        const { center, radii, marketAreaId, style } = extractRadiusProperties(radiusFeature);

        if (center && radii) {
          await drawRadius(
            { center, radii },
            style,
            marketAreaId || radiusFeature.attributes?.marketAreaId,
            radiusFeature.attributes?.order || 0
          );
          console.log("🔍 [LAYER ORDER DEBUG] Processed radius feature for market area:", marketAreaId);
        } else {
          console.warn("🔍 [LAYER ORDER DEBUG] Invalid radius feature, missing center or radii", radiusFeature);
        }
      }

      // IMPORTANT: Verify reference layers are still properly positioned after adding graphics
      const referenceLayersAfterDisplay = mapView.map.basemap.referenceLayers.length;
      if (referenceLayersAfterDisplay > 0) {
        // Ensure all reference layers are visible and on top
        mapView.map.basemap.referenceLayers.forEach((refLayer, index) => {
          if (!refLayer.visible) {
            refLayer.visible = true;
            console.log(`🔍 [LAYER ORDER DEBUG] Re-enabled reference layer ${index}: ${refLayer.title || refLayer.id}`);
          }
        });
        
        console.log("🔍 [LAYER ORDER DEBUG] Reference layers verified after feature display:", {
          count: referenceLayersAfterDisplay,
          allVisible: mapView.map.basemap.referenceLayers.every(l => l.visible)
        });
      } else {
        console.error("🔍 [LAYER ORDER DEBUG] CRITICAL: Reference layers missing after feature display!");
      }

      // Final logging after all features displayed
      const finalLayerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
      console.log("🔍 [LAYER ORDER DEBUG] Final state after displaying features:", {
        graphicsLayerIndex: finalLayerIndex,
        totalGraphicsInLayer: selectionGraphicsLayerRef.current.graphics.length,
        totalMapLayers: mapView.map.layers.length,
        featuresProcessed: featuresToDraw.length,
        referenceLayersIntact: mapView.map.basemap.referenceLayers.length > 0
      });

    } catch (err) {
      console.error("🔍 [LAYER ORDER DEBUG] Error displaying features:", err);
    }
  }, [mapView, layersReady, activeLayers, ensureValidGeometry, drawRadius]);

  useEffect(() => {
    if (mapView && !layersReady) {
      const initLayers = async () => {
        try {
          await initializeGraphicsLayers();
          // Only proceed with market area display after graphics layer is confirmed ready
          if (marketAreas?.length > 0) {
            const marketArea = marketAreas[0];
            if (marketArea?.locations?.length > 0) {
              // Now safe to display features
              await displayFeatures(marketArea.locations);
            }
          }
        } catch (error) {
          console.error("[MapContext] Error initializing layers:", error);
        }
      };
      initLayers();
    }
  }, [mapView, layersReady, marketAreas]);

  const getLabelingInfo = (type) => {
    let label;

    switch (type) {
      case "zip":
        label = {
          field: "ZIP",
          expressionInfo: {
            expression: "$feature.ZCTA5",
          },
        };
        break;

      case "county":
        label = {
          field: "NAME",
          expressionInfo: {
            expression: `
  var name = Trim($feature.NAME);
  var nameUpper = Upper(name);
  var endsWithCounty = (Right(nameUpper, 6) == "COUNTY");
  IIf(endsWithCounty, name, name + " County")
  `,
          },
        };
        break;

      case "tract":
        label = {
          field: "TRACT_FIPS",
          expressionInfo: {
            expression: `
  Concatenate(
    IIf(IsEmpty($feature.STATE_FIPS) || $feature.STATE_FIPS == '00', '06', $feature.STATE_FIPS),
    $feature.COUNTY_FIPS,
    $feature.TRACT_FIPS
  )
  `,
          },
        };
        break;

      case "blockgroup":
        label = {
          field: "BLOCKGROUP_FIPS",
          expressionInfo: {
            expression: `
  Concatenate(
    $feature.STATE_FIPS,
    $feature.COUNTY_FIPS,
    $feature.TRACT_FIPS,
    $feature.BLOCKGROUP_FIPS
  )
  `,
          },
        };
        break;

      case "block":
        label = {
          field: "BLOCK",
          expressionInfo: {
            expression: `
  Concatenate(
    IIf(IsEmpty($feature.STATE) || $feature.STATE == '00', '06', Text($feature.STATE,'00')),
    Right(Concatenate('000',$feature.COUNTY),3),
    Right(Concatenate('000000',$feature.TRACT),6),
    $feature.BLOCK
  )
  `,
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
          field: "NAME",
          expressionInfo: {
            expression: "$feature.NAME",
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
          field: "NAME", // or any field
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
          color: [0, 0, 0, 1], // Black text
          haloColor: [255, 255, 255, 1], // White halo
          haloSize: 2,
          font: {
            // Adjust specific font sizes for tract, blockgroup, and block
            size:
              type === "block"
                ? 10
                : type === "tract" || type === "blockgroup"
                ? 12
                : 14,
            family: "Noto Sans",
            weight: "bold",
          },
        },
        // CBSA & state visible at all scales
        minScale:
          type === "state" || type === "usa"
            ? 0
            : type === "cbsa" || type === "md"
            ? 0
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

    // Check if we already have this layer initialized
    const existingLayer = featureLayersRef.current[type];
    if (existingLayer && !existingLayer.destroyed) {
      console.log(`[MapContext] Using existing layer for type ${type}`);
      return existingLayer;
    }

    const layerConfig = FEATURE_LAYERS[type];

    try {
      const { default: FeatureLayer } = await import(
        "@arcgis/core/layers/FeatureLayer"
      );
      const { default: GroupLayer } = await import(
        "@arcgis/core/layers/GroupLayer"
      );
      const { default: GraphicsLayer } = await import(
        "@arcgis/core/layers/GraphicsLayer"
      );

      // Special case for drivetime - use a GraphicsLayer instead of FeatureLayer
      if (type === "drivetime") {
        console.log("[MapContext] Creating GraphicsLayer for drive time areas");
        const driveTimeGraphicsLayer = new GraphicsLayer({
          title: "Drive Time Areas",
          listMode: "hide",
          visible: true,
        });

        return driveTimeGraphicsLayer;
      }

      let symbol;
      switch (layerConfig.geometryType.toLowerCase()) {
        case "point":
          symbol = SYMBOLS.defaultPoint;
          break;
        case "polyline":
          symbol = SYMBOLS.defaultPolyline;
          break;
        case "polygon":
        default:
          symbol = SYMBOLS.defaultPolygon;
          break;
      }

      // CBSA or any layer with multiple "urls" in config
      if (layerConfig.urls) {
        // Check if we already have this group layer
        const existingGroup = featureLayersRef.current[type];
        if (existingGroup && !existingGroup.destroyed) {
          return existingGroup;
        }

        const groupLayer = new GroupLayer({
          title: layerConfig.title,
          visible: false,
          listMode: "hide",
        });

        const featureLayers = layerConfig.urls.map((url) => {
          return new FeatureLayer({
            url: url,
            outFields: layerConfig.outFields,
            title: layerConfig.title,
            visible: true,
            opacity: 1,
            popupEnabled: true,
            popupTemplate: layerConfig.popupTemplate,
            renderer: {
              type: "simple",
              symbol: symbol,
            },
            labelingInfo: getLabelingInfo(type),
            labelsVisible: true,
            minScale: 0,
            maxScale: 0,
          });
        });

        groupLayer.addMany(featureLayers);
        groupLayer.featureLayers = featureLayers;
        return groupLayer;
      }

      // Single URL layer
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
        labelsVisible: true,
        minScale: layerConfig.minScale,
        maxScale: layerConfig.maxScale,
      });

      return layer;
    } catch (error) {
      console.error(`Error initializing layer for type ${type}:`, error);
      return null;
    }
  }, []);

  // Reproject geometry to a specific spatial reference
  const reprojectGeometry = async (geometry, sourceSR, targetSR) => {
    if (!geometry || !sourceSR || !targetSR) return geometry;

    try {
      const params = new ProjectParameters({
        geometries: [geometry],
        outSpatialReference: targetSR,
      });

      const projectedGeometries = await geometryService.project(params);
      return projectedGeometries[0];
    } catch (error) {
      console.error("Geometry reprojection error:", error);
      return geometry;
    }
  };

  const incrementalUnion = async (geometries, options = {}) => {
    if (geometries.length === 1) {
      return geometries[0];
    }

    try {
      // Import the new boundary unification function
      const { unifyBoundaries } = await import("./IncrementalUnion");

      // Create feature-like objects for unification
      const features = geometries.map((geometry, index) => ({
        geometry,
        attributes: {
          // Add some basic attributes to help with grouping
          index,
          // You could add more context like STATE, COUNTY, etc. if available
          type: geometry.type,
        },
      }));

      // Use the advanced unification method
      const unifiedGeometry = await unifyBoundaries(features, {
        toleranceMeters: options.toleranceMeters || 10,
        simplificationFactor: options.simplificationFactor || 0.001,
        debugMode: options.debugMode || false,
      });

      return unifiedGeometry;
    } catch (error) {
      console.error(
        "Boundary unification failed, falling back to standard union:",
        error
      );

      // Fallback to original union method
      let unionGeometry = geometries[0];
      for (let i = 1; i < geometries.length; i++) {
        let currentGeometry = geometries[i];

        try {
          unionGeometry = await geometryEngineAsync.union([
            unionGeometry,
            currentGeometry,
          ]);
        } catch (err) {
          console.warn(`Error unioning polygon at index ${i}:`, err);

          // If union fails, try repairing the geometries and re-attempting the union
          unionGeometry = await repairGeometry(unionGeometry);
          currentGeometry = await repairGeometry(currentGeometry);

          try {
            unionGeometry = await geometryEngineAsync.union([
              unionGeometry,
              currentGeometry,
            ]);
          } catch (finalErr) {
            console.warn(
              `Union failed after repairs. Skipping polygon at index ${i}`,
              finalErr
            );
            // Skip this polygon if the union still fails
            continue;
          }
        }

        // Simplify the union geometry after each step
        try {
          unionGeometry = await geometryEngineAsync.simplify(unionGeometry);
        } catch (simplifyErr) {
          console.warn("Error simplifying after union:", simplifyErr);
        }
      }

      return unionGeometry;
    }
  };

  const repairGeometry = async (geometry) => {
    let repairedGeometry = geometry;

    try {
      // Simplify can help remove small irregularities
      repairedGeometry = await geometryEngineAsync.simplify(repairedGeometry);

      // Buffer with 0 distance can fix self-intersections
      repairedGeometry = await geometryEngineAsync.buffer(repairedGeometry, 0);
    } catch (error) {
      console.error("Geometry repair failed:", error);
    }

    return repairedGeometry;
  };

  const addActiveLayer = useCallback(async (type) => {
    console.log(`🔍 [LAYER ORDER DEBUG] addActiveLayer - Adding layer type: ${type}`);
    
    if (type === "radius") {
      console.log("🔍 [LAYER ORDER DEBUG] Skipping radius - not a server-based layer");
      return;
    }
    
    if (!type || !FEATURE_LAYERS[type] || !mapView) {
      console.error(`🔍 [LAYER ORDER DEBUG] Invalid layer type or map not initialized: ${type}`);
      return;
    }
    
    setIsLayerLoading(true);

    try {
      // Log current layer state before adding
      console.log("🔍 [LAYER ORDER DEBUG] Current map state before adding layer:", {
        totalLayers: mapView.map.layers.length,
        operationalLayers: mapView.map.layers.map(l => l.title || l.id).toArray(),
        basemapReferenceLayers: mapView.map.basemap.referenceLayers.map(l => l.title || l.id).toArray(),
        basemapReferenceLayersCount: mapView.map.basemap.referenceLayers.length
      });

      // CRITICAL: Verify basemap has reference layers before proceeding
      if (mapView.map.basemap.referenceLayers.length === 0) {
        console.warn("🔍 [LAYER ORDER DEBUG] WARNING: No basemap reference layers detected when adding feature layer!");
        console.warn("🔍 [LAYER ORDER DEBUG] This may cause layer ordering issues. Consider running initializeGraphicsLayers first.");
      }

      // Hide other layers first
      Object.entries(featureLayersRef.current).forEach(([layerType, layer]) => {
        if (layer && !layer.destroyed && layerType !== type) {
          layer.visible = false;
          console.log(`🔍 [LAYER ORDER DEBUG] Hiding layer ${layerType}`);
        }
      });

      let layer = featureLayersRef.current[type];

      if (!layer) {
        layer = await initializeFeatureLayer(type);
        if (layer) {
          // ENHANCED: Calculate proper insertion index
          // Insert feature layers AFTER graphics layer but BEFORE any other operational layers
          let insertionIndex = 0;
          
          // Find graphics layer index
          const graphicsLayerIndex = selectionGraphicsLayerRef.current ? 
            mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1;
          
          if (graphicsLayerIndex >= 0) {
            // Insert right after graphics layer
            insertionIndex = graphicsLayerIndex + 1;
            console.log(`🔍 [LAYER ORDER DEBUG] Inserting feature layer at index ${insertionIndex} (after graphics layer)`);
          } else {
            // Fallback to index 0 if graphics layer not found
            insertionIndex = 0;
            console.log(`🔍 [LAYER ORDER DEBUG] Graphics layer not found, inserting feature layer at index 0`);
          }
          
          await mapView.map.add(layer, insertionIndex);
          
          // Wait for layer to be added
          await layer.when();
          
          // Log layer order after adding
          console.log("🔍 [LAYER ORDER DEBUG] Layer order after adding feature layer:", {
            totalLayers: mapView.map.layers.length,
            layerOrder: mapView.map.layers.map((l, index) => ({
              index,
              title: l.title || l.id,
              type: l.type,
              visible: l.visible,
              isGraphicsLayer: l === selectionGraphicsLayerRef.current
            })).toArray(),
            graphicsLayerIndex: selectionGraphicsLayerRef.current ? 
              mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1,
            newFeatureLayerIndex: mapView.map.layers.indexOf(layer)
          });
          
          // IMPORTANT: Verify reference layers are still accessible
          const referenceLayersAfter = mapView.map.basemap.referenceLayers.length;
          console.log("🔍 [LAYER ORDER DEBUG] Reference layers after feature layer addition:", {
            count: referenceLayersAfter,
            stillVisible: mapView.map.basemap.referenceLayers.map(l => l.visible).toArray()
          });
          
          featureLayersRef.current[type] = layer;
          console.log(`🔍 [LAYER ORDER DEBUG] New FeatureLayer for type ${type} added and stored`);
        }
      }

      if (layer && !layer.destroyed) {
        try {
          await layer.when();
          layer.visible = true;
          console.log(`🔍 [LAYER ORDER DEBUG] FeatureLayer ${type} set to visible`);
          
          // Ensure layer doesn't have popup conflicts that might affect rendering
          if (layer.popupEnabled) {
            layer.popupEnabled = false;
            console.log(`🔍 [LAYER ORDER DEBUG] Disabled popups for ${type} layer to prevent rendering conflicts`);
          }
          
        } catch (err) {
          console.error(`🔍 [LAYER ORDER DEBUG] Error making layer ${type} visible:`, err);
        }
        
        setActiveLayers((prev) => {
          if (!prev.includes(type)) {
            console.log(`🔍 [LAYER ORDER DEBUG] Adding layer ${type} to activeLayers state`);
            return [...prev, type];
          }
          return prev;
        });
      }

      // Final verification of layer stack integrity
      setTimeout(() => {
        const finalGraphicsIndex = selectionGraphicsLayerRef.current ? 
          mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1;
        const finalReferenceCount = mapView.map.basemap.referenceLayers.length;
        
        console.log("🔍 [LAYER ORDER DEBUG] Final layer stack verification after adding feature layer:", {
          graphicsLayerIndex: finalGraphicsIndex,
          totalOperationalLayers: mapView.map.layers.length,
          basemapReferenceLayersCount: finalReferenceCount,
          layerStackIntact: finalReferenceCount > 0 && finalGraphicsIndex >= 0
        });
      }, 500);

    } catch (error) {
      console.error(`🔍 [LAYER ORDER DEBUG] Error adding active layer ${type}:`, error);
      throw error;
    } finally {
      setIsLayerLoading(false);
    }
  }, [mapView, initializeFeatureLayer]);

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

        // Find graphics to remove using multiple matching criteria
        const graphicsToRemove =
          selectionGraphicsLayerRef.current.graphics.filter((g) => {
            // Match by OBJECTID/FID
            const idMatch =
              g.attributes[uniqueIdField] === feature.attributes[uniqueIdField];
            if (idMatch) return true;

            // For tracts, also try matching by FIPS components
            if (layerType === "tract") {
              const gFips = formatLocationName(
                { attributes: g.attributes },
                "tract"
              );
              const fFips = formatLocationName(
                { attributes: feature.attributes },
                "tract"
              );
              return gFips === fFips;
            }
            return false;
          });

        // Remove matched graphics
        graphicsToRemove.forEach((g) => {
          selectionGraphicsLayerRef.current.remove(g);
          console.log(
            "[MapContext] Graphic removed from selectionGraphicsLayer for feature:",
            g.attributes
          );
        });

        // Update selectedFeatures state using same matching logic
        setSelectedFeatures((prev) => {
          const newSelectedFeatures = prev.filter((f) => {
            const idMatch =
              f.attributes[uniqueIdField] !== feature.attributes[uniqueIdField];
            if (!idMatch) return false;

            if (layerType === "tract") {
              const fFips = formatLocationName(
                { attributes: f.attributes },
                "tract"
              );
              const removeFips = formatLocationName(
                { attributes: feature.attributes },
                "tract"
              );
              return fFips !== removeFips;
            }
            return true;
          });

          // If this was the last selected feature, clean up
          if (newSelectedFeatures.length === 0) {
            const nonMarketAreaGraphics =
              selectionGraphicsLayerRef.current.graphics.filter(
                (g) => g.attributes?.marketAreaId
              );
            selectionGraphicsLayerRef.current.removeAll();
            nonMarketAreaGraphics.forEach((g) =>
              selectionGraphicsLayerRef.current.add(g)
            );
          }

          return newSelectedFeatures;
        });
      } catch (error) {
        console.error("[MapContext] Error in removeFromSelection:", error);
        toast.error("Error removing selection");
      }
    },
    [formatLocationName]
  );

  const addToSelection = useCallback(
    async (feature, layerType) => {
      console.log(
        "[MapContext] addToSelection called with feature:",
        feature.attributes
      );

      if (!mapView) {
        console.warn(
          "[MapContext] Cannot add to selection: mapView not initialized"
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

        // Repair and validate geometry
        let validatedGeometry = feature.geometry;
        try {
          // Repair the geometry first
          validatedGeometry = await repairGeometry(feature.geometry);

          // Ensure correct spatial reference
          if (
            validatedGeometry.spatialReference.wkid !==
            mapView.spatialReference.wkid
          ) {
            validatedGeometry = await reprojectGeometry(
              validatedGeometry,
              validatedGeometry.spatialReference,
              mapView.spatialReference
            );
          }
        } catch (geometryError) {
          console.warn(
            "[MapContext] Geometry validation failed:",
            geometryError
          );
          // If validation fails, fall back to original geometry
          validatedGeometry = feature.geometry;
        }

        // Normalize the incoming feature
        const validAttributes = feature.attributes || {};
        const normalizedFeature = {
          geometry: validatedGeometry,
          attributes: {
            ...validAttributes,
            [uniqueIdField]:
              validAttributes[uniqueIdField] ||
              validAttributes.OBJECTID ||
              validAttributes.FID,
            STATE_FIPS:
              validAttributes.STATE_FIPS ||
              (validAttributes.STATE === "00" ? "06" : validAttributes.STATE) ||
              "06",
            COUNTY_FIPS:
              validAttributes.COUNTY_FIPS || validAttributes.COUNTY || "",
            TRACT_FIPS:
              validAttributes.TRACT_FIPS || validAttributes.TRACT || "",
            STATE_ABBR: validAttributes.STATE_ABBR || "CA",
            STCOFIPS:
              validAttributes.STCOFIPS ||
              `${validAttributes.STATE_FIPS || "06"}${
                validAttributes.COUNTY_FIPS || validAttributes.COUNTY || ""
              }`.padEnd(5, "0"),
            FEATURE_TYPE: layerType,
            NAME:
              validAttributes.NAME ||
              formatLocationName({ attributes: validAttributes }, layerType),
          },
        };

        // Check if already selected
        const isAlreadySelected = selectedFeatures.some((existing) => {
          const idMatch =
            existing.attributes[uniqueIdField] ===
            normalizedFeature.attributes[uniqueIdField];
          if (idMatch) return true;

          if (layerType === "tract") {
            const existingFips = formatLocationName(
              { attributes: existing.attributes },
              "tract"
            );
            const newFips = formatLocationName(
              { attributes: normalizedFeature.attributes },
              "tract"
            );
            return existingFips === newFips;
          }
          return false;
        });

        if (isAlreadySelected) {
          console.log(
            "[MapContext] Feature already selected, toggling off:",
            normalizedFeature.attributes
          );
          await removeFromSelection(normalizedFeature, layerType);
        } else {
          // Only add if not part of another market area
          if (
            !normalizedFeature.attributes?.marketAreaId ||
            (editingMarketArea &&
              normalizedFeature.attributes.marketAreaId ===
                editingMarketArea.id)
          ) {
            setSelectedFeatures((prev) => {
              const newSelectedFeatures = [...prev];
              if (
                !newSelectedFeatures.some(
                  (f) =>
                    f.attributes[uniqueIdField] ===
                    normalizedFeature.attributes[uniqueIdField]
                )
              ) {
                console.log(
                  "[MapContext] Feature added to selection:",
                  normalizedFeature.attributes
                );
                newSelectedFeatures.push(normalizedFeature);
              }
              return newSelectedFeatures;
            });

            // Add to graphics layer with transparent symbol by default
            // The actual styling will be handled by updateFeatureStyles
            if (selectionGraphicsLayerRef.current) {
              const { default: Graphic } = await import("@arcgis/core/Graphic");
              const graphic = new Graphic({
                geometry: normalizedFeature.geometry,
                attributes: normalizedFeature.attributes,
                symbol: {
                  type: "simple-fill",
                  color: [0, 0, 0, 0], // Completely transparent
                  outline: {
                    color: [0, 0, 0, 0], // Completely transparent
                    width: 0,
                  },
                },
              });
              selectionGraphicsLayerRef.current.add(graphic);
            }
          }
        }
      } catch (error) {
        console.error("[MapContext] Error in addToSelection:", error);
        toast.error("Error adding selection");
      }
    },
    [
      mapView,
      selectedFeatures,
      removeFromSelection,
      editingMarketArea,
      formatLocationName,
    ]
  );
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

  const drawSiteLocation = useCallback(
    async (
      siteData,
      styleSettings,
      marketAreaId,
      order,
      isTemporary = false
    ) => {
      console.log("🔍 [LAYER ORDER DEBUG] drawSiteLocation - Starting", {
        id: marketAreaId,
        point: siteData.point,
        isTemporary,
        currentGraphicsCount:
          selectionGraphicsLayerRef.current?.graphics?.length || 0,
      });

      try {
        const [
          { default: Point },
          { default: Graphic },
          { default: SimpleMarkerSymbol },
          { default: Color },
        ] = await Promise.all([
          import("@arcgis/core/geometry/Point"),
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/symbols/SimpleMarkerSymbol"),
          import("@arcgis/core/Color"),
        ]);

        if (!selectionGraphicsLayerRef.current) {
          console.warn(
            "🔍 [LAYER ORDER DEBUG] Selection graphics layer not yet initialized. Cannot draw site location."
          );
          return null;
        }

        // Log layer position before adding site location
        const layerIndex = mapView.map.layers.indexOf(
          selectionGraphicsLayerRef.current
        );
        console.log(
          "🔍 [LAYER ORDER DEBUG] Graphics layer position before adding site:",
          {
            index: layerIndex,
            totalLayers: mapView.map.layers.length,
          }
        );

        // Clear existing site location graphics for this market area
        const existingSiteLocationGraphics =
          selectionGraphicsLayerRef.current.graphics.filter(
            (g) =>
              g.attributes?.FEATURE_TYPE === "site_location" &&
              g.attributes?.marketAreaId === marketAreaId
          );

        if (existingSiteLocationGraphics.length > 0) {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Removing ${existingSiteLocationGraphics.length} existing site location graphics for ${marketAreaId}`
          );
          selectionGraphicsLayerRef.current.removeMany(
            existingSiteLocationGraphics
          );
        }

        if (
          !siteData ||
          !siteData.point ||
          isNaN(parseFloat(siteData.point.latitude)) ||
          isNaN(parseFloat(siteData.point.longitude))
        ) {
          console.error(
            "🔍 [LAYER ORDER DEBUG] Invalid site location data or coordinates:",
            siteData
          );
          return null;
        }

        const point = new Point({
          longitude: parseFloat(siteData.point.longitude),
          latitude: parseFloat(siteData.point.latitude),
          spatialReference: { wkid: 4326 },
        });

        let borderColorValue;
        if (siteData.borderColor) {
          if (
            typeof siteData.borderColor === "string" &&
            siteData.borderColor.startsWith("#")
          ) {
            borderColorValue = new Color(siteData.borderColor);
          } else if (Array.isArray(siteData.borderColor)) {
            borderColorValue = new Color(siteData.borderColor);
          } else {
            borderColorValue = new Color(
              styleSettings?.borderColor || "#000000"
            );
          }
        } else {
          borderColorValue = new Color(styleSettings?.borderColor || "#000000");
        }

        const borderWidth =
          parseFloat(siteData.borderWidth) ||
          parseFloat(styleSettings?.borderWidth) ||
          1.5;

        const symbol = new SimpleMarkerSymbol({
          style: "path",
          path: STAR_SVG_PATH,
          color: new Color(
            siteData.color || styleSettings?.fillColor || "#FFC000"
          ),
          size: parseInt(siteData.size) || 24,
          outline: {
            color: borderColorValue,
            width: borderWidth,
          },
        });

        const graphic = new Graphic({
          geometry: point,
          symbol: symbol,
          attributes: {
            marketAreaId: marketAreaId || "temporary",
            order: order || 0,
            FEATURE_TYPE: "site_location",
            isTemporary: !!isTemporary,
            siteName: siteData.name || `Site ${marketAreaId || "Temp"}`,
            siteSize: siteData.size,
            siteColor: siteData.color,
            siteBorderColor: siteData.borderColor,
            siteBorderWidth: siteData.borderWidth,
          },
        });

        // Remove temporary graphics before adding new one
        if (isTemporary) {
          const tempGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) =>
                g.attributes?.isTemporary === true &&
                g.attributes?.FEATURE_TYPE === "site_location"
            );
          if (tempGraphics.length > 0) {
            console.log(
              `🔍 [LAYER ORDER DEBUG] Removing ${tempGraphics.length} temporary site location graphics`
            );
            selectionGraphicsLayerRef.current.removeMany(tempGraphics);
          }
        }

        selectionGraphicsLayerRef.current.add(graphic);

        console.log(
          "🔍 [LAYER ORDER DEBUG] Successfully drew site location (star):",
          {
            marketAreaId,
            totalGraphicsNow: selectionGraphicsLayerRef.current.graphics.length,
            graphicsLayerIndex: mapView.map.layers.indexOf(
              selectionGraphicsLayerRef.current
            ),
            isTemporary,
          }
        );

        return graphic;
      } catch (error) {
        console.error(
          "🔍 [LAYER ORDER DEBUG] Error drawing site location (star):",
          error
        );
        return null;
      }
    },
    [selectionGraphicsLayerRef]
  );

  const extractSiteLocationInfo = useCallback((marketArea) => {
    if (!marketArea) return null;

    try {
      // Case 1: Direct site_location_data property
      if (marketArea.site_location_data) {
        let siteData;

        // Parse if it's a string
        if (typeof marketArea.site_location_data === "string") {
          try {
            siteData = JSON.parse(marketArea.site_location_data);
          } catch (e) {
            console.warn(
              `Failed to parse site_location_data for market area ${marketArea.id}:`,
              e
            );
            return null;
          }
        } else {
          siteData = marketArea.site_location_data;
        }

        // Ensure it has the required structure
        if (!siteData.point) {
          console.warn(
            `Invalid site location data for market area ${marketArea.id}: missing point`
          );
          return null;
        }

        return {
          point: siteData.point,
          size: siteData.size || 20,
          color: siteData.color || "#FFD700", // Default: gold color
          style: siteData.style || marketArea.style || null,
        };
      }

      // Case 2: Check for ma_geometry_data
      else if (marketArea.ma_geometry_data) {
        let geoData;

        // Parse if it's a string
        if (typeof marketArea.ma_geometry_data === "string") {
          try {
            geoData = JSON.parse(marketArea.ma_geometry_data);
          } catch (e) {
            console.warn(
              `Failed to parse ma_geometry_data for market area ${marketArea.id}:`,
              e
            );
            return null;
          }
        } else {
          geoData = marketArea.ma_geometry_data;
        }

        // Check if it contains site location information
        if (geoData.point) {
          return {
            point: geoData.point,
            size: geoData.size || 20,
            color: geoData.color || "#FFD700",
            style: geoData.style || marketArea.style || null,
          };
        }
      }

      // Case 3: Check for geometry property that might contain coordinates
      else if (marketArea.geometry) {
        // Try to extract a point from geometry
        const geo = marketArea.geometry;

        if (geo.x !== undefined && geo.y !== undefined) {
          // Web Mercator or similar coordinates
          return {
            point: {
              x: geo.x,
              y: geo.y,
              spatialReference: geo.spatialReference,
            },
            size: 20, // Default size
            color: "#FFD700", // Default color
            style: marketArea.style || null,
          };
        } else if (geo.longitude !== undefined && geo.latitude !== undefined) {
          // Geographic coordinates
          return {
            point: {
              longitude: geo.longitude,
              latitude: geo.latitude,
              spatialReference: geo.spatialReference,
            },
            size: 20, // Default size
            color: "#FFD700", // Default color
            style: marketArea.style || null,
          };
        }
      }

      // Case 4: Last resort - create a default site location in a reasonable location
      console.warn(
        `No valid site location data found for market area ${marketArea.id}, using default`
      );
      return {
        point: {
          longitude: -117.8311, // Orange County location
          latitude: 33.7175,
        },
        size: 20, // Default size
        color: "#FFD700", // Default color
        style: marketArea.style || null,
      };
    } catch (error) {
      console.error(
        `Error extracting site location info for market area ${marketArea.id}:`,
        error
      );
      return null;
    }
  }, []);

  const clearMarketAreaGraphics = useCallback(
    (marketAreaId) => {
      console.log("[MapContext] Clear graphics called:", { marketAreaId });

      if (!selectionGraphicsLayerRef.current) {
        console.log("[MapContext] No graphics layer available");
        return;
      }

      try {
        // Get all graphics from the layer
        const allGraphics =
          selectionGraphicsLayerRef.current.graphics.toArray();

        // If no marketAreaId, clear all market area graphics
        let graphicsToRemove;

        if (!marketAreaId) {
          // When no specific ID is provided, remove all market area graphics
          console.log("[MapContext] Clearing ALL market area graphics");
          graphicsToRemove = allGraphics.filter(
            (graphic) =>
              graphic.attributes?.marketAreaId ||
              graphic.attributes?.FEATURE_TYPE === "radius" ||
              graphic.attributes?.FEATURE_TYPE === "drivetime" ||
              graphic.attributes?.FEATURE_TYPE === "drivetime_point" ||
              graphic.attributes?.FEATURE_TYPE === "site_location"
          );
        } else {
          // Enhanced filtering to ensure we catch all graphics related to this market area
          graphicsToRemove = allGraphics.filter((graphic) => {
            // Match on marketAreaId and feature types
            return (
              // Direct match on marketAreaId
              graphic.attributes?.marketAreaId === marketAreaId ||
              // Match radius circle IDs that start with this market area ID
              (graphic.attributes?.circleId &&
                graphic.attributes.circleId.startsWith(`${marketAreaId}-`)) ||
              // Match any drivetime feature with this market area ID
              (graphic.attributes?.FEATURE_TYPE === "drivetime" &&
                graphic.attributes?.marketAreaId === marketAreaId) ||
              // Match any drivetime_point feature with this market area ID
              (graphic.attributes?.FEATURE_TYPE === "drivetime_point" &&
                graphic.attributes?.marketAreaId === marketAreaId) ||
              // Match any site_location feature with this market area ID
              (graphic.attributes?.FEATURE_TYPE === "site_location" &&
                graphic.attributes?.marketAreaId === marketAreaId) ||
              // Additional matching to catch any edge cases for this market area
              (graphic.attributes?.order !== undefined &&
                graphic.attributes?.id &&
                String(graphic.attributes.id).includes(marketAreaId))
            );
          });
        }

        if (graphicsToRemove.length > 0) {
          console.log(
            `[MapContext] Removing ${
              graphicsToRemove.length
            } graphics for market area ${marketAreaId || "ALL"}:`,
            {
              details: graphicsToRemove.map((g) => ({
                marketAreaId: g.attributes?.marketAreaId,
                featureType: g.attributes?.FEATURE_TYPE,
                circleId: g.attributes?.circleId,
              })),
            }
          );

          // Remove them all at once
          selectionGraphicsLayerRef.current.removeMany(graphicsToRemove);
        } else {
          console.log(
            `[MapContext] No graphics found for market area: ${
              marketAreaId || "ALL"
            }`
          );
        }

        return true;
      } catch (error) {
        console.error("[MapContext] Error clearing graphics:", error);
        return false;
      }
    },
    [selectionGraphicsLayerRef]
  );

  const transformRadiusPoint = useMemo(
    () => (point, marketAreaId) => {
      try {
        if (!point.center) {
          console.error("No center found in point:", point);
          return null;
        }

        const longitude = Number(point.center.longitude || point.center.x);
        const latitude = Number(point.center.latitude || point.center.y);

        if (isNaN(longitude) || isNaN(latitude)) {
          console.error("Invalid coordinates in point:", point);
          return null;
        }

        return {
          center: {
            x: longitude,
            y: latitude,
            spatialReference: point.center.spatialReference || { wkid: 102100 },
          },
          radii: Array.isArray(point.radii)
            ? point.radii.map(Number).filter((r) => !isNaN(r) && r > 0)
            : [Number(point.radius || 10)],
          units: point.units || "miles",
        };
      } catch (error) {
        console.error("Error transforming radius point:", error);
        return null;
      }
    },
    []
  );

  // Enhanced transformDriveTimePoint function to better handle various data formats
  const transformDriveTimePoint = useMemo(
    () => (point, marketAreaId) => {
      try {
        // Handle the case where point itself could be null/undefined
        if (!point) {
          console.error("Drive time point is null or undefined");
          return null;
        }

        // Try to parse if it's a string (JSON)
        if (typeof point === "string") {
          try {
            point = JSON.parse(point);
          } catch (err) {
            console.warn("Could not parse string drive time point:", err);
            return null;
          }
        }

        // Find the center coordinates using multiple possible property paths
        let centerLon, centerLat;

        // Case 1: center object with longitude/latitude
        if (point.center) {
          if (typeof point.center === "string") {
            try {
              point.center = JSON.parse(point.center);
            } catch (err) {
              console.warn("Could not parse center string:", err);
            }
          }

          centerLon = Number(point.center.longitude || point.center.x);
          centerLat = Number(point.center.latitude || point.center.y);
        }
        // Case 2: point has direct lon/lat properties
        else if (
          point.longitude !== undefined &&
          point.latitude !== undefined
        ) {
          centerLon = Number(point.longitude);
          centerLat = Number(point.latitude);
        }
        // Case 3: point has x/y properties
        else if (point.x !== undefined && point.y !== undefined) {
          centerLon = Number(point.x);
          centerLat = Number(point.y);
        }

        // Validate coordinates
        if (isNaN(centerLon) || isNaN(centerLat)) {
          console.error("Invalid coordinates in drive time point:", point);
          return null;
        }

        // Get time ranges/minutes with fallbacks
        const timeRanges = (
          Array.isArray(point.timeRanges)
            ? point.timeRanges
            : Array.isArray(point.radii)
            ? point.radii
            : [
                point.travelTimeMinutes ||
                  point.timeRange ||
                  point.minutes ||
                  15,
              ]
        )
          .map(Number)
          .filter((t) => !isNaN(t) && t > 0);

        // Check if we have a valid polygon already
        let polygon = point.polygon || point.driveTimePolygon || null;

        // Create the standardized format
        return {
          center: {
            longitude: centerLon,
            latitude: centerLat,
            spatialReference: (point.center &&
              point.center.spatialReference) || { wkid: 4326 },
          },
          travelTimeMinutes: timeRanges[0], // Use first value as primary time
          timeRanges: timeRanges,
          units: point.units || "minutes",
          polygon: polygon,
          marketAreaId: marketAreaId,
        };
      } catch (error) {
        console.error("Error transforming drive time point:", error, point);
        return null;
      }
    },
    []
  );

  // Use this function in your useEffect to handle drive time points more robustly
  const processDriveTimePoints = useCallback(
    async (marketArea) => {
      if (!marketArea || marketArea.ma_type !== "drivetime") {
        return false;
      }

      try {
        console.log(
          `[MapContext] Processing drive time market area: ${marketArea.id}`
        );

        // Handle different formats of drive_time_points
        let driveTimePoints;

        try {
          if (typeof marketArea.drive_time_points === "string") {
            driveTimePoints = JSON.parse(marketArea.drive_time_points);
          } else {
            driveTimePoints = marketArea.drive_time_points;
          }
        } catch (err) {
          console.warn(`[MapContext] Error parsing drive_time_points:`, err);
          driveTimePoints = marketArea.drive_time_points;
        }

        // If still undefined, try to find other sources
        if (!driveTimePoints) {
          console.log(
            `[MapContext] No drive_time_points in market area, checking alternatives`
          );

          // Check ma_geometry_data
          if (marketArea.ma_geometry_data) {
            try {
              const geoData =
                typeof marketArea.ma_geometry_data === "string"
                  ? JSON.parse(marketArea.ma_geometry_data)
                  : marketArea.ma_geometry_data;

              if (geoData.center || geoData.point) {
                driveTimePoints = [
                  {
                    center: geoData.center || geoData.point,
                    timeRanges: geoData.timeRanges || [
                      geoData.travelTimeMinutes || 15,
                    ],
                    polygon: geoData.polygon,
                  },
                ];
                console.log(
                  `[MapContext] Extracted drive time point from ma_geometry_data`
                );
              }
            } catch (err) {
              console.warn(
                `[MapContext] Failed to extract drive time point from ma_geometry_data:`,
                err
              );
            }
          }

          // If still nothing, try to extract from geometry
          if (!driveTimePoints && marketArea.geometry) {
            try {
              // Try to find a center point from geometry
              const geo = marketArea.geometry;

              if (geo.rings && geo.rings.length > 0) {
                // Calculate centroid from first ring
                const points = geo.rings[0];
                let sumX = 0,
                  sumY = 0;

                for (const point of points) {
                  sumX += point[0];
                  sumY += point[1];
                }

                const centerX = sumX / points.length;
                const centerY = sumY / points.length;

                driveTimePoints = [
                  {
                    center: {
                      longitude: centerX,
                      latitude: centerY,
                      spatialReference: geo.spatialReference,
                    },
                    timeRanges: [15], // Default 15 minute drivetime
                    polygon: geo,
                  },
                ];
                console.log(
                  `[MapContext] Created drive time point from geometry centroid`
                );
              }
            } catch (err) {
              console.warn(
                `[MapContext] Failed to create drive time point from geometry:`,
                err
              );
            }
          }
        }

        // Ensure we have at least an empty array
        if (!driveTimePoints) {
          console.warn(
            `[MapContext] No drive time points found for market area ${marketArea.id}`
          );
          return false;
        }

        // Make sure driveTimePoints is an array
        driveTimePoints = Array.isArray(driveTimePoints)
          ? driveTimePoints
          : [driveTimePoints];

        // Process each point
        let pointsDrawn = 0;
        for (const point of driveTimePoints) {
          if (!point) continue;

          const transformedPoint = transformDriveTimePoint(
            point,
            marketArea.id
          );

          if (transformedPoint) {
            await drawDriveTimePolygon(
              transformedPoint,
              {
                fillColor: marketArea.style_settings?.fillColor || "#0078D4",
                fillOpacity: marketArea.style_settings?.noFill
                  ? 0
                  : marketArea.style_settings?.fillOpacity || 0.35,
                borderColor:
                  marketArea.style_settings?.borderColor || "#0078D4",
                borderWidth: marketArea.style_settings?.noBorder
                  ? 0
                  : marketArea.style_settings?.borderWidth || 3,
              },
              marketArea.id,
              marketArea.order || 0
            );
            pointsDrawn++;
          }
        }

        console.log(
          `[MapContext] Drew ${pointsDrawn} drive time points for market area ${marketArea.id}`
        );
        return pointsDrawn > 0;
      } catch (error) {
        console.error(
          `[MapContext] Error processing drive time market area ${marketArea.id}:`,
          error
        );
        return false;
      }
    },
    [transformDriveTimePoint, drawDriveTimePolygon]
  );


  const updateFeatureStyles = useCallback(
    async (features, styles, featureType, immediate = false) => {
      console.log("🔍 [LAYER ORDER DEBUG] updateFeatureStyles - Starting style update");
      console.log("🔍 [LAYER ORDER DEBUG] Update styles input:", {
        featureCount: features.length,
        featureType,
        immediate,
        styles,
        marketAreaIds: [
          ...new Set(
            features.map((f) => f.attributes?.marketAreaId).filter(Boolean)
          ),
        ],
      });

      if (updateFeatureStyles.isProcessing) {
        console.log("🔍 [LAYER ORDER DEBUG] Update already in progress, skipping");
        return;
      }

      if (!selectionGraphicsLayerRef.current || !mapView) {
        console.log("🔍 [LAYER ORDER DEBUG] Cannot update styles: missing graphics layer or map view");
        return;
      }

      // Verify graphics layer is still properly positioned and visible
      const layerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
      const layerVisible = selectionGraphicsLayerRef.current.visible;
      const layerOpacity = selectionGraphicsLayerRef.current.opacity;

      console.log("🔍 [LAYER ORDER DEBUG] Graphics layer verification before styling:", {
        layerIndex,
        layerVisible,
        layerOpacity,
        totalMapLayers: mapView.map.layers.length,
        currentGraphicsCount: selectionGraphicsLayerRef.current.graphics.length,
      });

      // Force layer visibility if it's been hidden somehow
      if (!layerVisible) {
        selectionGraphicsLayerRef.current.visible = true;
        console.log("🔍 [LAYER ORDER DEBUG] Forced graphics layer visible");
      }

      if (layerOpacity < 1) {
        selectionGraphicsLayerRef.current.opacity = 1.0;
        console.log("🔍 [LAYER ORDER DEBUG] Forced graphics layer opacity to 1.0");
      }

      updateFeatureStyles.isProcessing = true;

      try {
        const [
          { default: Graphic },
          { default: Polygon },
          { union, simplify, planarArea, planarLength },
          { default: Query },
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/Polygon"),
          import("@arcgis/core/geometry/geometryEngine"),
          import("@arcgis/core/rest/support/Query"),
        ]);

        // Group features by marketAreaId
        const featuresByMarketArea = {};
        features.forEach((feature) => {
          const id = feature.attributes.marketAreaId;
          if (!featuresByMarketArea[id]) featuresByMarketArea[id] = [];
          featuresByMarketArea[id].push(feature);
        });

        console.log("🔍 [LAYER ORDER DEBUG] Features grouped by market area:", {
          marketAreaCount: Object.keys(featuresByMarketArea).length,
          marketAreaIds: Object.keys(featuresByMarketArea),
        });
        
        // **START CORRECTION**
        // Corrected style processing to allow for full transparency and no borders.
        const processedStyles = {
            fill: styles.fill || "#0078D4",
            fillOpacity: styles.noFill ? 0 : (styles.fillOpacity !== undefined ? styles.fillOpacity : 0.35),
            outline: styles.outline || "#0078D4",
            outlineWidth: styles.noBorder ? 0 : (styles.outlineWidth !== undefined ? styles.outlineWidth : 2),
        };
        // **END CORRECTION**

        console.log("🔍 [LAYER ORDER DEBUG] Processed styles for visibility:", {
          originalStyles: styles,
          processedStyles,
          fillOpacityIncreased: processedStyles.fillOpacity > (styles.fillOpacity || 0),
          outlineWidthIncreased: processedStyles.outlineWidth > (styles.outlineWidth || 0),
        });

        // Enhanced graphics preservation
        const marketAreaIds = new Set(Object.keys(featuresByMarketArea));
        const existingGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
        
        const marketAreaGraphicsToRemove = existingGraphics.filter((g) => 
          marketAreaIds.has(g.attributes?.marketAreaId) && 
          (g.attributes?.FEATURE_TYPE === featureType || immediate)
        );
        
        const graphicsToPreserve = existingGraphics.filter((g) => 
          !marketAreaIds.has(g.attributes?.marketAreaId) || 
          (g.attributes?.FEATURE_TYPE !== featureType && !immediate)
        );

        console.log("🔍 [LAYER ORDER DEBUG] Graphics management:", {
          totalExisting: existingGraphics.length,
          toRemove: marketAreaGraphicsToRemove.length,
          toPreserve: graphicsToPreserve.length,
          immediate,
        });

        if (marketAreaGraphicsToRemove.length > 0) {
          selectionGraphicsLayerRef.current.removeMany(marketAreaGraphicsToRemove);
          console.log(`🔍 [LAYER ORDER DEBUG] Removed ${marketAreaGraphicsToRemove.length} existing graphics`);
        }

        const newGraphics = [];

        for (const [marketAreaId, maFeatures] of Object.entries(featuresByMarketArea)) {
          console.log("🔍 [LAYER ORDER DEBUG] Processing market area features:", {
            marketAreaId,
            featureCount: maFeatures.length,
            featureType,
          });

          let highResPolygons = [];

          try {
            const layer = featureLayersRef.current[featureType];
            if (layer) {
              console.log(`🔍 [LAYER ORDER DEBUG] Found feature layer for type ${featureType}`);

              const layersToQuery = layer.featureLayers || [layer];

              for (const queryLayer of layersToQuery) {
                const queryClauses = maFeatures
                  .map((f) => {
                    if (featureType === "zip") {
                      if (f.attributes.ZCTA5) return `ZIP = '${f.attributes.ZCTA5}'`;
                      if (f.attributes.name && /^\d{5}(-\d{4})?$/.test(f.attributes.name)) return `ZIP = '${f.attributes.name}'`;
                      if (f.attributes.id && /^\d{5}(-\d{4})?$/.test(f.attributes.id)) return `ZIP = '${f.attributes.id}'`;
                      return "";
                    }

                    const idField = queryLayer.objectIdField || "OBJECTID";
                    const idValue = f.attributes[idField] || f.attributes.FID;
                    return idValue ? `${idField} = ${idValue}` : "";
                  })
                  .filter((clause) => clause !== "");

                if (queryClauses.length === 0) continue;

                const query = new Query({
                  where: queryClauses.join(" OR "),
                  returnGeometry: true,
                  outSpatialReference: mapView.spatialReference,
                  maxAllowableOffset: 0,
                  geometryPrecision: 8,
                  resultType: "standard",
                  multipatchOption: "xyFootprint",
                });

                try {
                  const result = await queryLayer.queryFeatures(query);
                  if (result?.features) {
                    const polygons = result.features
                      .map((feature) => {
                        if (!feature.geometry?.rings) return null;
                        return new Polygon({
                          rings: feature.geometry.rings,
                          spatialReference: mapView.spatialReference,
                          type: "polygon",
                        });
                      })
                      .filter(Boolean);
                    highResPolygons.push(...polygons);
                  }
                } catch (queryError) {
                  console.warn(`🔍 [LAYER ORDER DEBUG] Error querying layer:`, queryError);
                }
              }
            }
          } catch (error) {
            console.warn("🔍 [LAYER ORDER DEBUG] Error fetching high-res features:", error);
          }

          if (highResPolygons.length === 0) {
            console.log("🔍 [LAYER ORDER DEBUG] Using original geometries with validation");
            highResPolygons = maFeatures
              .map((feature) => {
                if (!feature.geometry) {
                  console.warn("🔍 [LAYER ORDER DEBUG] Feature missing geometry:", feature);
                  return null;
                }

                try {
                  const geomConfig = {
                    spatialReference: mapView.spatialReference,
                    type: "polygon",
                  };

                  if (feature.geometry.rings) {
                    return new Polygon({ ...geomConfig, rings: feature.geometry.rings });
                  } else if (feature.geometry.type === "polygon") {
                    return new Polygon({ ...geomConfig, rings: feature.geometry.rings || feature.geometry.coordinates });
                  }
                } catch (error) {
                  console.error("🔍 [LAYER ORDER DEBUG] Error creating polygon:", error);
                  return null;
                }
                return null;
              })
              .filter(Boolean);
          }

          if (highResPolygons.length === 0) {
            console.warn(`🔍 [LAYER ORDER DEBUG] No valid polygons for market area ${marketAreaId}`);
            continue;
          }

          try {
            let unifiedGeometry = highResPolygons.length === 1 ? highResPolygons[0] : union(highResPolygons);

            if (!unifiedGeometry) {
              console.warn(`🔍 [LAYER ORDER DEBUG] Union failed for market area ${marketAreaId}`);
              continue;
            }

            const simplifiedGeometry = simplify(unifiedGeometry);
            const totalArea = Math.abs(planarArea(simplifiedGeometry));
            const minHoleArea = totalArea * 0.001;

            const { exteriorRings, holeRings } = simplifiedGeometry.rings.reduce(
              (acc, ring) => {
                const ringPolygon = new Polygon({ rings: [ring], spatialReference: mapView.spatialReference, type: "polygon" });
                const area = planarArea(ringPolygon);
                const perimeter = planarLength(ringPolygon);

                if (area > 0) acc.exteriorRings.push(ring);
                else if (Math.abs(area) > minHoleArea && perimeter > 100) acc.holeRings.push(ring);
                return acc;
              },
              { exteriorRings: [], holeRings: [] }
            );

            console.log(`🔍 [LAYER ORDER DEBUG] Created unified geometry for ${marketAreaId}:`, {
              exteriorRings: exteriorRings.length,
              holeRings: holeRings.length,
              totalArea,
            });

            const fillSymbol = {
              type: "simple-fill",
              color: [...hexToRgb(processedStyles.fill), processedStyles.fillOpacity],
              outline: { color: [0, 0, 0, 0], width: 0 },
              style: "solid",
            };

            const fillGeometry = new Polygon({ rings: [...exteriorRings, ...holeRings], spatialReference: mapView.spatialReference, type: "polygon" });
            const fillGraphic = new Graphic({
              geometry: fillGeometry,
              symbol: fillSymbol,
              attributes: { marketAreaId, FEATURE_TYPE: featureType, isUnified: true, isFill: true, renderOrder: 1, ...maFeatures[0].attributes },
            });
            newGraphics.push(fillGraphic);

            // **START CORRECTION**
            // Corrected outline symbol to handle zero-width borders.
            const outlineSymbol = {
              type: "simple-fill",
              color: [0, 0, 0, 0], // Transparent fill
              outline: {
                color: [...hexToRgb(processedStyles.outline), 1],
                width: processedStyles.outlineWidth,
                style: processedStyles.outlineWidth > 0 ? "solid" : "none", // Set style to none if width is 0
              },
              style: "none", // Fill style should be none for an outline-only symbol
            };
            // **END CORRECTION**

            const exteriorGeometry = new Polygon({ rings: exteriorRings, spatialReference: mapView.spatialReference, type: "polygon" });
            const exteriorOutlineGraphic = new Graphic({
              geometry: exteriorGeometry,
              symbol: outlineSymbol,
              attributes: { marketAreaId, FEATURE_TYPE: featureType, isUnified: true, isOutline: true, isExterior: true, renderOrder: 2, ...maFeatures[0].attributes },
            });
            newGraphics.push(exteriorOutlineGraphic);

            holeRings.forEach((holeRing, index) => {
              const holeGeometry = new Polygon({ rings: [holeRing], spatialReference: mapView.spatialReference, type: "polygon" });
              const holeOutlineGraphic = new Graphic({
                geometry: holeGeometry,
                symbol: outlineSymbol,
                attributes: { marketAreaId, FEATURE_TYPE: featureType, isUnified: true, isOutline: true, isHole: true, holeIndex: index, renderOrder: 2, ...maFeatures[0].attributes },
              });
              newGraphics.push(holeOutlineGraphic);
            });

            console.log(`🔍 [LAYER ORDER DEBUG] Created ${newGraphics.length} graphics for market area ${marketAreaId}`);

          } catch (error) {
            console.error(`🔍 [LAYER ORDER DEBUG] Error processing market area ${marketAreaId}:`, error);
            continue;
          }
        }

        if (newGraphics.length > 0) {
          console.log(`🔍 [LAYER ORDER DEBUG] Adding ${newGraphics.length} new styled graphics to layer`);
          newGraphics.sort((a, b) => (a.attributes.renderOrder || 0) - (b.attributes.renderOrder || 0));
          selectionGraphicsLayerRef.current.addMany(newGraphics);

          setTimeout(() => {
            const finalGraphicsCount = selectionGraphicsLayerRef.current.graphics.length;
            const layerStillVisible = selectionGraphicsLayerRef.current.visible;
            const layerStillAtCorrectIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
            console.log("🔍 [LAYER ORDER DEBUG] Graphics addition verification:", {
              finalGraphicsCount,
              layerStillVisible,
              layerStillAtCorrectIndex,
              newGraphicsAdded: newGraphics.length,
            });

            if (!layerStillVisible) {
              selectionGraphicsLayerRef.current.visible = true;
              console.log("🔍 [LAYER ORDER DEBUG] Re-enabled layer visibility after graphics addition");
            }
          }, 100);
        }

        const finalLayerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
        console.log("🔍 [LAYER ORDER DEBUG] Final style update state:", {
          graphicsLayerIndex: finalLayerIndex,
          totalGraphicsInLayer: selectionGraphicsLayerRef.current.graphics.length,
          newGraphicsAdded: newGraphics.length,
          totalMapLayers: mapView.map.layers.length,
        });

      } catch (error) {
        console.error("🔍 [LAYER ORDER DEBUG] Error updating feature styles:", error);
      } finally {
        updateFeatureStyles.isProcessing = false;
      }
    },
    [mapView, hexToRgb, featureLayersRef]
  );

  // Add this function to MapContext.jsx
  const extractDriveTimeInfo = useCallback((marketArea) => {
    if (!marketArea || marketArea.ma_type !== "drivetime") return null;

    try {
      // Case 1: Direct drive_time_points property
      if (marketArea.drive_time_points) {
        let driveTimePoints;

        // Parse if it's a string
        if (typeof marketArea.drive_time_points === "string") {
          try {
            driveTimePoints = JSON.parse(marketArea.drive_time_points);
          } catch (e) {
            console.warn(
              `Failed to parse drive_time_points for market area ${marketArea.id}:`,
              e
            );
            return null;
          }
        } else {
          driveTimePoints = marketArea.drive_time_points;
        }

        // Normalize to array format
        if (!Array.isArray(driveTimePoints)) {
          driveTimePoints = [driveTimePoints];
        }

        // Validate and normalize each point
        return driveTimePoints
          .map((point) => {
            if (!point) return null;

            // Create a normalized point structure
            const normalizedPoint = {
              center: point.center || point.point || null,
              travelTimeMinutes:
                point.travelTimeMinutes ||
                (Array.isArray(point.timeRanges)
                  ? point.timeRanges[0]
                  : point.timeRange) ||
                15,
              polygon: point.polygon || point.driveTimePolygon || null,
              style: point.style || marketArea.style || null,
            };

            // Skip invalid points
            if (!normalizedPoint.center) {
              console.warn(
                `Invalid drive time point in market area ${marketArea.id}: missing center`
              );
              return null;
            }

            return normalizedPoint;
          })
          .filter(Boolean); // Remove any null entries
      }

      // Case 2: Check for polygon in geometry
      else if (marketArea.geometry && marketArea.geometry.rings) {
        // Extract centroid from first ring as a fallback
        try {
          const ring = marketArea.geometry.rings[0];
          let sumX = 0,
            sumY = 0;

          for (const point of ring) {
            sumX += point[0];
            sumY += point[1];
          }

          const centerX = sumX / ring.length;
          const centerY = sumY / ring.length;

          return [
            {
              center: {
                longitude: centerX,
                latitude: centerY,
                spatialReference: marketArea.geometry.spatialReference,
              },
              travelTimeMinutes: 15, // Default 15-minute drivetime
              polygon: marketArea.geometry,
            },
          ];
        } catch (error) {
          console.warn(
            `Failed to create drive time point from geometry for ${marketArea.id}:`,
            error
          );
        }
      }

      return null;
    } catch (error) {
      console.error(
        `Error extracting drive time info for market area ${marketArea.id}:`,
        error
      );
      return null;
    }
  }, []);

  const toggleMarketAreaEditMode = useCallback(
    async (marketAreaId) => {
      if (!marketAreaId || !selectionGraphicsLayerRef.current) return;

      try {
        // Find the market area being edited
        const marketArea = marketAreas.find((ma) => ma.id === marketAreaId);
        if (!marketArea) {
          console.warn(`Market area ${marketAreaId} not found`);
          return;
        }

        // Clear existing selections and graphics
        clearSelection();
        clearMarketAreaGraphics();

        // Set the editing state
        setEditingMarketArea(marketArea);

        // Different handling based on market area type
        if (marketArea.ma_type === "radius" && marketArea.radius_points) {
          const points = Array.isArray(marketArea.radius_points)
            ? marketArea.radius_points
            : [marketArea.radius_points];

          for (const point of points) {
            const transformedPoint = transformRadiusPoint(point, marketAreaId);
            if (transformedPoint) {
              await drawRadius(
                transformedPoint,
                marketArea.style_settings,
                marketAreaId,
                marketArea.order
              );
            }
          }
        } else if (
          marketArea.ma_type === "drivetime" &&
          marketArea.drive_time_points
        ) {
          const points = Array.isArray(marketArea.drive_time_points)
            ? marketArea.drive_time_points
            : [marketArea.drive_time_points];

          for (const point of points) {
            const transformedPoint = transformDriveTimePoint(
              point,
              marketAreaId
            );
            if (transformedPoint) {
              await drawDriveTimePolygon(
                transformedPoint,
                marketArea.style_settings,
                marketAreaId,
                marketArea.order
              );
            }
          }
        } else if (marketArea.ma_type === "site_location") {
          // Handle site location market area type
          const siteData = extractSiteLocationInfo(marketArea);
          if (siteData) {
            await drawSiteLocation(
              siteData,
              marketArea.style_settings,
              marketAreaId,
              marketArea.order
            );
          } else {
            console.warn(
              `Site location market area ${marketAreaId} has no valid site data`
            );
          }
        } else if (marketArea.locations) {
          const features = marketArea.locations.map((loc) => ({
            geometry: loc.geometry,
            attributes: {
              id: loc.id,
              marketAreaId: marketAreaId,
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

        console.log("[MapContext] Market area edit mode toggled", {
          marketAreaId,
          marketAreaType: marketArea.ma_type,
        });
      } catch (error) {
        console.error("Error toggling market area edit mode:", error);
        toast.error("Error entering edit mode");
      }
    },
    [
      marketAreas,
      clearSelection,
      clearMarketAreaGraphics,
      drawRadius,
      drawDriveTimePolygon,
      drawSiteLocation,
      updateFeatureStyles,
      transformRadiusPoint,
      transformDriveTimePoint,
      extractSiteLocationInfo,
    ]
  );

  /**
   * Enhanced createCompLayer function
   * Creates a GraphicsLayer for comp visualization with improved label support
   *
   * @param {Object} config - Configuration options
   * @returns {GraphicsLayer} GraphicsLayer with points and labels
   */
  const createCompLayer = async (config) => {
    console.log(
      "[createCompLayer] Received config:",
      JSON.stringify(config, (k, v) =>
        k === "data" ? `[${v?.length} items]` : v
      )
    );

    // Ensure we have the required modules
    const [
      { default: GraphicsLayer },
      { default: Graphic },
      { default: Point },
      { default: SimpleMarkerSymbol },
      { default: TextSymbol },
      { default: Color },
      { default: PopupTemplate },
    ] = await Promise.all([
      import("@arcgis/core/layers/GraphicsLayer"),
      import("@arcgis/core/Graphic"),
      import("@arcgis/core/geometry/Point"),
      import("@arcgis/core/symbols/SimpleMarkerSymbol"),
      import("@arcgis/core/symbols/TextSymbol"),
      import("@arcgis/core/Color"),
      import("@arcgis/core/PopupTemplate"),
    ]);

    // Extract data from config
    const compData = config?.customData?.data || [];
    if (!Array.isArray(compData) || compData.length === 0) {
      console.warn("[createCompLayer] No comp data provided");
      return null;
    }

    // Determine column names
    const latColumn = config?.latitudeColumn || "Latitude";
    const lonColumn = config?.longitudeColumn || "Longitude";
    const labelColumn = config?.labelColumn || "name";
    const valueColumn = config?.valueColumn || config?.field;
    const var1Column = config?.variable1Column;
    const var2Column = config?.variable2Column;
    const statusColumn = config?.statusColumn;

    // Create the graphics layer
    const layer = new GraphicsLayer({
      id: `custom-layer-${Date.now()}`,
      title: config?.title || "Custom Data",
      listMode: "hide",
      labelsVisible: !disableLayerLabels, // Set labelsVisible based on config
      visualizationType: "custom",
      isVisualizationLayer: true,
      _hasNoLabels: disableLayerLabels, // Add layer-level flag
      _hideAllLabels: disableLayerLabels, // Add layer-level flag
    });

    // Create symbol from config or use default
    const defaultSymbol = new SimpleMarkerSymbol({
      style: "circle",
      color: new Color(config?.symbol?.color || "#800080"), // Default purple
      size: config?.symbol?.size || 10,
      outline: {
        color: new Color(config?.symbol?.outline?.color || "#FFFFFF"),
        width: config?.symbol?.outline?.width || 1,
      },
    });

    // Determine class breaks if provided
    const classBreaks = config?.classBreakInfos || [];
    const renderByClasses = classBreaks.length > 0 && valueColumn;

    // Track created points and labels count
    let pointsCount = 0;
    let labelsCount = 0;
    let processedCount = 0;
    let errorCount = 0;

    // Array to hold graphics before adding to layer (more efficient)
    const pointGraphics = [];
    const labelGraphics = [];

    // Process each data point
    for (const item of compData) {
      try {
        // Get coordinates - check various possible formats
        let lat, lon;

        // Try direct latitude/longitude columns
        if (item[latColumn] !== undefined && item[lonColumn] !== undefined) {
          lat = parseFloat(item[latColumn]);
          lon = parseFloat(item[lonColumn]);
        }
        // Try geometry object if present
        else if (
          item.geometry &&
          typeof item.geometry.y === "number" &&
          typeof item.geometry.x === "number"
        ) {
          lat = item.geometry.y;
          lon = item.geometry.x;
        }
        // Try common alternative column names
        else if (item.lat !== undefined && item.lon !== undefined) {
          lat = parseFloat(item.lat);
          lon = parseFloat(item.lon);
        } else if (
          item.latitude !== undefined &&
          item.longitude !== undefined
        ) {
          lat = parseFloat(item.latitude);
          lon = parseFloat(item.longitude);
        }

        // Skip if we couldn't determine coordinates
        if (isNaN(lat) || isNaN(lon)) {
          console.warn(
            `[createCompLayer] Invalid coordinates for comp item:`,
            item
          );
          errorCount++;
          continue;
        }

        // Generate label text
        let labelText = "";
        if (item[labelColumn]) {
          labelText = String(item[labelColumn]);

          // Add variables if requested in config
          if (config?.labelOptions?.includeVariables !== false) {
            if (var1Column && item[var1Column] !== undefined) {
              labelText += `, ${item[var1Column]}`;
            }

            if (var2Column && item[var2Column] !== undefined) {
              labelText += ` / ${item[var2Column]}`;
            }
          }
        } else {
          // Fallback label - try common name fields
          labelText =
            item.name ||
            item.title ||
            item.NAME ||
            item.LABEL ||
            `Comp ${processedCount + 1}`;
        }

        // Create the point geometry
        const point = new Point({
          longitude: lon,
          latitude: lat,
          spatialReference: { wkid: 4326 }, // WGS84
        });

        // Determine symbol based on class breaks if applicable
        let pointSymbol = defaultSymbol;
        if (renderByClasses && valueColumn && item[valueColumn] !== undefined) {
          const value = parseFloat(item[valueColumn]);
          if (!isNaN(value)) {
            // Find matching class break
            const matchingBreak = classBreaks.find(
              (br) =>
                (br.minValue === undefined || value >= br.minValue) &&
                (br.maxValue === undefined || value <= br.maxValue)
            );

            if (matchingBreak && matchingBreak.symbol) {
              // Create symbol from class break definition
              pointSymbol = new SimpleMarkerSymbol({
                style: matchingBreak.symbol.style || "circle",
                color: new Color(
                  matchingBreak.symbol.color || defaultSymbol.color
                ),
                size: matchingBreak.symbol.size || defaultSymbol.size,
                outline: {
                  color: new Color(
                    matchingBreak.symbol.outline?.color || "#FFFFFF"
                  ),
                  width: matchingBreak.symbol.outline?.width || 1,
                },
              });
            }
          }
        }

        // Create popup content
        const popupTemplate = new PopupTemplate({
          title: labelText,
          content: [
            {
              type: "fields",
              fieldInfos: [
                // Add all fields as popup content
                ...Object.entries(item)
                  .filter(([key]) => key !== "geometry" && !key.startsWith("_"))
                  .map(([key, value]) => ({
                    fieldName: key,
                    label: key,
                    visible: true,
                  })),
              ],
            },
          ],
        });

        // Create attributes object with all data and metadata
        const attributes = {
          ...item,
          _internalId: `comp-${processedCount}`,
          labelText, // Store label text for label management
          isComp: true,
          // Add explicit values for commonly accessed fields
          name: item[labelColumn] || item.name || "",
          value: item[valueColumn] || "",
          status: item[statusColumn] || "",
          variable1: item[var1Column] || "",
          variable2: item[var2Column] || "",
        };

        // Create point graphic
        const pointGraphic = new Graphic({
          geometry: point,
          symbol: pointSymbol,
          attributes,
          popupTemplate,
        });

        // Create label graphic with direct geometry reference to ensure positioning
        const labelSymbol = new TextSymbol({
          text: labelText,
          font: {
            size: config?.labelOptions?.fontSize || 10,
            family: "sans-serif",
            weight: "normal",
          },
          color: new Color([0, 0, 0, 0.9]),
          haloColor: new Color([255, 255, 255, 0.8]),
          haloSize: 2,
          yoffset: -15, // Position above the point
        });

        const labelGraphic = new Graphic({
          geometry: point,
          symbol: labelSymbol,
          attributes: {
            ...attributes,
            isLabel: true, // Mark as label for identification
            parentID: `comp-${processedCount}`, // Reference to parent point
            layerId: layer.id,
          },
        });

        // Add to collection arrays
        pointGraphics.push(pointGraphic);
        labelGraphics.push(labelGraphic);

        pointsCount++;
        labelsCount++;
        processedCount++;
      } catch (error) {
        console.error(`[createCompLayer] Error processing comp item:`, error);
        errorCount++;
      }
    }

    // Add all graphics to layer at once (more efficient)
    if (pointGraphics.length > 0) {
      try {
        layer.addMany(pointGraphics);
        console.log(
          `[createCompLayer] Added ${pointsCount} point graphics to layer`
        );
      } catch (error) {
        console.error(`[createCompLayer] Error adding point graphics:`, error);
      }
    }

    if (labelGraphics.length > 0) {
      try {
        layer.addMany(labelGraphics);
        console.log(
          `[createCompLayer] Added ${labelsCount} label graphics to layer`
        );
      } catch (error) {
        console.error(`[createCompLayer] Error adding label graphics:`, error);
      }
    }

    // Final logging
    console.log(
      `[createCompLayer] Added ${pointsCount} points and ${labelsCount} labels to comp layer "${layer.title}".`
    );

    // Add metadata to the layer for future reference
    layer.metadata = {
      type: "comp",
      config,
      pointsCount,
      labelsCount,
      processedCount,
      errorCount,
      createdAt: new Date().toISOString(),
    };

    return layer;
  };

  /**
   * Enhanced createPipeLayer function with label support
   * @param {Object} config - Layer configuration object
   * @returns {GraphicsLayer} - The created graphics layer
   */
  const createPipeLayer = async (config) => {
    console.log("Creating Pipe Layer with config:", config);

    try {
      // Dynamically import required modules
      const [
        { default: GraphicsLayer },
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol },
        { default: TextSymbol },
        { default: Color },
        { default: PopupTemplate },
      ] = await Promise.all([
        import("@arcgis/core/layers/GraphicsLayer"),
        import("@arcgis/core/Graphic"),
        import("@arcgis/core/geometry/Point"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol"),
        import("@arcgis/core/symbols/TextSymbol"),
        import("@arcgis/core/Color"),
        import("@arcgis/core/PopupTemplate"),
      ]);

      // Create the graphics layer
      const graphicsLayer = new GraphicsLayer({
        title: config?.title || "Pipeline Map Layer",
        listMode: "show",
        // Add the layer type identifier for the label manager to recognize
        visualizationType: "pipe",
        isVisualizationLayer: true,
      });

      // Extract needed configuration
      const {
        customData,
        nameColumn,
        statusColumn,
        latitudeColumn,
        longitudeColumn,
        symbol = {},
        labelOptions = {}, // Extract label options
      } = config;

      // Default symbol properties if not specified
      const pointSize = symbol.size !== undefined ? Number(symbol.size) : 12;
      const defaultColor = "#0078D4";
      const outlineColor = symbol.outline?.color || "#FFFFFF";
      const outlineWidth =
        symbol.outline?.width !== undefined ? Number(symbol.outline.width) : 1;

      // Process label options
      const enableLabels = labelOptions?.includeVariables !== false; // Default to true
      const labelFontSize = labelOptions?.fontSize || 10;
      const visibleAtAllZooms = labelOptions?.visibleAtAllZooms || false;
      const avoidCollisions = labelOptions?.avoidCollisions !== false; // Default to true

      console.log("Pipe layer label options:", {
        enableLabels,
        labelFontSize,
        visibleAtAllZooms,
        avoidCollisions,
      });

      // Status color mapping
      const statusColors = config.statusColors || {
        "In Progress": "#FFB900",
        Approved: "#107C10",
        Pending: "#0078D4",
        Completed: "#107C10",
        Rejected: "#D13438",
        default: defaultColor,
      };

      // Check if we have the necessary data
      if (
        Array.isArray(customData) &&
        customData.length > 0 &&
        latitudeColumn &&
        longitudeColumn
      ) {
        // Create graphics for each data point
        customData.forEach((item, index) => {
          // Skip if missing coordinates
          if (!item[latitudeColumn] || !item[longitudeColumn]) return;

          const lat = parseFloat(item[latitudeColumn]);
          const lon = parseFloat(item[longitudeColumn]);

          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lon)) return;

          // Get the status and corresponding color
          const status = item[statusColumn] || "default";
          const pointColor =
            statusColors[status] || statusColors.default || defaultColor;

          // Create the point geometry
          const point = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 },
          });

          // Create the symbol with status-based color
          const pointSymbol = new SimpleMarkerSymbol({
            style: symbol.style || "circle",
            size: pointSize,
            color: new Color(pointColor),
            outline: {
              color: new Color(outlineColor),
              width: outlineWidth,
            },
          });

          // Determine label text based on configuration
          let labelText = "";
          if (nameColumn && item[nameColumn]) {
            labelText = String(item[nameColumn]);

            // Include status if available and options allow it
            if (enableLabels && statusColumn && item[statusColumn]) {
              labelText += `: ${item[statusColumn]}`;
            }
          } else if (statusColumn && item[statusColumn]) {
            labelText = String(item[statusColumn]);
          } else {
            labelText = `Point ${index + 1}`;
          }

          // Create the main graphic with attributes
          const pointGraphic = new Graphic({
            geometry: point,
            symbol: pointSymbol,
            attributes: {
              ...item,
              OBJECTID: index,
              displayName: item[nameColumn] || `Point ${index + 1}`,
              status: item[statusColumn] || "Unknown",
              // Add attributes to identify this as a pipe feature
              FEATURE_TYPE: "pipe",
              // Add attributes needed for label integration
              labelText: labelText,
              parentID: `pipe-${index}`, // Unique identifier for label parent
            },
            popupTemplate: new PopupTemplate({
              title: "{displayName}",
              content: [
                {
                  type: "fields",
                  fieldInfos: [
                    { fieldName: "status", label: statusColumn || "Status" },
                  ],
                },
              ],
            }),
          });

          // Add the graphic to the layer
          graphicsLayer.add(pointGraphic);

          // Create label graphic if labels are enabled
          if (enableLabels && labelText) {
            // Create the label symbol
            const textSymbol = new TextSymbol({
              text: labelText,
              font: {
                size: labelFontSize,
                family: "Arial",
                weight: "normal",
              },
              haloColor: new Color([255, 255, 255, 0.9]),
              haloSize: 1.5,
              color: new Color([0, 0, 0, 1]),
              verticalAlignment: "middle",
              horizontalAlignment: "center",
              // Add offset so label doesn't overlap with point
              yoffset: -pointSize - 5,
            });

            // Create the label graphic
            const labelGraphic = new Graphic({
              geometry: point,
              symbol: textSymbol,
              attributes: {
                OBJECTID: `label-${index}`,
                isLabel: true, // Flag for label manager to identify
                parentID: `pipe-${index}`, // Match with main feature for relationship
                labelText: labelText,
                FEATURE_TYPE: "label",
              },
            });

            // Add the label graphic to the layer
            graphicsLayer.add(labelGraphic);
          }
        });

        console.log(
          `Added ${graphicsLayer.graphics.length} points to pipeline layer`
        );
      } else {
        console.warn(
          "Missing required data for pipeline layer: customData, latitudeColumn, or longitudeColumn"
        );
      }

      return graphicsLayer;
    } catch (error) {
      console.error("Error creating pipe layer:", error);
      // Create a minimal graphics layer so the application doesn't break
      const GraphicsLayer = (await import("@arcgis/core/layers/GraphicsLayer"))
        .default;
      return new GraphicsLayer({
        title: "Error: Pipeline Map Layer",
        listMode: "show",
      });
    }
  };

  const extractRadiusProperties = (feature) => {
    // Attempt to extract radius info from various feature formats
    try {
      // Check if it's already in the expected format with center and radii
      if (feature.center && Array.isArray(feature.radii)) {
        return {
          center: feature.center,
          radii: feature.radii,
          marketAreaId:
            feature.attributes?.marketAreaId || feature.marketAreaId,
          style: feature.style,
        };
      }

      // Check if this is a feature with geometry and radius_points
      if (feature.attributes?.radius_points) {
        let radiusPoints;
        try {
          // Try parsing if it's a string
          radiusPoints =
            typeof feature.attributes.radius_points === "string"
              ? JSON.parse(feature.attributes.radius_points)
              : feature.attributes.radius_points;
        } catch (e) {
          console.warn("Failed to parse radius_points:", e);
          radiusPoints = feature.attributes.radius_points;
        }

        // Handle single radius point or array
        const points = Array.isArray(radiusPoints)
          ? radiusPoints
          : [radiusPoints];

        if (points.length > 0) {
          const firstPoint = points[0];
          return {
            center: firstPoint.center || firstPoint.point || firstPoint,
            radii: firstPoint.radii || [firstPoint.radius || 5], // Default 5 mile radius if not specified
            marketAreaId:
              feature.attributes?.marketAreaId || feature.attributes?.id,
            style: firstPoint.style || feature.attributes?.style,
          };
        }
      }

      // Check for ma_geometry_data
      if (feature.attributes?.ma_geometry_data) {
        let geoData;
        try {
          geoData =
            typeof feature.attributes.ma_geometry_data === "string"
              ? JSON.parse(feature.attributes.ma_geometry_data)
              : feature.attributes.ma_geometry_data;

          if (geoData.center || geoData.point) {
            return {
              center: geoData.center || geoData.point,
              radii: Array.isArray(geoData.radii)
                ? geoData.radii
                : [geoData.radius || 5],
              marketAreaId:
                feature.attributes?.marketAreaId || feature.attributes?.id,
              style: geoData.style,
            };
          }
        } catch (e) {
          console.warn("Failed to parse ma_geometry_data:", e);
        }
      }

      // Try extracting from raw attributes
      if (feature.attributes) {
        const attrs = feature.attributes;
        const possibleCenter = attrs.center || attrs.point || attrs.geometry;
        const possibleRadii = attrs.radii || attrs.radius;

        if (possibleCenter) {
          return {
            center: possibleCenter,
            radii: Array.isArray(possibleRadii)
              ? possibleRadii
              : [possibleRadii || 5],
            marketAreaId: attrs.marketAreaId || attrs.id,
            style: attrs.style,
          };
        }
      }

      // If we have a geometry field with x/y or lat/long, try using that
      if (feature.geometry) {
        if (
          feature.geometry.x !== undefined &&
          feature.geometry.y !== undefined
        ) {
          return {
            center: {
              x: feature.geometry.x,
              y: feature.geometry.y,
              spatialReference: feature.geometry.spatialReference,
            },
            radii: [5], // Default radius of 5 miles if none specified
            marketAreaId:
              feature.attributes?.marketAreaId || feature.attributes?.id,
            style: feature.attributes?.style,
          };
        } else if (
          feature.geometry.longitude !== undefined &&
          feature.geometry.latitude !== undefined
        ) {
          return {
            center: {
              longitude: feature.geometry.longitude,
              latitude: feature.geometry.latitude,
              spatialReference: feature.geometry.spatialReference,
            },
            radii: [5], // Default radius of 5 miles if none specified
            marketAreaId:
              feature.attributes?.marketAreaId || feature.attributes?.id,
            style: feature.attributes?.style,
          };
        }
      }

      // If all else fails, look for fields that might contain the data
      for (const key in feature) {
        if (
          key.toLowerCase().includes("radius") ||
          key.toLowerCase().includes("center")
        ) {
          console.log(
            `[MapContext] Found potential radius data in field: ${key}`,
            feature[key]
          );
        }
      }

      return null;
    } catch (error) {
      console.error(
        "[MapContext] Error extracting radius properties:",
        error,
        feature
      );
      return null;
    }
  };

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize the processing flag
  updateFeatureStyles.isProcessing = false;

  // Debounce the function
  const debouncedUpdateFeatureStyles = useCallback(
    debounce(updateFeatureStyles, 300), // 300ms delay
    [updateFeatureStyles]
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

        const responseData = await updateMarketArea(
          projectId,
          marketAreaId,
          updates
        );

        // Optionally update your local state if you store MarketAreas in context
        // e.g. if you fetch MarketAreas on mount and keep them in state:
        // setMarketAreas(prev => {
        //   return prev.map(ma => ma.id === marketAreaId ? {...ma, ...responseData} : ma);
        // });

        console.log(
          "[MapContext] Successfully saved MarketArea changes:",
          responseData
        );
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

  const queryFeatures = useCallback(
    async (searchText) => {
      if (!activeLayers.length || !mapView) return [];

      const allFeatures = [];

      for (const type of activeLayers) {
        const layer = featureLayersRef.current[type];
        const layerConfig = FEATURE_LAYERS[type];
        if (!layer || !layerConfig) continue;

        // Build layer-specific WHERE clause:
        let whereClause = "";
        const upperText = searchText.toUpperCase(); // for easier comparisons

        switch (type) {
          case "zip":
            whereClause = /^\d+$/.test(searchText)
              ? `ZCTA5 LIKE '${searchText}%'`
              : `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
            break;

          case "county":
            whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
            break;

          case "tract":
            whereClause = `(STATE_FIPS || COUNTY_FIPS || TRACT_FIPS) LIKE '${searchText}%'`;
            break;

          case "blockgroup":
            whereClause = `(STATE_FIPS || COUNTY_FIPS || TRACT_FIPS || BLOCKGROUP_FIPS) LIKE '${searchText}%'`;
            break;

          case "block":
            // Simplified block search using GEOID
            whereClause = `GEOID LIKE '${searchText}%'`;

            // Add debug logging to check layer fields
            if (layer && layer.fields) {
              console.log(
                "[MapContext] Block layer fields:",
                layer.fields.map((f) => f.name).join(", ")
              );
            }
            break;

          case "place":
          case "cbsa":
          case "state":
          case "md":
          default:
            whereClause = `UPPER(NAME) LIKE UPPER('%${searchText}%')`;
            break;
        }

        try {
          const { default: Query } = await import(
            "@arcgis/core/rest/support/Query"
          );

          const query = new Query({
            where: whereClause,
            outFields: ["*"],
            returnGeometry: true,
            num: 100,
            distance: 0,
            units: "meters",
            spatialRel: "esriSpatialRelIntersects",
          });

          // Some layers might be group layers containing multiple sub-layers
          let layersToQuery = [];
          if (layer.featureLayers) {
            layersToQuery = layer.featureLayers;
          } else {
            layersToQuery = [layer];
          }

          // Query each sub-layer with error handling
          const queryPromises = layersToQuery.map(async (l) => {
            try {
              console.log(
                `[MapContext] Querying layer ${type} with clause: ${whereClause}`
              );

              // Check if the layer is properly loaded and has queryFeatures method
              if (!l || typeof l.queryFeatures !== "function") {
                console.warn(
                  `[MapContext] Invalid layer or queryFeatures not available for ${type}`
                );
                return { features: [] };
              }

              const result = await l.queryFeatures(query);

              // Validate the result
              if (!result || !Array.isArray(result.features)) {
                console.warn(`[MapContext] Invalid result format for ${type}`);
                return { features: [] };
              }

              console.log(
                `[MapContext] Query done for layer ${type}, found ${result.features.length} features`
              );
              return result;
            } catch (error) {
              console.error(
                `[MapContext] Error querying sub-layer in ${type}:`,
                error
              );
              return { features: [] };
            }
          });

          const results = await Promise.all(queryPromises);

          // Merge & remove duplicates by unique ID, with enhanced handling for ZIP vs other types
          results.forEach((res) => {
            if (res && Array.isArray(res.features)) {
              const unique = res.features.filter((f) => {
                // For ZIP code layers, use ZIP as the unique identifier
                if (type === "zip") {
                  const zipCode = f.attributes.ZCTA5;
                  return (
                    zipCode &&
                    !allFeatures.some(
                      (existing) => existing.attributes.ZCTA5 === zipCode
                    )
                  );
                }

                // For other layers, use OBJECTID or FID as the unique identifier
                const fid = f.attributes.OBJECTID || f.attributes.FID;
                return (
                  fid &&
                  !allFeatures.some(
                    (existing) =>
                      (existing.attributes.OBJECTID ||
                        existing.attributes.FID) === fid
                  )
                );
              });
              allFeatures.push(...unique);
            }
          });
        } catch (error) {
          console.error(`[MapContext] Error searching ${type}:`, error);
          toast.error(`Error searching in ${type} layer`);
        }
      }

      // Sort the combined results by name if possible
      allFeatures.sort((a, b) => {
        const nameA = (
          a.attributes.NAME ||
          a.attributes.PO_NAME ||
          a.attributes.ZCTA5 ||
          ""
        ).toUpperCase();
        const nameB = (
          b.attributes.NAME ||
          b.attributes.PO_NAME ||
          b.attributes.ZCTA5 ||
          ""
        ).toUpperCase();
        return nameA.localeCompare(nameB);
      });

      return allFeatures;
    },
    [activeLayers, mapView, featureLayersRef, FEATURE_LAYERS]
  );

  const queryFeaturesForMarketArea = async (marketArea) => {
    console.log("Querying features for market area:", marketArea.id);

    if (
      !marketArea ||
      !marketArea.locations ||
      marketArea.locations.length === 0
    ) {
      console.warn(`Market area ${marketArea.id} has no locations to query`);
      return [];
    }

    if (!featureLayers || !mapView) {
      console.warn("Feature layers or map view not initialized");
      return [];
    }

    try {
      const { default: Query } = await import(
        "@arcgis/core/rest/support/Query"
      );

      const layer = featureLayers[marketArea.ma_type];
      if (!layer) {
        console.warn(`No feature layer found for type ${marketArea.ma_type}`);
        return [];
      }

      // Build a where clause based on the market area type and locations
      let whereClause = "";

      if (marketArea.ma_type === "zip") {
        // For ZIP codes, create a more robust query
        const validZips = marketArea.locations
          .map((loc) => {
            const zipValue = (loc.id || loc.name || "").trim();
            if (!zipValue || zipValue === "00000") return null;

            // Format ZIP code properly (5 digits)
            const formattedZip = zipValue.padStart(5, "0").substring(0, 5);
            return formattedZip;
          })
          .filter(Boolean); // Remove null/empty values

        if (validZips.length === 0) {
          console.warn(
            "No valid ZIP codes found for market area:",
            marketArea.id
          );
          return [];
        }

        whereClause = validZips.map((zip) => `ZIP = '${zip}'`).join(" OR ");

        console.log("ZIP where clause:", whereClause);
      } else if (marketArea.ma_type === "county") {
        // For counties, use the NAME field with LIKE operator and add state filtering
        const validCounties = marketArea.locations
          .map((loc) => {
            const countyName = (loc.id || loc.name || "")
              .replace(/\s+County$/i, "") // Remove "County" suffix if present
              .trim()
              .replace(/'/g, "''"); // Escape single quotes

            if (!countyName) return null;

            // Get state information for filtering
            let stateFilter = "";
            const stateValue = loc.state || "CA";

            // Convert to FIPS code if needed
            let stateFips = STATE_MAPPINGS.getStateFips(stateValue);
            if (stateFips) {
              stateFilter = ` AND STATE = '${stateFips}'`;
            }

            return `(UPPER(NAME) LIKE UPPER('%${countyName}%')${stateFilter})`;
          })
          .filter(Boolean); // Remove null/empty values

        if (validCounties.length === 0) {
          console.warn(
            "No valid counties found for market area:",
            marketArea.id
          );
          return [];
        }

        whereClause = validCounties.join(" OR ");
        console.log("County where clause with state filtering:", whereClause);
      } else if (marketArea.ma_type === "place") {
        // For places, use the NAME field with LIKE operator and add state filtering
        const validPlaces = marketArea.locations
          .map((loc) => {
            const placeName = (loc.id || loc.name || "")
              .trim()
              .replace(/\s+(city|town|village|borough|cdp)$/i, "") // Remove type suffix if present
              .replace(/'/g, "''"); // Escape single quotes

            if (!placeName) return null;

            // Get state information for filtering
            let stateFilter = "";
            const stateValue = loc.state || "CA";

            // Convert to FIPS code if needed
            let stateFips = STATE_MAPPINGS.getStateFips(stateValue);
            if (stateFips) {
              stateFilter = ` AND STATE = '${stateFips}'`;
            }

            return `(UPPER(NAME) LIKE UPPER('%${placeName}%')${stateFilter})`;
          })
          .filter(Boolean); // Remove null/empty values

        if (validPlaces.length === 0) {
          console.warn("No valid places found for market area:", marketArea.id);
          return [];
        }

        whereClause = validPlaces.join(" OR ");
        console.log("Place where clause with state filtering:", whereClause);
      } else {
        // We only support zip, county, and place - but this is a fallback
        console.warn(`Unsupported market area type: ${marketArea.ma_type}`);
        return [];
      }

      // Skip query if where clause is empty
      if (!whereClause) {
        console.warn(`Empty where clause for market area ${marketArea.id}`);
        return [];
      }

      console.log(
        `Querying ${marketArea.ma_type} layer with where clause:`,
        whereClause
      );

      // Create query with added timeout and error handling
      const query = new Query({
        where: whereClause,
        outFields: ["*"],
        returnGeometry: true,
        outSpatialReference: mapView.spatialReference,
        maxRecordCount: 100, // Limit results
        num: 100, // Limit results
        start: 0,
      });

      // Query features with error handling
      let features = [];

      // For group layers (layer.featureLayers), try each sublayer
      if (layer.featureLayers && Array.isArray(layer.featureLayers)) {
        for (const sublayer of layer.featureLayers) {
          if (!sublayer || !sublayer.queryFeatures) continue;

          try {
            const result = await sublayer.queryFeatures(query);
            if (result && result.features && result.features.length > 0) {
              features = result.features;
              console.log(
                `Found ${features.length} features in sublayer for ${marketArea.ma_type}`
              );
              break; // Found features, stop checking other sublayers
            }
          } catch (error) {
            console.warn(
              `Error querying sublayer for ${marketArea.ma_type}:`,
              error
            );
            // Try with a simpler query if needed (handling specific errors)
            if (
              error.message &&
              error.message.includes("Geometry is not supported with DISTINCT")
            ) {
              console.log("Retrying query without DISTINCT parameter");
              try {
                const retryResult = await sublayer.queryFeatures(query);
                if (
                  retryResult &&
                  retryResult.features &&
                  retryResult.features.length > 0
                ) {
                  features = retryResult.features;
                  console.log(
                    `Retry successful! Found ${features.length} features`
                  );
                  break;
                }
              } catch (retryError) {
                console.warn("Retry also failed:", retryError);
              }
            }
            // Continue to next sublayer
          }
        }
      }
      // For single layers
      else if (layer.queryFeatures) {
        try {
          const result = await layer.queryFeatures(query);
          if (result && result.features) {
            features = result.features;
            console.log(
              `Found ${features.length} features in layer for ${marketArea.ma_type}`
            );
          }
        } catch (error) {
          console.warn(
            `Error querying features for ${marketArea.ma_type}:`,
            error
          );

          // Add specific handling for place layer errors
          if (marketArea.ma_type === "place") {
            console.log("Trying alternative approach for place query...");

            try {
              // Try with a simpler query - just match on the beginning of the name
              const simplifiedQuery = new Query({
                where: marketArea.locations
                  .map((loc) => {
                    const cleanName = (loc.id || loc.name || "")
                      .split(/\s+/)[0] // Take just first word of place name
                      .replace(/'/g, "''");
                    if (!cleanName) return "";

                    const stateValue = loc.state || "CA";
                    const stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                    const stateFilter = stateFips
                      ? ` AND STATE = '${stateFips}'`
                      : "";

                    return `(UPPER(NAME) LIKE UPPER('${cleanName}%')${stateFilter})`;
                  })
                  .filter(Boolean) // Remove empty clauses
                  .join(" OR "),
                outFields: ["*"],
                returnGeometry: true,
                outSpatialReference: mapView.spatialReference,
              });

              // Skip if where clause is empty
              if (!simplifiedQuery.where) {
                console.warn("Simplified place query has empty where clause");
                return features;
              }

              console.log("Simplified place query:", simplifiedQuery.where);
              const retryResult = await layer.queryFeatures(simplifiedQuery);

              if (
                retryResult &&
                retryResult.features &&
                retryResult.features.length > 0
              ) {
                features = retryResult.features;
                console.log(
                  `Simplified query successful! Found ${features.length} place features`
                );
              }
            } catch (retryError) {
              console.warn(
                "Alternative place query approach also failed:",
                retryError
              );
            }
          }

          // Existing error handling for DISTINCT error
          if (
            error.message &&
            error.message.includes("Geometry is not supported with DISTINCT")
          ) {
            console.log("Retrying query without DISTINCT parameter");
            try {
              const retryResult = await layer.queryFeatures(query);
              if (retryResult && retryResult.features) {
                features = retryResult.features;
                console.log(
                  `Retry successful! Found ${features.length} features`
                );
              }
            } catch (retryError) {
              console.warn("Retry also failed:", retryError);
            }
          }
        }
      }

      console.log(`Query result for ${marketArea.ma_type}:`, {
        hasFeatures: features.length > 0,
        count: features.length,
      });

      return features;
    } catch (error) {
      console.error(
        `Error querying features for market area ${marketArea.id}:`,
        error
      );
      return [];
    }
  };

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

  useEffect(() => {
    console.log(
      "🔍 [LAYER ORDER DEBUG] Market area visibility effect triggered"
    );
    console.log("🔍 [LAYER ORDER DEBUG] Effect conditions:", {
      hasMapView: !!mapView,
      marketAreasCount: marketAreas?.length || 0,
      visibleMarketAreaIdsCount: visibleMarketAreaIds?.length || 0,
      layersReady,
      firstMarketAreaId: marketAreas?.[0]?.id,
      firstVisibleId: visibleMarketAreaIds?.[0],
    });

    if (
      mapView &&
      marketAreas &&
      marketAreas.length > 0 &&
      visibleMarketAreaIds &&
      visibleMarketAreaIds.length > 0 &&
      layersReady
    ) {
      const visibleMarketAreas = marketAreas.filter((ma) =>
        visibleMarketAreaIds.includes(ma.id)
      );

      console.log("🔍 [LAYER ORDER DEBUG] Processing visible market areas:", {
        count: visibleMarketAreas.length,
        ids: visibleMarketAreas.map((ma) => ma.id),
        types: visibleMarketAreas.map((ma) => ma.ma_type),
        graphicsLayerIndex: selectionGraphicsLayerRef.current
          ? mapView.map.layers.indexOf(selectionGraphicsLayerRef.current)
          : -1,
        currentGraphicsCount:
          selectionGraphicsLayerRef.current?.graphics?.length || 0,
      });

      const processedMarketAreaIds = new Set();

      visibleMarketAreas.forEach(async (ma) => {
        if (processedMarketAreaIds.has(ma.id)) {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Skipping already processed market area: ${ma.id}`
          );
          return;
        }

        processedMarketAreaIds.add(ma.id);

        console.log(
          `🔍 [LAYER ORDER DEBUG] Processing market area ${ma.id} of type ${ma.ma_type}`
        );

        // Log graphics layer state before processing each market area
        const layerIndex = selectionGraphicsLayerRef.current
          ? mapView.map.layers.indexOf(selectionGraphicsLayerRef.current)
          : -1;
        console.log(
          `🔍 [LAYER ORDER DEBUG] Graphics layer state before processing ${ma.id}:`,
          {
            index: layerIndex,
            graphicsCount:
              selectionGraphicsLayerRef.current?.graphics?.length || 0,
          }
        );

        if (ma.ma_type === "radius") {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Processing radius market area: ${ma.id}`
          );

          const existingRadiusGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) =>
                g.attributes?.marketAreaId === ma.id &&
                g.attributes?.FEATURE_TYPE === "radius"
            );

          if (existingRadiusGraphics.length > 0) {
            console.log(
              `🔍 [LAYER ORDER DEBUG] Market area ${ma.id} already has ${existingRadiusGraphics.length} radius graphics, skipping drawing`
            );
            return;
          }

          if (ma.radius_points) {
            let radiusPoints;
            try {
              radiusPoints =
                typeof ma.radius_points === "string"
                  ? JSON.parse(ma.radius_points)
                  : ma.radius_points;
            } catch (e) {
              console.warn(
                `🔍 [LAYER ORDER DEBUG] Failed to parse radius_points for ${ma.id}:`,
                e
              );
              radiusPoints = ma.radius_points;
            }

            const points = Array.isArray(radiusPoints)
              ? radiusPoints
              : [radiusPoints];
            console.log(
              `🔍 [LAYER ORDER DEBUG] Drawing ${points.length} radius points for ${ma.id}`
            );

            for (const point of points) {
              await drawRadius(
                point,
                ma.style_settings || {
                  fillColor: "#0078D4",
                  fillOpacity: 0.35,
                  borderColor: "#0078D4",
                  borderWidth: 3,
                  noFill: false,
                  noBorder: false,
                },
                ma.id,
                ma.order || 0
              );
            }
          }
        } else if (ma.ma_type === "drivetime") {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Processing drive time market area: ${ma.id}`
          );

          let driveTimePoints = ma.drive_time_points;

          if (typeof driveTimePoints === "string") {
            try {
              driveTimePoints = JSON.parse(driveTimePoints);
            } catch {
              try {
                driveTimePoints = eval(`(${driveTimePoints})`);
              } catch {
                console.warn(
                  `🔍 [LAYER ORDER DEBUG] Failed to parse drive_time_points for ${ma.id}`
                );
                driveTimePoints = null;
              }
            }
          }

          if (!Array.isArray(driveTimePoints)) {
            driveTimePoints = driveTimePoints ? [driveTimePoints] : [];
          }

          console.log(
            `🔍 [LAYER ORDER DEBUG] Processing ${driveTimePoints.length} drive time points for ${ma.id}`
          );

          for (const point of driveTimePoints) {
            const transformedPoint = transformDriveTimePoint(point, ma.id);
            if (transformedPoint) {
              await drawDriveTimePolygon(
                transformedPoint,
                ma.style_settings || {
                  fillColor: "#0078D4",
                  fillOpacity: 0.35,
                  borderColor: "#0078D4",
                  borderWidth: 3,
                },
                ma.id,
                ma.order || 0
              );
            }
          }
        } else if (ma.ma_type === "site_location") {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Processing site location market area: ${ma.id}`
          );

          let siteData = ma.site_location_data;
          if (typeof siteData === "string") {
            try {
              siteData = JSON.parse(siteData);
            } catch (e) {
              console.error(
                `🔍 [LAYER ORDER DEBUG] Error parsing site location data for ${ma.id}:`,
                e
              );
            }
          }

          if (
            siteData &&
            siteData.point &&
            siteData.point.latitude &&
            siteData.point.longitude
          ) {
            await drawSiteLocation(
              siteData,
              ma.style_settings || {
                fillColor: "#0078D4",
                fillOpacity: 0.35,
                borderColor: "#0078D4",
                borderWidth: 3,
              },
              ma.id,
              ma.order || 0
            );
          }
        } else if (ma.locations && ma.locations.length > 0) {
          console.log(
            `🔍 [LAYER ORDER DEBUG] Processing polygon market area ${ma.id} with ${ma.locations.length} locations`
          );

          const existingMarketAreaGraphics =
            selectionGraphicsLayerRef.current.graphics.filter(
              (g) => g.attributes?.marketAreaId === ma.id
            );

          if (existingMarketAreaGraphics.length > 0) {
            console.log(
              `🔍 [LAYER ORDER DEBUG] Market area ${ma.id} already has ${existingMarketAreaGraphics.length} graphics, skipping processing`
            );
            return;
          }

          const features = ma.locations.map((loc) => ({
            geometry: loc.geometry,
            attributes: {
              ...loc,
              marketAreaId: ma.id,
              FEATURE_TYPE: ma.ma_type || "tract",
              order: ma.order || 0,
            },
          }));

          await displayFeatures(features);

          if (ma.style) {
            const marketAreaFeatures =
              selectionGraphicsLayerRef.current.graphics
                .filter((g) => g.attributes?.marketAreaId === ma.id)
                .map((g) => ({
                  geometry: g.geometry,
                  attributes: g.attributes,
                }));

            if (marketAreaFeatures.length > 0) {
              updateFeatureStyles(
                marketAreaFeatures,
                ma.style,
                ma.ma_type || "tract",
                true
              );
            }
          }
        }

        // Log graphics layer state after processing each market area
        const finalLayerIndex = selectionGraphicsLayerRef.current
          ? mapView.map.layers.indexOf(selectionGraphicsLayerRef.current)
          : -1;
        console.log(
          `🔍 [LAYER ORDER DEBUG] Graphics layer state after processing ${ma.id}:`,
          {
            index: finalLayerIndex,
            graphicsCount:
              selectionGraphicsLayerRef.current?.graphics?.length || 0,
            totalMapLayers: mapView.map.layers.length,
          }
        );
      });

      // Final summary after processing all market areas
      setTimeout(() => {
        const finalLayerIndex = selectionGraphicsLayerRef.current
          ? mapView.map.layers.indexOf(selectionGraphicsLayerRef.current)
          : -1;
        console.log(
          "🔍 [LAYER ORDER DEBUG] FINAL STATE after processing all visible market areas:",
          {
            graphicsLayerIndex: finalLayerIndex,
            totalGraphicsInLayer:
              selectionGraphicsLayerRef.current?.graphics?.length || 0,
            totalMapLayers: mapView.map.layers.length,
            processedMarketAreas: processedMarketAreaIds.size,
            basemapReferenceLayersCount:
              mapView.map.basemap.referenceLayers.length,
            basemapReferenceLayersVisible: mapView.map.basemap.referenceLayers
              .map((l) => l.visible)
              .toArray(),
          }
        );
      }, 1000);
    }
  }, [
    mapView,
    marketAreas,
    visibleMarketAreaIds,
    drawRadius,
    displayFeatures,
    updateFeatureStyles,
    calculateDriveTimePolygon,
    drawDriveTimePolygon,
    drawSiteLocation,
    extractSiteLocationInfo,
    layersReady,
  ]);

  useEffect(() => {
    if (mapView && !selectionGraphicsLayerRef.current) {
      initializeGraphicsLayers();
    }
  }, [mapView, initializeGraphicsLayers]);

  useEffect(() => {
    if (!mapView) return;

    console.log("🔍 [LAYER ORDER DEBUG] Setting up map click handler");

    // Verify layer integrity when setting up click handler
    const referenceLayersCount = mapView.map.basemap.referenceLayers.length;
    console.log("🔍 [LAYER ORDER DEBUG] Map state when setting up click handler:", {
      totalMapLayers: mapView.map.layers.length,
      graphicsLayerExists: !!selectionGraphicsLayerRef.current,
      graphicsLayerIndex: selectionGraphicsLayerRef.current ? 
        mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1,
      activeLayers: activeLayers.length,
      isMapSelectionActive,
      basemapReferenceLayersCount: referenceLayersCount,
      referenceLayersPresent: referenceLayersCount > 0
    });

    // Ensure popup behaviors don't interfere with layer rendering
    if (mapView.popup) {
      mapView.popup.autoOpenEnabled = false;
      mapView.popup.dockEnabled = false;
      mapView.popup.defaultPopupTemplateEnabled = false;
      console.log("🔍 [LAYER ORDER DEBUG] Disabled popup behaviors to prevent rendering conflicts");
    }

    // Disable popups on all feature layers to prevent rendering interference
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
      console.log("🔍 [LAYER ORDER DEBUG] Map click detected:", {
        isMapSelectionActive,
        activeLayersCount: activeLayers.length,
        clickPosition: { x: event.x, y: event.y },
        referenceLayersCount: mapView.map.basemap.referenceLayers.length
      });

      event.stopPropagation();

      if (!isMapSelectionActive || !activeLayers.length) {
        console.log("🔍 [LAYER ORDER DEBUG] Map click ignored - selection not active or no active layers");
        return;
      }

      // Verify reference layers haven't been lost during interaction
      const currentReferenceCount = mapView.map.basemap.referenceLayers.length;
      if (currentReferenceCount === 0) {
        console.warn("🔍 [LAYER ORDER DEBUG] WARNING: Reference layers missing during map click!");
      }

      try {
        const hitResult = await mapView.hitTest(event);
        console.log("🔍 [LAYER ORDER DEBUG] Hit test results:", {
          hasResults: !!hitResult?.results?.length,
          resultCount: hitResult?.results?.length || 0,
          resultTypes: hitResult?.results?.map(r => r.type) || [],
          resultLayers: hitResult?.results?.map(r => r.layer?.title || r.layer?.id) || []
        });

        if (hitResult && hitResult.results.length > 0) {
          const validResults = hitResult.results.filter((result) => {
            const graphic = result.graphic;
            const graphicMarketAreaId = graphic.attributes?.marketAreaId;
            
            // Only allow selection if feature doesn't belong to another market area 
            // or belongs to the one being edited
            return (
              !graphicMarketAreaId ||
              (editingMarketArea && graphicMarketAreaId === editingMarketArea.id)
            );
          });

          console.log("🔍 [LAYER ORDER DEBUG] Valid hit results:", {
            validCount: validResults.length,
            totalCount: hitResult.results.length,
            filteredOut: hitResult.results.length - validResults.length
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
              
              console.log("🔍 [LAYER ORDER DEBUG] Processing valid graphic click:", {
                hasExistingMarketAreaId: !!existingMarketAreaId,
                editingMarketAreaId: editingMarketArea?.id,
                layerTitle: graphicResult.layer.title,
                graphicsCountBefore: selectionGraphicsLayerRef.current?.graphics?.length || 0
              });

              if (existingMarketAreaId && 
                  (!editingMarketArea || existingMarketAreaId !== editingMarketArea.id)) {
                console.log("🔍 [LAYER ORDER DEBUG] Cannot select feature - belongs to another market area:", existingMarketAreaId);
                return;
              }

              const matchedLayerType = activeLayers.find(
                (type) => FEATURE_LAYERS[type].title === graphicResult.layer.title
              );

              console.log("🔍 [LAYER ORDER DEBUG] Adding feature to selection:", {
                layerType: matchedLayerType,
                graphicsLayerIndex: selectionGraphicsLayerRef.current ? 
                  mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1
              });

              await addToSelection(graphic, matchedLayerType);

              // Verify layer integrity after selection
              const postSelectionReferenceCount = mapView.map.basemap.referenceLayers.length;
              console.log("🔍 [LAYER ORDER DEBUG] After adding to selection:", {
                graphicsCountAfter: selectionGraphicsLayerRef.current?.graphics?.length || 0,
                graphicsLayerIndex: selectionGraphicsLayerRef.current ? 
                  mapView.map.layers.indexOf(selectionGraphicsLayerRef.current) : -1,
                referenceLayersIntact: postSelectionReferenceCount > 0,
                referenceLayersCount: postSelectionReferenceCount
              });

              // Re-ensure reference layers are visible if they exist
              if (postSelectionReferenceCount > 0) {
                mapView.map.basemap.referenceLayers.forEach(refLayer => {
                  if (!refLayer.visible) {
                    refLayer.visible = true;
                    console.log("🔍 [LAYER ORDER DEBUG] Re-enabled reference layer after selection");
                  }
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("🔍 [LAYER ORDER DEBUG] Error handling map click:", error);
      }
    };

    const handler = mapView.on("click", handleMapClick);
    
    return () => {
      console.log("🔍 [LAYER ORDER DEBUG] Removing map click handler");
      handler.remove();
      // Re-enable popups on cleanup if needed
    };
  }, [mapView, isMapSelectionActive, activeLayers, addToSelection, editingMarketArea]);


  // ENHANCED forceReferenceLayerRefresh FUNCTION
  // Provides manual control over reference layer management

  const forceReferenceLayerRefresh = useCallback(async () => {
    console.log("🔧 [MANUAL FIX] Starting reference layer refresh...");
    
    if (!mapView?.map?.basemap) {
      console.warn("🔧 [MANUAL FIX] Cannot refresh - missing map components");
      return false;
    }

    try {
      const { default: VectorTileLayer } = await import("@arcgis/core/layers/VectorTileLayer");
      
      // Clear existing reference layers that might be broken
      mapView.map.basemap.referenceLayers.removeAll();
      console.log("🔧 [MANUAL FIX] Cleared existing reference layers");
      
      // Add comprehensive label coverage
      const labelSources = [
        {
          url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
          title: "World Labels Primary"
        },
        {
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer",
          title: "World Reference Overlay"
        }
      ];
      
      let successCount = 0;
      
      for (const source of labelSources) {
        try {
          const labelLayer = new VectorTileLayer({
            url: source.url,
            title: source.title,
            listMode: "hide",
            visible: true,
            opacity: 1.0,
            blendMode: "normal"
          });
          
          mapView.map.basemap.referenceLayers.add(labelLayer);
          await labelLayer.when();
          
          successCount++;
          console.log(`🔧 [MANUAL FIX] Successfully added ${source.title}`);
        } catch (error) {
          console.warn(`🔧 [MANUAL FIX] Failed to add ${source.title}:`, error);
        }
      }
      
      // Force visibility on all reference layers
      mapView.map.basemap.referenceLayers.forEach(layer => {
        layer.visible = true;
        layer.opacity = 1.0;
      });
      
      console.log(`🔧 [MANUAL FIX] Reference layer refresh complete. Added ${successCount} layers.`);
      
      // Trigger a view refresh
      const currentExtent = mapView.extent.clone();
      await mapView.goTo(currentExtent, { animate: false });
      
      return successCount > 0;
      
    } catch (error) {
      console.error("🔧 [MANUAL FIX] Error refreshing reference layers:", error);
      return false;
    }
  }, [mapView]);

  // ENHANCED diagnosticLayerOrder FUNCTION
  // Provides comprehensive layer order analysis and health checking

  const diagnosticLayerOrder = useCallback(() => {
    console.log("🔍 [DIAGNOSTIC] Running comprehensive layer order diagnostic");
    
    if (!mapView || !selectionGraphicsLayerRef.current) {
      console.log("❌ [DIAGNOSTIC] Map or graphics layer not available");
      return { isHealthy: false, error: "Missing components" };
    }

    try {
      const graphicsLayerIndex = mapView.map.layers.indexOf(selectionGraphicsLayerRef.current);
      const graphicsCount = selectionGraphicsLayerRef.current.graphics.length;
      const layerVisible = selectionGraphicsLayerRef.current.visible;
      const layerOpacity = selectionGraphicsLayerRef.current.opacity;
      
      const basemapBaseCount = mapView.map.basemap.baseLayers.length;
      const basemapReferenceCount = mapView.map.basemap.referenceLayers.length;
      const operationalLayersCount = mapView.map.layers.length;
      
      const referenceLayersVisible = mapView.map.basemap.referenceLayers.map(l => l.visible).toArray();
      
      const hasReferenceIssue = basemapReferenceCount === 0;
      const hasGraphicsIssue = graphicsLayerIndex < 0 || !layerVisible;
      const hasVisibilityIssue = referenceLayersVisible.some(visible => !visible);
      
      const isHealthy = !hasReferenceIssue && !hasGraphicsIssue && !hasVisibilityIssue;

      console.log("🔍 [DIAGNOSTIC] === LAYER ORDER DIAGNOSTIC REPORT ===");
      console.log("┌───────────────────────────────────────────────────┐");
      console.log("│                 LAYER ANALYSIS                   │");
      console.log("├───────────────────────────────────────────────────┤");
      console.log(`│ Graphics Layer Index: ${graphicsLayerIndex.toString().padEnd(20)} │`);
      console.log(`│ Graphics Count: ${graphicsCount.toString().padEnd(25)} │`);
      console.log(`│ Graphics Visible: ${layerVisible.toString().padEnd(23)} │`);
      console.log(`│ Basemap Base Layers: ${basemapBaseCount.toString().padEnd(20)} │`);
      console.log(`│ Basemap Reference Layers: ${basemapReferenceCount.toString().padEnd(15)} │`);
      console.log(`│ Reference Layers Visible: ${referenceLayersVisible.filter(Boolean).length}/${referenceLayersVisible.length.toString().padEnd(13)} │`);
      console.log("├───────────────────────────────────────────────────┤");
      console.log(`│ Overall Status: ${(isHealthy ? "✅ HEALTHY" : "❌ ISSUES").padEnd(25)} │`);
      console.log("└───────────────────────────────────────────────────┘");

      if (hasReferenceIssue) {
        console.error("❌ [DIAGNOSTIC] CRITICAL: No reference layers! Labels cannot render above graphics");
        console.log("🔧 [DIAGNOSTIC] SOLUTION: Re-run initializeGraphicsLayers() or call forceReferenceLayerRefresh()");
      }
      
      if (hasGraphicsIssue) {
        console.error("❌ [DIAGNOSTIC] Graphics layer not properly positioned or visible");
      }
      
      if (hasVisibilityIssue) {
        console.warn("⚠️ [DIAGNOSTIC] Some reference layers are not visible");
      }
      
      if (isHealthy) {
        console.log("✅ [DIAGNOSTIC] Layer order is optimal!");
        console.log("✅ [DIAGNOSTIC] Expected rendering: Basemap (bottom) → Market Areas (middle) → Labels (top)");
      }

      console.log("🔍 [DIAGNOSTIC] Detailed layer stack:");
      if (basemapBaseCount > 0) {
        console.log("  🗺️ Base Layers:", mapView.map.basemap.baseLayers.map(l => l.title || l.id).toArray());
      }
      if (operationalLayersCount > 0) {
        console.log("  📍 Operational:", mapView.map.layers.map((l, i) => `${i}:${l.title || l.id}`).toArray());
      }
      if (basemapReferenceCount > 0) {
        console.log("  🏷️ Reference:", mapView.map.basemap.referenceLayers.map(l => `${l.title || l.id}(visible:${l.visible})`).toArray());
      }

      return {
        isHealthy,
        graphicsLayerIndex,
        graphicsCount,
        layerVisible,
        basemapReferenceCount,
        hasReferenceIssue,
        hasGraphicsIssue,
        hasVisibilityIssue
      };

    } catch (error) {
      console.error("🔍 [DIAGNOSTIC] Error during diagnostic:", error);
      return { isHealthy: false, error: error.message };
    }
  }, [mapView]);



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
    const otherAreaGraphics = selectionGraphicsLayerRef.current.graphics.f; // clear any radius shapes from the unified selection layer
    if (selectionGraphicsLayerRef.current) {
      const allRadiusGraphics =
        selectionGraphicsLayerRef.current.graphics.filter(
          (g) => g.attributes?.FEATURE_TYPE === "radius"
        );

      selectionGraphicsLayerRef.current.removeMany(allRadiusGraphics);
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

  const unionAllMarketAreas = async (marketAreas) => {
    // Gather all polygons
    let polygons = [];
    marketAreas.forEach((ma) => {
      if (ma.locations && ma.locations.length > 0) {
        ma.locations.forEach((loc) => {
          if (loc.geometry) polygons.push(loc.geometry);
        });
      }
    });

    if (!polygons.length) return null;

    // union them all
    try {
      const unioned = await geometryEngineAsync.union(polygons);
      return unioned;
    } catch (err) {
      console.error("Error unioning polygons:", err);
      return null;
    }
  };

  // Create ref outside your effects
  const hasCentered = useRef(false);

  useEffect(() => {
    let isActive = true;
    const MAX_WAIT_TIME = 4000; // Maximum wait time of 7 seconds
    const INITIAL_WAIT_TIME = 2000; // Increased initial wait time

    console.log("[MapContext] Centering effect triggered:", {
      hasCentered: hasCentered.current,
      mapReady: mapView?.ready,
      hasMarketAreas: Boolean(marketAreas?.length),
      marketAreasCount: marketAreas?.length,
      firstMarketArea: marketAreas?.[0]?.id,
    });

    if (!mapView?.ready) {
      console.log("[MapContext] Map not ready, skipping");
      return;
    }

    const centerMap = async () => {
      if (!isActive) return;

      try {
        // Enhanced waiting mechanism
        const startTime = Date.now();
        while (
          isActive &&
          (!marketAreas || marketAreas.length === 0) &&
          Date.now() - startTime < MAX_WAIT_TIME
        ) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log("[MapContext] Waiting for market areas to load...");
        }

        // Wait an additional initial time to ensure rendering
        await new Promise((resolve) => setTimeout(resolve, INITIAL_WAIT_TIME));

        // Always reset hasCentered when starting a new project
        const shouldResetCenter = !marketAreas || marketAreas.length === 0;

        if (shouldResetCenter) {
          console.log("[MapContext] Resetting center state - no market areas");
          hasCentered.current = false;
        }

        // If already centered and not forcibly resetting, return
        if (hasCentered.current && !shouldResetCenter) {
          console.log("[MapContext] Already centered, skipping");
          return;
        }

        if (marketAreas?.length > 0) {
          console.log(
            "[MapContext] Found market areas:",
            marketAreas.map((ma) => ({
              id: ma.id,
              name: ma.name,
              locationsCount: ma.locations?.length || 0,
              hasGeometry: Boolean(ma.locations?.[0]?.geometry),
            }))
          );

          // Find first market area with valid geometry
          let validGeometry = null;
          let maWithGeometry = null;

          for (const ma of marketAreas) {
            if (ma.locations?.length) {
              for (const loc of ma.locations) {
                if (loc.geometry?.rings?.length > 0) {
                  validGeometry = loc.geometry;
                  maWithGeometry = ma;
                  console.log(
                    "[MapContext] Found valid geometry in market area:",
                    {
                      id: ma.id,
                      name: ma.name,
                      geometryRings: loc.geometry.rings.length,
                    }
                  );
                  break;
                }
              }
              if (validGeometry) break;
            }
          }

          if (validGeometry && isActive) {
            try {
              const [Extent, SpatialReference] = await Promise.all([
                import("@arcgis/core/geometry/Extent").then((m) => m.default),
                import("@arcgis/core/geometry/SpatialReference").then(
                  (m) => m.default
                ),
              ]);

              console.log(
                "[MapContext] Creating extent from geometry for:",
                maWithGeometry?.name
              );

              const sr = new SpatialReference({ wkid: 102100 });

              let extent;
              if (validGeometry.rings) {
                const xCoords = [];
                const yCoords = [];

                validGeometry.rings[0].forEach((coord) => {
                  xCoords.push(coord[0]);
                  yCoords.push(coord[1]);
                });

                extent = new Extent({
                  xmin: Math.min(...xCoords),
                  ymin: Math.min(...yCoords),
                  xmax: Math.max(...xCoords),
                  ymax: Math.max(...yCoords),
                  spatialReference: sr,
                });

                console.log("[MapContext] Created extent:", {
                  xmin: Math.min(...xCoords),
                  ymin: Math.min(...yCoords),
                  xmax: Math.max(...xCoords),
                  ymax: Math.max(...yCoords),
                });
              }

              console.log(
                "[MapContext] Centering on market area:",
                maWithGeometry?.name
              );
              await mapView.goTo(
                {
                  target: extent || validGeometry,
                  zoom: 9,
                },
                {
                  duration: 1000,
                  easing: "ease-in-out",
                }
              );

              if (isActive) {
                console.log(
                  "[MapContext] Successfully centered on market area:",
                  maWithGeometry?.name
                );
                hasCentered.current = true;
              }
              return;
            } catch (err) {
              console.error(
                "[MapContext] Error centering on market area:",
                err
              );
              if (isActive) {
                await centerOnOrangeCounty();
              }
            }
          } else {
            console.log(
              "[MapContext] No valid geometry found in market areas:",
              marketAreas.map((ma) => ({
                id: ma.id,
                name: ma.name,
                locationsCount: ma.locations?.length,
                firstLocGeometry: Boolean(ma.locations?.[0]?.geometry),
              }))
            );
          }
        }

        console.log(
          "[MapContext] No valid project extent found, falling back to Orange County"
        );
        await centerOnOrangeCounty();
      } catch (err) {
        console.error("[MapContext] Centering error:", err);
        await centerOnOrangeCounty();
      }
    };

    async function centerOnOrangeCounty() {
      if (!isActive) return;

      console.log("[MapContext] Attempting to center on Orange County");
      try {
        const Point = (await import("@arcgis/core/geometry/Point")).default;
        const orangeCountyPoint = new Point({
          longitude: -117.8311,
          latitude: 33.7175,
        });

        await mapView.goTo(
          {
            target: orangeCountyPoint,
            zoom: 9,
          },
          {
            duration: 1000,
            easing: "ease-in-out",
          }
        );

        if (isActive) {
          const finalCenter = mapView.center;
          console.log(
            "[MapContext] Successfully centered on Orange County. View state:",
            {
              center: {
                latitude: finalCenter.latitude,
                longitude: finalCenter.longitude,
              },
              zoom: mapView.zoom,
              scale: mapView.scale,
            }
          );
          hasCentered.current = true;
        }
      } catch (err) {
        console.error("[MapContext] Error in Orange County fallback:", err);
      }
    }

    centerMap();

    return () => {
      isActive = false;
      console.log("[MapContext] Cleaning up centering effect");
    };
  }, [mapView, marketAreas]);

  useEffect(() => {
    if (!mapView || !selectionGraphicsLayerRef.current) return;

    // Here we re-draw everything in selectedFeatures.
    displayFeatures(selectedFeatures);
  }, [selectedFeatures, mapView, displayFeatures]);

  const value = useMemo(
    () => ({
      mapView,
      setMapView,
      activeLayers,
      resetMapState,
      transformRadiusPoint,
      transformDriveTimePoint,
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
      drawPoint,
      drawDriveTimePolygon,
      drawSiteLocation, 
      calculateDriveTimePolygon,
      clearMarketAreaGraphics,
      toggleMarketAreaEditMode,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      selectionGraphicsLayer: selectionGraphicsLayerRef.current,
      visibleMarketAreaIds,
      setVisibleMarketAreaIds,
      editingMarketArea,
      setEditingMarketArea,
      extractSiteLocationInfo,
      zoomToExtent,
      zoomToMarketArea,
      isOutsideZoomRange,
      zoomMessage,
      diagnosticLayerOrder,
      forceReferenceLayerRefresh,
    }),
    [
      mapView,
      activeLayers,
      toggleActiveLayerType,
      addActiveLayer,
      removeActiveLayer,
      isLayerLoading,
      transformRadiusPoint,
      transformDriveTimePoint,
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
      drawPoint,
      drawDriveTimePolygon,
      drawSiteLocation,
      calculateDriveTimePolygon,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      visibleMarketAreaIds,
      editingMarketArea,
      setEditingMarketArea,
      extractSiteLocationInfo,
      zoomToExtent,
      zoomToMarketArea,
      isOutsideZoomRange,
      zoomMessage,
      diagnosticLayerOrder,
      forceReferenceLayerRefresh,
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
export { FEATURE_LAYERS };
