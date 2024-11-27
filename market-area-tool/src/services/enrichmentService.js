import esriConfig from "@arcgis/core/config";
import * as projection from "@arcgis/core/geometry/projection";
import Polygon from "@arcgis/core/geometry/Polygon";

const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;
const CHUNK_SIZE = 3;

esriConfig.apiKey = ARCGIS_API_KEY;

export default class EnrichmentService {
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async prepareGeometryForEnrichment(marketAreas) {
    await projection.load();

    return marketAreas.flatMap((area, index) => {
      const rings =
        area.ma_type === "radius"
          ? area.radius_points?.map((point) => point.geometry?.rings || [])
          : area.locations?.flatMap((loc) => loc.geometry?.rings) || [];

      if (!rings.length) {
        console.warn(`No valid geometry for market area: ${area.name}`);
        return [];
      }

      return rings.map((ring, ringIndex) => {
        const polygon = new Polygon({
          rings: ring,
          spatialReference: { wkid: 3857 },
        });

        const projectedPolygon = projection.project(polygon, { wkid: 4326 });
        if (!projectedPolygon) {
          throw new Error(`Projection failed for ${area.name}, ring ${ringIndex}`);
        }

        return {
          geometry: {
            rings: projectedPolygon.rings,
          },
          attributes: { ObjectID: `${index}-${ringIndex}` }, // Unique ID for each area/ring
        };
      });
    });
  }

  async enrichChunk(studyAreas) {
    const enrichmentUrl =
      "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/enrich";

    // Placeholder for analysis variables
    const analysisVariables = [
        "incomebyage.IA15BASECY", "incomebyage.IA25BASECY", "incomebyage.IA35BASECY", "incomebyage.IA45BASECY", 
        "incomebyage.IA55BASECY", "incomebyage.IA65BASECY", "incomebyage.IA75BASECY", "incomebyage.IA55UBASCY", 
        "incomebyage.IA65UBASCY", "AtRisk.TOTPOP_CY", "AtRisk.TOTHH_CY", "AtRisk.AVGHHSZ_CY", "KeyUSFacts.OWNER_CY", 
        "KeyUSFacts.RENTER_CY", "5yearincrements.POP0_CY", "5yearincrements.POP5_CY", "5yearincrements.POP10_CY", 
        "5yearincrements.POP15_CY", "5yearincrements.POP20_CY", "5yearincrements.POP25_CY", "5yearincrements.POP30_CY", 
        "5yearincrements.POP35_CY", "5yearincrements.POP40_CY", "5yearincrements.POP45_CY", "5yearincrements.POP50_CY", 
        "5yearincrements.POP55_CY", "5yearincrements.POP60_CY", "5yearincrements.POP65_CY", "5yearincrements.POP70_CY", 
        "5yearincrements.POP75_CY", "5yearincrements.POP80_CY", "5yearincrements.POP85_CY", "5yearincrements.MEDAGE_CY", 
        "DaytimePopulation.DPOPWRK_CY", "householdincome.HINC0_CY", "householdincome.HINC15_CY", "householdincome.HINC25_CY", 
        "householdincome.HINC35_CY", "householdincome.HINC50_CY", "householdincome.HINC75_CY", "householdincome.HINC100_CY", 
        "householdincome.HINC150_CY", "householdincome.HINC200_CY", "Health.MEDHINC_CY", "AtRisk.AVGHINC_CY", 
        "incomebyage.A25I0_CY", "incomebyage.A25I15_CY", "incomebyage.A25I25_CY", "incomebyage.A25I35_CY", 
        "incomebyage.A25I50_CY", "incomebyage.A25I75_CY", "incomebyage.A25I100_CY", "incomebyage.A25I150_CY", 
        "incomebyage.A25I200_CY", "incomebyage.A35I0_CY", "incomebyage.A35I15_CY", "incomebyage.A35I25_CY", 
        "incomebyage.A35I35_CY", "incomebyage.A35I50_CY", "incomebyage.A35I75_CY", "incomebyage.A35I100_CY", 
        "incomebyage.A35I150_CY", "incomebyage.A35I200_CY", "incomebyage.A45I0_CY", "incomebyage.A45I15_CY", 
        "incomebyage.A45I25_CY", "incomebyage.A45I35_CY", "incomebyage.A45I50_CY", "incomebyage.A45I75_CY", 
        "incomebyage.A45I100_CY", "incomebyage.A45I150_CY", "incomebyage.A45I200_CY", "networth.NW0_CY", "networth.NW15_CY", 
        "networth.NW35_CY", "networth.NW50_CY", "networth.NW75_CY", "networth.NW100_CY", "networth.NW150_CY", 
        "networth.NW250_CY", "networth.NW500_CY", "networth.NW1M_CY", "networth.NW1PT5M_CY", "networth.NW2M_CY", 
        "networth.MEDNW_CY", "networth.AVGNW_CY", "gender.AGEBASE_FY", "householdtotals.FAMHH_FY", 
        "housingunittotals.TOTHU_FY", "householdtotals.AVGHHSZ_FY", "5yearincrements.POP0_FY", "5yearincrements.POP5_FY", 
        "5yearincrements.POP10_FY", "5yearincrements.POP15_FY", "5yearincrements.POP20_FY", "5yearincrements.POP25_FY", 
        "5yearincrements.POP30_FY", "5yearincrements.POP35_FY", "5yearincrements.POP40_FY", "5yearincrements.POP45_FY", 
        "5yearincrements.POP50_FY", "5yearincrements.POP55_FY", "5yearincrements.POP60_FY", "5yearincrements.POP65_FY", 
        "5yearincrements.POP70_FY", "5yearincrements.POP75_FY", "5yearincrements.POP80_FY", "5yearincrements.POP85_FY", 
        "5yearincrements.MEDAGE_FY", "householdincome.HINC0_FY", "householdincome.HINC15_FY", "householdincome.HINC25_FY", 
        "householdincome.HINC35_FY", "householdincome.HINC50_FY", "householdincome.HINC75_FY", "householdincome.HINC100_FY", 
        "householdincome.HINC150_FY", "householdincome.HINC200_FY", "householdincome.MEDHINC_FY", "householdincome.AVGHINC_FY", 
        "HistoricalPopulation.TSPOP10_CY", "5yearincrements.POP0C10", "5yearincrements.POP5C10", "5yearincrements.POP10C10", 
        "5yearincrements.POP15C10", "5yearincrements.POP20C10", "5yearincrements.POP25C10", "5yearincrements.POP30C10", 
        "5yearincrements.POP35C10", "5yearincrements.POP40C10", "5yearincrements.POP45C10", "5yearincrements.POP50C10", 
        "5yearincrements.POP55C10", "5yearincrements.POP60C10", "5yearincrements.POP65C10", "5yearincrements.POP70C10", 
        "5yearincrements.POP75C10", "5yearincrements.POP80C10", "5yearincrements.POP85C10", "5yearincrements.MEDAGE10", 
        "HistoricalHouseholds.TSHH10_CY", "householdsbysize.FAM2PERS10", "householdsbysize.NF2PERS10", 
        "householdsbysize.NF1PERS10", "tapestryhouseholdsNEW.THH06", "tapestryhouseholdsNEW.THH09", 
        "tapestryhouseholdsNEW.THH10", "tapestryhouseholdsNEW.THH11", "tapestryhouseholdsNEW.THH12", 
        "tapestryhouseholdsNEW.THH34", "tapestryhouseholdsNEW.THH35", "tapestryhouseholdsNEW.THH37", 
        "tapestryhouseholdsNEW.THH38", "tapestryhouseholdsNEW.THH52", "tapestryhouseholdsNEW.THH54", 
        "tapestryhouseholdsNEW.THH66", "tapestryhouseholdsNEW.THH67", "tapestryhouseholdsNEW.THH33", 
        "tapestryhouseholdsNEW.THH01", "tapestryhouseholdsNEW.THH02", "tapestryhouseholdsNEW.THH03", 
        "tapestryhouseholdsNEW.THH04", "tapestryhouseholdsNEW.THH08", "tapestryhouseholdsNEW.THH13", 
        "tapestryhouseholdsNEW.THH14", "tapestryhouseholdsNEW.THH15", "tapestryhouseholdsNEW.THH27", 
        "tapestryhouseholdsNEW.THH28", "tapestryhouseholdsNEW.THH29", "tapestryhouseholdsNEW.THH30", 
        "tapestryhouseholdsNEW.THH31", "tapestryhouseholdsNEW.THH32", "tapestryhouseholdsNEW.THH36", 
        "tapestryhouseholdsNEW.THH39", "tapestryhouseholdsNEW.THH48", "tapestryhouseholdsNEW.THH49", 
        "tapestryhouseholdsNEW.THH51", "tapestryhouseholdsNEW.THH53", "tapestryhouseholdsNEW.THH55", 
        "tapestryhouseholdsNEW.THH56", "tapestryhouseholdsNEW.THH57", "tapestryhouseholdsNEW.THH59", 
        "tapestryhouseholdsNEW.THH60", "tapestryhouseholdsNEW.THH61", "tapestryhouseholdsNEW.THH62", 
        "tapestryhouseholdsNEW.THH63", "tapestryhouseholdsNEW.THH64", "tapestryhouseholdsNEW.THH65", 
        "tapestryhouseholdsNEW.THH05", "tapestryhouseholdsNEW.THH07", "tapestryhouseholdsNEW.THH16", 
        "tapestryhouseholdsNEW.THH17", "tapestryhouseholdsNEW.THH18", "tapestryhouseholdsNEW.THH19", 
        "tapestryhouseholdsNEW.THH20", "tapestryhouseholdsNEW.THH21", "tapestryhouseholdsNEW.THH22", 
        "tapestryhouseholdsNEW.THH23", "tapestryhouseholdsNEW.THH24", "tapestryhouseholdsNEW.THH25", 
        "tapestryhouseholdsNEW.THH26", "tapestryhouseholdsNEW.THH40", "tapestryhouseholdsNEW.THH41", 
        "tapestryhouseholdsNEW.THH42", "tapestryhouseholdsNEW.THH43", "tapestryhouseholdsNEW.THH44", 
        "tapestryhouseholdsNEW.THH45", "tapestryhouseholdsNEW.THH46", "tapestryhouseholdsNEW.THH47", 
        "tapestryhouseholdsNEW.THH50", "tapestryhouseholdsNEW.THH58"
      ];
    
    const payload = {
      f: "json",
      token: ARCGIS_API_KEY,
      studyAreas: JSON.stringify(
        studyAreas.map((area) => ({
          geometry: area.geometry,
          attributes: area.attributes,
        }))
      ),
      returnGeometry: false,
      analysisVariables: JSON.stringify(analysisVariables),
    };

    const response = await fetch(enrichmentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload),
    });

    if (!response.ok) throw new Error("Error fetching enrichment data");
    return response.json();
  }

  async enrichAreas(marketAreas) {
    const studyAreas = await this.prepareGeometryForEnrichment(marketAreas);
    const chunks = this.chunkArray(studyAreas, CHUNK_SIZE);

    const results = [];
    for (const chunk of chunks) {
      const response = await this.enrichChunk(chunk);
      results.push(...(response.results || []));
    }

    return { results };
  }

  aggregateResults(groupedResults, area) {
    const aggregated = {};

    groupedResults.forEach((attributes) => {
      Object.keys(attributes).forEach((key) => {
        if (typeof attributes[key] === "number") {
          aggregated[key] = (aggregated[key] || 0) + attributes[key];
        } else {
          aggregated[key] = attributes[key]; // For non-numeric fields, keep the last value
        }
      });
    });

    return aggregated;
  }

  exportToCSV(enrichmentData, marketAreas) {
    if (!enrichmentData || !enrichmentData.results || enrichmentData.results.length === 0) {
      throw new Error("No data available for export.");
    }

    const rows = [];
    const headers = [
      "Market Area Name",
      "Type",
      "Areas Included",
      "ID",
      // Headers will dynamically extend based on aggregated results
    ];

    // Group results by Market Area
    const groupedResults = {};
    enrichmentData.results.forEach((result) => {
      result.value.FeatureSet.forEach((featureSet) => {
        featureSet.features.forEach((feature) => {
          const objectId = feature.attributes.ObjectID.split("-")[0];
          if (!groupedResults[objectId]) {
            groupedResults[objectId] = [];
          }
          groupedResults[objectId].push(feature.attributes);
        });
      });
    });

    // Process each Market Area
    marketAreas.forEach((area, areaIndex) => {
      const areaResults = groupedResults[areaIndex] || [];
      const areasIncluded =
        area.locations?.map((loc) => loc.name || "Unknown").join(";") || "N/A";

      const aggregatedData = this.aggregateResults(areaResults, area);

      // Dynamically extend headers and rows based on aggregated data
      Object.keys(aggregatedData).forEach((key) => {
        if (!headers.includes(key)) {
          headers.push(key);
        }
      });

      const row = [
        area.name || "N/A",
        area.ma_type || "N/A",
        areasIncluded,
        areaIndex,
        ...headers.slice(4).map((key) => aggregatedData[key] || "N/A"), // Start after fixed headers
      ];
      rows.push(row.join(","));
    });

    // Include headers at the top
    rows.unshift(headers.join(","));

    return rows.join("\n");
  }
}

export const enrichmentService = new EnrichmentService();
