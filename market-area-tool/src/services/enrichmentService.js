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


export const analysisCategories = {
  variables: {
    label: "Demographic Variables",
    variables: [
      // Current Year Population Base
      { id: "AtRisk.TOTPOP_CY", label: "2024 Total Population" },
      { id: "AtRisk.TOTHH_CY", label: "2024 Total Households" },
      { id: "AtRisk.AVGHHSZ_CY", label: "2024 Average Household Size" },
      
      // Current Year Population by Age
      { id: "5yearincrements.POP0_CY", label: "2024 Population Age 0-4" },
      { id: "5yearincrements.POP5_CY", label: "2024 Population Age 5-9" },
      { id: "5yearincrements.POP10_CY", label: "2024 Population Age 10-14" },
      { id: "5yearincrements.POP15_CY", label: "2024 Population Age 15-19" },
      { id: "5yearincrements.POP20_CY", label: "2024 Population Age 20-24" },
      { id: "5yearincrements.POP25_CY", label: "2024 Population Age 25-29" },
      { id: "5yearincrements.POP30_CY", label: "2024 Population Age 30-34" },
      { id: "5yearincrements.POP35_CY", label: "2024 Population Age 35-39" },
      { id: "5yearincrements.POP40_CY", label: "2024 Population Age 40-44" },
      { id: "5yearincrements.POP45_CY", label: "2024 Population Age 45-49" },
      { id: "5yearincrements.POP50_CY", label: "2024 Population Age 50-54" },
      { id: "5yearincrements.POP55_CY", label: "2024 Population Age 55-59" },
      { id: "5yearincrements.POP60_CY", label: "2024 Population Age 60-64" },
      { id: "5yearincrements.POP65_CY", label: "2024 Population Age 65-69" },
      { id: "5yearincrements.POP70_CY", label: "2024 Population Age 70-74" },
      { id: "5yearincrements.POP75_CY", label: "2024 Population Age 75-79" },
      { id: "5yearincrements.POP80_CY", label: "2024 Population Age 80-84" },
      { id: "5yearincrements.POP85_CY", label: "2024 Population Age 85+" },
      { id: "5yearincrements.MEDAGE_CY", label: "2024 Median Age" },
      
      // Current Year Daytime Population
      { id: "DaytimePopulation.DPOPWRK_CY", label: "2024 Daytime Pop: Workers" },
      
      // Current Year Household Income
      { id: "householdincome.HINC0_CY", label: "2024 HH Income <$15000" },
      { id: "householdincome.HINC15_CY", label: "2024 HH Income $15000-24999" },
      { id: "householdincome.HINC25_CY", label: "2024 HH Income $25000-34999" },
      { id: "householdincome.HINC35_CY", label: "2024 HH Income $35000-49999" },
      { id: "householdincome.HINC50_CY", label: "2024 HH Income $50000-74999" },
      { id: "householdincome.HINC75_CY", label: "2024 HH Income $75000-99999" },
      { id: "householdincome.HINC100_CY", label: "2024 HH Income $100000-149999" },
      { id: "householdincome.HINC150_CY", label: "2024 HH Income $150000-199999" },
      { id: "householdincome.HINC200_CY", label: "2024 HH Income $200000+" },
      { id: "householdincome.MEDHINC_CY", label: "2024 Median Household Income" },
      { id: "householdincome.AVGHINC_CY", label: "2024 Average Household Income" },
      
      // Current Year Income by Age Groups - Organized with base before details
      { id: "incomebyage.IA15BASECY", label: "2024 HH Income Base: HHr 15-24" },
      
      // Age 25-34 Income
      { id: "incomebyage.A25I0_CY", label: "2024 HH Inc <$15000/HHr 25-34" },
      { id: "incomebyage.A25I15_CY", label: "2024 HH Inc $15K-24999/HHr 25-34" },
      { id: "incomebyage.A25I25_CY", label: "2024 HH Inc $25K-34999/HHr 25-34" },
      { id: "incomebyage.A25I35_CY", label: "2024 HH Inc $35K-49999/HHr 25-34" },
      { id: "incomebyage.A25I50_CY", label: "2024 HH Inc $50K-74999/HHr 25-34" },
      { id: "incomebyage.A25I75_CY", label: "2024 HH Inc $75K-99999/HHr 25-34" },
      { id: "incomebyage.A25I100_CY", label: "2024 HH Inc 100K-149999/HHr 25-34" },
      { id: "incomebyage.A25I150_CY", label: "2024 HH Inc 150K-199999/HHr 25-34" },
      { id: "incomebyage.A25I200_CY", label: "2024 HH Inc $200000+/HHr 25-34" },
      { id: "incomebyage.IA25BASECY", label: "2024 HH Income Base: HHr 25-34" },
      
      // Age 35-44 Income
      { id: "incomebyage.A35I0_CY", label: "2024 HH Inc <$15000/HHr 35-44" },
      { id: "incomebyage.A35I15_CY", label: "2024 HH Inc $15K-24999/HHr 35-44" },
      { id: "incomebyage.A35I25_CY", label: "2024 HH Inc $25K-34999/HHr 35-44" },
      { id: "incomebyage.A35I35_CY", label: "2024 HH Inc $35K-49999/HHr 35-44" },
      { id: "incomebyage.A35I50_CY", label: "2024 HH Inc $50K-74999/HHr 35-44" },
      { id: "incomebyage.A35I75_CY", label: "2024 HH Inc $75K-99999/HHr 35-44" },
      { id: "incomebyage.A35I100_CY", label: "2024 HH Inc 100K-149999/HHr 35-44" },
      { id: "incomebyage.A35I150_CY", label: "2024 HH Inc 150K-199999/HHr 35-44" },
      { id: "incomebyage.A35I200_CY", label: "2024 HH Inc $200000+/HHr 35-44" },
      { id: "incomebyage.IA35BASECY", label: "2024 HH Income Base: HHr 35-44" },
      
      // Age 45-54 Income
      { id: "incomebyage.A45I0_CY", label: "2024 HH Inc <$15000/HHr 45-54" },
      { id: "incomebyage.A45I15_CY", label: "2024 HH Inc $15K-24999/HHr 45-54" },
      { id: "incomebyage.A45I25_CY", label: "2024 HH Inc $25K-34999/HHr 45-54" },
      { id: "incomebyage.A45I35_CY", label: "2024 HH Inc $35K-49999/HHr 45-54" },
      { id: "incomebyage.A45I50_CY", label: "2024 HH Inc $50K-74999/HHr 45-54" },
      { id: "incomebyage.A45I75_CY", label: "2024 HH Inc $75K-99999/HHr 45-54" },
      { id: "incomebyage.A45I100_CY", label: "2024 HH Inc 100K-149999/HHr 45-54" },
      { id: "incomebyage.A45I150_CY", label: "2024 HH Inc 150K-199999/HHr 45-54" },
      { id: "incomebyage.A45I200_CY", label: "2024 HH Inc $200000+/HHr 45-54" },
      { id: "incomebyage.IA45BASECY", label: "2024 HH Income Base: HHr 45-54" },
      // Other Age Group Income Bases
      { id: "incomebyage.IA55BASECY", label: "2024 HH Income Base: HHr 55-64" },
      { id: "incomebyage.IA65BASECY", label: "2024 HH Income Base: HHr 65-74" },
      { id: "incomebyage.IA75BASECY", label: "2024 HH Income Base: HHr 75+" },

      // Current Year Net Worth
      { id: "networth.NW0_CY", label: "2024 Net Worth <$15000" },
      { id: "networth.NW15_CY", label: "2024 Net Worth $15000-$34999" },
      { id: "networth.NW35_CY", label: "2024 Net Worth $35000-$49999" },
      { id: "networth.NW50_CY", label: "2024 Net Worth $50000-$74999" },
      { id: "networth.NW75_CY", label: "2024 Net Worth $75000-$99999" },
      { id: "networth.NW100_CY", label: "2024 Net Worth $100000-$149999" },
      { id: "networth.NW150_CY", label: "2024 Net Worth $150000-$249999" },
      { id: "networth.NW250_CY", label: "2024 Net Worth $250000-$499999" },
      { id: "networth.NW500_CY", label: "2024 Net Worth $500000-$999999" },
      { id: "networth.NW1M_CY", label: "2024 Net Worth $1000000-$1499999" },
      { id: "networth.NW1PT5M_CY", label: "2024 Net Worth $1500000-$1999999" },
      { id: "networth.NW2M_CY", label: "2024 Net Worth $2000000+" },
      { id: "networth.MEDNW_CY", label: "2024 Median Net Worth" },
      { id: "networth.AVGNW_CY", label: "2024 Average Net Worth" },

      // Current Year Housing
      { id: "KeyUSFacts.TOTHU_CY", label: "2024 Total Housing Units" },
      { id: "KeyUSFacts.OWNER_CY", label: "2024 Owner Occupied HUs" },
      { id: "KeyUSFacts.RENTER_CY", label: "2024 Renter Occupied HUs" },
      { id: "KeyUSFacts.VACANT_CY", label: "2024 Vacant Housing Units" },

      // Future Year Population
      { id: "KeyUSFacts.TOTPOP_FY", label: "2029 Total Population" },
      { id: "KeyUSFacts.TOTHH_FY", label: "2029 Total Households" },
      { id: "householdtotals.AVGHHSZ_FY", label: "2029 Average Household Size" },

      // Future Year Population by Age
      { id: "5yearincrements.POP0_FY", label: "2029 Population Age 0-4" },
      { id: "5yearincrements.POP5_FY", label: "2029 Population Age 5-9" },
      { id: "5yearincrements.POP10_FY", label: "2029 Population Age 10-14" },
      { id: "5yearincrements.POP15_FY", label: "2029 Population Age 15-19" },
      { id: "5yearincrements.POP20_FY", label: "2029 Population Age 20-24" },
      { id: "5yearincrements.POP25_FY", label: "2029 Population Age 25-29" },
      { id: "5yearincrements.POP30_FY", label: "2029 Population Age 30-34" },
      { id: "5yearincrements.POP35_FY", label: "2029 Population Age 35-39" },
      { id: "5yearincrements.POP40_FY", label: "2029 Population Age 40-44" },
      { id: "5yearincrements.POP45_FY", label: "2029 Population Age 45-49" },
      { id: "5yearincrements.POP50_FY", label: "2029 Population Age 50-54" },
      { id: "5yearincrements.POP55_FY", label: "2029 Population Age 55-59" },
      { id: "5yearincrements.POP60_FY", label: "2029 Population Age 60-64" },
      { id: "5yearincrements.POP65_FY", label: "2029 Population Age 65-69" },
      { id: "5yearincrements.POP70_FY", label: "2029 Population Age 70-74" },
      { id: "5yearincrements.POP75_FY", label: "2029 Population Age 75-79" },
      { id: "5yearincrements.POP80_FY", label: "2029 Population Age 80-84" },
      { id: "5yearincrements.POP85_FY", label: "2029 Population Age 85+" },
      { id: "5yearincrements.MEDAGE_FY", label: "2029 Median Age" },
      
      // Future Year Household Income
      { id: "householdincome.HINC0_FY", label: "2029 HH Income <$15000" },
      { id: "householdincome.HINC15_FY", label: "2029 HH Income $15000-24999" },
      { id: "householdincome.HINC25_FY", label: "2029 HH Income $25000-34999" },
      { id: "householdincome.HINC35_FY", label: "2029 HH Income $35000-49999" },
      { id: "householdincome.HINC50_FY", label: "2029 HH Income $50000-74999" },
      { id: "householdincome.HINC75_FY", label: "2029 HH Income $75000-99999" },
      { id: "householdincome.HINC100_FY", label: "2029 HH Income $100000-149999" },
      { id: "householdincome.HINC150_FY", label: "2029 HH Income $150000-199999" },
      { id: "householdincome.HINC200_FY", label: "2029 HH Income $200000+" },
      { id: "householdincome.MEDHINC_FY", label: "2029 Median Household Income" },
      { id: "householdincome.AVGHINC_FY", label: "2029 Average Household Income" },
      
      // Future Year Housing
      { id: "KeyUSFacts.TOTHU_FY", label: "2029 Total Housing Units" },
      { id: "KeyUSFacts.OWNER_FY", label: "2029 Owner Occupied HUs" },
      { id: "KeyUSFacts.RENTER_FY", label: "2029 Renter Occupied HUs" },
      { id: "KeyUSFacts.VACANT_FY", label: "2029 Vacant Housing Units" },
      
      // Historical (2010) Population
      { id: "HistoricalPopulation.TOTPOP10", label: "2010 Total Population" },
      { id: "HistoricalPopulation.TOTHH10", label: "2010 Total Households" },
      { id: "5yearincrements.POP0C10", label: "2010 Population Age 0-4" },
      { id: "5yearincrements.POP5C10", label: "2010 Population Age 5-9" },
      { id: "5yearincrements.POP10C10", label: "2010 Population Age 10-14" },
      { id: "5yearincrements.POP15C10", label: "2010 Population Age 15-19" },
      { id: "5yearincrements.POP20C10", label: "2010 Population Age 20-24" },
      { id: "5yearincrements.POP25C10", label: "2010 Population Age 25-29" },
      { id: "5yearincrements.POP30C10", label: "2010 Population Age 30-34" },
      { id: "5yearincrements.POP35C10", label: "2010 Population Age 35-39" },
      { id: "5yearincrements.POP40C10", label: "2010 Population Age 40-44" },
      { id: "5yearincrements.POP45C10", label: "2010 Population Age 45-49" },
      { id: "5yearincrements.POP50C10", label: "2010 Population Age 50-54" },
      { id: "5yearincrements.POP55C10", label: "2010 Population Age 55-59" },
      { id: "5yearincrements.POP60C10", label: "2010 Population Age 60-64" },
      { id: "5yearincrements.POP65C10", label: "2010 Population Age 65-69" },
      { id: "5yearincrements.POP70C10", label: "2010 Population Age 70-74" },
      { id: "5yearincrements.POP75C10", label: "2010 Population Age 75-79" },
      { id: "5yearincrements.POP80C10", label: "2010 Population Age 80-84" },
      { id: "5yearincrements.POP85C10", label: "2010 Population Age 85+" },
      { id: "5yearincrements.MEDAGE10", label: "2010 Median Age" },
      
      // Historical (2010) Households
      { id: "householdsbysize.FAM2PERS10", label: "2010 Family HHs: 2-Person" },
      { id: "householdsbysize.NF1PERS10", label: "2010 Nonfamily HHs: 1-Person" },
      { id: "householdsbysize.NF2PERS10", label: "2010 Nonfamily HHs: 2-Person" },
      
      // Tapestry Segments
      { id: "tapestryhouseholdsNEW.THH01", label: "2024 HHs in Tapestry Seg 1A" },
      { id: "tapestryhouseholdsNEW.THH02", label: "2024 HHs in Tapestry Seg 1B" },
      { id: "tapestryhouseholdsNEW.THH03", label: "2024 HHs in Tapestry Seg 1C" },
      { id: "tapestryhouseholdsNEW.THH04", label: "2024 HHs in Tapestry Seg 1D" },
      { id: "tapestryhouseholdsNEW.THH05", label: "2024 HHs in Tapestry Seg 1E" },
      { id: "tapestryhouseholdsNEW.THH06", label: "2024 HHs in Tapestry Seg 2A" },
      { id: "tapestryhouseholdsNEW.THH07", label: "2024 HHs in Tapestry Seg 2B" },
      { id: "tapestryhouseholdsNEW.THH08", label: "2024 HHs in Tapestry Seg 2C" },
      { id: "tapestryhouseholdsNEW.THH09", label: "2024 HHs in Tapestry Seg 2D" },
      { id: "tapestryhouseholdsNEW.THH10", label: "2024 HHs in Tapestry Seg 3A" },
      { id: "tapestryhouseholdsNEW.THH11", label: "2024 HHs in Tapestry Seg 3B" },
      { id: "tapestryhouseholdsNEW.THH12", label: "2024 HHs in Tapestry Seg 3C" },
      { id: "tapestryhouseholdsNEW.THH13", label: "2024 HHs in Tapestry Seg 4A" },
      { id: "tapestryhouseholdsNEW.THH14", label: "2024 HHs in Tapestry Seg 4B" },
      { id: "tapestryhouseholdsNEW.THH15", label: "2024 HHs in Tapestry Seg 4C" },
      { id: "tapestryhouseholdsNEW.THH16", label: "2024 HHs in Tapestry Seg 5A" },
      { id: "tapestryhouseholdsNEW.THH17", label: "2024 HHs in Tapestry Seg 5B" },
      { id: "tapestryhouseholdsNEW.THH18", label: "2024 HHs in Tapestry Seg 5C" },
      { id: "tapestryhouseholdsNEW.THH19", label: "2024 HHs in Tapestry Seg 5D" },
      { id: "tapestryhouseholdsNEW.THH20", label: "2024 HHs in Tapestry Seg 5E" },
      { id: "tapestryhouseholdsNEW.THH21", label: "2024 HHs in Tapestry Seg 6A" },
      { id: "tapestryhouseholdsNEW.THH22", label: "2024 HHs in Tapestry Seg 6B" },
      { id: "tapestryhouseholdsNEW.THH23", label: "2024 HHs in Tapestry Seg 6C" },
      { id: "tapestryhouseholdsNEW.THH24", label: "2024 HHs in Tapestry Seg 6D" },
      { id: "tapestryhouseholdsNEW.THH25", label: "2024 HHs in Tapestry Seg 6E" },
      { id: "tapestryhouseholdsNEW.THH26", label: "2024 HHs in Tapestry Seg 6F" },
      { id: "tapestryhouseholdsNEW.THH27", label: "2024 HHs in Tapestry Seg 7A" },
      { id: "tapestryhouseholdsNEW.THH28", label: "2024 HHs in Tapestry Seg 7B" },
      { id: "tapestryhouseholdsNEW.THH29", label: "2024 HHs in Tapestry Seg 7C" },
      { id: "tapestryhouseholdsNEW.THH30", label: "2024 HHs in Tapestry Seg 7D" },
      { id: "tapestryhouseholdsNEW.THH31", label: "2024 HHs in Tapestry Seg 7E" },
      { id: "tapestryhouseholdsNEW.THH32", label: "2024 HHs in Tapestry Seg 7F" },
      { id: "tapestryhouseholdsNEW.THH33", label: "2024 HHs in Tapestry Seg 8A" },
      { id: "tapestryhouseholdsNEW.THH34", label: "2024 HHs in Tapestry Seg 8B" },
      { id: "tapestryhouseholdsNEW.THH35", label: "2024 HHs in Tapestry Seg 8C" },
      { id: "tapestryhouseholdsNEW.THH36", label: "2024 HHs in Tapestry Seg 8D" },
      { id: "tapestryhouseholdsNEW.THH37", label: "2024 HHs in Tapestry Seg 8E" },
      { id: "tapestryhouseholdsNEW.THH38", label: "2024 HHs in Tapestry Seg 8F" },
      { id: "tapestryhouseholdsNEW.THH39", label: "2024 HHs in Tapestry Seg 8G" },
      { id: "tapestryhouseholdsNEW.THH40", label: "2024 HHs in Tapestry Seg 9A" },
      { id: "tapestryhouseholdsNEW.THH41", label: "2024 HHs in Tapestry Seg 9B" },
      { id: "tapestryhouseholdsNEW.THH42", label: "2024 HHs in Tapestry Seg 9C" },
      { id: "tapestryhouseholdsNEW.THH43", label: "2024 HHs in Tapestry Seg 9D" },
      { id: "tapestryhouseholdsNEW.THH44", label: "2024 HHs in Tapestry Seg 9E" },
      { id: "tapestryhouseholdsNEW.THH45", label: "2024 HHs in Tapestry Seg 9F" },
      { id: "tapestryhouseholdsNEW.THH46", label: "2024 HHs in Tapestry Seg 10A" },
      { id: "tapestryhouseholdsNEW.THH47", label: "2024 HHs in Tapestry Seg 10B" },
      { id: "tapestryhouseholdsNEW.THH48", label: "2024 HHs in Tapestry Seg 10C" },
      { id: "tapestryhouseholdsNEW.THH49", label: "2024 HHs in Tapestry Seg 10D" },
      { id: "tapestryhouseholdsNEW.THH50", label: "2024 HHs in Tapestry Seg 10E" },
      { id: "tapestryhouseholdsNEW.THH51", label: "2024 HHs in Tapestry Seg 11A" },
      { id: "tapestryhouseholdsNEW.THH52", label: "2024 HHs in Tapestry Seg 11B" },
      { id: "tapestryhouseholdsNEW.THH53", label: "2024 HHs in Tapestry Seg 11C" },
      { id: "tapestryhouseholdsNEW.THH54", label: "2024 HHs in Tapestry Seg 11D" },
      { id: "tapestryhouseholdsNEW.THH55", label: "2024 HHs in Tapestry Seg 11E" },
      { id: "tapestryhouseholdsNEW.THH56", label: "2024 HHs in Tapestry Seg 12A" },
      { id: "tapestryhouseholdsNEW.THH57", label: "2024 HHs in Tapestry Seg 12B" },
      { id: "tapestryhouseholdsNEW.THH58", label: "2024 HHs in Tapestry Seg 12C" },
      { id: "tapestryhouseholdsNEW.THH59", label: "2024 HHs in Tapestry Seg 12D" },
      { id: "tapestryhouseholdsNEW.THH60", label: "2024 HHs in Tapestry Seg 13A" },
      { id: "tapestryhouseholdsNEW.THH61", label: "2024 HHs in Tapestry Seg 13B" },
      { id: "tapestryhouseholdsNEW.THH62", label: "2024 HHs in Tapestry Seg 13C" },
      { id: "tapestryhouseholdsNEW.THH63", label: "2024 HHs in Tapestry Seg 13D" },
      { id: "tapestryhouseholdsNEW.THH64", label: "2024 HHs in Tapestry Seg 13E" },
      { id: "tapestryhouseholdsNEW.THH65", label: "2024 HHs in Tapestry Seg 14A" },
      { id: "tapestryhouseholdsNEW.THH66", label: "2024 HHs in Tapestry Seg 14B" },
      { id: "tapestryhouseholdsNEW.THH67", label: "2024 HHs in Tapestry Seg 14C" },
    ],
  },
};

// Helper functions
export const getAllVariables = () => {
  return analysisCategories.variables.variables.map((v) => v.id);
};

const shortKeyToLabelMap = {};
analysisCategories.variables.variables.forEach((variable) => {
  const shortKey = variable.id.split(".").pop();
  shortKeyToLabelMap[shortKey] = variable.label;
});

export { shortKeyToLabelMap };



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

      // If needed, you can append studyAreasOptions here for buffers if using points.
      // For polygons, typically not needed.

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

  // State row
  csvRows.push([
    "State",
    ...marketAreas.map((ma) => {
      const maType = ma.ma_type?.toLowerCase();
      const firstLocationName = ma.locations?.[0]?.name || "";

      // If we have no location names and it's not a radius, no state info
      if (!firstLocationName && maType !== "radius") return "";

      switch (maType) {
        case "cbsa":
          // Example: "Austin-Round Rock-San Marcos, TX Metro Area"
          {
            const stateAbbrMatch = firstLocationName.match(/,\s*([A-Z]{2})\s+Metro Area/i);
            if (stateAbbrMatch) {
              return enrichmentService.getStateFullName(stateAbbrMatch[1]);
            }
            return "";
          }

        case "county":
          // Example: "Travis County, Texas"
          {
            const stateMatch = firstLocationName.match(/,\s*(\w[\w\s]+)$/);
            if (stateMatch) {
              // If we got a full state name, return it as is or convert if needed.
              // Attempt to get full name from abbreviation, if it's just 2 letters:
              const stateNameOrAbbr = stateMatch[1].trim();
              return enrichmentService.getStateFullName(stateNameOrAbbr);
            }
            return "";
          }

        case "zip":
          // Example: "78702 - Austin, TX"
          {
            const stateAbbrMatch = firstLocationName.match(/,\s*([A-Z]{2})$/i);
            if (stateAbbrMatch) {
              return enrichmentService.getStateFullName(stateAbbrMatch[1]);
            }
            return "";
          }

        case "place":
          // Example: "Austin, City, Texas" or "Austin, Texas"
          {
            const parts = firstLocationName.split(",").map((p) => p.trim());
            if (parts.length > 1) {
              // The last part should be the state or state abbreviation
              const lastPart = parts[parts.length - 1];
              return enrichmentService.getStateFullName(lastPart);
            }
            return "";
          }

        case "state":
          // The location name might be a full state name already
          return enrichmentService.getStateFullName(firstLocationName);

        case "tract":
        case "block":
        case "blockgroup":
          // Often something like "Tract 123, Some County, Texas"
          // We'll assume the last part is a state or state abbreviation
          {
            const parts = firstLocationName.split(",").map((p) => p.trim());
            if (parts.length > 1) {
              const lastPart = parts[parts.length - 1];
              return enrichmentService.getStateFullName(lastPart);
            }
            return "";
          }

        case "md":
          // Similar to CBSA: "Boston-Cambridge-Newton, MA Metro Division"
          {
            const stateAbbrMatch = firstLocationName.match(/,\s*([A-Z]{2})\s+Metro Division/i);
            if (stateAbbrMatch) {
              return enrichmentService.getStateFullName(stateAbbrMatch[1]);
            }
            return "";
          }

        case "radius":
          // Radius-based MAs do not have a direct state reference
          return "";

        case "usa":
          // USA layer covers entire country, no single state
          return "";

        default:
          // If no pattern matches, return blank
          return "";
      }
    }),
  ]);

    csvRows.push([""]); // Blank separator row

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
