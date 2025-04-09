import { useEffect, useRef, useState, useCallback } from "react"; // Add useCallback
import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Zoom from "@arcgis/core/widgets/Zoom";
import Home from "@arcgis/core/widgets/Home";
import BasemapToggle from "@arcgis/core/widgets/BasemapToggle";
import Locate from "@arcgis/core/widgets/Locate";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Legend from "@arcgis/core/widgets/Legend";
import { useMap } from "../../contexts/MapContext";
import LayerPropertiesEditor from "./LayerPropertiesEditor";
import PropTypes from "prop-types";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { mapConfigurationsAPI } from "../../services/api";
import SearchableDropdown from "./SearchableDropdown";
import NewMapDialog from "./NewMapDialog";
import { processCustomMapData } from "./CustomDataHandler";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer"; // 
import Point from "@arcgis/core/geometry/Point"; // Import Point
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol"; // Import SimpleMarkerSymbol
import Color from "@arcgis/core/Color"; // Import Color
import Graphic from "@arcgis/core/Graphic";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import CustomLegend from "./CustomLegend";
// Replace the hardcoded API_KEY with the environment variable
const API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

const colorScheme = {
  level1: [128, 0, 128, 0.45], // Purple
  level2: [0, 0, 139, 0.45], // Dark blue
  level3: [135, 206, 235, 0.45], // Sky blue
  level4: [144, 238, 144, 0.45], // Light green
  level5: [255, 255, 144, 0.45], // Light yellow
  level6: [255, 165, 0, 0.45], // Orange
  level7: [255, 99, 71, 0.45], // Salmon red
};

// ZoomAlert Component
const ZoomAlert = () => {
  const { isOutsideZoomRange, zoomMessage } = useMap();

  if (!isOutsideZoomRange || !zoomMessage) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">{zoomMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Update the createClassBreaks function accordingly
const createClassBreaks = (breakPoints, labels) => {
  return breakPoints.map((point, index) => ({
    minValue: point.min === undefined ? -Infinity : point.min,
    maxValue: point.max === undefined ? Infinity : point.max,
    symbol: {
      type: "simple-fill",
      color: colorScheme[`level${index + 1}`],
      outline: {
        color: [50, 50, 50, 0.2],
        width: "0.5px",
      },
    },
    label: labels[index],
  }));
};

const initialLayerConfigurations = {
  // Existing heatmap configurations
  // Total Population
  totalPopulation_HEAT: {
    type: "class-breaks",
    field: "TOTPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000, max: 100000 },
        { min: 100000 },
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more",
      ]
    ),
  },

  TOTPOP_FY_HEAT: {
    type: "class-breaks",
    field: "TOTPOP_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000, max: 100000 },
        { min: 100000 },
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more",
      ]
    ),
  },

  // Total Households
  totalHouseholds_HEAT: {
    type: "class-breaks",
    field: "TOTHH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 20000 },
        { min: 20000, max: 40000 },
        { min: 40000 },
      ],
      [
        "Less than 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 - 40,000",
        "40,000 or more",
      ]
    ),
  },

  // Total Housing Units
  totalHousingUnits_HEAT: {
    type: "class-breaks",
    field: "TOTHU_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more",
      ]
    ),
  },

  // Less than 9th Grade Education
  lessThan9thGrade_HEAT: {
    type: "class-breaks",
    field: "NOHS_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20 },
      ],
      [
        "Less than 2%",
        "2% - 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% or more",
      ]
    ),
  },

  // 9-12th Grade/No Diploma
  someHighSchool_HEAT: {
    type: "class-breaks",
    field: "SOMEHS_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 6 },
        { min: 6, max: 9 },
        { min: 9, max: 12 },
        { min: 12, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 3%",
        "3% - 6%",
        "6% - 9%",
        "9% - 12%",
        "12% - 15%",
        "15% or more",
      ]
    ),
  },

  // GED/Alternative Credential
  gedCredential_HEAT: {
    type: "class-breaks",
    field: "GED_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 10 },
        { min: 10 },
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more",
      ]
    ),
  },

  // Home Value $50,000-$99,999
  homesUnder100k_HEAT: {
    type: "class-breaks",
    field: "VAL50K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $100,000-$149,999
  homes100to150k_HEAT: {
    type: "class-breaks",
    field: "VAL100K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $150,000-$199,999
  homes150to200k_HEAT: {
    type: "class-breaks",
    field: "VAL150K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $200,000-$249,999
  homes200to250k_HEAT: {
    type: "class-breaks",
    field: "VAL200K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $250,000-$299,999
  homes250to300k_HEAT: {
    type: "class-breaks",
    field: "VAL250K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $400,000-$499,999
  homes400to500k_HEAT: {
    type: "class-breaks",
    field: "VAL400K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Home Value $1,500,000-$1,999,999
  veryLuxuryHomes_HEAT: {
    type: "class-breaks",
    field: "VAL1PT5MCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 10 homes",
        "10 - 25 homes",
        "25 - 50 homes",
        "50 - 100 homes",
        "100 - 200 homes",
        "200+ homes",
      ]
    ),
  },

  // Population Density - Note: This was included in the initial config but with a different name "density"
  populationDensity_HEAT: {
    type: "class-breaks",
    field: "POPDENS_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 7500 },
        { min: 7500, max: 10000 },
        { min: 10000 },
      ],
      [
        "Less than 1,000/sq mi",
        "1,000 - 2,500/sq mi",
        "2,500 - 5,000/sq mi",
        "5,000 - 7,500/sq mi",
        "7,500 - 10,000/sq mi",
        "10,000+/sq mi",
      ]
    ),
  },

  // Homeownership Rate - This field exists in the config but as a different variable name
  homeownershipRate_HEAT: {
    type: "class-breaks",
    field: "PCTHOMEOWNER",
    classBreakInfos: createClassBreaks(
      [
        { max: 35 },
        { min: 35, max: 50 },
        { min: 50, max: 65 },
        { min: 65, max: 80 },
        { min: 80, max: 90 },
        { min: 90 },
      ],
      [
        "Less than 35%",
        "35% - 50%",
        "50% - 65%",
        "65% - 80%",
        "80% - 90%",
        "90% or more",
      ]
    ),
  },

  income_HEAT: {
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
  growth_HEAT: {
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
  density_HEAT: {
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
  age_HEAT: {
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
  unemployment_HEAT: {
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
  homeValue_HEAT: {
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
  affordability_HEAT: {
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
  MEDHINC_CY_HEAT: {
    type: "class-breaks",
    field: "MEDHINC_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  AVGHINC_CY_HEAT: {
    type: "class-breaks",
    field: "AVGHINC_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC0_CY_HEAT: {
    type: "class-breaks",
    field: "HINC0_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC15_CY_HEAT: {
    type: "class-breaks",
    field: "HINC15_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500000 },
        { min: 2000, max: 5000 },
        { min: 1000, max: 2000 },
        { min: 500, max: 1000 },
        { min: 250, max: 500 },
        { min: 0 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC25_CY_HEAT: {
    type: "class-breaks",
    field: "HINC25_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5000 },
        { min: 2000, max: 5000 },
        { min: 1000, max: 2000 },
        { min: 500, max: 1000 },
        { min: 250, max: 500 },
        { min: 0 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC35_CY_HEAT: {
    type: "class-breaks",
    field: "HINC35_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC50_CY_HEAT: {
    type: "class-breaks",
    field: "HINC50_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC75_CY_HEAT: {
    type: "class-breaks",
    field: "HINC75_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC100_CY_HEAT: {
    type: "class-breaks",
    field: "HINC100_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC150_CY_HEAT: {
    type: "class-breaks",
    field: "HINC150_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },
  HINC200_CY_HEAT: {
    type: "class-breaks",
    field: "HINC200_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 125000 },
        { min: 125000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more",
      ]
    ),
  },

  // Educational attainment
  education_HEAT: {
    type: "class-breaks",
    field: "BACHDEG_PLUS_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 45 },
        { min: 45, max: 55 },
        { min: 55 },
      ],
      [
        "Less than 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 45%",
        "45% - 55%",
        "55% or more",
      ]
    ),
  },

  // Housing occupancy
  ownerOccupied_HEAT: {
    type: "class-breaks",
    field: "PCTHOMEOWNER",
    classBreakInfos: createClassBreaks(
      [
        { max: 30 },
        { min: 30, max: 45 },
        { min: 45, max: 60 },
        { min: 60, max: 75 },
        { min: 75, max: 90 },
        { min: 90 },
      ],
      [
        "Less than 30%",
        "30% - 45%",
        "45% - 60%",
        "60% - 75%",
        "75% - 90%",
        "90% or more",
      ]
    ),
  },

  // Vacancy rate
  vacancy_HEAT: {
    type: "class-breaks",
    field: "VACANT_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% or more",
      ]
    ),
  },

  // Diversity/Demographics
  diversity_HEAT: {
    type: "class-breaks",
    field: "NHSPWHT_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 40 },
        { min: 40, max: 55 },
        { min: 55, max: 70 },
        { min: 70, max: 85 },
        { min: 85, max: 95 },
        { min: 95 },
      ],
      [
        "Less than 40%",
        "40% - 55%",
        "55% - 70%",
        "70% - 85%",
        "85% - 95%",
        "95% or more",
      ]
    ),
  },

  // Hispanic population
  hispanic_HEAT: {
    type: "class-breaks",
    field: "HISPPOP_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 45 },
        { min: 45, max: 60 },
        { min: 60 },
      ],
      [
        "Less than 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 45%",
        "45% - 60%",
        "60% or more",
      ]
    ),
  },

  // Per capita income
  perCapitaIncome_HEAT: {
    type: "class-breaks",
    field: "PCI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25000 },
        { min: 25000, max: 40000 },
        { min: 40000, max: 55000 },
        { min: 55000, max: 70000 },
        { min: 70000, max: 85000 },
        { min: 85000 },
      ],
      [
        "Less than $25,000",
        "$25,000 - $40,000",
        "$40,000 - $55,000",
        "$55,000 - $70,000",
        "$70,000 - $85,000",
        "$85,000 or more",
      ]
    ),
  },

  // Household size
  householdSize_HEAT: {
    type: "class-breaks",
    field: "AVGHHSZ_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2.0 },
        { min: 2.0, max: 2.5 },
        { min: 2.5, max: 3.0 },
        { min: 3.0, max: 3.5 },
        { min: 3.5, max: 4.0 },
        { min: 4.0 },
      ],
      [
        "Less than 2.0",
        "2.0 - 2.5",
        "2.5 - 3.0",
        "3.0 - 3.5",
        "3.5 - 4.0",
        "4.0 or more",
      ]
    ),
  },

  // Future growth projections
  futureGrowth_HEAT: {
    type: "class-breaks",
    field: "POPGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: -1 },
        { min: -1, max: 0 },
        { min: 0, max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3 },
      ],
      [
        "Less than -1%",
        "-1% to 0%",
        "0% to 1%",
        "1% to 2%",
        "2% to 3%",
        "3% or more",
      ]
    ),
  },

  // Generational breakdown
  millennials_HEAT: {
    type: "class-breaks",
    field: "MILLENN_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 45 },
        { min: 45, max: 55 },
        { min: 55 },
      ],
      [
        "Less than 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 45%",
        "45% - 55%",
        "55% or more",
      ]
    ),
  },

  // Wealth Index
  wealth_HEAT: {
    type: "class-breaks",
    field: "WLTHINDXCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 150 },
        { min: 150, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 150",
        "150 - 200",
        "200 or more",
      ]
    ),
  },

  // Socioeconomic Status Index
  socioeconomic_HEAT: {
    type: "class-breaks",
    field: "SEI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 125 },
        { min: 125, max: 150 },
        { min: 150 },
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 150",
        "150 or more",
      ]
    ),
  },
  // Baby Boomer population
  babyBoomers_HEAT: {
    type: "class-breaks",
    field: "BABYBOOMCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more",
      ]
    ),
  },

  // Gen Z population
  genZ_HEAT: {
    type: "class-breaks",
    field: "GENZ_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more",
      ]
    ),
  },

  // Gen X population
  genX_HEAT: {
    type: "class-breaks",
    field: "GENX_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more",
      ]
    ),
  },

  // Children population
  children_HEAT: {
    type: "class-breaks",
    field: "CHILD_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more",
      ]
    ),
  },

  // Senior population
  seniors_HEAT: {
    type: "class-breaks",
    field: "SENIOR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more",
      ]
    ),
  },

  // Working population
  workingAge_HEAT: {
    type: "class-breaks",
    field: "WORKAGE_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 55 },
        { min: 55, max: 60 },
        { min: 60, max: 65 },
        { min: 65, max: 70 },
        { min: 70 },
      ],
      [
        "Less than 50%",
        "50% - 55%",
        "55% - 60%",
        "60% - 65%",
        "65% - 70%",
        "70% or more",
      ]
    ),
  },

  // Asian population
  NHSPASN_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPASN_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 30 },
        { min: 30, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 20%",
        "20% - 30%",
        "30% - 40%",
        "40% or more",
      ]
    ),
  },

  // Black population
  NHSPBLK_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPBLK_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 45 },
        { min: 45, max: 60 },
        { min: 60 },
      ],
      [
        "Less than 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 45%",
        "45% - 60%",
        "60% or more",
      ]
    ),
  },

  // Daytime population
  daytimePopulation_HEAT: {
    type: "class-breaks",
    field: "DPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000, max: 100000 },
        { min: 100000 },
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more",
      ]
    ),
  },

  // Higher education percentage
  highEducation_HEAT: {
    type: "class-breaks",
    field: "GRADDEG_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 30%",
        "30% or more",
      ]
    ),
  },

  // Low educational attainment
  lowEducation_HEAT: {
    type: "class-breaks",
    field: "HSGRAD_LESS_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 30%",
        "30% or more",
      ]
    ),
  },

  // Household income growth projection
  incomeGrowth_HEAT: {
    type: "class-breaks",
    field: "MHIGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3, max: 4 },
        { min: 4, max: 5 },
        { min: 5 },
      ],
      ["Less than 1%", "1% - 2%", "2% - 3%", "3% - 4%", "4% - 5%", "5% or more"]
    ),
  },

  // Future household growth
  householdGrowth_HEAT: {
    type: "class-breaks",
    field: "HHGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 0 },
        { min: 0, max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3, max: 5 },
        { min: 5 },
      ],
      ["Less than 0%", "0% - 1%", "1% - 2%", "2% - 3%", "3% - 5%", "5% or more"]
    ),
  },

  // Mortgage affordability
  mortgagePercent_HEAT: {
    type: "class-breaks",
    field: "INCMORT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more",
      ]
    ),
  },

  // Associate's degree
  associateDegree_HEAT: {
    type: "class-breaks",
    field: "ASSCDEG_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more",
      ]
    ),
  },

  // Bachelor's degree
  bachelorDegree_HEAT: {
    type: "class-breaks",
    field: "BACHDEG_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 30 },
        { min: 30, max: 40 },
        { min: 40, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 10%",
        "10% - 20%",
        "20% - 30%",
        "30% - 40%",
        "40% - 50%",
        "50% or more",
      ]
    ),
  },

  // Some college, no degree
  someCollege_HEAT: {
    type: "class-breaks",
    field: "SMCOLL_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more",
      ]
    ),
  },

  // High school graduates
  highSchoolGrad_HEAT: {
    type: "class-breaks",
    field: "HSGRAD_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more",
      ]
    ),
  },

  // Owner-occupied homes
  ownerHomes_HEAT: {
    type: "class-breaks",
    field: "OWNER_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 or more",
      ]
    ),
  },

  // Renter-occupied homes
  renterHomes_HEAT: {
    type: "class-breaks",
    field: "RENTER_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 or more",
      ]
    ),
  },

  // Average home value
  avgHomeValue_HEAT: {
    type: "class-breaks",
    field: "AVGVAL_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200000 },
        { min: 200000, max: 350000 },
        { min: 350000, max: 500000 },
        { min: 500000, max: 750000 },
        { min: 750000, max: 1000000 },
        { min: 1000000 },
      ],
      [
        "Less than $200,000",
        "$200,000 - $350,000",
        "$350,000 - $500,000",
        "$500,000 - $750,000",
        "$750,000 - $1,000,000",
        "$1,000,000 or more",
      ]
    ),
  },

  // Expensive homes ($1M+)
  luxuryHomes_HEAT: {
    type: "class-breaks",
    field: "VAL1M_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Very expensive homes ($2M+)
  ultraLuxuryHomes_HEAT: {
    type: "class-breaks",
    field: "VAL2M_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250 },
      ],
      [
        "Less than 10 homes",
        "10 - 25 homes",
        "25 - 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250+ homes",
      ]
    ),
  },

  // Entry-level homes (<$250K)
  entryLevelHomes_HEAT: {
    type: "class-breaks",
    field: "VAL0_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes",
      ]
    ),
  },

  // Daytime workers
  daytimeWorkers_HEAT: {
    type: "class-breaks",
    field: "DPOPWRK_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more",
      ]
    ),
  },

  // Young adults (20-34)
  youngAdults_HEAT: {
    type: "class-breaks",
    field: "POP20_CY", // Using 20-24 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% or more",
      ]
    ),
  },

  // Middle-aged adults (35-54)
  middleAged_HEAT: {
    type: "class-breaks",
    field: "POP35_CY", // Using 35-39 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more",
      ]
    ),
  },

  // Pre-retirement (55-64)
  preRetirement_HEAT: {
    type: "class-breaks",
    field: "POP55_CY", // Using 55-59 as a representative, could combine with 60-64
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more",
      ]
    ),
  },

  // Elderly (75+)
  elderly_HEAT: {
    type: "class-breaks",
    field: "POP75_CY", // Using 75-79 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 10 },
        { min: 10 },
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more",
      ]
    ),
  },

  // Silent & Greatest Generations
  oldestGenerations_HEAT: {
    type: "class-breaks",
    field: "OLDRGENSCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 10 },
        { min: 10 },
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more",
      ]
    ),
  },

  // Generation Alpha
  genAlpha_HEAT: {
    type: "class-breaks",
    field: "GENALPHACY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more",
      ]
    ),
  },

  // Mid-range homes ($300-500K)
  midRangeHomes_HEAT: {
    type: "class-breaks",
    field: "VAL300K_CY", // Could combine with VAL400K_CY
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes",
      ]
    ),
  },

  // Upper-middle range homes ($500-750K)
  upperMidHomes_HEAT: {
    type: "class-breaks",
    field: "VAL500K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes",
      ]
    ),
  },

  // High-end homes ($750K-1M)
  highEndHomes_HEAT: {
    type: "class-breaks",
    field: "VAL750K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes",
      ]
    ),
  },

  // Income group: $100K-$150K
  upperMiddleIncome_HEAT: {
    type: "class-breaks",
    field: "HINC100_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000 - 2,000 households",
        "2,000+ households",
      ]
    ),
  },

  // Income group: $150K-$200K
  affluentIncome_HEAT: {
    type: "class-breaks",
    field: "HINC150_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households",
      ]
    ),
  },

  // Income group: $200K+
  wealthyIncome_HEAT: {
    type: "class-breaks",
    field: "HINC200_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households",
      ]
    ),
  },

  // Low income: Less than $25K
  lowIncome_HEAT: {
    type: "class-breaks",
    field: "HINC0_CY", // Could combine with HINC15_CY
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households",
      ]
    ),
  },

  // Moderate income: $25K-$50K
  moderateIncome_HEAT: {
    type: "class-breaks",
    field: "HINC25_CY", // Could combine with HINC35_CY
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000 - 2,000 households",
        "2,000+ households",
      ]
    ),
  },

  // Daytime residents ratio
  daytimeResidentRatio_HEAT: {
    type: "class-breaks",
    field: "DPOPRES_CY", // Would need calculation relative to total population for a meaningful ratio
    classBreakInfos: createClassBreaks(
      [
        { max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 25000 },
        { min: 25000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more",
      ]
    ),
  },

  // New dot density configurations
  TOTPOP_CY: {
    type: "dot-density",
    field: "TOTPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "TOTPOP_CY", color: "#E60049", label: "Total Population" },
    ],
  },
  TOTHH_CY: {
    type: "dot-density",
    field: "TOTHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "TOTHH_CY", color: "#0BB4FF", label: "Total Households" },
    ],
  },
  DPOP_CY: {
    type: "dot-density",
    field: "DPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "DPOP_CY", color: "#50E991", label: "Daytime Population" },
    ],
  },
  DPOPWRK_CY: {
    type: "dot-density",
    field: "DPOPWRK_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "DPOPWRK_CY", color: "#9B19F5", label: "Daytime Workers" },
    ],
  },
  WORKAGE_CY: {
    type: "dot-density",
    field: "WORKAGE_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "WORKAGE_CY",
        color: "#FFB400",
        label: "Working Age Population",
      },
    ],
  },
  SENIOR_CY: {
    type: "dot-density",
    field: "SENIOR_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "SENIOR_CY", color: "#007ED6", label: "Senior Population" },
    ],
  },
  CHILD_CY: {
    type: "dot-density",
    field: "CHILD_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "children" },
    attributes: [
      { field: "CHILD_CY", color: "#FF6B6B", label: "Child Population" },
    ],
  },
  HISPPOP_CY: {
    type: "dot-density",
    field: "HISPPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "HISPPOP_CY", color: "#007ED6", label: "Hispanic Population" },
    ],
  },
  NHSPWHT_CY: {
    type: "dot-density",
    field: "NHSPWHT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPWHT_CY",
        color: "#5954D6",
        label: "White Non-Hispanic Population",
      },
    ],
  },
  NHSPBLK_CY: {
    type: "dot-density",
    field: "NHSPBLK_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPBLK_CY",
        color: "#9B19F5",
        label: "Black Non-Hispanic Population",
      },
    ],
  },
  NHSPASN_CY: {
    type: "dot-density",
    field: "NHSPASN_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPASN_CY",
        color: "#FF6B6B",
        label: "Asian Non-Hispanic Population",
      },
    ],
  },
  NHSPAI_CY: {
    type: "dot-density",
    field: "NHSPAI_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPAI_CY",
        color: "#00C6B7",
        label: "American Indian/Alaska Native Non-Hispanic",
      },
    ],
  },
  EMP_CY: {
    type: "dot-density",
    field: "EMP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMP_CY", color: "#00BA3F", label: "Employed Population" },
    ],
  },
  UNEMP_CY: {
    type: "dot-density",
    field: "UNEMP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "UNEMP_CY", color: "#E60049", label: "Unemployed Population" },
    ],
  },
  OWNER_CY: {
    type: "dot-density",
    field: "OWNER_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "OWNER_CY", color: "#0BB4FF", label: "Owner Occupied Housing" },
    ],
  },
  RENTER_CY: {
    type: "dot-density",
    field: "RENTER_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      {
        field: "RENTER_CY",
        color: "#FFB400",
        label: "Renter Occupied Housing",
      },
    ],
  },
  // Age-specific populations
  POP0_CY: {
    type: "dot-density",
    field: "POP0_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP0_CY", color: "#FF9E8F", label: "Population Age 0-4" },
    ],
  },
  POP5_CY: {
    type: "dot-density",
    field: "POP5_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP5_CY", color: "#FF8E72", label: "Population Age 5-9" },
    ],
  },
  POP10_CY: {
    type: "dot-density",
    field: "POP10_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP10_CY", color: "#FF7E55", label: "Population Age 10-14" },
    ],
  },
  POP15_CY: {
    type: "dot-density",
    field: "POP15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP15_CY", color: "#FF6E38", label: "Population Age 15-19" },
    ],
  },
  POP35_CY: {
    type: "dot-density",
    field: "POP35_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP35_CY", color: "#FFF4B3", label: "Population Age 35-39" },
    ],
  },
  POP40_CY: {
    type: "dot-density",
    field: "POP40_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP40_CY", color: "#B3FFB3", label: "Population Age 40-44" },
    ],
  },
  POP45_CY: {
    type: "dot-density",
    field: "POP45_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP45_CY", color: "#B3D1FF", label: "Population Age 45-49" },
    ],
  },
  POP50_CY: {
    type: "dot-density",
    field: "POP50_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP50_CY", color: "#FFB3E6", label: "Population Age 50-54" },
    ],
  },
  POP55_CY: {
    type: "dot-density",
    field: "POP55_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP55_CY", color: "#FFE6B3", label: "Population Age 55-59" },
    ],
  },
  POP60_CY: {
    type: "dot-density",
    field: "POP60_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP60_CY", color: "#E6FFB3", label: "Population Age 60-64" },
    ],
  },
  POP65_CY: {
    type: "dot-density",
    field: "POP65_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP65_CY", color: "#B3FFE6", label: "Population Age 65-69" },
    ],
  },
  POP70_CY: {
    type: "dot-density",
    field: "POP70_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP70_CY", color: "#B3FFFF", label: "Population Age 70-74" },
    ],
  },
  POP75_CY: {
    type: "dot-density",
    field: "POP75_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP75_CY", color: "#B3B3FF", label: "Population Age 75-79" },
    ],
  },
  POP80_CY: {
    type: "dot-density",
    field: "POP80_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP80_CY", color: "#E6B3FF", label: "Population Age 80-84" },
    ],
  },
  // Generation groups
  GENALPHACY: {
    type: "dot-density",
    field: "GENALPHACY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "GENALPHACY", color: "#FFB400", label: "Generation Alpha" },
    ],
  },
  GENZ_CY: {
    type: "dot-density",
    field: "GENZ_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "GENZ_CY", color: "#FF6B6B", label: "Generation Z" }],
  },
  MILLENN_CY: {
    type: "dot-density",
    field: "MILLENN_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "MILLENN_CY", color: "#4ECDC4", label: "Millennials" },
    ],
  },

  // Educational Attainment
  NOHS_CY: {
    type: "dot-density",
    field: "NOHS_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "NOHS_CY", color: "#FF6B6B", label: "Less than 9th Grade" },
    ],
  },
  SOMEHS_CY: {
    type: "dot-density",
    field: "SOMEHS_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "SOMEHS_CY", color: "#FFB400", label: "Some High School" },
    ],
  },

  // Income Brackets
  HINC0_CY: {
    type: "dot-density",
    field: "HINC0_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC0_CY", color: "#E60049", label: "Income < $15,000" },
    ],
  },
  HINC15_CY: {
    type: "dot-density",
    field: "HINC15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC15_CY", color: "#0BB4FF", label: "Income $15,000-$24,999" },
    ],
  },

  // Home Values
  VAL0_CY: {
    type: "dot-density",
    field: "VAL0_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL0_CY", color: "#50E991", label: "Home Value < $50,000" },
    ],
  },
  VAL50K_CY: {
    type: "dot-density",
    field: "VAL50K_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      {
        field: "VAL50K_CY",
        color: "#9B19F5",
        label: "Home Value $50,000-$99,999",
      },
    ],
  },

  // Labor Force Demographics
  CIVLBFR_CY: {
    type: "dot-density",
    field: "CIVLBFR_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "CIVLBFR_CY", color: "#0BB4FF", label: "Civilian Labor Force" },
    ],
  },

  // Employment by Race
  EMPWHTCY: {
    type: "dot-density",
    field: "EMPWHTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPWHTCY", color: "#E60049", label: "White Employed" },
    ],
  },
  EMPBLKCY: {
    type: "dot-density",
    field: "EMPBLKCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      {
        field: "EMPBLKCY",
        color: "#0BB4FF",
        label: "Black/African American Employed",
      },
    ],
  },

  // Unemployment by Race
  UNWHTCY: {
    type: "dot-density",
    field: "UNWHTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "UNWHTCY", color: "#FFB400", label: "White Unemployed" },
    ],
  },
  UNBLKCY: {
    type: "dot-density",
    field: "UNBLKCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "UNBLKCY",
        color: "#007ED6",
        label: "Black/African American Unemployed",
      },
    ],
  },

  // Labor Force by Age
  CIVLF16_CY: {
    type: "dot-density",
    field: "CIVLF16_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "CIVLF16_CY", color: "#50E991", label: "Labor Force Age 16-24" },
    ],
  },
  CIVLF25_CY: {
    type: "dot-density",
    field: "CIVLF25_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "CIVLF25_CY", color: "#9B19F5", label: "Labor Force Age 25-54" },
    ],
  },

  // Income Tiers
  LOTRHH_CY: {
    type: "dot-density",
    field: "LOTRHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      {
        field: "LOTRHH_CY",
        color: "#FFB400",
        label: "Low Income Tier Households",
      },
    ],
  },
  MDTRHH_CY: {
    type: "dot-density",
    field: "MDTRHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      {
        field: "MDTRHH_CY",
        color: "#007ED6",
        label: "Middle Income Tier Households",
      },
    ],
  },
  // Additional dot density configurations to add to initialLayerConfigurations

  // Additional Population Demographics
  DPOPRES_CY: {
    type: "dot-density",
    field: "DPOPRES_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "DPOPRES_CY", color: "#36A2EB", label: "Daytime Residents" },
    ],
  },
  MALES_CY: {
    type: "dot-density",
    field: "MALES_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "MALES_CY", color: "#4BC0C0", label: "Male Population" },
    ],
  },
  FEMALES_CY: {
    type: "dot-density",
    field: "FEMALES_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "FEMALES_CY", color: "#FF6384", label: "Female Population" },
    ],
  },

  // Additional Education
  HSGRAD_CY: {
    type: "dot-density",
    field: "HSGRAD_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "HSGRAD_CY", color: "#97BBCD", label: "High School Graduates" },
    ],
  },
  GED_CY: {
    type: "dot-density",
    field: "GED_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "GED_CY",
        color: "#B2D8B2",
        label: "GED/Alternative Credential",
      },
    ],
  },
  SMCOLL_CY: {
    type: "dot-density",
    field: "SMCOLL_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "SMCOLL_CY", color: "#FFC3A0", label: "Some College" },
    ],
  },
  ASSCDEG_CY: {
    type: "dot-density",
    field: "ASSCDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "ASSCDEG_CY", color: "#A0CED9", label: "Associate's Degree" },
    ],
  },
  BACHDEG_CY: {
    type: "dot-density",
    field: "BACHDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "BACHDEG_CY", color: "#ADB9E3", label: "Bachelor's Degree" },
    ],
  },
  GRADDEG_CY: {
    type: "dot-density",
    field: "GRADDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "GRADDEG_CY",
        color: "#B5A8E3",
        label: "Graduate/Professional Degree",
      },
    ],
  },

  // Additional Race/Ethnicity
  NHSPPI_CY: {
    type: "dot-density",
    field: "NHSPPI_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPPI_CY",
        color: "#FF9F40",
        label: "Pacific Islander Non-Hispanic",
      },
    ],
  },
  NHSPOTH_CY: {
    type: "dot-density",
    field: "NHSPOTH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPOTH_CY",
        color: "#FFD700",
        label: "Other Race Non-Hispanic",
      },
    ],
  },
  NHSPMLT_CY: {
    type: "dot-density",
    field: "NHSPMLT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "NHSPMLT_CY",
        color: "#C39BD3",
        label: "Multiple Races Non-Hispanic",
      },
    ],
  },

  // Additional Employment
  EMPAICY: {
    type: "dot-density",
    field: "EMPAICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      {
        field: "EMPAICY",
        color: "#85C1E9",
        label: "American Indian/Alaska Native Employed",
      },
    ],
  },
  EMPASNCY: {
    type: "dot-density",
    field: "EMPASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPASNCY", color: "#82E0AA", label: "Asian Employed" },
    ],
  },
  EMPPICY: {
    type: "dot-density",
    field: "EMPPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      {
        field: "EMPPICY",
        color: "#F8C471",
        label: "Pacific Islander Employed",
      },
    ],
  },
  EMPOTHCY: {
    type: "dot-density",
    field: "EMPOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPOTHCY", color: "#E59866", label: "Other Race Employed" },
    ],
  },
  EMPMLTCY: {
    type: "dot-density",
    field: "EMPMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPMLTCY", color: "#BB8FCE", label: "Multiple Races Employed" },
    ],
  },

  // Additional Housing
  TOTHU_CY: {
    type: "dot-density",
    field: "TOTHU_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "TOTHU_CY", color: "#F7DC6F", label: "Total Housing Units" },
    ],
  },
  VACANT_CY: {
    type: "dot-density",
    field: "VACANT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VACANT_CY", color: "#EC7063", label: "Vacant Housing Units" },
    ],
  },

  // Upper Income Tier (missing from original)
  UPTRHH_CY: {
    type: "dot-density",
    field: "UPTRHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      {
        field: "UPTRHH_CY",
        color: "#5D4037",
        label: "Upper Income Tier Households",
      },
    ],
  },

  // Additional Age-specific populations (20-85+)
  POP20_CY: {
    type: "dot-density",
    field: "POP20_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP20_CY", color: "#FF5E3A", label: "Population Age 20-24" },
    ],
  },
  // Additional missing configurations to add

  // Remaining Age Groups
  POP25_CY: {
    type: "dot-density",
    field: "POP25_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP25_CY", color: "#FF4E50", label: "Population Age 25-29" },
    ],
  },
  POP30_CY: {
    type: "dot-density",
    field: "POP30_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP30_CY", color: "#FC913A", label: "Population Age 30-34" },
    ],
  },
  // Continue through age groups...
  POP85_CY: {
    type: "dot-density",
    field: "POP85_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP85_CY", color: "#99B898", label: "Population Age 85+" },
    ],
  },

  // Additional Generations
  BABYBOOMCY: {
    type: "dot-density",
    field: "BABYBOOMCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "BABYBOOMCY",
        color: "#E84A5F",
        label: "Baby Boomer Population",
      },
    ],
  },
  OLDRGENSCY: {
    type: "dot-density",
    field: "OLDRGENSCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "OLDRGENSCY",
        color: "#355C7D",
        label: "Silent & Greatest Generations",
      },
    ],
  },

  // Additional Labor Force by Age
  EMPAGE16CY: {
    type: "dot-density",
    field: "EMPAGE16CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPAGE16CY", color: "#A8E6CF", label: "Employed Age 16-24" },
    ],
  },
  EMPAGE25CY: {
    type: "dot-density",
    field: "EMPAGE25CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPAGE25CY", color: "#FFD3B6", label: "Employed Age 25-54" },
    ],
  },
  EMPAGE55CY: {
    type: "dot-density",
    field: "EMPAGE55CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPAGE55CY", color: "#FFAAA5", label: "Employed Age 55-64" },
    ],
  },
  EMPAGE65CY: {
    type: "dot-density",
    field: "EMPAGE65CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "EMPAGE65CY", color: "#98DDCA", label: "Employed Age 65+" },
    ],
  },

  // Disposable Income Brackets
  DI0_CY: {
    type: "dot-density",
    field: "DI0_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      {
        field: "DI0_CY",
        color: "#FF9A8B",
        label: "Disposable Income < $15,000",
      },
    ],
  },
  DI15_CY: {
    type: "dot-density",
    field: "DI15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      {
        field: "DI15_CY",
        color: "#FFB8B1",
        label: "Disposable Income $15,000-$24,999",
      },
    ],
  },
  // Additional Unemployed by Race
  UNAICY: {
    type: "dot-density",
    field: "UNAICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "UNAICY",
        color: "#FFB7B2",
        label: "American Indian/Alaska Native Unemployed",
      },
    ],
  },
  UNASNCY: {
    type: "dot-density",
    field: "UNASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "UNASNCY", color: "#FFDAC1", label: "Asian Unemployed" },
    ],
  },
  UNPICY: {
    type: "dot-density",
    field: "UNPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "UNPICY",
        color: "#E2F0CB",
        label: "Pacific Islander Unemployed",
      },
    ],
  },
  UNOTHCY: {
    type: "dot-density",
    field: "UNOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "UNOTHCY", color: "#B5EAD7", label: "Other Race Unemployed" },
    ],
  },
  UNMLTCY: {
    type: "dot-density",
    field: "UNMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "UNMLTCY",
        color: "#C7CEEA",
        label: "Multiple Races Unemployed",
      },
    ],
  },

  // Additional Labor Force by Race
  CIVLFAICY: {
    type: "dot-density",
    field: "CIVLFAICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "CIVLFAICY",
        color: "#E5989B",
        label: "American Indian/Alaska Native Labor Force",
      },
    ],
  },
  CIVLFASNCY: {
    type: "dot-density",
    field: "CIVLFASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "CIVLFASNCY", color: "#B5838D", label: "Asian Labor Force" },
    ],
  },
  CIVLFPICY: {
    type: "dot-density",
    field: "CIVLFPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "CIVLFPICY",
        color: "#6D6875",
        label: "Pacific Islander Labor Force",
      },
    ],
  },
  CIVLFOTHCY: {
    type: "dot-density",
    field: "CIVLFOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "CIVLFOTHCY",
        color: "#A4C3B2",
        label: "Other Race Labor Force",
      },
    ],
  },
  CIVLFMLTCY: {
    type: "dot-density",
    field: "CIVLFMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      {
        field: "CIVLFMLTCY",
        color: "#EAF4D3",
        label: "Multiple Races Labor Force",
      },
    ],
  },
};

const visualizationOptions = [
  // Original Heat Map Options
  {
    value: "income_HEAT",
    label: "Median Household Income (Heat)",
    type: "class-breaks",
  },
  {
    value: "growth_HEAT",
    label: "Household Growth Rate (Heat)",
    type: "class-breaks",
  },
  {
    value: "affordability_HEAT",
    label: "Housing Affordability Index (Heat)",
    type: "class-breaks",
  },
  {
    value: "density_HEAT",
    label: "Population Density (Heat)",
    type: "class-breaks",
  },
  { value: "age_HEAT", label: "Median Age (Heat)", type: "class-breaks" },
  {
    value: "unemployment_HEAT",
    label: "Unemployment Rate (Heat)",
    type: "class-breaks",
  },
  {
    value: "homeValue_HEAT",
    label: "Median Home Value (Heat)",
    type: "class-breaks",
  },

  // Income Heat Maps
  {
    value: "MEDHINC_CY_HEAT",
    label: "Median Household Income (Heat)",
    type: "class-breaks",
  },
  {
    value: "AVGHINC_CY_HEAT",
    label: "Average Household Income (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC0_CY_HEAT",
    label: "Household Income < $15K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC15_CY_HEAT",
    label: "Household Income $15K-$25K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC25_CY_HEAT",
    label: "Household Income $25K-$35K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC35_CY_HEAT",
    label: "Household Income $35K-$50K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC50_CY_HEAT",
    label: "Household Income $50K-$75K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC75_CY_HEAT",
    label: "Household Income $75K-$100K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC100_CY_HEAT",
    label: "Household Income $100K-$150K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC150_CY_HEAT",
    label: "Household Income $150K-$200K (Heat)",
    type: "class-breaks",
  },
  {
    value: "HINC200_CY_HEAT",
    label: "Household Income $200K+ (Heat)",
    type: "class-breaks",
  },

  // Dot Density Population Demographics
  {
    value: "TOTPOP_CY",
    label: "Total Population 2024 (Dot)",
    type: "dot-density",
  },
  {
    value: "TOTHH_CY",
    label: "Total Households 2024 (Dot)",
    type: "dot-density",
  },
  {
    value: "DPOP_CY",
    label: "Daytime Population 2024 (Dot)",
    type: "dot-density",
  },
  {
    value: "DPOPWRK_CY",
    label: "Daytime Workers 2024 (Dot)",
    type: "dot-density",
  },
  {
    value: "WORKAGE_CY",
    label: "Working Age Population 18-64 (Dot)",
    type: "dot-density",
  },
  {
    value: "SENIOR_CY",
    label: "Senior Population 65+ (Dot)",
    type: "dot-density",
  },
  {
    value: "CHILD_CY",
    label: "Child Population <18 (Dot)",
    type: "dot-density",
  },

  // Detailed Age Groups (Dot)
  { value: "POP0_CY", label: "Population Age 0-4 (Dot)", type: "dot-density" },
  { value: "POP5_CY", label: "Population Age 5-9 (Dot)", type: "dot-density" },
  {
    value: "POP10_CY",
    label: "Population Age 10-14 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP15_CY",
    label: "Population Age 15-19 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP20_CY",
    label: "Population Age 20-24 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP25_CY",
    label: "Population Age 25-29 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP30_CY",
    label: "Population Age 30-34 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP35_CY",
    label: "Population Age 35-39 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP40_CY",
    label: "Population Age 40-44 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP45_CY",
    label: "Population Age 45-49 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP50_CY",
    label: "Population Age 50-54 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP55_CY",
    label: "Population Age 55-59 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP60_CY",
    label: "Population Age 60-64 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP65_CY",
    label: "Population Age 65-69 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP70_CY",
    label: "Population Age 70-74 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP75_CY",
    label: "Population Age 75-79 (Dot)",
    type: "dot-density",
  },
  {
    value: "POP80_CY",
    label: "Population Age 80-84 (Dot)",
    type: "dot-density",
  },
  { value: "POP85_CY", label: "Population Age 85+ (Dot)", type: "dot-density" },

  // Generations (Dot)
  {
    value: "GENALPHACY",
    label: "Generation Alpha (Born 2017+) (Dot)",
    type: "dot-density",
  },
  {
    value: "GENZ_CY",
    label: "Generation Z (Born 1999-2016) (Dot)",
    type: "dot-density",
  },
  {
    value: "MILLENN_CY",
    label: "Millennials (Born 1981-1998) (Dot)",
    type: "dot-density",
  },
  {
    value: "GENX_CY",
    label: "Generation X (Born 1965-1980) (Dot)",
    type: "dot-density",
  },
  {
    value: "BABYBOOMCY",
    label: "Baby Boomers (Born 1946-1964) (Dot)",
    type: "dot-density",
  },
  {
    value: "OLDRGENSCY",
    label: "Silent & Greatest Gens (Born pre-1946) (Dot)",
    type: "dot-density",
  },

  // Race and Ethnicity Percentages (Heat)
  {
    value: "hispanic_HEAT",
    label: "Hispanic Population Percentage (Heat)",
    type: "class-breaks",
  },
  {
    value: "diversity_HEAT",
    label: "White Non-Hispanic Percentage (Heat)",
    type: "class-breaks",
  },
  {
    value: "NHSPBLK_CY_PCT_HEAT",
    label: "Black Non-Hispanic Percentage (Heat)",
    type: "class-breaks",
  },
  {
    value: "NHSPASN_CY_PCT_HEAT",
    label: "Asian Non-Hispanic Percentage (Heat)",
    type: "class-breaks",
  },

  // Race and Ethnicity (Dot)
  {
    value: "HISPPOP_CY",
    label: "Hispanic Population (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPWHT_CY",
    label: "White Non-Hispanic Population (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPBLK_CY",
    label: "Black Non-Hispanic Population (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPASN_CY",
    label: "Asian Non-Hispanic Population (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPAI_CY",
    label: "American Indian/Alaska Native Non-Hispanic (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPPI_CY",
    label: "Pacific Islander Non-Hispanic (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPOTH_CY",
    label: "Other Race Non-Hispanic (Dot)",
    type: "dot-density",
  },
  {
    value: "NHSPMLT_CY",
    label: "Multiple Races Non-Hispanic (Dot)",
    type: "dot-density",
  },

  // Education (Dot)
  {
    value: "NOHS_CY",
    label: "Less than 9th Grade Education (Dot)",
    type: "dot-density",
  },
  { value: "SOMEHS_CY", label: "Some High School (Dot)", type: "dot-density" },
  {
    value: "HSGRAD_CY",
    label: "High School Graduates (Dot)",
    type: "dot-density",
  },
  {
    value: "GED_CY",
    label: "GED/Alternative Credential (Dot)",
    type: "dot-density",
  },
  { value: "SMCOLL_CY", label: "Some College (Dot)", type: "dot-density" },
  {
    value: "ASSCDEG_CY",
    label: "Associate's Degree (Dot)",
    type: "dot-density",
  },
  {
    value: "BACHDEG_CY",
    label: "Bachelor's Degree (Dot)",
    type: "dot-density",
  },
  {
    value: "GRADDEG_CY",
    label: "Graduate/Professional Degree (Dot)",
    type: "dot-density",
  },

  // Education Percentages (Heat)
  {
    value: "HSGRAD_LESS_CY_PCT_HEAT",
    label: "Less than High School Percentage (Heat)",
    type: "class-breaks",
  },
  {
    value: "BACHDEG_PLUS_CY_PCT_HEAT",
    label: "Bachelor's Degree or Higher Percentage (Heat)",
    type: "class-breaks",
  },

  // Home Values (Dot)
  {
    value: "VAL0_CY",
    label: "Home Value < $50,000 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL50K_CY",
    label: "Home Value $50K-$99,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL100K_CY",
    label: "Home Value $100K-$149,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL150K_CY",
    label: "Home Value $150K-$199,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL200K_CY",
    label: "Home Value $200K-$249,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL250K_CY",
    label: "Home Value $250K-$299,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL300K_CY",
    label: "Home Value $300K-$399,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL400K_CY",
    label: "Home Value $400K-$499,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL500K_CY",
    label: "Home Value $500K-$749,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL750K_CY",
    label: "Home Value $750K-$999,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL1M_CY",
    label: "Home Value $1M-$1.5M (Dot)",
    type: "dot-density",
  },
  {
    value: "VAL1PT5MCY",
    label: "Home Value $1.5M-$2M (Dot)",
    type: "dot-density",
  },
  { value: "VAL2M_CY", label: "Home Value $2M+ (Dot)", type: "dot-density" },

  // Home Values (Heat)
  {
    value: "MEDVAL_CY_HEAT",
    label: "Median Home Value (Heat)",
    type: "class-breaks",
  },
  {
    value: "AVGVAL_CY_HEAT",
    label: "Average Home Value (Heat)",
    type: "class-breaks",
  },

  // Housing (Dot)
  {
    value: "OWNER_CY",
    label: "Owner Occupied Housing Units (Dot)",
    type: "dot-density",
  },
  {
    value: "RENTER_CY",
    label: "Renter Occupied Housing Units (Dot)",
    type: "dot-density",
  },
  {
    value: "TOTHU_CY",
    label: "Total Housing Units (Dot)",
    type: "dot-density",
  },
  {
    value: "VACANT_CY",
    label: "Vacant Housing Units (Dot)",
    type: "dot-density",
  },

  // Housing (Heat)
  {
    value: "PCTHOMEOWNER_HEAT",
    label: "Homeownership Rate (Heat)",
    type: "class-breaks",
  },
  {
    value: "VACANT_CY_PCT_HEAT",
    label: "Vacancy Rate (Heat)",
    type: "class-breaks",
  },

  // Income Brackets (Dot)
  {
    value: "HINC0_CY",
    label: "Households < $15,000 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC15_CY",
    label: "Households $15,000-$24,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC25_CY",
    label: "Households $25,000-$34,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC35_CY",
    label: "Households $35,000-$49,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC50_CY",
    label: "Households $50,000-$74,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC75_CY",
    label: "Households $75,000-$99,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC100_CY",
    label: "Households $100,000-$149,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC150_CY",
    label: "Households $150,000-$199,999 (Dot)",
    type: "dot-density",
  },
  {
    value: "HINC200_CY",
    label: "Households $200,000+ (Dot)",
    type: "dot-density",
  },

  // Additional Metrics
  {
    value: "POPGRWCYFY_HEAT",
    label: "Population Growth Rate 2024-2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "HHGRWCYFY_HEAT",
    label: "Household Growth Rate 2024-2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "MHIGRWCYFY_HEAT",
    label: "Median Household Income Growth Rate 2024-2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "POPGRW20CY",
    label: "Population Growth Rate 2020-2024 (Heat)",
    type: "class-breaks",
  },
  {
    value: "HHGRW20CY_HEAT",
    label: "Household Growth Rate 2020-2024 (Heat)",
    type: "class-breaks",
  },

  // Economic Indicators (Heat)
  {
    value: "UNEMPRT_CY_HEAT",
    label: "Unemployment Rate (Heat)",
    type: "class-breaks",
  },
  {
    value: "HAI_CY_HEAT",
    label: "Housing Affordability Index (Heat)",
    type: "class-breaks",
  },
  {
    value: "INCMORT_CY_HEAT",
    label: "Percent of Income for Mortgage (Heat)",
    type: "class-breaks",
  },
  {
    value: "WLTHINDXCY_HEAT",
    label: "Wealth Index (Heat)",
    type: "class-breaks",
  },
  {
    value: "SEI_CY_HEAT",
    label: "Socioeconomic Status Index (Heat)",
    type: "class-breaks",
  },
  {
    value: "PCI_CY_HEAT",
    label: "Per Capita Income (Heat)",
    type: "class-breaks",
  },

  // Future Projections (Heat)
  {
    value: "TOTPOP_FY_HEAT",
    label: "Projected Total Population 2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "TOTHH_FY_HEAT",
    label: "Projected Total Households 2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "MEDHINC_FY_HEAT",
    label: "Projected Median Household Income 2029 (Heat)",
    type: "class-breaks",
  },
  {
    value: "POPDENS_FY_HEAT",
    label: "Projected Population Density 2029 (Heat)",
    type: "class-breaks",
  },

  // Demographic Composition (Dot)
  { value: "MALES_CY", label: "Male Population (Dot)", type: "dot-density" },
  {
    value: "FEMALES_CY",
    label: "Female Population (Dot)",
    type: "dot-density",
  },

  // Advanced Demographic Categories (Dot)
  {
    value: "EMPAGE16CY",
    label: "Employed Population Age 16-24 (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPAGE25CY",
    label: "Employed Population Age 25-54 (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPAGE55CY",
    label: "Employed Population Age 55-64 (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPAGE65CY",
    label: "Employed Population 65+ (Dot)",
    type: "dot-density",
  },

  // Employment and Labor (Dot)
  { value: "EMP_CY", label: "Employed Population (Dot)", type: "dot-density" },
  {
    value: "UNEMP_CY",
    label: "Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "CIVLBFR_CY",
    label: "Civilian Labor Force (Dot)",
    type: "dot-density",
  },

  // Detailed Race and Employment (Dot)
  {
    value: "EMPWHTCY",
    label: "White Employed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPBLKCY",
    label: "Black Employed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPASNCY",
    label: "Asian Employed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPAICY",
    label: "American Indian/Alaska Native Employed (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPPICY",
    label: "Pacific Islander Employed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPOTHCY",
    label: "Other Race Employed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "EMPMLTCY",
    label: "Multiple Races Employed Population (Dot)",
    type: "dot-density",
  },

  // Unemployed by Race (Dot)
  {
    value: "UNWHTCY",
    label: "White Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "UNBLKCY",
    label: "Black Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "UNASNCY",
    label: "Asian Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "UNAICY",
    label: "American Indian/Alaska Native Unemployed (Dot)",
    type: "dot-density",
  },
  {
    value: "UNPICY",
    label: "Pacific Islander Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "UNOTHCY",
    label: "Other Race Unemployed Population (Dot)",
    type: "dot-density",
  },
  {
    value: "UNMLTCY",
    label: "Multiple Races Unemployed Population (Dot)",
    type: "dot-density",
  },
];
// Modified createCompLayer function
// Inside Map.jsx - Modify createCompLayer

const createCompLayer = (config) => {
  // Add a log to see the exact config received
  console.log("[createCompLayer] Received config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v)); // Log received config

  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Comparison Map Layer",
    listMode: "show"
  });

  // --- Corrected Extraction ---
  const data = config?.customData?.data || []; // Get the actual data array
  const nameColumn = config?.nameColumn;
  const valueColumn = config?.valueColumn; // Get valueColumn directly
  const latitudeColumn = config?.latitudeColumn;
  const longitudeColumn = config?.longitudeColumn;
  const symbol = config?.symbol || {};
  const classBreakInfos = config?.classBreakInfos || [];
  // Prioritize rendererType from config, THEN calculate default
  const rendererType = config?.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
  const valueFormat = config?.valueFormat; // Get formatting info
  // --- End Corrected Extraction ---


  // Force numeric type for size to prevent string values
  const symbolSize = symbol.size !== undefined ? Number(symbol.size) : 12;
  const defaultColor = symbol.color || "#800080"; // Default purple for comp
  const outlineColor = symbol.outline?.color || "#FFFFFF";
  const outlineWidth = symbol.outline?.width !== undefined ?
    Number(symbol.outline.width) : 1;
  const pointStyle = symbol.style || "circle";

  // Log comprehensive symbol properties AND crucial config values
  console.log("[createCompLayer] Using effective properties:", {
    size: symbolSize,
    defaultColor: defaultColor,
    style: pointStyle,
    outlineColor: outlineColor,
    outlineWidth: outlineWidth,
    rendererType: rendererType, // Log the *effective* rendererType
    hasBreaks: classBreakInfos.length > 0,
    valueColumn: valueColumn, // Log the *effective* valueColumn
    numDataPoints: data.length
  });

  // Helper function to determine point color based on class breaks
  const getColorForValue = (value) => {
    // If no value, value column missing, no breaks, or not classBreaks type - use default color
    if (value === undefined || value === null || value === '' ||
        !valueColumn || // Check if valueColumn NAME is missing
        !classBreakInfos || classBreakInfos.length === 0 ||
        rendererType !== 'classBreaks') { // CRITICAL: Check effective rendererType
      // console.log(`[getColorForValue] Using default color. Value: ${value}, ValueCol: ${valueColumn}, Breaks: ${classBreakInfos?.length}, Renderer: ${rendererType}`);
      return defaultColor;
    }

    // Convert value to number
    const numValue = Number(value);
    if (isNaN(numValue)) {
      console.warn(`[getColorForValue] Value "${value}" cannot be converted to a number for column "${valueColumn}". Using default color.`);
      return defaultColor;
    }

    // Find the appropriate break
    for (const breakInfo of classBreakInfos) {
       // Handle potential Infinity in maxValue for the last break
       const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined || breakInfo.maxValue === null)
                      ? Infinity
                      : Number(breakInfo.maxValue);
       const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined || breakInfo.minValue === null)
                      ? -Infinity
                      : Number(breakInfo.minValue);

       // Check if numValue falls within the break range (inclusive)
       // Handle first break (no min), last break (no max/infinity), and middle breaks
       const isMinMet = (minVal === -Infinity || numValue >= minVal);
       const isMaxMet = (maxVal === Infinity || numValue <= maxVal);

       if (isMinMet && isMaxMet) {
        // console.log(`[getColorForValue] Value ${numValue} matches break [${minVal}-${maxVal}]. Color: ${breakInfo.symbol?.color}`);
        return breakInfo.symbol?.color || defaultColor; // Return break color or default if symbol/color missing
      }
    }

    // If no matching break found, use default
    console.warn(`[getColorForValue] Value ${numValue} did not match any class breaks. Using default color.`);
    return defaultColor;
  };

  // Check if we have the necessary data
  if (Array.isArray(data) && data.length > 0 && // Check the extracted 'data' array
      latitudeColumn && longitudeColumn) {

    // Create graphics for each data point
    data.forEach((item, index) => { // Iterate over the extracted 'data' array
      // Skip if missing coordinates
      if (!item[latitudeColumn] || !item[longitudeColumn]) return;

      const lat = parseFloat(item[latitudeColumn]);
      const lon = parseFloat(item[longitudeColumn]);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lon)) return;

      // Get the value for this point (if using class breaks)
      const pointValue = valueColumn ? item[valueColumn] : null; // Use effective valueColumn
      // Determine the color based on the value and class breaks
      const pointColor = getColorForValue(pointValue); // Call the helper

      // Create the point geometry
      const point = new Point({
        longitude: lon,
        latitude: lat,
        spatialReference: { wkid: 4326 }
      });

      // Create the symbol with the specified styling
      const pointSymbol = new SimpleMarkerSymbol({
        style: pointStyle,
        size: symbolSize,
        color: new Color(pointColor), // Use determined color
        outline: {
          color: new Color(outlineColor),
          width: outlineWidth
        }
      });

      // Create the graphic with attributes
      const graphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          ...item,
          OBJECTID: index,
          displayValue: pointValue, // Value used for classification
          displayName: item[nameColumn] || `Point ${index + 1}`
        },
        popupTemplate: new PopupTemplate({
          title: "{displayName}",
          content: valueColumn ? [ // Only show value field if valueColumn is defined
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "displayValue", // Use the unified displayValue attribute
                  label: valueColumn || "Value", // Use the actual column name as label
                  format: valueFormat ? { // Apply formatting if available
                    digitSeparator: true,
                    places: valueFormat.decimals ?? 0,
                    prefix: valueFormat.prefix || '',
                    suffix: valueFormat.suffix || ''
                  } : { digitSeparator: true, places: 2 } // Default format
                }
              ]
            }
          ] : [{ type: "text", text: "No value column selected for display."}] // Fallback if no value column
        })
      });

      // Add the graphic to the layer
      graphicsLayer.add(graphic);
    });

    console.log(`[createCompLayer] Added ${graphicsLayer.graphics.length} points to comp layer "${graphicsLayer.title}".`);
  } else {
    console.warn("[createCompLayer] Missing required data for comp layer: customData array, latitudeColumn, or longitudeColumn");
  }

  return graphicsLayer;
};

const createPipeLayer = (config) => {
  console.log("Creating Pipe Layer with config:", config);
  
  // Early validation check - quit if critical data is missing
  if (!config || !config.customData || !Array.isArray(config.customData.data) || 
      config.customData.data.length === 0 || !config.latitudeColumn || !config.longitudeColumn) {
    console.warn("Missing required data for pipeline layer: customData, latitudeColumn, or longitudeColumn");
    // Return a valid but empty layer instead of null to avoid errors
    return new GraphicsLayer({
      title: config?.title || "Pipeline Map Layer (Empty)",
      listMode: "show"
    });
  }
  
  // Create the graphics layer
  const graphicsLayer = new GraphicsLayer({
    title: config?.title || "Pipeline Map Layer",
    listMode: "show"
  });
  
  // Extract needed configuration
  const { 
    customData, 
    nameColumn, 
    statusColumn, 
    valueColumn,  // Add support for numeric value column
    latitudeColumn, 
    longitudeColumn,
    symbol = {},
    statusColors = {},
    classBreakInfos = [],
    rendererType = classBreakInfos.length > 0 ? 'classBreaks' : (statusColumn ? 'uniqueValue' : 'simple')
  } = config;
  
  // Define default symbol properties
  const defaultSymbol = {
    type: "simple-marker",
    style: "circle",
    size: 12,
    color: "#FFA500", // Orange default for pipe
    outline: {
      color: "#FFFFFF",
      width: 1
    }
  };
  
  // Force numeric type for size to prevent string values
  const symbolSize = symbol.size !== undefined ? Number(symbol.size) : defaultSymbol.size;
  
  // Create a complete symbol object with proper type handling
  const completeSymbol = {
    type: symbol.type || defaultSymbol.type,
    style: symbol.style || defaultSymbol.style,
    size: symbolSize,
    color: symbol.color || defaultSymbol.color,
    outline: {
      color: symbol.outline?.color || defaultSymbol.outline.color,
      width: symbol.outline?.width !== undefined ? 
        Number(symbol.outline.width) : defaultSymbol.outline.width
    }
  };
  
  // Log the symbol properties we're using for debugging
  console.log("Using pipe symbol properties:", {
    size: completeSymbol.size,
    color: completeSymbol.color,
    style: completeSymbol.style,
    outlineColor: completeSymbol.outline.color,
    outlineWidth: completeSymbol.outline.width,
    rendererType: rendererType,
    hasValueColumn: !!valueColumn,
    hasStatusColumn: !!statusColumn,
    hasBreaks: classBreakInfos.length > 0
  });
  
  // Status color mapping with defaults
  const defaultStatusColors = {
    "In Progress": "#FFB900",
    "Approved": "#107C10",
    "Pending": "#0078D4",
    "Completed": "#107C10",
    "Rejected": "#D13438",
    "default": completeSymbol.color // Use the main color as default
  };
  
  // Merge default status colors with provided ones
  const mergedStatusColors = {
    ...defaultStatusColors,
    ...statusColors
  };
  
  // Helper function to determine point color based on class breaks
  const getColorForValue = (value) => {
    // If no value, value column, or class breaks - use default color
    if (value === undefined || value === null || 
        !valueColumn || 
        !classBreakInfos || classBreakInfos.length === 0 || 
        rendererType !== 'classBreaks') {
      return completeSymbol.color;
    }
    
    // Convert value to number
    const numValue = Number(value);
    if (isNaN(numValue)) {
      console.warn(`Value "${value}" cannot be converted to a number. Using default color.`);
      return completeSymbol.color;
    }
    
    // Find the appropriate break
    for (const breakInfo of classBreakInfos) {
      if ((breakInfo.minValue === undefined || numValue >= breakInfo.minValue) && 
          (breakInfo.maxValue === undefined || numValue <= breakInfo.maxValue)) {
        return breakInfo.symbol?.color || completeSymbol.color;
      }
    }
    
    // If no matching break found, use default
    return completeSymbol.color;
  };
  
  try {
    // Extract the data array correctly
    const dataArray = customData.data || customData;
    
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn("Pipeline layer has no valid data points");
      return graphicsLayer; // Return empty layer
    }
    
    // Debug data
    console.log(`Processing ${dataArray.length} pipeline data points with columns:`, {
      name: nameColumn,
      lat: latitudeColumn,
      lon: longitudeColumn,
      status: statusColumn,
      value: valueColumn
    });
    
    // Create graphics for each data point
    let addedCount = 0;
    let skippedCount = 0;
    const graphicsToAdd = [];
    
    dataArray.forEach((item, index) => {
      // Skip if missing coordinates
      if (!item[latitudeColumn] || !item[longitudeColumn]) {
        skippedCount++;
        return;
      }
      
      const lat = parseFloat(item[latitudeColumn]);
      const lon = parseFloat(item[longitudeColumn]);
      
      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lon)) {
        skippedCount++;
        return;
      }
      
      // Determine point color based on rendering type
      let pointColor = completeSymbol.color; // Default
      
      if (rendererType === 'classBreaks' && valueColumn) {
        // Class breaks based on numeric value
        const pointValue = item[valueColumn];
        pointColor = getColorForValue(pointValue);
      } 
      else if (rendererType === 'uniqueValue' || rendererType === 'uniqueValueOrSimple') {
        // Status-based coloring
        const status = item[statusColumn] || "default";
        pointColor = mergedStatusColors[status] || mergedStatusColors.default;
      }
      
      try {
        // Create the point geometry
        const point = new Point({
          longitude: lon,
          latitude: lat,
          spatialReference: { wkid: 4326 }
        });
        
        // Create the symbol with status-based color and explicit properties
        const pointSymbol = new SimpleMarkerSymbol({
          style: completeSymbol.style,
          size: completeSymbol.size,
          color: new Color(pointColor),
          outline: {
            color: new Color(completeSymbol.outline.color),
            width: completeSymbol.outline.width
          }
        });
        
        // Create content for popup based on available columns
        const fieldInfos = [];
        
        if (statusColumn && item[statusColumn]) {
          fieldInfos.push({ fieldName: "status", label: statusColumn || "Status" });
        }
        
        if (valueColumn && item[valueColumn] !== undefined) {
          fieldInfos.push({ 
            fieldName: "value", 
            label: valueColumn || "Value",
            format: config.valueFormat ? {
              digitSeparator: true,
              places: config.valueFormat.decimals || 0,
              prefix: config.valueFormat.prefix || '',
              suffix: config.valueFormat.suffix || ''
            } : null
          });
        }
        
        // Create the graphic with attributes
        const graphic = new Graphic({
          geometry: point,
          symbol: pointSymbol,
          attributes: {
            ...item,
            OBJECTID: index,
            displayName: item[nameColumn] || `Point ${index + 1}`,
            status: item[statusColumn] || "Unknown",
            value: valueColumn ? item[valueColumn] : null
          },
          popupTemplate: new PopupTemplate({
            title: "{displayName}",
            content: fieldInfos.length > 0 ? [
              {
                type: "fields",
                fieldInfos: fieldInfos
              }
            ] : "No additional information available"
          })
        });
        
        // Add to batch array instead of directly to layer
        graphicsToAdd.push(graphic);
        addedCount++;
      } catch (pointError) {
        console.error(`Error creating point graphic at index ${index}:`, pointError);
        skippedCount++;
      }
    });
    
    // Add all graphics at once for performance
    if (graphicsToAdd.length > 0) {
      graphicsLayer.addMany(graphicsToAdd);
    }
    
    console.log(`Pipeline layer creation complete: Added ${addedCount} points, skipped ${skippedCount} invalid points`);
  } catch (error) {
    console.error("Error during pipeline layer creation:", error);
  }
  
  // Always return a valid layer, even if empty
  return graphicsLayer;
};


const createLayers = async (
  visualizationType,
  configOverride = null,
  layerConfigs = initialLayerConfigurations, // Keep using the global one passed down
  selectedAreaType = areaTypes[0]
) => {
  // --- Input Validation and Config Setup ---
  if (!visualizationType && !configOverride?.type) {
    console.error("[createLayers] No visualization type or config type provided.");
    return null;
  }

  const baseConfig = layerConfigs[visualizationType];
  let config = configOverride || baseConfig;

  if (!config) {
     console.warn(`[createLayers] No specific config found for '${visualizationType}'. Using minimal defaults based on type.`);
     // Create a minimal structure, the specific creators will handle defaults
     config = { type: visualizationType };
  } else if (configOverride) {
      console.log("[createLayers] Using provided config override:", configOverride);
      config = { ...configOverride }; // Clone override
  } else {
      console.log(`[createLayers] Using initial config for '${visualizationType}'.`);
      config = { ...baseConfig }; // Clone base config
  }

  // Ensure config always has a type property, prioritizing override/base, then visualizationType
  if (!config.type) {
      config.type = visualizationType;
  }
  // --- End Config Setup ---


  // --- Normalize Type ---
  let effectiveVizType = config.type; // Start with type from config
  if (effectiveVizType === "pipeline") effectiveVizType = "pipe";
  if (effectiveVizType === "comps") effectiveVizType = "comp";
  // Further normalization based on legacy naming, if needed
  if (effectiveVizType && effectiveVizType.endsWith('_HEAT')) {
      console.log(`[createLayers] Normalizing HEAT type ${effectiveVizType} to class-breaks`);
      effectiveVizType = 'class-breaks';
      config.type = 'class-breaks'; // Update config type as well
  }
  // Use base config type if type is still ambiguous (e.g., just 'income')
  if (baseConfig && baseConfig.type && !['pipe', 'comp', 'custom', 'class-breaks', 'dot-density'].includes(effectiveVizType)) {
      console.log(`[createLayers] Using base config type '${baseConfig.type}' for ambiguous type '${effectiveVizType}'`);
      effectiveVizType = baseConfig.type;
      config.type = effectiveVizType; // Update config type
  }

  console.log(`[createLayers] Effective visualization type determined as: ${effectiveVizType}`);
  // --- End Normalize Type ---


  // --- Handle Special GraphicsLayer Types ---
  const specialTypes = ["pipe", "comp", "custom"];
  const hasCustomData = config.customData && Array.isArray(config.customData.data) && config.customData.data.length > 0;

  // **Revised Logic: Prioritize explicit type match**
  if (specialTypes.includes(effectiveVizType)) {
      console.log(`[createLayers] Explicitly handling special type: ${effectiveVizType}`);
      let graphicsLayer = null;
      try {
          if (effectiveVizType === "pipe") {
              graphicsLayer = createPipeLayer(config); // Pass full config
          } else if (effectiveVizType === "comp") {
              graphicsLayer = createCompLayer(config); // Pass full config
          } else if (effectiveVizType === "custom") {
              graphicsLayer = await createGraphicsLayerFromCustomData(config); // Pass full config
          }

          // Add standard flags AFTER creation if not done inside creators
          if (graphicsLayer instanceof GraphicsLayer) {
              graphicsLayer.isVisualizationLayer = true;
              // Type is already set inside creators now
              console.log(`[createLayers] Successfully created GraphicsLayer: "${graphicsLayer.title}", type: "${graphicsLayer.visualizationType}"`);
              return graphicsLayer;
          } else {
              console.error(`[createLayers] Failed to create a valid GraphicsLayer for type ${effectiveVizType}.`);
              return null;
          }
      } catch (error) {
          console.error(`[createLayers] Error creating GraphicsLayer for ${effectiveVizType}:`, error);
          return null;
      }
  }
  // --- Fallback for custom types if type wasn't explicitly set but data exists ---
  else if (hasCustomData && !['class-breaks', 'dot-density'].includes(effectiveVizType)) {
      console.log(`[createLayers] Handling as 'custom' based on customData presence and non-standard type '${effectiveVizType}'.`);
      try {
          // Force type to custom in config if needed
          config.type = 'custom';
          const graphicsLayer = await createGraphicsLayerFromCustomData(config);
           if (graphicsLayer instanceof GraphicsLayer) {
              graphicsLayer.isVisualizationLayer = true;
              // Type is set inside creator
              console.log(`[createLayers] Successfully created fallback custom GraphicsLayer: "${graphicsLayer.title}", type: "${graphicsLayer.visualizationType}"`);
              return graphicsLayer;
           } else {
               console.error(`[createLayers] Failed to create fallback custom GraphicsLayer.`);
               return null;
           }
      } catch (error) {
           console.error(`[createLayers] Error creating fallback custom GraphicsLayer:`, error);
           return null;
      }
  }
  // --- End Handle Special GraphicsLayer Types ---


  // --- Standard Heatmap/Dot Density Logic (using FeatureLayer) ---
  console.log(`[createLayers] Handling as standard type: ${effectiveVizType}`);

  if (!selectedAreaType?.url) {
    console.error(`[createLayers] Invalid area type for standard visualization '${effectiveVizType}': No URL.`, selectedAreaType);
    return null;
  }

  // Renderer creation logic (ensure FeatureLayer is imported)
  const createRenderer = (rendererConfig, areaType) => { // Pass areaType for defaults
    if (!rendererConfig || !rendererConfig.type) {
      console.warn("[createLayers->createRenderer] Invalid config provided", rendererConfig);
      return null;
    }
    if (!rendererConfig.field && (rendererConfig.type === "dot-density" || rendererConfig.type === "class-breaks")) {
      console.error(`[createLayers->createRenderer] Cannot create renderer for type ${rendererConfig.type}: Missing required 'field'.`);
      return null;
    }

    switch (rendererConfig.type) {
      case "dot-density":
        // Determine default dot value based on area type
        const defaultDotVal = (areaType?.value === 12 || String(areaType?.value).toLowerCase() === 'tract') ? 10 : 100;
        const currentDotValue = rendererConfig.dotValue !== undefined ? Number(rendererConfig.dotValue) : defaultDotVal;

        // Ensure attributes exist and are correctly structured
        let attributes = rendererConfig.attributes;
        if (!Array.isArray(attributes) || attributes.length === 0) {
          attributes = [{
            field: rendererConfig.field,
            color: "#E60049", // Default color
            label: rendererConfig.label || rendererConfig.field || "Value",
          }];
          console.warn(`[createLayers->createRenderer] Dot density config missing 'attributes', created default for field: ${rendererConfig.field}`);
        }

        attributes = attributes.map(attr => ({
          field: attr.field || rendererConfig.field,
          color: attr.color || "#E60049",
          label: attr.label || attr.field || rendererConfig.field,
        }));

        return {
          type: "dot-density",
          field: rendererConfig.field,
          dotValue: currentDotValue,
          dotBlending: rendererConfig.dotBlending || "additive",
          dotSize: rendererConfig.dotSize !== undefined ? Number(rendererConfig.dotSize) : 2,
          outline: rendererConfig.outline || { width: 0.5, color: [50, 50, 50, 0.2] },
          legendOptions: rendererConfig.legendOptions || { unit: "value" },
          attributes: attributes,
        };

      case "class-breaks":
        const classBreakInfos = Array.isArray(rendererConfig.classBreakInfos) ? rendererConfig.classBreakInfos : [];
        if (classBreakInfos.length === 0) {
          console.warn(`[createLayers->createRenderer] Class breaks config for field ${rendererConfig.field} is missing 'classBreakInfos'. Renderer might not display correctly.`);
        }
        return {
          type: "class-breaks",
          field: rendererConfig.field,
          defaultSymbol: rendererConfig.defaultSymbol || {
            type: "simple-fill",
            color: [0, 0, 0, 0], // Transparent fill
            outline: { color: [150, 150, 150, 0.5], width: 0.5 }, // Default outline
          },
          defaultLabel: rendererConfig.defaultLabel || "No data",
          classBreakInfos: classBreakInfos,
        };
      default:
        console.error("[createLayers->createRenderer] Unsupported standard renderer type:", rendererConfig.type);
        return null;
    }
  };

  // Layer definitions for Popups (Simplified)
  const getLayerDefinition = (vizType, cfg) => {
      // Prefer label/field from config if available
      const label = cfg?.attributes?.[0]?.label || cfg?.label || cfg?.field || vizType.replace(/_/g, ' ');
      const field = cfg?.field;
      // Basic number format as default
      const format = cfg?.valueFormat || { digitSeparator: true, places: (cfg?.type === 'class-breaks' ? 1 : 0) };

      return { title: label, fieldName: field, format: format };
  };

  const layerDef = getLayerDefinition(effectiveVizType, config);

  // Create and return the FeatureLayer
  let featureLayer = null;
  try {
    const renderer = createRenderer(config, selectedAreaType); // Pass area type

    if (!renderer) {
      console.error(`[createLayers] Failed to create renderer for type ${config.type}.`);
      return null;
    }

    // Simplified popup - assuming 'NAME' field exists on the service for area name
    const popupTemplate = layerDef.fieldName ? {
      title: `${selectedAreaType.label} {NAME}`,
      content: [{
        type: "fields",
        fieldInfos: [{
          fieldName: layerDef.fieldName,
          label: layerDef.title,
          format: layerDef.format
        }]
      }]
    } : {
        title: `${selectedAreaType.label} {NAME}`,
        content: "No specific data field configured for popup."
    };

    // MinScale based on area type
    const minScale = (selectedAreaType?.value === 12 || String(selectedAreaType?.value).toLowerCase() === 'tract')
                     ? 2500000
                     : 25000000; // Larger scale for County etc.

    featureLayer = new FeatureLayer({
      url: selectedAreaType.url,
      renderer: renderer,
      popupTemplate: popupTemplate,
      title: layerDef.title, // Use title from definition
      minScale: minScale,
      outFields: ["*", "NAME"], // Ensure NAME and all other fields are requested
      definitionExpression: config.definitionExpression || null // Add support for definition expressions if needed
    });

    // Add standard flags
    featureLayer.isVisualizationLayer = true;
    featureLayer.visualizationType = effectiveVizType; // Store the *effective* type

    console.log(`[createLayers] FeatureLayer created: "${featureLayer.title}", type: "${featureLayer.visualizationType}"`);

  } catch (error) {
    console.error("[createLayers] Failed to create FeatureLayer:", error);
    return null;
  }

  return featureLayer;
};
// *** ENTIRE FUNCTION ***
async function createGraphicsLayerFromCustomData(config) {
  // Log the received config
  console.log("[createGraphicsLayerFromCustomData] Creating graphics layer with config:", JSON.stringify(config, (k,v) => k === 'data' ? `[${v?.length} items]` : v));

  if (!config || !config.customData || !Array.isArray(config.customData.data)) {
    console.error("[createGraphicsLayerFromCustomData] Invalid configuration for custom data layer:", config);
    return null;
  }

  // Ensure GraphicsLayer and other modules are imported
  let GraphicsLayer, Point, SimpleMarkerSymbol, PopupTemplate, Color, Graphic;
   try {
       [{ default: GraphicsLayer }, { default: Point }, { default: SimpleMarkerSymbol }, { default: PopupTemplate }, { default: Color }, { default: Graphic }] = await Promise.all([
           import("@arcgis/core/layers/GraphicsLayer"),
           import("@arcgis/core/geometry/Point"),
           import("@arcgis/core/symbols/SimpleMarkerSymbol"),
           import("@arcgis/core/PopupTemplate"),
           import("@arcgis/core/Color"),
           import("@arcgis/core/Graphic")
       ]);
   } catch (importError) {
       console.error("Failed to import ArcGIS Core modules:", importError);
       return null;
   }


  const customLayer = new GraphicsLayer({
    title: config.title || "Custom Data Points",
    listMode: "show",
  });
  // Set flags
  customLayer.isVisualizationLayer = true;
  customLayer.isCustomDataLayer = true;
  customLayer.visualizationType = "custom"; // Explicitly set type

  // --- Corrected Extraction ---
  const data = config.customData.data || [];
  const nameColumn = config.nameColumn || config.customData.nameColumn;
  const valueColumn = config.field || config.valueColumn || config.customData.valueColumn;
  const latitudeColumn = config.latitudeColumn || config.customData.latitudeColumn || "latitude";
  const longitudeColumn = config.longitudeColumn || config.customData.longitudeColumn || "longitude";
  const symbolConfig = config.symbol || {};
  const classBreakInfos = config.classBreakInfos || [];
  const rendererType = config.rendererType || (classBreakInfos.length > 0 ? 'classBreaks' : 'simple');
  const valueFormat = config.valueFormat;
  // --- End Corrected Extraction ---

  if (data.length === 0) {
    console.warn("[createGraphicsLayerFromCustomData] No data points found in configuration for custom layer.");
    return customLayer; // Return empty layer
  }

  // --- Default Symbol Properties ---
  const defaultColor = '#FF0000'; // Default Red for custom
  const defaultSize = 10;
  const defaultOutlineColor = '#FFFFFF';
  const defaultOutlineWidth = 1;
  const defaultStyle = 'circle';

  const pointColor = symbolConfig.color || defaultColor;
  const pointSize = typeof symbolConfig.size === 'number' && !isNaN(symbolConfig.size)
                      ? symbolConfig.size : defaultSize;
  const outlineConfig = symbolConfig.outline || {};
  const outlineColor = outlineConfig.color || defaultOutlineColor;
  const outlineWidth = typeof outlineConfig.width === 'number' && !isNaN(outlineConfig.width)
                         ? outlineConfig.width : defaultOutlineWidth;
  const pointStyle = symbolConfig.style || defaultStyle;
  // --- End Default Symbol ---

  console.log("[createGraphicsLayerFromCustomData] Using symbol style:", {
      style: pointStyle, size: pointSize, defaultColor: pointColor,
      outlineColor: outlineColor, outlineWidth: outlineWidth,
      rendererType: rendererType, valueColumn: valueColumn, hasBreaks: classBreakInfos.length > 0
  });

  // Helper function (same as in createCompLayer)
  const getColorForValue = (value) => {
     if (value === undefined || value === null || value === '' ||
         !valueColumn || !classBreakInfos || classBreakInfos.length === 0 ||
         rendererType !== 'classBreaks') {
       return pointColor; // Use default custom color if not class breaks
     }
     const numValue = Number(value);
     if (isNaN(numValue)) { return pointColor; }
     for (const breakInfo of classBreakInfos) {
         const maxVal = (breakInfo.maxValue === Infinity || breakInfo.maxValue === undefined || breakInfo.maxValue === null) ? Infinity : Number(breakInfo.maxValue);
         const minVal = (breakInfo.minValue === -Infinity || breakInfo.minValue === undefined || breakInfo.minValue === null) ? -Infinity : Number(breakInfo.minValue);
         const isMinMet = (minVal === -Infinity || numValue >= minVal);
         const isMaxMet = (maxVal === Infinity || numValue <= maxVal);
         if (isMinMet && isMaxMet) { return breakInfo.symbol?.color || pointColor; }
     }
     return pointColor;
  };

  // Create popup template based on available columns
  let popupTemplate = null;
  const fieldInfos = [];
  // Always add name if column exists
  if (nameColumn) fieldInfos.push({ fieldName: nameColumn, label: nameColumn || "Name" });
  // Add value if column exists
  if (valueColumn) fieldInfos.push({
      fieldName: valueColumn, // Use original value column name for binding
      label: valueColumn || "Value",
      format: valueFormat ? {
        digitSeparator: true,
        places: valueFormat.decimals ?? 0,
        prefix: valueFormat.prefix || '',
        suffix: valueFormat.suffix || ''
      } : { digitSeparator: true, places: 2 } // Default format
  });
   // Add Lat/Lon
  fieldInfos.push({ fieldName: latitudeColumn, label: 'Latitude', format: { places: 6 } });
  fieldInfos.push({ fieldName: longitudeColumn, label: 'Longitude', format: { places: 6 } });

  popupTemplate = new PopupTemplate({
      // Use nameColumn for title if available, otherwise a generic title
      title: nameColumn ? `{${nameColumn}}` : "Custom Point",
      content: [{ type: "fields", fieldInfos: fieldInfos }]
  });


  let addedCount = 0;
  let errorCount = 0;
  const graphicsToAdd = [];

  data.forEach((item, index) => {
    let latitude, longitude;
    // Robust coordinate extraction
     if (item[latitudeColumn] !== undefined && item[longitudeColumn] !== undefined) {
        latitude = parseFloat(item[latitudeColumn]); longitude = parseFloat(item[longitudeColumn]);
    } else if (item.geometry && typeof item.geometry.y === "number" && typeof item.geometry.x === "number") {
        latitude = item.geometry.y; longitude = item.geometry.x;
    } else if (typeof item["lat"] === "number" && typeof item["lon"] === "number") {
        latitude = item["lat"]; longitude = item["lon"];
    } else if (typeof item["latitude"] === "number" && typeof item["longitude"] === "number") {
        latitude = item["latitude"]; longitude = item["longitude"];
    } else {
        console.warn(`[createGraphicsLayerFromCustomData] Item ${index} missing valid coordinates using columns '${latitudeColumn}' and '${longitudeColumn}'. Skipping.`);
        errorCount++; return;
    }

    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.warn(`[createGraphicsLayerFromCustomData] Item ${index} has invalid coordinates (Lat: ${latitude}, Lon: ${longitude}). Skipping.`);
        errorCount++; return;
    }

    try {
      const point = new Point({
        longitude: longitude,
        latitude: latitude,
        spatialReference: { wkid: 4326 },
      });

      // Get the value and determine color based on class breaks/rendererType
      const pointValue = valueColumn ? item[valueColumn] : null;
      const itemColor = getColorForValue(pointValue);

      const markerSymbol = new SimpleMarkerSymbol({
        style: pointStyle,
        color: new Color(itemColor), // Use determined color
        size: pointSize,
        outline: {
          color: new Color(outlineColor),
          width: outlineWidth
        },
      });

      // Prepare attributes, ensuring popup fields exist
      const attributes = {
        ...item, // Include all original data
        OBJECTID: index, // Standard field
        // Ensure columns needed for popup binding exist
        [latitudeColumn]: latitude,
        [longitudeColumn]: longitude,
        ...(nameColumn && { [nameColumn]: item[nameColumn] ?? "N/A" }),
        ...(valueColumn && { [valueColumn]: item[valueColumn] ?? null }),
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        attributes: attributes,
        popupTemplate: popupTemplate, // Use the single template
      });

      graphicsToAdd.push(pointGraphic);
      addedCount++;
    } catch (graphicError) {
      console.error(`[createGraphicsLayerFromCustomData] Error creating graphic for custom data point ${index}:`, graphicError, "Item:", item);
      errorCount++;
    }
  });

  if (graphicsToAdd.length > 0) {
    customLayer.addMany(graphicsToAdd);
  }

  console.log(`[createGraphicsLayerFromCustomData] Added ${addedCount} points to custom graphics layer "${customLayer.title}". ${errorCount} errors occurred.`);
  return customLayer;
}


// Helper function to create a dot density configuration
const createDotDensityConfig = (field, label, dotValue = 100) => ({
  type: "dot-density",
  field,
  dotValue,
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
      field,
      color: "#E60049",
      label,
    },
  ],
});

const areaTypes = [
  {
    value: 12,
    label: "Census Tract",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
  },
  {
    value: 11,
    label: "County",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/11",
  },
];

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [drawEndPoint, setDrawEndPoint] = useState(null);
  const rectangleRef = useRef(null);
  // Add these refs to store values for event handlers
  const isDrawingRef = useRef(false);
  const drawStartPointRef = useRef(null);
  const drawEndPointRef = useRef(null);
  const activeLayersRef = useRef({}); 

  // Use the first available project ID
  const projectId =
    routeProjectId || localStorageProjectId || sessionStorageProjectId;
    
    
    const renderCustomLegend = () => {
      // Only show if we have active special visualization type with valid config
      if (!customLegendContent || !customLegendContent.config) {
        return null;
      }
    
      // Return a single div that contains the legend
      return (
        <div className="absolute bottom-4 left-4 z-10">
          <CustomLegend type={customLegendContent.type} config={customLegendContent.config} />
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

  const initializeDrawingTools = (view) => {
    // Create rectangle element if it doesn't exist
    if (!rectangleRef.current) {
      const rect = document.createElement('div');
      rect.className = 'draw-rectangle';
      rect.style.position = 'absolute';
      rect.style.border = '2px dashed #0078fa';
      rect.style.backgroundColor = 'rgba(0, 120, 250, 0.1)';
      rect.style.pointerEvents = 'none';
      rect.style.display = 'none';
      rect.style.zIndex = '100';
  
      // Append to the map container
      if (mapRef.current) {
        mapRef.current.appendChild(rect);
        rectangleRef.current = rect;
      } else {
        console.error("Map container ref is not available to append drawing rectangle.");
        return;
      }
    }
  
    // Mousedown - Start drawing (Right-click only)
    view.container.addEventListener('mousedown', (e) => {
      // Check for right mouse button (button code 2)
      if (e.button !== 2 || isDrawingRef.current) return;
  
      // Prevent default right-click menu
      e.preventDefault();
      e.stopPropagation();
  
      console.log("Right mouse down - Start drawing");
  
      const startPoint = { x: e.offsetX, y: e.offsetY };
  
      // Update refs and state
      isDrawingRef.current = true;
      drawStartPointRef.current = startPoint;
      drawEndPointRef.current = startPoint;
  
      setIsDrawing(true);
      setDrawStartPoint(startPoint);
      setDrawEndPoint(startPoint);
  
      // Show and position the rectangle
      const rect = rectangleRef.current;
      if (rect) {
        rect.style.left = `${startPoint.x}px`;
        rect.style.top = `${startPoint.y}px`;
        rect.style.width = '0px';
        rect.style.height = '0px';
        rect.style.display = 'block';
      } else {
        console.error("Rectangle element ref is missing on mousedown.");
        isDrawingRef.current = false;
        setIsDrawing(false);
      }
    });
  
    // Context Menu - Prevent default behavior
    view.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  
    // Mousemove - Update rectangle size while drawing
    view.container.addEventListener('mousemove', (e) => {
      if (!isDrawingRef.current || !drawStartPointRef.current) return;
  
      const currentPoint = { x: e.offsetX, y: e.offsetY };
      drawEndPointRef.current = currentPoint;
      setDrawEndPoint(currentPoint);
  
      // Update rectangle dimensions
      const rect = rectangleRef.current;
      if (rect) {
        const start = drawStartPointRef.current;
        const left = Math.min(start.x, currentPoint.x);
        const top = Math.min(start.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - start.x);
        const height = Math.abs(currentPoint.y - start.y);
  
        rect.style.left = `${left}px`;
        rect.style.top = `${top}px`;
        rect.style.width = `${width}px`;
        rect.style.height = `${height}px`;
      }
    });
  
    view.container.addEventListener('mouseup', async (e) => { // Ensure async

      // --- PRIMARY CHECK: Only process right mouse button up ---
      if (e.button !== 2) {
        return; // Ignore left/middle mouse button releases
      }

      // --- Stop event bubbling immediately for right-click ---
      e.preventDefault(); // Already preventing context menu, but good practice
      e.stopPropagation(); // Prevent this event from triggering other listeners

      // --- Check if we were actively drawing ---
      // Use a temporary variable to capture the state *before* resetting
      const wasDrawingActive = isDrawingRef.current;

      // Log the state *before* potentially resetting
      console.log(`Right mouse up detected. Button: ${e.button}, Was Drawing (Ref): ${wasDrawingActive}`);

      // --- Proceed ONLY if we were actively drawing ---
      if (!wasDrawingActive) {
        console.log("Ignoring mouseup because isDrawingRef was already false.");
        // This log should NOT appear after a successful drag-zoom sequence if this fix works.
        // If it *still* appears, something more complex is happening.
        return;
      }

      // --- Reset drawing state ---
      // We know we were drawing, so reset now.
      isDrawingRef.current = false;
      const startPoint = drawStartPointRef.current; // Capture start point *before* clearing ref
      drawStartPointRef.current = null;
      drawEndPointRef.current = null;
      setIsDrawing(false); // Update React state
      setDrawStartPoint(null);
      setDrawEndPoint(null);
      console.log("Drawing state reset.");
      // --- End Reset ---


      // --- Hide Rectangle ---
      const rectElement = rectangleRef.current;
      if (rectElement) {
        rectElement.style.display = 'none';
        console.log("Draw rectangle hidden.");
      } else {
        console.warn("Rectangle element ref was missing on mouseup.");
      }
      // --- End Hide Rectangle ---


      // --- Validate Start Point (crucial after reset logic) ---
      if (!startPoint) {
        console.error("CRITICAL: startPoint was null even though wasDrawingActive was true. State inconsistency?");
        return;
      }
      // --- End Validate Start Point ---


      // --- Calculations and Zoom Logic (from previous correct version) ---
      const endPoint = { x: e.offsetX, y: e.offsetY };
      console.log("Start Point (Captured):", startPoint);
      console.log("End Point (Event):", endPoint);

      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);
      const minDragSize = 10;

      if (width < minDragSize || height < minDragSize) {
        console.log(`Drag rectangle too small (w: ${width}, h: ${height}). Not zooming.`);
        return;
      }
      console.log(`Drag size sufficient. Proceeding with zoom.`);

      try {
        const { default: Extent } = await import("@arcgis/core/geometry/Extent");

        const screenTopLeft = {
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y)
        };
        const screenBottomRight = {
          x: Math.max(startPoint.x, endPoint.x),
          y: Math.max(startPoint.y, endPoint.y)
        };
        console.log("Calculated Screen Coordinates:", { screenTopLeft, screenBottomRight });

        const mapTopLeft = view.toMap(screenTopLeft);
        const mapBottomRight = view.toMap(screenBottomRight);

        if (!mapTopLeft || !mapBottomRight) {
          console.error("Failed to convert screen coordinates to map coordinates.");
          return;
        }
        console.log("Converted Map Coordinates:", { mapTopLeft, mapBottomRight });

        if (isNaN(mapTopLeft.x) || isNaN(mapTopLeft.y) || isNaN(mapBottomRight.x) || isNaN(mapBottomRight.y)) {
            console.error("One or more map coordinates are NaN.");
            return;
        }

        const targetExtent = new Extent({
          xmin: Math.min(mapTopLeft.x, mapBottomRight.x),
          ymin: Math.min(mapTopLeft.y, mapBottomRight.y),
          xmax: Math.max(mapTopLeft.x, mapBottomRight.x),
          ymax: Math.max(mapTopLeft.y, mapBottomRight.y),
          spatialReference: view.spatialReference
        });

        const mapWidth = targetExtent.width;
        const mapHeight = targetExtent.height;
        console.log("Calculated Map Extent Object:", targetExtent.toJSON());
        console.log("Calculated Map Extent Dimensions:", { mapWidth, mapHeight });

        if (!targetExtent || isNaN(mapWidth) || isNaN(mapHeight) || mapWidth <= 0 || mapHeight <= 0) {
          console.warn("Calculated extent is invalid. Cannot zoom.");
          return;
        }

        console.log("View zoom BEFORE goTo:", view.zoom);
        console.log("Attempting zoom with view.goTo...", { target: targetExtent.toJSON() });

        await view.goTo(targetExtent, { animate: false });

        console.log("view.goTo promise resolved.");

        // --- Verification and Redraw (in rAF) ---
        requestAnimationFrame(() => {
            if (!view) return;
            console.log("View state AFTER goTo (in rAF):");
            console.log("  Zoom:", view.zoom);
            // ... (other verification logs) ...

            // Padding Trick
            console.log("Applying padding trick...");
            const originalPadding = JSON.parse(JSON.stringify(view.padding || { top: 0, right: 0, bottom: 0, left: 0 }));
            const currentBottomPadding = originalPadding.bottom || 0;
            view.padding = { ...originalPadding, bottom: currentBottomPadding + 1 };
            requestAnimationFrame(() => {
                if (view) {
                    view.padding = originalPadding;
                    console.log("Padding reset.");
                }
            });
        });
        // --- End Verification ---

      } catch (error) {
        console.error("Error during zoom processing on mouseup:", error);
      }
      // --- End Calculations and Zoom Logic ---

    }); // End mouseup listener
  
    // Mouseleave - Cancel drawing if mouse leaves map container
    view.container.addEventListener('mouseleave', () => {
      if (isDrawingRef.current) {
        console.log("Mouse left map container while drawing - Canceling.");
  
        // Reset state
        isDrawingRef.current = false;
        drawStartPointRef.current = null;
        drawEndPointRef.current = null;
        setIsDrawing(false);
        setDrawStartPoint(null);
        setDrawEndPoint(null);
  
        // Hide rectangle
        if (rectangleRef.current) {
          rectangleRef.current.style.display = 'none';
        }
      }
    });
  };

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        console.log("Starting map initialization...");

        // Validate API Key
        const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        if (!apiKey) {
          console.error("ArcGIS API Key is missing");
          return;
        }

        // Configure ArcGIS
        esriConfig.apiKey = apiKey;
        esriConfig.assetsPath =
          "https://js.arcgis.com/4.31/@arcgis/core/assets/";

        // Create map with standard basemap
        const map = new Map({
          basemap: "streets-navigation-vector",
        });

        // Create view with comprehensive error handling
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-98, 39],
          zoom: 4,
          constraints: {
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20,
          },
          navigation: {
            actionMap: {
              mouseWheel: {
                enabled: false,
              },
            },
            browserTouchPanEnabled: true,
            momentumEnabled: true,
            keyboardNavigation: true,
          },
        });

        console.log("Waiting for view to be ready...");
        // Wait for the view to be ready before proceeding
        await view.when();
        console.log("View is now ready!");

        // Custom mouse wheel zoom handler
        view.constraints.snapToZoom = false; // Allow fractional zoom levels

        // Enhanced mouse wheel zoom handler with DEBUG LOGGING
        view.on("mouse-wheel", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const state = scrollStateRef.current;
          const now = Date.now();
          const timeDiff = now - (state.lastScrollTime || now); // Handle initial scroll

          const scrollDeltaY = event.native.deltaY;
          const currentDirection = scrollDeltaY < 0 ? 1 : -1; // 1 = zoom in, -1 = zoom out

          console.log(`\n--- Wheel Event ---`); // Separator for clarity
          console.log(`Time: ${now}, LastTime: ${state.lastScrollTime}, Diff: ${timeDiff}ms`);
          console.log(`Direction: ${currentDirection}, LastDirection: ${state.lastScrollDirection}, Current Streak: ${state.scrollStreak}`);

          // --- Streak Logic ---
          const resetThreshold = 250; // ms - Pause threshold
          const accelerateThreshold = 120; // ms - Continuous scroll threshold

          // Clear previous reset timer
          if (state.timeoutId) {
              clearTimeout(state.timeoutId);
              state.timeoutId = null; // Clear the ID
          }

          let streakIncremented = false;
          if (timeDiff < resetThreshold && currentDirection === state.lastScrollDirection && state.lastScrollDirection !== 0) {
              // Scrolling continued in the same direction without too long a pause
              if (timeDiff < accelerateThreshold) {
                  // Fast enough to increase streak
                  state.scrollStreak++;
                  streakIncremented = true;
                  console.log(`   Streak INCREMENTED to: ${state.scrollStreak} (timeDiff < accelerateThreshold)`);
              } else {
                  // Scrolled again in same direction, but paused slightly - MAINTAIN streak (removed reset to 1)
                  console.log(`   Streak MAINTAINED at: ${state.scrollStreak} (accelerateThreshold <= timeDiff < resetThreshold)`);
                  // Keep state.scrollStreak as is, don't reset to 1
              }
          } else {
              // Direction changed or paused too long - reset streak
              console.log(`   Streak RESET to 1 (timeDiff >= resetThreshold or direction changed)`);
              state.scrollStreak = 1;
          }
          // --- End Streak Logic ---


          // --- Calculate Zoom Delta ---
          const baseZoomDelta = 0.08;
          const streakBonus = 0.20; // Slightly increased bonus for testing
          const maxAccelerationFactor = 5.0;

          // Acceleration factor increases only AFTER the first scroll in a streak
          const accelerationFactor = Math.min(
              1 + streakBonus * Math.max(0, state.scrollStreak - 1),
              maxAccelerationFactor
          );

          const finalZoomDelta = baseZoomDelta * accelerationFactor * currentDirection;
          console.log(`   BaseDelta: ${baseZoomDelta}, AccelFactor: ${accelerationFactor.toFixed(2)}, FinalDelta: ${finalZoomDelta.toFixed(4)}`);
          // --- End Calculate Zoom Delta ---


          // --- Apply Zoom ---
          const currentZoom = view.zoom;
          let newZoom = currentZoom + finalZoomDelta;
          newZoom = Math.min(
              Math.max(newZoom, view.constraints.minZoom),
              view.constraints.maxZoom
          );
          console.log(`   CurrentZoom: ${currentZoom.toFixed(4)}, NewZoom Clamped: ${newZoom.toFixed(4)}`);

          if (Math.abs(newZoom - currentZoom) > 0.001) {
              console.log(`   Applying goTo with zoom: ${newZoom.toFixed(4)}`);
              view.goTo({ zoom: newZoom, center: view.center }, { duration: 60, easing: "linear", animate: true })
                  .catch(error => { if (error.name !== "AbortError") console.error("goTo Error:", error); });
          } else {
              console.log(`   Skipping goTo (zoom change too small)`);
          }
          // --- End Apply Zoom ---


          // --- Update State for Next Event ---
          state.lastScrollTime = now;
          state.lastScrollDirection = currentDirection;

          // Set a timer to reset the streak if the user stops scrolling
          state.timeoutId = setTimeout(() => {
              console.log(`--- Wheel Timeout (${resetThreshold}ms): Resetting streak ---`);
              state.scrollStreak = 0;
              state.lastScrollDirection = 0;
              state.timeoutId = null;
          }, resetThreshold);
          // --- End Update State ---
      });

        // Initialize the rectangle drawing functionality
        initializeDrawingTools(view);

        console.log("Adding UI widgets...");
        // Add non-legend widgets first
        const widgets = [
          {
            widget: new Home({ view }),
            position: "top-left",
          },
          {
            widget: new ScaleBar({
              view,
              unit: "imperial",
            }),
            position: "top-left",
          },
        ];

        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        if (isMounted) {
          console.log("Finalizing map setup...");
          // Set map readiness flag and view in context
          view.ready = true;
          setMapView(view);
          console.log("[MapContext] Map view initialized and ready");

          // Initialize legend after map is ready
          const legendWidget = new Legend({
            view,
            container: document.createElement("div"),
            layerInfos: [],
            visible: false,
          });

          // Add legend to the view but keep it hidden initially
          view.ui.add(legendWidget, "bottom-left");
          setLegend(legendWidget);
        }
      } catch (error) {
        console.error("[Map] Error initializing map:", error, error.stack);
        console.error("Comprehensive Map Initialization Error:", {
          message: error.message,
          name: error.name,
          fullError: error,
          stack: error.stack,
        });
      }
    };

    // Trigger map initialization
    initializeMap();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  // Style legend whenever it changes
  useEffect(() => {
    if (!legend) return;

    const styleLegend = () => {
      const legendContainer = document.querySelector(".esri-legend");
      if (legendContainer) {
        legendContainer.style.backgroundColor = "white";
        legendContainer.style.padding = "1rem";
        legendContainer.style.margin = "0.5rem";
        legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
        legendContainer.style.borderRadius = "0.375rem";
        legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

        // Style the legend title
        const legendTitle = legendContainer.querySelector(
          ".esri-legend__service-label"
        );
        if (legendTitle) {
          legendTitle.style.fontWeight = "600";
          legendTitle.style.fontSize = "0.875rem";
          legendTitle.style.marginBottom = "0.75rem";
          legendTitle.style.color = "#111827";
        }

        // Style individual legend items
        const legendItems = legendContainer.querySelectorAll(
          ".esri-legend__layer-row"
        );
        legendItems.forEach((item) => {
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.marginBottom = "0.5rem";
        });

        // Style the color swatches
        const swatches = legendContainer.querySelectorAll(
          ".esri-legend__symbol"
        );
        swatches.forEach((swatch) => {
          swatch.style.width = "1rem";
          swatch.style.height = "1rem";
          swatch.style.marginRight = "0.5rem";
        });

        // Style the labels
        const labels = legendContainer.querySelectorAll(
          ".esri-legend__layer-cell--info"
        );
        labels.forEach((label) => {
          label.style.fontSize = "0.875rem";
          label.style.color = "#4B5563";
        });
      }
    };

    styleLegend();
  }, [legend]);

  // Updated initialization effect
  useEffect(() => {
    // Load auto-saved configurations on mount
    const initConfigs = async () => {
      await loadMapConfigurations(AUTO_SAVE_KEY, false);

      // Force update visualization layers and legend for all loaded tabs
      const loadedTabs = tabs.filter(
        (tab) => tab.id !== 1 && tab.visualizationType
      );
      for (const tab of loadedTabs) {
        const newLayer = createLayers(
          tab.visualizationType,
          tab.layerConfiguration,
          initialLayerConfigurations,
          tab.areaType
        );

        if (newLayer && mapView?.map) {
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);

          if (legend && tab.active) {
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || tab.visualizationType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = true;
          }
        }
      }
    };

    initConfigs();
  }, [mapView, legend]);

  useEffect(() => {
    return () => {
      // Remove the rectangle element when component unmounts
      if (rectangleRef.current && mapRef.current) {
        if (mapRef.current.contains(rectangleRef.current)) {
          mapRef.current.removeChild(rectangleRef.current);
        }
      }
    };
  }, []);


  const handlePipeVisualization = async (tabData, layer = null) => { // Keep layer param
    const tabId = tabData?.id;
    let targetLayer = null;
  
    console.log(`[handlePipeVisualization] Handling visualization for tab ${tabId}. Direct layer passed: ${!!layer}`);
  
    // *** FIX: Prioritize checking the ref ***
    if (activeLayersRef.current[tabId]) {
      targetLayer = activeLayersRef.current[tabId];
      console.log(`[handlePipeVisualization] Found layer in ref for tab ${tabId}:`, targetLayer.id);
    }
    // *** End FIX ***
     // Use passed layer as secondary option
    else if (layer) {
        targetLayer = layer;
        console.log(`[handlePipeVisualization] Using directly passed layer for tab ${tabId}:`, targetLayer.id);
        // Optionally update the ref if it was missing
        // activeLayersRef.current[tabId] = targetLayer;
    }
     // Fallback: Try finding on map (least reliable)
    else {
      console.warn(`[handlePipeVisualization] Layer not in ref or passed directly for tab ${tabId}. Attempting map find...`);
      targetLayer = mapView?.map?.layers.find( // Add safe navigation
        (l) => l && l.isVisualizationLayer === true && l.visualizationType === "pipe" && l instanceof GraphicsLayer
      );
      if (targetLayer) {
          console.log(`[handlePipeVisualization] Found target layer ID: ${targetLayer.id}`);
      } else {
          console.error(`[handlePipeVisualization] FAILED TO FIND TARGET LAYER for tab ${tabId}`);
          return; // Prevent further errors
      }
  
    console.log(`[handlePipeVisualization] Using final target Pipe layer: "${targetLayer.title}" (ID: ${targetLayer.id})`);
    // --- End Zooming Logic ---
  };
  }

  // Similar updates for handleCompVisualization
  const handleCompVisualization = async (tabData) => {
    console.log("[handleCompVisualization] Finding and zooming to Comp Map layer for tab:", tabData?.id);

    if (!mapView?.map) {
      console.warn("[handleCompVisualization] Map view not available.");
      return;
    }
    if (!tabData) {
      console.warn("[handleCompVisualization] Missing tabData.");
      return;
    }

    try {
      // Find the specific GraphicsLayer for 'comp'
      const compLayer = mapView.map.layers.find(
        (l) => l && l.isVisualizationLayer === true && l.visualizationType === "comp" && l instanceof GraphicsLayer
      );

      if (!compLayer) {
        console.error(`[handleCompVisualization] Comp GraphicsLayer not found on map for tab ${tabData.id}. Layer might not have been created or added correctly.`);
        return;
      }

      console.log(`[handleCompVisualization] Found target Comp layer: "${compLayer.title}"`);

    } catch (error) {
      console.error("[handleCompVisualization] Error during comp visualization handling (finding layer or zooming):", error);
       if (error.name === "AbortError") {
         console.log("[handleCompVisualization] Zoom animation was interrupted.");
       }
    }
  };

  useEffect(() => {
    if (!legend || !mapView?.ready) return;

    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const hasVisualization = activeTabData?.visualizationType;
    const shouldShowLegend =
      activeTab !== 1 && hasVisualization && !isEditorOpen;

    // Update legend visibility
    legend.visible = shouldShowLegend;

    if (shouldShowLegend) {
      requestAnimationFrame(() => {
        const styleLegend = () => {
          const legendContainer = legend.container;
          if (legendContainer) {
            // Apply styles
            legendContainer.style.backgroundColor = "white";
            legendContainer.style.padding = "1rem";
            legendContainer.style.margin = "0.5rem";
            legendContainer.style.border = "1px solid rgba(0, 0, 0, 0.1)";
            legendContainer.style.borderRadius = "0.375rem";
            legendContainer.style.boxShadow =
              "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

            // Style legend title
            const legendTitle = legendContainer.querySelector(
              ".esri-legend__service-label"
            );
            if (legendTitle) {
              legendTitle.style.fontWeight = "600";
              legendTitle.style.fontSize = "0.875rem";
              legendTitle.style.marginBottom = "0.75rem";
              legendTitle.style.color = "#111827";
            }

            // Style legend items
            const legendItems = legendContainer.querySelectorAll(
              ".esri-legend__layer-row"
            );
            legendItems.forEach((item) => {
              item.style.display = "flex";
              item.style.alignItems = "center";
              item.style.marginBottom = "0.5rem";
            });

            // Style color swatches
            const swatches = legendContainer.querySelectorAll(
              ".esri-legend__symbol"
            );
            swatches.forEach((swatch) => {
              swatch.style.width = "1rem";
              swatch.style.height = "1rem";
              swatch.style.marginRight = "0.5rem";
            });

            // Style labels
            const labels = legendContainer.querySelectorAll(
              ".esri-legend__layer-cell--info"
            );
            labels.forEach((label) => {
              label.style.fontSize = "0.875rem";
              label.style.color = "#4B5563";
            });
          }
        };

        styleLegend();
      });
    }
  }, [activeTab, legend, tabs, isEditorOpen, mapView?.ready]);


  useEffect(() => {
    console.log("[VizUpdate Effect] TRIGGERED. Active Tab:", activeTab, "Tabs Count:", tabs.length);
    if (!mapView?.map || isConfigLoading || !legend) {
      console.log("[VizUpdate Effect] Map/Legend not ready or configs loading, skipping update.");
      return;
    }

    let isMounted = true;

    const updateVisualizationAndLegend = async () => {
      console.log("[VizUpdate Effect] Starting update...");
       if (!mapView?.map || !isMounted) { // Check mount status here too
           console.warn("[VizUpdate Effect] Map unavailable or component unmounted during async operation.");
           return;
       }

      // --- Layer Removal ---
      const layersToRemove = [];
      const remainingLayerIds = new Set(); // Keep track of layers NOT removed
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer);
        } else if (layer) {
          remainingLayerIds.add(layer.id); // Track non-viz layers
        }
      });

      if (layersToRemove.length > 0) {
        console.log(`[VizUpdate Effect] Removing ${layersToRemove.length} existing visualization layers.`);
        mapView.map.removeMany(layersToRemove);
        // Clean up refs for removed layers
        Object.keys(activeLayersRef.current).forEach(tabIdKey => {
            const layerInstance = activeLayersRef.current[tabIdKey];
            // Check if the layer instance ID is NOT among the remaining layers
            if (layerInstance && !remainingLayerIds.has(layerInstance.id)) {
                 console.log(`[VizUpdate Effect] Clearing ref for removed layer (Tab ID: ${tabIdKey})`);
                 delete activeLayersRef.current[tabIdKey];
            }
        });
      } else {
         // If no layers removed, still ensure ref is clean if activeTab has no viz
         const activeTabDataForCheck = tabs.find(t => t.id === activeTab);
         if (activeTab === 1 || !activeTabDataForCheck?.visualizationType) {
              if (activeLayersRef.current[activeTab]) {
                 console.log(`[VizUpdate Effect] Clearing ref for active tab ${activeTab} as it has no visualization.`);
                 delete activeLayersRef.current[activeTab];
              }
         }
      }
      // --- End Layer Removal & Ref Cleanup ---


      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      console.log("[VizUpdate Effect] Active Tab Data:", activeTabData ? { id: activeTabData.id, name: activeTabData.name, type: activeTabData.visualizationType } : 'None');

      let newLayer = null;
      let showEsriLegend = false;
      let customLegendData = null;

      if (activeTab !== 1 && activeTabData?.visualizationType) {
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") vizType = "pipe";
        if (vizType === "comps") vizType = "comp";

        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;
        console.log(`[VizUpdate Effect] Creating/Updating layer for active type: ${vizType}`);

        newLayer = await createLayers(
          vizType,
          config,
          initialLayerConfigurations,
          areaType
        );

        if (newLayer && (newLayer instanceof FeatureLayer || newLayer instanceof GraphicsLayer)) {
          if (!isMounted) return;
          console.log(`[VizUpdate Effect] Adding layer "${newLayer.title}" (type: ${newLayer.visualizationType}, ID: ${newLayer.id}) to map.`);
          mapView.map.add(newLayer, 0);

          // *** FIX: Store the newly added layer in the ref ***
          activeLayersRef.current[activeTab] = newLayer;
          console.log(`[VizUpdate Effect] Stored layer in ref for tab ${activeTab}:`, newLayer.id);
          // *** End FIX ***

          try {
            await newLayer.when(); // Wait for layer readiness
             if (!isMounted) return;
            console.log(`[VizUpdate Effect] Layer "${newLayer.title}" is ready.`);

            const specialTypes = ["pipe", "comp", "custom"];
            const effectiveLayerType = newLayer.visualizationType || vizType;

            if ((effectiveLayerType === "pipe" || effectiveLayerType === "comp" || effectiveLayerType === "custom") && config) {
              customLegendData = {
                type: effectiveLayerType,
                config: config
              };
              console.log(`[VizUpdate Effect] Setting custom legend for ${effectiveLayerType} visualization`);
            } else {
              showEsriLegend = true;
            }

             // Prepare custom legend for pipe/comp (if applicable)
            if ((effectiveLayerType === "pipe" || effectiveLayerType === "comp") && config?.symbol && config?.legendInfo) {
                 customLegendData = { /* ... */ };
            }

          } catch (layerWhenError) {
            console.warn(`[VizUpdate Effect] Error waiting for layer "${newLayer.title}" or calling handler:`, layerWhenError.message);
            // Attempt to clean up the ref if handler failed
            if (activeLayersRef.current[activeTab] === newLayer) {
                delete activeLayersRef.current[activeTab];
            }
          }
        } else {
          console.error(`[VizUpdate Effect] Failed to create layer for type: ${vizType}`);
          // Ensure ref is cleared if layer creation failed
          delete activeLayersRef.current[activeTab];
        }
      } else {
        console.log("[VizUpdate Effect] Core Map active or no visualization selected. No layer added.");
        // Ensure ref is cleared for the active tab if it's Core Map
        delete activeLayersRef.current[activeTab];
      }

      // Update Legends
      if (legend) {
        if (showEsriLegend && newLayer && !isEditorOpen) {
            try {
                // Esri Legend setup...
                 await newLayer.when();
                 if (!isMounted) return;
                 console.log(`[VizUpdate Effect] Updating standard Esri legend for layer: ${newLayer.title}`);
                 legend.layerInfos = [{ layer: newLayer, title: newLayer.title || vizType, hideLayersNotInCurrentView: false }];
                 legend.visible = true;
            } catch (layerError) {
                console.error("[VizUpdate Effect] Error updating Esri legend:", layerError);
                if (legend) legend.visible = false;
            }
        } else {
            console.log(`[VizUpdate Effect] Hiding standard Esri legend. ShowEsriLegend: ${showEsriLegend}, isEditorOpen: ${isEditorOpen}`);
            legend.visible = false;
        }
      }
      if (isMounted) {
          setCustomLegendContent(customLegendData);
      }

    }; // end updateVisualizationAndLegend

    updateVisualizationAndLegend().catch(err => {
        console.error("[VizUpdate Effect] Unhandled error in updateVisualizationAndLegend:", err);
    }).finally(() => {
         console.log("[VizUpdate Effect] Update finished.");
    });

    // Cleanup
    return () => {
      isMounted = false;
      console.log("[VizUpdate Effect] Cleanup: Component unmounted or dependencies changed.");
    };

  }, [activeTab, tabs, mapView, legend, isEditorOpen, isConfigLoading, initialLayerConfigurations]); // Dependencies

  
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
    const nameColumn = config?.customData?.nameColumn; // Column for popup title
    const valueColumn = config?.field || config?.customData?.valueColumn; // Use field or valueColumn
    const latitudeColumn = config?.customData?.latitudeColumn || "latitude";
    const longitudeColumn = config?.customData?.longitudeColumn || "longitude";
    const symbolConfig = config?.symbol;
  
    console.log(`Processing ${customData.length} custom points using name='${nameColumn}', value='${valueColumn || "N/A"}', lat='${latitudeColumn}', lon='${longitudeColumn}'`);
  
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
            content: [{
              type: "fields",
              fieldInfos: [
                { fieldName: nameColumn, label: nameColumn },
                { fieldName: valueColumn, label: valueColumn || "Value" }
              ]
            }]
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
        if (item[latitudeColumn] !== undefined && item[longitudeColumn] !== undefined) {
          latitude = parseFloat(item[latitudeColumn]);
          longitude = parseFloat(item[longitudeColumn]);
        } else if (item.geometry && typeof item.geometry.y === "number" && typeof item.geometry.x === "number") {
          latitude = item.geometry.y;
          longitude = item.geometry.x;
        } else if (typeof item["lat"] === "number" && typeof item["lon"] === "number") {
          latitude = item["lat"];
          longitude = item["lon"];
        } else {
          console.warn(`Skipping custom item ${index} - missing valid coordinates`);
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
          };
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
          console.error(`Error creating graphic for custom item ${index}:`, graphicError);
          errorCount++;
        }
      });
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
      // --- Alternative Layer Removal using forEach ---
      const layersToRemove = [];
      // Iterate through the layers collection manually
      mapView.map.layers.forEach((layer) => {
        // Check properties directly and safely
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer); // Add layer to the removal array
        }
      });
      // --- End Alternative Layer Removal ---

      if (layersToRemove.length > 0) {
        // This console.log should now be safe from the deprecation warning triggered by filter/toArray
        console.log(
          `Removing ${layersToRemove.length} existing visualization layers.`
        );
        mapView.map.removeMany(layersToRemove); // Remove layers found in the array
      }

      // Find the active tab and its visualization type
      const activeTabData = tabs.find((tab) => tab.id === activeTab);

      // Only add new layer if we're not in the core map and have a selected type
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        // --- Normalize visualizationType ---
        let vizType = activeTabData.visualizationType;
        if (vizType === "pipeline") {
          console.log("Mapping 'pipeline' type to 'pipe'");
          vizType = "pipe";
        }
        // --- End Normalization ---

        const config = activeTabData.layerConfiguration;
        const areaType = activeTabData.areaType;
        console.log(`Creating/Updating visualization for: ${vizType}`, {
          config,
          areaType: areaType?.label,
        });

        // --- Type-Specific Handling ---
        let newLayer = null;
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType =
          specialTypes.includes(vizType) ||
          specialTypes.includes(config?.type) ||
          (config?.customData && config.customData.data);

          if (isSpecialType) {
            newLayer = await createLayers(vizType, config); // createLayers handles GraphicsLayer creation
            if (newLayer) {
              console.log(
                `Adding GraphicsLayer titled "${newLayer.title}" for type "${vizType}"`
              );
              mapView.map.add(newLayer, 0); // Add GraphicsLayer
              // Call specific visualization handlers
              if (vizType === "pipe")
                await handlePipeVisualization(activeTabData);
              else if (vizType === "comp")
                await handleCompVisualization(activeTabData);
              else if (vizType === "custom" || (config && config.customData)) {
                if (newLayer.graphics && newLayer.graphics.length > 0) {
                  console.log(
                    `Custom layer "${newLayer.title}" contains ${newLayer.graphics.length} graphics`
                  );
                  // Removed auto-zooming code to prevent zoom when loading custom maps
                  // Only log information about the graphics
                }
              }
            
          } else {
            console.error(
              `Failed to create GraphicsLayer for type: ${vizType}`
            );
          }
        } else {
          // Standard Heatmap/Dot Density use FeatureLayer
          newLayer = await createLayers(
            vizType,
            config,
            initialLayerConfigurations,
            areaType
          );
          if (newLayer) {
            console.log(
              `Adding FeatureLayer titled "${newLayer.title}" for type "${vizType}"`
            );
            mapView.map.add(newLayer, 0);
          } else {
            console.error(`Failed to create FeatureLayer for type: ${vizType}`);
          }
        }
        // --- End Type-Specific Handling ---

        // Update Legend for the newly added layer
        if (newLayer && legend) {
          try {
            await newLayer.when();
            console.log(
              "Updating legend for layer:",
              newLayer.title || vizType
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType,
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen;
          } catch (layerError) {
            console.error(
              "Error waiting for new layer or updating legend:",
              layerError
            );
            legend.visible = false;
          }
        } else if (legend) {
          console.log(
            "Hiding legend: No new layer created or legend object missing."
          );
          legend.visible = false;
        }
      } else {
        // Hide legend if no visualization
        if (legend) {
          console.log(
            "Hiding legend: Core Map active or no visualization type selected."
          );
          legend.visible = false;
        }
      }
    } catch (error) {
      console.error("Error updating visualization layer:", error);
      if (legend) {
        legend.visible = false;
      }
    }
  };

  useEffect(() => {
    try {
      console.log(
        "ArcGIS API Key:",
        import.meta.env.VITE_ARCGIS_API_KEY ? "Loaded" : "Not Found"
      );

      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

      if (!esriConfig.apiKey) {
        console.error("ArcGIS API Key is missing or undefined");
        // Optionally show a user-friendly error message
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
      esriConfig.request.interceptors.push({
        before: (params) => {
          console.log("ArcGIS Request Interceptor:", {
            url: params.url,
            method: params.method,
            headers: params.headers,
          });
        },
        error: (error) => {
          console.error("ArcGIS Request Error:", error);
        },
      });
    } catch (error) {
      console.error("ArcGIS Configuration Error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
  }, []);

  // Use the tab-specific configuration when switching tabs or rendering
  useEffect(() => {
    if (!mapView?.map || !legend) return;
    updateVisualizationLayer();
  }, [
    activeTab,
    tabs, // Added tabs to the dependency array
    mapView,
    legend,
    isEditorOpen,
    selectedAreaType,
  ]);

  // Updated handleTabClick function
  const handleTabClick = async (tabId) => {
    // Make async if createLayers is async
    console.log(`Switching to tab: ${tabId}`);
    setActiveTab(tabId); // Update active tab state first

    const newTabs = tabs.map((tab) => ({
      ...tab,
      active: tab.id === tabId,
      isEditing: false, // Close any open editing when switching tabs
    }));
    setTabs(newTabs); // Update the tabs array state

    // --- Update visualization and legend AFTER state is set ---
    // Use the newly updated `newTabs` and `tabId` directly
    const selectedTab = newTabs.find((tab) => tab.id === tabId);

    if (!selectedTab) {
      console.error(`Could not find tab data for ID: ${tabId}`);
      return;
    }

    if (!mapView?.map) {
      console.warn("Map view not ready during tab click.");
      return;
    }

    // --- Layer Management ---
    // Remove ALL existing visualization layers regardless of the target tab
    const layersToRemove = [];
    mapView.map.layers.forEach((layer) => {
      if (layer && layer.isVisualizationLayer === true) {
        layersToRemove.push(layer);
      }
    });
    if (layersToRemove.length > 0) {
      console.log(
        `[TabClick] Removing ${layersToRemove.length} existing visualization layers.`
      );
      mapView.map.removeMany(layersToRemove);
    }
    // --- End Layer Management ---

    // --- Legend Handling ---
    if (legend) {
      legend.layerInfos = []; // Clear legend infos
      legend.visible = false; // Hide legend initially
      console.log("[TabClick] Cleared and hid legend.");
    }
    // --- End Legend Handling ---

    // --- Add New Layer if Applicable ---
    if (tabId !== 1 && selectedTab.visualizationType) {
      console.log(
        `[TabClick] Tab ${tabId} has visualization: ${selectedTab.visualizationType}. Creating layer.`
      );
      let vizType = selectedTab.visualizationType;
      if (vizType === "pipeline") vizType = "pipe"; // Normalize
      if (vizType === "comps") vizType = "comp"; // Normalize

      // Create and add new layer for visualization tabs
      // Pass the correct parameters: type, config, base configs, area type
      const newLayer = await createLayers(
        vizType, // Use normalized type
        selectedTab.layerConfiguration,
        initialLayerConfigurations, // Pass the base list
        selectedTab.areaType
      );

      if (
        newLayer &&
        (newLayer instanceof FeatureLayer || newLayer instanceof GraphicsLayer)
      ) {
        console.log(
          `[TabClick] Created new layer: "${newLayer.title}". Adding to map.`
        );
        // *** Direct property assignment (already done in createLayers, but good practice) ***
        newLayer.isVisualizationLayer = true;
        // newLayer.visualizationType is set within createLayers

        mapView.map.add(newLayer, 0); // Add new layer

        // Handle specific drawing/zooming AFTER adding layer for pipe/comp/custom
        const specialTypes = ["pipe", "comp", "custom"];
        const isSpecialType = specialTypes.includes(newLayer.visualizationType);

        if (isSpecialType) {
          // Replace any code blocks like this:
          if (newLayer.visualizationType === "pipe") 
            await handlePipeVisualization(selectedTab);
          else if (newLayer.visualizationType === "comp")
            await handleCompVisualization(selectedTab);
          else if (newLayer.visualizationType === "custom") {
            // Remove or comment out the zooming part, if present
            // if (newLayer.graphics && newLayer.graphics.length > 0) {
            //   console.log("[TabClick] Zooming to custom graphics.");
            //   setTimeout(() => {
            //     if (mapView?.goTo)
            //       mapView.goTo(newLayer.graphics).catch(err => console.warn("Error zooming to custom graphics:", err));
            //   }, 500);
            // }
          }
        }

        // Update legend only for non-special types or if custom legend isn't handled separately
        if (legend && !isSpecialType) {
          // Only show standard legend for FeatureLayers usually
          try {
            await newLayer.when(); // Wait for layer
            console.log(
              "[TabClick] Updating Esri legend for FeatureLayer:",
              newLayer.title
            );
            legend.layerInfos = [
              {
                layer: newLayer,
                title: newLayer.title || vizType, // Use layer title or type
                hideLayersNotInCurrentView: false,
              },
            ];
            legend.visible = !isEditorOpen; // Show if editor isn't open
          } catch (layerError) {
            console.error(
              "[TabClick] Error waiting for FeatureLayer or updating legend:",
              layerError
            );
            legend.visible = false;
          }
        } else if (legend) {
          // Keep standard legend hidden for special types if they use custom legends or no legend
          console.log(
            "[TabClick] Keeping standard Esri legend hidden for special layer type:",
            newLayer.visualizationType
          );
          legend.visible = false;
        }
      } else {
        console.error(
          `[TabClick] Failed to create layer for visualization type: ${vizType}`
        );
        if (legend) legend.visible = false; // Ensure legend is hidden if layer fails
      }
    } else {
      console.log(
        `[TabClick] Tab ${tabId} is Core Map or has no visualization. No layer added.`
      );
      if (legend) legend.visible = false; // Hide legend for Core Map
    }
    console.log(
      `[TabClick] Finished handling click for tab ${tabId}. Active tab is now ${tabId}.`
    );
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
            legend.visible = !isEditorOpen; // Show if editor isn't open
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
              if (layer.get("isVisualizationLayer")) {
                layersToRemove.push(layer);
              }
            });
            layersToRemove.forEach((layer) => mapView.map.remove(layer));

            // Add new layer
            newLayer.set("isVisualizationLayer", true);
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

  const handleCreateMap = (mapData) => {
    // Log the data received from the dialog
    console.log("[MapComponent handleCreateMap] Received map data:", JSON.stringify(mapData, (k,v) => k === 'data' ? `[${v?.length} items]` : v, 2));

    // --- Calculate the next default map number (e.g., "Map 2", "Map 3") ---
    const existingTabNumbers = tabs
      .filter(tab => tab.id !== 1 && tab.name && tab.name.startsWith('Map ')) // Filter non-core tabs named like "Map X"
      .map(tab => parseInt(tab.name.replace('Map ', ''), 10)) // Extract the number
      .filter(num => !isNaN(num)); // Keep only valid numbers

    let nextTabNumber = 2; // Start default numbering at 2 (since "Core Map" is 1)
    if (existingTabNumbers.length > 0) {
      // Find the maximum existing number and add 1
      nextTabNumber = Math.max(...existingTabNumbers) + 1;
    }
    // Find the lowest available number starting from 2 if there are gaps
    let currentNum = 2;
    const sortedNumbers = existingTabNumbers.sort((a, b) => a - b);
    for (const num of sortedNumbers) {
        if (num === currentNum) {
            currentNum++;
        } else {
            // Found a gap
            nextTabNumber = currentNum;
            break;
        }
    }
    if (currentNum > Math.max(...sortedNumbers, 0)) {
        nextTabNumber = currentNum; // Use the next number if no gaps found
    }
    // --- End calculating next tab number ---

    // Generate a unique ID for the new tab
    const newTabId = Date.now();

    // --- Determine the Tab Name ---
    // Use the name from the dialog if provided and not empty, otherwise use the calculated default name.
    // This is where the previous 'mapName is not defined' error likely occurred if 'mapData.name' wasn't used correctly.
    const newTabName = mapData.name?.trim() ? mapData.name.trim() : `Map ${nextTabNumber}`;
    // --- End Determine Tab Name ---


    // --- Process map type and configuration ---
    let vizType = mapData.visualizationType || mapData.type; // Get type from mapData
    // Normalize type names if needed (e.g., pipeline -> pipe)
    if (vizType === "pipeline") vizType = "pipe";
    if (vizType === "comps") vizType = "comp";
    console.log(`[MapComponent handleCreateMap] Normalized visualization type: ${vizType}`);

    let layerConfiguration = mapData.layerConfiguration; // Start with config from dialog
    const areaType = mapData.areaType || areaTypes[0]; // Use areaType from dialog or default

    // If it's a standard heatmap/dot density, Map.jsx might need to look up the initial config
    // The dialog *should* pass null for layerConfiguration in this case.
    if ((mapData.type === 'heatmap' || mapData.type === 'dotdensity') && vizType && !layerConfiguration) {
        console.log(`[MapComponent handleCreateMap] Looking up initial config for standard type: ${vizType}`);
        layerConfiguration = initialLayerConfigurations[vizType];
        // Ensure the 'type' property is set within the looked-up config if it wasn't already
        if (layerConfiguration && !layerConfiguration.type) {
            layerConfiguration.type = vizType;
        }
    } else if (layerConfiguration) {
        // Ensure the 'type' property is consistent in the passed config
        if (!layerConfiguration.type) {
          layerConfiguration.type = vizType;
        }
        // Log the configuration being used for pipe/comp/custom
        console.log(`[MapComponent handleCreateMap] Using layerConfiguration passed from dialog for type ${vizType}:`, layerConfiguration);
    } else {
        console.warn(`[MapComponent handleCreateMap] No layerConfiguration found or determined for type: ${vizType}`);
        // Assign null explicitly if configuration couldn't be determined
        layerConfiguration = null;
    }
    // --- End Process map type and configuration ---

  // Create the new tab object to add to the state
  const newTab = {
    id: newTabId,
    configId: null, // Database ID will be assigned after saving
    name: newTabName,
    originalName: newTabName, // Store original name for editing
    active: true, // Set the new tab as active
    visualizationType: vizType,
    areaType: areaType, // Use the determined areaType object
    layerConfiguration: layerConfiguration, // Use the determined configuration
    isEditing: false,
  };
  console.log("[MapComponent handleCreateMap] Creating new tab object:", newTab);

  // Update the tabs state: deactivate old tabs, add the new active tab
  const newTabs = [...tabs.map((tab) => ({ ...tab, active: false })), newTab];
  setTabs(newTabs);

  // Set the active tab ID state
  setActiveTab(newTabId);

  // Close the dialog
  setIsNewMapDialogOpen(false);

  // Note: The useEffect hook watching [activeTab, tabs, ...] will handle
  // removing old layers and adding/rendering the new layer for this tab.
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
      const newActiveTab =
        activeTab === tabId
          ? remainingTabs[remainingTabs.length - 1].id
          : activeTab;

      const newTabs = remainingTabs.map((tab) => ({
        ...tab,
        active: tab.id === newActiveTab,
      }));

      // Update UI state
      setTabs(newTabs);
      setActiveTab(newActiveTab);

      // Clear visualization if deleted tab was active
      if (activeTab === tabId && mapView?.map) {
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach((layer) => mapView.map.remove(layer));

        // Hide legend
        if (legend) {
          legend.visible = false;
        }
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

  useEffect(() => {
    // Define the async function inside the effect
    const initializeConfigurations = async () => {
      // Guard clauses: Ensure necessary dependencies are ready
      if (!projectId) {
        console.log(
          "[Effect] No project ID available, skipping configuration initialization."
        );
        // Set default tabs if no project ID is found, ensure UI is consistent
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
        setIsConfigLoading(false); // Mark loading as complete
        return; // Exit early
      }

      if (!mapView?.map || !legend) {
        // Wait for map and legend to be ready
        console.log(
          "[Effect] Waiting for map view and legend to initialize..."
        );
        // Optional: Set loading state here if not already set
        // setIsConfigLoading(true);
        return; // Exit and wait for dependencies to update
      }

      // Proceed with loading configurations
      console.log(
        `[Effect] Initializing configurations for project: ${projectId}`
      );
      setIsConfigLoading(true); // Set loading state

      try {
        // Fetch configurations using the API helper
        const response = await mapConfigurationsAPI.getAll(projectId); // Already includes logging
        const configs = response?.data; // Safely access data

        console.log("[Effect] Received configurations from API:", configs);

        // Check if the fetched data is valid
        if (!Array.isArray(configs) || configs.length === 0) {
          console.log(
            "[Effect] No configurations found in API response, using default tabs."
          );
          setTabs([
            {
              id: 1,
              name: "Core Map",
              active: true, // Core Map starts active if no others exist
              visualizationType: null,
              areaType: areaTypes[0],
              layerConfiguration: null,
              isEditing: false,
            },
          ]);
          setActiveTab(1); // Ensure Core Map is the active tab
          // Clean up any stray visualization layers from previous state
          const layersToRemove = mapView.map.layers
            .filter((layer) => layer?.isVisualizationLayer)
            .toArray();
          if (layersToRemove.length > 0) mapView.map.removeMany(layersToRemove);
          legend.visible = false; // Hide legend
          setIsConfigLoading(false); // Mark loading as complete
          return; // Exit after setting defaults
        }

        // Create the base tabs array starting with Core Map (inactive initially)
        const newTabs = [
          {
            id: 1, // Keep consistent ID for Core Map
            name: "Core Map",
            active: false, // Will be activated later if it's the only tab or first tab
            visualizationType: null,
            areaType: areaTypes[0], // Default area type for Core Map
            layerConfiguration: null,
            isEditing: false,
          },
        ];

        // Process each configuration from the API response
        configs.forEach((config) => {
          if (!config || !config.id) {
            // Check if config and its ID exist
            console.warn(
              "[Effect] Skipping invalid config object received from API:",
              config
            );
            return; // Skip this config
          }

          console.log("[Effect] Processing config:", config);

          // Determine the next available ID (simple increment, ensure no conflicts with Core Map ID 1)
          // Using API config.id is generally better if available and unique
          const newTabId = config.id; // Use the ID from the database

          // --- Robust Area Type Handling ---
          const configAreaType = config.area_type; // e.g., 'tract', 'county', 11, 12
          let areaType = areaTypes[0]; // Default to the first area type

          if (configAreaType !== null && configAreaType !== undefined) {
            const areaTypeStr = String(configAreaType).toLowerCase();
            const foundType = areaTypes.find(
              (type) =>
                String(type.value) === areaTypeStr || // Match numeric value as string
                type.label.toLowerCase() === areaTypeStr // Match label (tract, county)
            );
            if (foundType) {
              areaType = foundType;
            } else {
              console.warn(
                `[Effect] Could not resolve area type "${configAreaType}", using default "${areaType.label}".`
              );
            }
          } else {
            console.warn(
              `[Effect] Config ${config.tab_name} missing area_type, using default "${areaType.label}".`
            );
          }
          // --- End Area Type Handling ---

          console.log(
            `[Effect] Config: ${config.tab_name}, Backend AreaType: ${configAreaType}, Resolved AreaType:`,
            areaType
          );

          // Create the new tab object
          const newTab = {
            id: newTabId, // Use the actual ID from the database
            configId: config.id, // Explicitly store the database config ID
            name: config.tab_name,
            active: false, // Set active status later
            visualizationType: config.visualization_type,
            areaType: areaType, // Use the resolved areaType object
            layerConfiguration: config.layer_configuration, // Use the config from DB
            isEditing: false,
          };

          console.log("[Effect] Created new tab:", newTab);
          newTabs.push(newTab);
        });

        // Activate the first tab (which will be Core Map if no others, or the first loaded config if Core Map isn't first)
        // Let's always activate Core Map initially if configs were loaded.
        if (newTabs.length > 0) {
          newTabs[0].active = true; // Activate Core Map
          setActiveTab(1); // Set active tab ID to Core Map's ID
        }

        console.log(
          "[Effect] Setting tabs state after initialization:",
          newTabs
        );
        setTabs(newTabs); // Update the state with all tabs

        // No need to explicitly call updateVisualizationLayer here,
        // as changing `tabs` and `activeTab` state will trigger the other useEffect
        // that depends on them, ensuring the correct layer is displayed for the active tab (which is Core Map initially).
      } catch (error) {
        console.error("[Effect] Error initializing configurations:", error);
        // Set default tabs state on error to prevent broken UI
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
      } finally {
        setIsConfigLoading(false); // Ensure loading state is always turned off
        console.log("[Effect] Configuration initialization complete.");
      }
    };

    // Call the initialization function
    initializeConfigurations();

    // No cleanup needed in this effect unless subscribing to something
    // return () => { /* cleanup logic */ };

    // Dependencies: Re-run when projectId, mapView, or legend changes/becomes available
  }, [projectId, mapView, legend]); // Make sure all external dependencies used are listed

  // --- Removed the redundant useEffect that only watched mapView ---
  // useEffect(() => {
  //   if (mapView?.map) {
  //     loadMapConfigurations(); // This logic is now handled by the effect above
  //   }
  // }, [mapView]);
  // --- End Removed useEffect ---

  // Full loadMapConfigurations function (primarily used internally or if manual reload is needed)
  const loadMapConfigurations = async () => {
    // This function duplicates some logic from the useEffect hook.
    // It might be better to refactor so the useEffect calls this,
    // or keep this for potential manual refresh actions.
    // For now, keeping it separate as requested, with its own checks.

    if (!projectId) {
      console.warn(
        "[loadMapConfigurations] No project ID available, cannot load."
      );
      // Consider setting default state here too if called manually without project ID
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
      return false; // Indicate failure/no action
    }

    console.log(
      `[loadMapConfigurations] Attempting to load configurations for project: ${projectId}`
    );
    setIsConfigLoading(true); // Set loading state

    try {
      const response = await mapConfigurationsAPI.getAll(projectId); // API function handles logging
      const mapConfigs = response?.data;

      console.log(
        "[loadMapConfigurations] Loaded raw map configurations:",
        mapConfigs
      );

      if (!Array.isArray(mapConfigs) || mapConfigs.length === 0) {
        console.log(
          "[loadMapConfigurations] No configurations found, using default tabs"
        );
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
        setActiveTab(1); // Ensure Core Map is active
        // Clear any existing visualization layer
        if (mapView?.map) {
          const layersToRemove = mapView.map.layers
            .filter((layer) => layer?.isVisualizationLayer)
            .toArray();
          if (layersToRemove.length > 0) mapView.map.removeMany(layersToRemove);
          if (legend) legend.visible = false;
        }
        setIsConfigLoading(false);
        return false; // Indicate no configs loaded
      }

      // Create base tabs array with Core Map
      const newTabs = [
        {
          id: 1,
          name: "Core Map",
          active: false,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false,
        },
      ];

      // Process each configuration into a tab
      mapConfigs.forEach((config, index) => {
        if (!config || !config.id) {
          console.warn(
            "[loadMapConfigurations] Skipping invalid config object:",
            config
          );
          return;
        }

        const newTabId = config.id; // Use API ID
        const configAreaType = config.area_type;
        let areaType = areaTypes[0]; // Default

        if (configAreaType !== null && configAreaType !== undefined) {
          const areaTypeStr = String(configAreaType).toLowerCase();
          const foundType = areaTypes.find(
            (type) =>
              String(type.value) === areaTypeStr ||
              type.label.toLowerCase() === areaTypeStr
          );
          if (foundType) {
            areaType = foundType;
          } else {
            console.warn(
              `[loadMapConfigurations] Could not resolve area type "${configAreaType}", using default.`
            );
          }
        } else {
          console.warn(
            `[loadMapConfigurations] Config ${config.tab_name} missing area_type, using default.`
          );
        }

        const newTab = {
          id: newTabId,
          configId: config.id,
          name: config.tab_name,
          active: false,
          visualizationType: config.visualization_type,
          areaType: areaType,
          layerConfiguration: config.layer_configuration,
          isEditing: false,
        };
        newTabs.push(newTab);
      });

      // Activate first tab (Core Map) and update state
      if (newTabs.length > 0) {
        newTabs[0].active = true;
        setActiveTab(1);
      }
      console.log("[loadMapConfigurations] Setting tabs state:", newTabs);
      setTabs(newTabs);

      // Wait for state updates (optional, usually handled by effects)
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger visualization update for the *currently active* tab (which is now Core Map)
      // This will correctly hide any previous visualization.
      await updateVisualizationLayer(); // Explicitly call update after setting tabs

      setIsConfigLoading(false); // Mark loading as complete
      console.log("[loadMapConfigurations] Configuration loading complete.");
      return true; // Indicate success
    } catch (error) {
      console.error(
        "[loadMapConfigurations] Failed to load map configurations:",
        error
      );
      // Set default tabs on error
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
      return false; // Indicate failure
    }
  };

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

  // Update the useEffect that calls loadMapConfigurations
  useEffect(() => {
    if (mapView?.map) {
      loadMapConfigurations();
    }
  }, [mapView]);



  const handleLayerConfigChange = useCallback((newConfig) => {
      console.log("[ConfigChange] Updating tabs state with new config:", newConfig);

      setTabs(prevTabs => {
          return prevTabs.map((tab) =>
              tab.id === activeTab && tab.visualizationType
              ? {
                  ...tab,
                  layerConfiguration: {
                      ...newConfig,
                      // Preserve symbol structure if not explicitly changed by newConfig
                      symbol: newConfig.symbol || tab.layerConfiguration?.symbol,
                      // Ensure type is consistent
                      type: newConfig.type || tab.layerConfiguration?.type || tab.visualizationType,
                  },
                }
              : tab
          );
      });

      // --- REMOVED onPreview CALL ---
      // The main useEffect watching `tabs` will now handle re-rendering
      // the layer based on this state update when the user implicitly
      // confirms the change (e.g., by closing editor or saving).
      // If live preview *on the main map* is essential during editing,
      // the `onPreview` prop and `handleConfigPreview` function need
      // careful implementation to manage temporary layers without
      // conflicting with the main state/useEffect loop.
      console.log("[ConfigChange] Tabs state update triggered. Main useEffect will handle layer update.");

  }, [activeTab, setTabs, tabs]); // Include dependencies for useCallback


  // Add this function to extract style properties consistently:
  const extractSymbolProperties = (config) => {
    const symbol = config?.symbol || {};
    return {
      size: symbol.size !== undefined ? Number(symbol.size) : 12,
      color: symbol.color || "#800080", // Default purple for comp
      outline: {
        color: symbol.outline?.color || "#FFFFFF",
        width: symbol.outline?.width !== undefined ? Number(symbol.outline.width) : 1
      },
      style: symbol.style || "circle"
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

    console.log("[Preview] Starting preview with config:", JSON.stringify(previewConfig, (k,v) => k === 'customData' ? `[${v?.data?.length} items]` : v));

    try {
      // --- Layer Removal ---
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.isVisualizationLayer === true) {
          layersToRemove.push(layer);
        }
      });
      if (layersToRemove.length > 0) {
        console.log(`[Preview] Removing ${layersToRemove.length} existing visualization layers.`);
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
           console.warn("[Preview] Preview config missing 'type'. Attempting to infer or use active tab type.");
           effectiveType = activeTabData.visualizationType; // Fallback to active tab type
           if (previewConfig.customData && !effectiveType) effectiveType = 'custom'; // Infer if custom data exists
           if (!effectiveType) {
               console.error("[Preview] Could not determine effective type for preview.");
               await updateVisualizationLayer(); // Restore original
               return;
           }
      }

      // Normalize type
      if (effectiveType === "pipeline") effectiveType = "pipe";
      if (effectiveType === "comps") effectiveType = "comp";
      if (effectiveType && effectiveType.endsWith('_HEAT')) effectiveType = 'class-breaks';

      console.log(`[Preview] Effective Preview Type: ${effectiveType}`);
      // --- End Determine Effective Type ---

      // Create the new layer using the PREVIEW configuration and determined type
      let newLayer = null;
      const specialTypes = ["pipe", "comp", "custom"];
      const isSpecialType = specialTypes.includes(effectiveType) || (previewConfig.customData && !['class-breaks', 'dot-density'].includes(effectiveType));


      if (isSpecialType) {
          // Ensure the preview config has the correct type set for the creator function
          const configForCreator = { ...previewConfig, type: effectiveType };
          console.log(`[Preview] Creating GraphicsLayer (${effectiveType}) using preview config.`);

          if (effectiveType === "pipe") {
              newLayer = createPipeLayer(configForCreator);
          } else if (effectiveType === "comp") {
              newLayer = createCompLayer(configForCreator);
          } else { // Assume custom if not pipe or comp
              newLayer = await createGraphicsLayerFromCustomData(configForCreator);
          }
      } else {
        // Standard visualization type (heatmap, dot-density)
        console.log(`[Preview] Creating FeatureLayer (${effectiveType}) using preview config.`);
        newLayer = await createLayers(
          effectiveType, // Pass the determined type
          previewConfig, // Pass the PREVIEW configuration object
          initialLayerConfigurations,
          activeTabData.areaType || selectedAreaType // Use area type from the active tab
        );
      }

      // --- Add Layer and Update Legend ---
      if (newLayer && (newLayer instanceof FeatureLayer || newLayer instanceof GraphicsLayer)) {
        console.log(`[Preview] Successfully created layer: "${newLayer.title}", type: "${newLayer.visualizationType || effectiveType}". Adding to map.`);
        // Ensure flag is set (should be done in creators)
        newLayer.isVisualizationLayer = true;

        mapView.map.add(newLayer, 0);

        // Update legend
        if (legend) {
          try {
            await newLayer.when();
            console.log("[Preview] Updating legend for preview layer:", newLayer.title);
            legend.layerInfos = [{
              layer: newLayer,
              title: `${newLayer.title || effectiveType} (Preview)`,
              hideLayersNotInCurrentView: false,
            }];
            legend.visible = true;
          } catch (legendError) {
            console.error("[Preview] Error updating legend:", legendError);
            legend.visible = false;
          }
        }
      } else {
        console.error(`[Preview] Failed to create layer for preview type ${effectiveType}.`);
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
  // Add these useEffects after your existing ones
  useEffect(() => {
    // Load auto-saved configurations on mount
    loadMapConfigurations(AUTO_SAVE_KEY, false);
  }, []);

// In MapComponent.jsx - Add this useEffect to listen for refresh events
useEffect(() => {
  // Event listener for forced visualization refreshes
  const handleRefreshVisualization = (event) => {
    const { tabId, config } = event.detail;
    console.log("[RefreshEvent] Received refresh event for tab", tabId, "with config:", config);
    
    if (!tabId || !mapView?.map) return;
    
    // Get the tab data
    const tabData = tabs.find(tab => tab.id === tabId);
    if (!tabData) {
      console.error("[RefreshEvent] Could not find tab data for ID:", tabId);
      return;
    }
    
    // Get the visualization type
    let vizType = tabData.visualizationType;
    if (!vizType) return;
    
    // Normalize visualization type
    if (vizType === "pipeline") vizType = "pipe";
    if (vizType === "comps") vizType = "comp";
    
    console.log(`[RefreshEvent] Refreshing visualization for tab ${tabId}, type: ${vizType}`);
    
    // Force layer removal first
    const layersToRemove = [];
    mapView.map.layers.forEach(layer => {
      if (layer && layer.isVisualizationLayer === true) {
        layersToRemove.push(layer);
      }
    });
    
    if (layersToRemove.length > 0) {
      console.log(`[RefreshEvent] Removing ${layersToRemove.length} existing visualization layers`);
      mapView.map.removeMany(layersToRemove);
    }
    
    // Create a new layer with the updated configuration
    createLayers(vizType, config || tabData.layerConfiguration, initialLayerConfigurations, tabData.areaType)
      .then(newLayer => {
        if (!newLayer) {
          console.error("[RefreshEvent] Failed to create new layer");
          return;
        }
        
        // Add the new layer to the map
        console.log(`[RefreshEvent] Adding new ${vizType} layer to map`);
        mapView.map.add(newLayer, 0);
        
        // Special handling for specific layer types
        if (vizType === "pipe") {
          console.log("[RefreshEvent] Refreshing pipe visualization");
          handlePipeVisualization(tabData);
        } else if (vizType === "comp") {
          console.log("[RefreshEvent] Refreshing comp visualization");
          handleCompVisualization(tabData);
        } else if (vizType === "custom") {
          console.log("[RefreshEvent] Refreshing custom visualization");
          handleCustomDataVisualization(tabData);
        }
        
        // Update legend if necessary
        if (legend) {
          legend.layerInfos = [{
            layer: newLayer,
            title: newLayer.title || vizType,
            hideLayersNotInCurrentView: false
          }];
          legend.visible = !isEditorOpen;
        }
      })
      .catch(error => {
        console.error("[RefreshEvent] Error creating or updating layer:", error);
      });
  };
  
  // Add event listener for refresh events
  window.addEventListener('refreshVisualization', handleRefreshVisualization);
  
  // Clean up event listener when component unmounts
  return () => {
    window.removeEventListener('refreshVisualization', handleRefreshVisualization);
  };
}, [mapView, tabs, legend, isEditorOpen, handlePipeVisualization, handleCompVisualization, handleCustomDataVisualization]);

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
                        value={tab.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onChange={(e) =>
                          setTabs(
                            tabs.map((t) =>
                              t.id === tab.id
                                ? { ...t, name: e.target.value }
                                : t
                            )
                          )
                        }
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
                // Only show controls if not the Core Map tab
                const activeTabData = tabs.find((tab) => tab.id === activeTab);
                // Find the corresponding visualization option to check its type
                const activeVisOption = visualizationOptions.find(
                  (opt) => opt.value === activeTabData?.visualizationType
                );
                // Dropdowns shown only if the active visualization option is heat or dot density
                const showDropdowns =
                  activeVisOption &&
                  (activeVisOption.type === "class-breaks" ||
                    activeVisOption.type === "dot-density");
                // Edit button shown if the active tab is NOT the core map (ID 1)
                const showEditButton = activeTab !== 1;

                return (
                  <>
                    {/* Conditionally render Area Type and Visualization Dropdowns */}
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

                    {/* Conditionally render Edit Map/Legend Button */}
                    {showEditButton && ( // Now shows for ANY non-core tab
                      <button
                        onClick={() => setIsEditorOpen(true)}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                        title="Edit layer properties"
                      >
                        Edit Map/Legend
                      </button>
                    )}
                  </>
                );
              })()}

            {/* Save Button (Always visible) */}
            <button
              onClick={async () => {
                // --- Existing Save Logic ---
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

                  const createdConfigs = []; // Store created config IDs
                  for (const config of configurations) {
                    // Ensure project field is sent if API requires it
                    const response = await mapConfigurationsAPI.create(
                      projectId,
                      { ...config, project: projectId }
                    );
                    if (response.data && response.data.id) {
                      createdConfigs.push({
                        tabName: config.tab_name,
                        configId: response.data.id,
                      });
                    }
                  }

                  // Update tab state with new config IDs
                  setTabs((prevTabs) =>
                    prevTabs.map((t) => {
                      const created = createdConfigs.find(
                        (c) => c.tabName === t.name
                      );
                      // Make sure configId is updated or kept if it already existed
                      const existingConfigId = t.configId;
                      const newConfigId = created
                        ? created.configId
                        : existingConfigId;
                      return { ...t, configId: newConfigId };
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
                // --- End Existing Save Logic ---
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
      <div className="flex flex-1 overflow-hidden">
        {/* Map container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full">
            {/* Zoom Alert Overlay */}
            <ZoomAlert />
            {renderCustomLegend()}

          </div>
        </div>

        {/* Layer Properties Editor Panel */}
        <div className="relative">
          {" "}
          {/* Keep this relative for absolute positioning of the child */}
          {/* Conditionally render editor panel container - check activeTab !== 1 */}
          {activeTab !== 1 && (
            <div
              className={`
                w-[500px] bg-white dark:bg-gray-800 border-l border-gray-200
                dark:border-gray-700 transform transition-transform duration-300 ease-in-out
                absolute h-full z-20 /* Ensure editor is above map */
                ${isEditorOpen ? "translate-x-0" : "translate-x-full"}
              `}
              // --- Restore specific positioning ---
              style={{
                right: "440px", // Position 440px from the right edge of the parent
                top: "0",
              }}
              // --- End Restore specific positioning ---
            >
              <LayerPropertiesEditor
                isOpen={isEditorOpen} // Pass isOpen prop to control visibility via CSS transform
                onClose={() => setIsEditorOpen(false)}
                visualizationType={
                  tabs.find((tab) => tab.id === activeTab)?.visualizationType
                }
                layerConfig={
                  tabs.find((tab) => tab.id === activeTab)
                    ?.layerConfiguration ||
                  (tabs.find((tab) => tab.id === activeTab)?.visualizationType
                    ? initialLayerConfigurations[
                        tabs.find((tab) => tab.id === activeTab)
                          .visualizationType
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
              />
            </div>
          )}
        </div>
      </div>

      {/* New Map Dialog */}
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