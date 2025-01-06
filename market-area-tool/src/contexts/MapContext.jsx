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
  geographicToWebMercator 
} from "@arcgis/core/geometry/support/webMercatorUtils";
import * as geometryEngineAsync from "@arcgis/core/geometry/geometryEngineAsync";
import { useMarketAreas } from "../contexts/MarketAreaContext";
import { default as SpatialReference } from "@arcgis/core/geometry/SpatialReference";
import { default as ProjectParameters } from "@arcgis/core/rest/support/ProjectParameters";
import * as geometryService from "@arcgis/core/rest/geometryService";

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
        return attributes.GEOID.substring(0, 2);
      }
  
      // 2) Otherwise, try the attributes.STATE or attributes.STATE_FIPS fields
      const maybeState = attributes.STATE;
      const maybeFips = attributes.STATE_FIPS;
      if (maybeState && maybeState !== "00") return maybeState;
      if (maybeFips && maybeFips !== "00") return maybeFips;
  
      // 3) Default to "06" (California) if no valid state code
      return "06";
    }
  
    // Common attributes with fallbacks
    const stateFips = getValidStateFips();
    const countyFips = attributes.COUNTY_FIPS || attributes.COUNTY || "";
    const tractFips = attributes.TRACT_FIPS || attributes.TRACT || "";
    const blockGroupFips = attributes.BLOCKGROUP_FIPS || "";
    const blockVal = attributes.BLOCK || "";
    const zipCode = attributes.ZIP || "";
  
    // If attributes.STATE_ABBR is empty, fallback to dictionary
    const stateAbbr = attributes.STATE_ABBR || STATE_ABBR_BY_FIPS[stateFips] || "CA";
    // Also get a spelled-out state name, in case you want it
    const stateName = attributes.STATE_NAME || STATE_NAME_BY_FIPS[stateFips] || "California";
  
    // Original location name from attributes - check multiple possible field names
    let rawName = attributes.NAME || attributes.BASENAME || attributes.STATE_NAME || "";
  
    // Utility to remove trailing “county,” “city,” “town,” “village,” or “borough.”
    // This prevents “Arcadia Lakes town Town” duplication, etc.
    function sanitizeName(name) {
      return (
        name
          .replace(/,\s*$/, "") // remove trailing comma
          // remove trailing county/city/town/village/borough (case-insensitive)
          .replace(/\s+(county|city|town|village|borough)$/i, "")
          .trim()
      );
    }
  
    const locationName = sanitizeName(rawName);
  
    // Zero-pad utility (for FIPS codes)
    function pad(value, length) {
      return String(value || "").padStart(length, "0");
    }
  
    // For "place", see if we have an LSADC-coded place type
    // e.g. "25" => "City"
    let placeType = "";
    if (type === "place" && attributes.LSADC) {
      const codeNum = parseInt(attributes.LSADC, 10);
      if (LSADC_TO_PLACETYPE[codeNum]) {
        placeType = LSADC_TO_PLACETYPE[codeNum];
      }
    }
  
    switch (type) {
      /***********************************
       * 1) County
       ***********************************/
      case "county":
        // e.g. "Orange County, CA"
        return `${locationName} County, ${stateAbbr}`;
  
      /***********************************
       * 2) Place
       ***********************************/
      case "place":
        // e.g. "Arcadia Lakes Town, SC" or "Bailey Lakes Village, OH"
        // only append placeType if it exists and not blank
        // e.g. locationName: "Arcadia Lakes town" -> sanitized to "Arcadia Lakes"
        // placeType: "Town" -> final: "Arcadia Lakes Town"
        if (placeType) {
          return `${locationName} ${placeType}, ${stateAbbr}`;
        }
        return `${locationName}, ${stateAbbr}`;
  
      /***********************************
       * 3) Zip
       ***********************************/
      case "zip":
        // e.g. "77001, TX"
        return `${zipCode}, ${stateAbbr}`;
  
      /***********************************
       * 4) Census Tract
       ***********************************/
      case "tract":
        // If GEOID is present, just return that
        if (attributes.GEOID) return attributes.GEOID;
        // Otherwise build the 11-digit code => SS + CCC + TTTTTT
        return `${pad(stateFips, 2)}${pad(countyFips, 3)}${pad(tractFips, 6)}`;
  
      /***********************************
       * 5) Census Block Group
       ***********************************/
      case "blockgroup":
        if (attributes.GEOID) return attributes.GEOID;
        // => SS + CCC + TTTTTT + B
        return (
          pad(stateFips, 2) +
          pad(countyFips, 3) +
          pad(tractFips, 6) +
          pad(blockGroupFips, 1)
        );
  
      /***********************************
       * 6) Census Block
       ***********************************/
      case "block":
        if (attributes.GEOID) return attributes.GEOID;
        // => SS + CCC + TTTTTT + BBBB(L)
        const s = pad(stateFips, 2);
        const c = pad(countyFips, 3);
        const t = pad(tractFips, 6);
  
        // Some blocks have numeric + letter combos
        const numericPart = blockVal.replace(/[^\d]/g, "");
        const letterPart = blockVal.replace(/\d/g, "");
        const paddedBlock = pad(numericPart, 4) + letterPart;
        return `${s}${c}${t}${paddedBlock}`;
  
      /***********************************
       * 7) State
       ***********************************/
      case "state":
        // For a state, just return the (possibly cleaned) name
        // or a fallback like "California"
        return locationName || stateName;
  
      /***********************************
       * 8) Catch-all: md, cbsa, etc.
       ***********************************/
      default:
        return locationName || "Unknown Location";
    }
  }

  const [layersReady, setLayersReady] = useState(false);

  const initializeGraphicsLayers = useCallback(async () => {
    if (!mapView) return;

    try {
      const { default: GraphicsLayer } = await import(
        "@arcgis/core/layers/GraphicsLayer"
      );

      // Single Graphics Layer for *all* Market Area geometry
      const selectionLayer = new GraphicsLayer({
        title: "Market Area Graphics",
        listMode: "hide",
        elevationInfo: {
          mode: "relative-to-ground",
          offset: 1,
        },
      });

      // Add our single layer to the map
      mapView.map.add(selectionLayer);

      // Store it in ref so we can access it later
      selectionGraphicsLayerRef.current = selectionLayer;

      console.log("[MapContext] Single GraphicsLayer initialized");
    } catch (error) {
      console.error("[MapContext] Error initializing GraphicsLayer:", error);
    }

    setLayersReady(true);
  }, [mapView]);

  const getLabelingInfo = (type) => {
    let label;
  
    switch (type) {
      case "zip":
        label = {
          field: "ZIP",
          expressionInfo: {
            expression: "$feature.ZIP",
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
          color: [0, 0, 0, 1],         // Black text
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
      const { default: FeatureLayer } = await import("@arcgis/core/layers/FeatureLayer");
      const { default: GroupLayer } = await import("@arcgis/core/layers/GroupLayer");
  
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
      console.error(`Error initializing FeatureLayer for type ${type}:`, error);
      return null;
    }
  }, []);


  // Reproject geometry to a specific spatial reference
  const reprojectGeometry = async (geometry, sourceSR, targetSR) => {
    if (!geometry || !sourceSR || !targetSR) return geometry;
  
    try {
      const params = new ProjectParameters({
        geometries: [geometry],
        outSpatialReference: targetSR
      });
  
      const projectedGeometries = await geometryService.project(params);
      return projectedGeometries[0];
    } catch (error) {
      console.error("Geometry reprojection error:", error);
      return geometry;
    }
  };

  const incrementalUnion = async (geometries) => {
    if (geometries.length === 1) {
      return geometries[0];
    }
  
    // Sort the geometries by area, largest first
    geometries = geometries.slice().sort((a, b) => {
      const areaA = geometryEngine.planarArea(a);
      const areaB = geometryEngine.planarArea(b);
      return areaB - areaA;
    });
  
    let unionGeometry = geometries[0];
    for (let i = 1; i < geometries.length; i++) {
      let currentGeometry = geometries[i];
  
      try {
        // Attempt to union the geometries
        unionGeometry = await geometryEngineAsync.union([unionGeometry, currentGeometry]);
      } catch (err) {
        console.warn(`Error unioning polygon at index ${i}:`, err);
  
        // If union fails, try repairing the geometries and re-attempting the union
        unionGeometry = await repairGeometry(unionGeometry);
        currentGeometry = await repairGeometry(currentGeometry);
  
        try {
          unionGeometry = await geometryEngineAsync.union([unionGeometry, currentGeometry]);
        } catch (finalErr) {
          console.warn(`Union failed after repairs. Skipping polygon at index ${i}`, finalErr);
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
  
      // Additional repair steps, such as buffer(0), can be added here
    }
  
    return unionGeometry;
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
          if (validatedGeometry.spatialReference.wkid !== mapView.spatialReference.wkid) {
            validatedGeometry = await reprojectGeometry(
              validatedGeometry, 
              validatedGeometry.spatialReference, 
              mapView.spatialReference
            );
          }
        } catch (geometryError) {
          console.warn("[MapContext] Geometry validation failed:", geometryError);
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
  
        // Set the editing state
        setEditingMarketArea(marketArea);
  
        // Update selectedFeatures state to include the locations from the market area being edited
        if (marketArea && marketArea.locations) {
          setSelectedFeatures(
            marketArea.locations.map(loc => ({
              geometry: loc.geometry,
              attributes: {
                ...loc,
                marketAreaId: marketAreaId,
                FEATURE_TYPE: marketArea.ma_type,
                order: marketArea.order
              }
            }))
          );
        }
  
        // Get all current graphics and update their interactivity state
        const currentGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
        
        // Temporarily remove all graphics
        selectionGraphicsLayerRef.current.removeAll();
  
        // Re-add each graphic with updated properties
        currentGraphics.forEach(graphic => {
          const isEditingArea = graphic.attributes?.marketAreaId === marketAreaId;
          
          // Clone the graphic to avoid modifying the original
          const updatedGraphic = graphic.clone();
          
          // Update interactive state
          updatedGraphic.interactive = isEditingArea;
  
          // Add the graphic back
          selectionGraphicsLayerRef.current.add(updatedGraphic);
        });
  
        // Update feature layer interactivity
        Object.values(featureLayersRef.current).forEach(layer => {
          if (layer && !layer.destroyed) {
            if (Array.isArray(layer.featureLayers)) {
              layer.featureLayers.forEach(subLayer => {
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
          marketArea,
          graphicsCount: selectionGraphicsLayerRef.current.graphics.length
        });
  
      } catch (error) {
        console.error("Error toggling market area edit mode:", error);
        toast.error("Error entering edit mode");
      }
    },
    [marketAreas]
  );

  const displayFeatures = useCallback(
    async (featuresToDraw) => {
      if (!mapView || !selectionGraphicsLayerRef.current) return;

      try {
        console.log(
          `[MapContext] Displaying ${
            featuresToDraw.length
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
              !featuresToDraw.some(
                (f) => f.attributes.FID === graphic.attributes.FID
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

        const { default: Graphic } = await import("@arcgis/core/Graphic");
        for (const feat of featuresToDraw) {
          // Make sure geometry is valid & define your symbol
          const geometry = ensureValidGeometry(
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
      } catch (err) {
        console.error("[MapContext] Error displaying features:", err);
      }
    },
    [mapView]
  );

  const updateFeatureStyles = useCallback(
    async (features, styles, featureType) => {
      console.log('=== UPDATE FEATURE STYLES START ===');
      console.log('Updating styles for:', {
        featureCount: features.length,
        featureType,
        styles
      });

      if (!selectionGraphicsLayerRef.current || !mapView) {
        console.warn('Missing required refs');
        return;
      }

      try {
        const [
          { default: Graphic }, 
          { default: Polygon },
          { union, simplify, planarArea, planarLength }
        ] = await Promise.all([
          import("@arcgis/core/Graphic"),
          import("@arcgis/core/geometry/Polygon"),
          import("@arcgis/core/geometry/geometryEngine")
        ]);

        // Group features by their marketAreaId
        const featuresByMarketArea = {};
        features.forEach(feature => {
          const id = feature.attributes.marketAreaId;
          if (!featuresByMarketArea[id]) featuresByMarketArea[id] = [];
          featuresByMarketArea[id].push(feature);
        });

        // Keep existing graphics from other market areas
        const marketAreaIds = new Set(Object.keys(featuresByMarketArea));
        const existingGraphics = selectionGraphicsLayerRef.current.graphics.filter(
          g => !marketAreaIds.has(g.attributes?.marketAreaId)
        );

        // Clear and restore
        selectionGraphicsLayerRef.current.removeAll();
        existingGraphics.forEach(g => selectionGraphicsLayerRef.current.add(g));

        // Process each market area's features
        for (const [marketAreaId, maFeatures] of Object.entries(featuresByMarketArea)) {
          // Convert all features to Polygon geometries
          const polygons = maFeatures.map(feature => {
            const geomConfig = {
              spatialReference: mapView.spatialReference,
              type: "polygon"
            };

            if (feature.geometry.rings) {
              return new Polygon({
                ...geomConfig,
                rings: feature.geometry.rings
              });
            } else if (feature.geometry.type === "polygon") {
              return new Polygon({
                ...geomConfig,
                rings: feature.geometry.rings || feature.geometry.coordinates
              });
            }
            return null;
          }).filter(Boolean);

          // Create unified boundary using union and simplify
          const unifiedGeometry = union(polygons);
          if (!unifiedGeometry) {
            console.warn(`Failed to create unified geometry for market area ${marketAreaId}`);
            continue;
          }

          const simplifiedGeometry = simplify(unifiedGeometry);
          
          // Get the total area of the unified geometry for scale reference
          const totalArea = Math.abs(planarArea(simplifiedGeometry));
          const minHoleArea = totalArea * 0.001; // Holes must be at least 0.1% of total area

          // Extract and filter rings
          const rings = simplifiedGeometry.rings;
          const { exteriorRings, holeRings } = rings.reduce((acc, ring) => {
            const ringPolygon = new Polygon({
              rings: [ring],
              spatialReference: mapView.spatialReference,
              type: "polygon"
            });
            
            const area = planarArea(ringPolygon);
            const perimeter = planarLength(ringPolygon);
            
            if (area > 0) {
              acc.exteriorRings.push(ring);
            } else if (Math.abs(area) > minHoleArea && perimeter > 100) {
              acc.holeRings.push(ring);
            }
            return acc;
          }, { exteriorRings: [], holeRings: [] });

          // Create fill graphic
          const fillSymbol = {
            type: "simple-fill",
            color: [...hexToRgb(styles.fill), styles.fillOpacity],
            outline: {
              color: [0, 0, 0, 0],
              width: 0
            }
          };

          const fillGeometry = new Polygon({
            rings: [...exteriorRings, ...holeRings],
            spatialReference: mapView.spatialReference,
            type: "polygon"
          });

          const fillGraphic = new Graphic({
            geometry: fillGeometry,
            symbol: fillSymbol,
            attributes: {
              marketAreaId,
              FEATURE_TYPE: featureType,
              isUnified: true,
              ...maFeatures[0].attributes
            }
          });

          // Create outline symbol
          const outlineSymbol = {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: {
              color: styles.outline,
              width: styles.outlineWidth
            }
          };

          // Create exterior outline graphic
          const exteriorGeometry = new Polygon({
            rings: exteriorRings,
            spatialReference: mapView.spatialReference,
            type: "polygon"
          });

          const exteriorOutlineGraphic = new Graphic({
            geometry: exteriorGeometry,
            symbol: outlineSymbol,
            attributes: {
              marketAreaId,
              FEATURE_TYPE: featureType,
              isUnified: true,
              isOutline: true,
              isExterior: true,
              ...maFeatures[0].attributes
            }
          });

          // Add graphics in order: fill, holes, exterior
          selectionGraphicsLayerRef.current.add(fillGraphic);

          // Add hole outlines
          holeRings.forEach((holeRing, index) => {
            const holeGeometry = new Polygon({
              rings: [holeRing],
              spatialReference: mapView.spatialReference,
              type: "polygon"
            });

            const holeGraphic = new Graphic({
              geometry: holeGeometry,
              symbol: outlineSymbol,
              attributes: {
                marketAreaId,
                FEATURE_TYPE: featureType,
                isUnified: true,
                isOutline: true,
                isHole: true,
                holeIndex: index,
                ...maFeatures[0].attributes
              }
            });
            selectionGraphicsLayerRef.current.add(holeGraphic);
          });

          selectionGraphicsLayerRef.current.add(exteriorOutlineGraphic);
        }

        console.log('Final graphics count:', selectionGraphicsLayerRef.current.graphics.length);
        console.log('=== UPDATE FEATURE STYLES COMPLETE ===');

      } catch (error) {
        console.error('=== UPDATE FEATURE STYLES ERROR ===', {
          error,
          featureType,
          featureCount: features.length
        });
      }
    },
    [mapView, hexToRgb]
  );
  const ensureValidGeometry = async (geometry, spatialReference) => {
    if (!geometry) return null;
  
    try {
      // First, repair the geometry
      geometry = await repairGeometry(geometry);
  
      // Ensure the geometry is properly projected
      if (geometry.spatialReference.wkid !== spatialReference.wkid) {
        geometry = await reprojectGeometry(
          geometry, 
          geometry.spatialReference, 
          spatialReference
        );
      }
  
      return geometry;
    } catch (error) {
      console.error("Error validating geometry:", error);
      return null;
    }
  };

  // NEW drawRadius function
  const drawRadius = useCallback(
    async (point, style = null, marketAreaId = null, order = 0) => {
      // Make sure we have a mapView, a valid layer, and valid point data
      if (
        !selectionGraphicsLayerRef.current ||
        !point?.center ||
        !point?.radii ||
        !mapView
      ) {
        return;
      }

      try {
        const { default: Graphic } = await import("@arcgis/core/Graphic");
        const { geodesicBuffer } = await import(
          "@arcgis/core/geometry/geometryEngine"
        );

        // Use provided style or fallback
        const fillRgb = style?.fillColor
          ? hexToRgb(style.fillColor)
          : [255, 255, 255];
        const outlineRgb = style?.borderColor
          ? hexToRgb(style.borderColor)
          : [0, 0, 0];
        const fillOpacity =
          style?.fillOpacity !== undefined ? style.fillOpacity : 0.3;
        const borderWidth =
          style?.borderWidth !== undefined ? style.borderWidth : 2;

        // Ensure geometry is valid and in the correct spatial reference
        const center = ensureValidGeometry(
          point.center,
          mapView.spatialReference
        );
        if (!center) return;

        const centerPoint = webMercatorToGeographic(center);

        // Keep *all* polygons and radius shapes from this same MarketArea,
        // remove ONLY radius shapes from other MarketAreas
        const existingGraphics =
          selectionGraphicsLayerRef.current.graphics.toArray();

        const keepGraphics = existingGraphics.filter((g) => {
          // If it's not a radius shape, keep it
          if (g.attributes?.FEATURE_TYPE !== "radius") return true;
          // Otherwise, if it's a radius shape but belongs to THIS marketArea, keep it
          return g.attributes.marketAreaId === marketAreaId;
        });

        // Clear and re-add only the kept graphics
        selectionGraphicsLayerRef.current.removeAll();
        keepGraphics.forEach((g) => selectionGraphicsLayerRef.current.add(g));

        // Generate new circle polygons for each radius in point.radii
        const newGraphics = [];
        const effectiveMarketAreaId = marketAreaId || "tempRadiusId";

        for (let i = 0; i < point.radii.length; i++) {
          const radiusMiles = point.radii[i];
          const radiusMeters = radiusMiles * 1609.34; // 1 mile = 1609.34 meters

          const uniqueMarketAreaId = `${effectiveMarketAreaId}-radius-${i}`;
          const polygon = geodesicBuffer(centerPoint, radiusMeters, "meters");

          const symbol = {
            type: "simple-fill",
            color: fillOpacity > 0 ? [...fillRgb, fillOpacity] : [0, 0, 0, 0],
            outline:
              borderWidth > 0
                ? { color: outlineRgb, width: borderWidth }
                : null,
          };

          const circleGraphic = new Graphic({
            geometry: polygon,
            attributes: {
              FEATURE_TYPE: "radius",
              marketAreaId: uniqueMarketAreaId,
              originalMarketAreaId: marketAreaId,
              radiusMiles,
              order,
            },
            symbol,
          });

          newGraphics.push(circleGraphic);
        }

        // Merge the new circleGraphics with the kept graphics
        const allGraphics = [
          ...selectionGraphicsLayerRef.current.graphics.toArray(),
          ...newGraphics,
        ];

        // Sort so that higher 'order' draws on top
        allGraphics.sort(
          (a, b) => (b.attributes.order || 0) - (a.attributes.order || 0)
        );

        // Clear & re-add in the correct order
        selectionGraphicsLayerRef.current.removeAll();
        allGraphics.forEach((graphic) =>
          selectionGraphicsLayerRef.current.add(graphic)
        );
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

  const clearMarketAreaGraphics = useCallback((marketAreaId) => {
    console.log('=== CLEAR MARKET AREA GRAPHICS START ===');
    console.log('Clearing graphics for marketAreaId:', marketAreaId);
  
    try {
      if (!marketAreaId) {
        console.log('No marketAreaId provided - clearing ALL market area graphics');
        
        if (selectionGraphicsLayerRef.current) {
          const allGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
          console.log('Current graphics count:', allGraphics.length);
          
          // Log details about radius graphics
          const radiusGraphics = allGraphics.filter(g => g.attributes?.FEATURE_TYPE === "radius");
          console.log('Radius graphics to remove:', {
            count: radiusGraphics.length,
            ids: radiusGraphics.map(g => g.attributes?.marketAreaId)
          });
  
          selectionGraphicsLayerRef.current.removeMany(radiusGraphics);
          console.log('Removed radius graphics');
  
          const nonMarketGraphics = allGraphics.filter(g => !g.attributes?.marketAreaId);
          console.log('Non-market area graphics to keep:', nonMarketGraphics.length);
  
          selectionGraphicsLayerRef.current.removeAll();
          nonMarketGraphics.forEach(g => selectionGraphicsLayerRef.current.add(g));
          
          console.log('Final graphics count:', selectionGraphicsLayerRef.current.graphics.length);
        }
      } else {
        console.log(`Clearing graphics for specific market area: ${marketAreaId}`);
        
        if (selectionGraphicsLayerRef.current) {
          const allGraphics = selectionGraphicsLayerRef.current.graphics.toArray();
          console.log('Starting graphics count:', allGraphics.length);
  
          // Remove radius shapes for this market area
          const radiusForThisMarket = allGraphics.filter(
            g => g.attributes?.FEATURE_TYPE === "radius" && 
                 g.attributes?.marketAreaId === marketAreaId
          );
          console.log('Radius graphics to remove:', {
            count: radiusForThisMarket.length,
            marketAreaId
          });
  
          selectionGraphicsLayerRef.current.removeMany(radiusForThisMarket);
  
          // Remove other graphics for this market area
          const remainingSelectionGraphics = allGraphics.filter(
            g => g.attributes?.marketAreaId !== marketAreaId
          );
          console.log('Remaining graphics to keep:', remainingSelectionGraphics.length);
  
          selectionGraphicsLayerRef.current.removeAll();
          remainingSelectionGraphics.forEach(g => selectionGraphicsLayerRef.current.add(g));
          
          console.log('Final graphics count:', selectionGraphicsLayerRef.current.graphics.length);
        }
      }
  
      console.log('=== CLEAR MARKET AREA GRAPHICS COMPLETE ===');
    } catch (error) {
      console.error('=== CLEAR MARKET AREA GRAPHICS ERROR ===', {
        error,
        marketAreaId
      });
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

        // Build layer-specific WHERE clause:
        let whereClause = "";
        const upperText = searchText.toUpperCase(); // for easier comparisons

        switch (type) {
          case "zip":
            whereClause = /^\d+$/.test(searchText)
              ? `ZIP LIKE '${searchText}%'`
              : `UPPER(PO_NAME) LIKE UPPER('%${searchText}%')`;
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

          // Merge & remove duplicates by unique ID (OBJECTID or FID)
          results.forEach((res) => {
            if (res && Array.isArray(res.features)) {
              const unique = res.features.filter((f) => {
                const fid = f.attributes.OBJECTID || f.attributes.FID;
                return !allFeatures.some(
                  (existing) =>
                    (existing.attributes.OBJECTID ||
                      existing.attributes.FID) === fid
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
    [activeLayers, mapView, featureLayersRef, FEATURE_LAYERS]
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
    }
  }, [
    mapView,
    marketAreas,
    visibleMarketAreaIds,
    drawRadius,
    updateFeatureStyles,
    layersReady,
  ]);

  useEffect(() => {
    if (
      mapView &&
      marketAreas.length > 0 &&
      visibleMarketAreaIds.length > 0 &&
      layersReady
    ) {
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

  // Create ref outside the effect
  const hasCentered = useRef(false);
  
  useEffect(() => {
    let isActive = true;

    console.log("[MapContext] Centering effect triggered:", {
      hasCentered: hasCentered.current,
      mapReady: mapView?.ready,
      layersReady,
      hasMarketAreas: Boolean(marketAreas?.length)
    });

    if (!mapView?.ready) {
      console.log("[MapContext] Map not ready, skipping");
      return;
    }

    if (hasCentered.current) {
      console.log("[MapContext] Already centered, skipping");
      return;
    }

    const centerMap = async () => {
      if (!isActive) return;

      if (marketAreas?.length) {
        console.log("[MapContext] Processing market areas:", 
          marketAreas.map(ma => ({
            id: ma.id,
            name: ma.name,
            locationsCount: ma.locations?.length || 0
          }))
        );

        let validGeometry = null;
        for (const ma of marketAreas) {
          if (ma.locations?.length) {
            for (const loc of ma.locations) {
              if (loc.geometry) {
                validGeometry = loc.geometry;
                console.log("[MapContext] Found valid geometry in location of market area:", ma.id);
                break;
              }
            }
            if (validGeometry) break;
          }
        }

        if (validGeometry && isActive) {
          try {
            // Import required modules for extent calculation
            const [Extent, SpatialReference] = await Promise.all([
              import('@arcgis/core/geometry/Extent').then(m => m.default),
              import('@arcgis/core/geometry/SpatialReference').then(m => m.default)
            ]);

            console.log("[MapContext] Creating extent from geometry");
            
            // Create a spatial reference for Web Mercator
            const sr = new SpatialReference({ wkid: 102100 });

            // Create an extent from the geometry
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
            }

            console.log("[MapContext] Centering on project extent");
            await mapView.goTo(
              { 
                target: extent || validGeometry,
                zoom: 9  // Always use zoom level 9
              },
              {
                duration: 1000,
                easing: "ease-in-out"
              }
            );

            if (isActive) {
              console.log("[MapContext] Successfully centered on project extent");
              hasCentered.current = true;
            }
            return;
          } catch (err) {
            console.error("[MapContext] Error centering on project extent:", err);
            if (isActive) {
              await centerOnOrangeCounty();
            }
          }
        }
      }

      if (isActive) {
        console.log("[MapContext] No valid project extent found, falling back to Orange County");
        await centerOnOrangeCounty();
      }
    };

    async function centerOnOrangeCounty() {
      if (!isActive) return;

      console.log("[MapContext] Attempting to center on Orange County");
      try {
        const Point = (await import('@arcgis/core/geometry/Point')).default;
        const orangeCountyPoint = new Point({
          longitude: -117.8311,
          latitude: 33.7175
        });

        await mapView.goTo({
          target: orangeCountyPoint,
          zoom: 9  // Use zoom level 9 for consistency
        }, {
          duration: 1000,
          easing: "ease-in-out"
        });

        if (isActive) {
          const finalCenter = mapView.center;
          console.log("[MapContext] Successfully centered on Orange County. View state:", {
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
