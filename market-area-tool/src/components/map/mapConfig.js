// src/components/map/mapConfig.js
import Color from "@arcgis/core/Color"; // May be needed by createClassBreaks

const colorScheme = {
    level1: [128, 0, 128, 0.45], // Purple
    level2: [0, 0, 139, 0.45], // Dark blue
    level3: [135, 206, 235, 0.45], // Sky blue
    level4: [144, 238, 144, 0.45], // Light green
    level5: [255, 255, 144, 0.45], // Light yellow
    level6: [255, 165, 0, 0.45], // Orange
    level7: [255, 99, 71, 0.45], // Salmon red
  };

// Update the createClassBreaks function accordingly
export const createClassBreaks = (breakPoints, labels) => {
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

// --- Initial Layer Configurations ---
// (This is the largest part to move)
export const initialLayerConfigurations = {
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

// --- Visualization Options ---
export const visualizationOptions = [
  // Original Heat Map Options
  {
    value: "income_HEAT",
    label: "Median Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "growth_HEAT",
    label: "Household Growth Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "affordability_HEAT",
    label: "Housing Affordability Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "density_HEAT",
    label: "Population Density",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "age_HEAT",
    label: "Median Age",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "unemployment_HEAT",
    label: "Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "homeValue_HEAT",
    label: "Median Home Value",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Income Heat Maps
  {
    value: "MEDHINC_CY_HEAT",
    label: "Median Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGHINC_CY_HEAT",
    label: "Average Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC0_CY_HEAT",
    label: "Household Income < $15K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC15_CY_HEAT",
    label: "Household Income $15K-$25K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC25_CY_HEAT",
    label: "Household Income $25K-$35K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC35_CY_HEAT",
    label: "Household Income $35K-$50K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC50_CY_HEAT",
    label: "Household Income $50K-$75K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC75_CY_HEAT",
    label: "Household Income $75K-$100K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC100_CY_HEAT",
    label: "Household Income $100K-$150K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC150_CY_HEAT",
    label: "Household Income $150K-$200K",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC200_CY_HEAT",
    label: "Household Income $200K+",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Dot Density Population Demographics
  {
    value: "TOTPOP_CY",
    label: "Total Population 2024",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTHH_CY",
    label: "Total Households 2024",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOP_CY",
    label: "Daytime Population 2024",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOPWRK_CY",
    label: "Daytime Workers 2024",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "WORKAGE_CY",
    label: "Working Age Population 18-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SENIOR_CY",
    label: "Senior Population 65+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CHILD_CY",
    label: "Child Population <18",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Detailed Age Groups
  {
    value: "POP0_CY",
    label: "Population Age 0-4",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP5_CY",
    label: "Population Age 5-9",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP10_CY",
    label: "Population Age 10-14",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP15_CY",
    label: "Population Age 15-19",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP20_CY",
    label: "Population Age 20-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP25_CY",
    label: "Population Age 25-29",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP30_CY",
    label: "Population Age 30-34",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP35_CY",
    label: "Population Age 35-39",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP40_CY",
    label: "Population Age 40-44",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP45_CY",
    label: "Population Age 45-49",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP50_CY",
    label: "Population Age 50-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP55_CY",
    label: "Population Age 55-59",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP60_CY",
    label: "Population Age 60-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP65_CY",
    label: "Population Age 65-69",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP70_CY",
    label: "Population Age 70-74",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP75_CY",
    label: "Population Age 75-79",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP80_CY",
    label: "Population Age 80-84",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP85_CY",
    label: "Population Age 85+",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Generations
  {
    value: "GENALPHACY",
    label: "Generation Alpha (Born 2017+)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GENZ_CY",
    label: "Generation Z (Born 1999-2016)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MILLENN_CY",
    label: "Millennials (Born 1981-1998)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GENX_CY",
    label: "Generation X (Born 1965-1980)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "BABYBOOMCY",
    label: "Baby Boomers (Born 1946-1964)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "OLDRGENSCY",
    label: "Silent & Greatest Gens (Born pre-1946)",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Race and Ethnicity Percentages
  {
    value: "hispanic_HEAT",
    label: "Hispanic Population Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "diversity_HEAT",
    label: "White Non-Hispanic Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPBLK_CY_PCT_HEAT",
    label: "Black Non-Hispanic Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPASN_CY_PCT_HEAT",
    label: "Asian Non-Hispanic Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Race and Ethnicity
  {
    value: "HISPPOP_CY",
    label: "Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPWHT_CY",
    label: "White Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPBLK_CY",
    label: "Black Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPASN_CY",
    label: "Asian Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPAI_CY",
    label: "American Indian/Alaska Native Non-Hispanic",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPPI_CY",
    label: "Pacific Islander Non-Hispanic",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPOTH_CY",
    label: "Other Race Non-Hispanic",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPMLT_CY",
    label: "Multiple Races Non-Hispanic",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Education
  {
    value: "NOHS_CY",
    label: "Less than 9th Grade Education",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SOMEHS_CY",
    label: "Some High School",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HSGRAD_CY",
    label: "High School Graduates",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GED_CY",
    label: "GED/Alternative Credential",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SMCOLL_CY",
    label: "Some College",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "ASSCDEG_CY",
    label: "Associate's Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "BACHDEG_CY",
    label: "Bachelor's Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GRADDEG_CY",
    label: "Graduate/Professional Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Education Percentages
  {
    value: "HSGRAD_LESS_CY_PCT_HEAT",
    label: "Less than High School Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "BACHDEG_PLUS_CY_PCT_HEAT",
    label: "Bachelor's Degree or Higher Percentage",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Home Values
  {
    value: "VAL0_CY",
    label: "Home Value < $50,000",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL50K_CY",
    label: "Home Value $50K-$99,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL100K_CY",
    label: "Home Value $100K-$149,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL150K_CY",
    label: "Home Value $150K-$199,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL200K_CY",
    label: "Home Value $200K-$249,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL250K_CY",
    label: "Home Value $250K-$299,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL300K_CY",
    label: "Home Value $300K-$399,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL400K_CY",
    label: "Home Value $400K-$499,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL500K_CY",
    label: "Home Value $500K-$749,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL750K_CY",
    label: "Home Value $750K-$999,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL1M_CY",
    label: "Home Value $1M-$1.5M",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL1PT5MCY",
    label: "Home Value $1.5M-$2M",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL2M_CY",
    label: "Home Value $2M+",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Home Values
  {
    value: "MEDVAL_CY_HEAT",
    label: "Median Home Value",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGVAL_CY_HEAT",
    label: "Average Home Value",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Housing
  {
    value: "OWNER_CY",
    label: "Owner Occupied Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RENTER_CY",
    label: "Renter Occupied Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTHU_CY",
    label: "Total Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VACANT_CY",
    label: "Vacant Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Housing
  {
    value: "PCTHOMEOWNER_HEAT",
    label: "Homeownership Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VACANT_CY_PCT_HEAT",
    label: "Vacancy Rate",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Income Brackets
  {
    value: "HINC0_CY",
    label: "Households < $15,000",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC15_CY",
    label: "Households $15,000-$24,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC25_CY",
    label: "Households $25,000-$34,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC35_CY",
    label: "Households $35,000-$49,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC50_CY",
    label: "Households $50,000-$74,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC75_CY",
    label: "Households $75,000-$99,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC100_CY",
    label: "Households $100,000-$149,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC150_CY",
    label: "Households $150,000-$199,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC200_CY",
    label: "Households $200,000+",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Additional Metrics
  {
    value: "POPGRWCYFY_HEAT",
    label: "Population Growth Rate 2024-2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHGRWCYFY_HEAT",
    label: "Household Growth Rate 2024-2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MHIGRWCYFY_HEAT",
    label: "Median Household Income Growth Rate 2024-2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "POPGRW20CY",
    label: "Population Growth Rate 2020-2024",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHGRW20CY_HEAT",
    label: "Household Growth Rate 2020-2024",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Economic Indicators
  {
    value: "UNEMPRT_CY_HEAT",
    label: "Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HAI_CY_HEAT",
    label: "Housing Affordability Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "INCMORT_CY_HEAT",
    label: "Percent of Income for Mortgage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "WLTHINDXCY_HEAT",
    label: "Wealth Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SEI_CY_HEAT",
    label: "Socioeconomic Status Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "PCI_CY_HEAT",
    label: "Per Capita Income",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Future Projections
  {
    value: "TOTPOP_FY_HEAT",
    label: "Projected Total Population 2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "TOTHH_FY_HEAT",
    label: "Projected Total Households 2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDHINC_FY_HEAT",
    label: "Projected Median Household Income 2029",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "POPDENS_FY_HEAT",
    label: "Projected Population Density 2029",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Demographic Composition
  {
    value: "MALES_CY",
    label: "Male Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "FEMALES_CY",
    label: "Female Population",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Advanced Demographic Categories
  {
    value: "EMPAGE16CY",
    label: "Employed Population Age 16-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE25CY",
    label: "Employed Population Age 25-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE55CY",
    label: "Employed Population Age 55-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE65CY",
    label: "Employed Population 65+",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Employment and Labor
  {
    value: "EMP_CY",
    label: "Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNEMP_CY",
    label: "Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLBFR_CY",
    label: "Civilian Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Detailed Race and Employment
  {
    value: "EMPWHTCY",
    label: "White Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPBLKCY",
    label: "Black Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPASNCY",
    label: "Asian Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAICY",
    label: "American Indian/Alaska Native Employed",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPPICY",
    label: "Pacific Islander Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPOTHCY",
    label: "Other Race Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPMLTCY",
    label: "Multiple Races Employed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Unemployed by Race
  {
    value: "UNWHTCY",
    label: "White Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNBLKCY",
    label: "Black Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNASNCY",
    label: "Asian Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAICY",
    label: "American Indian/Alaska Native Unemployed",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNPICY",
    label: "Pacific Islander Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNOTHCY",
    label: "Other Race Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNMLTCY",
    label: "Multiple Races Unemployed Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
];

// --- Area Types ---
export const areaTypes = [
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