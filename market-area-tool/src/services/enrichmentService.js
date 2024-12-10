import esriConfig from "@arcgis/core/config";
import * as projection from "@arcgis/core/geometry/projection";
import Polygon from "@arcgis/core/geometry/Polygon";

const ARCGIS_CLIENT_ID = import.meta.env.VITE_ARCGIS_CLIENT_ID;
const ARCGIS_CLIENT_SECRET = import.meta.env.VITE_ARCGIS_CLIENT_SECRET;

if (!ARCGIS_CLIENT_ID || !ARCGIS_CLIENT_SECRET) {
  console.error("ArcGIS credentials not found in environment variables");
}

// Set the API key for ArcGIS configuration
esriConfig.apiKey = ARCGIS_CLIENT_ID;

// Constants
const CHUNK_SIZE = 1;

const MA_TYPE_MAPPING = {
  radius: "RADIUS",
  place: "PLACE",
  block: "BLOCK",
  blockgroup: "BLOCKGROUP",
  cbsa: "CBSA",
  state: "STATE",
  zip: "ZIP",
  tract: "TRACT",
  county: "COUNTY",
};

// Organized analysis categories and variables
export const analysisCategories = {
  income: {
    label: "Income by Age",
    variables: [
      { id: "incomebyage.IA15BASECY", label: "Income Age 15-24" },
      { id: "incomebyage.IA25BASECY", label: "Income Age 25-34" },
      { id: "incomebyage.IA35BASECY", label: "Income Age 35-44" },
      { id: "incomebyage.IA45BASECY", label: "Income Age 45-54" },
      { id: "incomebyage.IA55BASECY", label: "Income Age 55-64" },
      { id: "incomebyage.IA65BASECY", label: "Income Age 65-74" },
      { id: "incomebyage.IA75BASECY", label: "Income Age 75+" },
      { id: "incomebyage.IA55UBASCY", label: "Income Age 55+ (UBA)" },
      { id: "incomebyage.IA65UBASCY", label: "Income Age 65+ (UBA)" },
    ],
  },
  incomeAge25: {
    label: "Income by Age (25-34)",
    variables: [
      { id: "incomebyage.A25I0_CY", label: "Income Age 25-34: < $15,000" },
      {
        id: "incomebyage.A25I15_CY",
        label: "Income Age 25-34: $15,000-$24,999",
      },
      {
        id: "incomebyage.A25I25_CY",
        label: "Income Age 25-34: $25,000-$34,999",
      },
      {
        id: "incomebyage.A25I35_CY",
        label: "Income Age 25-34: $35,000-$49,999",
      },
      {
        id: "incomebyage.A25I50_CY",
        label: "Income Age 25-34: $50,000-$74,999",
      },
      {
        id: "incomebyage.A25I75_CY",
        label: "Income Age 25-34: $75,000-$99,999",
      },
      {
        id: "incomebyage.A25I100_CY",
        label: "Income Age 25-34: $100,000-$149,999",
      },
      {
        id: "incomebyage.A25I150_CY",
        label: "Income Age 25-34: $150,000-$199,999",
      },
      { id: "incomebyage.A25I200_CY", label: "Income Age 25-34: $200,000+" },
    ],
  },
  incomeAge35: {
    label: "Income by Age (35-44)",
    variables: [
      { id: "incomebyage.A35I0_CY", label: "Income Age 35-44: < $15,000" },
      {
        id: "incomebyage.A35I15_CY",
        label: "Income Age 35-44: $15,000-$24,999",
      },
      {
        id: "incomebyage.A35I25_CY",
        label: "Income Age 35-44: $25,000-$34,999",
      },
      {
        id: "incomebyage.A35I35_CY",
        label: "Income Age 35-44: $35,000-$49,999",
      },
      {
        id: "incomebyage.A35I50_CY",
        label: "Income Age 35-44: $50,000-$74,999",
      },
      {
        id: "incomebyage.A35I75_CY",
        label: "Income Age 35-44: $75,000-$99,999",
      },
      {
        id: "incomebyage.A35I100_CY",
        label: "Income Age 35-44: $100,000-$149,999",
      },
      {
        id: "incomebyage.A35I150_CY",
        label: "Income Age 35-44: $150,000-$199,999",
      },
      { id: "incomebyage.A35I200_CY", label: "Income Age 35-44: $200,000+" },
    ],
  },
  incomeAge45: {
    label: "Income by Age (45-54)",
    variables: [
      { id: "incomebyage.A45I0_CY", label: "Income Age 45-54: < $15,000" },
      {
        id: "incomebyage.A45I15_CY",
        label: "Income Age 45-54: $15,000-$24,999",
      },
      {
        id: "incomebyage.A45I25_CY",
        label: "Income Age 45-54: $25,000-$34,999",
      },
      {
        id: "incomebyage.A45I35_CY",
        label: "Income Age 45-54: $35,000-$49,999",
      },
      {
        id: "incomebyage.A45I50_CY",
        label: "Income Age 45-54: $50,000-$74,999",
      },
      {
        id: "incomebyage.A45I75_CY",
        label: "Income Age 45-54: $75,000-$99,999",
      },
      {
        id: "incomebyage.A45I100_CY",
        label: "Income Age 45-54: $100,000-$149,999",
      },
      {
        id: "incomebyage.A45I150_CY",
        label: "Income Age 45-54: $150,000-$199,999",
      },
      { id: "incomebyage.A45I200_CY", label: "Income Age 45-54: $200,000+" },
    ],
  },
  currentYearDemographics: {
    label: "Current Year Demographics",
    variables: [
      { id: "AtRisk.TOTPOP_CY", label: "Total Population" },
      { id: "AtRisk.TOTHH_CY", label: "Total Households" },
      { id: "AtRisk.AVGHHSZ_CY", label: "Average Household Size" },
      { id: "AtRisk.AVGHINC_CY", label: "Average Household Income" },
      { id: "KeyUSFacts.OWNER_CY", label: "Owner Occupied Housing Units" },
      { id: "KeyUSFacts.RENTER_CY", label: "Renter Occupied Housing Units" },
    ],
  },
  populationByAge: {
    label: "Population by Age (5-Year Increments)",
    variables: [
      { id: "5yearincrements.POP0_CY", label: "Population Age 0-4" },
      { id: "5yearincrements.POP5_CY", label: "Population Age 5-9" },
      { id: "5yearincrements.POP10_CY", label: "Population Age 10-14" },
      { id: "5yearincrements.POP15_CY", label: "Population Age 15-19" },
      { id: "5yearincrements.POP20_CY", label: "Population Age 20-24" },
      { id: "5yearincrements.POP25_CY", label: "Population Age 25-29" },
      { id: "5yearincrements.POP30_CY", label: "Population Age 30-34" },
      { id: "5yearincrements.POP35_CY", label: "Population Age 35-39" },
      { id: "5yearincrements.POP40_CY", label: "Population Age 40-44" },
      { id: "5yearincrements.POP45_CY", label: "Population Age 45-49" },
      { id: "5yearincrements.POP50_CY", label: "Population Age 50-54" },
      { id: "5yearincrements.POP55_CY", label: "Population Age 55-59" },
      { id: "5yearincrements.POP60_CY", label: "Population Age 60-64" },
      { id: "5yearincrements.POP65_CY", label: "Population Age 65-69" },
      { id: "5yearincrements.POP70_CY", label: "Population Age 70-74" },
      { id: "5yearincrements.POP75_CY", label: "Population Age 75-79" },
      { id: "5yearincrements.POP80_CY", label: "Population Age 80-84" },
      { id: "5yearincrements.POP85_CY", label: "Population Age 85+" },
      { id: "5yearincrements.MEDAGE_CY", label: "Median Age" },
      {
        id: "5yearincrements.POP0_FY",
        label: "Population Age 0-4 (Future Year)",
      },
      {
        id: "5yearincrements.POP5_FY",
        label: "Population Age 5-9 (Future Year)",
      },
      {
        id: "5yearincrements.POP10_FY",
        label: "Population Age 10-14 (Future Year)",
      },
      {
        id: "5yearincrements.POP15_FY",
        label: "Population Age 15-19 (Future Year)",
      },
      {
        id: "5yearincrements.POP20_FY",
        label: "Population Age 20-24 (Future Year)",
      },
      {
        id: "5yearincrements.POP25_FY",
        label: "Population Age 25-29 (Future Year)",
      },
      {
        id: "5yearincrements.POP30_FY",
        label: "Population Age 30-34 (Future Year)",
      },
      {
        id: "5yearincrements.POP35_FY",
        label: "Population Age 35-39 (Future Year)",
      },
      {
        id: "5yearincrements.POP40_FY",
        label: "Population Age 40-44 (Future Year)",
      },
      {
        id: "5yearincrements.POP45_FY",
        label: "Population Age 45-49 (Future Year)",
      },
      {
        id: "5yearincrements.POP50_FY",
        label: "Population Age 50-54 (Future Year)",
      },
      {
        id: "5yearincrements.POP55_FY",
        label: "Population Age 55-59 (Future Year)",
      },
      {
        id: "5yearincrements.POP60_FY",
        label: "Population Age 60-64 (Future Year)",
      },
      {
        id: "5yearincrements.POP65_FY",
        label: "Population Age 65-69 (Future Year)",
      },
      {
        id: "5yearincrements.POP70_FY",
        label: "Population Age 70-74 (Future Year)",
      },
      {
        id: "5yearincrements.POP75_FY",
        label: "Population Age 75-79 (Future Year)",
      },
      {
        id: "5yearincrements.POP80_FY",
        label: "Population Age 80-84 (Future Year)",
      },
      {
        id: "5yearincrements.POP85_FY",
        label: "Population Age 85+ (Future Year)",
      },
      { id: "5yearincrements.MEDAGE_FY", label: "Median Age (Future Year)" },
      { id: "5yearincrements.POP0C10", label: "Population Age 0-4 (C10)" },
      { id: "5yearincrements.POP5C10", label: "Population Age 5-9 (C10)" },
      { id: "5yearincrements.POP10C10", label: "Population Age 10-14 (C10)" },
      { id: "5yearincrements.POP15C10", label: "Population Age 15-19 (C10)" },
      { id: "5yearincrements.POP20C10", label: "Population Age 20-24 (C10)" },
      { id: "5yearincrements.POP25C10", label: "Population Age 25-29 (C10)" },
      { id: "5yearincrements.POP30C10", label: "Population Age 30-34 (C10)" },
      { id: "5yearincrements.POP35C10", label: "Population Age 35-39 (C10)" },
      { id: "5yearincrements.POP40C10", label: "Population Age 40-44 (C10)" },
      { id: "5yearincrements.POP45C10", label: "Population Age 45-49 (C10)" },
      { id: "5yearincrements.POP50C10", label: "Population Age 50-54 (C10)" },
      { id: "5yearincrements.POP55C10", label: "Population Age 55-59 (C10)" },
      { id: "5yearincrements.POP60C10", label: "Population Age 60-64 (C10)" },
      { id: "5yearincrements.POP65C10", label: "Population Age 65-69 (C10)" },
      { id: "5yearincrements.POP70C10", label: "Population Age 70-74 (C10)" },
      { id: "5yearincrements.POP75C10", label: "Population Age 75-79 (C10)" },
      { id: "5yearincrements.POP80C10", label: "Population Age 80-84 (C10)" },
      { id: "5yearincrements.POP85C10", label: "Population Age 85+ (C10)" },
      { id: "5yearincrements.MEDAGE10", label: "Median Age (C10)" },
    ],
  },
  daytimePopulation: {
    label: "Daytime Population",
    variables: [
      { id: "DaytimePopulation.DPOPWRK_CY", label: "Daytime Workers" },
    ],
  },
  householdIncome: {
    label: "Household Income Distribution",
    variables: [
      { id: "householdincome.HINC0_CY", label: "Household Income < $15,000" },
      {
        id: "householdincome.HINC15_CY",
        label: "Household Income $15,000-$24,999",
      },
      {
        id: "householdincome.HINC25_CY",
        label: "Household Income $25,000-$34,999",
      },
      {
        id: "householdincome.HINC35_CY",
        label: "Household Income $35,000-$49,999",
      },
      {
        id: "householdincome.HINC50_CY",
        label: "Household Income $50,000-$74,999",
      },
      {
        id: "householdincome.HINC75_CY",
        label: "Household Income $75,000-$99,999",
      },
      {
        id: "householdincome.HINC100_CY",
        label: "Household Income $100,000-$149,999",
      },
      {
        id: "householdincome.HINC150_CY",
        label: "Household Income $150,000-$199,999",
      },
      { id: "householdincome.HINC200_CY", label: "Household Income $200,000+" },
      {
        id: "householdincome.HINC0_FY",
        label: "Household Income < $15,000 (Future Year)",
      },
      {
        id: "householdincome.HINC15_FY",
        label: "Household Income $15,000-$24,999 (Future Year)",
      },
      {
        id: "householdincome.HINC25_FY",
        label: "Household Income $25,000-$34,999 (Future Year)",
      },
      {
        id: "householdincome.HINC35_FY",
        label: "Household Income $35,000-$49,999 (Future Year)",
      },
      {
        id: "householdincome.HINC50_FY",
        label: "Household Income $50,000-$74,999 (Future Year)",
      },
      {
        id: "householdincome.HINC75_FY",
        label: "Household Income $75,000-$99,999 (Future Year)",
      },
      {
        id: "householdincome.HINC100_FY",
        label: "Household Income $100,000-$149,999 (Future Year)",
      },
      {
        id: "householdincome.HINC150_FY",
        label: "Household Income $150,000-$199,999 (Future Year)",
      },
      {
        id: "householdincome.HINC200_FY",
        label: "Household Income $200,000+ (Future Year)",
      },
      {
        id: "householdincome.MEDHINC_FY",
        label: "Median Household Income (Future Year)",
      },
      {
        id: "householdincome.AVGHINC_FY",
        label: "Average Household Income (Future Year)",
      },
    ],
  },
  health: {
    label: "Health",
    variables: [{ id: "Health.MEDHINC_CY", label: "Median Household Income" }],
  },
  householdTotals: {
    label: "Household Totals",
    variables: [
      {
        id: "householdtotals.FAMHH_FY",
        label: "Family Households (Future Year)",
      },
      {
        id: "householdtotals.AVGHHSZ_FY",
        label: "Average Household Size (Future Year)",
      },
    ],
  },
  housingUnitTotals: {
    label: "Housing Unit Totals",
    variables: [
      {
        id: "housingunittotals.TOTHU_FY",
        label: "Total Housing Units (Future Year)",
      },
    ],
  },
  netWorth: {
    label: "Net Worth",
    variables: [
      { id: "networth.NW0_CY", label: "Net Worth < $15,000" },
      { id: "networth.NW15_CY", label: "Net Worth $15,000-$34,999" },
      { id: "networth.NW35_CY", label: "Net Worth $35,000-$49,999" },
      { id: "networth.NW50_CY", label: "Net Worth $50,000-$74,999" },
      { id: "networth.NW75_CY", label: "Net Worth $75,000-$99,999" },
      { id: "networth.NW100_CY", label: "Net Worth $100,000-$149,999" },
      { id: "networth.NW150_CY", label: "Net Worth $150,000-$199,999" },
      { id: "networth.NW250_CY", label: "Net Worth $250,000-$499,999" },
      { id: "networth.NW500_CY", label: "Net Worth $500,000-$999,999" },
      { id: "networth.NW1M_CY", label: "Net Worth $1,000,000-$1,499,999" },
      { id: "networth.NW1PT5M_CY", label: "Net Worth $1,500,000-$1,999,999" },
      { id: "networth.NW2M_CY", label: "Net Worth $2,000,000+" },
      { id: "networth.MEDNW_CY", label: "Median Net Worth" },
      { id: "networth.AVGNW_CY", label: "Average Net Worth" },
    ],
  },
  futureYearDemographics: {
    label: "Future Year Demographics",
    variables: [
      { id: "gender.AGEBASE_FY", label: "Base Age (Future Year)" },
      {
        id: "householdtotals.FAMHH_FY",
        label: "Family Households (Future Year)",
      },
      {
        id: "housingunittotals.TOTHU_FY",
        label: "Total Housing Units (Future Year)",
      },
      {
        id: "householdtotals.AVGHHSZ_FY",
        label: "Average Household Size (Future Year)",
      },
    ],
  },
  historicalPopulation: {
    label: "Historical Population",
    variables: [
      {
        id: "HistoricalPopulation.TSPOP10_CY",
        label: "Historical Total Population 2010",
      },
    ],
  },
  householdsBySize: {
    label: "Households by Size",
    variables: [
      {
        id: "householdsbysize.FAM2PERS10",
        label: "Family Households with 2 Persons",
      },
      {
        id: "householdsbysize.NF2PERS10",
        label: "Non-Family Households with 2 Persons",
      },
      {
        id: "householdsbysize.NF1PERS10",
        label: "Non-Family Households with 1 Person",
      },
    ],
  },
  Additional: {
    label: "Additional Variables",
    variables: [
      {
        id: "KeyUsFacts.TOTHH_FY",
        label: "2029 Total Households",
      },
      {
        id: "KeyUsFacts.TOTHU_CY",
        label: "2024 Total Housing Units",
      },
      {
        id: "KeyUsFacts.OWNER_CY",
        label: "2024 Owner Occupied HUs",
      },
      {
        id: "KeyUsFacts.RENTER_CY",
        label: "2024 Renter Occupied HUs",
      },
      {
        id: "KeyUsFacts.VACANT_CY",
        label: "2024 Vacant Housing Units",
      },
      {
        id: "KeyUsFacts.TOTHU_FY",
        label: "2029 Total Housing Units",
      },
      {
        id: "KeyUsFacts.OWNER_FY",
        label: "2029 Owner Occupied HUs",
      },
      {
        id: "KeyUsFacts.RENTER_FY",
        label: "2029 Renter Occupied HUs",
      },
      {
        id: "KeyUsFacts.VACANT_FY",
        label: "2029 Vacant Housing Units",
      },
      {
        id: "EducationalAttainment.HSGRAD_CY",
        label: "2024 Pop Age 25+: High School Diploma",
      },
      {
        id: "EducationalAttainment.GED_CY",
        label: "2024 Pop Age 25+: GED",
      },
      {
        id: "EducationalAttainment.SMCOLL_CY",
        label: "2024 Pop Age 25+: Some College/No Degree",
      },
      {
        id: "EducationalAttainment.ASSCDEG_CY",
        label: "2024 Pop Age 25+: Associate's Degree",
      },
      {
        id: "EducationalAttainment.BACHDEG_CY",
        label: "2024 Pop Age 25+: Bachelor's Degree",
      },
      {
        id: "EducationalAttainment.GRADDEG_CY",
        label: "2024 Pop Age 25+: Grad/Professional Degree",
      },
      {
        id: "EducationalAttainment.EDUCBASECY",
        label: "2024 Educational Attainment Base",
      },
      {
        id: "KeyUsFacts.AGEBASE_FY",
        label: "2029 Base Age",
      },
      {
        id: "KeyUsFacts.TOTPOP_FY",
        label: "2029 Total Population",
      },
    ],
  },
  tapestryHouseholds: {
    label: "Tapestry Households",
    variables: [
      { id: "tapestryhouseholdsNEW.THH01", label: "Tapestry Household THH01" },
      { id: "tapestryhouseholdsNEW.THH02", label: "Tapestry Household THH02" },
      { id: "tapestryhouseholdsNEW.THH03", label: "Tapestry Household THH03" },
      { id: "tapestryhouseholdsNEW.THH04", label: "Tapestry Household THH04" },
      { id: "tapestryhouseholdsNEW.THH05", label: "Tapestry Household THH05" },
      { id: "tapestryhouseholdsNEW.THH06", label: "Tapestry Household THH06" },
      { id: "tapestryhouseholdsNEW.THH07", label: "Tapestry Household THH07" },
      { id: "tapestryhouseholdsNEW.THH08", label: "Tapestry Household THH08" },
      { id: "tapestryhouseholdsNEW.THH09", label: "Tapestry Household THH09" },
      { id: "tapestryhouseholdsNEW.THH10", label: "Tapestry Household THH10" },
      { id: "tapestryhouseholdsNEW.THH11", label: "Tapestry Household THH11" },
      { id: "tapestryhouseholdsNEW.THH12", label: "Tapestry Household THH12" },
      { id: "tapestryhouseholdsNEW.THH13", label: "Tapestry Household THH13" },
      { id: "tapestryhouseholdsNEW.THH14", label: "Tapestry Household THH14" },
      { id: "tapestryhouseholdsNEW.THH15", label: "Tapestry Household THH15" },
      { id: "tapestryhouseholdsNEW.THH16", label: "Tapestry Household THH16" },
      { id: "tapestryhouseholdsNEW.THH17", label: "Tapestry Household THH17" },
      { id: "tapestryhouseholdsNEW.THH18", label: "Tapestry Household THH18" },
      { id: "tapestryhouseholdsNEW.THH19", label: "Tapestry Household THH19" },
      { id: "tapestryhouseholdsNEW.THH20", label: "Tapestry Household THH20" },
      { id: "tapestryhouseholdsNEW.THH21", label: "Tapestry Household THH21" },
      { id: "tapestryhouseholdsNEW.THH22", label: "Tapestry Household THH22" },
      { id: "tapestryhouseholdsNEW.THH23", label: "Tapestry Household THH23" },
      { id: "tapestryhouseholdsNEW.THH24", label: "Tapestry Household THH24" },
      { id: "tapestryhouseholdsNEW.THH25", label: "Tapestry Household THH25" },
      { id: "tapestryhouseholdsNEW.THH26", label: "Tapestry Household THH26" },
      { id: "tapestryhouseholdsNEW.THH27", label: "Tapestry Household THH27" },
      { id: "tapestryhouseholdsNEW.THH28", label: "Tapestry Household THH28" },
      { id: "tapestryhouseholdsNEW.THH29", label: "Tapestry Household THH29" },
      { id: "tapestryhouseholdsNEW.THH30", label: "Tapestry Household THH30" },
      { id: "tapestryhouseholdsNEW.THH31", label: "Tapestry Household THH31" },
      { id: "tapestryhouseholdsNEW.THH32", label: "Tapestry Household THH32" },
      { id: "tapestryhouseholdsNEW.THH33", label: "Tapestry Household THH33" },
      { id: "tapestryhouseholdsNEW.THH34", label: "Tapestry Household THH34" },
      { id: "tapestryhouseholdsNEW.THH35", label: "Tapestry Household THH35" },
      { id: "tapestryhouseholdsNEW.THH36", label: "Tapestry Household THH36" },
      { id: "tapestryhouseholdsNEW.THH37", label: "Tapestry Household THH37" },
      { id: "tapestryhouseholdsNEW.THH38", label: "Tapestry Household THH38" },
      { id: "tapestryhouseholdsNEW.THH39", label: "Tapestry Household THH39" },
      { id: "tapestryhouseholdsNEW.THH40", label: "Tapestry Household THH40" },
      { id: "tapestryhouseholdsNEW.THH41", label: "Tapestry Household THH41" },
      { id: "tapestryhouseholdsNEW.THH42", label: "Tapestry Household THH42" },
      { id: "tapestryhouseholdsNEW.THH43", label: "Tapestry Household THH43" },
      { id: "tapestryhouseholdsNEW.THH44", label: "Tapestry Household THH44" },
      { id: "tapestryhouseholdsNEW.THH45", label: "Tapestry Household THH45" },
      { id: "tapestryhouseholdsNEW.THH46", label: "Tapestry Household THH46" },
      { id: "tapestryhouseholdsNEW.THH47", label: "Tapestry Household THH47" },
      { id: "tapestryhouseholdsNEW.THH48", label: "Tapestry Household THH48" },
      { id: "tapestryhouseholdsNEW.THH49", label: "Tapestry Household THH49" },
      { id: "tapestryhouseholdsNEW.THH50", label: "Tapestry Household THH50" },
      { id: "tapestryhouseholdsNEW.THH51", label: "Tapestry Household THH51" },
      { id: "tapestryhouseholdsNEW.THH52", label: "Tapestry Household THH52" },
      { id: "tapestryhouseholdsNEW.THH53", label: "Tapestry Household THH53" },
      { id: "tapestryhouseholdsNEW.THH54", label: "Tapestry Household THH54" },
      { id: "tapestryhouseholdsNEW.THH55", label: "Tapestry Household THH55" },
      { id: "tapestryhouseholdsNEW.THH56", label: "Tapestry Household THH56" },
      { id: "tapestryhouseholdsNEW.THH57", label: "Tapestry Household THH57" },
      { id: "tapestryhouseholdsNEW.THH58", label: "Tapestry Household THH58" },
      { id: "tapestryhouseholdsNEW.THH59", label: "Tapestry Household THH59" },
      { id: "tapestryhouseholdsNEW.THH60", label: "Tapestry Household THH60" },
      { id: "tapestryhouseholdsNEW.THH61", label: "Tapestry Household THH61" },
      { id: "tapestryhouseholdsNEW.THH62", label: "Tapestry Household THH62" },
      { id: "tapestryhouseholdsNEW.THH63", label: "Tapestry Household THH63" },
      { id: "tapestryhouseholdsNEW.THH64", label: "Tapestry Household THH64" },
      { id: "tapestryhouseholdsNEW.THH65", label: "Tapestry Household THH65" },
      { id: "tapestryhouseholdsNEW.THH66", label: "Tapestry Household THH66" },
      { id: "tapestryhouseholdsNEW.THH67", label: "Tapestry Household THH67" },
    ],
  },
  householdsbysize: {
    label: "Households by Size",
    variables: [
      {
        id: "householdsbysize.FAM2PERS10",
        label: "Family Households with 2 Persons",
      },
      {
        id: "householdsbysize.NF2PERS10",
        label: "Non-Family Households with 2 Persons",
      },
      {
        id: "householdsbysize.NF1PERS10",
        label: "Non-Family Households with 1 Person",
      },
    ],
  },
};

// Helper functions
export const getAllVariables = () => {
  return Object.values(analysisCategories)
    .flatMap((category) => category.variables)
    .map((v) => v.id);
};

const shortKeyToLabelMap = {};
Object.values(analysisCategories).forEach((category) => {
  category.variables.forEach((variable) => {
    const shortKey = variable.id.split(".").pop();
    shortKeyToLabelMap[shortKey] = variable.label;
  });
});

export default class EnrichmentService {
  constructor() {
    this.clientId = ARCGIS_CLIENT_ID;
    this.clientSecret = ARCGIS_CLIENT_SECRET;
    this.token = null;
    this.tokenExpiration = null;
  }

  async getToken() {
    if (this.token && this.tokenExpiration && Date.now() < this.tokenExpiration) {
      return this.token;
    }

    try {
      const tokenUrl = "https://www.arcgis.com/sharing/rest/oauth2/token";

      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
        f: "json",
      });

      console.log("Requesting new token...");

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Token response not OK:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `Token request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Token response received");

      if (data.error) {
        throw new Error(`Token service error: ${JSON.stringify(data.error)}`);
      }

      if (!data.access_token) {
        throw new Error("No access_token received in response");
      }

      this.token = data.access_token;
      // Set expiration 60 seconds before actual expiration for safety
      this.tokenExpiration = Date.now() + (data.expires_in - 60) * 1000;

      return this.token;
    } catch (error) {
      console.error("Token generation failed:", error);
      const maskedId = this.clientId
        ? `${this.clientId.slice(0, 6)}...`
        : "not set";
      throw new Error(
        `Token generation failed. Client ID: ${maskedId}. Error: ${error.message}`
      );
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  formatNumberValue(value) {
    if (typeof value !== "number") return value;
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }

  async prepareGeometryForEnrichment(marketAreas) {
    await projection.load();
  
    const expandedAreas = [];
    let areaIndex = 0; // Use a numeric index for stable ObjectIDs
  
    for (const area of marketAreas) {
      console.log("Processing market area for enrichment:", {
        name: area.name,
        type: area.ma_type,
        hasRadiusPoints: Boolean(area.radius_points?.length),
        hasLocations: Boolean(area.locations?.length),
      });
  
      if (area.ma_type === "radius") {
        // For radius types, we will take the largest radius and use that polygon only.
        if (area.radius_points?.length > 0) {
          let largestRadiusInfo = { radius: 0, polygon: null };
  
          for (const point of area.radius_points) {
            if (!point.center || !point.radii?.length) continue;
  
            for (const radiusMiles of point.radii) {
              const polygonRings = this.createCirclePolygon(
                point.center.x,
                point.center.y,
                radiusMiles,
                point.center.spatialReference?.wkid || 102100
              );
  
              const combinedPolygon = new Polygon({
                rings: polygonRings,
                spatialReference: { wkid: 3857 },
              });
  
              const projectedGeometry = projection.project(combinedPolygon, {
                wkid: 4326,
              });
  
              if (projectedGeometry && radiusMiles > largestRadiusInfo.radius) {
                largestRadiusInfo = { radius: radiusMiles, polygon: projectedGeometry };
              }
            }
          }
  
          if (largestRadiusInfo.polygon) {
            expandedAreas.push({
              geometry: {
                rings: largestRadiusInfo.polygon.rings,
                spatialReference: { wkid: 4326 },
              },
              attributes: {
                ObjectID: areaIndex,
                name: area.name,
                originalAreaName: area.name,
                radiusMiles: largestRadiusInfo.radius,
              },
              originalIndex: areaIndex,
            });
            areaIndex++;
          } else {
            console.warn(`No valid radii found for radius MA: ${area.name}`);
          }
        } else {
          console.warn(`No radius_points found for radius MA: ${area.name}`);
        }
      } else {
        // Non-radius areas: union all rings from locations
        const allRings = area.locations?.flatMap((loc) => loc.geometry?.rings || []) || [];
  
        if (!allRings.length) {
          console.warn(`No valid rings found for market area: ${area.name}`);
          continue;
        }
  
        const combinedPolygon = new Polygon({
          rings: allRings,
          spatialReference: { wkid: 3857 },
        });
  
        const projectedGeometry = projection.project(combinedPolygon, {
          wkid: 4326,
        });
  
        if (!projectedGeometry) {
          console.error(`Projection failed for ${area.name}`);
          continue;
        }
  
        expandedAreas.push({
          geometry: {
            rings: projectedGeometry.rings,
            spatialReference: { wkid: 4326 },
          },
          attributes: {
            ObjectID: areaIndex,
            name: area.name,
            originalAreaName: area.name,
          },
          originalIndex: areaIndex,
        });
  
        areaIndex++;
      }
    }
  
    return expandedAreas;
  }

  createCirclePolygon(centerX, centerY, radiusMiles, fromWkid = 102100) {
    const radiusMeters = radiusMiles * 1609.34;
    const numPoints = 32;
    const points = [];

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      const dx = Math.cos(angle) * radiusMeters;
      const dy = Math.sin(angle) * radiusMeters;
      points.push([centerX + dx, centerY + dy]);
    }

    points.push(points[0]);
    return [points];
  }

  async enrichChunk(studyAreas, selectedVariables = null) {
    try {
      const token = await this.getToken();
      const enrichmentUrl =
        "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/enrich";
      const analysisVariables = selectedVariables || getAllVariables();
  
      console.log("Enriching chunk with variables:", analysisVariables);
      console.log("Study areas for enrichment:", studyAreas);
  
      if (!studyAreas?.[0]?.geometry) {
        throw new Error("Invalid study area geometry");
      }
  
      // Prepare the study areas payload for the enrich request
      const studyAreasPayload = studyAreas.map((s) => ({
        geometry: s.geometry,
        attributes: s.attributes,
      }));
  
      // Set the parameters
      const params = new URLSearchParams();
      params.append("f", "json");
      params.append("token", token);
      params.append("studyAreas", JSON.stringify(studyAreasPayload));
      params.append("analysisVariables", JSON.stringify(analysisVariables));
      params.append("returnGeometry", "false");
  
      // Only include studyAreasOptions if you are using point geometry and want buffers.
      // If studyAreas are polygons, remove or comment out the following lines:
      // params.append(
      //   "studyAreasOptions",
      //   JSON.stringify({
      //     areaType: "RingBuffer",
      //     bufferUnits: "esriMiles",
      //     bufferRadii: [0],
      //   })
      // );
  
      const response = await fetch(enrichmentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Enrichment Error Response:", errorText);
        throw new Error(
          `Enrichment request failed: ${response.status} - ${errorText}`
        );
      }
  
      const data = await response.json();
  
      if (data.error) {
        console.error("Enrichment API Error:", data.error);
        throw new Error(
          `Enrichment API Error: ${data.error.message || JSON.stringify(data.error)}`
        );
      }
  
      // Validate response data
      if (!data.results || !Array.isArray(data.results)) {
        console.error("Invalid response format:", data);
        throw new Error("Invalid response format from enrichment service");
      }
  
      return data;
    } catch (error) {
      console.error("Error in enrichChunk:", error);
      throw error;
    }
  }
  
  async enrichAreas(marketAreas, selectedVariables = null) {
    if (!marketAreas?.length) {
      throw new Error("No market areas provided for enrichment");
    }
  
    const studyAreas = await this.prepareGeometryForEnrichment(marketAreas);
    if (!studyAreas?.length) {
      throw new Error("No valid study areas generated from market areas");
    }
  
    const chunks = this.chunkArray(studyAreas, CHUNK_SIZE);
    const results = [];
  
    for (const chunk of chunks) {
      const response = await this.enrichChunk(chunk, selectedVariables);
      if (response?.results) {
        results.push(...response.results);
      }
    }
  
    if (!results.length) {
      throw new Error("No enrichment results returned");
    }
  
    // Create a map from ObjectID to originalIndex for easy lookups
    const idToIndexMap = {};
    studyAreas.forEach(sa => {
      idToIndexMap[sa.attributes.ObjectID] = sa.originalIndex;
    });
  
    return { results, studyAreas, idToIndexMap };
  }
  

  aggregateResults(groupedResults, area) {
    const aggregated = {};
    groupedResults.forEach((attributes) => {
      Object.keys(attributes).forEach((key) => {
        if (typeof attributes[key] === "number") {
          aggregated[key] = (aggregated[key] || 0) + attributes[key];
        } else {
          aggregated[key] = attributes[key];
        }
      });
    });
    return aggregated;
  }

  getVariableLabel(shortKey) {
    return shortKeyToLabelMap[shortKey] || shortKey;
  }

  exportToCSV(enrichmentData, marketAreas, selectedVariables = null) {
    const { results, studyAreas, idToIndexMap } = enrichmentData;
  
    // Prepare a lookup: result attributes keyed by originalIndex
    const enrichmentLookup = {};
  
    results.forEach((res) => {
      const featureSet = res.value?.FeatureSet?.[0];
      if (!featureSet?.features?.[0]?.attributes) return;
      const attrs = featureSet.features[0].attributes;
      const objId = attrs.ObjectID;
  
      const originalIndex = idToIndexMap[objId];
      if (originalIndex !== undefined) {
        enrichmentLookup[originalIndex] = attrs;
      } else {
        console.warn(`No matching originalIndex found for ObjectID ${objId}`);
      }
    });
  
    const csvRows = [];
  
    // Headers
    csvRows.push(["Market Area Name", ...marketAreas.map(ma => ma.name || "")]);
    csvRows.push(["Short Name", ...marketAreas.map(ma => ma.short_name || "")]);
    csvRows.push([
      "Definition Type",
      ...marketAreas.map(ma => {
        const maType = ma.ma_type?.toLowerCase();
        return MA_TYPE_MAPPING[maType] || ma.ma_type?.toUpperCase() || "";
      }),
    ]);
  
    csvRows.push([
      "Areas Included",
      ...marketAreas.map((ma) => {
        switch (ma.ma_type?.toLowerCase()) {
          case "zip":
            return ma.locations?.map(loc => loc.name?.split(" - ")?.[0]).join(", ") || "";
          case "radius":
            // Now that we only take the largest radius, just display that radius
            if (ma.radius_points?.length > 0) {
              const allRadii = ma.radius_points.flatMap(p => p.radii || []);
              if (allRadii.length > 0) {
                const largestRadius = Math.max(...allRadii);
                return `${largestRadius} miles`;
              }
            }
            return "";
          default:
            return (ma.locations?.map(loc => loc.name).join(", ")) || "";
        }
      }),
    ]);
  
    csvRows.push(["State", ...marketAreas.map(ma => ma.ma_type?.toLowerCase() === "zip" ? "CA" : "")]);
  
    csvRows.push([""]); // Blank separator row
    csvRows.push(["Enrichment Variables"]);
  
    selectedVariables.forEach((variableId) => {
      const shortKey = variableId.split(".").pop();
      const label = this.getVariableLabel(shortKey);
  
      const values = marketAreas.map((_, index) => {
        const attrs = enrichmentLookup[index];
        if (!attrs) return "";
        const value = attrs[shortKey];
        return this.formatNumberValue(value);
      });
  
      csvRows.push([label, ...values]);
    });
  
    const processField = (field) => {
      if (field === null || field === undefined) return "";
      const stringField = String(field);
      if (stringField.includes(",") || stringField.includes('"') || stringField.includes("\n")) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };
  
    return csvRows.map(row => row.map(processField).join(",")).join("\n");
  }
  

  getStateFullName(stateAbbr) {
    if (!stateAbbr) return "";

    const stateMap = {
      AL: "Alabama",
      AK: "Alaska",
      AZ: "Arizona",
      AR: "Arkansas",
      CA: "California",
      CO: "Colorado",
      CT: "Connecticut",
      DE: "Delaware",
      FL: "Florida",
      GA: "Georgia",
      HI: "Hawaii",
      ID: "Idaho",
      IL: "Illinois",
      IN: "Indiana",
      IA: "Iowa",
      KS: "Kansas",
      KY: "Kentucky",
      LA: "Louisiana",
      ME: "Maine",
      MD: "Maryland",
      MA: "Massachusetts",
      MI: "Michigan",
      MN: "Minnesota",
      MS: "Mississippi",
      MO: "Missouri",
      MT: "Montana",
      NE: "Nebraska",
      NV: "Nevada",
      NH: "New Hampshire",
      NJ: "New Jersey",
      NM: "New Mexico",
      NY: "New York",
      NC: "North Carolina",
      ND: "North Dakota",
      OH: "Ohio",
      OK: "Oklahoma",
      OR: "Oregon",
      PA: "Pennsylvania",
      RI: "Rhode Island",
      SC: "South Carolina",
      SD: "South Dakota",
      TN: "Tennessee",
      TX: "Texas",
      UT: "Utah",
      VT: "Vermont",
      VA: "Virginia",
      WA: "Washington",
      WV: "West Virginia",
      WI: "Wisconsin",
      WY: "Wyoming",
      DC: "District of Columbia",
    };

    return stateMap[stateAbbr.trim().toUpperCase()] || stateAbbr;
  }

  getCategories() {
    return Object.entries(analysisCategories).map(([key, category]) => ({
      id: key,
      label: category.label,
      variableCount: category.variables.length,
    }));
  }

  getVariablesByCategory(categoryId) {
    return analysisCategories[categoryId]?.variables || [];
  }

  validateVariables(variableIds) {
    const allVariables = new Set(getAllVariables());
    return variableIds.filter((id) => allVariables.has(id));
  }
}

export const enrichmentService = new EnrichmentService();
