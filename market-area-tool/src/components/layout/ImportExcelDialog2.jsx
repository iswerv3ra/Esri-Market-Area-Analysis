import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from 'xlsx';
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { useMap } from "../../contexts/MapContext";
import { useParams } from "react-router-dom";
import { StyleSettingsPanel } from "../market-areas/StyleSettingsPanel";

// Main ImportDialog component
export default function ImportDialog({ isOpen, onClose, projectId }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [fileName, setFileName] = useState("");
    const [fileSelected, setFileSelected] = useState(false);
    const fileInputRef = useRef(null);

    // New state for preview modal
    const [showPreview, setShowPreview] = useState(false);
    const [detectedMarketAreas, setDetectedMarketAreas] = useState([]);

    // Get the current project ID from URL params if not provided
    const { projectId: urlProjectId } = useParams();
    const effectiveProjectId = projectId || urlProjectId;

    // Get the full market areas context and map context
    const marketAreasContext = useMarketAreas();
    const mapContext = useMap();
    const {
        addActiveLayer,
        setVisibleMarketAreaIds,
        updateFeatureStyles,
        clearMarketAreaGraphics,
        selectionGraphicsLayer,
        featureLayers,
        mapView,
        drawRadius,
        drawDriveTimePolygon,
        calculateDriveTimePolygon,
        zoomToMarketArea
    } = mapContext;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            setFileSelected(true);
        } else {
            setFileName("");
            setFileSelected(false);
        }
    };

    const resetForm = () => {
        setFileName("");
        setFileSelected(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setShowPreview(false);
        setDetectedMarketAreas([]);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Modified to show preview instead of immediate import
    const handleProcessFile = async () => {
        if (!fileSelected || !fileInputRef.current.files[0]) {
            toast.error("Please select a file to import");
            return;
        }

        if (!effectiveProjectId) {
            toast.error("Cannot import: Project ID is missing");
            return;
        }

        setIsProcessing(true);
        const loadingToast = toast.loading("Processing import file...");

        try {
            const file = fileInputRef.current.files[0];
            const data = await readExcelFile(file);

            if (!data || !data.length) {
                toast.error("No valid data found in the Excel file");
                toast.dismiss(loadingToast);
                setIsProcessing(false);
                return;
            }

            console.log("Excel data loaded with", data.length, "rows");

            // Try to detect if this is a standard format or the special template format
            const isTemplateFormat = detectTemplateFormat(data);
            console.log("Detected format:", isTemplateFormat ? "template" : "standard");

            let marketAreas = [];
            if (isTemplateFormat) {
                marketAreas = processTemplateData(data);
            } else {
                marketAreas = processStandardData(data);
            }

            if (marketAreas.length === 0) {
                toast.error("No valid market areas found in the file");
                toast.dismiss(loadingToast);
                setIsProcessing(false);
                return;
            }

            // Set detected market areas and show preview
            setDetectedMarketAreas(marketAreas);
            setShowPreview(true);
            toast.dismiss(loadingToast);
            toast.success(`Found ${marketAreas.length} market areas. Please review before importing.`);
        } catch (error) {
            console.error("Import processing failed:", error);
            toast.dismiss(loadingToast);
            toast.error(`Import processing failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };


    // State mappings to help with filtering
    const STATE_MAPPINGS = {
        // Full state name to FIPS code
        nameToFips: {
            'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05',
            'California': '06', 'Colorado': '08', 'Connecticut': '09', 'Delaware': '10',
            'Florida': '12', 'Georgia': '13', 'Hawaii': '15', 'Idaho': '16',
            'Illinois': '17', 'Indiana': '18', 'Iowa': '19', 'Kansas': '20',
            'Kentucky': '21', 'Louisiana': '22', 'Maine': '23', 'Maryland': '24',
            'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27', 'Mississippi': '28',
            'Missouri': '29', 'Montana': '30', 'Nebraska': '31', 'Nevada': '32',
            'New Hampshire': '33', 'New Jersey': '34', 'New Mexico': '35', 'New York': '36',
            'North Carolina': '37', 'North Dakota': '38', 'Ohio': '39', 'Oklahoma': '40',
            'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44', 'South Carolina': '45',
            'South Dakota': '46', 'Tennessee': '47', 'Texas': '48', 'Utah': '49',
            'Vermont': '50', 'Virginia': '51', 'Washington': '53', 'West Virginia': '54',
            'Wisconsin': '55', 'Wyoming': '56', 'District of Columbia': '11'
        },

        // State abbreviation to FIPS code
        abbrToFips: {
            'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
            'DE': '10', 'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17',
            'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
            'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31',
            'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
            'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46',
            'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
            'WI': '55', 'WY': '56'
        },

        // Helper function to get FIPS code from state name or abbreviation
        getStateFips: function (state) {
            if (!state) return null;

            // Normalize state input
            const normalizedState = state.trim();

            // Check if it's already a FIPS code (numeric)
            if (/^\d{1,2}$/.test(normalizedState)) {
                return normalizedState.padStart(2, '0');
            }

            // Check if it's a 2-letter abbreviation
            if (normalizedState.length === 2) {
                return this.abbrToFips[normalizedState.toUpperCase()] || null;
            }

            // Check if it's a full state name
            return this.nameToFips[normalizedState] || null;
        }
    };


    const queryFeaturesForMarketArea = async (marketArea) => {
        console.log("Querying features for market area:", marketArea.id);

        if (!marketArea || !marketArea.locations || marketArea.locations.length === 0) {
            console.warn(`Market area ${marketArea.id} has no locations to query`);
            return [];
        }

        if (!featureLayers || !mapView) {
            console.warn("Feature layers or map view not initialized");
            return [];
        }

        try {
            const { default: Query } = await import("@arcgis/core/rest/support/Query");

            const layer = featureLayers[marketArea.ma_type];
            if (!layer) {
                console.warn(`No feature layer found for type ${marketArea.ma_type}`);
                return [];
            }

            // Build a where clause based on the market area type and locations
            let whereClause = "";

            if (marketArea.ma_type === 'zip') {
                // For ZIP codes, use the ZIP field
                // But be more forgiving with the ZIP format (trim leading zeros, etc.)
                whereClause = marketArea.locations.map(loc => {
                    const zipValue = (loc.id || loc.name || "00000").trim();
                    // Handle ZIP codes that might be stored as numbers (without leading zeros)
                    return `ZIP = '${zipValue}' OR ZIP LIKE '${zipValue}%'`;
                }).join(" OR ");

                console.log("ZIP where clause:", whereClause);
            }
            else if (marketArea.ma_type === 'county') {
                // For counties, use the NAME field with LIKE operator and add state filtering
                whereClause = marketArea.locations.map(loc => {
                    const countyName = (loc.id || loc.name || "Unknown County")
                        .replace(/\s+County$/i, "") // Remove "County" suffix if present
                        .trim()
                        .replace(/'/g, "''"); // Escape single quotes

                    // Get state information for filtering
                    let stateFilter = "";
                    const stateValue = loc.state || "CA";

                    // Convert to FIPS code if needed
                    let stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                    if (stateFips) {
                        stateFilter = ` AND STATE = '${stateFips}'`;
                    }

                    console.log(`County filter: ${countyName} in state: ${stateValue} (FIPS: ${stateFips})`);
                    return `(UPPER(NAME) LIKE UPPER('%${countyName}%')${stateFilter})`;
                }).join(" OR ");

                console.log("County where clause with state filtering:", whereClause);
            }
            else if (marketArea.ma_type === 'tract') {
                // For census tracts, try multiple fields
                whereClause = marketArea.locations.map(loc => {
                    const tractId = (loc.id || loc.name || "").trim();
                    return `TRACT_FIPS = '${tractId}' OR FIPS = '${tractId}' OR GEOID = '${tractId}'`;
                }).join(" OR ");
            }
            else if (marketArea.ma_type === 'place') {
                // For places, use the NAME field with LIKE operator and add state filtering
                whereClause = marketArea.locations.map(loc => {
                    const placeName = (loc.id || loc.name || "Unknown Place")
                        .trim()
                        .replace(/\s+(city|town|village|borough|cdp)$/i, "") // Remove type suffix if present
                        .replace(/'/g, "''"); // Escape single quotes
                    
                    // Get state information for filtering
                    let stateFilter = "";
                    const stateValue = loc.state || "CA";
                    
                    // Convert to FIPS code if needed
                    let stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                    if (stateFips) {
                        stateFilter = ` AND STATE = '${stateFips}'`;
                    }
                    
                    console.log(`Place filter: "${placeName}" in state: ${stateValue} (FIPS: ${stateFips})`);
                    return `(UPPER(NAME) LIKE UPPER('%${placeName}%')${stateFilter})`;
                }).join(" OR ");
                
                console.log("Place where clause with state filtering:", whereClause);
            }
            else if (marketArea.ma_type === 'md') {
                // For metro divisions, try multiple fields
                whereClause = marketArea.locations.map(loc => {
                    const mdName = (loc.id || loc.name || "")
                        .trim()
                        .replace(/'/g, "''"); // Escape single quotes
                    return `UPPER(NAME) LIKE UPPER('%${mdName}%') OR UPPER(BASENAME) LIKE UPPER('%${mdName}%')`;
                }).join(" OR ");
            }
            else if (marketArea.ma_type === 'cbsa') {
                // For CBSAs, try GEOID and NAME fields
                whereClause = marketArea.locations.map(loc => {
                    const cbsaName = (loc.id || loc.name || "")
                        .trim()
                        .replace(/'/g, "''"); // Escape single quotes
                    return `UPPER(NAME) LIKE UPPER('%${cbsaName}%')`;
                }).join(" OR ");
            }
            else if (marketArea.ma_type === 'state') {
                // For states, try NAME field
                whereClause = marketArea.locations.map(loc => {
                    const stateName = (loc.id || loc.name || "")
                        .trim()
                        .replace(/'/g, "''"); // Escape single quotes
                    return `NAME = '${stateName}' OR STUSAB = '${stateName}'`;
                }).join(" OR ");
            }
            else if (marketArea.ma_type === 'block' || marketArea.ma_type === 'blockgroup') {
                // For blocks and block groups, use GEOID or FIPS
                whereClause = marketArea.locations.map(loc => {
                    const blockId = (loc.id || loc.name || "").trim();
                    return `GEOID = '${blockId}' OR FIPS = '${blockId}' OR BLOCKGROUP_FIPS = '${blockId}'`;
                }).join(" OR ");
            }
            else {
                // Generic approach for other types
                whereClause = marketArea.locations.map(loc => {
                    const locId = (loc.id || loc.name || "").trim();
                    const locName = (loc.name || loc.id || "").trim();
                    return `OBJECTID = '${locId}' OR FID = '${locId}' OR NAME = '${locName}' OR GEOID = '${locId}'`;
                }).join(" OR ");
            }

            console.log(`Querying ${marketArea.ma_type} layer with where clause:`, whereClause);

            // Create query with added timeout and error handling
            const query = new Query({
                where: whereClause,
                outFields: ["*"],
                returnGeometry: true,
                outSpatialReference: mapView.spatialReference,
                maxRecordCount: 100, // Limit results
                num: 100, // Limit results
                start: 0
                // Removed returnDistinctValues: true to fix the conflict with returnGeometry
            });

            // Query features with error handling
            let features = [];

            // For group layers (layer.featureLayers), try each sublayer
            if (layer.featureLayers && Array.isArray(layer.featureLayers)) {
                for (const sublayer of layer.featureLayers) {
                    if (!sublayer || !sublayer.queryFeatures) continue;

                    try {
                        const result = await sublayer.queryFeatures(query);
                        if (result && result.features && result.features.length > 0) {
                            features = result.features;
                            console.log(`Found ${features.length} features in sublayer for ${marketArea.ma_type}`);
                            break; // Found features, stop checking other sublayers
                        }
                    } catch (error) {
                        console.warn(`Error querying sublayer for ${marketArea.ma_type}:`, error);
                        // If specific error about DISTINCT and Geometry, try without distinct
                        if (error.message && error.message.includes('Geometry is not supported with DISTINCT')) {
                            console.log('Retrying query without DISTINCT parameter');
                            try {
                                const retryResult = await sublayer.queryFeatures(query);
                                if (retryResult && retryResult.features && retryResult.features.length > 0) {
                                    features = retryResult.features;
                                    console.log(`Retry successful! Found ${features.length} features`);
                                    break;
                                }
                            } catch (retryError) {
                                console.warn('Retry also failed:', retryError);
                            }
                        }
                        // Continue to next sublayer
                    }
                }
            }
            // For single layers
            else if (layer.queryFeatures) {
                try {
                    const result = await layer.queryFeatures(query);
                    if (result && result.features) {
                        features = result.features;
                        console.log(`Found ${features.length} features in layer for ${marketArea.ma_type}`);
                    }
                } catch (error) {
                    console.warn(`Error querying features for ${marketArea.ma_type}:`, error);
                    
                    // Add specific handling for place layer errors
                    if (marketArea.ma_type === 'place') {
                        console.log("Trying alternative approach for place query...");
                        
                        try {
                            // Try with a simpler query - just match on the beginning of the name
                            const simplifiedQuery = new Query({
                                where: marketArea.locations.map(loc => {
                                    const cleanName = (loc.id || loc.name || "")
                                        .split(/\s+/)[0]  // Take just first word of place name
                                        .replace(/'/g, "''");
                                    const stateValue = loc.state || "CA";
                                    const stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                                    const stateFilter = stateFips ? ` AND STATE = '${stateFips}'` : "";
                                    
                                    return `(UPPER(NAME) LIKE UPPER('${cleanName}%')${stateFilter})`;
                                }).join(" OR "),
                                outFields: ["*"],
                                returnGeometry: true,
                                outSpatialReference: mapView.spatialReference
                            });
                            
                            console.log("Simplified place query:", simplifiedQuery.where);
                            const retryResult = await layer.queryFeatures(simplifiedQuery);
                            
                            if (retryResult && retryResult.features && retryResult.features.length > 0) {
                                features = retryResult.features;
                                console.log(`Simplified query successful! Found ${features.length} place features`);
                            }
                        } catch (retryError) {
                            console.warn("Alternative place query approach also failed:", retryError);
                        }
                    }
                    
                    // Existing error handling for DISTINCT error
                    if (error.message && error.message.includes('Geometry is not supported with DISTINCT')) {
                        console.log('Retrying query without DISTINCT parameter');
                        try {
                            const retryResult = await layer.queryFeatures(query);
                            if (retryResult && retryResult.features) {
                                features = retryResult.features;
                                console.log(`Retry successful! Found ${features.length} features`);
                            }
                        } catch (retryError) {
                            console.warn('Retry also failed:', retryError);
                        }
                    }
                }
            }

            console.log(`Query result for ${marketArea.ma_type}:`, {
                hasFeatures: features.length > 0,
                count: features.length
            });

            return features;
        } catch (error) {
            console.error(`Error querying features for market area ${marketArea.id}:`, error);
            return [];
        }
    };

    // Helper function to navigate back to map view after import
    const navigateToMapView = () => {
        // Option 1: If you have a button for this, trigger its click
        const mapViewButton = document.getElementById("mapViewButton");
        if (mapViewButton) {
            mapViewButton.click();
            return;
        }

        // Option 2: If you have a function for this
        if (typeof onNavigateToMap === 'function') {
            onNavigateToMap();
            return;
        }

        // Option 3: If you're using React Router
        // navigate('/projects/' + effectiveProjectId);
    };

    // Helper to extract and normalize data for different market area types
    const normalizeMarketAreaData = (marketArea) => {
        // Verify project ID is available
        if (!effectiveProjectId) {
            console.error("No effective project ID found!");
        }

        // Common settings for all types
        const normalizedData = {
            ma_type: marketArea.ma_type,
            name: marketArea.name,
            short_name: marketArea.short_name || marketArea.name.substring(0, 20),
            style_settings: {
                fillColor: marketArea.style_settings?.fillColor || "#0078D4",
                fillOpacity: marketArea.style_settings?.noFill ? 0 :
                    (marketArea.style_settings?.fillOpacity || 0.35),
                borderColor: marketArea.style_settings?.borderColor || "#0078D4",
                borderWidth: marketArea.style_settings?.noBorder ? 0 :
                    (marketArea.style_settings?.borderWidth || 2),
                noFill: marketArea.style_settings?.noFill || false,
                noBorder: marketArea.style_settings?.noBorder || false
            },
            project: effectiveProjectId,
            project_id: effectiveProjectId,
            description: `Imported from ${fileName}`
        };

        // Type-specific handling
        if (marketArea.ma_type === "radius") {
            if (!marketArea.radius_points || !Array.isArray(marketArea.radius_points)) {
                normalizedData.radius_points = [];
            } else {
                // Normalize radius points
                normalizedData.radius_points = marketArea.radius_points.map(point => {
                    // Ensure center has proper format
                    const center = point.center || {};
                    const lon = center.longitude || center.x || 0;
                    const lat = center.latitude || center.y || 0;

                    // Normalize radii to array format
                    const radii = Array.isArray(point.radii) ?
                        point.radii : (point.radius ? [point.radius] : [5]); // Default 5-mile radius

                    return {
                        center: {
                            longitude: lon,
                            latitude: lat,
                            spatialReference: { wkid: 4326 }
                        },
                        radii: radii,
                        units: point.units || 'miles'
                    };
                });
            }
            normalizedData.locations = []; // Empty for radius type
            normalizedData.drive_time_points = []; // Empty for radius type
        }
        else if (marketArea.ma_type === "drivetime") {
            if (!marketArea.drive_time_points || !Array.isArray(marketArea.drive_time_points)) {
                normalizedData.drive_time_points = [];
            } else {
                // Normalize drive time points
                normalizedData.drive_time_points = marketArea.drive_time_points.map(point => {
                    // Ensure center has proper format
                    const center = point.center || {};
                    const lon = center.longitude || center.x || 0;
                    const lat = center.latitude || center.y || 0;

                    // Normalize time range
                    const timeRanges = Array.isArray(point.timeRanges) ?
                        point.timeRanges :
                        (point.timeRange ? [point.timeRange] :
                            [point.travelTimeMinutes || 15]); // Default 15 minutes

                    return {
                        center: {
                            longitude: lon,
                            latitude: lat,
                            spatialReference: { wkid: 4326 }
                        },
                        travelTimeMinutes: timeRanges[0],
                        timeRanges: timeRanges,
                        units: point.units || 'minutes',
                        polygon: point.polygon || point.driveTimePolygon || null
                    };
                });
            }
            normalizedData.locations = []; // Empty for drivetime type
            normalizedData.radius_points = []; // Empty for drivetime type
        }
        else {
            // Regular feature-based market areas
            if (!marketArea.locations || !Array.isArray(marketArea.locations)) {
                normalizedData.locations = [];
            } else {
                // When normalizing locations, make sure we have proper state information for each
                normalizedData.locations = marketArea.locations.map(loc => {
                    // Make sure we have state info for locations to aid in finding features
                    const state = loc.state || "CA"; // Default to CA if no state

                    // Create proper spatial reference for any existing geometry
                    let geometry = loc.geometry;
                    if (geometry && !geometry.spatialReference) {
                        geometry = {
                            ...geometry,
                            spatialReference: { wkid: 4326 } // Add WGS84 spatial reference
                        };
                    }

                    return {
                        id: loc.id || loc.name,
                        name: loc.name || loc.id,
                        state,
                        geometry
                    };
                });
            }
            normalizedData.radius_points = [];
            normalizedData.drive_time_points = [];
        }

        return normalizedData;
    };

    // Store existing graphics we want to keep
    const storeExistingGraphics = () => {
        if (!selectionGraphicsLayer) return [];

        return selectionGraphicsLayer.graphics
            .filter(g => g.attributes?.marketAreaId)
            .toArray()
            .map(g => ({
                geometry: g.geometry,
                attributes: g.attributes,
                symbol: g.symbol
            }));
    };

    // Restore existing graphics to the map
    const restoreExistingGraphics = async (existingGraphics) => {
        if (!selectionGraphicsLayer || existingGraphics.length === 0) return;

        try {
            const { default: Graphic } = await import("@arcgis/core/Graphic");
            existingGraphics.forEach(g => {
                const graphic = new Graphic({
                    geometry: g.geometry,
                    attributes: g.attributes,
                    symbol: g.symbol
                });
                selectionGraphicsLayer.add(graphic);
            });
        } catch (error) {
            console.error("Error restoring existing graphics:", error);
        }
    };

    // Update visibility state for market areas
    const updateVisibilityState = (marketAreaIds) => {
        if (!marketAreaIds || marketAreaIds.length === 0) return;

        try {
            // Get current visible market area IDs from localStorage
            const storedVisibleIds = localStorage.getItem(
                `marketAreas.${effectiveProjectId}.visible`
            );
            let currentVisibleIds = storedVisibleIds
                ? JSON.parse(storedVisibleIds)
                : [];

            // Add newly created market area IDs to visible IDs list
            const updatedVisibleIds = [
                ...currentVisibleIds,
                ...marketAreaIds.filter(id => !currentVisibleIds.includes(id))
            ];

            // Update localStorage
            localStorage.setItem(
                `marketAreas.${effectiveProjectId}.visible`,
                JSON.stringify(updatedVisibleIds)
            );

            // Update visible market areas in context
            setVisibleMarketAreaIds(updatedVisibleIds);
        } catch (error) {
            console.error("Error updating visibility state:", error);
        }
    };

    // Import all market areas and track results
    const importAllMarketAreas = async (marketAreas) => {
        const results = {
            importedCount: 0,
            createdMarketAreaIds: [],
            errors: []
        };

        for (const marketArea of marketAreas) {
            try {
                // Skip if missing essential data
                if (!marketArea.name) {
                    results.errors.push(`Unnamed market area: Missing name`);
                    continue;
                }

                // Normalize the market area data based on type
                const normalizedMarketArea = normalizeMarketAreaData(marketArea);
                console.log(`Normalized market area ${marketArea.name} for import:`, normalizedMarketArea);

                // For feature-based market areas (not radius or drivetime), fetch geometry first
                if (normalizedMarketArea.ma_type !== "radius" &&
                    normalizedMarketArea.ma_type !== "drivetime" &&
                    normalizedMarketArea.locations?.length > 0) {

                    // Initialize temporary market area with ID to use in queryFeatures
                    const tempMarketArea = {
                        ...normalizedMarketArea,
                        id: `temp-${Date.now()}`
                    };

                    // Query for geometries using feature layer queries
                    try {
                        await addActiveLayer(normalizedMarketArea.ma_type);
                        const features = await queryFeaturesForMarketArea(tempMarketArea);

                        if (features && features.length > 0) {
                            console.log(`Found ${features.length} features for ${normalizedMarketArea.name}`);

                            // Match features to locations and add geometries
                            for (let i = 0; i < normalizedMarketArea.locations.length; i++) {
                                const loc = normalizedMarketArea.locations[i];
                                const match = findMatchingFeature(loc, features, normalizedMarketArea.ma_type);

                                if (match && match.geometry) {
                                    // Clone geometry to avoid reference issues
                                    const clonedGeometry = JSON.parse(JSON.stringify(match.geometry));
                                    normalizedMarketArea.locations[i] = {
                                        ...loc,
                                        geometry: clonedGeometry
                                    };
                                    console.log(`Added geometry to location: ${loc.name || loc.id}`);
                                }
                            }
                        } else {
                            console.warn(`No features found for ${normalizedMarketArea.name} (${normalizedMarketArea.ma_type})`);
                        }
                    } catch (queryError) {
                        console.warn(`Error querying features for ${normalizedMarketArea.name}:`, queryError);
                        // Continue without geometries - the API will handle this
                    }
                }

                // Save the market area
                let savedMarketArea;

                // Use appropriate function to add market area
                try {
                    savedMarketArea = await marketAreasContext.addMarketArea(
                        effectiveProjectId,
                        normalizedMarketArea
                    );
                    console.log(`Successfully created market area:`, savedMarketArea);
                } catch (apiError) {
                    console.error(`API error creating market area ${marketArea.name}:`, apiError);

                    // Try to extract detailed error messages from the API response
                    let errorMsg = apiError.message || 'API Error';
                    if (apiError.response?.data) {
                        if (typeof apiError.response.data === 'string') {
                            errorMsg = apiError.response.data;
                        } else if (apiError.response.data.detail) {
                            errorMsg = apiError.response.data.detail;
                        } else if (apiError.response.data.message) {
                            errorMsg = apiError.response.data.message;
                        } else if (apiError.response.data.error) {
                            errorMsg = apiError.response.data.error;
                        }
                    }

                    results.errors.push(`${marketArea.name}: ${errorMsg}`);
                    continue;
                }

                if (!savedMarketArea || !savedMarketArea.id) {
                    throw new Error("Failed to create market area - API returned invalid response");
                }

                results.importedCount++;
                results.createdMarketAreaIds.push(savedMarketArea.id);

                // Activate layer and draw graphics based on market area type
                await visualizeMarketArea(savedMarketArea);

            } catch (error) {
                console.error(`Failed to import market area ${marketArea.name}:`, error);
                results.errors.push(`${marketArea.name}: ${error.message}`);
            }
        }

        return results;
    };

    // Visualize a market area based on its type
    const visualizeMarketArea = async (marketArea) => {
        try {
            console.log(`Visualizing market area: ${marketArea.id} (${marketArea.ma_type})`);

            // Activate the corresponding layer if needed for feature-based market areas
            if (marketArea.ma_type &&
                marketArea.ma_type !== "radius" &&
                marketArea.ma_type !== "drivetime") {
                await addActiveLayer(marketArea.ma_type);
            }

            // Handle visualization appropriately per market area type
            if (marketArea.ma_type === "radius" && Array.isArray(marketArea.radius_points) && marketArea.radius_points.length > 0) {
                console.log(`Drawing ${marketArea.radius_points.length} radius points for market area ${marketArea.id}`);

                // Draw each radius point
                for (const point of marketArea.radius_points) {
                    if (!point || !point.center) continue;

                    await drawRadius(
                        point,
                        marketArea.style_settings || {
                            fillColor: "#0078D4",
                            fillOpacity: 0.35,
                            borderColor: "#0078D4",
                            borderWidth: 2
                        },
                        marketArea.id,
                        marketArea.order || 0
                    );
                }
            }
            else if (marketArea.ma_type === "drivetime" && Array.isArray(marketArea.drive_time_points) && marketArea.drive_time_points.length > 0) {
                console.log(`Drawing ${marketArea.drive_time_points.length} drive time points for market area ${marketArea.id}`);

                // Draw each drive time point
                for (const point of marketArea.drive_time_points) {
                    if (!point || !point.center) continue;

                    // If no polygon exists, calculate one
                    if (!point.polygon) {
                        try {
                            point.polygon = await calculateDriveTimePolygon({
                                center: point.center,
                                travelTimeMinutes: point.travelTimeMinutes ||
                                    (Array.isArray(point.timeRanges) ? point.timeRanges[0] : 15)
                            });
                        } catch (err) {
                            console.error(`Error calculating drive time polygon for point:`, err);
                            continue;
                        }
                    }

                    await drawDriveTimePolygon(
                        point,
                        marketArea.style_settings || {
                            fillColor: "#0078D4",
                            fillOpacity: 0.35,
                            borderColor: "#0078D4",
                            borderWidth: 2
                        },
                        marketArea.id,
                        marketArea.order || 0
                    );
                }
            }
            else if (marketArea.locations && marketArea.locations.length > 0) {
                console.log(`Processing ${marketArea.locations.length} locations for feature-based market area ${marketArea.id}`);

                // Query features for location data if geometry is missing
                const locationsWithGeometry = await queryFeaturesForLocations(marketArea);

                // Check if we have any features with geometry
                if (locationsWithGeometry.some(loc => loc.geometry)) {
                    // Create feature objects from locations
                    const features = locationsWithGeometry
                        .filter(loc => loc.geometry) // Pre-filter to only include locations with geometry
                        .map(loc => ({
                            geometry: loc.geometry,
                            attributes: {
                                id: loc.id || loc.name,
                                name: loc.name || loc.id,
                                marketAreaId: marketArea.id,
                                FEATURE_TYPE: marketArea.ma_type,
                                order: marketArea.order || 0
                            }
                        }));

                    console.log(`Created ${features.length} feature objects with geometry for market area ${marketArea.id}`);

                    if (features.length > 0) {
                        // Apply styling to features
                        await updateFeatureStyles(
                            features,
                            {
                                fill: marketArea.style_settings?.fillColor || "#0078D4",
                                fillOpacity: marketArea.style_settings?.noFill ? 0 :
                                    (marketArea.style_settings?.fillOpacity || 0.35),
                                outline: marketArea.style_settings?.borderColor || "#0078D4",
                                outlineWidth: marketArea.style_settings?.noBorder ? 0 :
                                    (marketArea.style_settings?.borderWidth || 2)
                            },
                            marketArea.ma_type,
                            true // Force immediate update
                        );
                    } else {
                        console.warn(`No features with geometry for market area ${marketArea.id}`);
                    }
                } else {
                    console.warn(`No locations with geometry for market area ${marketArea.id}`);
                }
            } else {
                console.warn(`Market area ${marketArea.id} has no valid locations or points to visualize`);
            }
        } catch (error) {
            console.error("Error visualizing market area:", error);
        }
    };

    // Helper function to zoom to created market areas
    const zoomToCreatedMarketAreas = async (marketAreaIds) => {
        if (!marketAreaIds || marketAreaIds.length === 0 || !mapView) return;

        try {
            // Zoom to the first market area with error handling
            if (marketAreaIds.length > 0 && typeof zoomToMarketArea === 'function') {
                try {
                    console.log(`Attempting to zoom to market area: ${marketAreaIds[0]}`);
                    await zoomToMarketArea(marketAreaIds[0]);
                } catch (zoomError) {
                    console.warn(`Error zooming to market area ${marketAreaIds[0]}:`, zoomError);

                    // Fallback to default view of Orange County if zooming fails
                    try {
                        const { default: Point } = await import("@arcgis/core/geometry/Point");

                        const center = new Point({
                            longitude: -117.8311, // Orange County, CA
                            latitude: 33.7175,
                            spatialReference: { wkid: 4326 }
                        });

                        await mapView.goTo({
                            target: center,
                            zoom: 10
                        }, {
                            duration: 800,
                            easing: "ease-in-out"
                        });

                        console.log(`Fallback zoom to Orange County successful`);
                    } catch (fallbackError) {
                        console.error("Error in fallback zoom:", fallbackError);
                    }
                }
            }
        } catch (error) {
            console.error("Error zooming to market areas:", error);
        }
    };

    // Clean up after import
    const cleanupAfterImport = () => {
        // Reset form state
        resetForm();

        // Close the dialog
        onClose();

        // Refresh market areas data if needed
        if (typeof marketAreasContext.fetchMarketAreas === 'function') {
            marketAreasContext.fetchMarketAreas(effectiveProjectId);
        }
    };

    // Helper for querying features for locations
    const queryFeaturesForLocations = async (marketArea) => {
        if (!marketArea.locations || marketArea.locations.length === 0) {
            return [];
        }

        // If all locations already have geometry, just return them
        if (marketArea.locations.every(loc => loc.geometry)) {
            return marketArea.locations;
        }

        // Create enhanced locations by querying for missing geometries
        const enhancedLocations = [...marketArea.locations];

        try {
            // Get results from queryFeaturesForMarketArea if available
            const queryResults = await queryFeaturesForMarketArea(marketArea);

            if (queryResults && queryResults.length > 0) {
                console.log(`Found ${queryResults.length} matching features for market area ${marketArea.id} (${marketArea.ma_type})`);

                // Match query results with locations
                for (let i = 0; i < enhancedLocations.length; i++) {
                    const loc = enhancedLocations[i];
                    if (!loc.geometry) {
                        // Try to find a matching feature from query results
                        const matchingFeature = findMatchingFeature(loc, queryResults, marketArea.ma_type);
                        if (matchingFeature) {
                            console.log(`Found matching feature for ${loc.name || loc.id}`);

                            // Clone the geometry to avoid reference issues
                            const clonedGeometry = JSON.parse(JSON.stringify(matchingFeature.geometry));

                            enhancedLocations[i] = {
                                ...loc,
                                geometry: clonedGeometry
                            };
                        } else {
                            console.log(`No matching feature found for ${loc.name || loc.id}`);
                        }
                    }
                }
            } else {
                console.warn(`No query results found for market area ${marketArea.id} (${marketArea.ma_type})`);
            }
        } catch (error) {
            console.warn("Error querying features for locations:", error);
        }

        return enhancedLocations;
    };

    // Helper to find matching feature for a location
    const findMatchingFeature = (location, features, maType) => {
        if (!location || !features || features.length === 0) return null;

        // Different matching logic based on market area type
        if (maType === 'zip') {
            return features.find(feature =>
                String(feature.attributes.ZIP || '').trim() === String(location.id || location.name || '').trim()
            );
        }
        else if (maType === 'county') {
            const locName = String(location.name || location.id || '').toLowerCase().replace(/\s+county$/i, '').trim();
            return features.find(feature => {
                const featureName = String(feature.attributes.NAME || '').toLowerCase().replace(/\s+county$/i, '').trim();
                return featureName.includes(locName) || locName.includes(featureName);
            });
        }
        else if (maType === 'tract') {
            const locId = String(location.id || location.name || '').trim();
            return features.find(feature =>
                feature.attributes.TRACT_FIPS === locId ||
                feature.attributes.FIPS === locId ||
                feature.attributes.GEOID === locId
            );
        }

        // Default matching using ID or name
        return features.find(feature => {
            const locId = String(location.id || '').trim();
            const locName = String(location.name || '').trim().toLowerCase();

            return feature.attributes.OBJECTID === locId ||
                feature.attributes.FID === locId ||
                (feature.attributes.NAME &&
                    String(feature.attributes.NAME).toLowerCase().includes(locName));
        });
    };

    // Improved handleImport with better error handling and API formatting
    const handleImport = async (confirmedMarketAreas) => {
        setIsProcessing(true);
        const loadingToast = toast.loading("Importing market areas...");

        try {
            // Store existing graphics we want to keep
            const existingGraphics = storeExistingGraphics();
            console.log(`Preserving ${existingGraphics.length} existing graphics`);

            // Import all selected market areas
            const importResults = await importAllMarketAreas(confirmedMarketAreas);

            // Update visibility state with newly created market areas
            if (importResults.createdMarketAreaIds.length > 0) {
                updateVisibilityState(importResults.createdMarketAreaIds);

                // Try to zoom to first created market area
                await zoomToCreatedMarketAreas(importResults.createdMarketAreaIds);
            }

            // Complete the import process
            toast.dismiss(loadingToast);

            if (importResults.importedCount > 0) {
                toast.success(`Successfully imported ${importResults.importedCount} market areas`);

                if (importResults.errors.length > 0) {
                    console.error("Some market areas failed to import:", importResults.errors);
                    toast.error(`${importResults.errors.length} market areas failed to import. Check console for details.`);
                }

                cleanupAfterImport();
            } else {
                toast.error("Failed to import any market areas");
                if (importResults.errors.length > 0) {
                    toast.error(importResults.errors[0]);
                }
            }
        } catch (error) {
            console.error("Import failed:", error);
            toast.dismiss(loadingToast);

            // Improved error message formatting
            let errorMessage = "Import failed";
            if (error?.message) {
                errorMessage += ": " + error.message;
            } else if (error?.response?.data?.detail) {
                errorMessage += ": " + error.response.data.detail;
            }

            toast.error(errorMessage);
        } finally {
            setIsProcessing(false);
            setShowPreview(false);
        }
    };

    // Excel file reading function
    const readExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    // Get the first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON (with headers)
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error("Failed to parse Excel file: " + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error("Failed to read file"));
            };

            reader.readAsArrayBuffer(file);
        });
    };

    // Template format detection
    const detectTemplateFormat = (data) => {
        // Look for specific markers in the template
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            const row = data[i];
            if (row && row.length > 0) {
                // Check column A or B for template headers
                const colA = String(row[0] || "").trim();
                const colB = String(row[1] || "").trim();

                if (colA === "Market Area Definitions" ||
                    colB === "Full Market Area Name" ||
                    colB === "Definition Type") {
                    console.log(`Template marker found:`, colA || colB);
                    return true;
                }
            }
        }
        return false;
    };

    const processTemplateData = (data) => {
        console.log("Processing template format data with support for all market area types");

        // Define exact row indices based on Excel structure
        const MARKET_AREA_NAME_ROW = 4;  // Row 5 in Excel
        const SHORT_NAME_ROW = 6;        // Row 7 in Excel
        const TEXT_COLOR_ROW = 8;        // Row 9 in Excel
        const DEFINITION_TYPE_ROW = 10;  // Row 11 in Excel
        const STATE_ROW = 12;            // Row 13 in Excel
        const COUNTY_ROW = 14;           // Row 15 in Excel
        const LATITUDE_ROW = 16;         // Row 17 in Excel
        const LONGITUDE_ROW = 17;        // Row 18 in Excel
        const RADIUS_MINUTES_ROW = 19;   // Row 20 in Excel
        const FILL_COLOR_ROW = 23;       // Row 24 in Excel
        const TRANSPARENCY_ROW = 24;     // Row 25 in Excel
        const BORDER_COLOR_ROW = 26;     // Row 27 in Excel
        const BORDER_WEIGHT_ROW = 27;    // Row 28 in Excel
        const DEFINITION_START_ROW = 29; // Row 30 in Excel (first definition value)

        // Validate that we have enough data rows
        if (data.length < DEFINITION_START_ROW) {
            console.warn("Excel file doesn't have enough rows for template format");
            return [];
        }

        // Find all market area columns 
        const marketAreaColumns = [];
        const maxCol = Math.max(
            data[MARKET_AREA_NAME_ROW]?.length || 0,
            data[DEFINITION_TYPE_ROW]?.length || 0
        );

        for (let col = 3; col < maxCol; col += 2) {
            const marketAreaName = String(data[MARKET_AREA_NAME_ROW][col] || "").trim();
            const definitionType = String(data[DEFINITION_TYPE_ROW][col] || "").trim();

            if (marketAreaName && definitionType) {
                console.log(`Found market area in column ${col} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType})`);
                marketAreaColumns.push(col);
            }
        }

        console.log(`Found ${marketAreaColumns.length} market areas in columns: ${marketAreaColumns.map(col => String.fromCharCode(65 + col)).join(', ')}`);

        // No valid market areas found
        if (marketAreaColumns.length === 0) {
            console.warn("No valid market areas found in the template");
            return [];
        }

        // Process each market area
        const marketAreas = [];

        for (const col of marketAreaColumns) {
            const marketAreaName = String(data[MARKET_AREA_NAME_ROW][col] || "").trim();
            const definitionType = String(data[DEFINITION_TYPE_ROW][col] || "").trim();

            console.log(`Processing market area in column ${col} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType})`);

            // Extract all settings for this market area
            const shortName = data[SHORT_NAME_ROW] ? String(data[SHORT_NAME_ROW][col] || "").trim() : "";
            const state = data[STATE_ROW] ? String(data[STATE_ROW][col] || "").trim() : "CA"; // Default CA
            const county = data[COUNTY_ROW] ? String(data[COUNTY_ROW][col] || "").trim() : "";

            // Extract radius/drivetime info if applicable
            let lat = data[LATITUDE_ROW] ? parseFloat(data[LATITUDE_ROW][col]) : null;
            let lon = data[LONGITUDE_ROW] ? parseFloat(data[LONGITUDE_ROW][col]) : null;
            let radiusMinutes = data[RADIUS_MINUTES_ROW] ? parseFloat(data[RADIUS_MINUTES_ROW][col]) : null;

            // Style settings
            let fillColor = "#0078D4"; // Default blue
            let fillOpacity = 0.3;      // Default 30% opacity
            let borderColor = "#0078D4"; // Default blue
            let borderWidth = 2;         // Default width

            // Extract fill color
            if (data[FILL_COLOR_ROW] && data[FILL_COLOR_ROW][col]) {
                const fillColorVal = String(data[FILL_COLOR_ROW][col]).trim();
                if (fillColorVal !== "No Fill" && fillColorVal !== "Text Color") {
                    fillColor = fillColorVal;
                }
            }

            // Extract transparency
            if (data[TRANSPARENCY_ROW] && data[TRANSPARENCY_ROW][col]) {
                const transparency = String(data[TRANSPARENCY_ROW][col]).trim();
                if (transparency === "No Fill") {
                    fillOpacity = 0;
                } else if (transparency.endsWith("%")) {
                    fillOpacity = parseInt(transparency) / 100;
                } else if (!isNaN(parseFloat(transparency))) {
                    fillOpacity = parseFloat(transparency);
                    // If it's a decimal between 0-1, use as is, otherwise assume percentage
                    if (fillOpacity > 1) {
                        fillOpacity = fillOpacity / 100;
                    }
                }
            }

            // Extract border color
            if (data[BORDER_COLOR_ROW] && data[BORDER_COLOR_ROW][col]) {
                const borderColorVal = String(data[BORDER_COLOR_ROW][col]).trim();
                if (borderColorVal !== "No Border" && borderColorVal !== "Text Color") {
                    borderColor = borderColorVal;
                } else if (borderColorVal === "No Border") {
                    borderWidth = 0;
                }
            }

            // Extract border width
            if (data[BORDER_WEIGHT_ROW] && data[BORDER_WEIGHT_ROW][col]) {
                const weight = String(data[BORDER_WEIGHT_ROW][col]).trim();
                if (weight === "No Border") {
                    borderWidth = 0;
                } else if (!isNaN(parseInt(weight))) {
                    borderWidth = parseInt(weight);
                }
            }

            // Create style settings
            const styleSettings = {
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                noFill: fillOpacity === 0,
                borderColor: borderColor,
                borderWidth: borderWidth,
                noBorder: borderWidth === 0
            };

            // Determine market area type
            const maType = mapDefinitionTypeToMAType(definitionType);
            console.log(`Mapped definition type "${definitionType}" to ma_type "${maType}" for ${marketAreaName}`);

            // Create the market area object
            const marketArea = {
                name: marketAreaName,
                short_name: shortName || marketAreaName?.substring(0, 20) || "Imported",
                ma_type: maType,
                description: `Imported from ${fileName}`,
                style_settings: styleSettings,
                project: effectiveProjectId,
                project_id: effectiveProjectId
            };

            // Check if this is a radius or drivetime type (special handling)
            const isRadiusType = maType === "radius";
            const isDriveTimeType = maType === "drivetime";

            if (isRadiusType || isDriveTimeType) {
                // For radius/drivetime, we use the lat/lon/radius values
                if (!isNaN(lat) && !isNaN(lon) && !isNaN(radiusMinutes)) {
                    console.log(`Found radius/drivetime data for ${marketAreaName}: ${lat}, ${lon}, ${radiusMinutes}`);
                } else {
                    // Default to Orange County if missing
                    lat = 33.7175;
                    lon = -117.8311;
                    radiusMinutes = isRadiusType ? 5 : 15; // 5 miles or 15 minutes default
                    console.log(`Using default radius/drivetime data for ${marketAreaName}`);
                }

                if (isRadiusType) {
                    marketArea.radius_points = [{
                        center: {
                            longitude: lon,
                            latitude: lat,
                            spatialReference: { wkid: 4326 }
                        },
                        radii: [radiusMinutes], // radius in miles
                        units: 'miles'
                    }];
                    console.log(`Created radius point at ${lat}, ${lon} with radius ${radiusMinutes} miles for ${marketAreaName}`);
                } else {
                    marketArea.drive_time_points = [{
                        center: {
                            longitude: lon,
                            latitude: lat,
                            spatialReference: { wkid: 4326 }
                        },
                        timeRanges: [radiusMinutes], // minutes
                        travelTimeMinutes: radiusMinutes,
                        units: 'minutes'
                    }];
                    console.log(`Created drive time point at ${lat}, ${lon} with time ${radiusMinutes} minutes for ${marketAreaName}`);
                }

                marketAreas.push(marketArea);
                continue; // Skip to next market area
            }

            // For regular types, extract definition values
            const definitionValues = [];

            // Create a set of values to exclude (style settings, etc.)
            const excludeValues = new Set([
                "No Fill", "No Border", "Text Color", "0.7", "70%",
                marketAreaName, shortName, definitionType,
                state, county
            ]);

            // Get DEFINITION_START_ROW value first (row 30/index 29)
            if (data[DEFINITION_START_ROW] && data[DEFINITION_START_ROW][col]) {
                const value = String(data[DEFINITION_START_ROW][col]).trim();

                if (value && !excludeValues.has(value)) {
                    console.log(`Found main definition value for ${marketAreaName}: "${value}" at row 30`);
                    definitionValues.push(value);
                }
            }

            // If we still don't have a value for certain types, check the rows after
            if (definitionValues.length === 0) {
                // Continue looking for values in subsequent rows
                for (let i = DEFINITION_START_ROW + 1; i < Math.min(data.length, DEFINITION_START_ROW + 20); i++) {
                    if (!data[i] || !data[i][col]) continue;

                    const value = String(data[i][col]).trim();

                    // Skip empty values, excluded values, or duplicates
                    if (!value || excludeValues.has(value) || definitionValues.includes(value)) {
                        continue;
                    }

                    // Skip obvious style values
                    if (/^\d+%$/.test(value) || value === "No Fill" || value === "No Border") {
                        continue;
                    }

                    // Skip pure numbers for most types (except ZIP, Block, etc.)
                    if (/^\d+(\.\d+)?$/.test(value) &&
                        maType !== 'zip' &&
                        maType !== 'block' &&
                        maType !== 'blockgroup' &&
                        maType !== 'tract') {
                        continue;
                    }

                    console.log(`Found additional definition value for ${marketAreaName}: "${value}" at row ${i + 1}`);
                    definitionValues.push(value);
                }
            }

            // For county type, default to Orange County if no values
            if (maType === 'county' && definitionValues.length === 0) {
                console.log(`No county values found for ${marketAreaName}, using "Orange County" as default`);
                definitionValues.push("Orange County");
            }

            // Skip if no definition values found
            if (definitionValues.length === 0) {
                console.warn(`No definition values found for market area ${marketAreaName}, skipping`);
                continue;
            }

            // Create locations based on ma_type
            if (maType === 'zip') {
                marketArea.locations = definitionValues.map(zip => ({
                    id: zip,
                    name: zip,
                    state: state || "CA" // Ensure state is preserved
                }));
            }
            else if (maType === 'tract') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "06", // Use FIPS code for state
                    county: county || ""
                }));
            }
            else if (maType === 'county') {
                const stateValue = data[STATE_ROW] ? String(data[STATE_ROW][col] || "").trim() : "CA";
                console.log(`Found state "${stateValue}" for county market area ${marketAreaName}`);

                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: stateValue || "CA" // Ensure state is preserved from the template
                }));
            }
            else if (maType === 'place') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "CA"
                }));
            }
            else if (maType === 'md') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "CA"
                }));
            }
            else if (maType === 'cbsa') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "CA"
                }));
            }
            else if (maType === 'state') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value
                }));
            }
            else if (maType === 'block') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "06"
                }));
            }
            else if (maType === 'blockgroup') {
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "06"
                }));
            }
            else {
                // Generic handling for other types
                marketArea.locations = definitionValues.map(value => ({
                    id: value,
                    name: value,
                    state: state || "CA"
                }));
            }

            console.log(`Created ${maType} market area ${marketAreaName} with ${definitionValues.length} locations:`,
                marketArea.locations.map(l => l.id).join(', '));

            marketAreas.push(marketArea);
        }

        console.log(`Successfully created ${marketAreas.length} market areas from template`);
        return marketAreas;
    };

    // Enhanced definition type mapping
    const mapDefinitionTypeToMAType = (definitionType) => {
        if (!definitionType) return 'tract'; // Default to tract if empty

        // Normalize the input for consistent comparison
        const normalizedType = definitionType.toUpperCase().trim();

        // Direct mappings for exact matches
        const typeMap = {
            'ZCTA': 'zip',
            'ZIP': 'zip',
            'COUNTY': 'county',
            'TRACT': 'tract',
            'PLACE': 'place',
            'BLOCK': 'block',
            'BLOCK GROUP': 'blockgroup',
            'BLOCKGROUP': 'blockgroup',
            'CBSA': 'cbsa',
            'STATE': 'state',
            'MD': 'md',
            'METRO DIVISION': 'md',
            'RADIUS': 'radius',
            'DRIVETIME': 'drivetime',
            'DRIVE TIME': 'drivetime',
            'DRIVE-TIME': 'drivetime'
        };

        // Check for direct match
        if (typeMap[normalizedType]) {
            return typeMap[normalizedType];
        }

        // Fallback to partial matching
        if (normalizedType.includes('ZIP') || normalizedType.includes('ZCTA')) {
            return 'zip';
        }
        if (normalizedType.includes('COUNTY')) {
            return 'county';
        }
        if (normalizedType.includes('TRACT')) {
            return 'tract';
        }
        if (normalizedType.includes('PLACE')) {
            return 'place';
        }
        if (normalizedType.includes('BLOCK') && normalizedType.includes('GROUP')) {
            return 'blockgroup';
        }
        if (normalizedType.includes('BLOCK')) {
            return 'block';
        }
        if (normalizedType.includes('CBSA') || normalizedType.includes('METRO AREA')) {
            return 'cbsa';
        }
        if (normalizedType.includes('STATE')) {
            return 'state';
        }
        if (normalizedType.includes('MD') ||
            normalizedType.includes('DIVISION') ||
            (normalizedType.includes('METRO') && normalizedType.includes('DIV'))) {
            return 'md';
        }
        if (normalizedType.includes('RADIUS')) {
            return 'radius';
        }
        if (normalizedType.includes('DRIVE') || normalizedType.includes('TIME')) {
            return 'drivetime';
        }

        // Default to tract if nothing matches
        return 'tract';
    };

    // Process standard format
    const processStandardData = (data) => {
        // Check if we have data with at least 2 rows (headers + data)
        if (!data || data.length < 2) {
            throw new Error("Invalid data format: The Excel file must have headers and at least one row of data");
        }

        console.log("Processing standard format data:", data);
        const headers = data[0];

        // Find key columns and their indices
        const nameIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase().includes('name'));
        const typeIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase().includes('type') || h.toLowerCase().includes('ma_type')));
        const fillColorIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase().includes('fill') && h.toLowerCase().includes('color'));
        const borderColorIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase().includes('border') || h.toLowerCase().includes('outline')) && h.toLowerCase().includes('color'));
        const borderWidthIndex = headers.findIndex(h =>
            typeof h === 'string' && ((h.toLowerCase().includes('border') || h.toLowerCase().includes('outline')) && h.toLowerCase().includes('width')));
        const fillOpacityIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase().includes('opacity') || h.toLowerCase().includes('transparency')));
        const locationsIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase().includes('locations') || h.toLowerCase().includes('areas')));
        const stateIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase() === 'state');

        // Additional columns for drive time and radius
        const driveTimePointsIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase().includes('drive_time_points'));
        const radiusPointsIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase().includes('radius_points'));
        const latitudeIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase() === 'latitude' || h.toLowerCase() === 'lat'));
        const longitudeIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase() === 'longitude' || h.toLowerCase() === 'lon'));
        const radiusIndex = headers.findIndex(h =>
            typeof h === 'string' && h.toLowerCase() === 'radius');
        const timeIndex = headers.findIndex(h =>
            typeof h === 'string' && (h.toLowerCase().includes('minutes') || h.toLowerCase().includes('time')));

        // Ensure we have the minimum required fields
        if (nameIndex === -1 || typeIndex === -1) {
            throw new Error("Required columns missing: The Excel file must include 'Name' and 'Type' columns");
        }

        const marketAreas = [];

        // Process each row (skip header)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || !row.length || !row[nameIndex] || !row[typeIndex]) {
                continue;
            }

            // Extract state information if available
            const state = stateIndex !== -1 && row[stateIndex] ? String(row[stateIndex]).trim() : "CA";

            // Extract locations data if available
            let locations = [];
            if (locationsIndex !== -1 && row[locationsIndex]) {
                try {
                    // Handle different location formats:
                    // Could be JSON string, comma-separated IDs, or other serialized format
                    const locationData = row[locationsIndex];

                    if (typeof locationData === 'string') {
                        // Try to parse as JSON first
                        try {
                            locations = JSON.parse(locationData);
                        } catch {
                            // If not JSON, assume comma-separated values
                            locations = locationData.split(',').map(loc => ({
                                id: loc.trim(),
                                name: loc.trim(),
                                state: state // Add state info to each location
                            }));
                        }
                    } else if (Array.isArray(locationData)) {
                        locations = locationData;
                    }

                    // Ensure each location has state info
                    locations = locations.map(loc => ({
                        ...loc,
                        state: loc.state || state
                    }));
                } catch (error) {
                    console.warn(`Failed to parse locations for row ${i}:`, error);
                }
            }

            // Create style settings object
            const styleSettings = {};

            if (fillColorIndex !== -1 && row[fillColorIndex]) {
                styleSettings.fillColor = ensureHexColor(row[fillColorIndex]);
            }

            if (borderColorIndex !== -1 && row[borderColorIndex]) {
                styleSettings.borderColor = ensureHexColor(row[borderColorIndex]);
            }

            if (borderWidthIndex !== -1 && row[borderWidthIndex] !== undefined) {
                styleSettings.borderWidth = Number(row[borderWidthIndex]) || 1;
            }

            if (fillOpacityIndex !== -1 && row[fillOpacityIndex] !== undefined) {
                // Convert to 0-1 range if value is 0-100
                let opacity = Number(row[fillOpacityIndex]);
                if (opacity > 1 && opacity <= 100) {
                    opacity = opacity / 100;
                }
                styleSettings.fillOpacity = opacity;
            }

            // Determine the market area type and normalize it
            const maType = normalizeMarketAreaType(String(row[typeIndex]));

            // Create market area object
            const marketArea = {
                name: String(row[nameIndex]),
                short_name: String(row[nameIndex]).substring(0, 20),
                ma_type: maType,
                description: `Imported from ${fileName}`,
                style_settings: Object.keys(styleSettings).length > 0 ? styleSettings : undefined,
                project: effectiveProjectId,
                project_id: effectiveProjectId
            };

            // Handle different market area types appropriately
            if (maType === 'radius') {
                // Process radius type
                let radiusPoints = [];

                // First check for direct radius_points JSON
                if (radiusPointsIndex !== -1 && row[radiusPointsIndex]) {
                    try {
                        radiusPoints = JSON.parse(row[radiusPointsIndex]);
                        if (!Array.isArray(radiusPoints)) {
                            radiusPoints = [radiusPoints];
                        }
                    } catch (e) {
                        console.warn(`Failed to parse radius_points for row ${i}:`, e);
                    }
                }
                // If no radius_points, try to create from lat/lon/radius columns
                else if (longitudeIndex !== -1 && latitudeIndex !== -1 && radiusIndex !== -1 &&
                    row[longitudeIndex] && row[latitudeIndex] && row[radiusIndex]) {
                    radiusPoints = [{
                        center: {
                            longitude: Number(row[longitudeIndex]),
                            latitude: Number(row[latitudeIndex]),
                            spatialReference: { wkid: 4326 }
                        },
                        radii: [Number(row[radiusIndex])],
                        units: 'miles'
                    }];
                }
                // Default radius if needed
                if (radiusPoints.length === 0) {
                    radiusPoints = [{
                        center: {
                            longitude: -117.8311, // Orange County default
                            latitude: 33.7175,
                            spatialReference: { wkid: 4326 }
                        },
                        radii: [5], // Default 5-mile radius
                        units: 'miles'
                    }];
                }

                marketArea.radius_points = radiusPoints;
                marketArea.locations = []; // Radius types don't use locations
            }
            else if (maType === 'drivetime') {
                // Process drive time type
                let driveTimePoints = [];

                // First check for direct drive_time_points JSON
                if (driveTimePointsIndex !== -1 && row[driveTimePointsIndex]) {
                    try {
                        driveTimePoints = JSON.parse(row[driveTimePointsIndex]);
                        if (!Array.isArray(driveTimePoints)) {
                            driveTimePoints = [driveTimePoints];
                        }
                    } catch (e) {
                        console.warn(`Failed to parse drive_time_points for row ${i}:`, e);
                    }
                }
                // If no drive_time_points, try to create from lat/lon/time columns
                else if (longitudeIndex !== -1 && latitudeIndex !== -1 && timeIndex !== -1 &&
                    row[longitudeIndex] && row[latitudeIndex] && row[timeIndex]) {
                    driveTimePoints = [{
                        center: {
                            longitude: Number(row[longitudeIndex]),
                            latitude: Number(row[latitudeIndex]),
                            spatialReference: { wkid: 4326 }
                        },
                        travelTimeMinutes: Number(row[timeIndex]),
                        timeRanges: [Number(row[timeIndex])],
                        units: 'minutes'
                    }];
                }
                // Default drive time if needed
                if (driveTimePoints.length === 0) {
                    driveTimePoints = [{
                        center: {
                            longitude: -117.8311, // Orange County default
                            latitude: 33.7175,
                            spatialReference: { wkid: 4326 }
                        },
                        travelTimeMinutes: 15, // Default 15-minute drive time
                        timeRanges: [15],
                        units: 'minutes'
                    }];
                }

                marketArea.drive_time_points = driveTimePoints;
                marketArea.locations = []; // Drive time types don't use locations
            }
            else {
                // If locations array is empty, create a simple one based on the market area type
                if (locations.length === 0) {
                    if (maType === 'zip') {
                        // Default to a simple location with state info
                        locations = [{
                            id: marketArea.name,
                            name: marketArea.name,
                            state: state || "CA"
                        }];
                    } else if (maType === 'county') {
                        locations = [{
                            id: marketArea.name,
                            name: marketArea.name,
                            state: state || "CA"
                        }];
                    } else {
                        // For other types
                        locations = [{
                            id: marketArea.name,
                            name: marketArea.name,
                            state: state || "CA"
                        }];
                    }
                }

                // Assign the locations to the market area
                marketArea.locations = locations;
                marketArea.radius_points = []; // Empty for non-radius types
                marketArea.drive_time_points = []; // Empty for non-drivetime types
            }

            marketAreas.push(marketArea);
        }

        return marketAreas;
    };

    // Helper function to ensure color is in hex format
    const ensureHexColor = (color) => {
        if (!color) return "#0078D4"; // Default blue

        // If already a hex color, return as is
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }

        // Try to convert from string like "rgb(255, 0, 0)" to hex
        if (typeof color === 'string' && color.startsWith('rgb')) {
            try {
                const matches = color.match(/\d+/g);
                if (matches && matches.length >= 3) {
                    const r = parseInt(matches[0]);
                    const g = parseInt(matches[1]);
                    const b = parseInt(matches[2]);
                    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                }
            } catch {
                // Fall through to default
            }
        }

        return "#0078D4"; // Default blue
    };

    // Helper function to normalize market area type
    const normalizeMarketAreaType = (type) => {
        const lcType = type.toLowerCase();

        // Map to known types
        if (lcType.includes('zip')) return 'zip';
        if (lcType.includes('zcta')) return 'zip';
        if (lcType.includes('county')) return 'county';
        if (lcType.includes('tract')) return 'tract';
        if (lcType.includes('block')) {
            if (lcType.includes('group')) return 'blockgroup';
            return 'block';
        }
        if (lcType.includes('place')) return 'place';
        if (lcType.includes('state')) return 'state';
        if (lcType.includes('cbsa')) return 'cbsa';
        if (lcType.includes('radius')) return 'radius';
        if (lcType.includes('drive') || lcType.includes('time')) return 'drivetime';

        // Default to tract if unknown
        return 'tract';
    };

    // If not open, don't render anything
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-30" onClick={handleClose}></div>
            <div className="min-h-screen px-4 text-center">
                <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl relative">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                            Import Market Areas
                        </h3>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <div className="mt-4">
                        <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
                            Select an Excel file to import market areas. The importer supports both standard tabular formats and the Market Area Definition template format.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label
                                    htmlFor="file-upload"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Excel File
                                </label>
                                <div className="mt-1 flex items-center">
                                    <input
                                        ref={fileInputRef}
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-500 dark:text-gray-300
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-md file:border-0
                             file:text-sm file:font-medium
                             file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-200
                             hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
                                    />
                                </div>
                                {fileName && (
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                        Selected: {fileName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                            onClick={handleClose}
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isProcessing || !fileSelected
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                                }`}
                            onClick={handleProcessFile}
                            disabled={isProcessing || !fileSelected}
                        >
                            {isProcessing ? "Processing..." : "Preview Import"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <MarketAreaPreviewModal
                    marketAreas={detectedMarketAreas}
                    onClose={() => setShowPreview(false)}
                    onImport={handleImport}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
}

// Updated MarketAreaPreviewModal with larger dimensions
function MarketAreaPreviewModal({ marketAreas, onClose, onImport, isProcessing }) {
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [confirmedMarketAreas, setConfirmedMarketAreas] = useState([...marketAreas]);
    const [editedMarketAreas, setEditedMarketAreas] = useState([...marketAreas]);

    // Handle import confirmation
    const handleConfirmImport = () => {
        onImport(confirmedMarketAreas);
    };

    // Update market area data when edited
    const handleMarketAreaUpdate = (index, updatedMarketArea) => {
        const newEditedMarketAreas = [...editedMarketAreas];
        newEditedMarketAreas[index] = updatedMarketArea;
        setEditedMarketAreas(newEditedMarketAreas);

        // Update confirmed market areas too
        const newConfirmedMarketAreas = [...confirmedMarketAreas];
        newConfirmedMarketAreas[index] = updatedMarketArea;
        setConfirmedMarketAreas(newConfirmedMarketAreas);
    };

    // Handle tab selection
    const handleTabChange = (index) => {
        setActiveTabIndex(index);
    };

    // Handle market area exclusion toggle
    const handleMarketAreaToggle = (index) => {
        setConfirmedMarketAreas(prev => {
            const updated = [...prev];

            // If it's currently in the array, remove it
            if (updated.includes(editedMarketAreas[index])) {
                return updated.filter(ma => ma !== editedMarketAreas[index]);
            }
            // Otherwise, add it
            else {
                updated[index] = editedMarketAreas[index];
                return updated;
            }
        });
    };

    // Check if market area is included for import
    const isMarketAreaIncluded = (index) => {
        return confirmedMarketAreas.includes(editedMarketAreas[index]);
    };

    return (
        <div className="fixed inset-0 z-20 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="min-h-screen px-4 py-8 flex items-center justify-center">
                {/* Increased max-width from max-w-4xl to max-w-6xl and added min-width */}
                <div className="w-full max-w-6xl min-w-[800px] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden transition-all transform">
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Preview Market Areas
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-500"
                                disabled={isProcessing}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Review and confirm the market areas to be imported.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 dark:border-gray-600">
                        <div className="flex overflow-x-auto">
                            {marketAreas.map((marketArea, index) => (
                                <button
                                    key={index}
                                    className={`px-4 py-2 text-sm font-medium flex items-center ${activeTabIndex === index
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                    onClick={() => handleTabChange(index)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isMarketAreaIncluded(index)}
                                        onChange={() => handleMarketAreaToggle(index)}
                                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="truncate max-w-xs">{marketArea.name}</span>
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        {marketArea.ma_type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab content - increased max-h-96 to max-h-[60vh] for more room */}
                    <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                        {marketAreas.length > 0 && (
                            <MarketAreaImportTab
                                marketArea={editedMarketAreas[activeTabIndex]}
                                index={activeTabIndex}
                                onUpdate={handleMarketAreaUpdate}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium">{confirmedMarketAreas.filter(Boolean).length}</span> of <span className="font-medium">{marketAreas.length}</span> market areas selected for import
                        </div>
                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isProcessing || confirmedMarketAreas.filter(Boolean).length === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                    }`}
                                disabled={isProcessing || confirmedMarketAreas.filter(Boolean).length === 0}
                            >
                                {isProcessing ? "Importing..." : "Import Selected"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Individual tab content for a market area
function MarketAreaImportTab({ marketArea, index, onUpdate }) {
    // Create editable copy of market area
    const [editableMarketArea, setEditableMarketArea] = useState({ ...marketArea });

    // Only update internal state when marketArea prop changes
    useEffect(() => {
        setEditableMarketArea(marketArea);
    }, [marketArea]);

    // Handle input changes
    const handleInputChange = (field, value) => {
        const updatedMarketArea = {
            ...editableMarketArea,
            [field]: value
        };
        setEditableMarketArea(updatedMarketArea);
        onUpdate(index, updatedMarketArea);
    };

    // Handle style changes
    const handleStyleChange = (type, value) => {
        const updatedMarketArea = { ...editableMarketArea };
        const styleSettings = { ...(updatedMarketArea.style_settings || {}) };

        if (type === "noBorder") {
            styleSettings.noBorder = value;
            if (value) {
                styleSettings.borderWidth = 0;
            } else if (styleSettings.borderWidth === 0) {
                styleSettings.borderWidth = 3;
            }
        } else if (type === "noFill") {
            styleSettings.noFill = value;
            if (value) {
                styleSettings.fillOpacity = 0;
            } else if (styleSettings.fillOpacity === 0) {
                styleSettings.fillOpacity = 0.35;
            }
        } else if (type === "fillOpacity") {
            styleSettings.fillOpacity = Math.max(0, Math.min(1, value));
            if (styleSettings.fillOpacity === 0) {
                styleSettings.noFill = true;
            } else {
                styleSettings.noFill = false;
            }
        } else if (type === "borderWidth") {
            styleSettings.borderWidth = Math.max(0, Number(value));
            if (styleSettings.borderWidth === 0) {
                styleSettings.noBorder = true;
            } else {
                styleSettings.noBorder = false;
            }
        } else {
            styleSettings[type] = value;
        }

        updatedMarketArea.style_settings = styleSettings;
        setEditableMarketArea(updatedMarketArea);
        onUpdate(index, updatedMarketArea);
    };

    // Function to determine what to display for locations
    const renderLocationsSummary = () => {
        const locations = editableMarketArea.locations || [];

        if (locations.length === 0) {
            return <p className="text-gray-500 dark:text-gray-400 italic">No locations defined</p>;
        }

        if (locations.length <= 5) {
            return (
                <ul className="list-disc list-inside text-sm">
                    {locations.map((loc, i) => (
                        <li key={i} className="text-gray-700 dark:text-gray-300">
                            {loc.name || loc.id}
                            {loc.state ? ` (${loc.state})` : ''}
                        </li>
                    ))}
                </ul>
            );
        }

        return (
            <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {locations.length} locations defined
                </p>
                <ul className="list-disc list-inside text-sm">
                    {locations.slice(0, 3).map((loc, i) => (
                        <li key={i} className="text-gray-700 dark:text-gray-300">
                            {loc.name || loc.id}
                            {loc.state ? ` (${loc.state})` : ''}
                        </li>
                    ))}
                    <li className="text-gray-500 italic">plus {locations.length - 3} more...</li>
                </ul>
            </div>
        );
    };

    // Function to render radius points summary
    const renderRadiusPointsSummary = () => {
        const radiusPoints = editableMarketArea.radius_points || [];

        if (radiusPoints.length === 0) {
            return <p className="text-gray-500 dark:text-gray-400 italic">No radius points defined</p>;
        }

        return (
            <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {radiusPoints.length} radius point{radiusPoints.length > 1 ? 's' : ''} defined
                </p>
                <ul className="list-disc list-inside text-sm">
                    {radiusPoints.map((point, i) => {
                        // Get coordinates
                        const center = point.center || {};
                        const lat = center.latitude || center.y || 0;
                        const lng = center.longitude || center.x || 0;

                        // Get radius values
                        const radii = Array.isArray(point.radii) ? point.radii : [point.radius];
                        const units = point.units || 'miles';

                        return (
                            <li key={i} className="text-gray-700 dark:text-gray-300">
                                {lat.toFixed(4)}, {lng.toFixed(4)} - {radii.join(', ')} {units}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    // Function to render drive time points summary
    const renderDriveTimePointsSummary = () => {
        const driveTimePoints = editableMarketArea.drive_time_points || [];

        if (driveTimePoints.length === 0) {
            return <p className="text-gray-500 dark:text-gray-400 italic">No drive time points defined</p>;
        }

        return (
            <div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {driveTimePoints.length} drive time point{driveTimePoints.length > 1 ? 's' : ''} defined
                </p>
                <ul className="list-disc list-inside text-sm">
                    {driveTimePoints.map((point, i) => {
                        // Get coordinates
                        const center = point.center || {};
                        const lat = center.latitude || center.y || 0;
                        const lng = center.longitude || center.x || 0;

                        // Get time value
                        const timeValue = point.travelTimeMinutes ||
                            (Array.isArray(point.timeRanges) ? point.timeRanges[0] : point.timeRange) ||
                            15;

                        return (
                            <li key={i} className="text-gray-700 dark:text-gray-300">
                                {lat.toFixed(4)}, {lng.toFixed(4)} - {timeValue} minutes
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    // Ensure the market area has a style_settings object
    const styleSettings = editableMarketArea.style_settings || {
        fillColor: "#0078D4",
        fillOpacity: 0.35,
        borderColor: "#0078D4",
        borderWidth: 3,
        noFill: false,
        noBorder: false
    };

    return (
        <div className="space-y-6">
            {/* Basic Information */}
            <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Market Area Name
                        </label>
                        <input
                            type="text"
                            value={editableMarketArea.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Short Name
                        </label>
                        <input
                            type="text"
                            value={editableMarketArea.short_name || ''}
                            onChange={(e) => handleInputChange('short_name', e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white text-sm"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Market Area Type
                    </label>
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-3 text-sm text-gray-700 dark:text-gray-300">
                        {editableMarketArea.ma_type || 'Unknown'}
                    </div>
                </div>
            </div>

            {/* Style Settings */}
            <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Style Settings
                </h4>
                <StyleSettingsPanel
                    styleSettings={styleSettings}
                    onStyleChange={handleStyleChange}
                />
            </div>

            {/* Locations/Points */}
            <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    {editableMarketArea.ma_type === 'radius' ? 'Radius Points' :
                        editableMarketArea.ma_type === 'drivetime' ? 'Drive Time Points' :
                            'Locations'}
                </h4>

                {editableMarketArea.ma_type === 'radius' ? (
                    renderRadiusPointsSummary()
                ) : editableMarketArea.ma_type === 'drivetime' ? (
                    renderDriveTimePointsSummary()
                ) : (
                    renderLocationsSummary()
                )}
            </div>
        </div>
    );
}