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
      "name"
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
            { fieldName: "centerLatitude", label: "Center Latitude" }
          ]
        }
      ]
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 120, 212, 0.35],  // Semi-transparent blue
        outline: {
          color: [0, 120, 212, 1],  // Solid blue
          width: 2
        }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: {
        expression: "$feature.travelTimeMinutes + ' min'"
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
          weight: "bold"
        }
      }
    }],
    returnGeometry: true,
    mode: "ondemand",
    minScale: 0,
    maxScale: 0
  },
  // Country feature layer configuration
  country: {
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries/FeatureServer/0",
    outFields: [
      "OBJECTID",
      "COUNTRY",    // Country name
      "ISO",        // ISO country code
      "REGION",     // Region
      "CONTINENT",  // Continent
      "POP_CNTRY",  // Population
      "SQKM",       // Area in square kilometers
      "Shape_Area", // Shape area
      "Shape_Length" // Shape length
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
            { fieldName: "SQKM", label: "Area (sq km)" }
          ]
        }
      ]
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],  // Transparent fill
        outline: {
          color: [70, 70, 70, 0.9],  // Dark gray border
          width: 1.5
        }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: {
        expression: "$feature.COUNTRY"
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
          weight: "bold"
        }
      },
      minScale: 100000000,
      maxScale: 0
    }],
    // Parameters to control geometry detail level
    minScale: 500000000,
    maxScale: 0,
    maxAllowableOffset: 1000,  // Control geometry simplification (in meters)
    simplificationTolerance: 1000,  // Larger tolerance for countries (global scale)
    quantizationParameters: {
      mode: "view",
      originPosition: "upper-left",
      tolerance: 1000  // Higher value = less detail
    }
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
      "OBJECTID"
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
            { fieldName: "INTPTLON", label: "Longitude" }
          ]
        }
      ]
    }
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
  state: {
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/80",
    outFields: [
      "OBJECTID",
      "GEOID",     // State FIPS code
      "STUSAB",    // State abbreviation
      "NAME",      // State name
      "BASENAME",  // Base name
      "REGION",    // Census region
      "DIVISION",  // Census division
      "AREALAND",  // Land area
      "AREAWATER", // Water area
      "CENTLAT",   // Centroid latitude
      "CENTLON"    // Centroid longitude
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
            { fieldName: "REGION", label: "Census Region" },
            { fieldName: "DIVISION", label: "Census Division" },
            { fieldName: "AREALAND", label: "Land Area (sq m)" },
            { fieldName: "AREAWATER", label: "Water Area (sq m)" }
          ]
        }
      ]
    },
    labelingInfo: [{
      labelExpressionInfo: {
        expression: "$feature.NAME"
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
          weight: "bold"
        }
      }
    }],
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: {
          color: [110, 110, 110, 255],
          width: 2
        }
      }
    },
    // Add these parameters to control geometry detail level
    minScale: 5.91657527591555E8,
    maxScale: 100,
    spatialReference: {
      wkid: 102100
    },
    // Add these parameters to reduce geometry detail
    maxAllowableOffset: 500,  // Increase this value to reduce detail (in meters)
    simplificationTolerance: 500,  // Control geometry simplification
    quantizationParameters: {
      mode: "view",
      originPosition: "upper-left",
      tolerance: 500  // Higher value = less detail
    }
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
          
          // Get state info if available
          const stateFips = getValidStateFips();
          if (stateFips && STATE_ABBR_BY_FIPS[stateFips]) {
            // We have valid state info, include it
            const stateAbbr = STATE_ABBR_BY_FIPS[stateFips];
            return `${attributes.ZCTA5}, ${stateAbbr}`;
          }
          
          // Otherwise just show the ZIP code without state
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
    if (!mapView) {
      console.log("[MapContext] Cannot initialize graphics layer: no map view");
      return;
    }

    try {
      const { default: GraphicsLayer } = await import(
        "@arcgis/core/layers/GraphicsLayer"
      );

      // Remove any existing graphics layer first
      if (selectionGraphicsLayerRef.current) {
        mapView.map.remove(selectionGraphicsLayerRef.current);
      }

      // Create new graphics layer
      const selectionLayer = new GraphicsLayer({
        title: "Market Area Graphics",
        listMode: "hide",
        elevationInfo: {
          mode: "relative-to-ground",
          offset: 1,
        },
      });

      // Add to map
      mapView.map.add(selectionLayer);

      // Store in ref
      selectionGraphicsLayerRef.current = selectionLayer;

      console.log("[MapContext] Graphics layer initialized successfully");
      setLayersReady(true);
    } catch (error) {
      console.error("[MapContext] Error initializing graphics layer:", error);
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
        if (typeof marketArea.radius_points === 'string') {
          try {
            radiusPoints = JSON.parse(marketArea.radius_points);
          } catch (e) {
            console.warn(`Failed to parse radius_points for market area ${marketArea.id}:`, e);
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
        return radiusPoints.map(point => {
          if (!point) return null;

          // Create a normalized point structure
          const normalizedPoint = {
            center: point.center || point.point || null,
            radii: Array.isArray(point.radii) ? point.radii :
              (point.radius ? [point.radius] : [5]), // Default 5-mile radius
            style: point.style || marketArea.style || null
          };

          // Skip invalid points
          if (!normalizedPoint.center) {
            console.warn(`Invalid radius point in market area ${marketArea.id}: missing center`);
            return null;
          }

          return normalizedPoint;
        }).filter(Boolean); // Remove any null entries
      }

      // Case 2: Check for ma_geometry_data
      else if (marketArea.ma_geometry_data) {
        let geoData;

        // Parse if it's a string
        if (typeof marketArea.ma_geometry_data === 'string') {
          try {
            geoData = JSON.parse(marketArea.ma_geometry_data);
          } catch (e) {
            console.warn(`Failed to parse ma_geometry_data for market area ${marketArea.id}:`, e);
            return null;
          }
        } else {
          geoData = marketArea.ma_geometry_data;
        }

        // Convert to radius point format
        if (geoData.center || geoData.point) {
          return [{
            center: geoData.center || geoData.point,
            radii: Array.isArray(geoData.radii) ? geoData.radii :
              (geoData.radius ? [geoData.radius] : [5]), // Default 5-mile radius
            style: geoData.style || marketArea.style || null
          }];
        }
      }

      // Case 3: Check for geometry property that might contain coordinates
      else if (marketArea.geometry) {
        // Try to extract center point from geometry
        const geo = marketArea.geometry;

        if (geo.x !== undefined && geo.y !== undefined) {
          // Web Mercator or similar coordinates
          return [{
            center: {
              x: geo.x,
              y: geo.y,
              spatialReference: geo.spatialReference
            },
            radii: [5], // Default 5-mile radius
            style: marketArea.style || null
          }];
        }
        else if (geo.longitude !== undefined && geo.latitude !== undefined) {
          // Geographic coordinates
          return [{
            center: {
              longitude: geo.longitude,
              latitude: geo.latitude,
              spatialReference: geo.spatialReference
            },
            radii: [5], // Default 5-mile radius
            style: marketArea.style || null
          }];
        }
        else if (geo.rings && geo.rings.length > 0) {
          // Polygon - we could calculate centroid here if needed
          console.warn('Polygon geometry found where radius expected:', marketArea.id);
          return null;
        }
      }

      // Case 4: Last resort - create a default radius in a reasonable location
      console.warn(`No valid radius data found for market area ${marketArea.id}, using default`);
      return [{
        center: {
          longitude: -117.8311, // Orange County location
          latitude: 33.7175
        },
        radii: [5], // Default 5-mile radius
        style: marketArea.style || null
      }];

    } catch (error) {
      console.error(`Error extracting radius info for market area ${marketArea.id}:`, error);
      return null;
    }
  }, []);

  const ensureValidGeometry = async (geometry, spatialReference) => {
    if (!geometry) {
        console.warn("Geometry is null or undefined");
        return null;
    }

    try {
        const { default: Point } = await import("@arcgis/core/geometry/Point");
        const { default: SpatialReference } = await import(
            "@arcgis/core/geometry/SpatialReference"
        );

        // Ensure spatialReference is a valid SpatialReference object
        const validSpatialReference =
            spatialReference instanceof SpatialReference
                ? spatialReference
                : new SpatialReference(spatialReference || { wkid: 4326 });

        // If geometry is a point-like object
        if (geometry.longitude !== undefined && geometry.latitude !== undefined) {
            return new Point({
                longitude: geometry.longitude,
                latitude: geometry.latitude,
                spatialReference: validSpatialReference,
            });
        }

        // If it's already a Point or other Geometry
        if (geometry.type || geometry.spatialReference) {
            // Ensure it has a valid spatial reference
            if (!geometry.spatialReference) {
                geometry.spatialReference = validSpatialReference;
            }
            return geometry;
        }

        console.warn("Unrecognized geometry format:", geometry);
        return null;
    } catch (error) {
        console.error("Error in ensureValidGeometry:", error);
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
        const { default: SimpleMarkerSymbol } = await import("@arcgis/core/symbols/SimpleMarkerSymbol");
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
          spatialReference: center.spatialReference || { wkid: 4326 }
        });

        // Create the point symbol
        const pointSymbol = new SimpleMarkerSymbol({
          color: new Color(pointStyle?.color || "#0078D4"),
          size: pointStyle?.size || 10,
          outline: {
            color: new Color(pointStyle?.outline?.color || "#ffffff"),
            width: pointStyle?.outline?.width || 1
          }
        });

        // Create the point graphic
        const pointGraphic = new Graphic({
          geometry: pointGeometry,
          symbol: pointSymbol,
          attributes: {
            FEATURE_TYPE: "drivetime_point",
            marketAreaId: marketAreaId,
            order: order,
            isTemporary: marketAreaId === "temporary" || marketAreaId === "temp"
          }
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
      const { default: FeatureSet } = await import("@arcgis/core/rest/support/FeatureSet");
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      const { default: ServiceAreaParameters } = await import("@arcgis/core/rest/support/ServiceAreaParameters");
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
        spatialReference: { wkid: 4326 }
      });

      console.log("Calculating drive time area for point:", {
        longitude: pointGeom.longitude,
        latitude: pointGeom.latitude,
        minutes: point.travelTimeMinutes
      });

      // Create point graphic for the feature set
      const pointGraphic = new Graphic({
        geometry: pointGeom
      });

      // Create a feature set with the point
      const featureSet = new FeatureSet({
        features: [pointGraphic]
      });

      // The service URL
      const serviceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World";

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
          name: "Driving Time"
        }
      });
      // Make the request with proper authentication
      const requestOptions = {
        query: {
          f: "json",
          token: apiKey
        }
      };

      // Call the service area with the correct module approach
      const result = await serviceAreaModule.solve(serviceUrl, params, requestOptions);

      // Extract the polygon from the result
      if (result?.serviceAreaPolygons?.features?.length > 0) {
        const polygon = result.serviceAreaPolygons.features[0].geometry;
        console.log("Successfully generated drive time polygon");
        return polygon;
      } else {
        console.warn("Service area response did not contain polygon data, using fallback");
        return createFallbackBuffer(pointGeom, point.travelTimeMinutes);
      }
    } catch (error) {
      console.error("Error calculating drive time polygon:", error);
      // Use fallback buffer
      const { default: Point } = await import("@arcgis/core/geometry/Point");
      const pointGeom = new Point({
        longitude: point.center.longitude,
        latitude: point.center.latitude,
        spatialReference: { wkid: 4326 }
      });
      return createFallbackBuffer(pointGeom, point.travelTimeMinutes);
    }
  }, []);

  // Improved drawDriveTimePolygon function with enhanced error handling and attribute consistency
  const drawDriveTimePolygon = useCallback(async (
    point,
    styleSettings = {
      fillColor: "#0078D4",
      fillOpacity: 0.35,
      borderColor: "#0078D4",
      borderWidth: 3
    },
    marketAreaId = "temporary",
    order = 0
  ) => {
    try {
      // Reference the graphics layer through the ref instead of directly
      if (!selectionGraphicsLayerRef.current) {
        console.error("[MapContext] Selection graphics layer not initialized");
        return;
      }

      // Validate input point
      if (!point || (!point.polygon && !point.center)) {
        console.error("[MapContext] Invalid drive time point:", point);
        return;
      }

      // Get or calculate the polygon
      let polygon = point.polygon || point.driveTimePolygon;

      // If no polygon exists, and we have a center, calculate one
      if (!polygon && point.center) {
        try {
          console.log("[MapContext] Calculating drive time polygon for point:", {
            longitude: point.center.longitude,
            latitude: point.center.latitude,
            minutes: point.travelTimeMinutes || point.timeRanges?.[0] || 15
          });
          polygon = await calculateDriveTimePolygon({
            center: point.center,
            travelTimeMinutes: point.travelTimeMinutes || point.timeRanges?.[0] || 15
          });
        } catch (calcError) {
          console.error("[MapContext] Error calculating drive time polygon:", calcError);
          return;
        }
      }

      if (!polygon) {
        console.error("[MapContext] No polygon found or calculated for drive time point");
        return;
      }

      // Import required modules
      const { default: Graphic } = await import("@arcgis/core/Graphic");
      const { default: Polygon } = await import("@arcgis/core/geometry/Polygon");
      const { default: SimpleFillSymbol } = await import("@arcgis/core/symbols/SimpleFillSymbol");
      const { default: SimpleLineSymbol } = await import("@arcgis/core/symbols/SimpleLineSymbol");

      // Enhanced debugging for styles
      console.log("[MapContext] Drawing drive time polygon with styles:", {
        fillColor: styleSettings.fillColor,
        fillOpacity: styleSettings.fillOpacity,
        borderColor: styleSettings.borderColor,
        borderWidth: styleSettings.borderWidth,
        isNoFill: styleSettings.fillOpacity === 0,
        isNoBorder: styleSettings.borderWidth === 0
      });

      // Create explicit fill and line symbols with the provided styles
      // For no fill, we need to use a special transparent color
      const fillSymbol = new SimpleFillSymbol({
        color: styleSettings.fillOpacity > 0
          ? [
            parseInt(styleSettings.fillColor.slice(1, 3), 16),
            parseInt(styleSettings.fillColor.slice(3, 5), 16),
            parseInt(styleSettings.fillColor.slice(5, 7), 16),
            styleSettings.fillOpacity
          ]
          : [0, 0, 0, 0], // Fully transparent when fillOpacity is 0
        outline: new SimpleLineSymbol({
          color: styleSettings.borderColor,
          width: styleSettings.borderWidth,
          style: styleSettings.borderWidth === 0 ? "none" : "solid" // Use "none" for no border
        })
      });

      // If we have a polygon object, make sure it's an ArcGIS Polygon
      if (!(polygon instanceof Polygon)) {
        if (polygon.rings || polygon.paths) {
          polygon = new Polygon({
            rings: polygon.rings || polygon.paths,
            spatialReference: polygon.spatialReference || { wkid: 4326 }
          });
        } else {
          console.error("[MapContext] Invalid polygon format:", polygon);
          return;
        }
      }

      // Before adding, remove any existing drive time graphics for this market area
      if (marketAreaId !== "temporary") {
        const existingGraphics = selectionGraphicsLayerRef.current.graphics.filter(g =>
          g.attributes?.marketAreaId === marketAreaId &&
          (g.attributes?.FEATURE_TYPE === "drivetime" ||
            g.attributes?.FEATURE_TYPE === "drivetime_point")
        );

        if (existingGraphics.length > 0) {
          console.log(`[MapContext] Removing ${existingGraphics.length} existing drive time graphics for ${marketAreaId}`);
          selectionGraphicsLayerRef.current.removeMany(existingGraphics);
        }
      }

      // Create and add the polygon graphic with all essential attributes
      const polygonGraphic = new Graphic({
        geometry: polygon,
        symbol: fillSymbol,
        attributes: {
          marketAreaId,
          order,
          FEATURE_TYPE: "drivetime",
          travelTimeMinutes: point.travelTimeMinutes || point.timeRanges?.[0] || 15,
          isTemporary: marketAreaId === "temporary" || marketAreaId === "temp"
        }
      });

      // Add the polygon to the map - use the ref for the graphics layer
      selectionGraphicsLayerRef.current.add(polygonGraphic);

      return polygon;
    } catch (error) {
      console.error("[MapContext] Error drawing drive time polygon:", error);
      throw error;
    }
  }, [selectionGraphicsLayerRef, calculateDriveTimePolygon]);

  // Helper function to create a fallback buffer
  const createFallbackBuffer = async (pointGeom, minutes) => {
    try {
      const { geodesicBuffer } = await import("@arcgis/core/geometry/geometryEngine");

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
        const { default: Polygon } = await import("@arcgis/core/geometry/Polygon");

        const lon = pointGeom.longitude;
        const lat = pointGeom.latitude;
        const offset = 0.01 * minutes / 10; // Simple scaling

        return new Polygon({
          rings: [
            [
              [lon - offset, lat - offset],
              [lon + offset, lat - offset],
              [lon + offset, lat + offset],
              [lon - offset, lat + offset],
              [lon - offset, lat - offset]
            ]
          ],
          spatialReference: { wkid: 4326 }
        });
      } catch (finalError) {
        console.error("All fallbacks failed");
        throw new Error("Unable to create drive time area");
      }
    }
  };

  const zoomToExtent = useCallback(async (extent) => {
    if (!mapView) {
        console.log("[MapContext] Cannot zoom to extent: mapView not initialized");
        return;
    }

    try {
        await mapView.goTo(extent, {
            duration: 1000,
            easing: "ease-in-out"
        });
        console.log("[MapContext] Successfully zoomed to extent");
    } catch (error) {
        console.error("[MapContext] Error zooming to extent:", error);
    }
}, [mapView]);

const zoomToMarketArea = useCallback(async (marketAreaId) => {
    if (!mapView || !selectionGraphicsLayerRef.current) {
        console.log("[MapContext] Cannot zoom to market area: prerequisites not met");
        return;
    }

    try {
        // Find all graphics associated with this market area
        const marketAreaGraphics = selectionGraphicsLayerRef.current.graphics.filter(
            graphic => graphic.attributes?.marketAreaId === marketAreaId
        );

        if (marketAreaGraphics.length === 0) {
            console.log(`[MapContext] No graphics found for market area: ${marketAreaId}`);
            return;
        }

        // Create a union of all geometries or get first geometry's extent
        let targetExtent;

        if (marketAreaGraphics.length === 1) {
            targetExtent = marketAreaGraphics[0].geometry.extent;
        } else {
            const geometries = marketAreaGraphics.map(g => g.geometry).filter(Boolean);

            if (geometries.length > 0) {
                try {
                    // Try to get a union of all geometries
                    const union = await geometryEngineAsync.union(geometries);
                    targetExtent = union.extent;
                } catch (error) {
                    console.warn("[MapContext] Failed to union geometries, using first geometry extent", error);
                    targetExtent = geometries[0].extent;
                }
            }
        }

        if (targetExtent) {
            // Add a buffer to the extent for better visibility
            targetExtent.expand(1.2);

            await mapView.goTo(targetExtent, {
                duration: 1000,
                easing: "ease-in-out"
            });
            console.log(`[MapContext] Successfully zoomed to market area: ${marketAreaId}`);
        }
    } catch (error) {
        console.error("[MapContext] Error zooming to market area:", error);
    }
}, [mapView]);

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
      if (!selectionGraphicsLayerRef.current || !point || !mapView) {
        console.warn("Cannot draw radius: Missing graphics layer, point data, or map view");
        return;
      }

      // Validate point structure
      if (!point.center) {
        console.warn("Invalid point structure - missing center:", point);
        return;
      }

      if (!point.radii || !Array.isArray(point.radii) || point.radii.length === 0) {
        console.warn("Invalid point structure - missing or empty radii array:", point);
        return;
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

        // Extract coordinates consistently
        let centerLon, centerLat;

        // Handle longitude/latitude properties
        if (point.center.longitude !== undefined && point.center.latitude !== undefined) {
          centerLon = point.center.longitude;
          centerLat = point.center.latitude;
        }
        // Handle x/y properties
        else if (point.center.x !== undefined && point.center.y !== undefined) {
          centerLon = point.center.x;
          centerLat = point.center.y;
        }
        // If we have a plain array, assume it's [lon, lat]
        else if (Array.isArray(point.center) && point.center.length >= 2) {
          centerLon = point.center[0];
          centerLat = point.center[1];
        }
        else {
          console.error("Could not extract valid coordinates from point:", point.center);
          return;
        }

        console.log('DrawRadius using coordinates:', {
          longitude: centerLon,
          latitude: centerLat,
          spatialReference: point.center.spatialReference?.wkid || "default"
        });

        // Create the center point properly
        const centerPoint = new Point({
          longitude: centerLon,
          latitude: centerLat,
          spatialReference: point.center.spatialReference || mapView.spatialReference,
        });

        // Convert to geographic for geodesic buffer if needed
        let geographicPoint = centerPoint;

        // Check if we need to convert from Web Mercator to geographic
        const isWebMercator =
          centerPoint.spatialReference &&
          (centerPoint.spatialReference.wkid === 102100 ||
            centerPoint.spatialReference.wkid === 3857 ||
            centerPoint.spatialReference.latestWkid === 3857);

        if (isWebMercator) {
          try {
            geographicPoint = webMercatorToGeographic(centerPoint);
            console.log('Converted to geographic:', {
              longitude: geographicPoint.longitude,
              latitude: geographicPoint.latitude
            });
          } catch (error) {
            console.warn("Failed to convert to geographic coordinates:", error);
            // Continue with original point if conversion fails
          }
        }

        // Check if we already have radius graphics for this market area/center point
        if (marketAreaId) {
          const existingRadiusGraphics = selectionGraphicsLayerRef.current.graphics.filter(
            (g) => g.attributes?.marketAreaId === marketAreaId &&
              g.attributes?.FEATURE_TYPE === "radius"
          );

          if (existingRadiusGraphics.length > 0) {
            // Check if the center point is reasonably close to an existing one
            // Be more careful about accessing geometry properties
            let shouldSkip = false;

            try {
              const firstGraphic = existingRadiusGraphics[0];
              if (firstGraphic && firstGraphic.geometry && firstGraphic.geometry.centroid) {
                const existingCenter = firstGraphic.geometry.centroid;

                if (existingCenter &&
                  existingCenter.longitude !== undefined &&
                  existingCenter.latitude !== undefined) {

                  const distance = Math.sqrt(
                    Math.pow(existingCenter.longitude - geographicPoint.longitude, 2) +
                    Math.pow(existingCenter.latitude - geographicPoint.latitude, 2)
                  );

                  // If very close to existing point, skip drawing - likely a duplicate
                  if (distance < 0.001) { // about 100m
                    console.log(`[MapContext] Skipping radius draw - duplicate center point for ${marketAreaId}`);
                    shouldSkip = true;
                  }
                }
              }
            } catch (err) {
              console.warn(`[MapContext] Error comparing center points:`, err);
              // Continue with drawing even if comparison fails
            }

            if (shouldSkip) {
              return;
            }

            console.log(`[MapContext] Removing ${existingRadiusGraphics.length} existing radius graphics`);
            selectionGraphicsLayerRef.current.removeMany(existingRadiusGraphics);
          }
        }

        // Use provided style or fallback
        const fillRgb = style?.fillColor ? hexToRgb(style.fillColor) : [0, 120, 212];
        const outlineRgb = style?.borderColor ? hexToRgb(style.borderColor) : [0, 120, 212];
        const fillOpacity = style?.fillOpacity !== undefined ? style.fillOpacity : 0.35;
        const borderWidth = style?.borderWidth !== undefined ? style.borderWidth : 2;

        // Generate circles for each radius
        for (let i = 0; i < point.radii.length; i++) {
          const radiusMiles = point.radii[i];
          const radiusMeters = radiusMiles * 1609.34;

          // Create a geodesic buffer (accurate circle on the Earth's surface)
          const polygon = geodesicBuffer(
            geographicPoint,
            radiusMeters,
            "meters"
          );

          // Skip if buffer creation failed
          if (!polygon) {
            console.warn(`Failed to create buffer for radius ${radiusMiles} miles`);
            continue;
          }

          // Create unique ID for this radius circle
          const circleId = `${marketAreaId || "temp"}-radius-${i}`;

          const symbol = {
            type: "simple-fill",
            color: [...fillRgb, fillOpacity],
            outline: {
              color: outlineRgb,
              width: borderWidth,
            },
          };

          const graphic = new Graphic({
            geometry: polygon,
            symbol: symbol,
            attributes: {
              FEATURE_TYPE: "radius",
              marketAreaId: marketAreaId || "temp",
              radiusMiles,
              order,
              circleId,
              centerLon,
              centerLat
            },
          });

          selectionGraphicsLayerRef.current.add(graphic);
        }

        // Log successful drawing
        console.log(`Drew radius rings for market area ${marketAreaId || "temp"}:`, {
          center: [geographicPoint.longitude, geographicPoint.latitude],
          radii: point.radii,
          style,
        });
      } catch (error) {
        console.error("Error in drawRadius:", error);
      }
    },
    [mapView, hexToRgb, selectionGraphicsLayerRef]
  );

  const displayFeatures = useCallback(async (featuresToDraw) => {
    if (!mapView || !selectionGraphicsLayerRef.current || !layersReady) {
      console.log("[MapContext] Cannot display features - prerequisites not met", {
        hasMapView: !!mapView,
        hasGraphicsLayer: !!selectionGraphicsLayerRef.current,
        layersReady
      });
      return;
    }

    try {
      console.log(
        `[MapContext] Displaying ${featuresToDraw.length} features`
      );

      // Check for any radius-type features
      const radiusFeatures = featuresToDraw.filter(
        feature => feature.attributes?.FEATURE_TYPE === 'radius' ||
          feature.attributes?.ma_type === 'radius' ||
          feature.attributes?.type === 'radius'
      );

      // Handle regular polygon features
      const polygonFeatures = featuresToDraw.filter(
        feature => feature.attributes?.FEATURE_TYPE !== 'radius' &&
          feature.attributes?.ma_type !== 'radius' &&
          feature.attributes?.type !== 'radius'
      );

      // Preserve market area graphics that aren't being updated
      const existingMarketAreaGraphics =
        selectionGraphicsLayerRef.current.graphics.filter(
          (graphic) => {
            // Keep if it's a market area graphic but not one we're currently updating
            const graphicId = graphic.attributes?.marketAreaId;
            return graphicId && !featuresToDraw.some(f => f.attributes?.marketAreaId === graphicId);
          }
        );

      // Get existing selection graphics that aren't being toggled
      const existingSelectionGraphics =
        selectionGraphicsLayerRef.current.graphics.filter(
          (graphic) =>
            !graphic.attributes?.marketAreaId &&
            !featuresToDraw.some(
              (f) => f.attributes.FID === graphic.attributes.FID ||
                f.attributes.OBJECTID === graphic.attributes.OBJECTID
            )
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

      // Import needed modules
      const { default: Graphic } = await import("@arcgis/core/Graphic");

      // Process polygon features
      for (const feat of polygonFeatures) {
        // Make sure geometry is valid & define your symbol
        const geometry = await ensureValidGeometry(
          feat.geometry,
          mapView.spatialReference
        );
        if (!geometry) continue;

        const symbol = SYMBOLS.selectedPolygon; // or pick based on geometry.type
        const graphic = new Graphic({
          geometry,
          attributes: feat.attributes,
          symbol,
        });
        selectionGraphicsLayerRef.current.add(graphic);
      }

      // Process radius features
      for (const radiusFeature of radiusFeatures) {
        // Extract needed properties from the feature
        const { center, radii, marketAreaId, style } = extractRadiusProperties(radiusFeature);

        if (center && radii) {
          await drawRadius(
            { center, radii },
            style,
            marketAreaId || radiusFeature.attributes?.marketAreaId,
            radiusFeature.attributes?.order || 0
          );
        } else {
          console.warn("[MapContext] Invalid radius feature, missing center or radii", radiusFeature);
        }
      }
    } catch (err) {
      console.error("[MapContext] Error displaying features:", err);
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
          visible: true
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

  const addActiveLayer = useCallback(
    async (type) => {
      if (type === "radius") {
        // "radius" is not a server-based layer
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

        // Create the layer if not already present
        if (!layer) {
          layer = await initializeFeatureLayer(type);
          if (layer) {
            await mapView.map.add(layer);
            featureLayersRef.current[type] = layer;
            console.log(
              `[MapContext] New FeatureLayer for type ${type} added.`
            );
          }
        }

        if (layer && !layer.destroyed) {
          try {
            await layer.when();
            layer.visible = true;
            console.log(`[MapContext] FeatureLayer ${type} set to visible.`);
          } catch (err) {
            console.error(
              `[MapContext] Error making layer ${type} visible:`,
              err
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
              `${validAttributes.STATE_FIPS || "06"}${validAttributes.COUNTY_FIPS || validAttributes.COUNTY || ""
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

  const clearMarketAreaGraphics = useCallback((marketAreaId) => {
    console.log("[MapContext] Clear graphics called:", { marketAreaId });

    if (!selectionGraphicsLayerRef.current) {
      console.log("[MapContext] No graphics layer available");
      return;
    }

    try {
      // Get all graphics from the layer
      const allGraphics = selectionGraphicsLayerRef.current.graphics.toArray();

      // If no marketAreaId, clear all market area graphics
      let graphicsToRemove;

      if (!marketAreaId) {
        // When no specific ID is provided, remove all market area graphics
        console.log("[MapContext] Clearing ALL market area graphics");
        graphicsToRemove = allGraphics.filter(graphic =>
          graphic.attributes?.marketAreaId ||
          graphic.attributes?.FEATURE_TYPE === 'radius' ||
          graphic.attributes?.FEATURE_TYPE === 'drivetime' ||
          graphic.attributes?.FEATURE_TYPE === 'drivetime_point'
        );
      } else {
        // Enhanced filtering to ensure we catch all graphics related to this market area
        graphicsToRemove = allGraphics.filter(graphic => {
          // Match on marketAreaId and feature types
          return (
            // Direct match on marketAreaId
            (graphic.attributes?.marketAreaId === marketAreaId) ||

            // Match radius circle IDs that start with this market area ID
            (graphic.attributes?.circleId &&
              graphic.attributes.circleId.startsWith(`${marketAreaId}-`)) ||

            // Match any drivetime feature with this market area ID
            (graphic.attributes?.FEATURE_TYPE === 'drivetime' &&
              graphic.attributes?.marketAreaId === marketAreaId) ||

            // Match any drivetime_point feature with this market area ID
            (graphic.attributes?.FEATURE_TYPE === 'drivetime_point' &&
              graphic.attributes?.marketAreaId === marketAreaId) ||

            // Additional matching to catch any edge cases for this market area
            ((graphic.attributes?.order !== undefined) &&
              (graphic.attributes?.id && String(graphic.attributes.id).includes(marketAreaId)))
          );
        });
      }

      if (graphicsToRemove.length > 0) {
        console.log(`[MapContext] Removing ${graphicsToRemove.length} graphics for market area ${marketAreaId || 'ALL'}:`, {
          details: graphicsToRemove.map(g => ({
            marketAreaId: g.attributes?.marketAreaId,
            featureType: g.attributes?.FEATURE_TYPE,
            circleId: g.attributes?.circleId
          }))
        });

        // Remove them all at once
        selectionGraphicsLayerRef.current.removeMany(graphicsToRemove);
      } else {
        console.log(`[MapContext] No graphics found for market area: ${marketAreaId || 'ALL'}`);
      }

      return true;
    } catch (error) {
      console.error("[MapContext] Error clearing graphics:", error);
      return false;
    }
  }, [selectionGraphicsLayerRef]);

  const transformRadiusPoint = useMemo(() => (point, marketAreaId) => {
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
          spatialReference: point.center.spatialReference || { wkid: 102100 }
        },
        radii: Array.isArray(point.radii)
          ? point.radii.map(Number).filter(r => !isNaN(r) && r > 0)
          : [Number(point.radius || 10)],
        units: point.units || "miles"
      };
    } catch (error) {
      console.error("Error transforming radius point:", error);
      return null;
    }
  }, []);

  // Enhanced transformDriveTimePoint function to better handle various data formats
  const transformDriveTimePoint = useMemo(() => (point, marketAreaId) => {
    try {
      // Handle the case where point itself could be null/undefined
      if (!point) {
        console.error("Drive time point is null or undefined");
        return null;
      }

      // Try to parse if it's a string (JSON)
      if (typeof point === 'string') {
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
        if (typeof point.center === 'string') {
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
      else if (point.longitude !== undefined && point.latitude !== undefined) {
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
      const timeRanges =
        (Array.isArray(point.timeRanges)
          ? point.timeRanges
          : Array.isArray(point.radii)
            ? point.radii
            : [point.travelTimeMinutes || point.timeRange || point.minutes || 15])
          .map(Number)
          .filter(t => !isNaN(t) && t > 0);

      // Check if we have a valid polygon already
      let polygon = point.polygon || point.driveTimePolygon || null;

      // Create the standardized format
      return {
        center: {
          longitude: centerLon,
          latitude: centerLat,
          spatialReference: (point.center && point.center.spatialReference) || { wkid: 4326 }
        },
        travelTimeMinutes: timeRanges[0], // Use first value as primary time
        timeRanges: timeRanges,
        units: point.units || "minutes",
        polygon: polygon,
        marketAreaId: marketAreaId
      };
    } catch (error) {
      console.error("Error transforming drive time point:", error, point);
      return null;
    }
  }, []);

  // Use this function in your useEffect to handle drive time points more robustly
  const processDriveTimePoints = useCallback(async (marketArea) => {
    if (!marketArea || marketArea.ma_type !== 'drivetime') {
      return false;
    }

    try {
      console.log(`[MapContext] Processing drive time market area: ${marketArea.id}`);

      // Handle different formats of drive_time_points
      let driveTimePoints;

      try {
        if (typeof marketArea.drive_time_points === 'string') {
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
        console.log(`[MapContext] No drive_time_points in market area, checking alternatives`);

        // Check ma_geometry_data
        if (marketArea.ma_geometry_data) {
          try {
            const geoData = typeof marketArea.ma_geometry_data === 'string'
              ? JSON.parse(marketArea.ma_geometry_data)
              : marketArea.ma_geometry_data;

            if (geoData.center || geoData.point) {
              driveTimePoints = [{
                center: geoData.center || geoData.point,
                timeRanges: geoData.timeRanges || [geoData.travelTimeMinutes || 15],
                polygon: geoData.polygon
              }];
              console.log(`[MapContext] Extracted drive time point from ma_geometry_data`);
            }
          } catch (err) {
            console.warn(`[MapContext] Failed to extract drive time point from ma_geometry_data:`, err);
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
              let sumX = 0, sumY = 0;

              for (const point of points) {
                sumX += point[0];
                sumY += point[1];
              }

              const centerX = sumX / points.length;
              const centerY = sumY / points.length;

              driveTimePoints = [{
                center: {
                  longitude: centerX,
                  latitude: centerY,
                  spatialReference: geo.spatialReference
                },
                timeRanges: [15], // Default 15 minute drivetime
                polygon: geo
              }];
              console.log(`[MapContext] Created drive time point from geometry centroid`);
            }
          } catch (err) {
            console.warn(`[MapContext] Failed to create drive time point from geometry:`, err);
          }
        }
      }

      // Ensure we have at least an empty array
      if (!driveTimePoints) {
        console.warn(`[MapContext] No drive time points found for market area ${marketArea.id}`);
        return false;
      }

      // Make sure driveTimePoints is an array
      driveTimePoints = Array.isArray(driveTimePoints) ? driveTimePoints : [driveTimePoints];

      // Process each point
      let pointsDrawn = 0;
      for (const point of driveTimePoints) {
        if (!point) continue;

        const transformedPoint = transformDriveTimePoint(point, marketArea.id);

        if (transformedPoint) {
          await drawDriveTimePolygon(
            transformedPoint,
            {
              fillColor: marketArea.style_settings?.fillColor || "#0078D4",
              fillOpacity: marketArea.style_settings?.noFill ? 0 : (marketArea.style_settings?.fillOpacity || 0.35),
              borderColor: marketArea.style_settings?.borderColor || "#0078D4",
              borderWidth: marketArea.style_settings?.noBorder ? 0 : (marketArea.style_settings?.borderWidth || 3)
            },
            marketArea.id,
            marketArea.order || 0
          );
          pointsDrawn++;
        }
      }

      console.log(`[MapContext] Drew ${pointsDrawn} drive time points for market area ${marketArea.id}`);
      return pointsDrawn > 0;
    } catch (error) {
      console.error(`[MapContext] Error processing drive time market area ${marketArea.id}:`, error);
      return false;
    }
  }, [transformDriveTimePoint, drawDriveTimePolygon]);

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType, immediate = false) => {
      // Prevent multiple simultaneous calls
      if (updateFeatureStyles.isProcessing) {
        console.log("[MapContext] Update already in progress, skipping");
        return;
      }
  
      if (!selectionGraphicsLayerRef.current || !mapView) {
        console.log("[MapContext] Cannot update styles: missing graphics layer or map view");
        return;
      }
  
      // Set processing flag
      updateFeatureStyles.isProcessing = true;
  
      try {
        const [
          { default: Graphic },
          { default: Polygon },
          { union, simplify, planarArea, planarLength },
          { default: Query }
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/Polygon"),
          import("@arcgis/core/geometry/geometryEngine"),
          import("@arcgis/core/rest/support/Query")
        ]);
  
        // Group features by their marketAreaId
        const featuresByMarketArea = {};
        features.forEach((feature) => {
          const id = feature.attributes.marketAreaId;
          if (!featuresByMarketArea[id]) featuresByMarketArea[id] = [];
          featuresByMarketArea[id].push(feature);
        });
  
        // Check if these features are already displayed with the same styles
        const existingGraphics = selectionGraphicsLayerRef.current.graphics.filter(g =>
          g.attributes?.marketAreaId === Object.keys(featuresByMarketArea)[0] &&
          g.attributes?.FEATURE_TYPE === featureType
        );
  
        if (existingGraphics.length > 0) {
          const graphicsItems = existingGraphics.items || existingGraphics;
  
          if (graphicsItems && graphicsItems.length > 0) {
            const firstGraphic = graphicsItems[0];
  
            const symbolJSON = firstGraphic.symbol?.toJSON ? firstGraphic.symbol.toJSON() : null;
  
            let currentFill = symbolJSON?.color || [0, 0, 0, 0];
            let currentOutline = symbolJSON?.outline?.color ?
              {
                color: symbolJSON.outline.color,
                width: symbolJSON.outline.width || 0
              } :
              { color: [0, 0, 0, 0], width: 0 };
  
            const stylesMatch =
              currentFill[0] === styles.fill[0] &&
              currentFill[1] === styles.fill[1] &&
              currentFill[2] === styles.fill[2] &&
              (currentFill[3] || 0) === styles.fillOpacity &&
              currentOutline.color[0] === styles.outline[0] &&
              currentOutline.color[1] === styles.outline[1] &&
              currentOutline.color[2] === styles.outline[2] &&
              currentOutline.width === styles.outlineWidth;
  
            if (stylesMatch && !immediate) {
              console.log("[MapContext] Features already displayed with same styles, skipping update");
              return;
            }
          }
        }
  
        // Handle existing graphics with more precision
        const marketAreaIds = new Set(Object.keys(featuresByMarketArea));
        let remainingGraphics = immediate
          ? selectionGraphicsLayerRef.current.graphics.filter(g =>
            !marketAreaIds.has(g.attributes?.marketAreaId) &&
            g.attributes?.FEATURE_TYPE !== featureType)
          : selectionGraphicsLayerRef.current.graphics.filter(g =>
            !marketAreaIds.has(g.attributes?.marketAreaId));
  
        // Clear and restore in one batch
        selectionGraphicsLayerRef.current.removeAll();
        if (remainingGraphics.length > 0) {
          selectionGraphicsLayerRef.current.addMany(remainingGraphics);
        }
  
        const newGraphics = [];
  
        // Process each market area's features
        for (const [marketAreaId, maFeatures] of Object.entries(featuresByMarketArea)) {
          console.log('[MapContext] Processing features:', {
            marketAreaId,
            featureCount: maFeatures.length,
            featureGeometries: maFeatures.map(f => ({
              hasGeometry: !!f.geometry,
              type: f.geometry?.type,
              rings: f.geometry?.rings?.length,
              coordinates: f.geometry?.coordinates?.length
            }))
          });
  
          // Get high resolution features for any layer type
          let highResPolygons = [];
  
          try {
            const layer = featureLayersRef.current[featureType];
            if (layer) {
              console.log(`[MapContext] Found layer for type ${featureType}:`, {
                title: layer.title,
                hasFeatureLayers: !!layer.featureLayers,
                layerCount: layer.featureLayers?.length || 1
              });
  
              // Handle both single and group layers
              const layersToQuery = layer.featureLayers || [layer];
  
              for (const queryLayer of layersToQuery) {
                // Modified query construction to handle ZIP codes more robustly
                const queryClauses = maFeatures.map(f => {
                  // Specifically handle ZIP code layers
                  if (featureType === 'zip') {
                    // If we have a ZIP attribute, use that
                    if (f.attributes.ZCTA5) {
                      return `ZIP = '${f.attributes.ZCTA5}'`;
                    }
                    // If we have a name attribute that looks like a ZIP code, use that
                    if (f.attributes.name && /^\d{5}(-\d{4})?$/.test(f.attributes.name)) {
                      return `ZIP = '${f.attributes.name}'`;
                    }
                    // If we have an id attribute that looks like a ZIP code, use that
                    if (f.attributes.id && /^\d{5}(-\d{4})?$/.test(f.attributes.id)) {
                      return `ZIP = '${f.attributes.id}'`;
                    }
                    // No valid ZIP identifier found
                    console.warn("[MapContext] ZIP feature missing ZIP attribute:", f.attributes);
                    return '';
                  }
                  
                  // For other layer types, use OBJECTID or FID if available
                  const idField = queryLayer.objectIdField || 'OBJECTID';
                  const idValue = f.attributes[idField] || f.attributes.FID;
                  return idValue ? `${idField} = ${idValue}` : '';
                }).filter(clause => clause !== ''); // Remove empty clauses
                
                // Skip query if no valid clauses were created
                if (queryClauses.length === 0) {
                  console.warn(`[MapContext] No valid query clauses for ${featureType} layer`);
                  continue;
                }
                
                const query = new Query({
                  where: queryClauses.join(' OR '),
                  returnGeometry: true,
                  outSpatialReference: mapView.spatialReference,
                  maxAllowableOffset: 0,  // Force highest resolution
                  geometryPrecision: 8,
                  resultType: "standard",
                  multipatchOption: "xyFootprint"
                });
              
                try {
                  console.log(`[MapContext] Querying layer with:`, {
                    where: query.where,
                    outSpatialReference: query.outSpatialReference.wkid
                  });
                  const result = await queryLayer.queryFeatures(query);
                  console.log(`[MapContext] Query result:`, {
                    hasFeatures: !!result?.features,
                    featureCount: result?.features?.length || 0
                  });
                  if (result?.features) {
                    const polygons = result.features.map(feature => {
                      if (!feature.geometry?.rings) return null;
                      return new Polygon({
                        rings: feature.geometry.rings,
                        spatialReference: mapView.spatialReference,
                        type: "polygon"
                      });
                    }).filter(Boolean);
                    highResPolygons.push(...polygons);
                  }
                } catch (queryError) {
                  console.warn(`Error querying layer for high-res features:`, queryError);
                }
              }
            }
          } catch (error) {
            console.warn('Error fetching high-res features:', error);
          }
  
          // Fall back to original geometries if high-res query failed
          if (highResPolygons.length === 0) {
            console.log('[MapContext] Falling back to original geometries');
            highResPolygons = maFeatures
              .map((feature) => {
                if (!feature.geometry) {
                  console.warn('Feature missing geometry:', feature);
                  return null;
                }
  
                const geomConfig = {
                  spatialReference: mapView.spatialReference,
                  type: "polygon",
                };
  
                try {
                  if (feature.geometry.rings) {
                    return new Polygon({
                      ...geomConfig,
                      rings: feature.geometry.rings,
                    });
                  } else if (feature.geometry.type === "polygon") {
                    return new Polygon({
                      ...geomConfig,
                      rings: feature.geometry.rings || feature.geometry.coordinates,
                    });
                  }
                } catch (error) {
                  console.error('Error creating polygon:', error);
                  return null;
                }
                return null;
              })
              .filter(Boolean);
          }
  
          if (highResPolygons.length === 0) {
            console.warn(`No valid polygons for market area ${marketAreaId}`);
            continue;
          }
  
          try {
            // Create unified boundary
            const unifiedGeometry = union(highResPolygons);
            if (!unifiedGeometry) {
              console.warn(`Union failed for market area ${marketAreaId}`);
              continue;
            }
  
            const simplifiedGeometry = simplify(unifiedGeometry);
            const totalArea = Math.abs(planarArea(simplifiedGeometry));
            const minHoleArea = totalArea * 0.001;
  
            // Extract and filter rings
            const rings = simplifiedGeometry.rings;
            const { exteriorRings, holeRings } = rings.reduce(
              (acc, ring) => {
                const ringPolygon = new Polygon({
                  rings: [ring],
                  spatialReference: mapView.spatialReference,
                  type: "polygon",
                });
  
                const area = planarArea(ringPolygon);
                const perimeter = planarLength(ringPolygon);
  
                if (area > 0) {
                  acc.exteriorRings.push(ring);
                } else if (Math.abs(area) > minHoleArea && perimeter > 100) {
                  acc.holeRings.push(ring);
                }
                return acc;
              },
              { exteriorRings: [], holeRings: [] }
            );
  
            // Create fill graphic with exact specified styles
            const fillSymbol = {
              type: "simple-fill",
              color: [...hexToRgb(styles.fill), styles.fillOpacity],
              outline: {
                color: [0, 0, 0, 0],
                width: 0,
              },
            };
  
            const fillGeometry = new Polygon({
              rings: [...exteriorRings, ...holeRings],
              spatialReference: mapView.spatialReference,
              type: "polygon",
            });
  
            newGraphics.push(
              new Graphic({
                geometry: fillGeometry,
                symbol: fillSymbol,
                attributes: {
                  marketAreaId,
                  FEATURE_TYPE: featureType,
                  isUnified: true,
                  ...maFeatures[0].attributes,
                },
              })
            );
  
            // Create outline graphics
            const outlineSymbol = {
              type: "simple-fill",
              color: [0, 0, 0, 0],
              outline: {
                color: styles.outline,
                width: styles.outlineWidth,
              },
            };
  
            // Add hole outlines
            holeRings.forEach((holeRing, index) => {
              const holeGeometry = new Polygon({
                rings: [holeRing],
                spatialReference: mapView.spatialReference,
                type: "polygon",
              });
  
              newGraphics.push(
                new Graphic({
                  geometry: holeGeometry,
                  symbol: outlineSymbol,
                  attributes: {
                    marketAreaId,
                    FEATURE_TYPE: featureType,
                    isUnified: true,
                    isOutline: true,
                    isHole: true,
                    holeIndex: index,
                    ...maFeatures[0].attributes,
                  },
                })
              );
            });
  
            // Add exterior outline
            const exteriorGeometry = new Polygon({
              rings: exteriorRings,
              spatialReference: mapView.spatialReference,
              type: "polygon",
            });
  
            newGraphics.push(
              new Graphic({
                geometry: exteriorGeometry,
                symbol: outlineSymbol,
                attributes: {
                  marketAreaId,
                  FEATURE_TYPE: featureType,
                  isUnified: true,
                  isOutline: true,
                  isExterior: true,
                  ...maFeatures[0].attributes,
                },
              })
            );
          } catch (error) {
            console.error(`Error processing market area ${marketAreaId}:`, error);
            continue;
          }
        }
        // Add all new graphics in one batch
        if (newGraphics.length > 0) {
          selectionGraphicsLayerRef.current.addMany(newGraphics);
        }
      } catch (error) {
        console.error('Error updating feature styles:', error);
      } finally {
        // Ensure processing flag is always reset
        updateFeatureStyles.isProcessing = false;
      }
    },
    [mapView, hexToRgb, featureLayersRef]
  );


  // Add this function to MapContext.jsx
  const extractDriveTimeInfo = useCallback((marketArea) => {
    if (!marketArea || marketArea.ma_type !== 'drivetime') return null;

    try {
      // Case 1: Direct drive_time_points property
      if (marketArea.drive_time_points) {
        let driveTimePoints;

        // Parse if it's a string
        if (typeof marketArea.drive_time_points === 'string') {
          try {
            driveTimePoints = JSON.parse(marketArea.drive_time_points);
          } catch (e) {
            console.warn(`Failed to parse drive_time_points for market area ${marketArea.id}:`, e);
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
        return driveTimePoints.map(point => {
          if (!point) return null;

          // Create a normalized point structure
          const normalizedPoint = {
            center: point.center || point.point || null,
            travelTimeMinutes: point.travelTimeMinutes ||
              (Array.isArray(point.timeRanges) ? point.timeRanges[0] : point.timeRange) || 15,
            polygon: point.polygon || point.driveTimePolygon || null,
            style: point.style || marketArea.style || null
          };

          // Skip invalid points
          if (!normalizedPoint.center) {
            console.warn(`Invalid drive time point in market area ${marketArea.id}: missing center`);
            return null;
          }

          return normalizedPoint;
        }).filter(Boolean); // Remove any null entries
      }

      // Case 2: Check for polygon in geometry
      else if (marketArea.geometry && marketArea.geometry.rings) {
        // Extract centroid from first ring as a fallback
        try {
          const ring = marketArea.geometry.rings[0];
          let sumX = 0, sumY = 0;

          for (const point of ring) {
            sumX += point[0];
            sumY += point[1];
          }

          const centerX = sumX / ring.length;
          const centerY = sumY / ring.length;

          return [{
            center: {
              longitude: centerX,
              latitude: centerY,
              spatialReference: marketArea.geometry.spatialReference
            },
            travelTimeMinutes: 15, // Default 15-minute drivetime
            polygon: marketArea.geometry
          }];
        } catch (error) {
          console.warn(`Failed to create drive time point from geometry for ${marketArea.id}:`, error);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error extracting drive time info for market area ${marketArea.id}:`, error);
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
        if (marketArea.ma_type === 'radius' && marketArea.radius_points) {
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
        }
        else if (marketArea.ma_type === 'drivetime' && marketArea.drive_time_points) {
          const points = Array.isArray(marketArea.drive_time_points)
            ? marketArea.drive_time_points
            : [marketArea.drive_time_points];

          for (const point of points) {
            const transformedPoint = transformDriveTimePoint(point, marketAreaId);
            if (transformedPoint) {
              await drawDriveTimePolygon(
                transformedPoint,
                marketArea.style_settings,
                marketAreaId,
                marketArea.order
              );
            }
          }
        }
        else if (marketArea.locations) {
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
      updateFeatureStyles,
      transformRadiusPoint,
      transformDriveTimePoint,
    ]
  );


  const createPipeLayer = (config) => {
    console.log("Placeholder: Creating Pipe Layer GraphicsLayer", config);
    return new GraphicsLayer({
      title: config?.title || "Pipe Map Layer",
      listMode: "show", // Or hide, depending on desired behavior
      graphics: [] // Start empty
    });
  };
  
  const createCompLayer = (config) => {
    console.log("Placeholder: Creating Comp Layer GraphicsLayer", config);
    return new GraphicsLayer({
      title: config?.title || "Comparison Map Layer",
      listMode: "show",
      graphics: []
    });
  };

  const extractRadiusProperties = (feature) => {
    // Attempt to extract radius info from various feature formats
    try {
      // Check if it's already in the expected format with center and radii
      if (feature.center && Array.isArray(feature.radii)) {
        return {
          center: feature.center,
          radii: feature.radii,
          marketAreaId: feature.attributes?.marketAreaId || feature.marketAreaId,
          style: feature.style
        };
      }

      // Check if this is a feature with geometry and radius_points
      if (feature.attributes?.radius_points) {
        let radiusPoints;
        try {
          // Try parsing if it's a string
          radiusPoints = typeof feature.attributes.radius_points === 'string'
            ? JSON.parse(feature.attributes.radius_points)
            : feature.attributes.radius_points;
        } catch (e) {
          console.warn("Failed to parse radius_points:", e);
          radiusPoints = feature.attributes.radius_points;
        }

        // Handle single radius point or array
        const points = Array.isArray(radiusPoints) ? radiusPoints : [radiusPoints];

        if (points.length > 0) {
          const firstPoint = points[0];
          return {
            center: firstPoint.center || firstPoint.point || firstPoint,
            radii: firstPoint.radii || [firstPoint.radius || 5], // Default 5 mile radius if not specified
            marketAreaId: feature.attributes?.marketAreaId || feature.attributes?.id,
            style: firstPoint.style || feature.attributes?.style
          };
        }
      }

      // Check for ma_geometry_data
      if (feature.attributes?.ma_geometry_data) {
        let geoData;
        try {
          geoData = typeof feature.attributes.ma_geometry_data === 'string'
            ? JSON.parse(feature.attributes.ma_geometry_data)
            : feature.attributes.ma_geometry_data;

          if (geoData.center || geoData.point) {
            return {
              center: geoData.center || geoData.point,
              radii: Array.isArray(geoData.radii) ? geoData.radii : [geoData.radius || 5],
              marketAreaId: feature.attributes?.marketAreaId || feature.attributes?.id,
              style: geoData.style
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
            radii: Array.isArray(possibleRadii) ? possibleRadii : [possibleRadii || 5],
            marketAreaId: attrs.marketAreaId || attrs.id,
            style: attrs.style
          };
        }
      }

      // If we have a geometry field with x/y or lat/long, try using that
      if (feature.geometry) {
        if (feature.geometry.x !== undefined && feature.geometry.y !== undefined) {
          return {
            center: {
              x: feature.geometry.x,
              y: feature.geometry.y,
              spatialReference: feature.geometry.spatialReference
            },
            radii: [5], // Default radius of 5 miles if none specified
            marketAreaId: feature.attributes?.marketAreaId || feature.attributes?.id,
            style: feature.attributes?.style
          };
        } else if (feature.geometry.longitude !== undefined && feature.geometry.latitude !== undefined) {
          return {
            center: {
              longitude: feature.geometry.longitude,
              latitude: feature.geometry.latitude,
              spatialReference: feature.geometry.spatialReference
            },
            radii: [5], // Default radius of 5 miles if none specified
            marketAreaId: feature.attributes?.marketAreaId || feature.attributes?.id,
            style: feature.attributes?.style
          };
        }
      }

      // If all else fails, look for fields that might contain the data
      for (const key in feature) {
        if (key.toLowerCase().includes('radius') || key.toLowerCase().includes('center')) {
          console.log(`[MapContext] Found potential radius data in field: ${key}`, feature[key]);
        }
      }

      return null;
    } catch (error) {
      console.error("[MapContext] Error extracting radius properties:", error, feature);
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
                if (type === 'zip') {
                  const zipCode = f.attributes.ZCTA5;
                  return zipCode && !allFeatures.some(
                    existing => existing.attributes.ZCTA5 === zipCode
                  );
                }
                
                // For other layers, use OBJECTID or FID as the unique identifier
                const fid = f.attributes.OBJECTID || f.attributes.FID;
                return fid && !allFeatures.some(
                  existing => (existing.attributes.OBJECTID || existing.attributes.FID) === fid
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
  
    if (!marketArea || !marketArea.locations || marketArea.locations.length === 0) {
      console.warn(`Market area ${marketArea.id} has no locations to query`);
      return [];
    }
  
    if (!featureLayers || !mapView) {
      console.warn("Feature layers or map view not initialized");
      return [];
    }
  
    try {
      const { default: Query } = await import("@arcgis/core/rest/support/Query");
  
      const layer = featureLayers[marketArea.ma_type];
      if (!layer) {
        console.warn(`No feature layer found for type ${marketArea.ma_type}`);
        return [];
      }
  
      // Build a where clause based on the market area type and locations
      let whereClause = "";
  
      if (marketArea.ma_type === 'zip') {
        // For ZIP codes, create a more robust query
        const validZips = marketArea.locations
          .map(loc => {
            const zipValue = (loc.id || loc.name || "").trim();
            if (!zipValue || zipValue === "00000") return null;
            
            // Format ZIP code properly (5 digits)
            const formattedZip = zipValue.padStart(5, '0').substring(0, 5);
            return formattedZip;
          })
          .filter(Boolean); // Remove null/empty values
        
        if (validZips.length === 0) {
          console.warn("No valid ZIP codes found for market area:", marketArea.id);
          return [];
        }
        
        whereClause = validZips.map(zip => 
          `ZIP = '${zip}'`
        ).join(" OR ");
        
        console.log("ZIP where clause:", whereClause);
      }
      else if (marketArea.ma_type === 'county') {
        // For counties, use the NAME field with LIKE operator and add state filtering
        const validCounties = marketArea.locations
          .map(loc => {
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
          console.warn("No valid counties found for market area:", marketArea.id);
          return [];
        }
        
        whereClause = validCounties.join(" OR ");
        console.log("County where clause with state filtering:", whereClause);
      }
      else if (marketArea.ma_type === 'place') {
        // For places, use the NAME field with LIKE operator and add state filtering
        const validPlaces = marketArea.locations
          .map(loc => {
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
      }
      else {
        // We only support zip, county, and place - but this is a fallback
        console.warn(`Unsupported market area type: ${marketArea.ma_type}`);
        return [];
      }
  
      // Skip query if where clause is empty
      if (!whereClause) {
        console.warn(`Empty where clause for market area ${marketArea.id}`);
        return [];
      }
  
      console.log(`Querying ${marketArea.ma_type} layer with where clause:`, whereClause);
  
      // Create query with added timeout and error handling
      const query = new Query({
        where: whereClause,
        outFields: ["*"],
        returnGeometry: true,
        outSpatialReference: mapView.spatialReference,
        maxRecordCount: 100, // Limit results
        num: 100, // Limit results
        start: 0
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
              console.log(`Found ${features.length} features in sublayer for ${marketArea.ma_type}`);
              break; // Found features, stop checking other sublayers
            }
          } catch (error) {
            console.warn(`Error querying sublayer for ${marketArea.ma_type}:`, error);
            // Try with a simpler query if needed (handling specific errors)
            if (error.message && error.message.includes('Geometry is not supported with DISTINCT')) {
              console.log('Retrying query without DISTINCT parameter');
              try {
                const retryResult = await sublayer.queryFeatures(query);
                if (retryResult && retryResult.features && retryResult.features.length > 0) {
                  features = retryResult.features;
                  console.log(`Retry successful! Found ${features.length} features`);
                  break;
                }
              } catch (retryError) {
                console.warn('Retry also failed:', retryError);
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
            console.log(`Found ${features.length} features in layer for ${marketArea.ma_type}`);
          }
        } catch (error) {
          console.warn(`Error querying features for ${marketArea.ma_type}:`, error);
          
          // Add specific handling for place layer errors
          if (marketArea.ma_type === 'place') {
            console.log("Trying alternative approach for place query...");
            
            try {
              // Try with a simpler query - just match on the beginning of the name
              const simplifiedQuery = new Query({
                where: marketArea.locations.map(loc => {
                  const cleanName = (loc.id || loc.name || "")
                    .split(/\s+/)[0]  // Take just first word of place name
                    .replace(/'/g, "''");
                  if (!cleanName) return '';
                  
                  const stateValue = loc.state || "CA";
                  const stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                  const stateFilter = stateFips ? ` AND STATE = '${stateFips}'` : "";
                  
                  return `(UPPER(NAME) LIKE UPPER('${cleanName}%')${stateFilter})`;
                })
                .filter(Boolean) // Remove empty clauses
                .join(" OR "),
                outFields: ["*"],
                returnGeometry: true,
                outSpatialReference: mapView.spatialReference
              });
              
              // Skip if where clause is empty
              if (!simplifiedQuery.where) {
                console.warn("Simplified place query has empty where clause");
                return features;
              }
              
              console.log("Simplified place query:", simplifiedQuery.where);
              const retryResult = await layer.queryFeatures(simplifiedQuery);
              
              if (retryResult && retryResult.features && retryResult.features.length > 0) {
                features = retryResult.features;
                console.log(`Simplified query successful! Found ${features.length} place features`);
              }
            } catch (retryError) {
              console.warn("Alternative place query approach also failed:", retryError);
            }
          }
          
          // Existing error handling for DISTINCT error
          if (error.message && error.message.includes('Geometry is not supported with DISTINCT')) {
            console.log('Retrying query without DISTINCT parameter');
            try {
              const retryResult = await layer.queryFeatures(query);
              if (retryResult && retryResult.features) {
                features = retryResult.features;
                console.log(`Retry successful! Found ${features.length} features`);
              }
            } catch (retryError) {
              console.warn('Retry also failed:', retryError);
            }
          }
        }
      }
  
      console.log(`Query result for ${marketArea.ma_type}:`, {
        hasFeatures: features.length > 0,
        count: features.length
      });
  
      return features;
    } catch (error) {
      console.error(`Error querying features for market area ${marketArea.id}:`, error);
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
    // Ensure conditions are met before running
    if (
      mapView &&
      marketAreas &&
      marketAreas.length > 0 &&
      visibleMarketAreaIds &&
      visibleMarketAreaIds.length > 0 &&
      layersReady
    ) {
      const visibleMarketAreas = marketAreas.filter(ma =>
        visibleMarketAreaIds.includes(ma.id)
      );

      console.log("[MapContext] Processing visible market areas:", {
        count: visibleMarketAreas.length,
        ids: visibleMarketAreas.map(ma => ma.id),
        types: visibleMarketAreas.map(ma => ma.ma_type)
      });

      // Keep track of which market areas we've processed to avoid duplicates
      const processedMarketAreaIds = new Set();

      // Process each market area
      visibleMarketAreas.forEach(async (ma) => {
        // Skip if we've already processed this market area
        if (processedMarketAreaIds.has(ma.id)) {
          console.log(`[MapContext] Skipping already processed market area: ${ma.id}`);
          return;
        }

        // Mark as processed
        processedMarketAreaIds.add(ma.id);

        if (ma.ma_type === 'radius') {
          console.log("[MapContext] Processing radius market area:", ma.id);

          // Handle radius type market areas
          try {
            // Check if there are already graphics for this market area
            const existingRadiusGraphics = selectionGraphicsLayerRef.current.graphics.filter(
              g => g.attributes?.marketAreaId === ma.id && g.attributes?.FEATURE_TYPE === 'radius'
            );

            // If there are existing graphics and it's visible, no need to redraw
            if (existingRadiusGraphics.length > 0) {
              console.log(`[MapContext] Market area ${ma.id} already has radius graphics, skipping drawing`);
              return;
            }

            if (ma.radius_points) {
              let radiusPoints;
              try {
                // Parse if string
                radiusPoints = typeof ma.radius_points === 'string'
                  ? JSON.parse(ma.radius_points)
                  : ma.radius_points;
              } catch (e) {
                console.warn("[MapContext] Failed to parse radius_points:", e);
                radiusPoints = ma.radius_points;
              }

              // Normalize to array
              const points = Array.isArray(radiusPoints) ? radiusPoints : [radiusPoints];

              console.log("[MapContext] Drawing radius points:", {
                count: points.length,
                firstPoint: points[0]
              });

              // Actually draw the radius points here
              for (const point of points) {
                await drawRadius(
                  point,
                  ma.style_settings || {
                    fillColor: "#0078D4",
                    fillOpacity: 0.35,
                    borderColor: "#0078D4",
                    borderWidth: 3,
                    noFill: false,
                    noBorder: false
                  },
                  ma.id,
                  ma.order || 0
                );
              }
            } else {
              console.warn("[MapContext] Radius market area missing radius_points:", ma.id);
            }
          } catch (error) {
            console.error("[MapContext] Error processing radius market area:", error);
          }
        } else if (ma.ma_type === 'drivetime') {
          console.log("[MapContext] Processing drive time market area:", {
            id: ma.id,
            driveTimePoints: ma.drive_time_points,
            geometry: ma.geometry
          });

          // Ensure drive time points is an array
          let driveTimePoints = ma.drive_time_points;
          let polygonGeometry = ma.geometry;

          // Robust parsing for drive time points
          if (typeof driveTimePoints === 'string') {
            try {
              // Try JSON parsing first
              driveTimePoints = JSON.parse(driveTimePoints);
            } catch {
              try {
                // Try parsing as an object/JavaScript expression
                driveTimePoints = eval(`(${driveTimePoints})`);
              } catch {
                console.warn(`[MapContext] Failed to parse drive_time_points for market area ${ma.id}`);
                driveTimePoints = null;
              }
            }
          }

          // Ensure driveTimePoints is an array
          if (!Array.isArray(driveTimePoints)) {
            driveTimePoints = driveTimePoints ? [driveTimePoints] : [];
          }

          // Fallback point generation if no points found
          if (driveTimePoints.length === 0 && polygonGeometry) {
            try {
              // Attempt to reconstruct points from geometry
              const centroid = polygonGeometry.rings?.[0]?.[0];
              driveTimePoints = [{
                center: {
                  longitude: centroid[0],
                  latitude: centroid[1]
                },
                timeRanges: [15], // Default 15-minute range
                polygon: polygonGeometry
              }];
            } catch (err) {
              console.warn(`[MapContext] Failed to extract points from geometry for market area ${ma.id}:`, err);
            }
          }

          // Normalize and validate points
          const validPoints = driveTimePoints
            .map(point => {
              const center = point.center || point.point || point;
              return {
                center: {
                  longitude: center.longitude || center.x,
                  latitude: center.latitude || center.y
                },
                timeRanges: Array.isArray(point.timeRanges)
                  ? point.timeRanges
                  : [point.timeRange || point.travelTimeMinutes || 15],
                polygon: point.polygon || point.driveTimePolygon || polygonGeometry,
                units: point.units || 'minutes'
              };
            })
            .filter(point =>
              point.center?.longitude !== undefined &&
              point.center?.latitude !== undefined
            );

          if (validPoints.length === 0) {
            console.warn(`[MapContext] No valid drive time points for market area ${ma.id}`);
            return;
          }

          // Draw each validated point
          for (const point of validPoints) {
            try {
              // If no polygon, calculate it
              if (!point.polygon) {
                point.polygon = await calculateDriveTimePolygon(point);
              }

              // Draw the drive time polygon
              await drawDriveTimePolygon(
                point,
                ma.style_settings || {
                  fillColor: "#0078D4",
                  fillOpacity: 0.35,
                  borderColor: "#0078D4",
                  borderWidth: 3,
                  noFill: false,
                  noBorder: false
                },
                ma.id,
                ma.order || 0
              );
            } catch (error) {
              console.error(`[MapContext] Error processing drive time point for market area ${ma.id}:`, error);
            }
          }
        } else if (ma.locations && ma.locations.length > 0) {
          // Handle regular polygon-based market areas
          console.log("[MapContext] Processing polygon market area:", {
            id: ma.id,
            locationsCount: ma.locations.length
          });

          // Check for existing graphics for this market area to avoid duplicates
          const existingMarketAreaGraphics = selectionGraphicsLayerRef.current.graphics.filter(
            g => g.attributes?.marketAreaId === ma.id
          );

          if (existingMarketAreaGraphics.length > 0) {
            console.log(`[MapContext] Market area ${ma.id} already has graphics, skipping processing`);
            return;
          }

          // Convert locations to feature format
          const features = ma.locations.map(loc => ({
            geometry: loc.geometry,
            attributes: {
              ...loc,
              marketAreaId: ma.id,
              FEATURE_TYPE: ma.ma_type || 'tract',
              order: ma.order || 0
            }
          }));

          // Display the features on the map WITHOUT clearing existing graphics
          await displayFeatures(features);

          // Apply styling if needed - this will be run on ALL graphics for the market area
          if (ma.style) {
            const marketAreaFeatures = selectionGraphicsLayerRef.current.graphics.filter(
              g => g.attributes?.marketAreaId === ma.id
            ).map(g => ({
              geometry: g.geometry,
              attributes: g.attributes
            }));

            if (marketAreaFeatures.length > 0) {
              updateFeatureStyles(
                marketAreaFeatures,
                ma.style,
                ma.ma_type || 'tract',
                true // immediate update
              );
            }
          }
        } else {
          console.warn("[MapContext] Market area has no locations:", ma.id);
        }
      });
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
    layersReady,
  ]);

  useEffect(() => {
    if (mapView && !selectionGraphicsLayerRef.current) {
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
              (editingMarketArea &&
                graphicMarketAreaId === editingMarketArea.id)
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
                (type) =>
                  FEATURE_LAYERS[type].title === graphicResult.layer.title
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
  }, [
    mapView,
    isMapSelectionActive,
    activeLayers,
    addToSelection,
    editingMarketArea,
  ]);


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

    console.log('[MapContext] Centering effect triggered:', {
      hasCentered: hasCentered.current,
      mapReady: mapView?.ready,
      hasMarketAreas: Boolean(marketAreas?.length),
      marketAreasCount: marketAreas?.length,
      firstMarketArea: marketAreas?.[0]?.id
    });

    if (!mapView?.ready) {
      console.log('[MapContext] Map not ready, skipping');
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
          (Date.now() - startTime) < MAX_WAIT_TIME
        ) {
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log('[MapContext] Waiting for market areas to load...');
        }

        // Wait an additional initial time to ensure rendering
        await new Promise(resolve => setTimeout(resolve, INITIAL_WAIT_TIME));

        // Always reset hasCentered when starting a new project
        const shouldResetCenter = !marketAreas || marketAreas.length === 0;

        if (shouldResetCenter) {
          console.log('[MapContext] Resetting center state - no market areas');
          hasCentered.current = false;
        }

        // If already centered and not forcibly resetting, return
        if (hasCentered.current && !shouldResetCenter) {
          console.log('[MapContext] Already centered, skipping');
          return;
        }

        if (marketAreas?.length > 0) {
          console.log('[MapContext] Found market areas:', marketAreas.map(ma => ({
            id: ma.id,
            name: ma.name,
            locationsCount: ma.locations?.length || 0,
            hasGeometry: Boolean(ma.locations?.[0]?.geometry)
          })));

          // Find first market area with valid geometry
          let validGeometry = null;
          let maWithGeometry = null;

          for (const ma of marketAreas) {
            if (ma.locations?.length) {
              for (const loc of ma.locations) {
                if (loc.geometry?.rings?.length > 0) {
                  validGeometry = loc.geometry;
                  maWithGeometry = ma;
                  console.log('[MapContext] Found valid geometry in market area:', {
                    id: ma.id,
                    name: ma.name,
                    geometryRings: loc.geometry.rings.length
                  });
                  break;
                }
              }
              if (validGeometry) break;
            }
          }

          if (validGeometry && isActive) {
            try {
              const [Extent, SpatialReference] = await Promise.all([
                import("@arcgis/core/geometry/Extent").then(m => m.default),
                import("@arcgis/core/geometry/SpatialReference").then(m => m.default)
              ]);

              console.log('[MapContext] Creating extent from geometry for:', maWithGeometry?.name);

              const sr = new SpatialReference({ wkid: 102100 });

              let extent;
              if (validGeometry.rings) {
                const xCoords = [];
                const yCoords = [];

                validGeometry.rings[0].forEach(coord => {
                  xCoords.push(coord[0]);
                  yCoords.push(coord[1]);
                });

                extent = new Extent({
                  xmin: Math.min(...xCoords),
                  ymin: Math.min(...yCoords),
                  xmax: Math.max(...xCoords),
                  ymax: Math.max(...yCoords),
                  spatialReference: sr
                });

                console.log('[MapContext] Created extent:', {
                  xmin: Math.min(...xCoords),
                  ymin: Math.min(...yCoords),
                  xmax: Math.max(...xCoords),
                  ymax: Math.max(...yCoords)
                });
              }

              console.log('[MapContext] Centering on market area:', maWithGeometry?.name);
              await mapView.goTo({
                target: extent || validGeometry,
                zoom: 9
              }, {
                duration: 1000,
                easing: "ease-in-out"
              });

              if (isActive) {
                console.log('[MapContext] Successfully centered on market area:', maWithGeometry?.name);
                hasCentered.current = true;
              }
              return;
            } catch (err) {
              console.error('[MapContext] Error centering on market area:', err);
              if (isActive) {
                await centerOnOrangeCounty();
              }
            }
          } else {
            console.log('[MapContext] No valid geometry found in market areas:',
              marketAreas.map(ma => ({
                id: ma.id,
                name: ma.name,
                locationsCount: ma.locations?.length,
                firstLocGeometry: Boolean(ma.locations?.[0]?.geometry)
              }))
            );
          }
        }

        console.log('[MapContext] No valid project extent found, falling back to Orange County');
        await centerOnOrangeCounty();

      } catch (err) {
        console.error('[MapContext] Centering error:', err);
        await centerOnOrangeCounty();
      }
    };

    async function centerOnOrangeCounty() {
      if (!isActive) return;

      console.log('[MapContext] Attempting to center on Orange County');
      try {
        const Point = (await import("@arcgis/core/geometry/Point")).default;
        const orangeCountyPoint = new Point({
          longitude: -117.8311,
          latitude: 33.7175
        });

        await mapView.goTo({
          target: orangeCountyPoint,
          zoom: 9
        }, {
          duration: 1000,
          easing: "ease-in-out"
        });

        if (isActive) {
          const finalCenter = mapView.center;
          console.log('[MapContext] Successfully centered on Orange County. View state:', {
            center: {
              latitude: finalCenter.latitude,
              longitude: finalCenter.longitude
            },
            zoom: mapView.zoom,
            scale: mapView.scale
          });
          hasCentered.current = true;
        }
      } catch (err) {
        console.error('[MapContext] Error in Orange County fallback:', err);
      }
    }

    centerMap();

    return () => {
      isActive = false;
      console.log('[MapContext] Cleaning up centering effect');
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
      zoomToExtent,
      zoomToMarketArea,
      isOutsideZoomRange,
      zoomMessage
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
      calculateDriveTimePolygon,
      isMapSelectionActive,
      setIsMapSelectionActive,
      formatLocationName,
      visibleMarketAreaIds,
      editingMarketArea,
      setEditingMarketArea,
      zoomToExtent,
      zoomToMarketArea,
      isOutsideZoomRange,
      zoomMessage
    ]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export default MapContext;
export { FEATURE_LAYERS };
