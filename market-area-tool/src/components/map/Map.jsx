import { useEffect, useRef, useState } from "react";
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
import PropTypes from 'prop-types';
import axios from 'axios';
import { useNavigate, useParams } from "react-router-dom"; // Add useNavigate here
import { mapConfigurationsAPI } from '../../services/api';  // Adjust the path as needed
import SearchableDropdown from './SearchableDropdown'; // Adjust the import path as needed

const API_KEY = process.env.REACT_APP_ARCGIS_API_KEY || "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg";


const colorScheme = {
  level1: [128, 0, 128, 0.45],      // Purple
  level2: [0, 0, 139, 0.45],        // Dark blue
  level3: [135, 206, 235, 0.45],    // Sky blue
  level4: [144, 238, 144, 0.45],    // Light green
  level5: [255, 255, 144, 0.45],    // Light yellow
  level6: [255, 165, 0, 0.45],      // Orange
  level7: [255, 99, 71, 0.45]       // Salmon red
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
        width: "0.5px"
      }
    },
    label: labels[index]
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
        { min: 100000 }
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more"
      ]
    )
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
        { min: 100000 }
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more"
      ]
    )
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
        { min: 40000 }
      ],
      [
        "Less than 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 - 40,000",
        "40,000 or more"
      ]
    )
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
        { min: 50000 }
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more"
      ]
    )
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
        { min: 20 }
      ],
      [
        "Less than 2%",
        "2% - 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% or more"
      ]
    )
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
        { min: 15 }
      ],
      [
        "Less than 3%",
        "3% - 6%",
        "6% - 9%",
        "9% - 12%",
        "12% - 15%",
        "15% or more"
      ]
    )
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
        { min: 10 }
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 200 }
      ],
      [
        "Less than 10 homes",
        "10 - 25 homes",
        "25 - 50 homes",
        "50 - 100 homes",
        "100 - 200 homes",
        "200+ homes"
      ]
    )
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
        { min: 10000 }
      ],
      [
        "Less than 1,000/sq mi",
        "1,000 - 2,500/sq mi",
        "2,500 - 5,000/sq mi",
        "5,000 - 7,500/sq mi",
        "7,500 - 10,000/sq mi",
        "10,000+/sq mi"
      ]
    )
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
        { min: 90 }
      ],
      [
        "Less than 35%",
        "35% - 50%",
        "50% - 65%",
        "65% - 80%",
        "80% - 90%",
        "90% or more"
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
        { min: 200000 }
      ],
      [
        "Less than $35,000",
        "$35,000 - $65,000",
        "$65,000 - $95,000",
        "$95,000 - $125,000",
        "$125,000 - $155,000",
        "$155,000 - $200,000",
        "$200,000 or more"
      ]
    )
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
        { min: 2 }
      ],
      [
        "Less than -3%",
        "-3% to -2%",
        "-2% to -1%",
        "-1% to 0%",
        "0% to 1%",
        "1% to 2%",
        "2% or more"
      ]
    )
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
        { min: 15000 }
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 7,500",
        "7,500 - 10,000",
        "10,000 - 15,000",
        "15,000 or more"
      ]
    )
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
        { min: 55 }
      ],
      [
        "Less than 30 years",
        "30 - 35 years",
        "35 - 40 years",
        "40 - 45 years",
        "45 - 50 years",
        "50 - 55 years",
        "55 years or more"
      ]
    )
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
        { min: 13 }
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 9%",
        "9% - 11%",
        "11% - 13%",
        "13% or more"
      ]
    )
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
        { min: 1500000 }
      ],
      [
        "Less than $200,000",
        "$200,000 - $350,000",
        "$350,000 - $500,000",
        "$500,000 - $750,000",
        "$750,000 - $1,000,000",
        "$1,000,000 - $1,500,000",
        "$1,500,000 or more"
      ]
    )
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
        { min: 175 }
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 150",
        "150 - 175",
        "175 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 0 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 0 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 150000 }
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $125,000",
        "$125,000 - $150,000",
        "$150,000 or more"
      ]
    )
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
        { min: 55 }
      ],
      [
        "Less than 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 45%",
        "45% - 55%",
        "55% or more"
      ]
    )
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
        { min: 90 }
      ],
      [
        "Less than 30%",
        "30% - 45%",
        "45% - 60%",
        "60% - 75%",
        "75% - 90%",
        "90% or more"
      ]
    )
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
        { min: 25 }
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% or more"
      ]
    )
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
        { min: 95 }
      ],
      [
        "Less than 40%",
        "40% - 55%",
        "55% - 70%",
        "70% - 85%",
        "85% - 95%",
        "95% or more"
      ]
    )
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
        { min: 60 }
      ],
      [
        "Less than 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 45%",
        "45% - 60%",
        "60% or more"
      ]
    )
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
        { min: 85000 }
      ],
      [
        "Less than $25,000",
        "$25,000 - $40,000",
        "$40,000 - $55,000",
        "$55,000 - $70,000",
        "$70,000 - $85,000",
        "$85,000 or more"
      ]
    )
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
        { min: 4.0 }
      ],
      [
        "Less than 2.0",
        "2.0 - 2.5",
        "2.5 - 3.0",
        "3.0 - 3.5",
        "3.5 - 4.0",
        "4.0 or more"
      ]
    )
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
        { min: 3 }
      ],
      [
        "Less than -1%",
        "-1% to 0%",
        "0% to 1%",
        "1% to 2%",
        "2% to 3%",
        "3% or more"
      ]
    )
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
        { min: 55 }
      ],
      [
        "Less than 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 45%",
        "45% - 55%",
        "55% or more"
      ]
    )
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
        { min: 200 }
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 150",
        "150 - 200",
        "200 or more"
      ]
    )
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
        { min: 150 }
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 150",
        "150 or more"
      ]
    )
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
        { min: 30 }
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more"
      ]
    )
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
        { min: 35 }
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more"
      ]
    )
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
        { min: 35 }
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more"
      ]
    )
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
        { min: 35 }
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more"
      ]
    )
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
        { min: 30 }
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more"
      ]
    )
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
        { min: 70 }
      ],
      [
        "Less than 50%",
        "50% - 55%",
        "55% - 60%",
        "60% - 65%",
        "65% - 70%",
        "70% or more"
      ]
    )
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
        { min: 40 }
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 20%",
        "20% - 30%",
        "30% - 40%",
        "40% or more"
      ]
    )
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
        { min: 60 }
      ],
      [
        "Less than 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 45%",
        "45% - 60%",
        "60% or more"
      ]
    )
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
        { min: 100000 }
      ],
      [
        "Less than 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 - 100,000",
        "100,000 or more"
      ]
    )
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
        { min: 30 }
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 30%",
        "30% or more"
      ]
    )
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
        { min: 30 }
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 30%",
        "30% or more"
      ]
    )
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
        { min: 5 }
      ],
      [
        "Less than 1%",
        "1% - 2%",
        "2% - 3%",
        "3% - 4%",
        "4% - 5%",
        "5% or more"
      ]
    )
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
        { min: 5 }
      ],
      [
        "Less than 0%",
        "0% - 1%",
        "1% - 2%",
        "2% - 3%",
        "3% - 5%",
        "5% or more"
      ]
    )
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
        { min: 35 }
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more"
      ]
    )
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
        { min: 15 }
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more"
      ]
    )
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
        { min: 50 }
      ],
      [
        "Less than 10%",
        "10% - 20%",
        "20% - 30%",
        "30% - 40%",
        "40% - 50%",
        "50% or more"
      ]
    )
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
        { min: 30 }
      ],
      [
        "Less than 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% or more"
      ]
    )
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
        { min: 35 }
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% or more"
      ]
    )
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
        { min: 20000 }
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 or more"
      ]
    )
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
        { min: 20000 }
      ],
      [
        "Less than 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 or more"
      ]
    )
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
        { min: 1000000 }
      ],
      [
        "Less than $200,000",
        "$200,000 - $350,000",
        "$350,000 - $500,000",
        "$500,000 - $750,000",
        "$750,000 - $1,000,000",
        "$1,000,000 or more"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 250 }
      ],
      [
        "Less than 10 homes",
        "10 - 25 homes",
        "25 - 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250+ homes"
      ]
    )
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
        { min: 2000 }
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes"
      ]
    )
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
        { min: 50000 }
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more"
      ]
    )
  },

  // Young adults (20-34)
  youngAdults_HEAT: {
    type: "class-breaks",
    field: "POP20_CY",  // Using 20-24 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25 }
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% or more"
      ]
    )
  },

  // Middle-aged adults (35-54)
  middleAged_HEAT: {
    type: "class-breaks",
    field: "POP35_CY",  // Using 35-39 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 }
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more"
      ]
    )
  },

  // Pre-retirement (55-64)
  preRetirement_HEAT: {
    type: "class-breaks",
    field: "POP55_CY",  // Using 55-59 as a representative, could combine with 60-64
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 7.5 },
        { min: 7.5, max: 10 },
        { min: 10, max: 12.5 },
        { min: 12.5, max: 15 },
        { min: 15 }
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more"
      ]
    )
  },

  // Elderly (75+)
  elderly_HEAT: {
    type: "class-breaks",
    field: "POP75_CY",  // Using 75-79 as a representative, could combine multiple fields
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 10 },
        { min: 10 }
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more"
      ]
    )
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
        { min: 10 }
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 10%",
        "10% or more"
      ]
    )
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
        { min: 15 }
      ],
      [
        "Less than 5%",
        "5% - 7.5%",
        "7.5% - 10%",
        "10% - 12.5%",
        "12.5% - 15%",
        "15% or more"
      ]
    )
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
        { min: 2000 }
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes"
      ]
    )
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
        { min: 2000 }
      ],
      [
        "Less than 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000 - 2,000 homes",
        "2,000+ homes"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 homes",
        "50 - 100 homes",
        "100 - 250 homes",
        "250 - 500 homes",
        "500 - 1,000 homes",
        "1,000+ homes"
      ]
    )
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
        { min: 2000 }
      ],
      [
        "Less than 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000 - 2,000 households",
        "2,000+ households"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households"
      ]
    )
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
        { min: 1000 }
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000+ households"
      ]
    )
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
        { min: 2000 }
      ],
      [
        "Less than 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 1,000 households",
        "1,000 - 2,000 households",
        "2,000+ households"
      ]
    )
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
        { min: 50000 }
      ],
      [
        "Less than 2,500",
        "2,500 - 5,000",
        "5,000 - 10,000",
        "10,000 - 25,000",
        "25,000 - 50,000",
        "50,000 or more"
      ]
    )
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
    attributes: [{ field: "TOTPOP_CY", color: "#E60049", label: "Total Population" }]
  },
  TOTHH_CY: {
    type: "dot-density",
    field: "TOTHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [{ field: "TOTHH_CY", color: "#0BB4FF", label: "Total Households" }]
  },
  DPOP_CY: {
    type: "dot-density",
    field: "DPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "DPOP_CY", color: "#50E991", label: "Daytime Population" }]
  },
  DPOPWRK_CY: {
    type: "dot-density",
    field: "DPOPWRK_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "DPOPWRK_CY", color: "#9B19F5", label: "Daytime Workers" }]
  },
  WORKAGE_CY: {
    type: "dot-density",
    field: "WORKAGE_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "WORKAGE_CY", color: "#FFB400", label: "Working Age Population" }]
  },
  SENIOR_CY: {
    type: "dot-density",
    field: "SENIOR_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "SENIOR_CY", color: "#007ED6", label: "Senior Population" }]
  },
  CHILD_CY: {
    type: "dot-density",
    field: "CHILD_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "children" },
    attributes: [{ field: "CHILD_CY", color: "#FF6B6B", label: "Child Population" }]
  },
  HISPPOP_CY: {
    type: "dot-density",
    field: "HISPPOP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "HISPPOP_CY", color: "#007ED6", label: "Hispanic Population" }]
  },
  NHSPWHT_CY: {
    type: "dot-density",
    field: "NHSPWHT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPWHT_CY", color: "#5954D6", label: "White Non-Hispanic Population" }]
  },
  NHSPBLK_CY: {
    type: "dot-density",
    field: "NHSPBLK_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPBLK_CY", color: "#9B19F5", label: "Black Non-Hispanic Population" }]
  },
  NHSPASN_CY: {
    type: "dot-density",
    field: "NHSPASN_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPASN_CY", color: "#FF6B6B", label: "Asian Non-Hispanic Population" }]
  },
  NHSPAI_CY: {
    type: "dot-density",
    field: "NHSPAI_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPAI_CY", color: "#00C6B7", label: "American Indian/Alaska Native Non-Hispanic" }]
  },
  EMP_CY: {
    type: "dot-density",
    field: "EMP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMP_CY", color: "#00BA3F", label: "Employed Population" }]
  },
  UNEMP_CY: {
    type: "dot-density",
    field: "UNEMP_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNEMP_CY", color: "#E60049", label: "Unemployed Population" }]
  },
  OWNER_CY: {
    type: "dot-density",
    field: "OWNER_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [{ field: "OWNER_CY", color: "#0BB4FF", label: "Owner Occupied Housing" }]
  },
  RENTER_CY: {
    type: "dot-density",
    field: "RENTER_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [{ field: "RENTER_CY", color: "#FFB400", label: "Renter Occupied Housing" }]
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
    attributes: [{ field: "POP0_CY", color: "#FF9E8F", label: "Population Age 0-4" }]
  },
  POP5_CY: {
    type: "dot-density",
    field: "POP5_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP5_CY", color: "#FF8E72", label: "Population Age 5-9" }]
  },
  POP10_CY: {
    type: "dot-density",
    field: "POP10_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP10_CY", color: "#FF7E55", label: "Population Age 10-14" }]
  },
  POP15_CY: {
    type: "dot-density",
    field: "POP15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP15_CY", color: "#FF6E38", label: "Population Age 15-19" }]
  },
  POP35_CY: {
    type: "dot-density",
    field: "POP35_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP35_CY", color: "#FFF4B3", label: "Population Age 35-39" }]
  },
  POP40_CY: {
    type: "dot-density",
    field: "POP40_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP40_CY", color: "#B3FFB3", label: "Population Age 40-44" }]
  },
  POP45_CY: {
    type: "dot-density",
    field: "POP45_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP45_CY", color: "#B3D1FF", label: "Population Age 45-49" }]
  },
  POP50_CY: {
    type: "dot-density",
    field: "POP50_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP50_CY", color: "#FFB3E6", label: "Population Age 50-54" }]
  },
  POP55_CY: {
    type: "dot-density",
    field: "POP55_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP55_CY", color: "#FFE6B3", label: "Population Age 55-59" }]
  },
  POP60_CY: {
    type: "dot-density",
    field: "POP60_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP60_CY", color: "#E6FFB3", label: "Population Age 60-64" }]
  },
  POP65_CY: {
    type: "dot-density",
    field: "POP65_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP65_CY", color: "#B3FFE6", label: "Population Age 65-69" }]
  },
  POP70_CY: {
    type: "dot-density",
    field: "POP70_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP70_CY", color: "#B3FFFF", label: "Population Age 70-74" }]
  },
  POP75_CY: {
    type: "dot-density",
    field: "POP75_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP75_CY", color: "#B3B3FF", label: "Population Age 75-79" }]
  },
  POP80_CY: {
    type: "dot-density",
    field: "POP80_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP80_CY", color: "#E6B3FF", label: "Population Age 80-84" }]
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
    attributes: [{ field: "GENALPHACY", color: "#FFB400", label: "Generation Alpha" }]
  },
  GENZ_CY: {
    type: "dot-density",
    field: "GENZ_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "GENZ_CY", color: "#FF6B6B", label: "Generation Z" }]
  },
  MILLENN_CY: {
    type: "dot-density",
    field: "MILLENN_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "MILLENN_CY", color: "#4ECDC4", label: "Millennials" }]
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
    attributes: [{ field: "NOHS_CY", color: "#FF6B6B", label: "Less than 9th Grade" }]
  },
  SOMEHS_CY: {
    type: "dot-density",
    field: "SOMEHS_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "SOMEHS_CY", color: "#FFB400", label: "Some High School" }]
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
    attributes: [{ field: "HINC0_CY", color: "#E60049", label: "Income < $15,000" }]
  },
  HINC15_CY: {
    type: "dot-density",
    field: "HINC15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [{ field: "HINC15_CY", color: "#0BB4FF", label: "Income $15,000-$24,999" }]
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
    attributes: [{ field: "VAL0_CY", color: "#50E991", label: "Home Value < $50,000" }]
  },
  VAL50K_CY: {
    type: "dot-density",
    field: "VAL50K_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [{ field: "VAL50K_CY", color: "#9B19F5", label: "Home Value $50,000-$99,999" }]
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
    attributes: [{ field: "CIVLBFR_CY", color: "#0BB4FF", label: "Civilian Labor Force" }]
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
    attributes: [{ field: "EMPWHTCY", color: "#E60049", label: "White Employed" }]
  },
  EMPBLKCY: {
    type: "dot-density",
    field: "EMPBLKCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPBLKCY", color: "#0BB4FF", label: "Black/African American Employed" }]
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
    attributes: [{ field: "UNWHTCY", color: "#FFB400", label: "White Unemployed" }]
  },
  UNBLKCY: {
    type: "dot-density",
    field: "UNBLKCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNBLKCY", color: "#007ED6", label: "Black/African American Unemployed" }]
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
    attributes: [{ field: "CIVLF16_CY", color: "#50E991", label: "Labor Force Age 16-24" }]
  },
  CIVLF25_CY: {
    type: "dot-density",
    field: "CIVLF25_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "CIVLF25_CY", color: "#9B19F5", label: "Labor Force Age 25-54" }]
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
    attributes: [{ field: "LOTRHH_CY", color: "#FFB400", label: "Low Income Tier Households" }]
  },
  MDTRHH_CY: {
    type: "dot-density",
    field: "MDTRHH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [{ field: "MDTRHH_CY", color: "#007ED6", label: "Middle Income Tier Households" }]
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
    attributes: [{ field: "DPOPRES_CY", color: "#36A2EB", label: "Daytime Residents" }]
  },
  MALES_CY: {
    type: "dot-density",
    field: "MALES_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "MALES_CY", color: "#4BC0C0", label: "Male Population" }]
  },
  FEMALES_CY: {
    type: "dot-density",
    field: "FEMALES_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "FEMALES_CY", color: "#FF6384", label: "Female Population" }]
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
    attributes: [{ field: "HSGRAD_CY", color: "#97BBCD", label: "High School Graduates" }]
  },
  GED_CY: {
    type: "dot-density",
    field: "GED_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "GED_CY", color: "#B2D8B2", label: "GED/Alternative Credential" }]
  },
  SMCOLL_CY: {
    type: "dot-density",
    field: "SMCOLL_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "SMCOLL_CY", color: "#FFC3A0", label: "Some College" }]
  },
  ASSCDEG_CY: {
    type: "dot-density",
    field: "ASSCDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "ASSCDEG_CY", color: "#A0CED9", label: "Associate's Degree" }]
  },
  BACHDEG_CY: {
    type: "dot-density",
    field: "BACHDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "BACHDEG_CY", color: "#ADB9E3", label: "Bachelor's Degree" }]
  },
  GRADDEG_CY: {
    type: "dot-density",
    field: "GRADDEG_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "GRADDEG_CY", color: "#B5A8E3", label: "Graduate/Professional Degree" }]
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
    attributes: [{ field: "NHSPPI_CY", color: "#FF9F40", label: "Pacific Islander Non-Hispanic" }]
  },
  NHSPOTH_CY: {
    type: "dot-density",
    field: "NHSPOTH_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPOTH_CY", color: "#FFD700", label: "Other Race Non-Hispanic" }]
  },
  NHSPMLT_CY: {
    type: "dot-density",
    field: "NHSPMLT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "NHSPMLT_CY", color: "#C39BD3", label: "Multiple Races Non-Hispanic" }]
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
    attributes: [{ field: "EMPAICY", color: "#85C1E9", label: "American Indian/Alaska Native Employed" }]
  },
  EMPASNCY: {
    type: "dot-density",
    field: "EMPASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPASNCY", color: "#82E0AA", label: "Asian Employed" }]
  },
  EMPPICY: {
    type: "dot-density",
    field: "EMPPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPPICY", color: "#F8C471", label: "Pacific Islander Employed" }]
  },
  EMPOTHCY: {
    type: "dot-density",
    field: "EMPOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPOTHCY", color: "#E59866", label: "Other Race Employed" }]
  },
  EMPMLTCY: {
    type: "dot-density",
    field: "EMPMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPMLTCY", color: "#BB8FCE", label: "Multiple Races Employed" }]
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
    attributes: [{ field: "TOTHU_CY", color: "#F7DC6F", label: "Total Housing Units" }]
  },
  VACANT_CY: {
    type: "dot-density",
    field: "VACANT_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [{ field: "VACANT_CY", color: "#EC7063", label: "Vacant Housing Units" }]
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
    attributes: [{ field: "UPTRHH_CY", color: "#5D4037", label: "Upper Income Tier Households" }]
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
    attributes: [{ field: "POP20_CY", color: "#FF5E3A", label: "Population Age 20-24" }]
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
    attributes: [{ field: "POP25_CY", color: "#FF4E50", label: "Population Age 25-29" }]
  },
  POP30_CY: {
    type: "dot-density",
    field: "POP30_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "POP30_CY", color: "#FC913A", label: "Population Age 30-34" }]
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
    attributes: [{ field: "POP85_CY", color: "#99B898", label: "Population Age 85+" }]
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
    attributes: [{ field: "BABYBOOMCY", color: "#E84A5F", label: "Baby Boomer Population" }]
  },
  OLDRGENSCY: {
    type: "dot-density",
    field: "OLDRGENSCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "OLDRGENSCY", color: "#355C7D", label: "Silent & Greatest Generations" }]
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
    attributes: [{ field: "EMPAGE16CY", color: "#A8E6CF", label: "Employed Age 16-24" }]
  },
  EMPAGE25CY: {
    type: "dot-density",
    field: "EMPAGE25CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPAGE25CY", color: "#FFD3B6", label: "Employed Age 25-54" }]
  },
  EMPAGE55CY: {
    type: "dot-density",
    field: "EMPAGE55CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPAGE55CY", color: "#FFAAA5", label: "Employed Age 55-64" }]
  },
  EMPAGE65CY: {
    type: "dot-density",
    field: "EMPAGE65CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [{ field: "EMPAGE65CY", color: "#98DDCA", label: "Employed Age 65+" }]
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
    attributes: [{ field: "DI0_CY", color: "#FF9A8B", label: "Disposable Income < $15,000" }]
  },
  DI15_CY: {
    type: "dot-density",
    field: "DI15_CY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [{ field: "DI15_CY", color: "#FFB8B1", label: "Disposable Income $15,000-$24,999" }]
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
    attributes: [{ field: "UNAICY", color: "#FFB7B2", label: "American Indian/Alaska Native Unemployed" }]
  },
  UNASNCY: {
    type: "dot-density",
    field: "UNASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNASNCY", color: "#FFDAC1", label: "Asian Unemployed" }]
  },
  UNPICY: {
    type: "dot-density",
    field: "UNPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNPICY", color: "#E2F0CB", label: "Pacific Islander Unemployed" }]
  },
  UNOTHCY: {
    type: "dot-density",
    field: "UNOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNOTHCY", color: "#B5EAD7", label: "Other Race Unemployed" }]
  },
  UNMLTCY: {
    type: "dot-density",
    field: "UNMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "UNMLTCY", color: "#C7CEEA", label: "Multiple Races Unemployed" }]
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
    attributes: [{ field: "CIVLFAICY", color: "#E5989B", label: "American Indian/Alaska Native Labor Force" }]
  },
  CIVLFASNCY: {
    type: "dot-density",
    field: "CIVLFASNCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "CIVLFASNCY", color: "#B5838D", label: "Asian Labor Force" }]
  },
  CIVLFPICY: {
    type: "dot-density",
    field: "CIVLFPICY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "CIVLFPICY", color: "#6D6875", label: "Pacific Islander Labor Force" }]
  },
  CIVLFOTHCY: {
    type: "dot-density",
    field: "CIVLFOTHCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "CIVLFOTHCY", color: "#A4C3B2", label: "Other Race Labor Force" }]
  },
  CIVLFMLTCY: {
    type: "dot-density",
    field: "CIVLFMLTCY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [{ field: "CIVLFMLTCY", color: "#EAF4D3", label: "Multiple Races Labor Force" }]
  }
};

const visualizationOptions = [
  // Original Heat Map Options
  { value: "income_HEAT", label: "Median Household Income (Heat)", type: "class-breaks" },
  { value: "growth_HEAT", label: "Household Growth Rate (Heat)", type: "class-breaks" },
  { value: "affordability_HEAT", label: "Housing Affordability Index (Heat)", type: "class-breaks" },
  { value: "density_HEAT", label: "Population Density (Heat)", type: "class-breaks" },
  { value: "age_HEAT", label: "Median Age (Heat)", type: "class-breaks" },
  { value: "unemployment_HEAT", label: "Unemployment Rate (Heat)", type: "class-breaks" },
  { value: "homeValue_HEAT", label: "Median Home Value (Heat)", type: "class-breaks" },

  // Income Heat Maps
  { value: "MEDHINC_CY_HEAT", label: "Median Household Income (Heat)", type: "class-breaks" },
  { value: "AVGHINC_CY_HEAT", label: "Average Household Income (Heat)", type: "class-breaks" },
  { value: "HINC0_CY_HEAT", label: "Household Income < $15K (Heat)", type: "class-breaks" },
  { value: "HINC15_CY_HEAT", label: "Household Income $15K-$25K (Heat)", type: "class-breaks" },
  { value: "HINC25_CY_HEAT", label: "Household Income $25K-$35K (Heat)", type: "class-breaks" },
  { value: "HINC35_CY_HEAT", label: "Household Income $35K-$50K (Heat)", type: "class-breaks" },
  { value: "HINC50_CY_HEAT", label: "Household Income $50K-$75K (Heat)", type: "class-breaks" },
  { value: "HINC75_CY_HEAT", label: "Household Income $75K-$100K (Heat)", type: "class-breaks" },
  { value: "HINC100_CY_HEAT", label: "Household Income $100K-$150K (Heat)", type: "class-breaks" },
  { value: "HINC150_CY_HEAT", label: "Household Income $150K-$200K (Heat)", type: "class-breaks" },
  { value: "HINC200_CY_HEAT", label: "Household Income $200K+ (Heat)", type: "class-breaks" },

  // Dot Density Population Demographics
  { value: "TOTPOP_CY", label: "Total Population 2024 (Dot)", type: "dot-density" },
  { value: "TOTHH_CY", label: "Total Households 2024 (Dot)", type: "dot-density" },
  { value: "DPOP_CY", label: "Daytime Population 2024 (Dot)", type: "dot-density" },
  { value: "DPOPWRK_CY", label: "Daytime Workers 2024 (Dot)", type: "dot-density" },
  { value: "WORKAGE_CY", label: "Working Age Population 18-64 (Dot)", type: "dot-density" },
  { value: "SENIOR_CY", label: "Senior Population 65+ (Dot)", type: "dot-density" },
  { value: "CHILD_CY", label: "Child Population <18 (Dot)", type: "dot-density" },

  // Detailed Age Groups (Dot)
  { value: "POP0_CY", label: "Population Age 0-4 (Dot)", type: "dot-density" },
  { value: "POP5_CY", label: "Population Age 5-9 (Dot)", type: "dot-density" },
  { value: "POP10_CY", label: "Population Age 10-14 (Dot)", type: "dot-density" },
  { value: "POP15_CY", label: "Population Age 15-19 (Dot)", type: "dot-density" },
  { value: "POP20_CY", label: "Population Age 20-24 (Dot)", type: "dot-density" },
  { value: "POP25_CY", label: "Population Age 25-29 (Dot)", type: "dot-density" },
  { value: "POP30_CY", label: "Population Age 30-34 (Dot)", type: "dot-density" },
  { value: "POP35_CY", label: "Population Age 35-39 (Dot)", type: "dot-density" },
  { value: "POP40_CY", label: "Population Age 40-44 (Dot)", type: "dot-density" },
  { value: "POP45_CY", label: "Population Age 45-49 (Dot)", type: "dot-density" },
  { value: "POP50_CY", label: "Population Age 50-54 (Dot)", type: "dot-density" },
  { value: "POP55_CY", label: "Population Age 55-59 (Dot)", type: "dot-density" },
  { value: "POP60_CY", label: "Population Age 60-64 (Dot)", type: "dot-density" },
  { value: "POP65_CY", label: "Population Age 65-69 (Dot)", type: "dot-density" },
  { value: "POP70_CY", label: "Population Age 70-74 (Dot)", type: "dot-density" },
  { value: "POP75_CY", label: "Population Age 75-79 (Dot)", type: "dot-density" },
  { value: "POP80_CY", label: "Population Age 80-84 (Dot)", type: "dot-density" },
  { value: "POP85_CY", label: "Population Age 85+ (Dot)", type: "dot-density" },

  // Generations (Dot)
  { value: "GENALPHACY", label: "Generation Alpha (Born 2017+) (Dot)", type: "dot-density" },
  { value: "GENZ_CY", label: "Generation Z (Born 1999-2016) (Dot)", type: "dot-density" },
  { value: "MILLENN_CY", label: "Millennials (Born 1981-1998) (Dot)", type: "dot-density" },
  { value: "GENX_CY", label: "Generation X (Born 1965-1980) (Dot)", type: "dot-density" },
  { value: "BABYBOOMCY", label: "Baby Boomers (Born 1946-1964) (Dot)", type: "dot-density" },
  { value: "OLDRGENSCY", label: "Silent & Greatest Gens (Born pre-1946) (Dot)", type: "dot-density" },

  // Race and Ethnicity Percentages (Heat)
  { value: "hispanic_HEAT", label: "Hispanic Population Percentage (Heat)", type: "class-breaks" },
  { value: "diversity_HEAT", label: "White Non-Hispanic Percentage (Heat)", type: "class-breaks" },
  { value: "NHSPBLK_CY_PCT_HEAT", label: "Black Non-Hispanic Percentage (Heat)", type: "class-breaks" },
  { value: "NHSPASN_CY_PCT_HEAT", label: "Asian Non-Hispanic Percentage (Heat)", type: "class-breaks" },

  // Race and Ethnicity (Dot)
  { value: "HISPPOP_CY", label: "Hispanic Population (Dot)", type: "dot-density" },
  { value: "NHSPWHT_CY", label: "White Non-Hispanic Population (Dot)", type: "dot-density" },
  { value: "NHSPBLK_CY", label: "Black Non-Hispanic Population (Dot)", type: "dot-density" },
  { value: "NHSPASN_CY", label: "Asian Non-Hispanic Population (Dot)", type: "dot-density" },
  { value: "NHSPAI_CY", label: "American Indian/Alaska Native Non-Hispanic (Dot)", type: "dot-density" },
  { value: "NHSPPI_CY", label: "Pacific Islander Non-Hispanic (Dot)", type: "dot-density" },
  { value: "NHSPOTH_CY", label: "Other Race Non-Hispanic (Dot)", type: "dot-density" },
  { value: "NHSPMLT_CY", label: "Multiple Races Non-Hispanic (Dot)", type: "dot-density" },

  // Education (Dot)
  { value: "NOHS_CY", label: "Less than 9th Grade Education (Dot)", type: "dot-density" },
  { value: "SOMEHS_CY", label: "Some High School (Dot)", type: "dot-density" },
  { value: "HSGRAD_CY", label: "High School Graduates (Dot)", type: "dot-density" },
  { value: "GED_CY", label: "GED/Alternative Credential (Dot)", type: "dot-density" },
  { value: "SMCOLL_CY", label: "Some College (Dot)", type: "dot-density" },
  { value: "ASSCDEG_CY", label: "Associate's Degree (Dot)", type: "dot-density" },
  { value: "BACHDEG_CY", label: "Bachelor's Degree (Dot)", type: "dot-density" },
  { value: "GRADDEG_CY", label: "Graduate/Professional Degree (Dot)", type: "dot-density" },

  // Education Percentages (Heat)
  { value: "HSGRAD_LESS_CY_PCT_HEAT", label: "Less than High School Percentage (Heat)", type: "class-breaks" },
  { value: "BACHDEG_PLUS_CY_PCT_HEAT", label: "Bachelor's Degree or Higher Percentage (Heat)", type: "class-breaks" },

  // Home Values (Dot)
  { value: "VAL0_CY", label: "Home Value < $50,000 (Dot)", type: "dot-density" },
  { value: "VAL50K_CY", label: "Home Value $50K-$99,999 (Dot)", type: "dot-density" },
  { value: "VAL100K_CY", label: "Home Value $100K-$149,999 (Dot)", type: "dot-density" },
  { value: "VAL150K_CY", label: "Home Value $150K-$199,999 (Dot)", type: "dot-density" },
  { value: "VAL200K_CY", label: "Home Value $200K-$249,999 (Dot)", type: "dot-density" },
  { value: "VAL250K_CY", label: "Home Value $250K-$299,999 (Dot)", type: "dot-density" },
  { value: "VAL300K_CY", label: "Home Value $300K-$399,999 (Dot)", type: "dot-density" },
  { value: "VAL400K_CY", label: "Home Value $400K-$499,999 (Dot)", type: "dot-density" },
  { value: "VAL500K_CY", label: "Home Value $500K-$749,999 (Dot)", type: "dot-density" },
  { value: "VAL750K_CY", label: "Home Value $750K-$999,999 (Dot)", type: "dot-density" },
  { value: "VAL1M_CY", label: "Home Value $1M-$1.5M (Dot)", type: "dot-density" },
  { value: "VAL1PT5MCY", label: "Home Value $1.5M-$2M (Dot)", type: "dot-density" },
  { value: "VAL2M_CY", label: "Home Value $2M+ (Dot)", type: "dot-density" },

  // Home Values (Heat)
  { value: "MEDVAL_CY_HEAT", label: "Median Home Value (Heat)", type: "class-breaks" },
  { value: "AVGVAL_CY_HEAT", label: "Average Home Value (Heat)", type: "class-breaks" },

  // Housing (Dot)
  { value: "OWNER_CY", label: "Owner Occupied Housing Units (Dot)", type: "dot-density" },
  { value: "RENTER_CY", label: "Renter Occupied Housing Units (Dot)", type: "dot-density" },
  { value: "TOTHU_CY", label: "Total Housing Units (Dot)", type: "dot-density" },
  { value: "VACANT_CY", label: "Vacant Housing Units (Dot)", type: "dot-density" },

  // Housing (Heat)
  { value: "PCTHOMEOWNER_HEAT", label: "Homeownership Rate (Heat)", type: "class-breaks" },
  { value: "VACANT_CY_PCT_HEAT", label: "Vacancy Rate (Heat)", type: "class-breaks" },

  // Income Brackets (Dot)
  { value: "HINC0_CY", label: "Households < $15,000 (Dot)", type: "dot-density" },
  { value: "HINC15_CY", label: "Households $15,000-$24,999 (Dot)", type: "dot-density" },
  { value: "HINC25_CY", label: "Households $25,000-$34,999 (Dot)", type: "dot-density" },
  { value: "HINC35_CY", label: "Households $35,000-$49,999 (Dot)", type: "dot-density" },
  { value: "HINC50_CY", label: "Households $50,000-$74,999 (Dot)", type: "dot-density" },
  { value: "HINC75_CY", label: "Households $75,000-$99,999 (Dot)", type: "dot-density" },
  { value: "HINC100_CY", label: "Households $100,000-$149,999 (Dot)", type: "dot-density" },
  { value: "HINC150_CY", label: "Households $150,000-$199,999 (Dot)", type: "dot-density" },
  { value: "HINC200_CY", label: "Households $200,000+ (Dot)", type: "dot-density" },

  // Additional Metrics
  { value: "POPGRWCYFY_HEAT", label: "Population Growth Rate 2024-2029 (Heat)", type: "class-breaks" },
  { value: "HHGRWCYFY_HEAT", label: "Household Growth Rate 2024-2029 (Heat)", type: "class-breaks" },
  { value: "MHIGRWCYFY_HEAT", label: "Median Household Income Growth Rate 2024-2029 (Heat)", type: "class-breaks" },
  { value: "POPGRW20CY", label: "Population Growth Rate 2020-2024 (Heat)", type: "class-breaks" },
  { value: "HHGRW20CY_HEAT", label: "Household Growth Rate 2020-2024 (Heat)", type: "class-breaks" },

  // Economic Indicators (Heat)
  { value: "UNEMPRT_CY_HEAT", label: "Unemployment Rate (Heat)", type: "class-breaks" },
  { value: "HAI_CY_HEAT", label: "Housing Affordability Index (Heat)", type: "class-breaks" },
  { value: "INCMORT_CY_HEAT", label: "Percent of Income for Mortgage (Heat)", type: "class-breaks" },
  { value: "WLTHINDXCY_HEAT", label: "Wealth Index (Heat)", type: "class-breaks" },
  { value: "SEI_CY_HEAT", label: "Socioeconomic Status Index (Heat)", type: "class-breaks" },
  { value: "PCI_CY_HEAT", label: "Per Capita Income (Heat)", type: "class-breaks" },

  // Future Projections (Heat)
  { value: "TOTPOP_FY_HEAT", label: "Projected Total Population 2029 (Heat)", type: "class-breaks" },
  { value: "TOTHH_FY_HEAT", label: "Projected Total Households 2029 (Heat)", type: "class-breaks" },
  { value: "MEDHINC_FY_HEAT", label: "Projected Median Household Income 2029 (Heat)", type: "class-breaks" },
  { value: "POPDENS_FY_HEAT", label: "Projected Population Density 2029 (Heat)", type: "class-breaks" },

  // Demographic Composition (Dot)
  { value: "MALES_CY", label: "Male Population (Dot)", type: "dot-density" },
  { value: "FEMALES_CY", label: "Female Population (Dot)", type: "dot-density" },

  // Advanced Demographic Categories (Dot)
  { value: "EMPAGE16CY", label: "Employed Population Age 16-24 (Dot)", type: "dot-density" },
  { value: "EMPAGE25CY", label: "Employed Population Age 25-54 (Dot)", type: "dot-density" },
  { value: "EMPAGE55CY", label: "Employed Population Age 55-64 (Dot)", type: "dot-density" },
  { value: "EMPAGE65CY", label: "Employed Population 65+ (Dot)", type: "dot-density" },

  // Employment and Labor (Dot)
  { value: "EMP_CY", label: "Employed Population (Dot)", type: "dot-density" },
  { value: "UNEMP_CY", label: "Unemployed Population (Dot)", type: "dot-density" },
  { value: "CIVLBFR_CY", label: "Civilian Labor Force (Dot)", type: "dot-density" },

  // Detailed Race and Employment (Dot)
  { value: "EMPWHTCY", label: "White Employed Population (Dot)", type: "dot-density" },
  { value: "EMPBLKCY", label: "Black Employed Population (Dot)", type: "dot-density" },
  { value: "EMPASNCY", label: "Asian Employed Population (Dot)", type: "dot-density" },
  { value: "EMPAICY", label: "American Indian/Alaska Native Employed (Dot)", type: "dot-density" },
  { value: "EMPPICY", label: "Pacific Islander Employed Population (Dot)", type: "dot-density" },
  { value: "EMPOTHCY", label: "Other Race Employed Population (Dot)", type: "dot-density" },
  { value: "EMPMLTCY", label: "Multiple Races Employed Population (Dot)", type: "dot-density" },

  // Unemployed by Race (Dot)
  { value: "UNWHTCY", label: "White Unemployed Population (Dot)", type: "dot-density" },
  { value: "UNBLKCY", label: "Black Unemployed Population (Dot)", type: "dot-density" },
  { value: "UNASNCY", label: "Asian Unemployed Population (Dot)", type: "dot-density" },
  { value: "UNAICY", label: "American Indian/Alaska Native Unemployed (Dot)", type: "dot-density" },
  { value: "UNPICY", label: "Pacific Islander Unemployed Population (Dot)", type: "dot-density" },
  { value: "UNOTHCY", label: "Other Race Unemployed Population (Dot)", type: "dot-density" },
  { value: "UNMLTCY", label: "Multiple Races Unemployed Population (Dot)", type: "dot-density" }
];

const createLayers = (
  visualizationType,
  configOverride = null,
  layerConfigs = initialLayerConfigurations,
  selectedAreaType = areaTypes[0]
) => {
  // Validate inputs
  if (!visualizationType) {
    console.error('No visualization type provided');
    return null;
  }

  if (!selectedAreaType) {
    console.error('No area type provided, using default');
    selectedAreaType = areaTypes[0];
  }

  const config = configOverride || layerConfigs[visualizationType];

  if (!config) {
    console.error(`No configuration found for visualization type: ${visualizationType}`);
    return null;
  }

  // Adjust dot value based on area type for dot density visualizations
  if (config.type === "dot-density" && !config.dotValue) {
    config.dotValue = selectedAreaType.value === 12 ? 10 : 100;
  }

  const createRenderer = (config) => {
    if (!config) return null;

    switch (config.type) {
      case "dot-density":
        return {
          type: "dot-density",
          field: config.field,
          dotValue: config.dotValue,
          dotBlending: config.dotBlending,
          dotSize: config.dotSize,
          outline: config.outline,
          legendOptions: config.legendOptions,
          attributes: config.attributes,
        };

      case "class-breaks":
        return {
          type: "class-breaks",
          field: config.field,
          defaultSymbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [50, 50, 50, 0.2], width: 0.5 },
          },
          defaultLabel: "No data",
          classBreakInfos: config.classBreakInfos,
        };

      default:
        console.error('Unsupported renderer type:', config.type);
        return null;
    }
  };

  const layerDefinitions = {
    population: {
      fieldName: "TOTPOP_CY",
      title: "Population Distribution (2024)",
      format: {
        digitSeparator: true,
        places: 0,
      },
    },
    income: {
      fieldName: "MEDHINC_CY",
      title: "Median Household Income (2024)",
      format: {
        digitSeparator: true,
        places: 0,
        type: "currency",
      },
    },
    growth: {
      fieldName: "HHGRW20CY",
      title: "Household Growth Rate (2020-2024)",
      format: {
        digitSeparator: true,
        places: 2,
      },
    },
    affordability: {
      fieldName: "HAI_CY",
      title: "Housing Affordability Index (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    density: {
      fieldName: "POPDENS_CY",
      title: "Population Density (2024)",
      format: {
        digitSeparator: true,
        places: 0,
      },
    },
    age: {
      fieldName: "MEDAGE_CY",
      title: "Median Age (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    unemployment: {
      fieldName: "UNEMPRT_CY",
      title: "Unemployment Rate (2024)",
      format: {
        digitSeparator: true,
        places: 1,
      },
    },
    homeValue: {
      fieldName: "MEDVAL_CY",
      title: "Median Home Value (2024)",
      format: {
        digitSeparator: true,
        places: 0,
        type: "currency",
      },
    },
  };

  // Get layer configuration based on visualization type
  const layerConfig = layerDefinitions[visualizationType];

  // Create field info based on configuration type
  const createFieldInfo = (config, layerConfig) => {
    // If we have a predefined layer config, use it
    if (layerConfig) {
      return {
        fieldName: layerConfig.fieldName,
        label: layerConfig.title,
        format: layerConfig.format,
      };
    }

    // Otherwise, create field info dynamically
    const fieldName = config.field;
    let format = {
      digitSeparator: true,
      places: 0
    };

    // Set format based on field type
    if (fieldName.includes('HINC') || fieldName.includes('VAL') || fieldName.includes('MEDHINC')) {
      format.type = 'currency';
    } else if (fieldName.includes('RT') || fieldName.includes('PCT')) {
      format.places = 1;
    }

    return {
      fieldName: fieldName,
      label: config.attributes?.[0]?.label || fieldName,
      format: format
    };
  };

  // Validate URL
  if (!selectedAreaType.url) {
    console.error('Invalid area type: No URL provided', selectedAreaType);
    return null;
  }

  // Create and return the FeatureLayer
  return new FeatureLayer({
    url: selectedAreaType.url,
    renderer: createRenderer(config),
    popupTemplate: {
      title: `${selectedAreaType.label} {NAME}`,
      content: [
        {
          type: "fields",
          fieldInfos: [createFieldInfo(config, layerConfig)]
        },
      ],
    },
    title: layerConfig?.title || config.attributes?.[0]?.label || visualizationType,
    minScale: selectedAreaType.value === 12 ? 2500000 : 25000000,
  });
};

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
  { value: 12, label: "Census Tract", url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12" },
  { value: 11, label: "County", url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/11" }
];

export default function MapComponent({ onToggleLis }) {
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const mapRef = useRef(null);
  const { setMapView, mapView } = useMap();
  const initCompleteRef = useRef(false);
  const layersRef = useRef({});
  const [legend, setLegend] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedAreaType, setSelectedAreaType] = useState(areaTypes[0]);
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const localStorageProjectId = localStorage.getItem('currentProjectId');
  const sessionStorageProjectId = sessionStorage.getItem('currentProjectId');
  const [isSaving, setIsSaving] = useState(false);


  // Use the first available project ID
  const projectId = routeProjectId || localStorageProjectId || sessionStorageProjectId;

  useEffect(() => {
    if (!projectId) {
      console.error('No project ID available');
      navigate('/projects');
      return;
    }

    // Store projectId in all locations to ensure consistency
    localStorage.setItem('currentProjectId', projectId);
    sessionStorage.setItem('currentProjectId', projectId);
  }, [projectId, navigate]);

  // Modify storage keys to use a static default
  const AUTO_SAVE_KEY = 'autoSavedMapConfigurations_default';
  const MANUAL_SAVE_KEY = 'mapConfigurations_default';

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
          { min: 200000 }
        ],
        [
          "Less than $35,000",
          "$35,000 - $65,000",
          "$65,000 - $95,000",
          "$95,000 - $125,000",
          "$125,000 - $155,000",
          "$155,000 - $200,000",
          "$200,000 or more"
        ]
      )
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
          { min: 2 }
        ],
        [
          "Less than -3%",
          "-3% to -2%",
          "-2% to -1%",
          "-1% to 0%",
          "0% to 1%",
          "1% to 2%",
          "2% or more"
        ]
      )
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
          { min: 15000 }
        ],
        [
          "Less than 1,000",
          "1,000 - 2,500",
          "2,500 - 5,000",
          "5,000 - 7,500",
          "7,500 - 10,000",
          "10,000 - 15,000",
          "15,000 or more"
        ]
      )
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
          { min: 55 }
        ],
        [
          "Less than 30 years",
          "30 - 35 years",
          "35 - 40 years",
          "40 - 45 years",
          "45 - 50 years",
          "50 - 55 years",
          "55 years or more"
        ]
      )
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
          { min: 13 }
        ],
        [
          "Less than 3%",
          "3% - 5%",
          "5% - 7%",
          "7% - 9%",
          "9% - 11%",
          "11% - 13%",
          "13% or more"
        ]
      )
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
          { min: 1500000 }
        ],
        [
          "Less than $200,000",
          "$200,000 - $350,000",
          "$350,000 - $500,000",
          "$500,000 - $750,000",
          "$750,000 - $1,000,000",
          "$1,000,000 - $1,500,000",
          "$1,500,000 or more"
        ]
      )
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
          { min: 175 }
        ],
        [
          "Less than 50",
          "50 - 75",
          "75 - 100",
          "100 - 125",
          "125 - 150",
          "150 - 175",
          "175 or more"
        ]
      )
    }
  });

  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: "Core Map",
      active: true,
      visualizationType: null,
      areaType: areaTypes[0],
      layerConfiguration: null
    }
  ]); const [activeTab, setActiveTab] = useState(1);
  const [visualizationType, setVisualizationType] = useState(null);

  useEffect(() => {
    try {
      esriConfig.apiKey = API_KEY;
      esriConfig.assetsPath = "https://js.arcgis.com/4.31/@arcgis/core/assets/";

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
      ];

      serversToAdd.forEach((server) => {
        if (!esriConfig.request.corsEnabledServers.includes(server)) {
          esriConfig.request.corsEnabledServers.push(server);
        }
      });
    } catch (error) {
      console.error("[Map] Error initializing ArcGIS configuration:", error);
    }
  }, []);

  const sidebarWidth = 350; // Your standard sidebar width
  const padding = 20; // Additional padding
  
  
  useEffect(() => {
    let isMounted = true;
    
    const initializeMap = async () => {
      try {
        console.log("Starting map initialization...");
        
        // Validate API Key
        const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        if (!apiKey) {
          console.error('ArcGIS API Key is missing');
          return;
        }
    
        // Configure ArcGIS
        esriConfig.apiKey = apiKey;
        esriConfig.assetsPath = "https://js.arcgis.com/4.31/@arcgis/core/assets/";
    
        // Create map with standard basemap
        const map = new Map({
          basemap: "streets-navigation-vector" // Use a standard, predefined basemap
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
            maxZoom: 20
          }
        });
    
        // Comprehensive view initialization
        view.when(
          () => {
            console.log("✅ View is ready");
            setMapView(view);
            
            // Add widgets
            const widgets = [
              new Zoom({ view }),
              new Home({ view }),
              new ScaleBar({ view, unit: "imperial" }),
              new BasemapToggle({ 
                view, 
                nextBasemap: "arcgis-imagery" 
              })
            ];
    
            widgets.forEach(widget => {
              view.ui.add(widget, "top-left");
            });
          },
          (error) => {
            console.error("Map View Initialization Error:", {
              message: error.message,
              name: error.name,
              stack: error.stack
            });
          }
        );
    
      } catch (error) {
        console.error("Comprehensive Map Initialization Error:", {
          message: error.message,
          name: error.name,
          fullError: error,
          stack: error.stack
        });
      }
    };
  
    // Trigger map initialization
    initializeMap();
  
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array ensures this runs once on mount
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
      const loadedTabs = tabs.filter(tab => tab.id !== 1 && tab.visualizationType);
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
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || tab.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    };

    initConfigs();
  }, [mapView, legend]);

  useEffect(() => {
    if (!legend || !mapView?.ready) return;

    const activeTabData = tabs.find((tab) => tab.id === activeTab);
    const hasVisualization = activeTabData?.visualizationType;
    const shouldShowLegend = activeTab !== 1 && hasVisualization && !isEditorOpen;

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
            legendContainer.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";

            // Style legend title
            const legendTitle = legendContainer.querySelector(".esri-legend__service-label");
            if (legendTitle) {
              legendTitle.style.fontWeight = "600";
              legendTitle.style.fontSize = "0.875rem";
              legendTitle.style.marginBottom = "0.75rem";
              legendTitle.style.color = "#111827";
            }

            // Style legend items
            const legendItems = legendContainer.querySelectorAll(".esri-legend__layer-row");
            legendItems.forEach((item) => {
              item.style.display = "flex";
              item.style.alignItems = "center";
              item.style.marginBottom = "0.5rem";
            });

            // Style color swatches
            const swatches = legendContainer.querySelectorAll(".esri-legend__symbol");
            swatches.forEach((swatch) => {
              swatch.style.width = "1rem";
              swatch.style.height = "1rem";
              swatch.style.marginRight = "0.5rem";
            });

            // Style labels
            const labels = legendContainer.querySelectorAll(".esri-legend__layer-cell--info");
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
    if (!mapView?.ready || !mapView.map || !legend || isConfigLoading) return;

    const updateVisualizationAndLegend = async () => {
      try {
        // Remove existing visualization layers
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach((layer) => mapView.map.remove(layer));

        // Find the active tab and its visualization type
        const activeTabData = tabs.find((tab) => tab.id === activeTab);

        // Only add new layer if we're not in the core map and have a selected type
        if (activeTab !== 1 && activeTabData?.visualizationType) {
          const newLayer = createLayers(
            activeTabData.visualizationType,
            activeTabData.layerConfiguration,
            initialLayerConfigurations,
            activeTabData.areaType
          );

          if (newLayer) {
            newLayer.set("isVisualizationLayer", true);
            mapView.map.add(newLayer, 0);

            // Wait for layer to load before updating legend
            await newLayer.when();

            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || activeTabData.visualizationType,
              hideLayersNotInCurrentView: false
            }];

            // Show legend only after layer is ready
            legend.visible = !isEditorOpen;
          }
        } else {
          // Hide legend if no visualization
          legend.visible = false;
        }
      } catch (error) {
        console.error("Error updating visualization and legend:", error);
      }
    };

    updateVisualizationAndLegend();
  }, [
    activeTab,
    tabs,
    mapView,
    legend,
    isEditorOpen,
    isConfigLoading
  ]);


  // Update the updateVisualizationLayer function
  const updateVisualizationLayer = async () => {
    if (!mapView?.map || isConfigLoading) {
      console.log('Map not ready or configs still loading, skipping visualization update');
      return;
    }
  
    try {
      // Remove existing visualization layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer.get && layer.get("isVisualizationLayer")) {
          layersToRemove.push(layer);
        }
      });
      layersToRemove.forEach((layer) => mapView.map.remove(layer));
  
      // Find the active tab and its visualization type
      const activeTabData = tabs.find((tab) => tab.id === activeTab);
  
      // Only add new layer if we're not in the core map and have a selected type
      if (activeTab !== 1 && activeTabData?.visualizationType) {
        console.log('Creating new layer with config:', activeTabData.layerConfiguration);
        
        // Create a deep clone of the configuration to prevent any references
        const configClone = JSON.parse(JSON.stringify(activeTabData.layerConfiguration));
        
        const newLayer = createLayers(
          activeTabData.visualizationType,
          configClone,
          initialLayerConfigurations,
          activeTabData.areaType
        );
  
        if (newLayer) {
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);
  
          if (legend) {
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || activeTabData.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    } catch (error) {
      console.error("Error updating visualization layer:", error);
    }
  };

  useEffect(() => {
    try {
      console.log('ArcGIS API Key:', import.meta.env.VITE_ARCGIS_API_KEY ? 'Loaded' : 'Not Found');
      
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
      
      if (!esriConfig.apiKey) {
        console.error('ArcGIS API Key is missing or undefined');
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
        "services8.arcgis.com"
      ];
  
      serversToAdd.forEach((server) => {
        if (!esriConfig.request.corsEnabledServers.includes(server)) {
          esriConfig.request.corsEnabledServers.push(server);
        }
      });
  
      // Add request interceptor for debugging
      esriConfig.request.interceptors.push({
        before: (params) => {
          console.log('ArcGIS Request Interceptor:', {
            url: params.url,
            method: params.method,
            headers: params.headers
          });
        },
        error: (error) => {
          console.error('ArcGIS Request Error:', error);
        }
      });
  
    } catch (error) {
      console.error('ArcGIS Configuration Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
  }, []);

  // Use the tab-specific configuration when switching tabs or rendering
  useEffect(() => {
    if (!mapView?.map || !legend) return;
    updateVisualizationLayer();
  }, [
    activeTab,
    tabs,  // Added tabs to the dependency array
    mapView,
    legend,
    isEditorOpen,
    selectedAreaType
  ]);


  // Updated handleTabClick function
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    const newTabs = tabs.map((tab) => ({
      ...tab,
      active: tab.id === tabId,
      isEditing: false, // Close any open editing when switching tabs
    }));
    setTabs(newTabs);

    // Update visualization and legend for the newly selected tab
    const selectedTab = newTabs.find(tab => tab.id === tabId);
    if (selectedTab && mapView?.map) {
      if (tabId === 1) {
        // Clear visualization layers for Core Map
        const layersToRemove = [];
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            layersToRemove.push(layer);
          }
        });
        layersToRemove.forEach((layer) => mapView.map.remove(layer));

        // Hide legend for Core Map
        if (legend) {
          legend.visible = false;
        }
      } else if (selectedTab.visualizationType) {
        // Create and add new layer for visualization tabs
        const newLayer = createLayers(
          selectedTab.visualizationType,
          selectedTab.layerConfiguration,
          initialLayerConfigurations,
          selectedTab.areaType
        );

        if (newLayer) {
          // Remove existing visualization layers
          mapView.map.layers.forEach((layer) => {
            if (layer.get("isVisualizationLayer")) {
              mapView.map.remove(layer);
            }
          });

          // Add new layer
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);

          // Update legend
          if (legend) {
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || selectedTab.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    }
  };

  const handleAreaTypeChange = (tabId, newAreaType) => {
    // Update the area type for the specific tab
    const newTabs = tabs.map((tab) =>
      tab.id === tabId
        ? {
          ...tab,
          areaType: newAreaType
        }
        : tab
    );

    setTabs(newTabs);
    setSelectedAreaType(newAreaType);

    // Update visualization and legend if there is one active
    const activeTabData = newTabs.find((tab) => tab.id === tabId);
    if (activeTabData?.visualizationType && mapView?.map) {
      const newLayer = createLayers(
        activeTabData.visualizationType,
        activeTabData.layerConfiguration,
        initialLayerConfigurations,
        newAreaType
      );

      if (newLayer) {
        // Remove existing visualization layers
        mapView.map.layers.forEach((layer) => {
          if (layer.get("isVisualizationLayer")) {
            mapView.map.remove(layer);
          }
        });

        // Add new layer
        newLayer.set("isVisualizationLayer", true);
        mapView.map.add(newLayer, 0);

        // Update legend
        if (legend) {
          legend.layerInfos = [{
            layer: newLayer,
            title: newLayer.title || activeTabData.visualizationType,
            hideLayersNotInCurrentView: false
          }];
          legend.visible = true;
        }
      }
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
            layerConfiguration: null
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
          layerConfiguration: initialConfig
        }
        : tab
    );

    setTabs(newTabs);
    setLayerConfigurations((prev) => {
      if (!prev[newValue]) {
        return {
          ...prev,
          [newValue]: initialConfig
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
        const newAreaType = areaTypes.find(type => type.value === parseInt(e.target.value));
        setSelectedAreaType(newAreaType);

        // Trigger layer update when area type changes
        const activeTabData = tabs.find(tab => tab.id === activeTab);
        if (activeTabData?.visualizationType) {
          const currentConfig = layerConfigurations[activeTabData.visualizationType];
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
      {areaTypes.map(type => (
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
              isEditing: false
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

  // Also update the addNewTab function to include originalName:
  const addNewTab = () => {
    const existingTabNumbers = tabs
      .filter(tab => tab.id !== 1)
      .map(tab => {
        const match = tab.name.match(/Map (\d+)/);
        return match ? parseInt(match[1]) : 0;
      });

    const nextTabNumber = existingTabNumbers.length > 0
      ? Math.max(...existingTabNumbers) + 1
      : 2;

    const newTabId = Math.max(...tabs.map(tab => tab.id)) + 1;
    const newTabName = `Map ${nextTabNumber}`;

    const newTabs = [
      ...tabs.map(tab => ({ ...tab, active: false })),
      {
        id: newTabId,
        name: newTabName,
        originalName: newTabName, // Add this line
        active: true,
        visualizationType: null,
        areaType: areaTypes[0],
        layerConfiguration: null,
        isEditing: false,
      }
    ];

    setTabs(newTabs);
    setActiveTab(newTabId);
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
      const tabToDelete = tabs.find(tab => tab.id === tabId);

      // Delete from database if it has a configId
      if (tabToDelete?.configId) {
        console.log('Deleting configuration from database:', tabToDelete.configId);
        await mapConfigurationsAPI.delete(tabToDelete.configId);
      }

      // Update local state
      const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
      const newActiveTab = activeTab === tabId
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
      console.error('Error deleting tab configuration:', error);
      alert('Failed to delete map configuration');
    }
  };

  const convertAreaTypeToString = (value) => {
    if (typeof value === 'string') return value;
    return value === 12 ? 'tract' : value === 11 ? 'county' : 'tract'; // default to tract
  };

  // Helper function to convert area type string to numeric value
  const convertAreaTypeToNumber = (value) => {
    if (typeof value === 'number') return value;
    return value === 'tract' ? 12 : value === 'county' ? 11 : 12; // default to tract (12)
  };

  // Updated saveMapConfigurations function
  const saveMapConfigurations = () => {
    const mapConfigs = tabs
      .filter(tab => tab.id !== 1)
      .map((tab, index) => ({
        tab_name: tab.name,
        visualization_type: tab.visualizationType,
        area_type: convertAreaTypeToString(tab.areaType?.value),
        layer_configuration: tab.layerConfiguration,
        order: index
      }));

    try {
      localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(mapConfigs));
      alert('Map configurations saved successfully');
    } catch (error) {
      console.error('Failed to save map configurations', error);
      alert('Failed to save map configurations');
    }
  };


  useEffect(() => {
    const initializeConfigurations = async () => {
      if (!projectId) {
        console.log('No project ID available, skipping initialization');
        return;
      }

      // Wait for map to be ready
      if (!mapView?.map) {
        console.log('Waiting for map to initialize...');
        return;
      }

      try {
        console.log('Initializing configurations for project:', projectId);
        const response = await mapConfigurationsAPI.getAll(projectId);
        const configs = response.data;
        console.log('Received configurations:', configs);

        if (!Array.isArray(configs) || configs.length === 0) {
          console.log('No configurations found, using default tabs');
          setTabs([{
            id: 1,
            name: "Core Map",
            active: true,
            visualizationType: null,
            areaType: areaTypes[0],
            layerConfiguration: null,
            isEditing: false
          }]);
          return;
        }

        // Create the base tabs array with Core Map
        const newTabs = [{
          id: 1,
          name: "Core Map",
          active: false,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false
        }];

        // Process each configuration
        configs.forEach((config) => {
          if (!config) return;

          console.log('Processing config:', config);

          const newTabId = Math.max(...newTabs.map(tab => tab.id)) + 1;

          // Handle area_type conversion
          let areaTypeValue = config.area_type;
          if (typeof areaTypeValue === 'string') {
            areaTypeValue = areaTypeValue === 'tract' ? 12 :
              areaTypeValue === 'county' ? 11 :
                parseInt(areaTypeValue);
          }

          const areaType = areaTypes.find(type => type.value === areaTypeValue) || areaTypes[0];

          console.log('Selected area type:', areaType);

          const newTab = {
            id: newTabId,
            name: config.tab_name,
            active: false,
            visualizationType: config.visualization_type,
            areaType: areaType,
            layerConfiguration: config.layer_configuration,
            isEditing: false,
            configId: config.id
          };

          console.log('Created new tab:', newTab);
          newTabs.push(newTab);
        });

        // Activate first tab and update state
        newTabs[0].active = true;
        console.log('Setting tabs to:', newTabs);
        setTabs(newTabs);
        setActiveTab(1);

        // Set up visualization for first non-core tab if it exists
        const firstVisualizationTab = newTabs.find(tab => tab.id !== 1 && tab.visualizationType);
        if (firstVisualizationTab) {
          console.log('Setting up visualization for tab:', firstVisualizationTab);

          // Create new layer for visualization
          const newLayer = createLayers(
            firstVisualizationTab.visualizationType,
            firstVisualizationTab.layerConfiguration,
            initialLayerConfigurations,
            firstVisualizationTab.areaType
          );

          if (newLayer && mapView?.map) {
            // Remove any existing visualization layers
            const layersToRemove = [];
            mapView.map.layers.forEach((layer) => {
              if (layer.get("isVisualizationLayer")) {
                layersToRemove.push(layer);
              }
            });
            layersToRemove.forEach((layer) => mapView.map.remove(layer));

            // Add new visualization layer
            newLayer.set("isVisualizationLayer", true);
            mapView.map.add(newLayer, 0);

            // Update legend if available
            if (legend) {
              legend.layerInfos = [{
                layer: newLayer,
                title: newLayer.title || firstVisualizationTab.visualizationType,
                hideLayersNotInCurrentView: false
              }];
              legend.visible = true;
            }
          }
        }
      } catch (error) {
        console.error('Error initializing configurations:', error);
        // Set default tab on error
        setTabs([{
          id: 1,
          name: "Core Map",
          active: true,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false
        }]);
        setActiveTab(1);
      }
    };

    initializeConfigurations();
  }, [projectId, mapView, legend]); // Dependencies include projectId, mapView, and legend

  // Update the loadMapConfigurations function
  const loadMapConfigurations = async () => {
    if (!projectId) {
      console.warn('No project ID available for loading configurations');
      setIsConfigLoading(false);
      return false;
    }

    try {
      setIsConfigLoading(true);
      const response = await mapConfigurationsAPI.getAll(projectId);
      const mapConfigs = response?.data;

      console.log('Loaded raw map configurations:', mapConfigs);

      if (!Array.isArray(mapConfigs) || mapConfigs.length === 0) {
        console.log('No configurations found, using default tabs');
        setTabs([{
          id: 1,
          name: "Core Map",
          active: true,
          visualizationType: null,
          areaType: areaTypes[0],
          layerConfiguration: null,
          isEditing: false
        }]);
        setIsConfigLoading(false);
        return false;
      }

      // Create base tabs array with Core Map
      const newTabs = [{
        id: 1,
        name: "Core Map",
        active: false,
        visualizationType: null,
        areaType: areaTypes[0],
        layerConfiguration: null,
        isEditing: false
      }];

      // Process each configuration into a tab
      mapConfigs.forEach((config) => {
        if (!config) return;

        const newTabId = Math.max(...newTabs.map(tab => tab.id)) + 1;

        // Ensure area_type is properly loaded
        const configAreaType = config.area_type;
        console.log('Loading area type:', configAreaType);

        let areaType;
        if (typeof configAreaType === 'string') {
          areaType = configAreaType === 'county'
            ? areaTypes.find(type => type.value === 11)
            : areaTypes.find(type => type.value === 12);
        } else {
          areaType = areaTypes.find(type => type.value === configAreaType) || areaTypes[0];
        }

        console.log('Resolved area type:', areaType);

        const newTab = {
          id: newTabId,
          name: config.tab_name,
          active: false,
          visualizationType: config.visualization_type,
          areaType: areaType,
          layerConfiguration: config.layer_configuration,
          isEditing: false,
          configId: config.id
        };

        console.log('Created new tab:', newTab);
        newTabs.push(newTab);
      });

      // Activate first tab and update state
      newTabs[0].active = true;
      setTabs(newTabs);
      setActiveTab(1);

      // Wait for state updates before proceeding with visualization
      await new Promise(resolve => setTimeout(resolve, 0));

      // Update visualization layer if needed
      const firstVisualizationTab = newTabs.find(tab => tab.id !== 1);
      if (firstVisualizationTab && mapView?.map) {
        console.log('Setting up visualization for tab:', firstVisualizationTab);

        await updateVisualizationLayer(
          firstVisualizationTab.visualizationType,
          firstVisualizationTab.layerConfiguration,
          firstVisualizationTab.areaType
        );
      }

      setIsConfigLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to load map configurations:', error);
      setIsConfigLoading(false);
      return false;
    }
  };

  const getMapConfigurations = async (projectId) => {
    try {
      const response = await mapConfigurationsAPI.getAll(projectId);
      console.log('Full API Response:', response);
      return response.data;
    } catch (error) {
      console.error('Error fetching map configurations:', error);
      throw error;
    }
  };


  // Update the useEffect that calls loadMapConfigurations
  useEffect(() => {
    if (mapView?.map) {
      loadMapConfigurations();
    }
  }, [mapView]);



  // Update handleLayerConfigChange to save to the specific tab
  const handleLayerConfigChange = (newConfig) => {
    const newTabs = tabs.map((tab) =>
      tab.id === activeTab && tab.visualizationType
        ? {
          ...tab,
          layerConfiguration: newConfig
        }
        : tab
    );
    setTabs(newTabs);
    updateVisualizationLayer(tabs.find(tab => tab.id === activeTab)?.visualizationType, newConfig);
  };
  // Handler for configuration previews
  const handleConfigPreview = (previewConfig) => {
    if (!mapView?.map) return;
  
    try {
      console.log('Previewing config:', previewConfig);
  
      // Remove existing visualization layers
      const layersToRemove = [];
      mapView.map.layers.forEach((layer) => {
        if (layer && layer.get && layer.get("isVisualizationLayer")) {
          layersToRemove.push(layer);
        }
      });
      layersToRemove.forEach((layer) => mapView.map.remove(layer));
  
      // Create new layer with preview config
      const activeTabData = tabs.find((tab) => tab.id === activeTab);
      if (activeTabData?.visualizationType) {
        // Create a deep clone of the preview config to prevent any references
        const previewConfigClone = JSON.parse(JSON.stringify(previewConfig));
        
        // Make sure we're preserving the dot value from the preview config
        // and not letting createLayers override it
        const dotValue = previewConfigClone.dotValue;
        
        const newLayer = createLayers(
          activeTabData.visualizationType,
          previewConfigClone,
          initialLayerConfigurations,
          activeTabData.areaType || selectedAreaType
        );
        
        if (newLayer) {
          newLayer.set("isVisualizationLayer", true);
          mapView.map.add(newLayer, 0);
          
          // Update legend if necessary
          if (legend) {
            legend.layerInfos = [{
              layer: newLayer,
              title: newLayer.title || activeTabData.visualizationType,
              hideLayersNotInCurrentView: false
            }];
            legend.visible = true;
          }
        }
      }
    } catch (error) {
      console.error("Error in preview:", error);
    }
  };

  // Add these useEffects after your existing ones
  useEffect(() => {
    // Load auto-saved configurations on mount
    loadMapConfigurations(AUTO_SAVE_KEY, false);
  }, []);


  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Tabs and New Map button on the left */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-2 overflow-x-auto">
              {tabs.map((tab) => (
                <div key={tab.id} className="flex items-center">
                  <div
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none transition-colors cursor-pointer ${tab.active
                      ? "bg-blue-500 dark:bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                  >
                    {tab.isEditing ? (
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
                              t.id === tab.id ? { ...t, name: e.target.value } : t
                            )
                          )
                        }
                        onKeyDown={(e) => handleNameKeyDown(tab.id, e)}
                        onBlur={(e) => handleNameChange(tab.id, e.target.value)}
                        className="bg-transparent border-none focus:outline-none text-inherit w-24 px-1"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center">
                        <span>{tab.name}</span>
                        {tab.id !== 1 && (
                          <>
                            <div
                              onClick={(e) => startEditing(tab.id, e)}
                              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
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
                            <div
                              onClick={(e) => deleteTab(tab.id, e)}
                              className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
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
              <button
                onClick={addNewTab}
                className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-colors duration-200 ease-in-out"
              >
                + New Map
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab !== 1 && (
              <>
                <select
                  value={
                    tabs.find((tab) => tab.id === activeTab)?.areaType?.value ||
                    areaTypes[0].value
                  }
                  onChange={(e) => {
                    const newAreaType = areaTypes.find(
                      type => type.value === parseInt(e.target.value)
                    );
                    handleAreaTypeChange(activeTab, newAreaType);
                  }}
                  className="block w-36 rounded-md border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
          text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
          focus:ring-blue-500 focus:border-blue-500"
                >
                  {areaTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                {/* Replace the select element with the SearchableDropdown */}
                <SearchableDropdown
                  options={visualizationOptions}
                  value={tabs.find((tab) => tab.id === activeTab)?.visualizationType || ""}
                  onChange={(newValue) => handleVisualizationChange(activeTab, newValue)}
                  placeholder="Select visualization"
                  searchPlaceholder="Search visualizations..."
                  className="w-56" // Make it a bit wider to accommodate the search functionality
                />

                {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
                  <button
                    onClick={() => setIsEditorOpen(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
            dark:hover:text-gray-300 focus:outline-none"
                    title="Edit layer properties"
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
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </>
            )}

            {/* Save button always visible */}
            <button
              onClick={async () => {
                try {
                  setIsSaving(true);

                  const configurations = tabs
                    .filter(tab => tab.id !== 1)
                    .map((tab, index) => ({
                      project_id: projectId,
                      project: projectId,
                      tab_name: tab.name,
                      visualization_type: tab.visualizationType || '',
                      area_type: convertAreaTypeToString(tab.id === activeTab ? selectedAreaType.value : tab.areaType?.value),
                      layer_configuration: tab.layerConfiguration,
                      order: index
                    }));

                  const existingConfigs = await mapConfigurationsAPI.getAll(projectId);
                  if (existingConfigs?.data?.length > 0) {
                    await Promise.all(
                      existingConfigs.data.map(config =>
                        mapConfigurationsAPI.delete(config.id)
                      )
                    );
                  }

                  for (const config of configurations) {
                    await mapConfigurationsAPI.create(projectId, {
                      ...config,
                      project: projectId
                    });
                  }

                  alert('Map configurations saved successfully');
                } catch (error) {
                  console.error('[Save] Error:', error);
                  alert('Failed to save map configurations');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
                dark:hover:text-gray-300 focus:outline-none"
              title="Save map configurations"
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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full">
            <ZoomAlert />
          </div>
        </div>

        {/* Layer Properties Editor - always positioned to the left of the Market Areas sidebar */}
        <div className="relative">
          {tabs.find((tab) => tab.id === activeTab)?.visualizationType && (
            <div
              className={`
                w-[500px] bg-white dark:bg-gray-800 border-l border-gray-200 
                dark:border-gray-700 transform transition-all duration-300 ease-in-out
                absolute h-full
                ${isEditorOpen ? 'translate-x-0' : 'translate-x-full'}
              `}
              style={{
                // Always position to the left of the Market Areas sidebar (350px width)
                right: '440px',
                top: '0'
              }}
            >
              <LayerPropertiesEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                visualizationType={
                  tabs.find((tab) => tab.id === activeTab)?.visualizationType
                }
                layerConfig={
                  tabs.find((tab) => tab.id === activeTab)?.layerConfiguration ||
                  (tabs.find((tab) => tab.id === activeTab)?.visualizationType
                    ? initialLayerConfigurations[tabs.find((tab) => tab.id === activeTab).visualizationType]
                    : null)
                }
                selectedAreaType={tabs.find((tab) => tab.id === activeTab)?.areaType || areaTypes[0]}
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
    </div>
  );
}