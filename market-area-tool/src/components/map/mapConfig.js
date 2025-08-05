// src/components/map/mapConfig.js
import Color from "@arcgis/core/Color"; // May be needed by createClassBreaks

const colorScheme = {
    level1: [128, 0, 128, 0.35], // Purple
    level2: [0, 0, 139, 0.20], // Dark blue
    level3: [135, 206, 235, 0.35], // Sky blue
    level4: [144, 238, 144, 0.35], // Light green
    level5: [255, 255, 144, 0.35], // Light yellow
    level6: [255, 165, 0, 0.15], // Orange
    level7: [255, 99, 71, 0.15], // Salmon red
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
export const initialLayerConfigurations = {
  // Population & Households - Heat Maps (SIGNIFICANTLY LOWERED with higher final bounded breaks)

  // Population & Households - Heat Maps (SIGNIFICANTLY LOWERED with higher final bounded breaks)
  TOTPOP_CY_HEAT: {
    type: "class-breaks",
    field: "TOTPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 20,000",
        "20,000 or More",
      ]
    ),
  },

  TOTHH_CY_HEAT: {
    type: "class-breaks",
    field: "TOTHH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200 },
        { min: 200, max: 400 },
        { min: 400, max: 800 },
        { min: 800, max: 2000 },
        { min: 2000, max: 4000 },
        { min: 4000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 200",
        "200 - 400",
        "400 - 800",
        "800 - 2,000",
        "2,000 - 4,000",
        "4,000 - 20,000",
        "20,000 or More",
      ]
    ),
  },

  AVGHHSZ_CY_HEAT: {
    type: "class-breaks",
    field: "AVGHHSZ_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2.0 },
        { min: 2.0, max: 2.3 },
        { min: 2.3, max: 2.6 },
        { min: 2.6, max: 3.0 },
        { min: 3.0, max: 3.5 },
        { min: 3.5, max: 4.0 },
        { min: 4.0 },
      ],
      [
        "Less than 2.0",
        "2.0 - 2.3",
        "2.3 - 2.6",
        "2.6 - 3.0",
        "3.0 - 3.5",
        "3.5 - 4.0",
        "4.0 or More",
      ]
    ),
  },

  // Daytime Population - Heat Maps (SIGNIFICANTLY LOWERED)
  DPOP_CY_HEAT: {
    type: "class-breaks",
    field: "DPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 50,000",
        "50,000 or More",
      ]
    ),
  },

  DPOPWRK_CY_HEAT: {
    type: "class-breaks",
    field: "DPOPWRK_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  DPOPRES_CY_HEAT: {
    type: "class-breaks",
    field: "DPOPRES_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  // Age - Heat Maps (SIGNIFICANTLY LOWERED)
  MEDAGE_CY_HEAT: {
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
        "55 years or More",
      ]
    ),
  },

  WORKAGE_CY_HEAT: {
    type: "class-breaks",
    field: "WORKAGE_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 300 },
        { min: 300, max: 750 },
        { min: 750, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 6000 },
        { min: 6000, max: 30000 },
        { min: 30000 },
      ],
      [
        "Less than 300",
        "300 - 750",
        "750 - 1,500",
        "1,500 - 3,000",
        "3,000 - 6,000",
        "6,000 - 30,000",
        "30,000 or More",
      ]
    ),
  },

  SENIOR_CY_HEAT: {
    type: "class-breaks",
    field: "SENIOR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 75 },
        { min: 75, max: 200 },
        { min: 200, max: 400 },
        { min: 400, max: 800 },
        { min: 800, max: 1500 },
        { min: 1500, max: 7500 },
        { min: 7500 },
      ],
      [
        "Less than 75",
        "75 - 200",
        "200 - 400",
        "400 - 800",
        "800 - 1,500",
        "1,500 - 7,500",
        "7,500 or More",
      ]
    ),
  },

  CHILD_CY_HEAT: {
    type: "class-breaks",
    field: "CHILD_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1200 },
        { min: 1200, max: 2500 },
        { min: 2500, max: 12500 },
        { min: 12500 },
      ],
      [
        "Less than 100",
        "100 - 300",
        "300 - 600",
        "600 - 1,200",
        "1,200 - 2,500",
        "2,500 - 12,500",
        "12,500 or More",
      ]
    ),
  },

  // Income - Heat Maps (keeping same since these are dollar amounts, not population counts)
  MEDHINC_CY_HEAT: {
    type: "class-breaks",
    field: "MEDHINC_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 150000 },
        { min: 150000, max: 300000 },
        { min: 300000, max: 500000 },
        { min: 500000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $150,000",
        "$150,000 - $300,000",
        "$300,000 - $500,000",
        "$500,000 or More",
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
        { min: 100000, max: 150000 },
        { min: 150000, max: 300000 },
        { min: 300000, max: 500000 },
        { min: 500000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $150,000",
        "$150,000 - $300,000",
        "$300,000 - $500,000",
        "$500,000 or More",
      ]
    ),
  },

  // Income Brackets - Heat Maps (SIGNIFICANTLY LOWERED household counts)
  HINC0_CY_HEAT: {
    type: "class-breaks",
    field: "HINC0_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 80 },
        { min: 80, max: 175 },
        { min: 175, max: 875 },
        { min: 875 },
      ],
      [
        "Less than 8 households",
        "8 - 20 households",
        "20 - 40 households",
        "40 - 80 households",
        "80 - 175 households",
        "175 - 875 households",
        "875 households or More",
      ]
    ),
  },

  HINC15_CY_HEAT: {
    type: "class-breaks",
    field: "HINC15_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 80 },
        { min: 80, max: 175 },
        { min: 175, max: 875 },
        { min: 875 },
      ],
      [
        "Less than 8 households",
        "8 - 20 households",
        "20 - 40 households",
        "40 - 80 households",
        "80 - 175 households",
        "175 - 875 households",
        "875 households or More",
      ]
    ),
  },

  HINC25_CY_HEAT: {
    type: "class-breaks",
    field: "HINC25_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 12 },
        { min: 12, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 125 },
        { min: 125, max: 250 },
        { min: 250, max: 1250 },
        { min: 1250 },
      ],
      [
        "Less than 12 households",
        "12 - 30 households",
        "30 - 60 households",
        "60 - 125 households",
        "125 - 250 households",
        "250 - 1,250 households",
        "1,250 households or More",
      ]
    ),
  },

  HINC35_CY_HEAT: {
    type: "class-breaks",
    field: "HINC35_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 12 },
        { min: 12, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 125 },
        { min: 125, max: 250 },
        { min: 250, max: 1250 },
        { min: 1250 },
      ],
      [
        "Less than 12 households",
        "12 - 30 households",
        "30 - 60 households",
        "60 - 125 households",
        "125 - 250 households",
        "250 - 1,250 households",
        "1,250 households or More",
      ]
    ),
  },

  HINC50_CY_HEAT: {
    type: "class-breaks",
    field: "HINC50_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15 households",
        "15 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 300 households",
        "300 - 1,500 households",
        "1,500 households or More",
      ]
    ),
  },

  HINC75_CY_HEAT: {
    type: "class-breaks",
    field: "HINC75_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15 households",
        "15 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 300 households",
        "300 - 1,500 households",
        "1,500 households or More",
      ]
    ),
  },

  HINC100_CY_HEAT: {
    type: "class-breaks",
    field: "HINC100_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 18 },
        { min: 18, max: 42 },
        { min: 42, max: 85 },
        { min: 85, max: 175 },
        { min: 175, max: 350 },
        { min: 350, max: 1750 },
        { min: 1750 },
      ],
      [
        "Less than 18 households",
        "18 - 42 households",
        "42 - 85 households",
        "85 - 175 households",
        "175 - 350 households",
        "350 - 1,750 households",
        "1,750 households or More",
      ]
    ),
  },

  HINC150_CY_HEAT: {
    type: "class-breaks",
    field: "HINC150_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10 households",
        "10 - 25 households",
        "25 - 50 households",
        "50 - 100 households",
        "100 - 200 households",
        "200 - 1,000 households",
        "1,000 households or More",
      ]
    ),
  },

  HINC200_CY_HEAT: {
    type: "class-breaks",
    field: "HINC200_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 7 },
        { min: 7, max: 18 },
        { min: 18, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 750 },
        { min: 750 },
      ],
      [
        "Less than 7 households",
        "7 - 18 households",
        "18 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 750 households",
        "750 households or More",
      ]
    ),
  },

  UNEMPRT_CY_HEAT: {
    type: "class-breaks",
    field: "UNEMPRT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 9 },
        { min: 9, max: 12 },
        { min: 12, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 9%",
        "9% - 12%",
        "12% - 25%",
        "25% or More",
      ]
    ),
  },

  // Growth Rates - Heat Maps (keeping same since these are percentages)
  POPGRWCYFY_HEAT: {
    type: "class-breaks",
    field: "POPGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 0 },
        { min: 0, max: 0.4 },
        { min: 0.4, max: 0.8 },
        { min: 0.8, max: 1.2 },
        { min: 1.2, max: 1.6 },
        { min: 1.6, max: 2.2 },
        { min: 2.2 },
      ],
      [
        "Less than 0%",
        "0% - 0.4%",
        "0.4% - 0.8%",
        "0.8% - 1.2%",
        "1.2% - 1.6%",
        "1.6% - 2.2%",
        "2.2% or More",
      ]
    ),
  },

  HHGRWCYFY_HEAT: {
    type: "class-breaks",
    field: "HHGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 0 },
        { min: 0, max: 0.4 },
        { min: 0.4, max: 0.8 },
        { min: 0.8, max: 1.2 },
        { min: 1.2, max: 1.6 },
        { min: 1.6, max: 2.2 },
        { min: 2.2 },
      ],
      [
        "Less than 0%",
        "0% - 0.4%",
        "0.4% - 0.8%",
        "0.8% - 1.2%",
        "1.2% - 1.6%",
        "1.6% - 2.2%",
        "2.2% or More",
      ]
    ),
  },

  MHIGRWCYFY_HEAT: {
    type: "class-breaks",
    field: "MHIGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 1.8 },
        { min: 1.8, max: 2.6 },
        { min: 2.6, max: 3.4 },
        { min: 3.4, max: 4.2 },
        { min: 4.2, max: 5.5 },
        { min: 5.5 },
      ],
      [
        "Less than 1%",
        "1% - 1.8%",
        "1.8% - 2.6%",
        "2.6% - 3.4%",
        "3.4% - 4.2%",
        "4.2% - 5.5%",
        "5.5% or More",
      ]
    ),
  },

  POPGRW20CY_HEAT: {
    type: "class-breaks",
    field: "POPGRW20CY",
    classBreakInfos: createClassBreaks(
      [
        { max: -1 },
        { min: -1, max: -0.2 },
        { min: -0.2, max: 0.5 },
        { min: 0.5, max: 1.2 },
        { min: 1.2, max: 2.0 },
        { min: 2.0, max: 3.2 },
        { min: 3.2 },
      ],
      [
        "Less than -1%",
        "-1% to -0.2%",
        "-0.2% to 0.5%",
        "0.5% to 1.2%",
        "1.2% to 2.0%",
        "2.0% to 3.2%",
        "3.2% or More",
      ]
    ),
  },

  HHGRW20CY_HEAT: {
    type: "class-breaks",
    field: "HHGRW20CY",
    classBreakInfos: createClassBreaks(
      [
        { max: -1 },
        { min: -1, max: -0.2 },
        { min: -0.2, max: 0.5 },
        { min: 0.5, max: 1.2 },
        { min: 1.2, max: 2.0 },
        { min: 2.0, max: 3.2 },
        { min: 3.2 },
      ],
      [
        "Less than -1%",
        "-1% to -0.2%",
        "-0.2% to 0.5%",
        "0.5% to 1.2%",
        "1.2% to 2.0%",
        "2.0% to 3.2%",
        "3.2% or More",
      ]
    ),
  },

  // Housing - Heat Maps (SIGNIFICANTLY LOWERED)
  TOTHU_CY_HEAT: {
    type: "class-breaks",
    field: "TOTHU_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  OWNER_CY_HEAT: {
    type: "class-breaks",
    field: "OWNER_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 150",
        "150 - 300",
        "300 - 600",
        "600 - 1,500",
        "1,500 - 3,000",
        "3,000 - 15,000",
        "15,000 or More",
      ]
    ),
  },

  RENTER_CY_HEAT: {
    type: "class-breaks",
    field: "RENTER_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1250 },
        { min: 1250, max: 2500 },
        { min: 2500, max: 12500 },
        { min: 12500 },
      ],
      [
        "Less than 100",
        "100 - 250",
        "250 - 500",
        "500 - 1,250",
        "1,250 - 2,500",
        "2,500 - 12,500",
        "12,500 or More",
      ]
    ),
  },

  PCTHOMEOWNER_HEAT: {
    type: "class-breaks",
    field: "PCTHOMEOWNER",
    classBreakInfos: createClassBreaks(
      [
        { max: 30 },
        { min: 30, max: 45 },
        { min: 45, max: 60 },
        { min: 60, max: 75 },
        { min: 75, max: 90 },
        { min: 90, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 30%",
        "30% - 45%",
        "45% - 60%",
        "60% - 75%",
        "75% - 90%",
        "90% - 100%",
        "100%",
      ]
    ),
  },

  VACANT_CY_HEAT: {
    type: "class-breaks",
    field: "VACANT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 500 },
        { min: 500, max: 2000 },
        { min: 2000 },
      ],
      [
        "Less than 10",
        "10 - 25",
        "25 - 50",
        "50 - 100",
        "100 - 500",
        "500 - 2,000",
        "2,000 or More",
      ]
    ),
  },

  VACANT_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "VACANT_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 50%",
        "50% or More",
      ]
    ),
  },

  MEDVAL_CY_HEAT: {
    type: "class-breaks",
    field: "MEDVAL_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200000 },
        { min: 200000, max: 320000 },
        { min: 320000, max: 450000 },
        { min: 450000, max: 600000 },
        { min: 600000, max: 800000 },
        { min: 800000, max: 1100000 },
        { min: 1100000 },
      ],
      [
        "Less than $200,000",
        "$200,000 - $320,000",
        "$320,000 - $450,000",
        "$450,000 - $600,000",
        "$600,000 - $800,000",
        "$800,000 - $1,100,000",
        "$1,100,000 or More",
      ]
    ),
  },

  AVGVAL_CY_HEAT: {
    type: "class-breaks",
    field: "AVGVAL_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250000 },
        { min: 250000, max: 380000 },
        { min: 380000, max: 530000 },
        { min: 530000, max: 700000 },
        { min: 700000, max: 900000 },
        { min: 900000, max: 1200000 },
        { min: 1200000 },
      ],
      [
        "Less than $250,000",
        "$250,000 - $380,000",
        "$380,000 - $530,000",
        "$530,000 - $700,000",
        "$700,000 - $900,000",
        "$900,000 - $1,200,000",
        "$1,200,000 or More",
      ]
    ),
  },

  // Home Value Ranges - Heat Maps (SIGNIFICANTLY LOWERED home counts)
  VAL0_CY_HEAT: {
    type: "class-breaks",
    field: "VAL0_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10 Homes",
        "10 - 25 Homes",
        "25 - 50 Homes",
        "50 - 100 Homes",
        "100 - 200 Homes",
        "200 - 1,000 Homes",
        "1,000 Homes or More",
      ]
    ),
  },

  VAL50K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL50K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 7 },
        { min: 7, max: 18 },
        { min: 18, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 750 },
        { min: 750 },
      ],
      [
        "Less than 7 Homes",
        "7 - 18 Homes",
        "18 - 35 Homes",
        "35 - 75 Homes",
        "75 - 150 Homes",
        "150 - 750 Homes",
        "750 Homes or More",
      ]
    ),
  },

  VAL100K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL100K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 7 },
        { min: 7, max: 18 },
        { min: 18, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 750 },
        { min: 750 },
      ],
      [
        "Less than 7 Homes",
        "7 - 18 Homes",
        "18 - 35 Homes",
        "35 - 75 Homes",
        "75 - 150 Homes",
        "150 - 750 Homes",
        "750 Homes or More",
      ]
    ),
  },

  VAL150K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL150K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL200K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL200K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL250K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL250K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL300K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL300K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL400K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL400K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL500K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL500K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 22 },
        { min: 22, max: 45 },
        { min: 45, max: 90 },
        { min: 90, max: 180 },
        { min: 180, max: 900 },
        { min: 900 },
      ],
      [
        "Less than 10 Homes",
        "10 - 22 Homes",
        "22 - 45 Homes",
        "45 - 90 Homes",
        "90 - 180 Homes",
        "180 - 900 Homes",
        "900 Homes or More",
      ]
    ),
  },

  VAL750K_CY_HEAT: {
    type: "class-breaks",
    field: "VAL750K_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 7 },
        { min: 7, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 300 },
        { min: 300 },
      ],
      [
        "Less than 3 Homes",
        "3 - 7 Homes",
        "7 - 15 Homes",
        "15 - 30 Homes",
        "30 - 60 Homes",
        "60 - 300 Homes",
        "300 Homes or More",
      ]
    ),
  },

  VAL1M_CY_HEAT: {
    type: "class-breaks",
    field: "VAL1M_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 8 },
        { min: 8, max: 18 },
        { min: 18, max: 35 },
        { min: 35, max: 175 },
        { min: 175 },
      ],
      [
        "Less than 2 Homes",
        "2 - 4 Homes",
        "4 - 8 Homes",
        "8 - 18 Homes",
        "18 - 35 Homes",
        "35 - 175 Homes",
        "175 Homes or More",
      ]
    ),
  },

  VAL1PT5MCY_HEAT: {
    type: "class-breaks",
    field: "VAL1PT5MCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 12 },
        { min: 12, max: 25 },
        { min: 25, max: 125 },
        { min: 125 },
      ],
      [
        "Less than 1 home",
        "1 - 2 Homes",
        "2 - 5 Homes",
        "5 - 12 Homes",
        "12 - 25 Homes",
        "25 - 125 Homes",
        "125 Homes or More",
      ]
    ),
  },

  VAL2M_CY_HEAT: {
    type: "class-breaks",
    field: "VAL2M_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 75 },
        { min: 75 },
      ],
      [
        "Less than 1 home",
        "1 - 2 Homes",
        "2 - 4 Homes",
        "4 - 8 Homes",
        "8 - 15 Homes",
        "15 - 75 Homes",
        "75 Homes or More",
      ]
    ),
  },

  // Affluence & Affordability - Heat Maps
  HAI_CY_HEAT: {
    type: "class-breaks",
    field: "HAI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 125 },
        { min: 125, max: 150 },
        { min: 150, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 150",
        "150 - 200",
        "200 or More",
      ]
    ),
  },

  INCMORT_CY_HEAT: {
    type: "class-breaks",
    field: "INCMORT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 25 },
        { min: 25, max: 30 },
        { min: 30, max: 35 },
        { min: 35, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 15%",
        "15% - 20%",
        "20% - 25%",
        "25% - 30%",
        "30% - 35%",
        "35% - 50%",
        "50% or More",
      ]
    ),
  },

  WLTHINDXCY_HEAT: {
    type: "class-breaks",
    field: "WLTHINDXCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 125 },
        { min: 125, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 200",
        "200 or More",
      ]
    ),
  },

  SEI_CY_HEAT: {
    type: "class-breaks",
    field: "SEI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
        { min: 100, max: 125 },
        { min: 125, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 75",
        "75 - 100",
        "100 - 125",
        "125 - 200",
        "200 or More",
      ]
    ),
  },

  PCI_CY_HEAT: {
    type: "class-breaks",
    field: "PCI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25000 },
        { min: 25000, max: 35000 },
        { min: 35000, max: 45000 },
        { min: 45000, max: 60000 },
        { min: 60000, max: 80000 },
        { min: 80000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $25,000",
        "$25,000 - $35,000",
        "$35,000 - $45,000",
        "$45,000 - $60,000",
        "$60,000 - $80,000",
        "$80,000 - $150,000",
        "$150,000 or More",
      ]
    ),
  },

  // Race & Ethnicity Percentages - Heat Maps
  HISPPOP_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "HISPPOP_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 50 },
        { min: 50, max: 70 },
        { min: 70, max: 95 },
        { min: 95 },
      ],
      [
        "Less than 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 50%",
        "50% - 70%",
        "70% - 95%",
        "95% or More",
      ]
    ),
  },

  NHSPWHT_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPWHT_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 60 },
        { min: 60, max: 75 },
        { min: 75, max: 85 },
        { min: 85, max: 95 },
        { min: 95 },
      ],
      [
        "Less than 20%",
        "20% - 40%",
        "40% - 60%",
        "60% - 75%",
        "75% - 85%",
        "85% - 95%",
        "95% or More",
      ]
    ),
  },

  NHSPBLK_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPBLK_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 50 },
        { min: 50, max: 80 },
        { min: 80 },
      ],
      [
        "Less than 2%",
        "2% - 5%",
        "5% - 15%",
        "15% - 30%",
        "30% - 50%",
        "50% - 80%",
        "80% or More",
      ]
    ),
  },

  NHSPAI_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPAI_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 0.5 },
        { min: 0.5, max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 15 },
        { min: 15, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 0.5%",
        "0.5% - 1%",
        "1% - 2%",
        "2% - 5%",
        "5% - 15%",
        "15% - 50%",
        "50% or More",
      ]
    ),
  },

  NHSPASN_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPASN_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 35 },
        { min: 35, max: 60 },
        { min: 60 },
      ],
      [
        "Less than 2%",
        "2% - 5%",
        "5% - 10%",
        "10% - 20%",
        "20% - 35%",
        "35% - 60%",
        "60% or More",
      ]
    ),
  },

  NHSPPI_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPPI_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 0.2 },
        { min: 0.2, max: 0.5 },
        { min: 0.5, max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 15 },
        { min: 15 },
      ],
      [
        "Less than 0.2%",
        "0.2% - 0.5%",
        "0.5% - 1%",
        "1% - 2%",
        "2% - 5%",
        "5% - 15%",
        "15% or More",
      ]
    ),
  },

  NHSPOTH_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPOTH_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 30 },
        { min: 30 },
      ],
      [
        "Less than 1%",
        "1% - 2%",
        "2% - 4%",
        "4% - 8%",
        "8% - 15%",
        "15% - 30%",
        "30% or More",
      ]
    ),
  },

  NHSPMLT_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "NHSPMLT_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 7 },
        { min: 7, max: 12 },
        { min: 12, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 1%",
        "1% - 2%",
        "2% - 4%",
        "4% - 7%",
        "7% - 12%",
        "12% - 25%",
        "25% or More",
      ]
    ),
  },

  // Education Percentages - Heat Maps
  HSGRAD_LESS_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "HSGRAD_LESS_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 50%",
        "50% or More",
      ]
    ),
  },

  BACHDEG_PLUS_CY_PCT_HEAT: {
    type: "class-breaks",
    field: "BACHDEG_PLUS_CY_PCT",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 45 },
        { min: 45, max: 60 },
        { min: 60, max: 80 },
        { min: 80 },
      ],
      [
        "Less than 15%",
        "15% - 25%",
        "25% - 35%",
        "35% - 45%",
        "45% - 60%",
        "60% - 80%",
        "80% or More",
      ]
    ),
  },

  // 2029 Future Projections - Heat Maps
  TOTPOP_FY_HEAT: {
    type: "class-breaks",
    field: "TOTPOP_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 50,000",
        "50,000 or More",
      ]
    ),
  },

  TOTHH_FY_HEAT: {
    type: "class-breaks",
    field: "TOTHH_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200 },
        { min: 200, max: 400 },
        { min: 400, max: 800 },
        { min: 800, max: 2000 },
        { min: 2000, max: 4000 },
        { min: 4000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 200",
        "200 - 400",
        "400 - 800",
        "800 - 2,000",
        "2,000 - 4,000",
        "4,000 - 20,000",
        "20,000 or More",
      ]
    ),
  },

  AVGHHSZ_FY_HEAT: {
    type: "class-breaks",
    field: "AVGHHSZ_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2.0 },
        { min: 2.0, max: 2.3 },
        { min: 2.3, max: 2.6 },
        { min: 2.6, max: 3.0 },
        { min: 3.0, max: 3.5 },
        { min: 3.5, max: 4.0 },
        { min: 4.0 },
      ],
      [
        "Less than 2.0",
        "2.0 - 2.3",
        "2.3 - 2.6",
        "2.6 - 3.0",
        "3.0 - 3.5",
        "3.5 - 4.0",
        "4.0 or More",
      ]
    ),
  },

  MEDHINC_FY_HEAT: {
    type: "class-breaks",
    field: "MEDHINC_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 150000 },
        { min: 150000, max: 300000 },
        { min: 300000, max: 500000 },
        { min: 500000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $150,000",
        "$150,000 - $300,000",
        "$300,000 - $500,000",
        "$500,000 or More",
      ]
    ),
  },

  AVGHINC_FY_HEAT: {
    type: "class-breaks",
    field: "AVGHINC_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50000 },
        { min: 50000, max: 75000 },
        { min: 75000, max: 100000 },
        { min: 100000, max: 150000 },
        { min: 150000, max: 300000 },
        { min: 300000, max: 500000 },
        { min: 500000 },
      ],
      [
        "Less than $50,000",
        "$50,000 - $75,000",
        "$75,000 - $100,000",
        "$100,000 - $150,000",
        "$150,000 - $300,000",
        "$300,000 - $500,000",
        "$500,000 or More",
      ]
    ),
  },

  POPDENS_FY_HEAT: {
    type: "class-breaks",
    field: "POPDENS_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 100 per sq. mile",
        "100 - 500 per sq. mile",
        "500 - 1,000 per sq. mile",
        "1,000 - 2,500 per sq. mile",
        "2,500 - 5,000 per sq. mile",
        "5,000 - 15,000 per sq. mile",
        "15,000 or More per sq. mile",
      ]
    ),
  },

  // Population Density - Heat Maps
  POPDENS_CY_HEAT: {
    type: "class-breaks",
    field: "POPDENS_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 100 per sq. mile",
        "100 - 500 per sq. mile",
        "500 - 1,000 per sq. mile",
        "1,000 - 2,500 per sq. mile",
        "2,500 - 5,000 per sq. mile",
        "5,000 - 15,000 per sq. mile",
        "15,000 or More per sq. mile",
      ]
    ),
  },

  DPOPDENSCY_HEAT: {
    type: "class-breaks",
    field: "DPOPDENSCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 100 },
        { min: 100, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 100 per sq. mile",
        "100 - 500 per sq. mile",
        "500 - 1,000 per sq. mile",
        "1,000 - 2,500 per sq. mile",
        "2,500 - 5,000 per sq. mile",
        "5,000 - 15,000 per sq. mile",
        "15,000 or More per sq. mile",
      ]
    ),
  },

  // Dependency Ratios - Heat Maps
  CHLDDEP_CY_HEAT: {
    type: "class-breaks",
    field: "CHLDDEP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 20 },
        { min: 20, max: 30 },
        { min: 30, max: 40 },
        { min: 40, max: 50 },
        { min: 50, max: 60 },
        { min: 60, max: 80 },
        { min: 80 },
      ],
      [
        "Less than 20",
        "20 - 30",
        "30 - 40",
        "40 - 50",
        "50 - 60",
        "60 - 80",
        "80 or More",
      ]
    ),
  },

  AGEDEP_CY_HEAT: {
    type: "class-breaks",
    field: "AGEDEP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 40 },
        { min: 40, max: 50 },
        { min: 50, max: 60 },
        { min: 60, max: 70 },
        { min: 70, max: 80 },
        { min: 80, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 40",
        "40 - 50",
        "50 - 60",
        "60 - 70",
        "70 - 80",
        "80 - 100",
        "100 or More",
      ]
    ),
  },

  SENRDEP_CY_HEAT: {
    type: "class-breaks",
    field: "SENRDEP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 45 },
        { min: 45, max: 55 },
        { min: 55, max: 75 },
        { min: 75 },
      ],
      [
        "Less than 15",
        "15 - 25",
        "25 - 35",
        "35 - 45",
        "45 - 55",
        "55 - 75",
        "75 or More",
      ]
    ),
  },

  // Additional Population - Heat Maps (SIGNIFICANTLY LOWERED)
  HHPOP_CY_HEAT: {
    type: "class-breaks",
    field: "HHPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 50,000",
        "50,000 or More",
      ]
    ),
  },

  GQPOP_CY_HEAT: {
    type: "class-breaks",
    field: "GQPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  MALES_CY_HEAT: {
    type: "class-breaks",
    field: "MALES_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  MEDMAGE_CY_HEAT: {
    type: "class-breaks",
    field: "MEDMAGE_CY",
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
        "55 years or More",
      ]
    ),
  },

  FEMALES_CY_HEAT: {
    type: "class-breaks",
    field: "FEMALES_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  MEDFAGE_CY_HEAT: {
    type: "class-breaks",
    field: "MEDFAGE_CY",
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
        "55 years or More",
      ]
    ),
  },

  // Income Inequality - Heat Maps
  GINI_CY_HEAT: {
    type: "class-breaks",
    field: "GINI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 0.35 },
        { min: 0.35, max: 0.4 },
        { min: 0.4, max: 0.45 },
        { min: 0.45, max: 0.5 },
        { min: 0.5, max: 0.55 },
        { min: 0.55, max: 0.7 },
        { min: 0.7 },
      ],
      [
        "Less than 0.35",
        "0.35 - 0.40",
        "0.40 - 0.45",
        "0.45 - 0.50",
        "0.50 - 0.55",
        "0.55 - 0.70",
        "0.70 or More",
      ]
    ),
  },

  RAT9010_CY_HEAT: {
    type: "class-breaks",
    field: "RAT9010_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 4 },
        { min: 4, max: 5 },
        { min: 5, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 12 },
        { min: 12 },
      ],
      [
        "Less than 3",
        "3 - 4",
        "4 - 5",
        "5 - 6",
        "6 - 8",
        "8 - 12",
        "12 or More",
      ]
    ),
  },

  RAT9050_CY_HEAT: {
    type: "class-breaks",
    field: "RAT9050_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1.5 },
        { min: 1.5, max: 1.8 },
        { min: 1.8, max: 2.0 },
        { min: 2.0, max: 2.3 },
        { min: 2.3, max: 2.8 },
        { min: 2.8, max: 4.0 },
        { min: 4.0 },
      ],
      [
        "Less than 1.5",
        "1.5 - 1.8",
        "1.8 - 2.0",
        "2.0 - 2.3",
        "2.3 - 2.8",
        "2.8 - 4.0",
        "4.0 or More",
      ]
    ),
  },

  RAT5010_CY_HEAT: {
    type: "class-breaks",
    field: "RAT5010_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1.8 },
        { min: 1.8, max: 2.0 },
        { min: 2.0, max: 2.2 },
        { min: 2.2, max: 2.5 },
        { min: 2.5, max: 3.0 },
        { min: 3.0, max: 4.0 },
        { min: 4.0 },
      ],
      [
        "Less than 1.8",
        "1.8 - 2.0",
        "2.0 - 2.2",
        "2.2 - 2.5",
        "2.5 - 3.0",
        "3.0 - 4.0",
        "4.0 or More",
      ]
    ),
  },

  SHR8020_CY_HEAT: {
    type: "class-breaks",
    field: "SHR8020_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 4 },
        { min: 4, max: 5 },
        { min: 5, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 12 },
        { min: 12 },
      ],
      [
        "Less than 3",
        "3 - 4",
        "4 - 5",
        "5 - 6",
        "6 - 8",
        "8 - 12",
        "12 or More",
      ]
    ),
  },

  SHR9040_CY_HEAT: {
    type: "class-breaks",
    field: "SHR9040_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1.5 },
        { min: 1.5, max: 1.7 },
        { min: 1.7, max: 1.9 },
        { min: 1.9, max: 2.2 },
        { min: 2.2, max: 2.6 },
        { min: 2.6, max: 3.5 },
        { min: 3.5 },
      ],
      [
        "Less than 1.5",
        "1.5 - 1.7",
        "1.7 - 1.9",
        "1.9 - 2.2",
        "2.2 - 2.6",
        "2.6 - 3.5",
        "3.5 or More",
      ]
    ),
  },

  // Income Tiers - Heat Maps (SIGNIFICANTLY LOWERED household counts)
  LOTRHH_CY_HEAT: {
    type: "class-breaks",
    field: "LOTRHH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 5000 },
        { min: 5000 },
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 200 households",
        "200 - 500 households",
        "500 - 1,000 households",
        "1,000 - 5,000 households",
        "5,000 households or More",
      ]
    ),
  },

  MDTRHH_CY_HEAT: {
    type: "class-breaks",
    field: "MDTRHH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 5000 },
        { min: 5000 },
      ],
      [
        "Less than 50 households",
        "50 - 100 households",
        "100 - 200 households",
        "200 - 500 households",
        "500 - 1,000 households",
        "1,000 - 5,000 households",
        "5,000 households or More",
      ]
    ),
  },

  UPTRHH_CY_HEAT: {
    type: "class-breaks",
    field: "UPTRHH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25 households",
        "25 - 50 households",
        "50 - 100 households",
        "100 - 250 households",
        "250 - 500 households",
        "500 - 2,500 households",
        "2,500 households or More",
      ]
    ),
  },

  // Disposable Income - Heat Maps (SIGNIFICANTLY LOWERED household counts)
  DI0_CY_HEAT: {
    type: "class-breaks",
    field: "DI0_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 80 },
        { min: 80, max: 175 },
        { min: 175, max: 875 },
        { min: 875 },
      ],
      [
        "Less than 8 households",
        "8 - 20 households",
        "20 - 40 households",
        "40 - 80 households",
        "80 - 175 households",
        "175 - 875 households",
        "875 households or More",
      ]
    ),
  },

  DI15_CY_HEAT: {
    type: "class-breaks",
    field: "DI15_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 80 },
        { min: 80, max: 175 },
        { min: 175, max: 875 },
        { min: 875 },
      ],
      [
        "Less than 8 households",
        "8 - 20 households",
        "20 - 40 households",
        "40 - 80 households",
        "80 - 175 households",
        "175 - 875 households",
        "875 households or More",
      ]
    ),
  },

  DI25_CY_HEAT: {
    type: "class-breaks",
    field: "DI25_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 12 },
        { min: 12, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 125 },
        { min: 125, max: 250 },
        { min: 250, max: 1250 },
        { min: 1250 },
      ],
      [
        "Less than 12 households",
        "12 - 30 households",
        "30 - 60 households",
        "60 - 125 households",
        "125 - 250 households",
        "250 - 1,250 households",
        "1,250 households or More",
      ]
    ),
  },

  DI35_CY_HEAT: {
    type: "class-breaks",
    field: "DI35_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 12 },
        { min: 12, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 125 },
        { min: 125, max: 250 },
        { min: 250, max: 1250 },
        { min: 1250 },
      ],
      [
        "Less than 12 households",
        "12 - 30 households",
        "30 - 60 households",
        "60 - 125 households",
        "125 - 250 households",
        "250 - 1,250 households",
        "1,250 households or More",
      ]
    ),
  },

  DI50_CY_HEAT: {
    type: "class-breaks",
    field: "DI50_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15 households",
        "15 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 300 households",
        "300 - 1,500 households",
        "1,500 households or More",
      ]
    ),
  },

  DI75_CY_HEAT: {
    type: "class-breaks",
    field: "DI75_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15 households",
        "15 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 300 households",
        "300 - 1,500 households",
        "1,500 households or More",
      ]
    ),
  },

  DI100_CY_HEAT: {
    type: "class-breaks",
    field: "DI100_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 18 },
        { min: 18, max: 42 },
        { min: 42, max: 85 },
        { min: 85, max: 175 },
        { min: 175, max: 350 },
        { min: 350, max: 1750 },
        { min: 1750 },
      ],
      [
        "Less than 18 households",
        "18 - 42 households",
        "42 - 85 households",
        "85 - 175 households",
        "175 - 350 households",
        "350 - 1,750 households",
        "1,750 households or More",
      ]
    ),
  },

  DI150_CY_HEAT: {
    type: "class-breaks",
    field: "DI150_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10 households",
        "10 - 25 households",
        "25 - 50 households",
        "50 - 100 households",
        "100 - 200 households",
        "200 - 1,000 households",
        "1,000 households or More",
      ]
    ),
  },

  DI200_CY_HEAT: {
    type: "class-breaks",
    field: "DI200_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 7 },
        { min: 7, max: 18 },
        { min: 18, max: 35 },
        { min: 35, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 750 },
        { min: 750 },
      ],
      [
        "Less than 7 households",
        "7 - 18 households",
        "18 - 35 households",
        "35 - 75 households",
        "75 - 150 households",
        "150 - 750 households",
        "750 households or More",
      ]
    ),
  },

  MEDDI_CY_HEAT: {
    type: "class-breaks",
    field: "MEDDI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 35000 },
        { min: 35000, max: 50000 },
        { min: 50000, max: 70000 },
        { min: 70000, max: 100000 },
        { min: 100000, max: 150000 },
        { min: 150000, max: 250000 },
        { min: 250000 },
      ],
      [
        "Less than $35,000",
        "$35,000 - $50,000",
        "$50,000 - $70,000",
        "$70,000 - $100,000",
        "$100,000 - $150,000",
        "$150,000 - $250,000",
        "$250,000 or More",
      ]
    ),
  },

  // Employment & Labor Force - Heat Maps (SIGNIFICANTLY LOWERED)
  CIVLBFR_CY_HEAT: {
    type: "class-breaks",
    field: "CIVLBFR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  EMP_CY_HEAT: {
    type: "class-breaks",
    field: "EMP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2500 },
        { min: 2500, max: 5000 },
        { min: 5000, max: 25000 },
        { min: 25000 },
      ],
      [
        "Less than 250",
        "250 - 500",
        "500 - 1,000",
        "1,000 - 2,500",
        "2,500 - 5,000",
        "5,000 - 25,000",
        "25,000 or More",
      ]
    ),
  },

  UNEMP_CY_HEAT: {
    type: "class-breaks",
    field: "UNEMP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  // Employment by Age Groups - Heat Maps
  CIVLF16_CY_HEAT: {
    type: "class-breaks",
    field: "CIVLF16_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 500",
        "500 - 2,500",
        "2,500 or More",
      ]
    ),
  },

  EMPAGE16CY_HEAT: {
    type: "class-breaks",
    field: "EMPAGE16CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 500",
        "500 - 2,500",
        "2,500 or More",
      ]
    ),
  },

  UNAGE16CY_HEAT: {
    type: "class-breaks",
    field: "UNAGE16CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 80 },
        { min: 80, max: 300 },
        { min: 300 },
      ],
      [
        "Less than 5",
        "5 - 10",
        "10 - 20",
        "20 - 40",
        "40 - 80",
        "80 - 300",
        "300 or More",
      ]
    ),
  },

  UNEMRT16CY_HEAT: {
    type: "class-breaks",
    field: "UNEMRT16CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 20 },
        { min: 20, max: 30 },
        { min: 30, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 5%",
        "5% - 10%",
        "10% - 15%",
        "15% - 20%",
        "20% - 30%",
        "30% - 50%",
        "50% or More",
      ]
    ),
  },

  CIVLF25_CY_HEAT: {
    type: "class-breaks",
    field: "CIVLF25_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 150",
        "150 - 300",
        "300 - 600",
        "600 - 1,500",
        "1,500 - 3,000",
        "3,000 - 15,000",
        "15,000 or More",
      ]
    ),
  },

  EMPAGE25CY_HEAT: {
    type: "class-breaks",
    field: "EMPAGE25CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 150",
        "150 - 300",
        "300 - 600",
        "600 - 1,500",
        "1,500 - 3,000",
        "3,000 - 15,000",
        "15,000 or More",
      ]
    ),
  },

  UNAGE25CY_HEAT: {
    type: "class-breaks",
    field: "UNAGE25CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 120 },
        { min: 120, max: 500 },
        { min: 500 },
      ],
      [
        "Less than 8",
        "8 - 15",
        "15 - 30",
        "30 - 60",
        "60 - 120",
        "120 - 500",
        "500 or More",
      ]
    ),
  },

  UNEMRT25CY_HEAT: {
    type: "class-breaks",
    field: "UNEMRT25CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 10%",
        "10% - 15%",
        "15% - 25%",
        "25% or More",
      ]
    ),
  },

  CIVLF55_CY_HEAT: {
    type: "class-breaks",
    field: "CIVLF55_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 5000 },
        { min: 5000 },
      ],
      [
        "Less than 50",
        "50 - 100",
        "100 - 200",
        "200 - 500",
        "500 - 1,000",
        "1,000 - 5,000",
        "5,000 or More",
      ]
    ),
  },

  EMPAGE55CY_HEAT: {
    type: "class-breaks",
    field: "EMPAGE55CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 5000 },
        { min: 5000 },
      ],
      [
        "Less than 50",
        "50 - 100",
        "100 - 200",
        "200 - 500",
        "500 - 1,000",
        "1,000 - 5,000",
        "5,000 or More",
      ]
    ),
  },

  UNAGE55CY_HEAT: {
    type: "class-breaks",
    field: "UNAGE55CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 6 },
        { min: 6, max: 12 },
        { min: 12, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 3",
        "3 - 6",
        "6 - 12",
        "12 - 25",
        "25 - 50",
        "50 - 200",
        "200 or More",
      ]
    ),
  },

  UNEMRT55CY_HEAT: {
    type: "class-breaks",
    field: "UNEMRT55CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 10%",
        "10% - 15%",
        "15% - 25%",
        "25% or More",
      ]
    ),
  },

  CIVLF65_CY_HEAT: {
    type: "class-breaks",
    field: "CIVLF65_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  EMPAGE65CY_HEAT: {
    type: "class-breaks",
    field: "EMPAGE65CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  UNAGE65CY_HEAT: {
    type: "class-breaks",
    field: "UNAGE65CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 50 },
        { min: 50 },
      ],
      [
        "Less than 1",
        "1 - 2",
        "2 - 4",
        "4 - 8",
        "8 - 15",
        "15 - 50",
        "50 or More",
      ]
    ),
  },

  UNEMRT65CY_HEAT: {
    type: "class-breaks",
    field: "UNEMRT65CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 6 },
        { min: 6, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 20 },
        { min: 20 },
      ],
      [
        "Less than 2%",
        "2% - 4%",
        "4% - 6%",
        "6% - 8%",
        "8% - 12%",
        "12% - 20%",
        "20% or More",
      ]
    ),
  },

  // Economic Dependency Ratios - Heat Maps
  CHLDEDR_CY_HEAT: {
    type: "class-breaks",
    field: "CHLDEDR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 20 },
        { min: 20, max: 30 },
        { min: 30, max: 40 },
        { min: 40, max: 50 },
        { min: 50, max: 60 },
        { min: 60, max: 80 },
        { min: 80 },
      ],
      [
        "Less than 20",
        "20 - 30",
        "30 - 40",
        "40 - 50",
        "50 - 60",
        "60 - 80",
        "80 or More",
      ]
    ),
  },

  WRKEDR_CY_HEAT: {
    type: "class-breaks",
    field: "WRKEDR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 40 },
        { min: 40, max: 50 },
        { min: 50, max: 60 },
        { min: 60, max: 70 },
        { min: 70, max: 80 },
        { min: 80, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 40",
        "40 - 50",
        "50 - 60",
        "60 - 70",
        "70 - 80",
        "80 - 100",
        "100 or More",
      ]
    ),
  },

  SENREDR_CY_HEAT: {
    type: "class-breaks",
    field: "SENREDR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 25 },
        { min: 25, max: 35 },
        { min: 35, max: 45 },
        { min: 45, max: 55 },
        { min: 55, max: 75 },
        { min: 75 },
      ],
      [
        "Less than 15",
        "15 - 25",
        "25 - 35",
        "35 - 45",
        "45 - 55",
        "55 - 75",
        "75 or More",
      ]
    ),
  },

  EDR_CY_HEAT: {
    type: "class-breaks",
    field: "EDR_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 40 },
        { min: 40, max: 50 },
        { min: 50, max: 60 },
        { min: 60, max: 70 },
        { min: 70, max: 80 },
        { min: 80, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 40",
        "40 - 50",
        "50 - 60",
        "60 - 70",
        "70 - 80",
        "80 - 100",
        "100 or More",
      ]
    ),
  },

  // Employment by Race - Heat Maps (SIGNIFICANTLY LOWERED)
  EMPWHTCY_HEAT: {
    type: "class-breaks",
    field: "EMPWHTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 150",
        "150 - 300",
        "300 - 600",
        "600 - 1,500",
        "1,500 - 3,000",
        "3,000 - 15,000",
        "15,000 or More",
      ]
    ),
  },

  EMPBLKCY_HEAT: {
    type: "class-breaks",
    field: "EMPBLKCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 500",
        "500 - 2,500",
        "2,500 or More",
      ]
    ),
  },

  EMPAICY_HEAT: {
    type: "class-breaks",
    field: "EMPAICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 500 },
        { min: 500 },
      ],
      [
        "Less than 5",
        "5 - 10",
        "10 - 20",
        "20 - 50",
        "50 - 100",
        "100 - 500",
        "500 or More",
      ]
    ),
  },

  EMPASNCY_HEAT: {
    type: "class-breaks",
    field: "EMPASNCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  EMPPICY_HEAT: {
    type: "class-breaks",
    field: "EMPPICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 2",
        "2 - 5",
        "5 - 10",
        "10 - 25",
        "25 - 50",
        "50 - 200",
        "200 or More",
      ]
    ),
  },

  EMPOTHCY_HEAT: {
    type: "class-breaks",
    field: "EMPOTHCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 20",
        "20 - 40",
        "40 - 100",
        "100 - 200",
        "200 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  EMPMLTCY_HEAT: {
    type: "class-breaks",
    field: "EMPMLTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 20",
        "20 - 40",
        "40 - 100",
        "100 - 200",
        "200 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  // Unemployment by Race - Heat Maps (SIGNIFICANTLY LOWERED)
  UNWHTCY_HEAT: {
    type: "class-breaks",
    field: "UNWHTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 75 },
        { min: 75, max: 150 },
        { min: 150, max: 750 },
        { min: 750 },
      ],
      [
        "Less than 8",
        "8 - 15",
        "15 - 30",
        "30 - 75",
        "75 - 150",
        "150 - 750",
        "750 or More",
      ]
    ),
  },

  UNBLKCY_HEAT: {
    type: "class-breaks",
    field: "UNBLKCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 6 },
        { min: 6, max: 12 },
        { min: 12, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 300 },
        { min: 300 },
      ],
      [
        "Less than 3",
        "3 - 6",
        "6 - 12",
        "12 - 30",
        "30 - 60",
        "60 - 300",
        "300 or More",
      ]
    ),
  },

  UNAICY_HEAT: {
    type: "class-breaks",
    field: "UNAICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 8 },
        { min: 8, max: 15 },
        { min: 15, max: 75 },
        { min: 75 },
      ],
      [
        "Less than 1",
        "1 - 2",
        "2 - 4",
        "4 - 8",
        "8 - 15",
        "15 - 75",
        "75 or More",
      ]
    ),
  },

  UNASNCY_HEAT: {
    type: "class-breaks",
    field: "UNASNCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 3 },
        { min: 3, max: 6 },
        { min: 6, max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 150 },
        { min: 150 },
      ],
      [
        "Less than 1",
        "1 - 3",
        "3 - 6",
        "6 - 15",
        "15 - 30",
        "30 - 150",
        "150 or More",
      ]
    ),
  },

  UNPICY_HEAT: {
    type: "class-breaks",
    field: "UNPICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 1",
        "1",
        "1 - 2",
        "2 - 3",
        "3 - 5",
        "5 - 25",
        "25 or More",
      ]
    ),
  },

  UNOTHCY_HEAT: {
    type: "class-breaks",
    field: "UNOTHCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 1",
        "1 - 2",
        "2 - 4",
        "4 - 10",
        "10 - 20",
        "20 - 100",
        "100 or More",
      ]
    ),
  },

  UNMLTCY_HEAT: {
    type: "class-breaks",
    field: "UNMLTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 4 },
        { min: 4, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 100 },
        { min: 100 },
      ],
      [
        "Less than 1",
        "1 - 2",
        "2 - 4",
        "4 - 10",
        "10 - 20",
        "20 - 100",
        "100 or More",
      ]
    ),
  },

  // Labor Force by Race - Heat Maps (SIGNIFICANTLY LOWERED)
  CIVLFWHTCY_HEAT: {
    type: "class-breaks",
    field: "CIVLFWHTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1500 },
        { min: 1500, max: 3000 },
        { min: 3000, max: 15000 },
        { min: 15000 },
      ],
      [
        "Less than 150",
        "150 - 300",
        "300 - 600",
        "600 - 1,500",
        "1,500 - 3,000",
        "3,000 - 15,000",
        "15,000 or More",
      ]
    ),
  },

  CIVLFBLKCY_HEAT: {
    type: "class-breaks",
    field: "CIVLFBLKCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 500",
        "500 - 2,500",
        "2,500 or More",
      ]
    ),
  },

  CIVLFAICY_HEAT: {
    type: "class-breaks",
    field: "CIVLFAICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 500 },
        { min: 500 },
      ],
      [
        "Less than 5",
        "5 - 10",
        "10 - 20",
        "20 - 50",
        "50 - 100",
        "100 - 500",
        "500 or More",
      ]
    ),
  },

  CIVLFASNCY_HEAT: {
    type: "class-breaks",
    field: "CIVLFASNCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  CIVLFPICY_HEAT: {
    type: "class-breaks",
    field: "CIVLFPICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 2",
        "2 - 5",
        "5 - 10",
        "10 - 25",
        "25 - 50",
        "50 - 200",
        "200 or More",
      ]
    ),
  },

  CIVLFOTHCY_HEAT: {
    type: "class-breaks",
    field: "CIVLFOTHCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 20",
        "20 - 40",
        "40 - 100",
        "100 - 200",
        "200 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  CIVLFMLTCY_HEAT: {
    type: "class-breaks",
    field: "CIVLFMLTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 20",
        "20 - 40",
        "40 - 100",
        "100 - 200",
        "200 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  // Unemployment Rates by Race - Heat Maps
  UNEMRTWHCY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTWHCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 10%",
        "10% - 15%",
        "15% - 25%",
        "25% or More",
      ]
    ),
  },

  UNEMRTBLCY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTBLCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 18 },
        { min: 18, max: 25 },
        { min: 25, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 8%",
        "8% - 12%",
        "12% - 18%",
        "18% - 25%",
        "25% - 40%",
        "40% or More",
      ]
    ),
  },

  UNEMRTAICY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTAICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 18 },
        { min: 18, max: 25 },
        { min: 25, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 8%",
        "8% - 12%",
        "12% - 18%",
        "18% - 25%",
        "25% - 40%",
        "40% or More",
      ]
    ),
  },

  UNEMRTASCY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTASCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 3 },
        { min: 3, max: 5 },
        { min: 5, max: 7 },
        { min: 7, max: 10 },
        { min: 10, max: 15 },
        { min: 15, max: 25 },
        { min: 25 },
      ],
      [
        "Less than 3%",
        "3% - 5%",
        "5% - 7%",
        "7% - 10%",
        "10% - 15%",
        "15% - 25%",
        "25% or More",
      ]
    ),
  },

  UNEMRTPICY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTPICY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 18 },
        { min: 18, max: 25 },
        { min: 25, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 8%",
        "8% - 12%",
        "12% - 18%",
        "18% - 25%",
        "25% - 40%",
        "40% or More",
      ]
    ),
  },

  UNEMRTOTCY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTOTCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 18 },
        { min: 18, max: 25 },
        { min: 25, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 8%",
        "8% - 12%",
        "12% - 18%",
        "18% - 25%",
        "25% - 40%",
        "40% or More",
      ]
    ),
  },

  UNEMRTMLCY_HEAT: {
    type: "class-breaks",
    field: "UNEMRTMLCY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 8 },
        { min: 8, max: 12 },
        { min: 12, max: 18 },
        { min: 18, max: 25 },
        { min: 25, max: 40 },
        { min: 40 },
      ],
      [
        "Less than 5%",
        "5% - 8%",
        "8% - 12%",
        "12% - 18%",
        "18% - 25%",
        "25% - 40%",
        "40% or More",
      ]
    ),
  },

  // Race and Ethnicity Population Counts - Heat Maps (SIGNIFICANTLY LOWERED)
  HISPPOP_CY_HEAT: {
    type: "class-breaks",
    field: "HISPPOP_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 5000 },
        { min: 5000 },
      ],
      [
        "Less than 50",
        "50 - 100",
        "100 - 200",
        "200 - 500",
        "500 - 1,000",
        "1,000 - 5,000",
        "5,000 or More",
      ]
    ),
  },

  NHSPWHT_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPWHT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 200 },
        { min: 200, max: 400 },
        { min: 400, max: 800 },
        { min: 800, max: 2000 },
        { min: 2000, max: 4000 },
        { min: 4000, max: 20000 },
        { min: 20000 },
      ],
      [
        "Less than 200",
        "200 - 400",
        "400 - 800",
        "800 - 2,000",
        "2,000 - 4,000",
        "4,000 - 20,000",
        "20,000 or More",
      ]
    ),
  },

  NHSPBLK_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPBLK_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 250 },
        { min: 250, max: 500 },
        { min: 500, max: 2500 },
        { min: 2500 },
      ],
      [
        "Less than 25",
        "25 - 50",
        "50 - 100",
        "100 - 250",
        "250 - 500",
        "500 - 2,500",
        "2,500 or More",
      ]
    ),
  },

  NHSPAI_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPAI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 50 },
        { min: 50, max: 100 },
        { min: 100, max: 500 },
        { min: 500 },
      ],
      [
        "Less than 5",
        "5 - 10",
        "10 - 20",
        "20 - 50",
        "50 - 100",
        "100 - 500",
        "500 or More",
      ]
    ),
  },

  NHSPASN_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPASN_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  NHSPPI_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPPI_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 2 },
        { min: 2, max: 5 },
        { min: 5, max: 10 },
        { min: 10, max: 25 },
        { min: 25, max: 50 },
        { min: 50, max: 200 },
        { min: 200 },
      ],
      [
        "Less than 2",
        "2 - 5",
        "5 - 10",
        "10 - 25",
        "25 - 50",
        "50 - 200",
        "200 or More",
      ]
    ),
  },

  NHSPOTH_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPOTH_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 10 },
        { min: 10, max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 100 },
        { min: 100, max: 200 },
        { min: 200, max: 1000 },
        { min: 1000 },
      ],
      [
        "Less than 10",
        "10 - 20",
        "20 - 40",
        "40 - 100",
        "100 - 200",
        "200 - 1,000",
        "1,000 or More",
      ]
    ),
  },

  NHSPMLT_CY_HEAT: {
    type: "class-breaks",
    field: "NHSPMLT_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 15 },
        { min: 15, max: 30 },
        { min: 30, max: 60 },
        { min: 60, max: 150 },
        { min: 150, max: 300 },
        { min: 300, max: 1500 },
        { min: 1500 },
      ],
      [
        "Less than 15",
        "15 - 30",
        "30 - 60",
        "60 - 150",
        "150 - 300",
        "300 - 1,500",
        "1,500 or More",
      ]
    ),
  },

  DIVINDX_CY_HEAT: {
    type: "class-breaks",
    field: "DIVINDX_CY",
    classBreakInfos: createClassBreaks(
      [
        { max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 60 },
        { min: 60, max: 75 },
        { min: 75, max: 85 },
        { min: 85, max: 95 },
        { min: 95 },
      ],
      [
        "Less than 20",
        "20 - 40",
        "40 - 60",
        "60 - 75",
        "75 - 85",
        "85 - 95",
        "95 or More",
      ]
    ),
  },

  RACEBASECY_HEAT: {
    type: "class-breaks",
    field: "RACEBASECY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 50,000",
        "50,000 or More",
      ]
    ),
  },

  EDUCBASECY_HEAT: {
    type: "class-breaks",
    field: "EDUCBASECY",
    classBreakInfos: createClassBreaks(
      [
        { max: 300 },
        { min: 300, max: 600 },
        { min: 600, max: 1200 },
        { min: 1200, max: 3000 },
        { min: 3000, max: 6000 },
        { min: 6000, max: 30000 },
        { min: 30000 },
      ],
      [
        "Less than 300",
        "300 - 600",
        "600 - 1,200",
        "1,200 - 3,000",
        "3,000 - 6,000",
        "6,000 - 30,000",
        "30,000 or More",
      ]
    ),
  },

  HHPOP_FY_HEAT: {
    type: "class-breaks",
    field: "HHPOP_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 500 },
        { min: 500, max: 1000 },
        { min: 1000, max: 2000 },
        { min: 2000, max: 5000 },
        { min: 5000, max: 10000 },
        { min: 10000, max: 50000 },
        { min: 50000 },
      ],
      [
        "Less than 500",
        "500 - 1,000",
        "1,000 - 2,000",
        "2,000 - 5,000",
        "5,000 - 10,000",
        "10,000 - 50,000",
        "50,000 or More",
      ]
    ),
  },

  PCIGRWCYFY_HEAT: {
    type: "class-breaks",
    field: "PCIGRWCYFY",
    classBreakInfos: createClassBreaks(
      [
        { max: 1 },
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3, max: 4 },
        { min: 4, max: 5 },
        { min: 5, max: 7 },
        { min: 7 },
      ],
      [
        "Less than 1%",
        "1% - 2%",
        "2% - 3%",
        "3% - 4%",
        "4% - 5%",
        "5% - 7%",
        "7% or More",
      ]
    ),
  },

  DIVINDX_FY_HEAT: {
    type: "class-breaks",
    field: "DIVINDX_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 20 },
        { min: 20, max: 40 },
        { min: 40, max: 60 },
        { min: 60, max: 75 },
        { min: 75, max: 85 },
        { min: 85, max: 95 },
        { min: 95 },
      ],
      [
        "Less than 20",
        "20 - 40",
        "40 - 60",
        "60 - 75",
        "75 - 85",
        "85 - 95",
        "95 or More",
      ]
    ),
  },

  PCI_FY_HEAT: {
    type: "class-breaks",
    field: "PCI_FY",
    classBreakInfos: createClassBreaks(
      [
        { max: 25000 },
        { min: 25000, max: 35000 },
        { min: 35000, max: 45000 },
        { min: 45000, max: 60000 },
        { min: 60000, max: 80000 },
        { min: 80000, max: 150000 },
        { min: 150000 },
      ],
      [
        "Less than $25,000",
        "$25,000 - $35,000",
        "$35,000 - $45,000",
        "$45,000 - $60,000",
        "$60,000 - $80,000",
        "$80,000 - $150,000",
        "$150,000 or More",
      ]
    ),
  },

  // Dot Density Configurations (UNCHANGED - these use different visualization method)
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
    dotValue: 50,
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
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "workers" },
    attributes: [
      { field: "DPOPWRK_CY", color: "#9B19F5", label: "Daytime Workers" },
    ],
  },

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

  MEDAGE_CY: {
    type: "dot-density",
    field: "MEDAGE_CY",
    dotValue: 1,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "years" },
    attributes: [
      { field: "MEDAGE_CY", color: "#FFB400", label: "Median Age" },
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
      { field: "WORKAGE_CY", color: "#FFB400", label: "Working Age Population" },
    ],
  },

  SENIOR_CY: {
    type: "dot-density",
    field: "SENIOR_CY",
    dotValue: 50,
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
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "children" },
    attributes: [
      { field: "CHILD_CY", color: "#FF6B6B", label: "Child Population" },
    ],
  },

  // Income Brackets - Dot Density
  HINC0_CY: {
    type: "dot-density",
    field: "HINC0_CY",
    dotValue: 10,
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
    dotValue: 10,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC15_CY", color: "#0BB4FF", label: "Income $15,000-$24,999" },
    ],
  },

  HINC25_CY: {
    type: "dot-density",
    field: "HINC25_CY",
    dotValue: 20,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC25_CY", color: "#50E991", label: "Income $25,000-$34,999" },
    ],
  },

  HINC35_CY: {
    type: "dot-density",
    field: "HINC35_CY",
    dotValue: 20,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC35_CY", color: "#9B19F5", label: "Income $35,000-$49,999" },
    ],
  },

  HINC50_CY: {
    type: "dot-density",
    field: "HINC50_CY",
    dotValue: 20,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC50_CY", color: "#FFB400", label: "Income $50,000-$74,999" },
    ],
  },

  HINC75_CY: {
    type: "dot-density",
    field: "HINC75_CY",
    dotValue: 20,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC75_CY", color: "#007ED6", label: "Income $75,000-$99,999" },
    ],
  },

  HINC100_CY: {
    type: "dot-density",
    field: "HINC100_CY",
    dotValue: 20,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC100_CY", color: "#5954D6", label: "Income $100,000-$149,999" },
    ],
  },

  HINC150_CY: {
    type: "dot-density",
    field: "HINC150_CY",
    dotValue: 10,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC150_CY", color: "#FF6B6B", label: "Income $150,000-$199,999" },
    ],
  },

  HINC200_CY: {
    type: "dot-density",
    field: "HINC200_CY",
    dotValue: 10,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "HINC200_CY", color: "#4ECDC4", label: "Income $200,000+" },
    ],
  },

  // Housing - Dot Density
  TOTHU_CY: {
    type: "dot-density",
    field: "TOTHU_CY",
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "TOTHU_CY", color: "#F7DC6F", label: "Total Housing Units" },
    ],
  },

  OWNER_CY: {
    type: "dot-density",
    field: "OWNER_CY",
    dotValue: 50,
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
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "RENTER_CY", color: "#FFB400", label: "Renter Occupied Housing" },
    ],
  },

  VACANT_CY: {
    type: "dot-density",
    field: "VACANT_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VACANT_CY", color: "#EC7063", label: "Vacant Housing Units" },
    ],
  },

  // Home Values - Dot Density
  VAL0_CY: {
    type: "dot-density",
    field: "VAL0_CY",
    dotValue: 25,
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
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL50K_CY", color: "#9B19F5", label: "Home Value $50,000-$99,999" },
    ],
  },

  VAL100K_CY: {
    type: "dot-density",
    field: "VAL100K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL100K_CY", color: "#FFB400", label: "Home Value $100,000-$149,999" },
    ],
  },

  VAL150K_CY: {
    type: "dot-density",
    field: "VAL150K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL150K_CY", color: "#007ED6", label: "Home Value $150,000-$199,999" },
    ],
  },

  VAL200K_CY: {
    type: "dot-density",
    field: "VAL200K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL200K_CY", color: "#5954D6", label: "Home Value $200,000-$249,999" },
    ],
  },

  VAL250K_CY: {
    type: "dot-density",
    field: "VAL250K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL250K_CY", color: "#FF6B6B", label: "Home Value $250,000-$299,999" },
    ],
  },

  VAL300K_CY: {
    type: "dot-density",
    field: "VAL300K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL300K_CY", color: "#4ECDC4", label: "Home Value $300,000-$399,999" },
    ],
  },

  VAL400K_CY: {
    type: "dot-density",
    field: "VAL400K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL400K_CY", color: "#97BBCD", label: "Home Value $400,000-$499,999" },
    ],
  },

  VAL500K_CY: {
    type: "dot-density",
    field: "VAL500K_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL500K_CY", color: "#B2D8B2", label: "Home Value $500,000-$749,999" },
    ],
  },

  VAL750K_CY: {
    type: "dot-density",
    field: "VAL750K_CY",
    dotValue: 10,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL750K_CY", color: "#FFC3A0", label: "Home Value $750,000-$999,999" },
    ],
  },

  VAL1M_CY: {
    type: "dot-density",
    field: "VAL1M_CY",
    dotValue: 10,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL1M_CY", color: "#A0CED9", label: "Home Value $1,000,000-$1,499,999" },
    ],
  },

  VAL1PT5MCY: {
    type: "dot-density",
    field: "VAL1PT5MCY",
    dotValue: 5,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL1PT5MCY", color: "#ADB9E3", label: "Home Value $1,500,000-$1,999,999" },
    ],
  },

  VAL2M_CY: {
    type: "dot-density",
    field: "VAL2M_CY",
    dotValue: 5,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "units" },
    attributes: [
      { field: "VAL2M_CY", color: "#B5A8E3", label: "Home Value $2,000,000+" },
    ],
  },

  // Age Detail - Dot Density
  POP0_CY: {
    type: "dot-density",
    field: "POP0_CY",
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP15_CY", color: "#FF6E38", label: "Population Age 15-19" },
    ],
  },

  POP20_CY: {
    type: "dot-density",
    field: "POP20_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP20_CY", color: "#FF5E3A", label: "Population Age 20-24" },
    ],
  },

  POP25_CY: {
    type: "dot-density",
    field: "POP25_CY",
    dotValue: 25,
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
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP30_CY", color: "#FC913A", label: "Population Age 30-34" },
    ],
  },

  POP35_CY: {
    type: "dot-density",
    field: "POP35_CY",
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
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
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP80_CY", color: "#E6B3FF", label: "Population Age 80-84" },
    ],
  },

  POP85_CY: {
    type: "dot-density",
    field: "POP85_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "POP85_CY", color: "#99B898", label: "Population Age 85+" },
    ],
  },

  // Generations - Dot Density
  GENALPHACY: {
    type: "dot-density",
    field: "GENALPHACY",
    dotValue: 25,
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
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "GENZ_CY", color: "#FF6B6B", label: "Generation Z" },
    ],
  },

  MILLENN_CY: {
    type: "dot-density",
    field: "MILLENN_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "MILLENN_CY", color: "#4ECDC4", label: "Millennials" },
    ],
  },

  GENX_CY: {
    type: "dot-density",
    field: "GENX_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "GENX_CY", color: "#5954D6", label: "Generation X" },
    ],
  },

  BABYBOOMCY: {
    type: "dot-density",
    field: "BABYBOOMCY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "BABYBOOMCY", color: "#E84A5F", label: "Baby Boomers" },
    ],
  },

  OLDRGENSCY: {
    type: "dot-density",
    field: "OLDRGENSCY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "OLDRGENSCY", color: "#355C7D", label: "Silent & Greatest Generations" },
    ],
  },


  // Education - Dot Density
  NOHS_CY: {
    type: "dot-density",
    field: "NOHS_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "NOHS_CY", color: "#E60049", label: "Population Age 25+: Less than 9th Grade" },
    ],
  },

  SOMEHS_CY: {
    type: "dot-density",
    field: "SOMEHS_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "SOMEHS_CY", color: "#0BB4FF", label: "Population Age 25+: 9-12th Grade/No Diploma" },
    ],
  },

  HSGRAD_CY: {
    type: "dot-density",
    field: "HSGRAD_CY",
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "HSGRAD_CY", color: "#50E991", label: "Population Age 25+: High School Diploma" },
    ],
  },

  GED_CY: {
    type: "dot-density",
    field: "GED_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "GED_CY", color: "#9B19F5", label: "Population Age 25+: GED/Alternative Credential" },
    ],
  },

  SMCOLL_CY: {
    type: "dot-density",
    field: "SMCOLL_CY",
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "SMCOLL_CY", color: "#FFB400", label: "Population Age 25+: Some College/No Degree" },
    ],
  },

  ASSCDEG_CY: {
    type: "dot-density",
    field: "ASSCDEG_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "ASSCDEG_CY", color: "#007ED6", label: "Population Age 25+: Associate's Degree" },
    ],
  },

  BACHDEG_CY: {
    type: "dot-density",
    field: "BACHDEG_CY",
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "BACHDEG_CY", color: "#5954D6", label: "Population Age 25+: Bachelor's Degree" },
    ],
  },

  GRADDEG_CY: {
    type: "dot-density",
    field: "GRADDEG_CY",
    dotValue: 25,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "GRADDEG_CY", color: "#FF6B6B", label: "Population Age 25+: Graduate/Professional Degree" },
    ],
  },

  // Future Projections - Dot Density
  TOTPOP_FY: {
    type: "dot-density",
    field: "TOTPOP_FY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "TOTPOP_FY", color: "#4ECDC4", label: "2029 Total Population" },
    ],
  },

  TOTHH_FY: {
    type: "dot-density",
    field: "TOTHH_FY",
    dotValue: 50,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "households" },
    attributes: [
      { field: "TOTHH_FY", color: "#97BBCD", label: "2029 Total Households" },
    ],
  },

  HHPOP_FY: {
    type: "dot-density",
    field: "HHPOP_FY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people" },
    attributes: [
      { field: "HHPOP_FY", color: "#B2D8B2", label: "2029 Household Population" },
    ],
  },

  PCI_FY: {
    type: "dot-density",
    field: "PCI_FY",
    dotValue: 1000,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "dollars" },
    attributes: [
      { field: "PCI_FY", color: "#FFC3A0", label: "2029 Per Capita Income" },
    ],
  },

  POPDENS_FY: {
    type: "dot-density",
    field: "POPDENS_FY",
    dotValue: 100,
    dotBlending: "additive",
    dotSize: 2,
    outline: { width: 0.5, color: [50, 50, 50, 0.2] },
    legendOptions: { unit: "people per sq. mile" },
    attributes: [
      { field: "POPDENS_FY", color: "#A0CED9", label: "2029 Population Density" },
    ],
  },
// Add these configurations to the initialLayerConfigurations object

// Employment & Labor Force - Dot Density
CIVLBFR_CY: {
  type: "dot-density",
  field: "CIVLBFR_CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLBFR_CY", color: "#E60049", label: "Civilian Population Age 16+ in Labor Force" },
  ],
},

EMP_CY: {
  type: "dot-density",
  field: "EMP_CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMP_CY", color: "#0BB4FF", label: "Employed Civilian Population Age 16+" },
  ],
},

UNEMP_CY: {
  type: "dot-density",
  field: "UNEMP_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNEMP_CY", color: "#FF6B6B", label: "Unemployed Population Age 16+" },
  ],
},

// Employment by Age Groups - Dot Density
EMPAGE16CY: {
  type: "dot-density",
  field: "EMPAGE16CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPAGE16CY", color: "#50E991", label: "Employed Civilian Population Age 16-24" },
  ],
},

UNAGE16CY: {
  type: "dot-density",
  field: "UNAGE16CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNAGE16CY", color: "#9B19F5", label: "Unemployed Population Age 16-24" },
  ],
},

UNEMRT16CY: {
  type: "dot-density",
  field: "UNEMRT16CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "percent" },
  attributes: [
    { field: "UNEMRT16CY", color: "#FFB400", label: "Unemployment Rate: Population Age 16-24" },
  ],
},

CIVLF25_CY: {
  type: "dot-density",
  field: "CIVLF25_CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLF25_CY", color: "#007ED6", label: "Civilian Population 25-54 in Labor Force" },
  ],
},

EMPAGE25CY: {
  type: "dot-density",
  field: "EMPAGE25CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPAGE25CY", color: "#5954D6", label: "Employed Civilian Population Age 25-54" },
  ],
},

UNAGE25CY: {
  type: "dot-density",
  field: "UNAGE25CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNAGE25CY", color: "#4ECDC4", label: "Unemployed Population Age 25-54" },
  ],
},

UNEMRT25CY: {
  type: "dot-density",
  field: "UNEMRT25CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "percent" },
  attributes: [
    { field: "UNEMRT25CY", color: "#97BBCD", label: "Unemployment Rate: Population Age 25-54" },
  ],
},

CIVLF55_CY: {
  type: "dot-density",
  field: "CIVLF55_CY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLF55_CY", color: "#B2D8B2", label: "Civilian Population 55-64 in Labor Force" },
  ],
},

EMPAGE55CY: {
  type: "dot-density",
  field: "EMPAGE55CY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPAGE55CY", color: "#FFC3A0", label: "Employed Civilian Population Age 55-64" },
  ],
},

UNAGE55CY: {
  type: "dot-density",
  field: "UNAGE55CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNAGE55CY", color: "#A0CED9", label: "Unemployed Population Age 55-64" },
  ],
},

UNEMRT55CY: {
  type: "dot-density",
  field: "UNEMRT55CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "percent" },
  attributes: [
    { field: "UNEMRT55CY", color: "#ADB9E3", label: "Unemployment Rate: Population Age 55-64" },
  ],
},

CIVLF65_CY: {
  type: "dot-density",
  field: "CIVLF65_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLF65_CY", color: "#B5A8E3", label: "Civilian Population 65+ in Labor Force" },
  ],
},

EMPAGE65CY: {
  type: "dot-density",
  field: "EMPAGE65CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPAGE65CY", color: "#C8A8E9", label: "Employed Civilian Population Age 65+" },
  ],
},

UNAGE65CY: {
  type: "dot-density",
  field: "UNAGE65CY",
  dotValue: 2,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNAGE65CY", color: "#E6B3FF", label: "Unemployed Population Age 65+" },
  ],
},

UNEMRT65CY: {
  type: "dot-density",
  field: "UNEMRT65CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "percent" },
  attributes: [
    { field: "UNEMRT65CY", color: "#FFD1DC", label: "Unemployment Rate: Population Age 65+" },
  ],
},

// Economic Dependency Ratios - Dot Density
CHLDEDR_CY: {
  type: "dot-density",
  field: "CHLDEDR_CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "CHLDEDR_CY", color: "#FFB6C1", label: "Child Economic Dependency Ratio" },
  ],
},

WRKEDR_CY: {
  type: "dot-density",
  field: "WRKEDR_CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "WRKEDR_CY", color: "#DDA0DD", label: "Working-Age Economic Dependency Ratio" },
  ],
},

SENREDR_CY: {
  type: "dot-density",
  field: "SENREDR_CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "SENREDR_CY", color: "#98FB98", label: "Senior Economic Dependency Ratio" },
  ],
},

EDR_CY: {
  type: "dot-density",
  field: "EDR_CY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "EDR_CY", color: "#F0E68C", label: "Economic Dependency Ratio" },
  ],
},

// Employment by Race - Dot Density
EMPWHTCY: {
  type: "dot-density",
  field: "EMPWHTCY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPWHTCY", color: "#87CEEB", label: "White Employed Civilian Population Age 16+" },
  ],
},

EMPBLKCY: {
  type: "dot-density",
  field: "EMPBLKCY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPBLKCY", color: "#DEB887", label: "Black/African American Employed Civilian Population Age 16+" },
  ],
},

EMPAICY: {
  type: "dot-density",
  field: "EMPAICY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPAICY", color: "#CD853F", label: "American Indian/Alaska Native Employed Civilian Population Age 16+" },
  ],
},

EMPASNCY: {
  type: "dot-density",
  field: "EMPASNCY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPASNCY", color: "#F0E68C", label: "Asian Employed Civilian Population Age 16+" },
  ],
},

EMPPICY: {
  type: "dot-density",
  field: "EMPPICY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPPICY", color: "#20B2AA", label: "Pacific Islander Employed Civilian Population Age 16+" },
  ],
},

EMPOTHCY: {
  type: "dot-density",
  field: "EMPOTHCY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPOTHCY", color: "#FF7F50", label: "Other Race Employed Civilian Population Age 16+" },
  ],
},

EMPMLTCY: {
  type: "dot-density",
  field: "EMPMLTCY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "EMPMLTCY", color: "#DC143C", label: "Multiple Races Employed Civilian Population Age 16+" },
  ],
},

// Unemployment by Race - Dot Density
UNWHTCY: {
  type: "dot-density",
  field: "UNWHTCY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNWHTCY", color: "#B0C4DE", label: "White Unemployed Population Age 16+" },
  ],
},

UNBLKCY: {
  type: "dot-density",
  field: "UNBLKCY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNBLKCY", color: "#D2B48C", label: "Black/African American Unemployed Population Age 16+" },
  ],
},

UNAICY: {
  type: "dot-density",
  field: "UNAICY",
  dotValue: 2,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNAICY", color: "#BC8F8F", label: "American Indian/Alaska Native Unemployed Population Age 16+" },
  ],
},

UNASNCY: {
  type: "dot-density",
  field: "UNASNCY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNASNCY", color: "#F5DEB3", label: "Asian Unemployed Population Age 16+" },
  ],
},

UNPICY: {
  type: "dot-density",
  field: "UNPICY",
  dotValue: 2,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNPICY", color: "#48D1CC", label: "Pacific Islander Unemployed Population Age 16+" },
  ],
},

UNOTHCY: {
  type: "dot-density",
  field: "UNOTHCY",
  dotValue: 2,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNOTHCY", color: "#FA8072", label: "Other Race Unemployed Population Age 16+" },
  ],
},

UNMLTCY: {
  type: "dot-density",
  field: "UNMLTCY",
  dotValue: 2,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "UNMLTCY", color: "#FF1493", label: "Multiple Races Unemployed Population Age 16+" },
  ],
},

// Labor Force by Race - Dot Density
CIVLFWHTCY: {
  type: "dot-density",
  field: "CIVLFWHTCY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFWHTCY", color: "#E0E0E0", label: "White Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFBLKCY: {
  type: "dot-density",
  field: "CIVLFBLKCY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFBLKCY", color: "#8B4513", label: "Black/African American Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFAICY: {
  type: "dot-density",
  field: "CIVLFAICY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFAICY", color: "#A0522D", label: "American Indian/Alaska Native Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFASNCY: {
  type: "dot-density",
  field: "CIVLFASNCY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFASNCY", color: "#FFD700", label: "Asian Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFPICY: {
  type: "dot-density",
  field: "CIVLFPICY",
  dotValue: 5,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFPICY", color: "#00CED1", label: "Pacific Islander Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFOTHCY: {
  type: "dot-density",
  field: "CIVLFOTHCY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFOTHCY", color: "#FF6347", label: "Other Race Civilian Population 16+ in Labor Force" },
  ],
},

CIVLFMLTCY: {
  type: "dot-density",
  field: "CIVLFMLTCY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "CIVLFMLTCY", color: "#FF69B4", label: "Multiple Races Civilian Population 16+ in Labor Force" },
  ],
},

// Population Density - Dot Density
POPDENS_CY: {
  type: "dot-density",
  field: "POPDENS_CY",
  dotValue: 100,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people per sq. mile" },
  attributes: [
    { field: "POPDENS_CY", color: "#32CD32", label: "Population Density (Pop per Square Mile)" },
  ],
},

DPOPDENSCY: {
  type: "dot-density",
  field: "DPOPDENSCY",
  dotValue: 100,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people per sq. mile" },
  attributes: [
    { field: "DPOPDENSCY", color: "#8FBC8F", label: "Daytime Population Density (Pop per Square Mile)" },
  ],
},

// Additional Population - Dot Density
HHPOP_CY: {
  type: "dot-density",
  field: "HHPOP_CY",
  dotValue: 100,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "HHPOP_CY", color: "#6B8E23", label: "Household Population" },
  ],
},

GQPOP_CY: {
  type: "dot-density",
  field: "GQPOP_CY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "GQPOP_CY", color: "#9ACD32", label: "Group Quarters Population" },
  ],
},

MALES_CY: {
  type: "dot-density",
  field: "MALES_CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "MALES_CY", color: "#4169E1", label: "Male Population" },
  ],
},

MEDMAGE_CY: {
  type: "dot-density",
  field: "MEDMAGE_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "years" },
  attributes: [
    { field: "MEDMAGE_CY", color: "#0000CD", label: "Median Male Age" },
  ],
},

FEMALES_CY: {
  type: "dot-density",
  field: "FEMALES_CY",
  dotValue: 50,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "people" },
  attributes: [
    { field: "FEMALES_CY", color: "#FF1493", label: "Female Population" },
  ],
},

MEDFAGE_CY: {
  type: "dot-density",
  field: "MEDFAGE_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "years" },
  attributes: [
    { field: "MEDFAGE_CY", color: "#FF69B4", label: "Median Female Age" },
  ],
},

// Income Inequality - Dot Density
GINI_CY: {
  type: "dot-density",
  field: "GINI_CY",
  dotValue: 0.01,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "index" },
  attributes: [
    { field: "GINI_CY", color: "#800080", label: "Gini Index" },
  ],
},

RAT9010_CY: {
  type: "dot-density",
  field: "RAT9010_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "RAT9010_CY", color: "#8B008B", label: "P90-P10 Ratio of Income Inequality" },
  ],
},

RAT9050_CY: {
  type: "dot-density",
  field: "RAT9050_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "RAT9050_CY", color: "#9370DB", label: "P90-P50 Ratio of Income Inequality" },
  ],
},

RAT5010_CY: {
  type: "dot-density",
  field: "RAT5010_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "RAT5010_CY", color: "#BA55D3", label: "P50-P10 Ratio of Income Inequality" },
  ],
},

SHR8020_CY: {
  type: "dot-density",
  field: "SHR8020_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "SHR8020_CY", color: "#DA70D6", label: "80-20 Share Ratio of Income Inequality" },
  ],
},

SHR9040_CY: {
  type: "dot-density",
  field: "SHR9040_CY",
  dotValue: 1,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "ratio" },
  attributes: [
    { field: "SHR9040_CY", color: "#EE82EE", label: "90-40 Share Ratio of Income Inequality" },
  ],
},

// Income Tiers - Dot Density
LOTRHH_CY: {
  type: "dot-density",
  field: "LOTRHH_CY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "LOTRHH_CY", color: "#DDA0DD", label: "Households in Low Income Tier" },
  ],
},

MDTRHH_CY: {
  type: "dot-density",
  field: "MDTRHH_CY",
  dotValue: 25,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "MDTRHH_CY", color: "#D8BFD8", label: "Households in Middle Income Tier" },
  ],
},

UPTRHH_CY: {
  type: "dot-density",
  field: "UPTRHH_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "UPTRHH_CY", color: "#FFE4E1", label: "Households in Upper Income Tier" },
  ],
},

// Disposable Income - Dot Density
DI0_CY: {
  type: "dot-density",
  field: "DI0_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI0_CY", color: "#2E8B57", label: "Disposable Income less than $15,000" },
  ],
},

DI15_CY: {
  type: "dot-density",
  field: "DI15_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI15_CY", color: "#3CB371", label: "Disposable Income $15,000-$24,999" },
  ],
},

DI25_CY: {
  type: "dot-density",
  field: "DI25_CY",
  dotValue: 20,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI25_CY", color: "#66CDAA", label: "Disposable Income $25,000-$34,999" },
  ],
},

DI35_CY: {
  type: "dot-density",
  field: "DI35_CY",
  dotValue: 20,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI35_CY", color: "#98FB98", label: "Disposable Income $35,000-$49,999" },
  ],
},

DI50_CY: {
  type: "dot-density",
  field: "DI50_CY",
  dotValue: 20,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI50_CY", color: "#90EE90", label: "Disposable Income $50,000-$74,999" },
  ],
},

DI75_CY: {
  type: "dot-density",
  field: "DI75_CY",
  dotValue: 20,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI75_CY", color: "#ADFF2F", label: "Disposable Income $75,000-$99,999" },
  ],
},

DI100_CY: {
  type: "dot-density",
  field: "DI100_CY",
  dotValue: 20,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI100_CY", color: "#7FFF00", label: "Disposable Income $100,000-$149,999" },
  ],
},

DI150_CY: {
  type: "dot-density",
  field: "DI150_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI150_CY", color: "#7CFC00", label: "Disposable Income $150,000-$199,999" },
  ],
},

DI200_CY: {
  type: "dot-density",
  field: "DI200_CY",
  dotValue: 10,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "households" },
  attributes: [
    { field: "DI200_CY", color: "#00FF7F", label: "Disposable Income $200,000 or greater" },
  ],
},

MEDDI_CY: {
  type: "dot-density",
  field: "MEDDI_CY",
  dotValue: 1000,
  dotBlending: "additive",
  dotSize: 2,
  outline: { width: 0.5, color: [50, 50, 50, 0.2] },
  legendOptions: { unit: "dollars" },
  attributes: [
    { field: "MEDDI_CY", color: "#00FA9A", label: "Median Disposable Income" },
  ],
},
};

// --- Visualization Options ---
export const visualizationOptions = [
  // Population & Households
  {
    value: "TOTPOP_CY",
    label: "2025 Total Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTPOP_CY_HEAT",
    label: "2025 Total Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "TOTHH_CY",
    label: "2025 Total Households",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTHH_CY_HEAT",
    label: "2025 Total Households",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGHHSZ_CY_HEAT",
    label: "2025 Average Household Size",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Daytime Population
  {
    value: "DPOP_CY",
    label: "2025 Total Daytime Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOP_CY_HEAT",
    label: "2025 Total Daytime Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DPOPWRK_CY",
    label: "2025 Daytime Population: Workers",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOPWRK_CY_HEAT",
    label: "2025 Daytime Population: Workers",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DPOPRES_CY",
    label: "2025 Daytime Population: Residents",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOPRES_CY_HEAT",
    label: "2025 Daytime Population: Residents",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Age
  {
    value: "MEDAGE_CY",
    label: "2025 Median Age",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MEDAGE_CY_HEAT",
    label: "2025 Median Age",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "WORKAGE_CY",
    label: "2025 Working-Age Population (Age 18-64)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "WORKAGE_CY_HEAT",
    label: "2025 Working-Age Population (Age 18-64)",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SENIOR_CY",
    label: "2025 Senior Population (Age 65+)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SENIOR_CY_HEAT",
    label: "2025 Senior Population (Age 65+)",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CHILD_CY",
    label: "2025 Child Population (Age Less Than 18)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CHILD_CY_HEAT",
    label: "2025 Child Population (Age Less Than 18)",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Income
  {
    value: "MEDHINC_CY_HEAT",
    label: "2025 Median Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGHINC_CY_HEAT",
    label: "2025 Average Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC0_CY",
    label: "2025 Household Income less than $15,000",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC0_CY_HEAT",
    label: "2025 Household Income less than $15,000",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC15_CY",
    label: "2025 Household Income $15,000-$24,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC15_CY_HEAT",
    label: "2025 Household Income $15,000-$24,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC25_CY",
    label: "2025 Household Income $25,000-$34,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC25_CY_HEAT",
    label: "2025 Household Income $25,000-$34,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC35_CY",
    label: "2025 Household Income $35,000-$49,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC35_CY_HEAT",
    label: "2025 Household Income $35,000-$49,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC50_CY",
    label: "2025 Household Income $50,000-$74,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC50_CY_HEAT",
    label: "2025 Household Income $50,000-$74,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC75_CY",
    label: "2025 Household Income $75,000-$99,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC75_CY_HEAT",
    label: "2025 Household Income $75,000-$99,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC100_CY",
    label: "2025 Household Income $100,000-$149,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC100_CY_HEAT",
    label: "2025 Household Income $100,000-$149,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC150_CY",
    label: "2025 Household Income $150,000-$199,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC150_CY_HEAT",
    label: "2025 Household Income $150,000-$199,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HINC200_CY",
    label: "2025 Household Income $200,000 or greater",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HINC200_CY_HEAT",
    label: "2025 Household Income $200,000 or greater",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMPRT_CY_HEAT",
    label: "2025 Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Projected Growth
  {
    value: "POPGRWCYFY_HEAT",
    label: "2025-2029 Population: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHGRWCYFY_HEAT",
    label: "2025-2029 Households: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MHIGRWCYFY_HEAT",
    label: "2025-2029 Median Household Income: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Historical Growth
  {
    value: "POPGRW20CY_HEAT",
    label: "2020-2025 Population: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHGRW20CY_HEAT",
    label: "2020-2025 Households: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Housing
  {
    value: "TOTHU_CY",
    label: "2025 Total Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTHU_CY_HEAT",
    label: "2025 Total Housing Units",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "OWNER_CY",
    label: "2025 Owner Occupied Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "OWNER_CY_HEAT",
    label: "2025 Owner Occupied Housing Units",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "RENTER_CY",
    label: "2025 Renter Occupied Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RENTER_CY_HEAT",
    label: "2025 Renter Occupied Housing Units",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "PCTHOMEOWNER_HEAT",
    label: "2025 Homeownership Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VACANT_CY",
    label: "2025 Vacant Housing Units",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VACANT_CY_HEAT",
    label: "2025 Vacant Housing Units",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VACANT_CY_PCT_HEAT",
    label: "2025 Vacancy rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDVAL_CY_HEAT",
    label: "2025 Median Home Value",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGVAL_CY_HEAT",
    label: "2025 Average Home Value",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Home Value Ranges
  {
    value: "VAL0_CY",
    label: "2025 Home Value less than $50,000",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL0_CY_HEAT",
    label: "2025 Home Value less than $50,000",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL50K_CY",
    label: "2025 Home Value $50,000-$99,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL50K_CY_HEAT",
    label: "2025 Home Value $50,000-$99,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL100K_CY",
    label: "2025 Home Value $100,000-$149,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL100K_CY_HEAT",
    label: "2025 Home Value $100,000-$149,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL150K_CY",
    label: "2025 Home Value $150,000-$199,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL150K_CY_HEAT",
    label: "2025 Home Value $150,000-$199,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL200K_CY",
    label: "2025 Home Value $200,000-$249,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL200K_CY_HEAT",
    label: "2025 Home Value $200,000-$249,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL250K_CY",
    label: "2025 Home Value $250,000-$299,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL250K_CY_HEAT",
    label: "2025 Home Value $250,000-$299,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL300K_CY",
    label: "2025 Home Value $300,000-$399,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL300K_CY_HEAT",
    label: "2025 Home Value $300,000-$399,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL400K_CY",
    label: "2025 Home Value $400,000-$499,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL400K_CY_HEAT",
    label: "2025 Home Value $400,000-$499,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL500K_CY",
    label: "2025 Home Value $500,000-$749,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL500K_CY_HEAT",
    label: "2025 Home Value $500,000-$749,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL750K_CY",
    label: "2025 Home Value $750,000-$999,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL750K_CY_HEAT",
    label: "2025 Home Value $750,000-$999,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL1M_CY",
    label: "2025 Home Value $1,000,000-$1,499,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL1M_CY_HEAT",
    label: "2025 Home Value $1,000,000-$1,499,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL1PT5MCY",
    label: "2025 Home Value $1,500,000-$1,999,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL1PT5MCY_HEAT",
    label: "2025 Home Value $1,500,000-$1,999,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "VAL2M_CY",
    label: "2025 Home Value $2,000,000 or greater",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "VAL2M_CY_HEAT",
    label: "2025 Home Value $2,000,000 or greater",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Age Detail
  {
    value: "POP0_CY",
    label: "2025 Total Population Age 0-4",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP5_CY",
    label: "2025 Total Population Age 5-9",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP10_CY",
    label: "2025 Total Population Age 10-14",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP15_CY",
    label: "2025 Total Population Age 15-19",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP20_CY",
    label: "2025 Total Population Age 20-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP25_CY",
    label: "2025 Total Population Age 25-29",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP30_CY",
    label: "2025 Total Population Age 30-34",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP35_CY",
    label: "2025 Total Population Age 35-39",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP40_CY",
    label: "2025 Total Population Age 40-44",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP45_CY",
    label: "2025 Total Population Age 45-49",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP50_CY",
    label: "2025 Total Population Age 50-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP55_CY",
    label: "2025 Total Population Age 55-59",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP60_CY",
    label: "2025 Total Population Age 60-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP65_CY",
    label: "2025 Total Population Age 65-69",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP70_CY",
    label: "2025 Total Population Age 70-74",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP75_CY",
    label: "2025 Total Population Age 75-79",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP80_CY",
    label: "2025 Total Population Age 80-84",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POP85_CY",
    label: "2025 Total Population Age 85+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GENALPHACY",
    label: "2025 Generation Alpha Population (Born 2017 or Later)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GENZ_CY",
    label: "2025 Generation Z Population (Born 1999 to 2016)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MILLENN_CY",
    label: "2025 Millennial Population (Born 1981 to 1998)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GENX_CY",
    label: "2025 Generation X Population (Born 1965 to 1980)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "BABYBOOMCY",
    label: "2025 Baby Boomer Population (Born 1946 to 1964)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "OLDRGENSCY",
    label: "2025 Silent & Greatest Generations Population (Born 1945/Earlier)",
    type: "dot-density",
    category: "Dot Density Map",
  },

  // Education
  {
    value: "NOHS_CY",
    label: "2025 Population Age 25+: Less than 9th Grade",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SOMEHS_CY",
    label: "2025 Population Age 25+: 9-12th Grade/No Diploma",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HSGRAD_CY",
    label: "2025 Population Age 25+: High School Diploma",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GED_CY",
    label: "2025 Population Age 25+: GED/Alternative Credential",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SMCOLL_CY",
    label: "2025 Population Age 25+: Some College/No Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "ASSCDEG_CY",
    label: "2025 Population Age 25+: Associate's Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "BACHDEG_CY",
    label: "2025 Population Age 25+: Bachelor's Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GRADDEG_CY",
    label: "2025 Population Age 25+: Graduate/Professional Degree",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HSGRAD_LESS_CY_PCT_HEAT",
    label: "2025 Percent of Population 25+ with less than a High School degree",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "BACHDEG_PLUS_CY_PCT_HEAT",
    label: "2025 Percent of Population 25+ with a Bachelor's degree or higher",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Future
  {
    value: "TOTPOP_FY",
    label: "2029 Total Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTPOP_FY_HEAT",
    label: "2029 Total Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "TOTHH_FY",
    label: "2029 Total Households",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "TOTHH_FY_HEAT",
    label: "2029 Total Households",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGHHSZ_FY_HEAT",
    label: "2029 Average Household Size",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDHINC_FY_HEAT",
    label: "2029 Median Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AVGHINC_FY_HEAT",
    label: "2029 Average Household Income",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "POPDENS_FY",
    label: "2029 Population Density (Pop per Square Mile)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POPDENS_FY_HEAT",
    label: "2029 Population Density (Pop per Square Mile)",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Affluence & Affordability
  {
    value: "HAI_CY_HEAT",
    label: "2025 Housing Affordability Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "INCMORT_CY_HEAT",
    label: "2025 Percent of Income for Mortgage",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "WLTHINDXCY_HEAT",
    label: "2025 Wealth Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SEI_CY_HEAT",
    label: "2025 Socioeconomic Status Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "PCI_CY_HEAT",
    label: "2025 Per Capita Income",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Race
  {
    value: "HISPPOP_CY_PCT_HEAT",
    label: "2025 Percent Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPWHT_CY_PCT_HEAT",
    label: "2025 Percent White Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPBLK_CY_PCT_HEAT",
    label: "2025 Percent Black/African American Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPAI_CY_PCT_HEAT",
    label: "2025 Percent American Indian/Alaska Native Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPASN_CY_PCT_HEAT",
    label: "2025 Percent Asian Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPPI_CY_PCT_HEAT",
    label: "2025 Percent Pacific Islander Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPOTH_CY_PCT_HEAT",
    label: "2025 Percent Other Race Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPMLT_CY_PCT_HEAT",
    label: "2025 Percent Multiple Races Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Other
  {
    value: "POPDENS_CY",
    label: "2025 Population Density (Pop per Square Mile)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "POPDENS_CY_HEAT",
    label: "2025 Population Density (Pop per Square Mile)",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DPOPDENSCY",
    label: "2025 Daytime Population Density (Pop per Square Mile)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DPOPDENSCY_HEAT",
    label: "2025 Daytime Population Density (Pop per Square Mile)",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CHLDDEP_CY_HEAT",
    label: "2025 Child Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "AGEDEP_CY_HEAT",
    label: "2025 Age Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SENRDEP_CY_HEAT",
    label: "2025 Senior Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHPOP_CY",
    label: "2025 Household Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HHPOP_CY_HEAT",
    label: "2025 Household Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "GQPOP_CY",
    label: "2025 Group Quarters Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "GQPOP_CY_HEAT",
    label: "2025 Group Quarters Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MALES_CY",
    label: "2025 Male Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MALES_CY_HEAT",
    label: "2025 Male Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDMAGE_CY",
    label: "2025 Median Male Age",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MEDMAGE_CY_HEAT",
    label: "2025 Median Male Age",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "FEMALES_CY",
    label: "2025 Female Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "FEMALES_CY_HEAT",
    label: "2025 Female Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDFAGE_CY",
    label: "2025 Median Female Age",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MEDFAGE_CY_HEAT",
    label: "2025 Median Female Age",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "GINI_CY_HEAT",
    label: "2025 Gini Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "RAT9010_CY",
    label: "2025 P90-P10 Ratio of Income Inequality",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RAT9010_CY_HEAT",
    label: "2025 P90-P10 Ratio of Income Inequality",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "RAT9050_CY",
    label: "2025 P90-P50 Ratio of Income Inequality",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RAT9050_CY_HEAT",
    label: "2025 P90-P50 Ratio of Income Inequality",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "RAT5010_CY",
    label: "2025 P50-P10 Ratio of Income Inequality",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RAT5010_CY_HEAT",
    label: "2025 P50-P10 Ratio of Income Inequality",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SHR8020_CY",
    label: "2025 80-20 Share Ratio of Income Inequality",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SHR8020_CY_HEAT",
    label: "2025 80-20 Share Ratio of Income Inequality",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SHR9040_CY",
    label: "2025 90-40 Share Ratio of Income Inequality",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "SHR9040_CY_HEAT",
    label: "2025 90-40 Share Ratio of Income Inequality",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "LOTRHH_CY",
    label: "2025 Households in Low Income Tier",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "LOTRHH_CY_HEAT",
    label: "2025 Households in Low Income Tier",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MDTRHH_CY",
    label: "2025 Households in Middle Income Tier",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MDTRHH_CY_HEAT",
    label: "2025 Households in Middle Income Tier",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UPTRHH_CY",
    label: "2025 Households in Upper Income Tier",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UPTRHH_CY_HEAT",
    label: "2025 Households in Upper Income Tier",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI0_CY",
    label: "2025 Disposable Income less than $15,000",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI0_CY_HEAT",
    label: "2025 Disposable Income less than $15,000",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI15_CY",
    label: "2025 Disposable Income $15,000-$24,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI15_CY_HEAT",
    label: "2025 Disposable Income $15,000-$24,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI25_CY",
    label: "2025 Disposable Income $25,000-$34,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI25_CY_HEAT",
    label: "2025 Disposable Income $25,000-$34,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI35_CY",
    label: "2025 Disposable Income $35,000-$49,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI35_CY_HEAT",
    label: "2025 Disposable Income $35,000-$49,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI50_CY",
    label: "2025 Disposable Income $50,000-$74,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI50_CY_HEAT",
    label: "2025 Disposable Income $50,000-$74,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI75_CY",
    label: "2025 Disposable Income $75,000-$99,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI75_CY_HEAT",
    label: "2025 Disposable Income $75,000-$99,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI100_CY",
    label: "2025 Disposable Income $100,000-$149,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI100_CY_HEAT",
    label: "2025 Disposable Income $100,000-$149,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI150_CY",
    label: "2025 Disposable Income $150,000-$199,999",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI150_CY_HEAT",
    label: "2025 Disposable Income $150,000-$199,999",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DI200_CY",
    label: "2025 Disposable Income $200,000 or greater",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "DI200_CY_HEAT",
    label: "2025 Disposable Income $200,000 or greater",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "MEDDI_CY",
    label: "2025 Median Disposable Income",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "MEDDI_CY_HEAT",
    label: "2025 Median Disposable Income",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Employment & Labor Force
  {
    value: "CIVLBFR_CY",
    label: "2025 Civilian Population Age 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLBFR_CY_HEAT",
    label: "2025 Civilian Population Age 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMP_CY",
    label: "2025 Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMP_CY_HEAT",
    label: "2025 Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMP_CY",
    label: "2025 Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNEMP_CY_HEAT",
    label: "2025 Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Employment by Age Groups
  {
    value: "CIVLF16_CY",
    label: "2025 Civilian Population 16-24 in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLF16_CY_HEAT",
    label: "2025 Civilian Population 16-24 in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPAGE16CY",
    label: "2025 Employed Civilian Population Age 16-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE16CY_HEAT",
    label: "2025 Employed Civilian Population Age 16-24",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNAGE16CY",
    label: "2025 Unemployed Population Age 16-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAGE16CY_HEAT",
    label: "2025 Unemployed Population Age 16-24",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRT16CY",
    label: "2025 Unemployment Rate: Population Age 16-24",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNEMRT16CY_HEAT",
    label: "2025 Unemployment Rate: Population Age 16-24",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLF25_CY",
    label: "2025 Civilian Population 25-54 in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLF25_CY_HEAT",
    label: "2025 Civilian Population 25-54 in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPAGE25CY",
    label: "2025 Employed Civilian Population Age 25-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE25CY_HEAT",
    label: "2025 Employed Civilian Population Age 25-54",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNAGE25CY",
    label: "2025 Unemployed Population Age 25-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAGE25CY_HEAT",
    label: "2025 Unemployed Population Age 25-54",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRT25CY",
    label: "2025 Unemployment Rate: Population Age 25-54",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNEMRT25CY_HEAT",
    label: "2025 Unemployment Rate: Population Age 25-54",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLF55_CY",
    label: "2025 Civilian Population 55-64 in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLF55_CY_HEAT",
    label: "2025 Civilian Population 55-64 in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPAGE55CY",
    label: "2025 Employed Civilian Population Age 55-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE55CY_HEAT",
    label: "2025 Employed Civilian Population Age 55-64",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNAGE55CY",
    label: "2025 Unemployed Population Age 55-64",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAGE55CY_HEAT",
    label: "2025 Unemployed Population Age 55-64",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRT55CY_HEAT",
    label: "2025 Unemployment Rate: Population Age 55-64",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLF65_CY",
    label: "2025 Civilian Population 65+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLF65_CY_HEAT",
    label: "2025 Civilian Population 65+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPAGE65CY",
    label: "2025 Employed Civilian Population Age 65+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAGE65CY_HEAT",
    label: "2025 Employed Civilian Population Age 65+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNAGE65CY",
    label: "2025 Unemployed Population Age 65+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAGE65CY_HEAT",
    label: "2025 Unemployed Population Age 65+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRT65CY",
    label: "2025 Unemployment Rate: Population Age 65+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNEMRT65CY_HEAT",
    label: "2025 Unemployment Rate: Population Age 65+",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Economic Dependency Ratios
  {
    value: "CHLDEDR_CY",
    label: "2025 Child Economic Dependency Ratio",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CHLDEDR_CY_HEAT",
    label: "2025 Child Economic Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "WRKEDR_CY_HEAT",
    label: "2025 Working-Age Economic Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "SENREDR_CY_HEAT",
    label: "2025 Senior Economic Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EDR_CY_HEAT",
    label: "2025 Economic Dependency Ratio",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Employment by Race
  {
    value: "EMPWHTCY",
    label: "2025 White Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPWHTCY_HEAT",
    label: "2025 White Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPBLKCY",
    label: "2025 Black/African American Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPBLKCY_HEAT",
    label: "2025 Black/African American Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPAICY",
    label: "2025 American Indian/Alaska Native Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPAICY_HEAT",
    label: "2025 American Indian/Alaska Native Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPASNCY",
    label: "2025 Asian Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPASNCY_HEAT",
    label: "2025 Asian Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPPICY",
    label: "2025 Pacific Islander Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPPICY_HEAT",
    label: "2025 Pacific Islander Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPOTHCY",
    label: "2025 Other Race Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPOTHCY_HEAT",
    label: "2025 Other Race Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EMPMLTCY",
    label: "2025 Multiple Races Employed Civilian Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EMPMLTCY_HEAT",
    label: "2025 Multiple Races Employed Civilian Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Unemployment by Race
  {
    value: "UNWHTCY",
    label: "2025 White Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNWHTCY_HEAT",
    label: "2025 White Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNBLKCY",
    label: "2025 Black/African American Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNBLKCY_HEAT",
    label: "2025 Black/African American Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNAICY",
    label: "2025 American Indian/Alaska Native Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNAICY_HEAT",
    label: "2025 American Indian/Alaska Native Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNASNCY",
    label: "2025 Asian Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNASNCY_HEAT",
    label: "2025 Asian Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNPICY",
    label: "2025 Pacific Islander Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNPICY_HEAT",
    label: "2025 Pacific Islander Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNOTHCY",
    label: "2025 Other Race Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNOTHCY_HEAT",
    label: "2025 Other Race Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNMLTCY",
    label: "2025 Multiple Races Unemployed Population Age 16+",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "UNMLTCY_HEAT",
    label: "2025 Multiple Races Unemployed Population Age 16+",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Labor Force by Race
  {
    value: "CIVLFWHTCY",
    label: "2025 White Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFWHTCY_HEAT",
    label: "2025 White Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFBLKCY",
    label: "2025 Black/African American Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFBLKCY_HEAT",
    label: "2025 Black/African American Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFAICY",
    label: "2025 American Indian/Alaska Native Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFAICY_HEAT",
    label: "2025 American Indian/Alaska Native Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFASNCY",
    label: "2025 Asian Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFASNCY_HEAT",
    label: "2025 Asian Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFPICY",
    label: "2025 Pacific Islander Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFPICY_HEAT",
    label: "2025 Pacific Islander Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFOTHCY",
    label: "2025 Other Race Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFOTHCY_HEAT",
    label: "2025 Other Race Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "CIVLFMLTCY",
    label: "2025 Multiple Races Civilian Population 16+ in Labor Force",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "CIVLFMLTCY_HEAT",
    label: "2025 Multiple Races Civilian Population 16+ in Labor Force",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Unemployment Rates by Race
  {
    value: "UNEMRTWHCY_HEAT",
    label: "2025 White Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTBLCY_HEAT",
    label: "2025 Black/African American Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTAICY_HEAT",
    label: "2025 American Indian/Alaska Native Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTASCY_HEAT",
    label: "2025 Asian Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTPICY_HEAT",
    label: "2025 Pacific Islander Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTOTCY_HEAT",
    label: "2025 Other Race Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "UNEMRTMLCY_HEAT",
    label: "2025 Multiple Races Unemployment Rate",
    type: "class-breaks",
    category: "Heat Map",
  },

  // Race and Ethnicity - Population Counts
  {
    value: "HISPPOP_CY",
    label: "2025 Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HISPPOP_CY_HEAT",
    label: "2025 Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPWHT_CY",
    label: "2025 White Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPWHT_CY_HEAT",
    label: "2025 White Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPBLK_CY",
    label: "2025 Black/African American Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPBLK_CY_HEAT",
    label: "2025 Black/African American Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPAI_CY",
    label: "2025 American Indian/Alaska Native Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPAI_CY_HEAT",
    label: "2025 American Indian/Alaska Native Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPASN_CY",
    label: "2025 Asian Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPASN_CY_HEAT",
    label: "2025 Asian Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPPI_CY",
    label: "2025 Pacific Islander Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPPI_CY_HEAT",
    label: "2025 Pacific Islander Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPOTH_CY",
    label: "2025 Other Race Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPOTH_CY_HEAT",
    label: "2025 Other Race Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "NHSPMLT_CY",
    label: "2025 Multiple Races Non-Hispanic Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "NHSPMLT_CY_HEAT",
    label: "2025 Multiple Races Non-Hispanic Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DIVINDX_CY_HEAT",
    label: "2025 Diversity Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "RACEBASECY",
    label: "2025 Population by Race Base",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "RACEBASECY_HEAT",
    label: "2025 Population by Race Base",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "EDUCBASECY",
    label: "2025 Educational Attainment Base (Pop 25+)",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "EDUCBASECY_HEAT",
    label: "2025 Educational Attainment Base (Pop 25+)",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "HHPOP_FY",
    label: "2029 Household Population",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "HHPOP_FY_HEAT",
    label: "2029 Household Population",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "PCIGRWCYFY_HEAT",
    label: "2025-2029 Per Capita Income: CAGR",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "DIVINDX_FY_HEAT",
    label: "2029 Diversity Index",
    type: "class-breaks",
    category: "Heat Map",
  },
  {
    value: "PCI_FY",
    label: "2029 Per Capita Income",
    type: "dot-density",
    category: "Dot Density Map",
  },
  {
    value: "PCI_FY_HEAT",
    label: "2029 Per Capita Income",
    type: "class-breaks",
    category: "Heat Map",
  },
];

// --- Area Types (Largest to Smallest) ---
export const areaTypes = [
  {
    value: 10,
    label: "State",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/10",
  },
  {
    value: 4,
    label: "Congressional District",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/4",
  },
  {
    value: 11,
    label: "County",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/11",
  },
  {
    value: 8,
    label: "Place",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/8",
  },
  {
    value: 9,
    label: "Zip Code",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/9",
  },
  {
    value: 12,
    label: "Census Tract",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/12",
  },
  {
    value: 13,
    label: "Block Group",
    url: "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/USA%20Esri%20Demographics%202025%20State%20and%20Local%20Government%20view/FeatureServer/13",
  },
];