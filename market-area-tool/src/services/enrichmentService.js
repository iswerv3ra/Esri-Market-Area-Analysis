import esriConfig from "@arcgis/core/config";
import * as projection from "@arcgis/core/geometry/projection";
import Polygon from "@arcgis/core/geometry/Polygon";
import * as XLSX from 'xlsx/xlsx.mjs';
import api from './api';  // Add this at the top with other imports
import { flipVertical } from "@arcgis/core/geometry/geometryEngine";

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

// Tier 1 USA data rows
const usaDataRowsTier1 = [
  "",
  "",
  "",
  "",
  "",
  "337,363,227",
  "130,230,713",
  "2.53",
  "18,528,357",
  "19,739,212",
  "20,377,078",
  "21,722,665",
  "22,963,389",
  "21,989,996",
  "23,630,977",
  "22,606,112",
  "22,303,992",
  "20,003,271",
  "20,802,123",
  "20,209,023",
  "21,243,426",
  "19,351,281",
  "15,802,502",
  "12,026,469",
  "7,242,221",
  "6,821,133",
  "39.4",
  "163,263,561",
  "11,207,418",
  "8,163,073",
  "8,764,793",
  "13,113,591",
  "20,482,045",
  "16,712,451",
  "22,957,763",
  "12,421,514",
  "16,404,596",
  "79,010",
  "113,025",
  "4,646,590",
  "1,441,329",
  "934,562",
  "1,283,634",
  "1,991,912",
  "3,352,530",
  "2,797,059",
  "3,769,833",
  "1,764,430",
  "1,933,267",
  "19,268,555",
  "1,392,369",
  "826,622",
  "994,992",
  "1,704,948",
  "3,220,255",
  "3,124,335",
  "4,926,730",
  "2,871,923",
  "3,841,486",
  "22,903,660",
  "1,309,623",
  "763,787",
  "907,784",
  "1,648,164",
  "3,119,929",
  "2,804,721",
  "4,747,351",
  "2,772,229",
  "4,058,643",
  "22,132,230",
  "23,667,744",
  "21,236,572",
  "16,371,893",
  "24,341,656",
  "8,010,378",
  "3,031,442",
  "5,509,999",
  "5,381,388",
  "8,481,907",
  "12,703,104",
  "20,245,138",
  "16,708,018",
  "8,369,252",
  "3,481,001",
  "13,963,961",
  "225,822",
  "1,253,256",
  "144,632,401",
  "83,926,905",
  "46,303,809",
  "14,401,688",
  "343,761,788",
  "134,417,874",
  "2.5",
  "18,577,292",
  "18,662,329",
  "19,993,221",
  "20,773,463",
  "22,423,837",
  "23,659,208",
  "22,495,538",
  "23,640,020",
  "22,635,783",
  "22,100,375",
  "19,773,175",
  "20,041,030",
  "19,462,109",
  "20,081,586",
  "17,832,859",
  "13,930,180",
  "9,674,105",
  "8,005,678",
  "40.4",
  "9,939,688",
  "6,471,905",
  "7,452,181",
  "11,631,246",
  "19,511,522",
  "17,139,547",
  "25,941,084",
  "16,114,800",
  "20,212,487",
  "91,365",
  "130,401",
  "149,075,457",
  "88,085,823",
  "46,332,051",
  "14,657,583",
  "0",
  "0",
  "308,162,550",
  "116,441,641",
  "20,146,004",
  "20,302,435",
  "20,632,774",
  "21,981,645",
  "21,500,361",
  "21,001,468",
  "19,876,996",
  "20,108,863",
  "20,827,024",
  "22,643,745",
  "22,236,357",
  "19,608,613",
  "16,769,321",
  "12,399,759",
  "9,252,271",
  "7,297,551",
  "5,726,794",
  "5,476,655",
  "37.1",
  "31,797,478",
  "31,037,135",
  "6,320,574",
  "2,081,323",
  "2,152,524",
  "2,580,904",
  "3,870,718",
  "2,503,844",
  "1,639,189",
  "2,733,888",
  "888,278",
  "1,904,026",
  "1,283,665",
  "2,250,188",
  "1,341,862",
  "4,049,751",
  "2,195,223",
  "4,092,601",
  "3,153,887",
  "2,915,221",
  "2,545,521",
  "2,780,813",
  "3,150,005",
  "4,312,601",
  "3,634,799",
  "2,040,940",
  "1,275,675",
  "1,308,533",
  "2,857,726",
  "3,798,361",
  "1,348,495",
  "1,977,587",
  "1,366,270",
  "311,211",
  "1,020,611",
  "1,852,597",
  "1,851,755",
  "3,031,701",
  "818,195",
  "2,054,374",
  "2,978,031",
  "1,519,086",
  "1,062,344",
  "1,700,578",
  "961,380",
  "1,186,778",
  "1,546,248",
  "1,086,244",
  "4,099,449",
  "2,412,528",
  "750,985",
  "1,528,055",
  "1,582,405",
  "959,746",
  "2,313,345",
  "1,891,600",
  "1,803,657",
  "1,119,518",
  "1,318,214",
  "2,432,165",
  "2,321,476",
  "1,587,222",
  "1,596,541",
  "939,322",
  "1,034,833",
  "845,589",
  "629,212",
  "188,219",
  "1,221,924",
  "634,665"
];

// Tier 2 USA data rows
const usaDataRowsTier2 = [
  "",
  "",
  "",
  "",
  "",
  "3,533,478",
  "3,598,283",
  "3,695,092",
  "3,767,864",
  "3,833,710",
  "3,856,963",
  "3,885,153",
  "3,934,735",
  "3,968,492",
  "3,983,700",
  "4,002,656",
  "4,038,496",
  "4,103,132",
  "4,085,253",
  "4,030,632",
  "4,105,830",
  "4,124,092",
  "4,100,842",
  "4,428,610",
  "4,832,854",
  "4,910,337",
  "4,735,733",
  "4,499,096",
  "4,339,734",
  "4,334,992",
  "4,411,619",
  "4,282,708",
  "4,313,763",
  "4,398,433",
  "4,464,447",
  "4,611,550",
  "4,719,910",
  "4,765,000",
  "4,743,522",
  "4,660,457",
  "4,564,329",
  "4,511,178",
  "4,477,097",
  "4,457,619",
  "4,457,129",
  "4,488,121",
  "4,506,161",
  "4,480,149",
  "4,402,418",
  "4,279,295",
  "4,106,307",
  "3,964,971",
  "3,898,231",
  "3,903,829",
  "3,984,623",
  "4,086,562",
  "4,139,932",
  "4,161,420",
  "4,146,475",
  "4,100,112",
  "4,028,140",
  "3,977,445",
  "3,966,592",
  "3,993,106",
  "4,059,629",
  "4,171,434",
  "4,257,676",
  "4,276,136",
  "4,222,520",
  "4,100,553",
  "4,004,560",
  "3,953,400",
  "3,866,772",
  "3,738,147",
  "3,570,973",
  "3,407,027",
  "3,268,985",
  "3,128,497",
  "2,979,808",
  "2,826,730",
  "2,688,760",
  "2,554,712",
  "2,399,010",
  "2,218,152",
  "2,013,525",
  "1,862,717",
  "1,478,888",
  "1,328,824",
  "1,277,822",
  "1,204,070",
  "3,662,640",
  "3,646,509",
  "3,690,199",
  "3,717,494",
  "3,761,836",
  "3,683,919",
  "3,670,172",
  "3,702,311",
  "3,731,150",
  "3,772,503",
  "3,913,909",
  "3,974,570",
  "4,042,244",
  "4,014,797",
  "3,932,790",
  "3,929,553",
  "3,924,323",
  "3,894,091",
  "4,239,494",
  "4,665,147",
  "4,758,135",
  "4,581,596",
  "4,370,117",
  "4,258,310",
  "4,322,592",
  "4,675,301",
  "4,654,908",
  "4,719,753",
  "4,762,595",
  "4,716,202",
  "4,529,744",
  "4,447,149",
  "4,420,428",
  "4,446,845",
  "4,528,495",
  "4,643,848",
  "4,722,691",
  "4,752,275",
  "4,727,276",
  "4,653,723",
  "4,571,436",
  "4,523,091",
  "4,488,069",
  "4,461,098",
  "4,446,922",
  "4,461,291",
  "4,466,426",
  "4,432,313",
  "4,352,455",
  "4,231,439",
  "4,068,466",
  "3,933,903",
  "3,863,288",
  "3,850,640",
  "3,902,885",
  "3,967,148",
  "3,989,957",
  "3,995,150",
  "3,976,355",
  "3,939,713",
  "3,883,420",
  "3,839,558",
  "3,826,983",
  "3,839,670",
  "3,883,489",
  "3,971,439",
  "4,039,744",
  "4,042,595",
  "3,974,107",
  "3,839,303",
  "3,730,588",
  "3,666,079",
  "3,565,108",
  "3,422,514",
  "3,241,555",
  "3,065,454",
  "2,916,176",
  "2,761,052",
  "2,594,890",
  "2,421,323",
  "2,345,133",
  "1,997,447",
  "1,851,822",
  "1,765,003",
  "1,593,546",
  "52,764,060",
  "9,509,171",
  "40,838,437",
  "21,990,930",
  "52,056,767",
  "33,009,565",
  "232,052,504",
  "4,453,766",
  "18,983,824",
  "23,379,694",
  "22,396,544",
  "22,110,723",
  "22,466,489",
  "19,470,442",
  "45,096",
  "79,583",
  "101,321",
  "103,644",
  "86,893",
  "65,022",
  "45,226",
  "856,411",
  "462,406",
  "491,181",
  "696,611",
  "899,175",
  "565,253",
  "469,133",
  "127,503",
  "81,755",
  "2,118,176",
  "1,282,309",
  "1,267,763",
  "1,994,725",
  "3,506,124",
  "3,060,416",
  "4,297,854",
  "2,506,117",
  "3,632,547",
  "1,998,146",
  "1,634,107",
  "1,733,975",
  "2,700,497",
  "3,721,145",
  "2,771,862",
  "3,168,281",
  "1,537,374",
  "1,966,643",
  "2,086,276",
  "2,252,724",
  "2,078,948",
  "2,369,483",
  "2,658,777",
  "1,586,360",
  "1,580,063",
  "846,468",
  "910,044",
  "13,622",
  "62,208",
  "144,820",
  "262,716",
  "390,845",
  "435,044",
  "353,746",
  "11,358",
  "395,458",
  "2,944,421",
  "4,531,117",
  "7,317,525",
  "6,510,152",
  "4,142,121",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
];

export const analysisCategories = {
  tier1: {
    label: "Core (Tier 1) Variables",
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

      { id: "HistoricalPopulation.TSPOP20_CY", label: "2020 Total Population" },
      { id: "HistoricalHouseholds.TSHH20_CY", label: "2020 Total   Households" },

      // Historical (2010) Population
      { id: "HistoricalPopulation.TSPOP10_CY", label: "2010 Total Population" },
      { id: "HistoricalHouseholds.TSHH10_CY", label: "2010 Total Households" },
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
    ]
  },
  tier2: {
    label: "Tier 2 Variables",
    variables: [
      // Current Year 1-Year Age Increments
      { id: "1yearincrements.AGE0_CY", label: "2024 Population Age <1" },
      { id: "1yearincrements.AGE1_CY", label: "2024 Population Age 1" },
      { id: "1yearincrements.AGE2_CY", label: "2024 Population Age 2" },
      { id: "1yearincrements.AGE3_CY", label: "2024 Population Age 3" },
      { id: "1yearincrements.AGE4_CY", label: "2024 Population Age 4" },
      { id: "1yearincrements.AGE5_CY", label: "2024 Population Age 5" },
      { id: "1yearincrements.AGE6_CY", label: "2024 Population Age 6" },
      { id: "1yearincrements.AGE7_CY", label: "2024 Population Age 7" },
      { id: "1yearincrements.AGE8_CY", label: "2024 Population Age 8" },
      { id: "1yearincrements.AGE9_CY", label: "2024 Population Age 9" },
      { id: "1yearincrements.AGE10_CY", label: "2024 Population Age 10" },
      { id: "1yearincrements.AGE11_CY", label: "2024 Population Age 11" },
      { id: "1yearincrements.AGE12_CY", label: "2024 Population Age 12" },
      { id: "1yearincrements.AGE13_CY", label: "2024 Population Age 13" },
      { id: "1yearincrements.AGE14_CY", label: "2024 Population Age 14" },
      { id: "1yearincrements.AGE15_CY", label: "2024 Population Age 15" },
      { id: "1yearincrements.AGE16_CY", label: "2024 Population Age 16" },
      { id: "1yearincrements.AGE17_CY", label: "2024 Population Age 17" },
      { id: "1yearincrements.AGE18_CY", label: "2024 Population Age 18" },
      { id: "1yearincrements.AGE19_CY", label: "2024 Population Age 19" },
      { id: "1yearincrements.AGE20_CY", label: "2024 Population Age 20" },
      { id: "1yearincrements.AGE21_CY", label: "2024 Population Age 21" },
      { id: "1yearincrements.AGE22_CY", label: "2024 Population Age 22" },
      { id: "1yearincrements.AGE23_CY", label: "2024 Population Age 23" },
      { id: "1yearincrements.AGE24_CY", label: "2024 Population Age 24" },
      { id: "1yearincrements.AGE25_CY", label: "2024 Population Age 25" },
      { id: "1yearincrements.AGE26_CY", label: "2024 Population Age 26" },
      { id: "1yearincrements.AGE27_CY", label: "2024 Population Age 27" },
      { id: "1yearincrements.AGE28_CY", label: "2024 Population Age 28" },
      { id: "1yearincrements.AGE29_CY", label: "2024 Population Age 29" },
      { id: "1yearincrements.AGE30_CY", label: "2024 Population Age 30" },
      { id: "1yearincrements.AGE31_CY", label: "2024 Population Age 31" },
      { id: "1yearincrements.AGE32_CY", label: "2024 Population Age 32" },
      { id: "1yearincrements.AGE33_CY", label: "2024 Population Age 33" },
      { id: "1yearincrements.AGE34_CY", label: "2024 Population Age 34" },
      { id: "1yearincrements.AGE35_CY", label: "2024 Population Age 35" },
      { id: "1yearincrements.AGE36_CY", label: "2024 Population Age 36" },
      { id: "1yearincrements.AGE37_CY", label: "2024 Population Age 37" },
      { id: "1yearincrements.AGE38_CY", label: "2024 Population Age 38" },
      { id: "1yearincrements.AGE39_CY", label: "2024 Population Age 39" },
      { id: "1yearincrements.AGE40_CY", label: "2024 Population Age 40" },
      { id: "1yearincrements.AGE41_CY", label: "2024 Population Age 41" },
      { id: "1yearincrements.AGE42_CY", label: "2024 Population Age 42" },
      { id: "1yearincrements.AGE43_CY", label: "2024 Population Age 43" },
      { id: "1yearincrements.AGE44_CY", label: "2024 Population Age 44" },
      { id: "1yearincrements.AGE45_CY", label: "2024 Population Age 45" },
      { id: "1yearincrements.AGE46_CY", label: "2024 Population Age 46" },
      { id: "1yearincrements.AGE47_CY", label: "2024 Population Age 47" },
      { id: "1yearincrements.AGE48_CY", label: "2024 Population Age 48" },
      { id: "1yearincrements.AGE49_CY", label: "2024 Population Age 49" },
      { id: "1yearincrements.AGE50_CY", label: "2024 Population Age 50" },
      { id: "1yearincrements.AGE51_CY", label: "2024 Population Age 51" },
      { id: "1yearincrements.AGE52_CY", label: "2024 Population Age 52" },
      { id: "1yearincrements.AGE53_CY", label: "2024 Population Age 53" },
      { id: "1yearincrements.AGE54_CY", label: "2024 Population Age 54" },
      { id: "1yearincrements.AGE55_CY", label: "2024 Population Age 55" },
      { id: "1yearincrements.AGE56_CY", label: "2024 Population Age 56" },
      { id: "1yearincrements.AGE57_CY", label: "2024 Population Age 57" },
      { id: "1yearincrements.AGE58_CY", label: "2024 Population Age 58" },
      { id: "1yearincrements.AGE59_CY", label: "2024 Population Age 59" },
      { id: "1yearincrements.AGE60_CY", label: "2024 Population Age 60" },
      { id: "1yearincrements.AGE61_CY", label: "2024 Population Age 61" },
      { id: "1yearincrements.AGE62_CY", label: "2024 Population Age 62" },
      { id: "1yearincrements.AGE63_CY", label: "2024 Population Age 63" },
      { id: "1yearincrements.AGE64_CY", label: "2024 Population Age 64" },
      { id: "1yearincrements.AGE65_CY", label: "2024 Population Age 65" },
      { id: "1yearincrements.AGE66_CY", label: "2024 Population Age 66" },
      { id: "1yearincrements.AGE67_CY", label: "2024 Population Age 67" },
      { id: "1yearincrements.AGE68_CY", label: "2024 Population Age 68" },
      { id: "1yearincrements.AGE69_CY", label: "2024 Population Age 69" },
      { id: "1yearincrements.AGE70_CY", label: "2024 Population Age 70" },
      { id: "1yearincrements.AGE71_CY", label: "2024 Population Age 71" },
      { id: "1yearincrements.AGE72_CY", label: "2024 Population Age 72" },
      { id: "1yearincrements.AGE73_CY", label: "2024 Population Age 73" },
      { id: "1yearincrements.AGE74_CY", label: "2024 Population Age 74" },
      { id: "1yearincrements.AGE75_CY", label: "2024 Population Age 75" },
      { id: "1yearincrements.AGE76_CY", label: "2024 Population Age 76" },
      { id: "1yearincrements.AGE77_CY", label: "2024 Population Age 77" },
      { id: "1yearincrements.AGE78_CY", label: "2024 Population Age 78" },
      { id: "1yearincrements.AGE79_CY", label: "2024 Population Age 79" },
      { id: "1yearincrements.AGE80_CY", label: "2024 Population Age 80" },
      { id: "1yearincrements.AGE81_CY", label: "2024 Population Age 81" },
      { id: "1yearincrements.AGE82_CY", label: "2024 Population Age 82" },
      { id: "1yearincrements.AGE83_CY", label: "2024 Population Age 83" },
      { id: "1yearincrements.AGE84_CY", label: "2024 Population Age 84" },

      // Future Year 1-Year Age Increments
      { id: "1yearincrements.AGE0_FY", label: "2029 Population Age <1" },
      { id: "1yearincrements.AGE1_FY", label: "2029 Population Age 1" },
      { id: "1yearincrements.AGE2_FY", label: "2029 Population Age 2" },
      { id: "1yearincrements.AGE3_FY", label: "2029 Population Age 3" },
      { id: "1yearincrements.AGE4_FY", label: "2029 Population Age 4" },
      { id: "1yearincrements.AGE5_FY", label: "2029 Population Age 5" },
      { id: "1yearincrements.AGE6_FY", label: "2029 Population Age 6" },
      { id: "1yearincrements.AGE7_FY", label: "2029 Population Age 7" },
      { id: "1yearincrements.AGE8_FY", label: "2029 Population Age 8" },
      { id: "1yearincrements.AGE9_FY", label: "2029 Population Age 9" },
      { id: "1yearincrements.AGE10_FY", label: "2029 Population Age 10" },
      { id: "1yearincrements.AGE11_FY", label: "2029 Population Age 11" },
      { id: "1yearincrements.AGE12_FY", label: "2029 Population Age 12" },
      { id: "1yearincrements.AGE13_FY", label: "2029 Population Age 13" },
      { id: "1yearincrements.AGE14_FY", label: "2029 Population Age 14" },
      { id: "1yearincrements.AGE15_FY", label: "2029 Population Age 15" },

      { id: "1yearincrements.AGE16_FY", label: "2029 Population Age 16" },
      { id: "1yearincrements.AGE17_FY", label: "2029 Population Age 17" },
      { id: "1yearincrements.AGE18_FY", label: "2029 Population Age 18" },
      { id: "1yearincrements.AGE19_FY", label: "2029 Population Age 19" },
      { id: "1yearincrements.AGE20_FY", label: "2029 Population Age 20" },
      { id: "1yearincrements.AGE21_FY", label: "2029 Population Age 21" },
      { id: "1yearincrements.AGE22_FY", label: "2029 Population Age 22" },
      { id: "1yearincrements.AGE23_FY", label: "2029 Population Age 23" },
      { id: "1yearincrements.AGE24_FY", label: "2029 Population Age 24" },
      { id: "1yearincrements.AGE25_FY", label: "2029 Population Age 25" },
      { id: "1yearincrements.AGE26_FY", label: "2029 Population Age 26" },
      { id: "1yearincrements.AGE27_FY", label: "2029 Population Age 27" },
      { id: "1yearincrements.AGE28_FY", label: "2029 Population Age 28" },
      { id: "1yearincrements.AGE29_FY", label: "2029 Population Age 29" },
      { id: "1yearincrements.AGE30_FY", label: "2029 Population Age 30" },
      { id: "1yearincrements.AGE31_FY", label: "2029 Population Age 31" },
      { id: "1yearincrements.AGE32_FY", label: "2029 Population Age 32" },
      { id: "1yearincrements.AGE33_FY", label: "2029 Population Age 33" },
      { id: "1yearincrements.AGE34_FY", label: "2029 Population Age 34" },
      { id: "1yearincrements.AGE35_FY", label: "2029 Population Age 35" },
      { id: "1yearincrements.AGE36_FY", label: "2029 Population Age 36" },
      { id: "1yearincrements.AGE37_FY", label: "2029 Population Age 37" },
      { id: "1yearincrements.AGE38_FY", label: "2029 Population Age 38" },
      { id: "1yearincrements.AGE39_FY", label: "2029 Population Age 39" },
      { id: "1yearincrements.AGE40_FY", label: "2029 Population Age 40" },
      { id: "1yearincrements.AGE41_FY", label: "2029 Population Age 41" },
      { id: "1yearincrements.AGE42_FY", label: "2029 Population Age 42" },
      { id: "1yearincrements.AGE43_FY", label: "2029 Population Age 43" },
      { id: "1yearincrements.AGE44_FY", label: "2029 Population Age 44" },
      { id: "1yearincrements.AGE45_FY", label: "2029 Population Age 45" },
      { id: "1yearincrements.AGE46_FY", label: "2029 Population Age 46" },
      { id: "1yearincrements.AGE47_FY", label: "2029 Population Age 47" },
      { id: "1yearincrements.AGE48_FY", label: "2029 Population Age 48" },
      { id: "1yearincrements.AGE49_FY", label: "2029 Population Age 49" },
      { id: "1yearincrements.AGE50_FY", label: "2029 Population Age 50" },
      { id: "1yearincrements.AGE51_FY", label: "2029 Population Age 51" },
      { id: "1yearincrements.AGE52_FY", label: "2029 Population Age 52" },
      { id: "1yearincrements.AGE53_FY", label: "2029 Population Age 53" },
      { id: "1yearincrements.AGE54_FY", label: "2029 Population Age 54" },
      { id: "1yearincrements.AGE55_FY", label: "2029 Population Age 55" },
      { id: "1yearincrements.AGE56_FY", label: "2029 Population Age 56" },
      { id: "1yearincrements.AGE57_FY", label: "2029 Population Age 57" },
      { id: "1yearincrements.AGE58_FY", label: "2029 Population Age 58" },
      { id: "1yearincrements.AGE59_FY", label: "2029 Population Age 59" },
      { id: "1yearincrements.AGE60_FY", label: "2029 Population Age 60" },
      { id: "1yearincrements.AGE61_FY", label: "2029 Population Age 61" },
      { id: "1yearincrements.AGE62_FY", label: "2029 Population Age 62" },
      { id: "1yearincrements.AGE63_FY", label: "2029 Population Age 63" },
      { id: "1yearincrements.AGE64_FY", label: "2029 Population Age 64" },
      { id: "1yearincrements.AGE65_FY", label: "2029 Population Age 65" },
      { id: "1yearincrements.AGE66_FY", label: "2029 Population Age 66" },
      { id: "1yearincrements.AGE67_FY", label: "2029 Population Age 67" },
      { id: "1yearincrements.AGE68_FY", label: "2029 Population Age 68" },
      { id: "1yearincrements.AGE69_FY", label: "2029 Population Age 69" },
      { id: "1yearincrements.AGE70_FY", label: "2029 Population Age 70" },
      { id: "1yearincrements.AGE71_FY", label: "2029 Population Age 71" },
      { id: "1yearincrements.AGE72_FY", label: "2029 Population Age 72" },
      { id: "1yearincrements.AGE73_FY", label: "2029 Population Age 73" },
      { id: "1yearincrements.AGE74_FY", label: "2029 Population Age 74" },
      { id: "1yearincrements.AGE75_FY", label: "2029 Population Age 75" },
      { id: "1yearincrements.AGE76_FY", label: "2029 Population Age 76" },
      { id: "1yearincrements.AGE77_FY", label: "2029 Population Age 77" },
      { id: "1yearincrements.AGE78_FY", label: "2029 Population Age 78" },
      { id: "1yearincrements.AGE79_FY", label: "2029 Population Age 79" },
      { id: "1yearincrements.AGE80_FY", label: "2029 Population Age 80" },
      { id: "1yearincrements.AGE81_FY", label: "2029 Population Age 81" },
      { id: "1yearincrements.AGE82_FY", label: "2029 Population Age 82" },
      { id: "1yearincrements.AGE83_FY", label: "2029 Population Age 83" },
      { id: "1yearincrements.AGE84_FY", label: "2029 Population Age 84" },

      // Educational Attainment
      { id: "educationalattainment.HSGRAD_CY", label: "2024 Pop Age 25+: High School Diploma" },
      { id: "educationalattainment.GED_CY", label: "2024 Pop Age 25+: GED" },
      { id: "educationalattainment.SMCOLL_CY", label: "2024 Pop Age 25+: Some College/No Degree" },
      { id: "educationalattainment.ASSCDEG_CY", label: "2024 Pop Age 25+: Associate's Degree" },
      { id: "educationalattainment.BACHDEG_CY", label: "2024 Pop Age 25+: Bachelor's Degree" },
      { id: "educationalattainment.GRADDEG_CY", label: "2024 Pop Age 25+: Grad/Professional Degree" },
      { id: "educationalattainment.EDUCBASECY", label: "2024 Educational Attainment Base" },

      // Future Year Income Base by Age
      { id: "incomebyage.IA15BASEFY", label: "2029 HH Income Base: HHr 15-24" },
      { id: "incomebyage.IA25BASEFY", label: "2029 HH Income Base: HHr 25-34" },
      { id: "incomebyage.IA35BASEFY", label: "2029 HH Income Base: HHr 35-44" },
      { id: "incomebyage.IA45BASEFY", label: "2029 HH Income Base: HHr 45-54" },
      { id: "incomebyage.IA55BASEFY", label: "2029 HH Income Base: HHr 55-64" },
      { id: "incomebyage.IA65BASEFY", label: "2029 HH Income Base: HHr 65-74" },
      { id: "incomebyage.IA75BASEFY", label: "2029 HH Income Base: HHr 75+" },

      { id: "incomebyage.MEDIA15_CY", label: "2024 Median HH Inc: HHr 15-24" },
      { id: "incomebyage.MEDIA25_CY", label: "2024 Median HH Inc: HHr 25-34" },
      { id: "incomebyage.MEDIA35_CY", label: "2024 Median HH Inc: HHr 35-44" },
      { id: "incomebyage.MEDIA45_CY", label: "2024 Median HH Inc: HHr 45-54" },
      { id: "incomebyage.MEDIA55_CY", label: "2024 Median HH Inc: HHr 55-64" },
      { id: "incomebyage.MEDIA65_CY", label: "2024 Median HH Inc: HHr 65-74" },
      { id: "incomebyage.MEDIA75_CY", label: "2024 Median HH Inc: HHr 75+" },


      { id: "incomebyage.A15I0_CY", label: "2024 HH Inc <$15000/HHr 15-24" },
      { id: "incomebyage.A15I15_CY", label: "2024 HH Inc $15K-24999/HHr 15-24" },
      { id: "incomebyage.A15I25_CY", label: "2024 HH Inc $25K-34999/HHr 15-24" },
      { id: "incomebyage.A15I35_CY", label: "2024 HH Inc $35K-49999/HHr 15-24" },
      { id: "incomebyage.A15I50_CY", label: "2024 HH Inc $50K-74999/HHr 15-24" },
      { id: "incomebyage.A15I75_CY", label: "2024 HH Inc $75K-99999/HHr 15-24" },
      { id: "incomebyage.A15I100_CY", label: "2024 HH Inc 100K-149999/HHr 15-24" },
      { id: "incomebyage.A15I150_CY", label: "2024 HH Inc 150K-199999/HHr 15-24" },
      { id: "incomebyage.A15I200_CY", label: "2024 HH Inc $200000+/HHr 15-24" },
      { id: "incomebyage.A55I0_CY", label: "2024 HH Inc <$15000/HHr 55-64" },
      { id: "incomebyage.A55I15_CY", label: "2024 HH Inc $15K-24999/HHr 55-64" },
      { id: "incomebyage.A55I25_CY", label: "2024 HH Inc $25K-34999/HHr 55-64" },
      { id: "incomebyage.A55I35_CY", label: "2024 HH Inc $35K-49999/HHr 55-64" },
      { id: "incomebyage.A55I50_CY", label: "2024 HH Inc $50K-74999/HHr 55-64" },
      { id: "incomebyage.A55I75_CY", label: "2024 HH Inc $75K-99999/HHr 55-64" },
      { id: "incomebyage.A55I100_CY", label: "2024 HH Inc 100K-149999/HHr 55-64" },
      { id: "incomebyage.A55I150_CY", label: "2024 HH Inc 150K-199999/HHr 55-64" },
      { id: "incomebyage.A55I200_CY", label: "2024 HH Inc $200000+/HHr 55-64" },
      { id: "incomebyage.A65I0_CY", label: "2024 HH Inc <$15000/HHr 65-74" },
      { id: "incomebyage.A65I15_CY", label: "2024 HH Inc $15K-24999/HHr 65-74" },
      { id: "incomebyage.A65I25_CY", label: "2024 HH Inc $25K-34999/HHr 65-74" },
      { id: "incomebyage.A65I35_CY", label: "2024 HH Inc $35K-49999/HHr 65-74" },
      { id: "incomebyage.A65I50_CY", label: "2024 HH Inc $50K-74999/HHr 65-74" },
      { id: "incomebyage.A65I75_CY", label: "2024 HH Inc $75K-99999/HHr 65-74" },
      { id: "incomebyage.A65I100_CY", label: "2024 HH Inc 100K-149999/HHr 65-74" },
      { id: "incomebyage.A65I150_CY", label: "2024 HH Inc 150K-199999/HHr 65-74" },
      { id: "incomebyage.A65I200_CY", label: "2024 HH Inc $200000+/HHr 65-74" },
      { id: "incomebyage.A75I0_CY", label: "2024 HH Inc <$15000/HHr 75+" },
      { id: "incomebyage.A75I15_CY", label: "2024 HH Inc $15K-24999/HHr 75+" },
      { id: "incomebyage.A75I25_CY", label: "2024 HH Inc $25K-34999/HHr 75+" },
      { id: "incomebyage.A75I35_CY", label: "2024 HH Inc $35K-49999/HHr 75+" },
      { id: "incomebyage.A75I50_CY", label: "2024 HH Inc $50K-74999/HHr 75+" },
      { id: "incomebyage.A75I75_CY", label: "2024 HH Inc $75K-99999/HHr 75+" },
      { id: "incomebyage.A75I100_CY", label: "2024 HH Inc 100K-149999/HHr 75+" },
      { id: "incomebyage.A75I150_CY", label: "2024 HH Inc 150K-199999/HHr 75+" },
      { id: "incomebyage.A75I200_CY", label: "2024 HH Inc $200000+/HHr 75+" },
      { id: "networth.MEDNWA15CY", label: "2024 Median Net Worth: HHr 15-24" },
      { id: "networth.MEDNWA25CY", label: "2024 Median Net Worth: HHr 25-34" },
      { id: "networth.MEDNWA35CY", label: "2024 Median Net Worth: HHr 35-44" },
      { id: "networth.MEDNWA45CY", label: "2024 Median Net Worth: HHr 45-54" },
      { id: "networth.MEDNWA55CY", label: "2024 Median Net Worth: HHr 55-64" },
      { id: "networth.MEDNWA65CY", label: "2024 Median Net Worth: HHr 65-74" },
      { id: "networth.MEDNWA75CY", label: "2024 Median Net Worth: HHr 75+" },
      { id: "networth.A15NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 15-24" },
      { id: "networth.A25NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 25-34" },
      { id: "networth.A35NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 35-44" },
      { id: "networth.A45NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 45-54" },
      { id: "networth.A55NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 55-64" },
      { id: "networth.A65NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 65-74" },
      { id: "networth.A75NW1M_CY", label: "2024 HH Net Worth $1000000+/HHr 75+" },

      // Age 15-24 Income Brackets
      { id: "incomebyage.A15I0_FY", label: "2029 HH Inc <$15000/HHr 15-24" },
      { id: "incomebyage.A15I15_FY", label: "2029 HH Inc $15K-24999/HHr 15-24" },
      { id: "incomebyage.A15I25_FY", label: "2029 HH Inc $25K-34999/HHr 15-24" },
      { id: "incomebyage.A15I35_FY", label: "2029 HH Inc $35K-49999/HHr 15-24" },
      { id: "incomebyage.A15I50_FY", label: "2029 HH Inc $50K-74999/HHr 15-24" },
      { id: "incomebyage.A15I75_FY", label: "2029 HH Inc $75K-99999/HHr 15-24" },
      { id: "incomebyage.A15I100_FY", label: "2029 HH Inc 100K-149999/HHr 15-24" },
      { id: "incomebyage.A15I150_FY", label: "2029 HH Inc 150K-199999/HHr 15-24" },
      { id: "incomebyage.A15I200_FY", label: "2029 HH Inc $200000+/HHr 15-24" },

      // Age 25-34 Income Brackets
      { id: "incomebyage.A25I0_FY", label: "2029 HH Inc <$15000/HHr 25-34" },
      { id: "incomebyage.A25I15_FY", label: "2029 HH Inc $15K-24999/HHr 25-34" },
      { id: "incomebyage.A25I25_FY", label: "2029 HH Inc $25K-34999/HHr 25-34" },
      { id: "incomebyage.A25I35_FY", label: "2029 HH Inc $35K-49999/HHr 25-34" },
      { id: "incomebyage.A25I50_FY", label: "2029 HH Inc $50K-74999/HHr 25-34" },
      { id: "incomebyage.A25I75_FY", label: "2029 HH Inc $75K-99999/HHr 25-34" },
      { id: "incomebyage.A25I100_FY", label: "2029 HH Inc 100K-149999/HHr 25-34" },
      { id: "incomebyage.A25I150_FY", label: "2029 HH Inc 150K-199999/HHr 25-34" },
      { id: "incomebyage.A25I200_FY", label: "2029 HH Inc $200000+/HHr 25-34" },

      // Age 35-44 Income Brackets
      { id: "incomebyage.A35I0_FY", label: "2029 HH Inc <$15000/HHr 35-44" },
      { id: "incomebyage.A35I15_FY", label: "2029 HH Inc $15K-24999/HHr 35-44" },
      { id: "incomebyage.A35I25_FY", label: "2029 HH Inc $25K-34999/HHr 35-44" },
      { id: "incomebyage.A35I35_FY", label: "2029 HH Inc $35K-49999/HHr 35-44" },
      { id: "incomebyage.A35I50_FY", label: "2029 HH Inc $50K-74999/HHr 35-44" },
      { id: "incomebyage.A35I75_FY", label: "2029 HH Inc $75K-99999/HHr 35-44" },
      { id: "incomebyage.A35I100_FY", label: "2029 HH Inc 100K-149999/HHr 35-44" },
      { id: "incomebyage.A35I150_FY", label: "2029 HH Inc 150K-199999/HHr 35-44" },
      { id: "incomebyage.A35I200_FY", label: "2029 HH Inc $200000+/HHr 35-44" },

      // Age 45-54 Income Brackets
      { id: "incomebyage.A45I0_FY", label: "2029 HH Inc <$15000/HHr 45-54" },
      { id: "incomebyage.A45I15_FY", label: "2029 HH Inc $15K-24999/HHr 45-54" },
      { id: "incomebyage.A45I25_FY", label: "2029 HH Inc $25K-34999/HHr 45-54" },
      { id: "incomebyage.A45I35_FY", label: "2029 HH Inc $35K-49999/HHr 45-54" },
      { id: "incomebyage.A45I50_FY", label: "2029 HH Inc $50K-74999/HHr 45-54" },
      { id: "incomebyage.A45I75_FY", label: "2029 HH Inc $75K-99999/HHr 45-54" },
      { id: "incomebyage.A45I100_FY", label: "2029 HH Inc 100K-149999/HHr 45-54" },
      { id: "incomebyage.A45I150_FY", label: "2029 HH Inc 150K-199999/HHr 45-54" },
      { id: "incomebyage.A45I200_FY", label: "2029 HH Inc $200000+/HHr 45-54" },

      // Age 55-64 Income Brackets
      { id: "incomebyage.A55I0_FY", label: "2029 HH Inc <$15000/HHr 55-64" },
      { id: "incomebyage.A55I15_FY", label: "2029 HH Inc $15K-24999/HHr 55-64" },
      { id: "incomebyage.A55I25_FY", label: "2029 HH Inc $25K-34999/HHr 55-64" },
      { id: "incomebyage.A55I35_FY", label: "2029 HH Inc $35K-49999/HHr 55-64" },
      { id: "incomebyage.A55I50_FY", label: "2029 HH Inc $50K-74999/HHr 55-64" },
      { id: "incomebyage.A55I75_FY", label: "2029 HH Inc $75K-99999/HHr 55-64" },
      { id: "incomebyage.A55I100_FY", label: "2029 HH Inc 100K-149999/HHr 55-64" },
      { id: "incomebyage.A55I150_FY", label: "2029 HH Inc 150K-199999/HHr 55-64" },
      { id: "incomebyage.A55I200_FY", label: "2029 HH Inc $200000+/HHr 55-64" },

      // Age 65-74 Income Brackets
      { id: "incomebyage.A65I0_FY", label: "2029 HH Inc <$15000/HHr 65-74" },
      { id: "incomebyage.A65I15_FY", label: "2029 HH Inc $15K-24999/HHr 65-74" },
      { id: "incomebyage.A65I25_FY", label: "2029 HH Inc $25K-34999/HHr 65-74" },
      { id: "incomebyage.A65I35_FY", label: "2029 HH Inc $35K-49999/HHr 65-74" },
      { id: "incomebyage.A65I50_FY", label: "2029 HH Inc $50K-74999/HHr 65-74" },
      { id: "incomebyage.A65I75_FY", label: "2029 HH Inc $75K-99999/HHr 65-74" },
      { id: "incomebyage.A65I100_FY", label: "2029 HH Inc 100K-149999/HHr 65-74" },
      { id: "incomebyage.A65I150_FY", label: "2029 HH Inc 150K-199999/HHr 65-74" },
      { id: "incomebyage.A65I200_FY", label: "2029 HH Inc $200000+/HHr 65-74" },

      // Age 75+ Income Brackets
      { id: "incomebyage.A75I0_FY", label: "2029 HH Inc <$15000/HHr 75+" },
      { id: "incomebyage.A75I15_FY", label: "2029 HH Inc $15K-24999/HHr 75+" },
      { id: "incomebyage.A75I25_FY", label: "2029 HH Inc $25K-34999/HHr 75+" },
      { id: "incomebyage.A75I35_FY", label: "2029 HH Inc $35K-49999/HHr 75+" },
      { id: "incomebyage.A75I50_FY", label: "2029 HH Inc $50K-74999/HHr 75+" },
      { id: "incomebyage.A75I75_FY", label: "2029 HH Inc $75K-99999/HHr 75+" },
      { id: "incomebyage.A75I100_FY", label: "2029 HH Inc 100K-149999/HHr 75+" },
      { id: "incomebyage.A75I150_FY", label: "2029 HH Inc 150K-199999/HHr 75+" },
      { id: "incomebyage.A75I200_FY", label: "2029 HH Inc $200000+/HHr 75+" },

      { id: "householdsbysize.FAM2PERS10", label: "2010 Family HHs: 2-Person" },
      { id: "householdsbysize.FAM3PERS10", label: "2010 Family HHs: 3-Person" },
      { id: "householdsbysize.FAM4PERS10", label: "2010 Family HHs: 4-Person" },
      { id: "householdsbysize.FAM5PERS10", label: "2010 Family HHs: 5-Person" },
      { id: "householdsbysize.FAM6PERS10", label: "2010 Family HHs: 6-Person" },
      { id: "householdsbysize.FAM7PERS10", label: "2010 Family HHs: 7+-Person" },
      { id: "householdsbysize.NF1PERS10", label: "2010 Nonfamily HHs: 1-Person" },
      { id: "householdsbysize.NF2PERS10", label: "2010 Nonfamily HHs: 2-Person" },
      { id: "householdsbysize.NF3PERS10", label: "2010 Nonfamily HHs: 3-Person" },
      { id: "householdsbysize.NF4PERS10", label: "2010 Nonfamily HHs: 4-Person" },
      { id: "householdsbysize.NF5PERS10", label: "2010 Nonfamily HHs: 5-Person" },
      { id: "householdsbysize.NF6PERS10", label: "2010 Nonfamily HHs: 6-Person" },
      { id: "householdsbysize.NF7PERS10", label: "2010 Nonfamily HHs: 7+-Person" },

      // Income by Age (Average)
      { id: "incomebyage.AVGIA15_CY", label: "2024 Average HH Inc: HHr 15-24" },
      { id: "incomebyage.AVGIA25_CY", label: "2024 Average HH Inc: HHr 25-34" },
      { id: "incomebyage.AVGIA35_CY", label: "2024 Average HH Inc: HHr 35-44" },
      { id: "incomebyage.AVGIA45_CY", label: "2024 Average HH Inc: HHr 45-54" },
      { id: "incomebyage.AVGIA55_CY", label: "2024 Average HH Inc: HHr 55-64" },
      { id: "incomebyage.AVGIA65_CY", label: "2024 Average HH Inc: HHr 65-74" },
      { id: "incomebyage.AVGIA75_CY", label: "2024 Average HH Inc: HHr 75+" },
    ]
  },
  retail: {
    label: "Retail Variables",
    variables: [
      { id: "HousingHousehold.X4043_A", label: "2024 Household Furnishings & Equipment (Average)" },
      { id: "entertainment.X9051_A", label: "2024 Sports/Rec/Exercise Equipment (Average)" },
      { id: "entertainment.X9024_A", label: "2024 Audio (Average)" },
      { id: "entertainment.X9065_A", label: "2024 Reading (Average)" },
      { id: "HousingHousehold.X4063_A", label: "2024 Major Appliances (Average)" },
      { id: "clothing.X5001_A", label: "2024 Apparel & Services (Average)" },
      { id: "clothing.X5002_A", label: "2024 Men`s Apparel (Average)" },
      { id: "clothing.X5016_A", label: "2024 Women`s Apparel (Average)" },
      { id: "clothing.X5032_A", label: "2024 Children`s Apparel (Average)" },
      { id: "clothing.X5063_A", label: "2024 Footwear (Average)" },
      { id: "food.X1131_A", label: "2024 Meals at Restaurants/Other (Average)" },
      { id: "food.X1156_A", label: "2024 Food and Nonalcoholic Beverages at Fast Food (Average)" },
      { id: "food.X1157_A", label: "2024 Food and Nonalcoholic Beverages at Full Service Restaurants (Average)" },
      { id: "food.X1130_A", label: "2024 Food Away from Home (Average)" },
      { id: "food.X2007_A", label: "2024 Alcoholic Beverages Away from Home (Average)" },
      { id: "SpendingTotal.X15001_A", label: "2024 Retail Goods (Average)" },
      { id: "entertainment.X9036_A", label: "2024 Pet Food (Average)" },
      { id: "entertainment.X9037_A", label: "2024 Pets/Pet Supplies/Medicine for Pets (Average)" },
      { id: "entertainment.X9038_A", label: "2024 Pet Services (Average)" },
      { id: "entertainment.X9039_A", label: "2024 Vet Services (Average)" },
      { id: "transportation.X6011_A", label: "2024 Gasoline (Average)" },
      { id: "transportation.X6015_A", label: "2024 Vehicle Maintenance & Repairs (Average)" },
      { id: "HousingHousehold.X4043_I", label: "2024 Household Furnishings & Equipment (Index)" },
      { id: "entertainment.X9051_I", label: "2024 Sports/Rec/Exercise Equipment (Index)" },
      { id: "entertainment.X9024_I", label: "2024 Audio (Index)" },
      { id: "entertainment.X9065_I", label: "2024 Reading (Index)" },
      { id: "HousingHousehold.X4063_I", label: "2024 Major Appliances (Index)" },
      { id: "clothing.X5001_I", label: "2024 Apparel & Services (Index)" },
      { id: "clothing.X5002_I", label: "2024 Men`s Apparel (Index)" },
      { id: "clothing.X5016_I", label: "2024 Women`s Apparel (Index)" },
      { id: "clothing.X5032_I", label: "2024 Children`s Apparel (Index)" },
      { id: "clothing.X5063_I", label: "2024 Footwear (Index)" },
      { id: "food.X1131_I", label: "2024 Meals at Restaurants/Other (Index)" },
      { id: "food.X1156_I", label: "2024 Food and Nonalcoholic Beverages at Fast Food (Index)" },
      { id: "food.X1157_I", label: "2024 Food and Nonalcoholic Beverages at Full Service Restaurants (Index)" },
      { id: "food.X1130_I", label: "2024 Food Away from Home (Index)" },
      { id: "food.X2007_I", label: "2024 Alcoholic Beverages Away from Home (Index)" },
      { id: "SpendingTotal.X15001_I", label: "2024 Retail Goods (Index)" },
      { id: "entertainment.X9036_I", label: "2024 Pet Food (Index)" },
      { id: "entertainment.X9037_I", label: "2024 Pets/Pet Supplies/Medicine for Pets (Index)" },
      { id: "entertainment.X9038_I", label: "2024 Pet Services (Index)" },
      { id: "entertainment.X9039_I", label: "2024 Vet Services (Index)" },
      { id: "transportation.X6011_I", label: "2024 Gasoline (Index)" },
      { id: "transportation.X6015_I", label: "2024 Vehicle Maintenance & Repairs (Index)" },
      { id: "HousingHousehold.X4043FY_A", label: "2029 Household Furnishings & Equipment (Average)" },
      { id: "entertainment.X9051FY_A", label: "2029 Sports/Rec/Exercise Equipment (Average)" },
      { id: "entertainment.X9024FY_A", label: "2029 Audio (Average)" },
      { id: "entertainment.X9065FY_A", label: "2029 Reading (Average)" },
      { id: "HousingHousehold.X4063FY_A", label: "2029 Major Appliances (Average)" },
      { id: "clothing.X5001FY_A", label: "2029 Apparel & Services (Average)" },
      { id: "clothing.X5002FY_A", label: "2029 Men`s Apparel (Average)" },
      { id: "clothing.X5016FY_A", label: "2029 Women`s Apparel (Average)" },
      { id: "clothing.X5032FY_A", label: "2029 Children`s Apparel (Average)" },
      { id: "clothing.X5063FY_A", label: "2029 Footwear (Average)" },
      { id: "food.X1131FY_A", label: "2029 Meals at Restaurants/Other (Average)" },
      { id: "food.X1156FY_A", label: "2029 Food and Nonalcoholic Beverages at Fast Food (Average)" },
      { id: "food.X1157FY_A", label: "2029 Food and Nonalcoholic Beverages at Full Service Restaurants (Average)" },
      { id: "food.X1130FY_A", label: "2029 Food Away from Home (Average)" },
      { id: "food.X2007FY_A", label: "2029 Alcoholic Beverages Away from Home (Average)" },
      { id: "SpendingTotal.X15001FY_A", label: "2029 Retail Goods (Average)" },
      { id: "entertainment.X9036FY_A", label: "2029 Pet Food (Average)" },
      { id: "entertainment.X9037FY_A", label: "2029 Pets/Pet Supplies/Medicine for Pets (Average)" },
      { id: "entertainment.X9038FY_A", label: "2029 Pet Services (Average)" },
      { id: "entertainment.X9039FY_A", label: "2029 Vet Services (Average)" },
      { id: "transportation.X6011FY_A", label: "2029 Gasoline (Average)" },
      { id: "transportation.X6015FY_A", label: "2029 Vehicle Maintenance & Repairs (Average)" },
      { id: "HousingHousehold.X4043FY_I", label: "2029 Household Furnishings & Equipment (Index)" },
      { id: "entertainment.X9051FY_I", label: "2029 Sports/Rec/Exercise Equipment (Index)" },
      { id: "entertainment.X9024FY_I", label: "2029 Audio (Index)" },
      { id: "entertainment.X9065FY_I", label: "2029 Reading (Index)" },
      { id: "HousingHousehold.X4063FY_I", label: "2029 Major Appliances (Index)" },
      { id: "clothing.X5001FY_I", label: "2029 Apparel & Services (Index)" },
      { id: "clothing.X5002FY_I", label: "2029 Men`s Apparel (Index)" },
      { id: "clothing.X5016FY_I", label: "2029 Women`s Apparel (Index)" },
      { id: "clothing.X5032FY_I", label: "2029 Children`s Apparel (Index)" },
      { id: "clothing.X5063FY_I", label: "2029 Footwear (Index)" },
      { id: "food.X1131FY_I", label: "2029 Meals at Restaurants/Other (Index)" },
      { id: "food.X1156FY_I", label: "2029 Food and Nonalcoholic Beverages at Fast Food (Index)" },
      { id: "food.X1157FY_I", label: "2029 Food and Nonalcoholic Beverages at Full Service Restaurants (Index)" },
      { id: "food.X1130FY_I", label: "2029 Food Away from Home (Index)" },
      { id: "food.X2007FY_I", label: "2029 Alcoholic Beverages Away from Home (Index)" },
      { id: "SpendingTotal.X15001FY_I", label: "2029 Retail Goods (Index)" },
      { id: "entertainment.X9036FY_I", label: "2029 Pet Food (Index)" },
      { id: "entertainment.X9037FY_I", label: "2029 Pets/Pet Supplies/Medicine for Pets (Index)" },
      { id: "entertainment.X9038FY_I", label: "2029 Pet Services (Index)" },
      { id: "entertainment.X9039FY_I", label: "2029 Vet Services (Index)" },
      { id: "transportation.X6011FY_I", label: "2029 Gasoline (Index)" },
      { id: "transportation.X6015FY_I", label: "2029 Vehicle Maintenance & Repairs (Index)" },
      { id: "shopping.MP31198a_I", label: "2024 Ordered Home Furnishing Online Last 6 Mo (Index)" },
      { id: "shopping.MP31191a_I", label: "2024 Ordered Fitness Apparel/Equipment Online Last 6 Mo (Index)" },
      { id: "shopping.MP31212a_I", label: "2024 Ordered Stereo/Audio Equipment Online Last 6 Mo (Index)" },
      { id: "shopping.MP31176a_I", label: "2024 Ordered Book Online Last 6 Mo (Index)" },
      { id: "shopping.MP31201a_I", label: "2024 Ordered Household/Small Appliance Online Last 6 Mo (Index)" },
      { id: "shopping.MP31181a_I", label: "2024 Ordered Clothing/Apparel Online Last 6 Mo (Index)" },
      { id: "shopping.MP31172a_I", label: "2024 Ordered Automotive Product Online Last 6 Mo (Index)" },
      { id: "shopping.MP31206a_I", label: "2024 Ordered Pet Products/Supplies Online Last 6 Mo (Index)" },
      { id: "PsychographicsShopping.MP28805a_I", label: "2024 OK Buying Items Like Cars/Appliances Online: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28806a_I", label: "2024 OK Buying Items Like Cars/Appliances Online: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28807a_I", label: "2024 OK Buying Items Like Cars/Appliances Online: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28808a_I", label: "2024 OK Buying Items Like Cars/Appliances Online: 4-Agree Completely (Index)" },
      { id: "PsychographicsShopping.MP28809a_I", label: "2024 Only Shop at a Few Online Stores: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28810a_I", label: "2024 Only Shop at a Few Online Stores: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28811a_I", label: "2024 Only Shop at a Few Online Stores: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28812a_I", label: "2024 Only Shop at a Few Online Stores: 4-Agree Completely (Index)" },
      { id: "PsychographicsShopping.MP28833a_I", label: "2024 Research Online Before Buy Locally: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28834a_I", label: "2024 Research Online Before Buy Locally: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28835a_I", label: "2024 Research Online Before Buy Locally: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28836a_I", label: "2024 Research Online Before Buy Locally: 4-Agree Completely (Index)" }
    ]
  }
};

function createVariableLabels(categories) {
  const labels = {};
  Object.values(categories).forEach(category => {
    category.variables.forEach(variable => {
      // Store with full path ID
      labels[variable.id] = variable.label;
      
      // Also store with short key for lookup flexibility
      const shortKey = variable.id.split(".").pop();
      labels[shortKey] = variable.label;
    });
  });
  return labels;
}

// Initialize variable labels once
const variableLabels = createVariableLabels(analysisCategories);

// Helper functions
export const getAllVariables = () => {
  const tier1Vars = analysisCategories.tier1.variables.map(v => v.id);
  const tier2Vars = analysisCategories.tier2.variables.map(v => v.id);
  const retailVars = analysisCategories.retail.variables.map(v => v.id);
  return [...tier1Vars, ...tier2Vars, ...retailVars];
};

export { variableLabels };

export class EnrichmentService {
  constructor() {
    this.clientId = ARCGIS_CLIENT_ID;
    this.clientSecret = ARCGIS_CLIENT_SECRET;
    this.token = null;
    this.tokenExpiration = null;
    this.variableLabels = variableLabels;
  }

  formatNumberValue(value) {
    if (typeof value !== "number") return value;
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }

  formatBigNumberAsText(value) {
    if (!value) return "";
    const numVal = parseFloat(value);
    if (Number.isNaN(numVal)) return value;
    return numVal.toLocaleString("fullwide", {
      useGrouping: false,
      maximumFractionDigits: 0
    });
  }

  getVariableLabel(variableId) {
    // First try to get the full label from our mapping
    if (this.variableLabels[variableId]) {
      return this.variableLabels[variableId];
    }
  
    // If not found with full path, try with just the short key
    const shortKey = variableId.split(".").pop();
    if (this.variableLabels[shortKey]) {
      return this.variableLabels[shortKey];
    }
  
    // Direct lookup in the analysisCategories object
    // This ensures we catch all defined variables, even if the labels mapping wasn't properly initialized
    for (const categoryKey in analysisCategories) {
      const category = analysisCategories[categoryKey];
      for (const variable of category.variables) {
        if (variable.id === variableId || variable.id.endsWith(shortKey)) {
          return variable.label;
        }
      }
    }
  
    // If all else fails, return the shortKey
    return shortKey;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
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
      this.tokenExpiration = Date.now() + (data.expires_in - 60) * 1000;

      return this.token;
    } catch (error) {
      console.error("Token generation failed:", error);
      const maskedId = this.clientId ? `${this.clientId.slice(0, 6)}...` : "not set";
      throw new Error(`Token generation failed. Client ID: ${maskedId}. Error: ${error.message}`);
    }
  }

  async prepareGeometryForEnrichment(marketAreas) {
    await projection.load();

    const expandedAreas = [];
    let areaIndex = 0;

    for (const area of marketAreas) {
      console.log("Processing market area for enrichment:", {
        name: area.name,
        type: area.type || area.ma_type,
        hasRadiusPoints: Boolean(area.radius_points?.length),
        hasDriveTimePoints: Boolean(area.drive_time_points?.length),
        hasLocations: Boolean(area.locations?.length),
      });

      // Check for both area.ma_type and area.type to handle different data structures
      if ((area.ma_type === "radius" || area.type === "radius")) {
        if (area.radius_points?.length > 0) {
          let largestRadiusInfo = { radius: 0, polygon: null };

          for (const point of area.radius_points) {
            console.log("Processing radius point:", JSON.stringify(point, null, 2));

            if (!point.center) {
              console.warn("Radius point has no center:", point);
              continue;
            }

            // Extract coordinates correctly based on available properties
            let centerLon, centerLat;

            // Handle different data structures
            if (point.center.longitude !== undefined && point.center.latitude !== undefined) {
              centerLon = point.center.longitude;
              centerLat = point.center.latitude;
            } else if (point.center.x !== undefined && point.center.y !== undefined) {
              centerLon = point.center.x;
              centerLat = point.center.y;
            } else {
              console.warn("Cannot determine center coordinates from point:", point.center);
              continue;
            }

            // Check if coordinates need to be transformed from Web Mercator to geographic
            const spatialRefWkid = point.center.spatialReference?.wkid ||
              point.center.spatialReference?.latestWkid;

            // CRITICAL FIX: Special handling for lat/long values incorrectly tagged as Web Mercator
            if (spatialRefWkid === 102100 || spatialRefWkid === 3857) {
              // If we have lat/long values with Web Mercator spatial ref
              if (point.center.longitude !== undefined && point.center.latitude !== undefined) {
                // Check if values appear to be latitude/longitude (reasonable range)
                if (Math.abs(centerLat) <= 90 && Math.abs(centerLon) <= 180) {
                  console.log("Detected lat/long values incorrectly tagged as Web Mercator - using directly");
                  // No conversion needed - keep the values as they are
                  console.log("Using coordinates directly:", { longitude: centerLon, latitude: centerLat });
                }
                else {
                  // Normal Web Mercator to geographic conversion for true Web Mercator coordinates
                  try {
                    const { default: Point } = await import("@arcgis/core/geometry/Point");
                    const { webMercatorToGeographic } = await import("@arcgis/core/geometry/support/webMercatorUtils");

                    const webMercatorPoint = new Point({
                      x: centerLon,
                      y: centerLat,
                      spatialReference: {
                        wkid: spatialRefWkid
                      }
                    });

                    const geographicPoint = webMercatorToGeographic(webMercatorPoint);

                    if (geographicPoint) {
                      centerLon = geographicPoint.longitude;
                      centerLat = geographicPoint.latitude;
                      console.log("Converted to geographic coordinates:", {
                        longitude: centerLon,
                        latitude: centerLat
                      });
                    }
                  } catch (error) {
                    console.error("Error converting to geographic coordinates:", error);
                  }
                }
              }
              // x/y coordinates need normal conversion
              else if (point.center.x !== undefined && point.center.y !== undefined) {
                try {
                  const { default: Point } = await import("@arcgis/core/geometry/Point");
                  const { webMercatorToGeographic } = await import("@arcgis/core/geometry/support/webMercatorUtils");

                  const webMercatorPoint = new Point({
                    x: centerLon,
                    y: centerLat,
                    spatialReference: {
                      wkid: spatialRefWkid
                    }
                  });

                  const geographicPoint = webMercatorToGeographic(webMercatorPoint);

                  if (geographicPoint) {
                    centerLon = geographicPoint.longitude;
                    centerLat = geographicPoint.latitude;
                    console.log("Converted Web Mercator x/y to geographic coordinates:", {
                      longitude: centerLon,
                      latitude: centerLat
                    });
                  }
                } catch (error) {
                  console.error("Error converting to geographic coordinates:", error);
                }
              }
            }

            // Skip if we have invalid coordinates
            if (!centerLon || !centerLat ||
              isNaN(centerLon) || isNaN(centerLat) ||
              (centerLon === 0 && centerLat === 0)) {
              console.warn("Invalid center coordinates:", centerLon, centerLat);
              continue;
            }

            console.log("Using center coordinates for enrichment:", { longitude: centerLon, latitude: centerLat });

            // Process each radius
            for (const radiusMiles of (point.radii || [])) {
              console.log(`Processing radius: ${radiusMiles} miles`);

              try {
                // Create a circle polygon directly in geographic coordinates
                const { default: Point } = await import("@arcgis/core/geometry/Point");
                const { geodesicBuffer } = await import("@arcgis/core/geometry/geometryEngine");

                // Create a geographic point
                const geoPoint = new Point({
                  longitude: centerLon,
                  latitude: centerLat,
                  spatialReference: { wkid: 4326 }
                });

                // Create a geodesic buffer (proper circle on Earth's surface)
                const radiusMeters = radiusMiles * 1609.34;
                const bufferPolygon = geodesicBuffer(geoPoint, radiusMeters, "meters");

                if (bufferPolygon && bufferPolygon.rings?.length > 0) {
                  // Log the first few points to verify they're valid
                  console.log(`Created buffer with ${bufferPolygon.rings[0].length} points. First 3:`,
                    JSON.stringify(bufferPolygon.rings[0].slice(0, 3)));

                  if (radiusMiles > largestRadiusInfo.radius) {
                    largestRadiusInfo = {
                      radius: radiusMiles,
                      polygon: bufferPolygon
                    };
                    console.log("Updated largest radius info:", radiusMiles);
                  }
                } else {
                  console.warn("Buffer creation failed for radius:", radiusMiles);
                }
              } catch (error) {
                console.error(`Error creating buffer for radius ${radiusMiles}:`, error);
              }
            }
          }

          if (largestRadiusInfo.polygon) {
            console.log("Using largest radius polygon:", largestRadiusInfo.radius);

            // Add the expanded area with the buffer polygon
            expandedAreas.push({
              geometry: {
                rings: largestRadiusInfo.polygon.rings,
                spatialReference: { wkid: 4326 }, // Ensure WGS84 for the API
              },
              attributes: {
                ObjectID: areaIndex,
                name: area.name || "Radius Area",
                originalAreaName: area.name || "Radius Area",
                radiusMiles: largestRadiusInfo.radius,
              },
              originalIndex: areaIndex,
            });
            areaIndex++;
          } else {
            console.warn(`No valid radius polygon created for market area: ${area.name}`);
          }
        } else {
          console.warn(`No radius_points found for radius MA: ${area.name}`);
        }
      } 
      // NEW CASE: Handle drivetime market areas 
      else if (area.ma_type === "drivetime" || area.type === "drivetime") {
        console.log("Processing drivetime market area:", area.name);
        
        // First check if we have a pre-computed polygon to use directly
        if (area.geometry && area.geometry.rings && area.geometry.rings.length > 0) {
          console.log("Using existing geometry for drivetime area");
          
          try {
            // Make sure the geometry is in the right projection
            const existingPolygon = new Polygon({
              rings: area.geometry.rings,
              spatialReference: area.geometry.spatialReference || { wkid: 3857 }
            });
            
            const projectedGeometry = projection.project(existingPolygon, {
              wkid: 4326
            });
            
            if (projectedGeometry) {
              expandedAreas.push({
                geometry: {
                  rings: projectedGeometry.rings,
                  spatialReference: { wkid: 4326 }
                },
                attributes: {
                  ObjectID: areaIndex,
                  name: area.name || "Drivetime Area",
                  originalAreaName: area.name || "Drivetime Area",
                  driveTimeMinutes: area.drive_time_minutes || 15
                },
                originalIndex: areaIndex
              });
              areaIndex++;
              continue; // Skip to next area since we've added this one
            }
          } catch (error) {
            console.error(`Error projecting existing drivetime geometry: ${error.message}`);
            // Continue to try other methods if this fails
          }
        }
        
        // Check if we have drive time points
        const driveTimePoints = Array.isArray(area.drive_time_points) ? 
          area.drive_time_points : 
          typeof area.drive_time_points === 'string' ? 
            JSON.parse(area.drive_time_points) : 
            [];
            
        if (driveTimePoints.length > 0) {
          console.log(`Found ${driveTimePoints.length} drive time points to process`);
          
          for (const point of driveTimePoints) {
            // Skip points without polygon data - we need the polygon
            if (!point.polygon) {
              console.warn("Skipping drive time point with no polygon:", point);
              continue;
            }
            
            try {
              // Extract the polygon from the point
              const driveTimePolygon = point.polygon;
              
              if (!driveTimePolygon.rings || driveTimePolygon.rings.length === 0) {
                console.warn("Drive time polygon has no rings:", driveTimePolygon);
                continue;
              }
              
              // Convert to Polygon object for projection
              const esriPolygon = new Polygon({
                rings: driveTimePolygon.rings,
                spatialReference: driveTimePolygon.spatialReference || { wkid: 3857 }
              });
              
              const projectedGeometry = projection.project(esriPolygon, {
                wkid: 4326
              });
              
              if (projectedGeometry) {
                // Get the drive time in minutes
                const driveTimeMinutes = point.timeRanges?.[0] || 
                  point.travelTimeMinutes || 
                  area.drive_time_minutes || 
                  15;
                  
                expandedAreas.push({
                  geometry: {
                    rings: projectedGeometry.rings,
                    spatialReference: { wkid: 4326 }
                  },
                  attributes: {
                    ObjectID: areaIndex,
                    name: area.name || "Drivetime Area",
                    originalAreaName: area.name || "Drivetime Area", 
                    driveTimeMinutes
                  },
                  originalIndex: areaIndex
                });
                areaIndex++;
                break; // Use only the first valid drive time polygon
              }
            } catch (error) {
              console.error(`Error processing drive time point:`, error);
            }
          }
        } else {
          console.warn(`No drive_time_points found for drivetime MA: ${area.name}`);
        }
      }
      else {
        // Enhanced processing for non-radius areas (states, counties, etc.)
        console.log(`Processing ${area.ma_type || area.type} area: ${area.name}`);
        
        const allRings = area.locations?.flatMap((loc) => loc.geometry?.rings || []) || [];

        if (!allRings.length) {
          console.warn(`No valid rings found for market area: ${area.name}`);
          continue;
        }

        try {
          // ENHANCED: Better handling for state-level and complex geometries
          const isStateLevelArea = (area.ma_type === "state" || area.type === "state");
          const hasMultipleLocations = area.locations && area.locations.length > 1;
          
          let finalGeometry = null;

          if (isStateLevelArea && hasMultipleLocations) {
            console.log(`Processing multi-state area with ${area.locations.length} states`);
            
            // For multi-state areas, union the geometries properly
            const { union, simplify } = await import("@arcgis/core/geometry/geometryEngine");
            const geometries = [];
            
            // Process each state individually first
            for (const location of area.locations) {
              if (location.geometry?.rings?.length > 0) {
                try {
                  const statePolygon = new Polygon({
                    rings: location.geometry.rings,
                    spatialReference: { wkid: 3857 }
                  });
                  
                  // Validate and simplify individual state geometry
                  const simplified = simplify(statePolygon);
                  if (simplified && this.isValidPolygon(simplified)) {
                    geometries.push(simplified);
                    console.log(`Added valid geometry for state: ${location.name}`);
                  } else {
                    console.warn(`Invalid or overly complex geometry for state: ${location.name}`);
                  }
                } catch (error) {
                  console.error(`Error processing state ${location.name}:`, error);
                }
              }
            }
            
            if (geometries.length === 0) {
              console.error(`No valid state geometries found for: ${area.name}`);
              continue;
            }
            
            // Union all state geometries
            try {
              let combinedGeometry = geometries[0];
              for (let i = 1; i < geometries.length; i++) {
                const unionResult = union([combinedGeometry, geometries[i]]);
                if (unionResult && this.isValidPolygon(unionResult)) {
                  combinedGeometry = unionResult;
                } else {
                  console.warn(`Union failed for geometry ${i}, skipping`);
                }
              }
              
              // Final simplification of the combined geometry
              const finalSimplified = simplify(combinedGeometry);
              if (finalSimplified && this.isValidPolygon(finalSimplified)) {
                finalGeometry = finalSimplified;
                console.log(`Successfully created union of ${geometries.length} state geometries`);
              } else {
                console.error(`Final union result is invalid for: ${area.name}`);
                continue;
              }
            } catch (error) {
              console.error(`Union operation failed for: ${area.name}`, error);
              continue;
            }
          } else {
            // Single location or non-state area - use existing logic with validation
            const combinedPolygon = new Polygon({
              rings: allRings,
              spatialReference: { wkid: 3857 },
            });
            
            // Validate the polygon before proceeding
            if (!this.isValidPolygon(combinedPolygon)) {
              console.error(`Invalid polygon geometry for: ${area.name}`);
              continue;
            }
            
            // Simplify complex geometries
            try {
              const { simplify } = await import("@arcgis/core/geometry/geometryEngine");
              const simplified = simplify(combinedPolygon);
              
              if (simplified && this.isValidPolygon(simplified)) {
                finalGeometry = simplified;
                console.log(`Simplified geometry for: ${area.name}`);
              } else {
                finalGeometry = combinedPolygon;
                console.log(`Using original geometry for: ${area.name}`);
              }
            } catch (error) {
              console.warn(`Simplification failed for ${area.name}, using original:`, error);
              finalGeometry = combinedPolygon;
            }
          }

          // Project to WGS84
          const projectedGeometry = projection.project(finalGeometry, {
            wkid: 4326,
          });

          if (projectedGeometry && this.isValidPolygon(projectedGeometry)) {
            // Additional validation for API limits
            const ringCount = projectedGeometry.rings.length;
            const totalPoints = projectedGeometry.rings.reduce((sum, ring) => sum + ring.length, 0);
            
            console.log(`Geometry stats for ${area.name}: ${ringCount} rings, ${totalPoints} total points`);
            
            // Check if geometry is too complex for the API
            if (totalPoints > 10000) {
              console.warn(`Geometry may be too complex for API (${totalPoints} points), attempting further simplification`);
              
              try {
                const { generalize } = await import("@arcgis/core/geometry/geometryEngine");
                const generalized = generalize(projectedGeometry, 0.001); // 0.001 degree tolerance
                
                if (generalized && this.isValidPolygon(generalized)) {
                  const newPointCount = generalized.rings.reduce((sum, ring) => sum + ring.length, 0);
                  console.log(`Generalized geometry to ${newPointCount} points`);
                  
                  expandedAreas.push({
                    geometry: {
                      rings: generalized.rings,
                      spatialReference: { wkid: 4326 },
                    },
                    attributes: {
                      ObjectID: areaIndex,
                      name: area.name,
                      originalAreaName: area.name,
                      simplified: true,
                      originalPointCount: totalPoints,
                      finalPointCount: newPointCount
                    },
                    originalIndex: areaIndex,
                  });
                } else {
                  throw new Error("Generalization produced invalid geometry");
                }
              } catch (error) {
                console.error(`Generalization failed for ${area.name}:`, error);
                // Still try with original geometry
                expandedAreas.push({
                  geometry: {
                    rings: projectedGeometry.rings,
                    spatialReference: { wkid: 4326 },
                  },
                  attributes: {
                    ObjectID: areaIndex,
                    name: area.name,
                    originalAreaName: area.name,
                    warning: "Complex geometry - may fail API validation"
                  },
                  originalIndex: areaIndex,
                });
              }
            } else {
              // Geometry is within reasonable limits
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
            }
            
            areaIndex++;
          } else {
            console.error(`Projection returned null or invalid geometry for ${area.name}`);
          }
        } catch (error) {
          console.error(`Processing failed for ${area.name}:`, error);
        }
      }
    }

    // Final validation of expanded areas
    if (expandedAreas.length === 0) {
      throw new Error("No valid study areas could be generated from market areas");
    }

    // Enhanced validation of all polygons
    for (let i = 0; i < expandedAreas.length; i++) {
      const area = expandedAreas[i];
      if (!this.validateGeometryForAPI(area.geometry)) {
        console.error(`Invalid geometry for area ${i}:`, area);
        throw new Error(`Area at index ${i} (${area.attributes.name}) has invalid geometry for API submission`);
      }
    }

    console.log(`Successfully created ${expandedAreas.length} valid study areas for enrichment`);
    return expandedAreas;
  }

  isValidPolygon(polygon) {
    if (!polygon || !polygon.rings || !Array.isArray(polygon.rings)) {
      return false;
    }
    
    if (polygon.rings.length === 0) {
      return false;
    }
    
    // Check each ring
    for (const ring of polygon.rings) {
      if (!Array.isArray(ring) || ring.length < 4) {
        return false;
      }
      
      // Check for valid coordinates
      for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2 || 
            typeof point[0] !== 'number' || typeof point[1] !== 'number' ||
            isNaN(point[0]) || isNaN(point[1])) {
          return false;
        }
      }
      
      // Check if ring is closed
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        return false;
      }
    }
    
    return true;
  }

  validateGeometryForAPI(geometry) {
    if (!geometry || !geometry.rings || !Array.isArray(geometry.rings) || geometry.rings.length === 0) {
      console.error("Geometry validation failed: missing or empty rings array");
      return false;
    }

    // Check if any ring has coordinates
    let hasValidRing = false;
    let totalPoints = 0;
    
    for (const ring of geometry.rings) {
      if (!Array.isArray(ring) || ring.length < 4) { // Need at least 4 points for a valid ring
        console.error("Geometry validation failed: ring has insufficient points", ring?.length);
        continue;
      }
      
      totalPoints += ring.length;
      
      // Check if ring has valid, non-zero coordinates
      const hasValidPoints = ring.every(point => {
        if (!Array.isArray(point) || point.length < 2) return false;
        const [x, y] = point;
        return typeof x === 'number' && typeof y === 'number' && 
              !isNaN(x) && !isNaN(y) && 
              Math.abs(x) > 0.000001 && Math.abs(y) > 0.000001; // Not exactly zero
      });
      
      if (hasValidPoints) {
        hasValidRing = true;
      }
    }

    if (!hasValidRing) {
      console.error("Geometry validation failed: no valid rings with non-zero coordinates");
      return false;
    }
    
    // Check for reasonable complexity limits
    if (totalPoints > 15000) {
      console.warn(`Geometry has high complexity: ${totalPoints} points - may cause API issues`);
    }
    
    // Check spatial reference
    if (!geometry.spatialReference || !geometry.spatialReference.wkid) {
      console.error("Geometry validation failed: missing spatial reference");
      return false;
    }
    
    // Ensure WGS84 for API
    if (geometry.spatialReference.wkid !== 4326) {
      console.error("Geometry validation failed: spatial reference must be WGS84 (4326)");
      return false;
    }

    return true;
  }


  createCirclePolygon(centerX, centerY, radiusMiles, fromWkid = 102100) {
    // Convert miles to meters
    const radiusMeters = radiusMiles * 1609.34;
    const numPoints = 32;
    const points = [];

    // Debug the input values
    console.log("Creating circle polygon with:", {
      centerX,
      centerY,
      radiusMiles,
      radiusMeters,
      fromWkid
    });

    // Check for invalid center coordinates
    if (!centerX || !centerY || isNaN(centerX) || isNaN(centerY) ||
      (centerX === 0 && centerY === 0)) {
      console.error("Invalid center coordinates for circle polygon:", centerX, centerY);
      return null;
    }

    // Generate points around the circle
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      const dx = Math.cos(angle) * radiusMeters;
      const dy = Math.sin(angle) * radiusMeters;

      // Add the offset to the center coordinates
      const pointX = centerX + dx;
      const pointY = centerY + dy;

      // Log some points to verify
      if (i === 0 || i === numPoints / 4 || i === numPoints / 2) {
        console.log(`Circle point ${i}:`, [pointX, pointY]);
      }

      points.push([pointX, pointY]);
    }

    // Close the ring
    points.push(points[0]);

    // Validate the created ring
    if (this.isValidRing(points)) {
      return [points];
    } else {
      console.error("Failed to create valid circle polygon");
      return null;
    }
  }

  // Helper method to validate a ring of coordinates
  isValidRing(ring) {
    // Check if we have enough points for a valid ring
    if (!ring || ring.length < 4) {
      console.error("Ring has insufficient points:", ring?.length);
      return false;
    }

    // Check if all coordinates are identical (invalid area)
    const firstPoint = ring[0];
    const allSame = ring.every(point =>
      point[0] === firstPoint[0] && point[1] === firstPoint[1]
    );

    if (allSame) {
      console.error("All points in ring are identical");
      return false;
    }

    // Check if any coordinates are invalid
    const hasInvalidCoords = ring.some(point =>
      !point || point.length !== 2 ||
      isNaN(point[0]) || isNaN(point[1]) ||
      (point[0] === 0 && point[1] === 0)
    );

    if (hasInvalidCoords) {
      console.error("Ring contains invalid coordinates");
      return false;
    }

    return true;
  }

  async enrichChunk(studyAreas, selectedVariables = []) {
    try {
      const token = await this.getToken();
      const enrichmentUrl = "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/enrich";

      console.log("Enriching chunk with variables:", selectedVariables);
      console.log("Study areas for enrichment:", studyAreas);

      if (!studyAreas?.[0]?.geometry) {
        throw new Error("Invalid study area geometry");
      }

      const studyAreasPayload = studyAreas.map((s) => ({
        geometry: s.geometry,
        attributes: s.attributes,
      }));

      const params = new URLSearchParams();
      params.append("f", "json");
      params.append("token", token);
      params.append("studyAreas", JSON.stringify(studyAreasPayload));
      params.append("analysisVariables", JSON.stringify(selectedVariables));
      params.append("returnGeometry", "false");

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
        throw new Error(`Enrichment request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error("Enrichment API Error:", data.error);
        throw new Error(`Enrichment API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }

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

  async enrichAreas(marketAreas, selectedVariables = [], includeUSAData = false) {
    const shouldIncludeUSA = typeof includeUSAData === "boolean" ? includeUSAData : false;

    console.log('enrichAreas called with:', {
      marketAreasCount: marketAreas?.length,
      variablesCount: selectedVariables?.length,
      includeUSAData: shouldIncludeUSA
    });

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

    const idToIndexMap = {};
    studyAreas.forEach((sa) => {
      idToIndexMap[sa.attributes.ObjectID] = sa.originalIndex;
    });

    return {
      results,
      studyAreas,
      idToIndexMap,
      includeUSAData: shouldIncludeUSA,
      metadata: {
        processedAt: new Date().toISOString(),
        marketAreasCount: marketAreas.length,
        studyAreasCount: studyAreas.length,
        variablesCount: selectedVariables.length,
        includeUSAData: shouldIncludeUSA
      }
    };
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

  async handleExport(enrichmentData, marketAreas, selectedVariables, options = {}) {
    const { includeUSAData = false } = options;
    const shouldIncludeUSA = typeof includeUSAData === "boolean"
      ? includeUSAData
      : Boolean(enrichmentData?.includeUSAData);

    if (!enrichmentData || !marketAreas || !selectedVariables) {
      throw new Error('Missing required export parameters');
    }

    try {
      // Get project ID directly from the market area or options
      const projectId = options.projectId ||  // Add this line to explicitly pass project ID
        marketAreas[0]?.project_id ||
        marketAreas[0]?.id;

      console.log('Project ID Details:', {
        projectId,
        firstMarketArea: marketAreas[0],
        marketAreasLength: marketAreas.length,
        options
      });

      if (!projectId) {
        console.error('Market area structure:', marketAreas[0]);
        throw new Error('Could not find project ID');
      }

      // Get user information from the API
      let userId;
      try {
        const userResponse = await api.get('/api/admin/users/me/');
        userId = userResponse.data.id;

        if (!userId || typeof userId !== 'number') {
          throw new Error('Invalid user ID received from API');
        }
      } catch (error) {
        console.error('Failed to get user ID:', error);
        throw new Error('Could not determine user ID. Please log in again.');
      }

      // Calculate cost: $1 per 1000 market areas * variables
      // Ensure minimum cost of 0.01
      const totalRecords = marketAreas.length * selectedVariables.length;
      const calculatedCost = (totalRecords / 1000);
      const cost = Math.max(calculatedCost, 0.01);  // Ensure minimum cost of $0.01

      // Prepare the usage data
      const usageData = {
        user_id: userId,
        project_id: projectId,
        cost: parseFloat(cost.toFixed(2))
      };

      console.log('Sending enrichment usage data:', usageData);

      // Record the enrichment usage
      try {
        const usageResponse = await api.post('/api/enrichment/record_usage/', usageData);
        console.log('Enrichment usage recorded:', usageResponse.data);
      } catch (error) {
        const errorDetails = error.response?.data?.detail ||
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;
        console.error('Failed to record enrichment usage:', {
          error: error.response?.data,
          details: errorDetails,
          status: error.response?.status,
          data: usageData
        });
        throw new Error(`Failed to record enrichment usage: ${errorDetails}`);
      }

      const exportResult = await this.exportToExcel(
        enrichmentData,
        marketAreas,
        selectedVariables,
        shouldIncludeUSA
      );

      return exportResult;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  // Helper method to handle the export once we have a project ID
  async handleExportWithProjectId(projectId, userId, marketAreas, selectedVariables, enrichmentData, includeUSAData) {
    const shouldIncludeUSA = typeof includeUSAData === "boolean"
      ? includeUSAData
      : Boolean(enrichmentData?.includeUSAData);

    console.log('Processing export:', {
      includeUSAData: shouldIncludeUSA,
      marketAreasCount: marketAreas?.length,
      variablesCount: selectedVariables?.length,
      userId,
      projectId
    });

    // Record the enrichment usage
    const usageResponse = await api.post('/api/enrichment/record_usage/', {
      user_id: userId,
      project_id: projectId,
      market_areas_count: marketAreas.length,
      variables_count: selectedVariables.length
    });

    console.log('Enrichment usage recorded:', usageResponse.data);

    const exportResult = await this.exportToExcel(
      enrichmentData,
      marketAreas,
      selectedVariables,
      shouldIncludeUSA
    );

    return exportResult;
  }

  addUSADataToRows(rows, selectedVariables) {
    // Add USA column headers
    rows[0].push("United States of America");
    rows[1].push("USA");
    rows[2].push("");
    rows[3].push("");
    rows[4].push("");

    // Track positions in USA data
    const variableToUSAIndex = new Map();

    // Map Tier 1 variables
    let currentIndex = 5;
    analysisCategories.tier1.variables.forEach(v => {
      const shortKey = v.id.split(".").pop();
      variableToUSAIndex.set(shortKey, currentIndex++);
    });

    // Map Tier 2 variables
    currentIndex = 5;
    analysisCategories.tier2.variables.forEach(v => {
      const shortKey = v.id.split(".").pop();
      variableToUSAIndex.set(shortKey, currentIndex++);
    });

    // Add USA data
    for (let i = 5; i < rows.length; i++) {
      const variableId = selectedVariables[i - 5];
      const shortKey = variableId.split(".").pop();

      let usaValue = "";
      const isTier2 = variableId.startsWith("1yearincrements.") ||
      variableId.startsWith("educationalattainment.") ||
      variableId.includes("BASEFY") ||
      variableId.includes("MEDIA") ||
      (variableId.includes("incomebyage.A") && !variableId.includes("BASE")) ||
      (variableId.includes("networth.") && variableId.includes("A")) ||
      variableId.includes("incomebyage.AVGIA") ||
      (variableId.includes("incomebyage.") && variableId.includes("_FY"));

      const position = variableToUSAIndex.get(shortKey);

      if (isTier2 && position < usaDataRowsTier2.length) {
        usaValue = usaDataRowsTier2[position];
      } else if (!isTier2 && position < usaDataRowsTier1.length) {
        usaValue = usaDataRowsTier1[position];
      }

      rows[i].push(usaValue);
    }
  }

  exportToExcel(enrichmentData, marketAreas, selectedVariables = [], includeUSAData = false) {
    const shouldIncludeUSAData = typeof includeUSAData === "boolean"
      ? includeUSAData
      : Boolean(enrichmentData?.includeUSAData);

    console.log("Starting exportToExcel with params:", {
      marketAreasCount: marketAreas?.length,
      selectedVariablesCount: selectedVariables?.length,
      includeUSAData: shouldIncludeUSAData
    });

    const { results, studyAreas, idToIndexMap } = enrichmentData;

    // Prepare enrichment lookup
    const enrichmentLookup = {};
    results.forEach((res) => {
      const featureSet = res.value?.FeatureSet?.[0];
      if (!featureSet?.features?.[0]?.attributes) return;
      const attrs = featureSet.features[0].attributes;
      const objId = attrs.ObjectID;
      const originalIndex = idToIndexMap[objId];

      if (originalIndex !== undefined) {
        enrichmentLookup[originalIndex] = attrs;
      }
    });

    const rows = [];

    // Header rows
    rows.push(["Market Area Name", ...marketAreas.map(ma => ma.name || "")]);
    rows.push(["Short Name", ...marketAreas.map(ma => ma.short_name || "")]);
    rows.push([
      "Definition Type",
      ...marketAreas.map(ma => {
        const maType = ma.ma_type?.toLowerCase();
        return MA_TYPE_MAPPING[maType] || ma.ma_type?.toUpperCase() || "";
      })
    ]);

    // Areas Included row
    rows.push([
      "Areas Included",
      ...marketAreas.map(ma => {
        const maType = ma.ma_type?.toLowerCase();
        switch (maType) {
          case "zip":
            return ma.locations?.map(loc => this.formatBigNumberAsText(loc.name)).join(", ") || "";
          case "radius":
            if (ma.radius_points?.length > 0) {
              const allRadii = ma.radius_points.flatMap(p => p.radii || []);
              if (allRadii.length > 0) {
                const largestRadius = Math.max(...allRadii);
                return `${largestRadius} miles`;
              }
            }
            return "";
          case "block":
          case "blockgroup":
          case "tract":
            // Added error handling and proper this reference
            return ma.locations?.map(loc => {
              try {
                return this.formatBigNumberAsText(loc.name);
              } catch (e) {
                console.error(`Error formatting location name: ${loc.name}`, e);
                return loc.name || "";
              }
            }).join(", ") || "";
          default:
            return ma.locations?.map(loc => loc.name).join(", ") || "";
        }
      })
    ]);

    // Add a blank row after headers
    rows.push(Array(marketAreas.length + 1).fill(""));

    // Rest of the exportToExcel method remains the same...

    // Data rows with proper labels
    selectedVariables.forEach(variableId => {
      const shortKey = variableId.split(".").pop();
      const label = this.getVariableLabel(variableId);

      const values = marketAreas.map((_, idx) => {
        const attrs = enrichmentLookup[idx];
        if (!attrs) return "";
        const value = attrs[shortKey];
        return this.formatNumberValue(value);
      });

      rows.push([label, ...values]);
    });

    if (shouldIncludeUSAData) {
      this.addUSADataToRows(rows, selectedVariables);
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    const colWidths = {};
    rows[0].forEach((_, idx) => {
      colWidths[XLSX.utils.encode_col(idx)] = { width: 20 };  // Set default width
    });
    ws['!cols'] = Object.values(colWidths);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Market Area Analysis");

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
}

// Export an instance for direct usage
export const enrichmentService = new EnrichmentService();
