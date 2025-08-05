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


const usaDataRowsTier1 = [
  "",
  "",
  "",
  "",
  "",
  "339,870,195",
  "132,414,697",
  "2.5",
  "18,338,341",
  "19,544,078",
  "20,332,897",
  "21,974,814",
  "22,720,428",
  "22,800,948",
  "23,552,180",
  "22,675,139",
  "22,283,370",
  "20,338,571",
  "20,417,761",
  "20,136,722",
  "21,020,745",
  "19,819,812",
  "16,551,791",
  "12,694,502",
  "7,888,879",
  "6,779,217",
  "39.6",
  "165,972,473",
  "10,979,703",
  "7,859,492",
  "8,317,782",
  "13,019,390",
  "20,690,635",
  "16,575,221",
  "23,551,600",
  "12,938,648",
  "18,478,783",
  "81,625",
  "116,181",
  "4,775,237",
  "1,343,875",
  "717,348",
  "1,008,557",
  "1,834,664",
  "3,474,781",
  "2,914,847",
  "4,020,853",
  "1,950,162",
  "2,167,536",
  "19,432,623",
  "1,131,545",
  "765,671",
  "1,003,256",
  "1,797,381",
  "3,372,629",
  "2,911,261",
  "4,887,760",
  "2,932,266",
  "4,268,995",
  "23,070,765",
  "1,318,651",
  "734,438",
  "802,824",
  "1,528,733",
  "2,980,863",
  "2,797,937",
  "4,676,032",
  "2,834,935",
  "4,545,554",
  "22,219,967",
  "23,564,270",
  "22,072,687",
  "17,275,707",
  "24,318,234",
  "8,192,409",
  "3,121,946",
  "5,648,119",
  "5,484,518",
  "8,642,025",
  "12,942,693",
  "20,086,956",
  "16,810,239",
  "8,460,674",
  "3,501,296",
  "15,202,148",
  "228,163",
  "1,269,772",
  "146,790,779",
  "85,049,706",
  "47,364,991",
  "14,376,082",
  "347,130,599",
  "136,707,994",
  "2.48",
  "18,461,760",
  "18,627,580",
  "19,865,396",
  "20,830,979",
  "23,013,522",
  "23,616,154",
  "23,139,077",
  "23,586,768",
  "22,944,204",
  "22,259,581",
  "20,246,488",
  "19,781,404",
  "19,473,509",
  "19,941,242",
  "18,224,795",
  "14,511,827",
  "10,240,415",
  "8,365,899",
  "40.5",
  "10,027,552",
  "6,655,500",
  "7,266,131",
  "11,931,266",
  "19,968,526",
  "16,657,545",
  "25,466,204",
  "15,249,614",
  "23,482,241",
  "92,479",
  "128,614",
  "151,444,136",
  "89,004,886",
  "47,703,108",
  "14,736,142",
  "331,822,665",
  "126,997,237",
  "309,105,811",
  "116,850,447",
  "20,200,240",
  "20,347,768",
  "20,676,447",
  "22,039,438",
  "21,584,389",
  "21,100,036",
  "19,960,853",
  "20,178,552",
  "20,890,026",
  "22,707,472",
  "22,296,988",
  "19,663,884",
  "16,817,149",
  "12,434,708",
  "9,277,824",
  "7,317,538",
  "5,743,074",
  "5,493,164",
  "37.1",
  "31,881,161",
  "31,202,247",
  "6,359,377",
  "", // 2024 HHs in Tapestry Seg 1A
  "", // 2024 HHs in Tapestry Seg 1B
  "", // 2024 HHs in Tapestry Seg 1C
  "", // 2024 HHs in Tapestry Seg 1D
  "", // 2024 HHs in Tapestry Seg 1E
  "", // 2024 HHs in Tapestry Seg 2A
  "", // 2024 HHs in Tapestry Seg 2B
  "", // 2024 HHs in Tapestry Seg 2C
  "", // 2024 HHs in Tapestry Seg 2D
  "", // 2024 HHs in Tapestry Seg 3A
  "", // 2024 HHs in Tapestry Seg 3B
  "", // 2024 HHs in Tapestry Seg 3C
  "", // 2024 HHs in Tapestry Seg 4A
  "", // 2024 HHs in Tapestry Seg 4B
  "", // 2024 HHs in Tapestry Seg 4C
  "", // 2024 HHs in Tapestry Seg 5A
  "", // 2024 HHs in Tapestry Seg 5B
  "", // 2024 HHs in Tapestry Seg 5C
  "", // 2024 HHs in Tapestry Seg 5D
  "", // 2024 HHs in Tapestry Seg 5E
  "", // 2024 HHs in Tapestry Seg 6A
  "", // 2024 HHs in Tapestry Seg 6B
  "", // 2024 HHs in Tapestry Seg 6C
  "", // 2024 HHs in Tapestry Seg 6D
  "", // 2024 HHs in Tapestry Seg 6E
  "", // 2024 HHs in Tapestry Seg 6F
  "", // 2024 HHs in Tapestry Seg 7A
  "", // 2024 HHs in Tapestry Seg 7B
  "", // 2024 HHs in Tapestry Seg 7C
  "", // 2024 HHs in Tapestry Seg 7D
  "", // 2024 HHs in Tapestry Seg 7E
  "", // 2024 HHs in Tapestry Seg 7F
  "", // 2024 HHs in Tapestry Seg 8A
  "", // 2024 HHs in Tapestry Seg 8B
  "", // 2024 HHs in Tapestry Seg 8C
  "", // 2024 HHs in Tapestry Seg 8D
  "", // 2024 HHs in Tapestry Seg 8E
  "", // 2024 HHs in Tapestry Seg 8F
  "", // 2024 HHs in Tapestry Seg 8G
  "", // 2024 HHs in Tapestry Seg 9A
  "", // 2024 HHs in Tapestry Seg 9B
  "", // 2024 HHs in Tapestry Seg 9C
  "", // 2024 HHs in Tapestry Seg 9D
  "", // 2024 HHs in Tapestry Seg 9E
  "", // 2024 HHs in Tapestry Seg 9F
  "", // 2024 HHs in Tapestry Seg 10A
  "", // 2024 HHs in Tapestry Seg 10B
  "", // 2024 HHs in Tapestry Seg 10C
  "", // 2024 HHs in Tapestry Seg 10D
  "", // 2024 HHs in Tapestry Seg 10E
  "", // 2024 HHs in Tapestry Seg 11A
  "", // 2024 HHs in Tapestry Seg 11B
  "", // 2024 HHs in Tapestry Seg 11C
  "", // 2024 HHs in Tapestry Seg 11D
  "", // 2024 HHs in Tapestry Seg 11E
  "", // 2024 HHs in Tapestry Seg 12A
  "", // 2024 HHs in Tapestry Seg 12B
  "", // 2024 HHs in Tapestry Seg 12C
  "", // 2024 HHs in Tapestry Seg 12D
  "", // 2024 HHs in Tapestry Seg 13A
  "", // 2024 HHs in Tapestry Seg 13B
  "", // 2024 HHs in Tapestry Seg 13C
  "", // 2024 HHs in Tapestry Seg 13D
  "", // 2024 HHs in Tapestry Seg 13E
  "", // 2024 HHs in Tapestry Seg 14A
  "", // 2024 HHs in Tapestry Seg 14B
  "" // 2024 HHs in Tapestry Seg 14C
];

// Tier 2 USA data rows
const usaDataRowsTier2 = [
  "",
  "",
  "",
  "",
  "",
  "3,521,402",
  "3,578,769",
  "3,675,828",
  "3,747,444",
  "3,814,899",
  "3,845,528",
  "3,867,064",
  "3,914,574",
  "3,949,509",
  "3,967,404",
  "4,011,304",
  "4,047,643",
  "4,117,546",
  "4,103,824",
  "4,052,581",
  "4,176,344",
  "4,207,770",
  "4,184,462",
  "4,505,117",
  "4,901,121",
  "4,881,427",
  "4,676,086",
  "4,445,645",
  "4,330,192",
  "4,387,079",
  "4,551,756",
  "4,478,172",
  "4,534,374",
  "4,610,569",
  "4,626,077",
  "4,675,208",
  "4,732,342",
  "4,750,613",
  "4,727,761",
  "4,666,255",
  "4,596,858",
  "4,553,618",
  "4,524,549",
  "4,503,863",
  "4,496,251",
  "4,513,281",
  "4,521,366",
  "4,494,962",
  "4,428,285",
  "4,325,476",
  "4,191,306",
  "4,080,362",
  "4,019,867",
  "4,005,601",
  "4,041,435",
  "4,083,190",
  "4,091,691",
  "4,093,011",
  "4,083,153",
  "4,066,715",
  "4,031,433",
  "4,001,015",
  "3,999,836",
  "4,024,949",
  "4,079,489",
  "4,166,143",
  "4,234,834",
  "4,255,044",
  "4,222,530",
  "4,142,195",
  "4,093,330",
  "4,077,258",
  "4,014,771",
  "3,899,040",
  "3,735,413",
  "3,581,019",
  "3,459,421",
  "3,325,536",
  "3,175,445",
  "3,010,370",
  "2,861,496",
  "2,722,988",
  "2,562,675",
  "2,377,886",
  "2,169,458",
  "2,047,048",
  "1,649,291",
  "1,492,490",
  "1,417,844",
  "1,282,206",
  "3,651,314",
  "3,634,281",
  "3,685,314",
  "3,718,498",
  "3,772,353",
  "3,699,689",
  "3,684,590",
  "3,715,660",
  "3,743,746",
  "3,783,895",
  "3,912,389",
  "3,966,902",
  "4,037,932",
  "4,011,628",
  "3,936,546",
  "3,955,906",
  "3,949,957",
  "3,923,172",
  "4,275,785",
  "4,726,159",
  "4,874,971",
  "4,713,307",
  "4,519,086",
  "4,422,291",
  "4,483,866",
  "4,686,992",
  "4,656,422",
  "4,725,084",
  "4,787,318",
  "4,760,339",
  "4,650,676",
  "4,616,659",
  "4,606,725",
  "4,616,238",
  "4,648,779",
  "4,698,289",
  "4,734,136",
  "4,745,025",
  "4,726,053",
  "4,683,265",
  "4,640,879",
  "4,615,368",
  "4,590,915",
  "4,562,130",
  "4,534,913",
  "4,527,787",
  "4,521,244",
  "4,484,781",
  "4,413,742",
  "4,312,026",
  "4,186,030",
  "4,080,147",
  "4,012,360",
  "3,980,731",
  "3,987,220",
  "3,991,164",
  "3,969,193",
  "3,953,641",
  "3,938,182",
  "3,929,224",
  "3,906,534",
  "3,881,722",
  "3,877,253",
  "3,888,150",
  "3,919,850",
  "3,985,589",
  "4,038,695",
  "4,042,169",
  "3,989,602",
  "3,885,188",
  "3,814,446",
  "3,777,026",
  "3,693,969",
  "3,560,017",
  "3,379,338",
  "3,207,610",
  "3,068,057",
  "2,917,215",
  "2,750,006",
  "2,568,938",
  "2,499,993",
  "2,141,825",
  "1,993,809",
  "1,899,115",
  "1,705,673",
  "53,124,473",
  "9,734,460",
  "40,855,398",
  "23,161,464",
  "53,684,675",
  "34,367,853",
  "236,959,635",
  "4,757,552",
  "19,324,453",
  "23,689,689",
  "23,016,502",
  "22,235,260",
  "22,926,004",
  "20,755,120",
  "832,835",
  "461,534",
  "478,037",
  "706,079",
  "949,978",
  "642,283",
  "501,834",
  "122,875",
  "79,783",
  "2,079,169",
  "1,222,367",
  "1,196,033",
  "1,846,470",
  "3,271,059",
  "2,774,134",
  "4,355,762",
  "2,651,596",
  "4,167,681",
  "2,216,140",
  "1,771,032",
  "1,726,498",
  "2,603,200",
  "3,753,990",
  "2,731,429",
  "3,389,687",
  "1,597,013",
  "2,283,700",
  "2,057,490",
  "2,187,102",
  "2,102,578",
  "2,702,864",
  "2,887,335",
  "1,803,332",
  "1,719,672",
  "849,801",
  "965,534",
  "13,908",
  "63,686",
  "147,706",
  "269,563",
  "398,699",
  "446,588",
  "359,484",
  "24,320",
  "368,281",
  "2,895,687",
  "4,733,181",
  "7,805,203",
  "6,860,688",
  "4,476,758",
  "812,630",
  "394,835",
  "430,893",
  "643,345",
  "959,773",
  "681,730",
  "586,386",
  "149,692",
  "98,268",
  "1,120,313",
  "563,267",
  "806,285",
  "1,605,067",
  "3,192,222",
  "2,773,521",
  "4,228,982",
  "2,231,134",
  "2,803,662",
  "1,005,054",
  "591,845",
  "827,759",
  "1,586,847",
  "3,117,236",
  "2,869,176",
  "5,125,014",
  "3,341,200",
  "5,225,559",
  "1,158,736",
  "585,285",
  "637,016",
  "1,334,263",
  "2,721,033",
  "2,752,866",
  "4,979,232",
  "3,250,436",
  "5,597,634",
  "1,606,265",
  "877,989",
  "891,353",
  "1,452,128",
  "2,817,110",
  "2,519,388",
  "4,303,578",
  "2,922,392",
  "4,845,055",
  "1,988,318",
  "1,465,894",
  "1,490,023",
  "2,337,963",
  "3,746,188",
  "2,820,353",
  "3,844,912",
  "2,031,043",
  "3,201,309",
  "2,336,236",
  "2,176,384",
  "2,182,802",
  "2,971,653",
  "3,414,964",
  "2,240,510",
  "2,398,100",
  "1,323,717",
  "1,710,754",
  "31,881,161",
  "17,765,079",
  "15,213,545",
  "7,411,714",
  "3,026,143",
  "2,237,408",
  "31,202,247",
  "6,359,377",
  "992,079",
  "411,147",
  "126,626",
  "48,419",
  "34,692",
  "59,770",
  "112,540",
  "137,583",
  "143,886",
  "129,950",
  "99,315",
  "74,418",
  "47,484",
  "84,661",
  "103,737",
  "106,988",
  "93,367",
  "66,172",
  "67,911",
  "56,657",
  "47,023",
  "51,681",
  "95,480",
  "113,349",
  "118,143",
  "107,861",
  "78,027",
  "78,147",
  "65,027",
  "53,783"
];

// Tier 3 USA data rows (Retail Variables)
const usaDataRowsTier3 = [
  "",
  "",
  "",
  "",
  "",
  "2,922.32",
  "262.41",
  "140.99",
  "128.66",
  "508.1",
  "2,464.31",
  "485.69",
  "842.15",
  "338.27",
  "552.79",
  "4,085.15",
  "2,086.85",
  "1,895.36",
  "4,143.2",
  "295.21",
  "32,925.4",
  "416.59",
  "223.31",
  "123.11",
  "316.62",
  "3,457.36",
  "1,371.02",
  "100",
  "101",
  "101",
  "100",
  "100",
  "101",
  "101",
  "101",
  "101",
  "101",
  "100",
  "101",
  "100",
  "100",
  "99",
  "101",
  "103",
  "102",
  "99",
  "100",
  "102",
  "102",
  "3,235.15",
  "290.46",
  "156.07",
  "142.26",
  "562.35",
  "2,728.81",
  "537.73",
  "932.4",
  "374.84",
  "612.12",
  "4,523.79",
  "2,311.17",
  "2,098.67",
  "4,587.99",
  "326.9",
  "36,431.35",
  "460.4",
  "246.97",
  "136.26",
  "350.23",
  "3,826.37",
  "1,517.51",
  "100",
  "101",
  "101",
  "99",
  "100",
  "101",
  "101",
  "101",
  "101",
  "101",
  "100",
  "101",
  "100",
  "100",
  "99",
  "101",
  "103",
  "102",
  "99",
  "100",
  "102",
  "102",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100",
  "100"
];


export const analysisCategories = {
  tier1: {
    label: "Core (Tier 1) Variables",
    variables: [
      // Current Year Population Base
      { id: "AtRisk.TOTPOP_CY", label: "2025 Total Population" },
      { id: "AtRisk.TOTHH_CY", label: "2025 Total Households" },
      { id: "AtRisk.AVGHHSZ_CY", label: "2025 Average Household Size" },

      // Current Year Population by Age
      { id: "5yearincrements.POP0_CY", label: "2025 Population Age 0-4" },
      { id: "5yearincrements.POP5_CY", label: "2025 Population Age 5-9" },
      { id: "5yearincrements.POP10_CY", label: "2025 Population Age 10-14" },
      { id: "5yearincrements.POP15_CY", label: "2025 Population Age 15-19" },
      { id: "5yearincrements.POP20_CY", label: "2025 Population Age 20-24" },
      { id: "5yearincrements.POP25_CY", label: "2025 Population Age 25-29" },
      { id: "5yearincrements.POP30_CY", label: "2025 Population Age 30-34" },
      { id: "5yearincrements.POP35_CY", label: "2025 Population Age 35-39" },
      { id: "5yearincrements.POP40_CY", label: "2025 Population Age 40-44" },
      { id: "5yearincrements.POP45_CY", label: "2025 Population Age 45-49" },
      { id: "5yearincrements.POP50_CY", label: "2025 Population Age 50-54" },
      { id: "5yearincrements.POP55_CY", label: "2025 Population Age 55-59" },
      { id: "5yearincrements.POP60_CY", label: "2025 Population Age 60-64" },
      { id: "5yearincrements.POP65_CY", label: "2025 Population Age 65-69" },
      { id: "5yearincrements.POP70_CY", label: "2025 Population Age 70-74" },
      { id: "5yearincrements.POP75_CY", label: "2025 Population Age 75-79" },
      { id: "5yearincrements.POP80_CY", label: "2025 Population Age 80-84" },
      { id: "5yearincrements.POP85_CY", label: "2025 Population Age 85+" },
      { id: "5yearincrements.MEDAGE_CY", label: "2025 Median Age" },

      // Current Year Daytime Population
      { id: "DaytimePopulation.DPOPWRK_CY", label: "2025 Daytime Pop: Workers" },

      // Current Year Household Income
      { id: "householdincome.HINC0_CY", label: "2025 HH Income <$15000" },
      { id: "householdincome.HINC15_CY", label: "2025 HH Income $15000-24999" },
      { id: "householdincome.HINC25_CY", label: "2025 HH Income $25000-34999" },
      { id: "householdincome.HINC35_CY", label: "2025 HH Income $35000-49999" },
      { id: "householdincome.HINC50_CY", label: "2025 HH Income $50000-74999" },
      { id: "householdincome.HINC75_CY", label: "2025 HH Income $75000-99999" },
      { id: "householdincome.HINC100_CY", label: "2025 HH Income $100000-149999" },
      { id: "householdincome.HINC150_CY", label: "2025 HH Income $150000-199999" },
      { id: "householdincome.HINC200_CY", label: "2025 HH Income $200000+" },
      { id: "householdincome.MEDHINC_CY", label: "2025 Median Household Income" },
      { id: "householdincome.AVGHINC_CY", label: "2025 Average Household Income" },

      // Current Year Income by Age Groups - Organized with base before details
      { id: "incomebyage.IA15BASECY", label: "2025 HH Income Base: HHr 15-24" },

      // Age 25-34 Income
      { id: "incomebyage.A25I0_CY", label: "2025 HH Inc <$15000/HHr 25-34" },
      { id: "incomebyage.A25I15_CY", label: "2025 HH Inc $15K-24999/HHr 25-34" },
      { id: "incomebyage.A25I25_CY", label: "2025 HH Inc $25K-34999/HHr 25-34" },
      { id: "incomebyage.A25I35_CY", label: "2025 HH Inc $35K-49999/HHr 25-34" },
      { id: "incomebyage.A25I50_CY", label: "2025 HH Inc $50K-74999/HHr 25-34" },
      { id: "incomebyage.A25I75_CY", label: "2025 HH Inc $75K-99999/HHr 25-34" },
      { id: "incomebyage.A25I100_CY", label: "2025 HH Inc 100K-149999/HHr 25-34" },
      { id: "incomebyage.A25I150_CY", label: "2025 HH Inc 150K-199999/HHr 25-34" },
      { id: "incomebyage.A25I200_CY", label: "2025 HH Inc $200000+/HHr 25-34" },
      { id: "incomebyage.IA25BASECY", label: "2025 HH Income Base: HHr 25-34" },

      // Age 35-44 Income
      { id: "incomebyage.A35I0_CY", label: "2025 HH Inc <$15000/HHr 35-44" },
      { id: "incomebyage.A35I15_CY", label: "2025 HH Inc $15K-24999/HHr 35-44" },
      { id: "incomebyage.A35I25_CY", label: "2025 HH Inc $25K-34999/HHr 35-44" },
      { id: "incomebyage.A35I35_CY", label: "2025 HH Inc $35K-49999/HHr 35-44" },
      { id: "incomebyage.A35I50_CY", label: "2025 HH Inc $50K-74999/HHr 35-44" },
      { id: "incomebyage.A35I75_CY", label: "2025 HH Inc $75K-99999/HHr 35-44" },
      { id: "incomebyage.A35I100_CY", label: "2025 HH Inc 100K-149999/HHr 35-44" },
      { id: "incomebyage.A35I150_CY", label: "2025 HH Inc 150K-199999/HHr 35-44" },
      { id: "incomebyage.A35I200_CY", label: "2025 HH Inc $200000+/HHr 35-44" },
      { id: "incomebyage.IA35BASECY", label: "2025 HH Income Base: HHr 35-44" },

      // Age 45-54 Income
      { id: "incomebyage.A45I0_CY", label: "2025 HH Inc <$15000/HHr 45-54" },
      { id: "incomebyage.A45I15_CY", label: "2025 HH Inc $15K-24999/HHr 45-54" },
      { id: "incomebyage.A45I25_CY", label: "2025 HH Inc $25K-34999/HHr 45-54" },
      { id: "incomebyage.A45I35_CY", label: "2025 HH Inc $35K-49999/HHr 45-54" },
      { id: "incomebyage.A45I50_CY", label: "2025 HH Inc $50K-74999/HHr 45-54" },
      { id: "incomebyage.A45I75_CY", label: "2025 HH Inc $75K-99999/HHr 45-54" },
      { id: "incomebyage.A45I100_CY", label: "2025 HH Inc 100K-149999/HHr 45-54" },
      { id: "incomebyage.A45I150_CY", label: "2025 HH Inc 150K-199999/HHr 45-54" },
      { id: "incomebyage.A45I200_CY", label: "2025 HH Inc $200000+/HHr 45-54" },
      { id: "incomebyage.IA45BASECY", label: "2025 HH Income Base: HHr 45-54" },
      // Other Age Group Income Bases
      { id: "incomebyage.IA55BASECY", label: "2025 HH Income Base: HHr 55-64" },
      { id: "incomebyage.IA65BASECY", label: "2025 HH Income Base: HHr 65-74" },
      { id: "incomebyage.IA75BASECY", label: "2025 HH Income Base: HHr 75+" },

      // Current Year Net Worth
      { id: "networth.NW0_CY", label: "2025 Net Worth <$15000" },
      { id: "networth.NW15_CY", label: "2025 Net Worth $15000-$34999" },
      { id: "networth.NW35_CY", label: "2025 Net Worth $35000-$49999" },
      { id: "networth.NW50_CY", label: "2025 Net Worth $50000-$74999" },
      { id: "networth.NW75_CY", label: "2025 Net Worth $75000-$99999" },
      { id: "networth.NW100_CY", label: "2025 Net Worth $100000-$149999" },
      { id: "networth.NW150_CY", label: "2025 Net Worth $150000-$249999" },
      { id: "networth.NW250_CY", label: "2025 Net Worth $250000-$499999" },
      { id: "networth.NW500_CY", label: "2025 Net Worth $500000-$999999" },
      { id: "networth.NW1M_CY", label: "2025 Net Worth $1000000-$1499999" },
      { id: "networth.NW1PT5M_CY", label: "2025 Net Worth $1500000-$1999999" },
      { id: "networth.NW2M_CY", label: "2025 Net Worth $2000000+" },
      { id: "networth.MEDNW_CY", label: "2025 Median Net Worth" },
      { id: "networth.AVGNW_CY", label: "2025 Average Net Worth" },

      // Current Year Housing
      { id: "KeyUSFacts.TOTHU_CY", label: "2025 Total Housing Units" },
      { id: "KeyUSFacts.OWNER_CY", label: "2025 Owner Occupied HUs" },
      { id: "KeyUSFacts.RENTER_CY", label: "2025 Renter Occupied HUs" },
      { id: "KeyUSFacts.VACANT_CY", label: "2025 Vacant Housing Units" },

      // Future Year Population
      { id: "KeyUSFacts.TOTPOP_FY", label: "2030 Total Population" },
      { id: "KeyUSFacts.TOTHH_FY", label: "2030 Total Households" },
      { id: "householdtotals.AVGHHSZ_FY", label: "2030 Average Household Size" },

      // Future Year Population by Age
      { id: "5yearincrements.POP0_FY", label: "2030 Population Age 0-4" },
      { id: "5yearincrements.POP5_FY", label: "2030 Population Age 5-9" },
      { id: "5yearincrements.POP10_FY", label: "2030 Population Age 10-14" },
      { id: "5yearincrements.POP15_FY", label: "2030 Population Age 15-19" },
      { id: "5yearincrements.POP20_FY", label: "2030 Population Age 20-24" },
      { id: "5yearincrements.POP25_FY", label: "2030 Population Age 25-29" },
      { id: "5yearincrements.POP30_FY", label: "2030 Population Age 30-34" },
      { id: "5yearincrements.POP35_FY", label: "2030 Population Age 35-39" },
      { id: "5yearincrements.POP40_FY", label: "2030 Population Age 40-44" },
      { id: "5yearincrements.POP45_FY", label: "2030 Population Age 45-49" },
      { id: "5yearincrements.POP50_FY", label: "2030 Population Age 50-54" },
      { id: "5yearincrements.POP55_FY", label: "2030 Population Age 55-59" },
      { id: "5yearincrements.POP60_FY", label: "2030 Population Age 60-64" },
      { id: "5yearincrements.POP65_FY", label: "2030 Population Age 65-69" },
      { id: "5yearincrements.POP70_FY", label: "2030 Population Age 70-74" },
      { id: "5yearincrements.POP75_FY", label: "2030 Population Age 75-79" },
      { id: "5yearincrements.POP80_FY", label: "2030 Population Age 80-84" },
      { id: "5yearincrements.POP85_FY", label: "2030 Population Age 85+" },
      { id: "5yearincrements.MEDAGE_FY", label: "2030 Median Age" },

      // Future Year Household Income
      { id: "householdincome.HINC0_FY", label: "2030 HH Income <$15000" },
      { id: "householdincome.HINC15_FY", label: "2030 HH Income $15000-24999" },
      { id: "householdincome.HINC25_FY", label: "2030 HH Income $25000-34999" },
      { id: "householdincome.HINC35_FY", label: "2030 HH Income $35000-49999" },
      { id: "householdincome.HINC50_FY", label: "2030 HH Income $50000-74999" },
      { id: "householdincome.HINC75_FY", label: "2030 HH Income $75000-99999" },
      { id: "householdincome.HINC100_FY", label: "2030 HH Income $100000-149999" },
      { id: "householdincome.HINC150_FY", label: "2030 HH Income $150000-199999" },
      { id: "householdincome.HINC200_FY", label: "2030 HH Income $200000+" },
      { id: "householdincome.MEDHINC_FY", label: "2030 Median Household Income" },
      { id: "householdincome.AVGHINC_FY", label: "2030 Average Household Income" },

      // Future Year Housing
      { id: "KeyUSFacts.TOTHU_FY", label: "2030 Total Housing Units" },
      { id: "KeyUSFacts.OWNER_FY", label: "2030 Owner Occupied HUs" },
      { id: "KeyUSFacts.RENTER_FY", label: "2030 Renter Occupied HUs" },
      { id: "KeyUSFacts.VACANT_FY", label: "2030 Vacant Housing Units" },

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
      { id: "tapestryhouseholds.THH01", label: "2025 HHs in Tapestry Seg 1A" },
      { id: "tapestryhouseholds.THH02", label: "2025 HHs in Tapestry Seg 1B" },
      { id: "tapestryhouseholds.THH03", label: "2025 HHs in Tapestry Seg 1C" },
      { id: "tapestryhouseholds.THH04", label: "2025 HHs in Tapestry Seg 1D" },
      { id: "tapestryhouseholds.THH05", label: "2025 HHs in Tapestry Seg 1E" },
      { id: "tapestryhouseholds.THH06", label: "2025 HHs in Tapestry Seg 2A" },
      { id: "tapestryhouseholds.THH07", label: "2025 HHs in Tapestry Seg 2B" },
      { id: "tapestryhouseholds.THH08", label: "2025 HHs in Tapestry Seg 2C" },
      { id: "tapestryhouseholds.THH09", label: "2025 HHs in Tapestry Seg 2D" },
      { id: "tapestryhouseholds.THH10", label: "2025 HHs in Tapestry Seg 3A" },
      { id: "tapestryhouseholds.THH11", label: "2025 HHs in Tapestry Seg 3B" },
      { id: "tapestryhouseholds.THH12", label: "2025 HHs in Tapestry Seg 3C" },
      { id: "tapestryhouseholds.THH13", label: "2025 HHs in Tapestry Seg 4A" },
      { id: "tapestryhouseholds.THH14", label: "2025 HHs in Tapestry Seg 4B" },
      { id: "tapestryhouseholds.THH15", label: "2025 HHs in Tapestry Seg 4C" },
      { id: "tapestryhouseholds.THH16", label: "2025 HHs in Tapestry Seg 5A" },
      { id: "tapestryhouseholds.THH17", label: "2025 HHs in Tapestry Seg 5B" },
      { id: "tapestryhouseholds.THH18", label: "2025 HHs in Tapestry Seg 5C" },
      { id: "tapestryhouseholds.THH19", label: "2025 HHs in Tapestry Seg 5D" },
      { id: "tapestryhouseholds.THH20", label: "2025 HHs in Tapestry Seg 5E" },
      { id: "tapestryhouseholds.THH21", label: "2025 HHs in Tapestry Seg 6A" },
      { id: "tapestryhouseholds.THH22", label: "2025 HHs in Tapestry Seg 6B" },
      { id: "tapestryhouseholds.THH23", label: "2025 HHs in Tapestry Seg 6C" },
      { id: "tapestryhouseholds.THH24", label: "2025 HHs in Tapestry Seg 6D" },
      { id: "tapestryhouseholds.THH25", label: "2025 HHs in Tapestry Seg 6E" },
      { id: "tapestryhouseholds.THH26", label: "2025 HHs in Tapestry Seg 6F" },
      { id: "tapestryhouseholds.THH27", label: "2025 HHs in Tapestry Seg 7A" },
      { id: "tapestryhouseholds.THH28", label: "2025 HHs in Tapestry Seg 7B" },
      { id: "tapestryhouseholds.THH29", label: "2025 HHs in Tapestry Seg 7C" },
      { id: "tapestryhouseholds.THH30", label: "2025 HHs in Tapestry Seg 7D" },
      { id: "tapestryhouseholds.THH31", label: "2025 HHs in Tapestry Seg 7E" },
      { id: "tapestryhouseholds.THH32", label: "2025 HHs in Tapestry Seg 7F" },
      { id: "tapestryhouseholds.THH33", label: "2025 HHs in Tapestry Seg 8A" },
      { id: "tapestryhouseholds.THH34", label: "2025 HHs in Tapestry Seg 8B" },
      { id: "tapestryhouseholds.THH35", label: "2025 HHs in Tapestry Seg 8C" },
      { id: "tapestryhouseholds.THH36", label: "2025 HHs in Tapestry Seg 8D" },
      { id: "tapestryhouseholds.THH37", label: "2025 HHs in Tapestry Seg 8E" },
      { id: "tapestryhouseholds.THH38", label: "2025 HHs in Tapestry Seg 8F" },
      { id: "tapestryhouseholds.THH39", label: "2025 HHs in Tapestry Seg 8G" },
      { id: "tapestryhouseholds.THH40", label: "2025 HHs in Tapestry Seg 9A" },
      { id: "tapestryhouseholds.THH41", label: "2025 HHs in Tapestry Seg 9B" },
      { id: "tapestryhouseholds.THH42", label: "2025 HHs in Tapestry Seg 9C" },
      { id: "tapestryhouseholds.THH43", label: "2025 HHs in Tapestry Seg 9D" },
      { id: "tapestryhouseholds.THH44", label: "2025 HHs in Tapestry Seg 9E" },
      { id: "tapestryhouseholds.THH45", label: "2025 HHs in Tapestry Seg 9F" },
      { id: "tapestryhouseholds.THH46", label: "2025 HHs in Tapestry Seg 10A" },
      { id: "tapestryhouseholds.THH47", label: "2025 HHs in Tapestry Seg 10B" },
      { id: "tapestryhouseholds.THH48", label: "2025 HHs in Tapestry Seg 10C" },
      { id: "tapestryhouseholds.THH49", label: "2025 HHs in Tapestry Seg 10D" },
      { id: "tapestryhouseholds.THH50", label: "2025 HHs in Tapestry Seg 10E" },
      { id: "tapestryhouseholds.THH51", label: "2025 HHs in Tapestry Seg 11A" },
      { id: "tapestryhouseholds.THH52", label: "2025 HHs in Tapestry Seg 11B" },
      { id: "tapestryhouseholds.THH53", label: "2025 HHs in Tapestry Seg 11C" },
      { id: "tapestryhouseholds.THH54", label: "2025 HHs in Tapestry Seg 11D" },
      { id: "tapestryhouseholds.THH55", label: "2025 HHs in Tapestry Seg 11E" },
      { id: "tapestryhouseholds.THH56", label: "2025 HHs in Tapestry Seg 12A" },
      { id: "tapestryhouseholds.THH57", label: "2025 HHs in Tapestry Seg 12B" },
      { id: "tapestryhouseholds.THH58", label: "2025 HHs in Tapestry Seg 12C" },
      { id: "tapestryhouseholds.THH59", label: "2025 HHs in Tapestry Seg 12D" },
      { id: "tapestryhouseholds.THH60", label: "2025 HHs in Tapestry Seg 13A" },
      { id: "tapestryhouseholds.THH61", label: "2025 HHs in Tapestry Seg 13B" },
      { id: "tapestryhouseholds.THH62", label: "2025 HHs in Tapestry Seg 13C" },
      { id: "tapestryhouseholds.THH63", label: "2025 HHs in Tapestry Seg 13D" },
      { id: "tapestryhouseholds.THH64", label: "2025 HHs in Tapestry Seg 13E" },
      { id: "tapestryhouseholds.THH65", label: "2025 HHs in Tapestry Seg 14A" },
      { id: "tapestryhouseholds.THH66", label: "2025 HHs in Tapestry Seg 14B" },
      { id: "tapestryhouseholds.THH67", label: "2025 HHs in Tapestry Seg 14C" },
    ]
  },
  tier2: {
    label: "Tier 2 Variables",
    variables: [
      // Current Year 1-Year Age Increments
      { id: "1yearincrements.AGE0_CY", label: "2025 Population Age <1" },
      { id: "1yearincrements.AGE1_CY", label: "2025 Population Age 1" },
      { id: "1yearincrements.AGE2_CY", label: "2025 Population Age 2" },
      { id: "1yearincrements.AGE3_CY", label: "2025 Population Age 3" },
      { id: "1yearincrements.AGE4_CY", label: "2025 Population Age 4" },
      { id: "1yearincrements.AGE5_CY", label: "2025 Population Age 5" },
      { id: "1yearincrements.AGE6_CY", label: "2025 Population Age 6" },
      { id: "1yearincrements.AGE7_CY", label: "2025 Population Age 7" },
      { id: "1yearincrements.AGE8_CY", label: "2025 Population Age 8" },
      { id: "1yearincrements.AGE9_CY", label: "2025 Population Age 9" },
      { id: "1yearincrements.AGE10_CY", label: "2025 Population Age 10" },
      { id: "1yearincrements.AGE11_CY", label: "2025 Population Age 11" },
      { id: "1yearincrements.AGE12_CY", label: "2025 Population Age 12" },
      { id: "1yearincrements.AGE13_CY", label: "2025 Population Age 13" },
      { id: "1yearincrements.AGE14_CY", label: "2025 Population Age 14" },
      { id: "1yearincrements.AGE15_CY", label: "2025 Population Age 15" },
      { id: "1yearincrements.AGE16_CY", label: "2025 Population Age 16" },
      { id: "1yearincrements.AGE17_CY", label: "2025 Population Age 17" },
      { id: "1yearincrements.AGE18_CY", label: "2025 Population Age 18" },
      { id: "1yearincrements.AGE19_CY", label: "2025 Population Age 19" },
      { id: "1yearincrements.AGE20_CY", label: "2025 Population Age 20" },
      { id: "1yearincrements.AGE21_CY", label: "2025 Population Age 21" },
      { id: "1yearincrements.AGE22_CY", label: "2025 Population Age 22" },
      { id: "1yearincrements.AGE23_CY", label: "2025 Population Age 23" },
      { id: "1yearincrements.AGE24_CY", label: "2025 Population Age 24" },
      { id: "1yearincrements.AGE25_CY", label: "2025 Population Age 25" },
      { id: "1yearincrements.AGE26_CY", label: "2025 Population Age 26" },
      { id: "1yearincrements.AGE27_CY", label: "2025 Population Age 27" },
      { id: "1yearincrements.AGE28_CY", label: "2025 Population Age 28" },
      { id: "1yearincrements.AGE29_CY", label: "2025 Population Age 29" },
      { id: "1yearincrements.AGE30_CY", label: "2025 Population Age 30" },
      { id: "1yearincrements.AGE31_CY", label: "2025 Population Age 31" },
      { id: "1yearincrements.AGE32_CY", label: "2025 Population Age 32" },
      { id: "1yearincrements.AGE33_CY", label: "2025 Population Age 33" },
      { id: "1yearincrements.AGE34_CY", label: "2025 Population Age 34" },
      { id: "1yearincrements.AGE35_CY", label: "2025 Population Age 35" },
      { id: "1yearincrements.AGE36_CY", label: "2025 Population Age 36" },
      { id: "1yearincrements.AGE37_CY", label: "2025 Population Age 37" },
      { id: "1yearincrements.AGE38_CY", label: "2025 Population Age 38" },
      { id: "1yearincrements.AGE39_CY", label: "2025 Population Age 39" },
      { id: "1yearincrements.AGE40_CY", label: "2025 Population Age 40" },
      { id: "1yearincrements.AGE41_CY", label: "2025 Population Age 41" },
      { id: "1yearincrements.AGE42_CY", label: "2025 Population Age 42" },
      { id: "1yearincrements.AGE43_CY", label: "2025 Population Age 43" },
      { id: "1yearincrements.AGE44_CY", label: "2025 Population Age 44" },
      { id: "1yearincrements.AGE45_CY", label: "2025 Population Age 45" },
      { id: "1yearincrements.AGE46_CY", label: "2025 Population Age 46" },
      { id: "1yearincrements.AGE47_CY", label: "2025 Population Age 47" },
      { id: "1yearincrements.AGE48_CY", label: "2025 Population Age 48" },
      { id: "1yearincrements.AGE49_CY", label: "2025 Population Age 49" },
      { id: "1yearincrements.AGE50_CY", label: "2025 Population Age 50" },
      { id: "1yearincrements.AGE51_CY", label: "2025 Population Age 51" },
      { id: "1yearincrements.AGE52_CY", label: "2025 Population Age 52" },
      { id: "1yearincrements.AGE53_CY", label: "2025 Population Age 53" },
      { id: "1yearincrements.AGE54_CY", label: "2025 Population Age 54" },
      { id: "1yearincrements.AGE55_CY", label: "2025 Population Age 55" },
      { id: "1yearincrements.AGE56_CY", label: "2025 Population Age 56" },
      { id: "1yearincrements.AGE57_CY", label: "2025 Population Age 57" },
      { id: "1yearincrements.AGE58_CY", label: "2025 Population Age 58" },
      { id: "1yearincrements.AGE59_CY", label: "2025 Population Age 59" },
      { id: "1yearincrements.AGE60_CY", label: "2025 Population Age 60" },
      { id: "1yearincrements.AGE61_CY", label: "2025 Population Age 61" },
      { id: "1yearincrements.AGE62_CY", label: "2025 Population Age 62" },
      { id: "1yearincrements.AGE63_CY", label: "2025 Population Age 63" },
      { id: "1yearincrements.AGE64_CY", label: "2025 Population Age 64" },
      { id: "1yearincrements.AGE65_CY", label: "2025 Population Age 65" },
      { id: "1yearincrements.AGE66_CY", label: "2025 Population Age 66" },
      { id: "1yearincrements.AGE67_CY", label: "2025 Population Age 67" },
      { id: "1yearincrements.AGE68_CY", label: "2025 Population Age 68" },
      { id: "1yearincrements.AGE69_CY", label: "2025 Population Age 69" },
      { id: "1yearincrements.AGE70_CY", label: "2025 Population Age 70" },
      { id: "1yearincrements.AGE71_CY", label: "2025 Population Age 71" },
      { id: "1yearincrements.AGE72_CY", label: "2025 Population Age 72" },
      { id: "1yearincrements.AGE73_CY", label: "2025 Population Age 73" },
      { id: "1yearincrements.AGE74_CY", label: "2025 Population Age 74" },
      { id: "1yearincrements.AGE75_CY", label: "2025 Population Age 75" },
      { id: "1yearincrements.AGE76_CY", label: "2025 Population Age 76" },
      { id: "1yearincrements.AGE77_CY", label: "2025 Population Age 77" },
      { id: "1yearincrements.AGE78_CY", label: "2025 Population Age 78" },
      { id: "1yearincrements.AGE79_CY", label: "2025 Population Age 79" },
      { id: "1yearincrements.AGE80_CY", label: "2025 Population Age 80" },
      { id: "1yearincrements.AGE81_CY", label: "2025 Population Age 81" },
      { id: "1yearincrements.AGE82_CY", label: "2025 Population Age 82" },
      { id: "1yearincrements.AGE83_CY", label: "2025 Population Age 83" },
      { id: "1yearincrements.AGE84_CY", label: "2025 Population Age 84" },

      // Future Year 1-Year Age Increments
      { id: "1yearincrements.AGE0_FY", label: "2030 Population Age <1" },
      { id: "1yearincrements.AGE1_FY", label: "2030 Population Age 1" },
      { id: "1yearincrements.AGE2_FY", label: "2030 Population Age 2" },
      { id: "1yearincrements.AGE3_FY", label: "2030 Population Age 3" },
      { id: "1yearincrements.AGE4_FY", label: "2030 Population Age 4" },
      { id: "1yearincrements.AGE5_FY", label: "2030 Population Age 5" },
      { id: "1yearincrements.AGE6_FY", label: "2030 Population Age 6" },
      { id: "1yearincrements.AGE7_FY", label: "2030 Population Age 7" },
      { id: "1yearincrements.AGE8_FY", label: "2030 Population Age 8" },
      { id: "1yearincrements.AGE9_FY", label: "2030 Population Age 9" },
      { id: "1yearincrements.AGE10_FY", label: "2030 Population Age 10" },
      { id: "1yearincrements.AGE11_FY", label: "2030 Population Age 11" },
      { id: "1yearincrements.AGE12_FY", label: "2030 Population Age 12" },
      { id: "1yearincrements.AGE13_FY", label: "2030 Population Age 13" },
      { id: "1yearincrements.AGE14_FY", label: "2030 Population Age 14" },
      { id: "1yearincrements.AGE15_FY", label: "2030 Population Age 15" },

      { id: "1yearincrements.AGE16_FY", label: "2030 Population Age 16" },
      { id: "1yearincrements.AGE17_FY", label: "2030 Population Age 17" },
      { id: "1yearincrements.AGE18_FY", label: "2030 Population Age 18" },
      { id: "1yearincrements.AGE19_FY", label: "2030 Population Age 19" },
      { id: "1yearincrements.AGE20_FY", label: "2030 Population Age 20" },
      { id: "1yearincrements.AGE21_FY", label: "2030 Population Age 21" },
      { id: "1yearincrements.AGE22_FY", label: "2030 Population Age 22" },
      { id: "1yearincrements.AGE23_FY", label: "2030 Population Age 23" },
      { id: "1yearincrements.AGE24_FY", label: "2030 Population Age 24" },
      { id: "1yearincrements.AGE25_FY", label: "2030 Population Age 25" },
      { id: "1yearincrements.AGE26_FY", label: "2030 Population Age 26" },
      { id: "1yearincrements.AGE27_FY", label: "2030 Population Age 27" },
      { id: "1yearincrements.AGE28_FY", label: "2030 Population Age 28" },
      { id: "1yearincrements.AGE29_FY", label: "2030 Population Age 29" },
      { id: "1yearincrements.AGE30_FY", label: "2030 Population Age 30" },
      { id: "1yearincrements.AGE31_FY", label: "2030 Population Age 31" },
      { id: "1yearincrements.AGE32_FY", label: "2030 Population Age 32" },
      { id: "1yearincrements.AGE33_FY", label: "2030 Population Age 33" },
      { id: "1yearincrements.AGE34_FY", label: "2030 Population Age 34" },
      { id: "1yearincrements.AGE35_FY", label: "2030 Population Age 35" },
      { id: "1yearincrements.AGE36_FY", label: "2030 Population Age 36" },
      { id: "1yearincrements.AGE37_FY", label: "2030 Population Age 37" },
      { id: "1yearincrements.AGE38_FY", label: "2030 Population Age 38" },
      { id: "1yearincrements.AGE39_FY", label: "2030 Population Age 39" },
      { id: "1yearincrements.AGE40_FY", label: "2030 Population Age 40" },
      { id: "1yearincrements.AGE41_FY", label: "2030 Population Age 41" },
      { id: "1yearincrements.AGE42_FY", label: "2030 Population Age 42" },
      { id: "1yearincrements.AGE43_FY", label: "2030 Population Age 43" },
      { id: "1yearincrements.AGE44_FY", label: "2030 Population Age 44" },
      { id: "1yearincrements.AGE45_FY", label: "2030 Population Age 45" },
      { id: "1yearincrements.AGE46_FY", label: "2030 Population Age 46" },
      { id: "1yearincrements.AGE47_FY", label: "2030 Population Age 47" },
      { id: "1yearincrements.AGE48_FY", label: "2030 Population Age 48" },
      { id: "1yearincrements.AGE49_FY", label: "2030 Population Age 49" },
      { id: "1yearincrements.AGE50_FY", label: "2030 Population Age 50" },
      { id: "1yearincrements.AGE51_FY", label: "2030 Population Age 51" },
      { id: "1yearincrements.AGE52_FY", label: "2030 Population Age 52" },
      { id: "1yearincrements.AGE53_FY", label: "2030 Population Age 53" },
      { id: "1yearincrements.AGE54_FY", label: "2030 Population Age 54" },
      { id: "1yearincrements.AGE55_FY", label: "2030 Population Age 55" },
      { id: "1yearincrements.AGE56_FY", label: "2030 Population Age 56" },
      { id: "1yearincrements.AGE57_FY", label: "2030 Population Age 57" },
      { id: "1yearincrements.AGE58_FY", label: "2030 Population Age 58" },
      { id: "1yearincrements.AGE59_FY", label: "2030 Population Age 59" },
      { id: "1yearincrements.AGE60_FY", label: "2030 Population Age 60" },
      { id: "1yearincrements.AGE61_FY", label: "2030 Population Age 61" },
      { id: "1yearincrements.AGE62_FY", label: "2030 Population Age 62" },
      { id: "1yearincrements.AGE63_FY", label: "2030 Population Age 63" },
      { id: "1yearincrements.AGE64_FY", label: "2030 Population Age 64" },
      { id: "1yearincrements.AGE65_FY", label: "2030 Population Age 65" },
      { id: "1yearincrements.AGE66_FY", label: "2030 Population Age 66" },
      { id: "1yearincrements.AGE67_FY", label: "2030 Population Age 67" },
      { id: "1yearincrements.AGE68_FY", label: "2030 Population Age 68" },
      { id: "1yearincrements.AGE69_FY", label: "2030 Population Age 69" },
      { id: "1yearincrements.AGE70_FY", label: "2030 Population Age 70" },
      { id: "1yearincrements.AGE71_FY", label: "2030 Population Age 71" },
      { id: "1yearincrements.AGE72_FY", label: "2030 Population Age 72" },
      { id: "1yearincrements.AGE73_FY", label: "2030 Population Age 73" },
      { id: "1yearincrements.AGE74_FY", label: "2030 Population Age 74" },
      { id: "1yearincrements.AGE75_FY", label: "2030 Population Age 75" },
      { id: "1yearincrements.AGE76_FY", label: "2030 Population Age 76" },
      { id: "1yearincrements.AGE77_FY", label: "2030 Population Age 77" },
      { id: "1yearincrements.AGE78_FY", label: "2030 Population Age 78" },
      { id: "1yearincrements.AGE79_FY", label: "2030 Population Age 79" },
      { id: "1yearincrements.AGE80_FY", label: "2030 Population Age 80" },
      { id: "1yearincrements.AGE81_FY", label: "2030 Population Age 81" },
      { id: "1yearincrements.AGE82_FY", label: "2030 Population Age 82" },
      { id: "1yearincrements.AGE83_FY", label: "2030 Population Age 83" },
      { id: "1yearincrements.AGE84_FY", label: "2030 Population Age 84" },

      // Educational Attainment
      { id: "educationalattainment.HSGRAD_CY", label: "2025 Pop Age 25+: High School Diploma" },
      { id: "educationalattainment.GED_CY", label: "2025 Pop Age 25+: GED" },
      { id: "educationalattainment.SMCOLL_CY", label: "2025 Pop Age 25+: Some College/No Degree" },
      { id: "educationalattainment.ASSCDEG_CY", label: "2025 Pop Age 25+: Associate's Degree" },
      { id: "educationalattainment.BACHDEG_CY", label: "2025 Pop Age 25+: Bachelor's Degree" },
      { id: "educationalattainment.GRADDEG_CY", label: "2025 Pop Age 25+: Grad/Professional Degree" },
      { id: "educationalattainment.EDUCBASECY", label: "2025 Educational Attainment Base" },

      // Future Year Income Base by Age
      { id: "incomebyage.IA15BASEFY", label: "2030 HH Income Base: HHr 15-24" },
      { id: "incomebyage.IA25BASEFY", label: "2030 HH Income Base: HHr 25-34" },
      { id: "incomebyage.IA35BASEFY", label: "2030 HH Income Base: HHr 35-44" },
      { id: "incomebyage.IA45BASEFY", label: "2030 HH Income Base: HHr 45-54" },
      { id: "incomebyage.IA55BASEFY", label: "2030 HH Income Base: HHr 55-64" },
      { id: "incomebyage.IA65BASEFY", label: "2030 HH Income Base: HHr 65-74" },
      { id: "incomebyage.IA75BASEFY", label: "2030 HH Income Base: HHr 75+" },

      { id: "incomebyage.MEDIA15_CY", label: "2025 Median HH Inc: HHr 15-24" },
      { id: "incomebyage.MEDIA25_CY", label: "2025 Median HH Inc: HHr 25-34" },
      { id: "incomebyage.MEDIA35_CY", label: "2025 Median HH Inc: HHr 35-44" },
      { id: "incomebyage.MEDIA45_CY", label: "2025 Median HH Inc: HHr 45-54" },
      { id: "incomebyage.MEDIA55_CY", label: "2025 Median HH Inc: HHr 55-64" },
      { id: "incomebyage.MEDIA65_CY", label: "2025 Median HH Inc: HHr 65-74" },
      { id: "incomebyage.MEDIA75_CY", label: "2025 Median HH Inc: HHr 75+" },


      { id: "incomebyage.A15I0_CY", label: "2025 HH Inc <$15000/HHr 15-24" },
      { id: "incomebyage.A15I15_CY", label: "2025 HH Inc $15K-24999/HHr 15-24" },
      { id: "incomebyage.A15I25_CY", label: "2025 HH Inc $25K-34999/HHr 15-24" },
      { id: "incomebyage.A15I35_CY", label: "2025 HH Inc $35K-49999/HHr 15-24" },
      { id: "incomebyage.A15I50_CY", label: "2025 HH Inc $50K-74999/HHr 15-24" },
      { id: "incomebyage.A15I75_CY", label: "2025 HH Inc $75K-99999/HHr 15-24" },
      { id: "incomebyage.A15I100_CY", label: "2025 HH Inc 100K-149999/HHr 15-24" },
      { id: "incomebyage.A15I150_CY", label: "2025 HH Inc 150K-199999/HHr 15-24" },
      { id: "incomebyage.A15I200_CY", label: "2025 HH Inc $200000+/HHr 15-24" },
      { id: "incomebyage.A55I0_CY", label: "2025 HH Inc <$15000/HHr 55-64" },
      { id: "incomebyage.A55I15_CY", label: "2025 HH Inc $15K-24999/HHr 55-64" },
      { id: "incomebyage.A55I25_CY", label: "2025 HH Inc $25K-34999/HHr 55-64" },
      { id: "incomebyage.A55I35_CY", label: "2025 HH Inc $35K-49999/HHr 55-64" },
      { id: "incomebyage.A55I50_CY", label: "2025 HH Inc $50K-74999/HHr 55-64" },
      { id: "incomebyage.A55I75_CY", label: "2025 HH Inc $75K-99999/HHr 55-64" },
      { id: "incomebyage.A55I100_CY", label: "2025 HH Inc 100K-149999/HHr 55-64" },
      { id: "incomebyage.A55I150_CY", label: "2025 HH Inc 150K-199999/HHr 55-64" },
      { id: "incomebyage.A55I200_CY", label: "2025 HH Inc $200000+/HHr 55-64" },
      { id: "incomebyage.A65I0_CY", label: "2025 HH Inc <$15000/HHr 65-74" },
      { id: "incomebyage.A65I15_CY", label: "2025 HH Inc $15K-24999/HHr 65-74" },
      { id: "incomebyage.A65I25_CY", label: "2025 HH Inc $25K-34999/HHr 65-74" },
      { id: "incomebyage.A65I35_CY", label: "2025 HH Inc $35K-49999/HHr 65-74" },
      { id: "incomebyage.A65I50_CY", label: "2025 HH Inc $50K-74999/HHr 65-74" },
      { id: "incomebyage.A65I75_CY", label: "2025 HH Inc $75K-99999/HHr 65-74" },
      { id: "incomebyage.A65I100_CY", label: "2025 HH Inc 100K-149999/HHr 65-74" },
      { id: "incomebyage.A65I150_CY", label: "2025 HH Inc 150K-199999/HHr 65-74" },
      { id: "incomebyage.A65I200_CY", label: "2025 HH Inc $200000+/HHr 65-74" },
      { id: "incomebyage.A75I0_CY", label: "2025 HH Inc <$15000/HHr 75+" },
      { id: "incomebyage.A75I15_CY", label: "2025 HH Inc $15K-24999/HHr 75+" },
      { id: "incomebyage.A75I25_CY", label: "2025 HH Inc $25K-34999/HHr 75+" },
      { id: "incomebyage.A75I35_CY", label: "2025 HH Inc $35K-49999/HHr 75+" },
      { id: "incomebyage.A75I50_CY", label: "2025 HH Inc $50K-74999/HHr 75+" },
      { id: "incomebyage.A75I75_CY", label: "2025 HH Inc $75K-99999/HHr 75+" },
      { id: "incomebyage.A75I100_CY", label: "2025 HH Inc 100K-149999/HHr 75+" },
      { id: "incomebyage.A75I150_CY", label: "2025 HH Inc 150K-199999/HHr 75+" },
      { id: "incomebyage.A75I200_CY", label: "2025 HH Inc $200000+/HHr 75+" },
      { id: "networth.MEDNWA15CY", label: "2025 Median Net Worth: HHr 15-24" },
      { id: "networth.MEDNWA25CY", label: "2025 Median Net Worth: HHr 25-34" },
      { id: "networth.MEDNWA35CY", label: "2025 Median Net Worth: HHr 35-44" },
      { id: "networth.MEDNWA45CY", label: "2025 Median Net Worth: HHr 45-54" },
      { id: "networth.MEDNWA55CY", label: "2025 Median Net Worth: HHr 55-64" },
      { id: "networth.MEDNWA65CY", label: "2025 Median Net Worth: HHr 65-74" },
      { id: "networth.MEDNWA75CY", label: "2025 Median Net Worth: HHr 75+" },
      { id: "networth.A15NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 15-24" },
      { id: "networth.A25NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 25-34" },
      { id: "networth.A35NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 35-44" },
      { id: "networth.A45NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 45-54" },
      { id: "networth.A55NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 55-64" },
      { id: "networth.A65NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 65-74" },
      { id: "networth.A75NW1M_CY", label: "2025 HH Net Worth $1000000+/HHr 75+" },

      // Age 15-24 Income Brackets
      { id: "incomebyage.A15I0_FY", label: "2030 HH Inc <$15000/HHr 15-24" },
      { id: "incomebyage.A15I15_FY", label: "2030 HH Inc $15K-24999/HHr 15-24" },
      { id: "incomebyage.A15I25_FY", label: "2030 HH Inc $25K-34999/HHr 15-24" },
      { id: "incomebyage.A15I35_FY", label: "2030 HH Inc $35K-49999/HHr 15-24" },
      { id: "incomebyage.A15I50_FY", label: "2030 HH Inc $50K-74999/HHr 15-24" },
      { id: "incomebyage.A15I75_FY", label: "2030 HH Inc $75K-99999/HHr 15-24" },
      { id: "incomebyage.A15I100_FY", label: "2030 HH Inc 100K-149999/HHr 15-24" },
      { id: "incomebyage.A15I150_FY", label: "2030 HH Inc 150K-199999/HHr 15-24" },
      { id: "incomebyage.A15I200_FY", label: "2030 HH Inc $200000+/HHr 15-24" },

      // Age 25-34 Income Brackets
      { id: "incomebyage.A25I0_FY", label: "2030 HH Inc <$15000/HHr 25-34" },
      { id: "incomebyage.A25I15_FY", label: "2030 HH Inc $15K-24999/HHr 25-34" },
      { id: "incomebyage.A25I25_FY", label: "2030 HH Inc $25K-34999/HHr 25-34" },
      { id: "incomebyage.A25I35_FY", label: "2030 HH Inc $35K-49999/HHr 25-34" },
      { id: "incomebyage.A25I50_FY", label: "2030 HH Inc $50K-74999/HHr 25-34" },
      { id: "incomebyage.A25I75_FY", label: "2030 HH Inc $75K-99999/HHr 25-34" },
      { id: "incomebyage.A25I100_FY", label: "2030 HH Inc 100K-149999/HHr 25-34" },
      { id: "incomebyage.A25I150_FY", label: "2030 HH Inc 150K-199999/HHr 25-34" },
      { id: "incomebyage.A25I200_FY", label: "2030 HH Inc $200000+/HHr 25-34" },

      // Age 35-44 Income Brackets
      { id: "incomebyage.A35I0_FY", label: "2030 HH Inc <$15000/HHr 35-44" },
      { id: "incomebyage.A35I15_FY", label: "2030 HH Inc $15K-24999/HHr 35-44" },
      { id: "incomebyage.A35I25_FY", label: "2030 HH Inc $25K-34999/HHr 35-44" },
      { id: "incomebyage.A35I35_FY", label: "2030 HH Inc $35K-49999/HHr 35-44" },
      { id: "incomebyage.A35I50_FY", label: "2030 HH Inc $50K-74999/HHr 35-44" },
      { id: "incomebyage.A35I75_FY", label: "2030 HH Inc $75K-99999/HHr 35-44" },
      { id: "incomebyage.A35I100_FY", label: "2030 HH Inc 100K-149999/HHr 35-44" },
      { id: "incomebyage.A35I150_FY", label: "2030 HH Inc 150K-199999/HHr 35-44" },
      { id: "incomebyage.A35I200_FY", label: "2030 HH Inc $200000+/HHr 35-44" },

      // Age 45-54 Income Brackets
      { id: "incomebyage.A45I0_FY", label: "2030 HH Inc <$15000/HHr 45-54" },
      { id: "incomebyage.A45I15_FY", label: "2030 HH Inc $15K-24999/HHr 45-54" },
      { id: "incomebyage.A45I25_FY", label: "2030 HH Inc $25K-34999/HHr 45-54" },
      { id: "incomebyage.A45I35_FY", label: "2030 HH Inc $35K-49999/HHr 45-54" },
      { id: "incomebyage.A45I50_FY", label: "2030 HH Inc $50K-74999/HHr 45-54" },
      { id: "incomebyage.A45I75_FY", label: "2030 HH Inc $75K-99999/HHr 45-54" },
      { id: "incomebyage.A45I100_FY", label: "2030 HH Inc 100K-149999/HHr 45-54" },
      { id: "incomebyage.A45I150_FY", label: "2030 HH Inc 150K-199999/HHr 45-54" },
      { id: "incomebyage.A45I200_FY", label: "2030 HH Inc $200000+/HHr 45-54" },

      // Age 55-64 Income Brackets
      { id: "incomebyage.A55I0_FY", label: "2030 HH Inc <$15000/HHr 55-64" },
      { id: "incomebyage.A55I15_FY", label: "2030 HH Inc $15K-24999/HHr 55-64" },
      { id: "incomebyage.A55I25_FY", label: "2030 HH Inc $25K-34999/HHr 55-64" },
      { id: "incomebyage.A55I35_FY", label: "2030 HH Inc $35K-49999/HHr 55-64" },
      { id: "incomebyage.A55I50_FY", label: "2030 HH Inc $50K-74999/HHr 55-64" },
      { id: "incomebyage.A55I75_FY", label: "2030 HH Inc $75K-99999/HHr 55-64" },
      { id: "incomebyage.A55I100_FY", label: "2030 HH Inc 100K-149999/HHr 55-64" },
      { id: "incomebyage.A55I150_FY", label: "2030 HH Inc 150K-199999/HHr 55-64" },
      { id: "incomebyage.A55I200_FY", label: "2030 HH Inc $200000+/HHr 55-64" },

      // Age 65-74 Income Brackets
      { id: "incomebyage.A65I0_FY", label: "2030 HH Inc <$15000/HHr 65-74" },
      { id: "incomebyage.A65I15_FY", label: "2030 HH Inc $15K-24999/HHr 65-74" },
      { id: "incomebyage.A65I25_FY", label: "2030 HH Inc $25K-34999/HHr 65-74" },
      { id: "incomebyage.A65I35_FY", label: "2030 HH Inc $35K-49999/HHr 65-74" },
      { id: "incomebyage.A65I50_FY", label: "2030 HH Inc $50K-74999/HHr 65-74" },
      { id: "incomebyage.A65I75_FY", label: "2030 HH Inc $75K-99999/HHr 65-74" },
      { id: "incomebyage.A65I100_FY", label: "2030 HH Inc 100K-149999/HHr 65-74" },
      { id: "incomebyage.A65I150_FY", label: "2030 HH Inc 150K-199999/HHr 65-74" },
      { id: "incomebyage.A65I200_FY", label: "2030 HH Inc $200000+/HHr 65-74" },

      // Age 75+ Income Brackets
      { id: "incomebyage.A75I0_FY", label: "2030 HH Inc <$15000/HHr 75+" },
      { id: "incomebyage.A75I15_FY", label: "2030 HH Inc $15K-24999/HHr 75+" },
      { id: "incomebyage.A75I25_FY", label: "2030 HH Inc $25K-34999/HHr 75+" },
      { id: "incomebyage.A75I35_FY", label: "2030 HH Inc $35K-49999/HHr 75+" },
      { id: "incomebyage.A75I50_FY", label: "2030 HH Inc $50K-74999/HHr 75+" },
      { id: "incomebyage.A75I75_FY", label: "2030 HH Inc $75K-99999/HHr 75+" },
      { id: "incomebyage.A75I100_FY", label: "2030 HH Inc 100K-149999/HHr 75+" },
      { id: "incomebyage.A75I150_FY", label: "2030 HH Inc 150K-199999/HHr 75+" },
      { id: "incomebyage.A75I200_FY", label: "2030 HH Inc $200000+/HHr 75+" },

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
      { id: "incomebyage.AVGIA15_CY", label: "2025 Average HH Inc: HHr 15-24" },
      { id: "incomebyage.AVGIA25_CY", label: "2025 Average HH Inc: HHr 25-34" },
      { id: "incomebyage.AVGIA35_CY", label: "2025 Average HH Inc: HHr 35-44" },
      { id: "incomebyage.AVGIA45_CY", label: "2025 Average HH Inc: HHr 45-54" },
      { id: "incomebyage.AVGIA55_CY", label: "2025 Average HH Inc: HHr 55-64" },
      { id: "incomebyage.AVGIA65_CY", label: "2025 Average HH Inc: HHr 65-74" },
      { id: "incomebyage.AVGIA75_CY", label: "2025 Average HH Inc: HHr 75+" },
    
      { id: "incomebyage.AVGIA15_CY", label: "2025 Average HH Inc: HHr 15-24" },
      { id: "incomebyage.AVGIA25_CY", label: "2025 Average HH Inc: HHr 25-34" },
      { id: "incomebyage.AVGIA35_CY", label: "2025 Average HH Inc: HHr 35-44" },
      { id: "incomebyage.AVGIA45_CY", label: "2025 Average HH Inc: HHr 45-54" },
      { id: "incomebyage.AVGIA55_CY", label: "2025 Average HH Inc: HHr 55-64" },
      { id: "incomebyage.AVGIA65_CY", label: "2025 Average HH Inc: HHr 65-74" },
      { id: "incomebyage.AVGIA75_CY", label: "2025 Average HH Inc: HHr 75+" },

      // NEW VARIABLES - Add these at the end of tier2 variables array
      // Future Year Median Household Income by Age Groups
      { id: "incomebyage.MEDIA15_FY", label: "2030 Median HH Inc: HHr 15-24" },
      { id: "incomebyage.MEDIA25_FY", label: "2030 Median HH Inc: HHr 25-34" },
      { id: "incomebyage.MEDIA35_FY", label: "2030 Median HH Inc: HHr 35-44" },
      { id: "incomebyage.MEDIA45_FY", label: "2030 Median HH Inc: HHr 45-54" },
      { id: "incomebyage.MEDIA55_FY", label: "2030 Median HH Inc: HHr 55-64" },
      { id: "incomebyage.MEDIA65_FY", label: "2030 Median HH Inc: HHr 65-74" },
      { id: "incomebyage.MEDIA75_FY", label: "2030 Median HH Inc: HHr 75+" },

      // Median Household Income by Age Groups - Consolidated Age Ranges
      { id: "incomebyage.MEDIA55UFY", label: "2030 Median HH Inc: HHr 55+" },
      { id: "incomebyage.MEDIA65UFY", label: "2030 Median HH Inc: HHr 65+" },
      { id: "incomebyage.MEDIA65UCY", label: "2025 Median HH Inc: HHr 65+" },
      { id: "incomebyage.MEDIA55UCY", label: "2025 Median HH Inc: HHr 55+" },
      { id: "incomebyage.MEDIA75_CY", label: "2025 Median HH Inc: HHr 75+" },
    ]
  },

  
  retail: {
    label: "Retail Variables",
    variables: [
      { id: "HousingHousehold.X4043_A", label: "2025 Household Furnishings & Equipment (Average)" },
      { id: "entertainment.X9051_A", label: "2025 Sports/Rec/Exercise Equipment (Average)" },
      { id: "entertainment.X9024_A", label: "2025 Audio (Average)" },
      { id: "entertainment.X9065_A", label: "2025 Reading (Average)" },
      { id: "HousingHousehold.X4063_A", label: "2025 Major Appliances (Average)" },
      { id: "clothing.X5001_A", label: "2025 Apparel & Services (Average)" },
      { id: "clothing.X5002_A", label: "2025 Men`s Apparel (Average)" },
      { id: "clothing.X5016_A", label: "2025 Women`s Apparel (Average)" },
      { id: "clothing.X5032_A", label: "2025 Children`s Apparel (Average)" },
      { id: "clothing.X5063_A", label: "2025 Footwear (Average)" },
      { id: "food.X1131_A", label: "2025 Meals at Restaurants/Other (Average)" },
      { id: "food.X1156_A", label: "2025 Food and Nonalcoholic Beverages at Fast Food (Average)" },
      { id: "food.X1157_A", label: "2025 Food and Nonalcoholic Beverages at Full Service Restaurants (Average)" },
      { id: "food.X1130_A", label: "2025 Food Away from Home (Average)" },
      { id: "food.X2007_A", label: "2025 Alcoholic Beverages Away from Home (Average)" },
      { id: "SpendingTotal.X15001_A", label: "2025 Retail Goods (Average)" },
      { id: "entertainment.X9036_A", label: "2025 Pet Food (Average)" },
      { id: "entertainment.X9037_A", label: "2025 Pets/Pet Supplies/Medicine for Pets (Average)" },
      { id: "entertainment.X9038_A", label: "2025 Pet Services (Average)" },
      { id: "entertainment.X9039_A", label: "2025 Vet Services (Average)" },
      { id: "transportation.X6011_A", label: "2025 Gasoline (Average)" },
      { id: "transportation.X6015_A", label: "2025 Vehicle Maintenance & Repairs (Average)" },
      { id: "HousingHousehold.X4043_I", label: "2025 Household Furnishings & Equipment (Index)" },
      { id: "entertainment.X9051_I", label: "2025 Sports/Rec/Exercise Equipment (Index)" },
      { id: "entertainment.X9024_I", label: "2025 Audio (Index)" },
      { id: "entertainment.X9065_I", label: "2025 Reading (Index)" },
      { id: "HousingHousehold.X4063_I", label: "2025 Major Appliances (Index)" },
      { id: "clothing.X5001_I", label: "2025 Apparel & Services (Index)" },
      { id: "clothing.X5002_I", label: "2025 Men`s Apparel (Index)" },
      { id: "clothing.X5016_I", label: "2025 Women`s Apparel (Index)" },
      { id: "clothing.X5032_I", label: "2025 Children`s Apparel (Index)" },
      { id: "clothing.X5063_I", label: "2025 Footwear (Index)" },
      { id: "food.X1131_I", label: "2025 Meals at Restaurants/Other (Index)" },
      { id: "food.X1156_I", label: "2025 Food and Nonalcoholic Beverages at Fast Food (Index)" },
      { id: "food.X1157_I", label: "2025 Food and Nonalcoholic Beverages at Full Service Restaurants (Index)" },
      { id: "food.X1130_I", label: "2025 Food Away from Home (Index)" },
      { id: "food.X2007_I", label: "2025 Alcoholic Beverages Away from Home (Index)" },
      { id: "SpendingTotal.X15001_I", label: "2025 Retail Goods (Index)" },
      { id: "entertainment.X9036_I", label: "2025 Pet Food (Index)" },
      { id: "entertainment.X9037_I", label: "2025 Pets/Pet Supplies/Medicine for Pets (Index)" },
      { id: "entertainment.X9038_I", label: "2025 Pet Services (Index)" },
      { id: "entertainment.X9039_I", label: "2025 Vet Services (Index)" },
      { id: "transportation.X6011_I", label: "2025 Gasoline (Index)" },
      { id: "transportation.X6015_I", label: "2025 Vehicle Maintenance & Repairs (Index)" },
      { id: "HousingHousehold.X4043FY_A", label: "2030 Household Furnishings & Equipment (Average)" },
      { id: "entertainment.X9051FY_A", label: "2030 Sports/Rec/Exercise Equipment (Average)" },
      { id: "entertainment.X9024FY_A", label: "2030 Audio (Average)" },
      { id: "entertainment.X9065FY_A", label: "2030 Reading (Average)" },
      { id: "HousingHousehold.X4063FY_A", label: "2030 Major Appliances (Average)" },
      { id: "clothing.X5001FY_A", label: "2030 Apparel & Services (Average)" },
      { id: "clothing.X5002FY_A", label: "2030 Men`s Apparel (Average)" },
      { id: "clothing.X5016FY_A", label: "2030 Women`s Apparel (Average)" },
      { id: "clothing.X5032FY_A", label: "2030 Children`s Apparel (Average)" },
      { id: "clothing.X5063FY_A", label: "2030 Footwear (Average)" },
      { id: "food.X1131FY_A", label: "2030 Meals at Restaurants/Other (Average)" },
      { id: "food.X1156FY_A", label: "2030 Food and Nonalcoholic Beverages at Fast Food (Average)" },
      { id: "food.X1157FY_A", label: "2030 Food and Nonalcoholic Beverages at Full Service Restaurants (Average)" },
      { id: "food.X1130FY_A", label: "2030 Food Away from Home (Average)" },
      { id: "food.X2007FY_A", label: "2030 Alcoholic Beverages Away from Home (Average)" },
      { id: "SpendingTotal.X15001FY_A", label: "2030 Retail Goods (Average)" },
      { id: "entertainment.X9036FY_A", label: "2030 Pet Food (Average)" },
      { id: "entertainment.X9037FY_A", label: "2030 Pets/Pet Supplies/Medicine for Pets (Average)" },
      { id: "entertainment.X9038FY_A", label: "2030 Pet Services (Average)" },
      { id: "entertainment.X9039FY_A", label: "2030 Vet Services (Average)" },
      { id: "transportation.X6011FY_A", label: "2030 Gasoline (Average)" },
      { id: "transportation.X6015FY_A", label: "2030 Vehicle Maintenance & Repairs (Average)" },
      { id: "HousingHousehold.X4043FY_I", label: "2030 Household Furnishings & Equipment (Index)" },
      { id: "entertainment.X9051FY_I", label: "2030 Sports/Rec/Exercise Equipment (Index)" },
      { id: "entertainment.X9024FY_I", label: "2030 Audio (Index)" },
      { id: "entertainment.X9065FY_I", label: "2030 Reading (Index)" },
      { id: "HousingHousehold.X4063FY_I", label: "2030 Major Appliances (Index)" },
      { id: "clothing.X5001FY_I", label: "2030 Apparel & Services (Index)" },
      { id: "clothing.X5002FY_I", label: "2030 Men`s Apparel (Index)" },
      { id: "clothing.X5016FY_I", label: "2030 Women`s Apparel (Index)" },
      { id: "clothing.X5032FY_I", label: "2030 Children`s Apparel (Index)" },
      { id: "clothing.X5063FY_I", label: "2030 Footwear (Index)" },
      { id: "food.X1131FY_I", label: "2030 Meals at Restaurants/Other (Index)" },
      { id: "food.X1156FY_I", label: "2030 Food and Nonalcoholic Beverages at Fast Food (Index)" },
      { id: "food.X1157FY_I", label: "2030 Food and Nonalcoholic Beverages at Full Service Restaurants (Index)" },
      { id: "food.X1130FY_I", label: "2030 Food Away from Home (Index)" },
      { id: "food.X2007FY_I", label: "2030 Alcoholic Beverages Away from Home (Index)" },
      { id: "SpendingTotal.X15001FY_I", label: "2030 Retail Goods (Index)" },
      { id: "entertainment.X9036FY_I", label: "2030 Pet Food (Index)" },
      { id: "entertainment.X9037FY_I", label: "2030 Pets/Pet Supplies/Medicine for Pets (Index)" },
      { id: "entertainment.X9038FY_I", label: "2030 Pet Services (Index)" },
      { id: "entertainment.X9039FY_I", label: "2030 Vet Services (Index)" },
      { id: "transportation.X6011FY_I", label: "2030 Gasoline (Index)" },
      { id: "transportation.X6015FY_I", label: "2030 Vehicle Maintenance & Repairs (Index)" },
      { id: "shopping.MP31198a_I", label: "2025 Ordered Home Furnishing Online Last 6 Mo (Index)" },
      { id: "shopping.MP31191a_I", label: "2025 Ordered Fitness Apparel/Equipment Online Last 6 Mo (Index)" },
      { id: "shopping.MP31212a_I", label: "2025 Ordered Stereo/Audio Equipment Online Last 6 Mo (Index)" },
      { id: "shopping.MP31176a_I", label: "2025 Ordered Book Online Last 6 Mo (Index)" },
      { id: "shopping.MP31201a_I", label: "2025 Ordered Household/Small Appliance Online Last 6 Mo (Index)" },
      { id: "shopping.MP31181a_I", label: "2025 Ordered Clothing/Apparel Online Last 6 Mo (Index)" },
      { id: "shopping.MP31172a_I", label: "2025 Ordered Automotive Product Online Last 6 Mo (Index)" },
      { id: "shopping.MP31206a_I", label: "2025 Ordered Pet Products/Supplies Online Last 6 Mo (Index)" },
      { id: "PsychographicsShopping.MP28805a_I", label: "2025 OK Buying Items Like Cars/Appliances Online: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28806a_I", label: "2025 OK Buying Items Like Cars/Appliances Online: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28807a_I", label: "2025 OK Buying Items Like Cars/Appliances Online: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28808a_I", label: "2025 OK Buying Items Like Cars/Appliances Online: 4-Agree Completely (Index)" },
      { id: "PsychographicsShopping.MP28809a_I", label: "2025 Only Shop at a Few Online Stores: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28810a_I", label: "2025 Only Shop at a Few Online Stores: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28811a_I", label: "2025 Only Shop at a Few Online Stores: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28812a_I", label: "2025 Only Shop at a Few Online Stores: 4-Agree Completely (Index)" },
      { id: "PsychographicsShopping.MP28833a_I", label: "2025 Research Online Before Buy Locally: 1-Disagree Completely (Index)" },
      { id: "PsychographicsShopping.MP28834a_I", label: "2025 Research Online Before Buy Locally: 2-Disagree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28835a_I", label: "2025 Research Online Before Buy Locally: 3-Agree Somewhat (Index)" },
      { id: "PsychographicsShopping.MP28836a_I", label: "2025 Research Online Before Buy Locally: 4-Agree Completely (Index)" }
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

      // --- Start of API Parameters ---
      const params = new URLSearchParams();
      params.append("f", "json");
      params.append("token", token);
      params.append("studyAreas", JSON.stringify(studyAreasPayload));
      params.append("analysisVariables", JSON.stringify(selectedVariables));
      params.append("returnGeometry", "false");

      // *** MODIFICATION: Explicitly set the data collection and hierarchy ***
      // This forces the API to use the esri2025 data vintage.
      // This vintage contains 2023 current-year estimates and 2028 future-year projections.
      const useDataObject = {
        sourceCountry: "US",
        hierarchy: "esri2025" // Forcing the 2025 data vintage as requested
      };
      params.append("useData", JSON.stringify(useDataObject));
      // --- End of API Parameters ---

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

    // Create lookup maps for each tier's variables and their positions
    const tier1Map = new Map();
    const tier2Map = new Map();
    const tier3Map = new Map();
    
    // Build the maps - map variable ID to its position in the tier
    analysisCategories.tier1.variables.forEach((v, index) => {
      tier1Map.set(v.id, index);
    });
    
    analysisCategories.tier2.variables.forEach((v, index) => {
      tier2Map.set(v.id, index);
    });
    
    analysisCategories.retail.variables.forEach((v, index) => {
      tier3Map.set(v.id, index);
    });

    // Process each selected variable and add its USA data
    // Start at row 5 (after the header rows)
    for (let i = 5; i < rows.length; i++) {
      const variableId = selectedVariables[i - 5];
      let usaValue = "";
      
      // Check which tier this variable belongs to and get the appropriate USA value
      if (tier1Map.has(variableId)) {
        // Variable is in Tier 1
        const position = tier1Map.get(variableId);
        
        // The USA data arrays have 5 empty strings at the beginning for header rows
        // So the actual data starts at index 5
        const dataIndex = position + 5;
        
        // Get value from Tier 1 USA data
        if (dataIndex < usaDataRowsTier1.length) {
          usaValue = usaDataRowsTier1[dataIndex] || "";
        }
      } 
      else if (tier2Map.has(variableId)) {
        // Variable is in Tier 2
        const position = tier2Map.get(variableId);
        
        // Tier 2 data also starts after 5 header rows
        const dataIndex = position + 5;
        
        // Get value from Tier 2 USA data
        if (dataIndex < usaDataRowsTier2.length) {
          usaValue = usaDataRowsTier2[dataIndex] || "";
        }
      } 
      else if (tier3Map.has(variableId)) {
        // Variable is in Tier 3 (retail)
        const position = tier3Map.get(variableId);
        
        // Tier 3 data also starts after 5 header rows
        const dataIndex = position + 5;
        
        // Get value from Tier 3 USA data
        if (dataIndex < usaDataRowsTier3.length) {
          usaValue = usaDataRowsTier3[dataIndex] || "";
        }
      }
      
      // Add the USA value to the current row
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
