import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from 'xlsx';
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { useMap } from "../../contexts/MapContext";
import { useParams } from "react-router-dom";
import { StyleSettingsPanel } from "../market-areas/StyleSettingsPanel";
import ThemeSelector from "../market-areas/ThemeSelector";

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

    // Define supported market area types
    const SUPPORTED_MARKET_AREA_TYPES = ['zip', 'place', 'county'];

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
            const { jsonData, workbook } = await readExcelFile(file);

            if (!jsonData || !jsonData.length) {
                toast.error("No valid data found in the Excel file");
                toast.dismiss(loadingToast);
                setIsProcessing(false);
                return;
            }

            console.log("Excel data loaded with", jsonData.length, "rows");

            // Try to detect if this is a standard format or the special template format
            const isTemplateFormat = detectTemplateFormat(jsonData);
            console.log("Detected format:", isTemplateFormat ? "template" : "standard");

            let allMarketAreas = [];
            if (isTemplateFormat) {
                allMarketAreas = processTemplateData(jsonData, workbook);
            } else {
                allMarketAreas = processStandardData(jsonData, workbook);
            }

            // Filter to only include supported types
            const marketAreas = allMarketAreas.filter(ma => SUPPORTED_MARKET_AREA_TYPES.includes(ma.ma_type));
            
            // Log how many areas were filtered out
            const filteredOutCount = allMarketAreas.length - marketAreas.length;
            if (filteredOutCount > 0) {
                console.log(`Filtered out ${filteredOutCount} unsupported market area types. Only ZIP, Place, and County are supported.`);
            }

            if (marketAreas.length === 0) {
                toast.error("No supported market areas found in the file. Only ZIP, Place, and County are supported.");
                toast.dismiss(loadingToast);
                setIsProcessing(false);
                return;
            }

            // Set detected market areas and show preview
            setDetectedMarketAreas(marketAreas);
            setShowPreview(true);
            toast.dismiss(loadingToast);
            if (filteredOutCount > 0) {
                toast.success(`Found ${marketAreas.length} supported market areas. Ignored ${filteredOutCount} unsupported types (only ZIP, Place, and County are supported).`);
            } else {
                toast.success(`Found ${marketAreas.length} market areas. Please review before importing.`);
            }
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
            else {
                // We only support zip, county, and place - but this is a fallback
                console.warn(`Unsupported market area type: ${marketArea.ma_type}`);
                return [];
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

        // We only care about zip, place, and county types now
        normalizedData.locations = [];
        
        // Process locations
        if (marketArea.locations && Array.isArray(marketArea.locations)) {
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

                // Skip if not a supported type
                if (!SUPPORTED_MARKET_AREA_TYPES.includes(marketArea.ma_type)) {
                    results.errors.push(`${marketArea.name}: Unsupported market area type ${marketArea.ma_type}`);
                    continue;
                }

                // Normalize the market area data based on type
                const normalizedMarketArea = normalizeMarketAreaData(marketArea);
                console.log(`Normalized market area ${marketArea.name} for import:`, normalizedMarketArea);

                // For feature-based market areas, fetch geometry first
                if (normalizedMarketArea.locations?.length > 0) {
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

                // Log the normalized market area for debugging
                console.log(`Final normalized market area for API submission:`, {
                    id: normalizedMarketArea.id,
                    name: normalizedMarketArea.name,
                    ma_type: normalizedMarketArea.ma_type,
                    style_settings: normalizedMarketArea.style_settings,
                    locations_count: normalizedMarketArea.locations?.length || 0
                });

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
                // Visualize the market area with enhanced logging 
                console.log(`Visualizing market area with style settings:`, savedMarketArea.style_settings);
                await visualizeMarketArea(savedMarketArea);

            } catch (error) {
                console.error(`Failed to import market area ${marketArea.name}:`, error);
                results.errors.push(`${marketArea.name}: ${error.message}`);
            }
        }

        return results;
    };

    // Visualize a market area based on its type
    const visualizeMarketArea = async (marketArea, forceRefresh = false) => {
        try {
            console.log(`Visualizing market area: ${marketArea.id} (${marketArea.ma_type})`);
    
            // Skip if not a supported type
            if (!SUPPORTED_MARKET_AREA_TYPES.includes(marketArea.ma_type)) {
                console.warn(`Skipping visualization for unsupported type: ${marketArea.ma_type}`);
                return;
            }
    
            // If this is a force refresh, clear any existing graphics for this market area
            if (forceRefresh && selectionGraphicsLayer) {
                const existingGraphics = selectionGraphicsLayer.graphics.filter(
                    g => g.attributes?.marketAreaId === marketArea.id
                );
                
                if (existingGraphics.length > 0) {
                    console.log(`Removing ${existingGraphics.length} existing graphics for market area ${marketArea.id}`);
                    selectionGraphicsLayer.removeMany(existingGraphics);
                }
            }
    
            // Activate the corresponding layer if needed for feature-based market areas
            await addActiveLayer(marketArea.ma_type);
    
            // Process feature-based market areas (zip, county, place)
            if (marketArea.locations && marketArea.locations.length > 0) {
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
                        // Extract style settings from the market area
                        const styleSettings = marketArea.style_settings || {};
                        
                        // Apply styling to features
                        await updateFeatureStyles(
                            features,
                            {
                                fill: styleSettings.fillColor || "#0078D4",
                                fillOpacity: styleSettings.noFill ? 0 : 
                                    (styleSettings.fillOpacity !== undefined ? styleSettings.fillOpacity : 0.35),
                                outline: styleSettings.borderColor || "#0078D4",
                                outlineWidth: styleSettings.noBorder ? 0 : 
                                    (styleSettings.borderWidth !== undefined ? styleSettings.borderWidth : 2)
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
            }
            // Add support for radius and drivetime market areas if needed
            else if (marketArea.ma_type === 'radius' && marketArea.radius_points?.length > 0) {
                // Handle radius market areas
                for (const point of marketArea.radius_points) {
                    if (point && point.center) {
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
            }
            else if (marketArea.ma_type === 'drivetime' && marketArea.drive_time_points?.length > 0) {
                // Handle drive time market areas
                for (const point of marketArea.drive_time_points) {
                    if (point && point.center) {
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
            }
            else {
                console.warn(`Market area ${marketArea.id} has no valid locations to visualize`);
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

// Enhance the cleanupAfterImport function
const cleanupAfterImport = () => {
    // Reset form state
    resetForm();

    // Close the dialog
    onClose();

    // If we were using the map selection, deactivate it temporarily to avoid any conflicts
    if (typeof setIsMapSelectionActive === 'function') {
        setIsMapSelectionActive(false);
        
        // Re-enable after a short delay
        setTimeout(() => {
            setIsMapSelectionActive(true);
        }, 500);
    }

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
        else if (maType === 'place') {
            const locName = String(location.name || location.id || '').toLowerCase().trim();
            return features.find(feature => {
                const featureName = String(feature.attributes.NAME || '').toLowerCase().trim();
                return featureName.includes(locName) || locName.includes(featureName);
            });
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

    const handleImport = async (confirmedMarketAreas) => {
        setIsProcessing(true);
        const loadingToast = toast.loading("Importing market areas...");
    
        try {
            // Turn off map selection temporarily before we start
            if (typeof setIsMapSelectionActive === 'function') {
                setIsMapSelectionActive(false);
            }
    
            // Store existing graphics we want to keep
            const existingGraphics = storeExistingGraphics();
            console.log(`Preserving ${existingGraphics.length} existing graphics`);
    
            // Clear the selection graphics layer before import to avoid duplicates
            if (selectionGraphicsLayer) {
                selectionGraphicsLayer.removeAll();
            }
    
            // Import all selected market areas
            const importResults = await importAllMarketAreas(confirmedMarketAreas);
    
            // Log visibility state before update
            console.log("Visibility state before update:", localStorage.getItem(`marketAreas.${effectiveProjectId}.visible`));
    
            // Update visibility state with newly created market areas - CRITICAL FOR VISIBILITY ISSUE
            if (importResults.createdMarketAreaIds.length > 0) {
                console.log(`Ensuring visibility for ${importResults.createdMarketAreaIds.length} market areas:`, 
                    importResults.createdMarketAreaIds);
                    
                // Force update the visibility state
                updateVisibilityState(importResults.createdMarketAreaIds);
                
                // Verify the update was applied correctly
                const storedVisibleIds = localStorage.getItem(`marketAreas.${effectiveProjectId}.visible`);
                console.log(`After visibility update, localStorage contains: ${storedVisibleIds}`);
                
                // Direct update to the context's state to force UI refresh
                if (typeof setVisibleMarketAreaIds === 'function') {
                    try {
                        const parsedIds = storedVisibleIds ? JSON.parse(storedVisibleIds) : [];
                        console.log("Directly updating visible market area IDs in context:", parsedIds);
                        setVisibleMarketAreaIds(parsedIds);
                    } catch (e) {
                        console.error("Error parsing visible IDs:", e);
                    }
                }
    
                // Try to zoom to first created market area
                await zoomToCreatedMarketAreas(importResults.createdMarketAreaIds);
            }
    
            // Restore any existing graphics that we want to keep
            await restoreExistingGraphics(existingGraphics);
    
            // Complete the import process
            toast.dismiss(loadingToast);
    
            if (importResults.importedCount > 0) {
                toast.success(`Successfully imported ${importResults.importedCount} market areas`);
    
                if (importResults.errors.length > 0) {
                    console.error("Some market areas failed to import:", importResults.errors);
                    toast.error(`${importResults.errors.length} market areas failed to import. Check console for details.`);
                }
    
                // Make sure we've properly applied styles to all imported market areas
                // This is similar to the MarketAreaForm behavior
                for (const marketAreaId of importResults.createdMarketAreaIds) {
                    try {
                        // Get the market area for visualization
                        const marketArea = await marketAreasContext.getMarketArea(effectiveProjectId, marketAreaId);
                        
                        if (marketArea) {
                            // CRITICAL: Ensure the market area is marked as visible before visualizing
                            marketArea.is_visible = true;
                            
                            // Force refresh visualization with the visibility flag
                            await visualizeMarketArea(marketArea, true);
                            
                            console.log(`Visualized market area ${marketAreaId} with visibility flag set`);
                        }
                    } catch (error) {
                        console.warn(`Error refreshing visualization for market area ${marketAreaId}:`, error);
                    }
                }
    
                // VISIBILITY FIX: Force another UI update after visualization
                if (typeof setVisibleMarketAreaIds === 'function') {
                    try {
                        const storedIds = localStorage.getItem(`marketAreas.${effectiveProjectId}.visible`);
                        const visibleIds = storedIds ? JSON.parse(storedIds) : [];
                        
                        if (visibleIds.length > 0) {
                            console.log("Final visibility update with IDs:", visibleIds);
                            setVisibleMarketAreaIds(visibleIds);
                            
                            // Dispatch a custom event that other components might listen for
                            window.dispatchEvent(new CustomEvent('marketAreasVisibilityChanged', {
                                detail: { visibleIds, projectId: effectiveProjectId }
                            }));
                        }
                    } catch (e) {
                        console.error("Error in final visibility update:", e);
                    }
                }
    
                // Perform cleanup and final refresh
                cleanupAfterImport();
                
                // VISIBILITY FIX: Force fetch market areas after a slight delay
                setTimeout(() => {
                    if (typeof marketAreasContext.fetchMarketAreas === 'function') {
                        console.log("Triggering delayed fetch of market areas to refresh visibility");
                        marketAreasContext.fetchMarketAreas(effectiveProjectId, true);
                    }
                }, 500);
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
    
            // Re-enable map selection after we're done
            if (typeof setIsMapSelectionActive === 'function') {
                setTimeout(() => {
                    setIsMapSelectionActive(true);
                }, 500); // Small delay to ensure everything else is complete
            }
        }
        };

    // Excel file reading function with full style support
    const readExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    
                    // Use all available style options for the most complete style information
                    const workbook = XLSX.read(data, { 
                        type: 'array', 
                        cellDates: true,
                        cellStyles: true,    // Enable reading cell styles
                        cellFormula: true,   // Include formulas
                        sheetStubs: true,    // Include empty cells
                        cellNF: true,        // Include number formats
                        cellHTML: false,     // Don't convert to HTML
                        dense: false         // Use sparse representation
                    });

                    console.log("Excel workbook loaded with styles. Sheets:", workbook.SheetNames);
                    
                    // Do a simple check to see if style information is available
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const hasStyles = Object.values(firstSheet).some(cell => 
                        cell && typeof cell === 'object' && cell.s && cell.s.fill);
                        
                    console.log(`Style information detected in workbook: ${hasStyles ? 'YES' : 'NO'}`);
                    
                    if (!hasStyles) {
                        console.warn("No cell style information found in the Excel file. Cell colors may not be available.");
                    }

                    // Convert to JSON (with headers)
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    
                    // Return both the data and workbook for style processing
                    resolve({ jsonData, workbook });
                } catch (error) {
                    console.error("Failed to parse Excel file:", error);
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


    const processTemplateData = (data, workbook) => {
        console.log("Processing template format data with support for only ZIP, Place, and County types");

        // Define exact row indices based on Excel structure
        const MARKET_AREA_NAME_ROW = 4;  // Row 5 in Excel
        const SHORT_NAME_ROW = 6;        // Row 7 in Excel
        const TEXT_COLOR_ROW = 8;        // Row 9 in Excel
        const DEFINITION_TYPE_ROW = 10;  // Row 11 in Excel
        const STATE_ROW = 12;            // Row 13 in Excel
        const COUNTY_ROW = 14;           // Row 15 in Excel
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

        // Enhanced helper function to get cell background color from workbook
        const getCellBackgroundColor = (row, col) => {
            if (!workbook) return null;
            
            try {
                // Get the first sheet
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Convert from zero-based (JS) to one-based (Excel) indexing
                const colLetter = XLSX.utils.encode_col(col);
                const rowNumber = row + 1;
                const cellAddress = `${colLetter}${rowNumber}`;
                
                console.log(`Checking for background color at cell ${cellAddress}`);
                
                // Check if cell exists
                if (!sheet[cellAddress]) {
                    console.log(`  - Cell ${cellAddress} not found in sheet`);
                    return null;
                }
                
                // Direct debug of cell properties
                console.log(`  - Cell ${cellAddress} properties:`, JSON.stringify(sheet[cellAddress]));
                
                // Check for fill information
                if (sheet[cellAddress].s && sheet[cellAddress].s.fill) {
                    const fill = sheet[cellAddress].s.fill;
                    console.log(`  - Fill information found:`, JSON.stringify(fill));
                    
                    // Check for fill color (could be fgColor or bgColor)
                    if (fill.fgColor && fill.fgColor.rgb) {
                        const color = `#${fill.fgColor.rgb.substring(fill.fgColor.rgb.length - 6)}`;
                        console.log(`  - Extracted foreground color: ${color}`);
                        return color;
                    }
                    if (fill.bgColor && fill.bgColor.rgb) {
                        const color = `#${fill.bgColor.rgb.substring(fill.bgColor.rgb.length - 6)}`;
                        console.log(`  - Extracted background color: ${color}`);
                        return color;
                    }
                }
                
                if (sheet[cellAddress].s) {
                    console.log(`  - Cell has style but no fill: ${JSON.stringify(sheet[cellAddress].s)}`);
                } else {
                    console.log(`  - Cell has no style information`);
                }
                
                return null; // No background color found
            } catch (error) {
                console.warn("Error getting cell background color:", error);
                return null;
            }
        };

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
                // Map definition type to market area type
                const maType = mapDefinitionTypeToMAType(definitionType);
                
                // Only process supported market area types
                if (SUPPORTED_MARKET_AREA_TYPES.includes(maType)) {
                    console.log(`Found supported market area in column ${col} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType})`);
                    marketAreaColumns.push(col);
                } else {
                    console.log(`Skipping unsupported market area in column ${col} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType})`);
                }
            }
        }

        console.log(`Found ${marketAreaColumns.length} supported market areas in columns: ${marketAreaColumns.map(col => String.fromCharCode(65 + col)).join(', ')}`);

        // No valid market areas found
        if (marketAreaColumns.length === 0) {
            console.warn("No supported market areas found in the template");
            return [];
        }

        // Process each market area
        const marketAreas = [];

        for (const col of marketAreaColumns) {
            const marketAreaName = String(data[MARKET_AREA_NAME_ROW][col] || "").trim();
            const definitionType = String(data[DEFINITION_TYPE_ROW][col] || "").trim();
            const maType = mapDefinitionTypeToMAType(definitionType);

            console.log(`Processing market area in column ${col} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType})`);

            // Extract all settings for this market area
            const shortName = data[SHORT_NAME_ROW] ? String(data[SHORT_NAME_ROW][col] || "").trim() : "";
            const state = data[STATE_ROW] ? String(data[STATE_ROW][col] || "").trim() : "CA"; // Default CA
            const county = data[COUNTY_ROW] ? String(data[COUNTY_ROW][col] || "").trim() : "";

            // Style settings - Default values
            let fillColor = "#0078D4"; // Default blue
            let fillOpacity = 0.3;      // Default 30% opacity
            let borderColor = "#0078D4"; // Default blue
            let borderWidth = 2;         // Default width
            let noFill = false;
            let noBorder = false;
            let themeName = "Default";

            // Debug current row positions
            console.log(`Style row positions - Fill Color: ${FILL_COLOR_ROW+1}, Transparency: ${TRANSPARENCY_ROW+1}, Border Color: ${BORDER_COLOR_ROW+1}, Border Weight: ${BORDER_WEIGHT_ROW+1}`);

            // Extract fill color - try to get cell background color first
            console.log(`Attempting to get fill color for column ${col}...`);
            const fillCellBackgroundColor = getCellBackgroundColor(FILL_COLOR_ROW, col);
            const fillTextValue = data[FILL_COLOR_ROW] && data[FILL_COLOR_ROW][col] 
                ? String(data[FILL_COLOR_ROW][col]).trim() 
                : "";
            
            // Log what we found
            console.log(`Fill color - Cell background: ${fillCellBackgroundColor || 'none'}, Text value: ${fillTextValue || 'none'}`);
            
            // If the cell text says "No Fill", set noFill to true and mark that we've explicitly seen this
            if (fillTextValue === "No Fill") {
                noFill = true;
                fillOpacity = 0;
                console.log(`  Market area ${marketAreaName}: Using No Fill (100% transparency)`);
            } 
            // Otherwise use cell background color or text value if available
            else if (fillCellBackgroundColor) {
                fillColor = fillCellBackgroundColor;
                console.log(`  Market area ${marketAreaName}: Using cell background color for fill: ${fillColor}`);
            } 
            else if (fillTextValue && fillTextValue !== "Text Color") {
                fillColor = fillTextValue;
                console.log(`  Market area ${marketAreaName}: Using text value for fill color: ${fillColor}`);
            }

            // Flag to track if "No Fill" was explicitly specified in the fill color cell
            const wasNoFillSpecified = fillTextValue === "No Fill";

            // Extract transparency - but only if we didn't already set noFill
            if (data[TRANSPARENCY_ROW] && data[TRANSPARENCY_ROW][col]) {
                const transparency = String(data[TRANSPARENCY_ROW][col]).trim();
                console.log(`Transparency value: "${transparency}"`);
                
                // Only apply transparency if "No Fill" wasn't already specified
                if (!wasNoFillSpecified) {
                    if (transparency === "No Fill") {
                        noFill = true;
                        fillOpacity = 0;
                        console.log(`  Market area ${marketAreaName}: Setting No Fill from transparency row`);
                    } else if (transparency.endsWith("%")) {
                        // Convert percentage to decimal (e.g., 70% -> 0.3 opacity)
                        const percent = parseInt(transparency);
                        if (!isNaN(percent)) {
                            fillOpacity = (100 - percent) / 100;
                            console.log(`  Market area ${marketAreaName}: Setting transparency to ${percent}% (opacity: ${fillOpacity})`);
                        }
                    } else if (!isNaN(parseFloat(transparency))) {
                        fillOpacity = parseFloat(transparency);
                        // If it's a decimal between 0-1, use as is, otherwise assume percentage
                        if (fillOpacity > 1) {
                            fillOpacity = (100 - fillOpacity) / 100;
                        }
                        console.log(`  Market area ${marketAreaName}: Setting opacity to ${fillOpacity}`);
                    }
                } else {
                    console.log(`  Skipping transparency setting because No Fill was already specified`);
                }
            }

            // Extract border color - try cell background color first
            console.log(`Attempting to get border color for column ${col}...`);
            const borderCellBackgroundColor = getCellBackgroundColor(BORDER_COLOR_ROW, col);
            const borderTextValue = data[BORDER_COLOR_ROW] && data[BORDER_COLOR_ROW][col] 
                ? String(data[BORDER_COLOR_ROW][col]).trim() 
                : "";
            
            // Log what we found
            console.log(`Border color - Cell background: ${borderCellBackgroundColor || 'none'}, Text value: ${borderTextValue || 'none'}`);
            
            // If the cell text says "No Border", set noBorder to true and mark that we've explicitly seen this
            if (borderTextValue === "No Border") {
                noBorder = true;
                borderWidth = 0;
                console.log(`  Market area ${marketAreaName}: Using No Border (border width = 0)`);
            } 
            // Otherwise use cell background color or text value if available
            else if (borderCellBackgroundColor) {
                borderColor = borderCellBackgroundColor;
                console.log(`  Market area ${marketAreaName}: Using cell background color for border: ${borderColor}`);
            } 
            else if (borderTextValue && borderTextValue !== "Text Color") {
                borderColor = borderTextValue;
                console.log(`  Market area ${marketAreaName}: Using text value for border color: ${borderColor}`);
            }

            // Flag to track if "No Border" was explicitly specified in the border color cell
            const wasNoBorderSpecified = borderTextValue === "No Border";

            // Extract border width - but only if we didn't already set noBorder
            if (data[BORDER_WEIGHT_ROW] && data[BORDER_WEIGHT_ROW][col]) {
                const weight = String(data[BORDER_WEIGHT_ROW][col]).trim();
                console.log(`Border weight value: "${weight}"`);
                
                // Only apply border width if "No Border" wasn't already specified
                if (!wasNoBorderSpecified) {
                    if (weight === "No Border") {
                        noBorder = true;
                        borderWidth = 0;
                        console.log(`  Market area ${marketAreaName}: Setting No Border from border weight row`);
                    } else if (!isNaN(parseInt(weight))) {
                        borderWidth = parseInt(weight);
                        console.log(`  Market area ${marketAreaName}: Setting border width to ${borderWidth}`);
                    }
                } else {
                    console.log(`  Skipping border weight setting because No Border was already specified`);
                }
            }

            // Final consistency check - ensure noFill and noBorder take precedence
            if (noFill) {
                fillOpacity = 0;
            }
            if (noBorder) {
                borderWidth = 0;
            }

            // Create style settings object with consistent values
            const styleSettings = {
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                noFill: noFill,
                borderColor: borderColor,
                borderWidth: borderWidth,
                noBorder: noBorder,
                themeName: themeName,
                excelFill: "#ffffff",
                excelText: "#000000"
            };

            console.log(`FINAL style settings for ${marketAreaName}:`, {
                fillColor: styleSettings.fillColor, 
                fillOpacity: styleSettings.fillOpacity,
                noFill: styleSettings.noFill,
                borderColor: styleSettings.borderColor,
                borderWidth: styleSettings.borderWidth,
                noBorder: styleSettings.noBorder
            });

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

            // For regular types, extract definition values
            const definitionValues = [];

            // Create a set of values to exclude (style settings, etc.)
            const excludeValues = new Set([
                "No Fill", "No Border", "Text Color", "0.7", "70%",
                marketAreaName, shortName, definitionType,
                state, county, "&", "NaN", "#NAME?",
                "County, Place, ZCTA", "Tract"
            ]);

            // First collect all possible definition values across all rows
            const allPossibleValues = [];
            
            // Scan rows 30-70 for definition values
            for (let i = DEFINITION_START_ROW; i < Math.min(data.length, DEFINITION_START_ROW + 40); i++) {
                // Skip if row doesn't exist or has no value in our column
                if (!data[i] || data[i][col] === undefined) continue;
                
                // Get the value and clean it
                const rawValue = data[i][col];
                const value = String(rawValue || "").trim();
                
                console.log(`Checking row ${i+1} (Excel row ${i+2}) for ${maType}: Raw value "${rawValue}", Trimmed: "${value}"`);
                
                // Skip empty values
                if (!value) continue;
                
                // Skip obvious non-definition values
                if (value.startsWith("*") || 
                    value.includes("required for:") ||
                    value === "No Fill" || 
                    value === "No Border" ||
                    value === "Text Color" ||
                    value === "&" ||
                    value === "#NAME?" ||
                    /^\d+%$/.test(value)) {
                    console.log(`  - Skipping obvious non-definition: "${value}"`);
                    continue;
                }
                
                // Add to potential values list for processing
                allPossibleValues.push({row: i+1, value});
            }
            
            // Now process all potential values based on market area type
            for (const {row, value} of allPossibleValues) {
                if (excludeValues.has(value)) {
                    console.log(`  - Row ${row}: Skipping excluded value: "${value}"`);
                    continue;
                }
                
                if (maType === 'zip') {
                    // For ZIP codes, allow splitting on delimiters
                    const potentialZips = value.split(/[\s,;]+/).filter(Boolean);
                    
                    for (const zip of potentialZips) {
                        const cleanZip = zip.trim();
                        if (cleanZip && !definitionValues.includes(cleanZip)) {
                            console.log(`  - Row ${row}: Adding ZIP: "${cleanZip}"`);
                            definitionValues.push(cleanZip);
                        }
                    }
                }
                else if (maType === 'county') {
                    // For counties, skip pure numbers
                    if (/^\d+$/.test(value)) {
                        console.log(`  - Row ${row}: Skipping numeric-only value for county: "${value}"`);
                        continue;
                    }
                    
                    if (!definitionValues.includes(value)) {
                        console.log(`  - Row ${row}: Adding county: "${value}"`);
                        definitionValues.push(value);
                    }
                }
                else if (maType === 'place') {
                    // For places, skip pure numbers
                    if (/^\d+$/.test(value)) {
                        console.log(`  - Row ${row}: Skipping numeric-only value for place: "${value}"`);
                        continue;
                    }
                    
                    if (!definitionValues.includes(value)) {
                        console.log(`  - Row ${row}: Adding place: "${value}"`);
                        definitionValues.push(value);
                    }
                }
            }

            // Log summary of collected definition values
            console.log(`Total definition values found for ${marketAreaName} (${maType}): ${definitionValues.length}`);
            if (definitionValues.length > 0) {
                console.log(`Values: ${definitionValues.join(', ')}`);
            } else {
                console.log(`No definition values found for ${marketAreaName}`);
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
            else {
                // This should not happen with our filtering, but just in case
                console.warn(`Skipping unsupported market area type: ${maType}`);
                continue;
            }

            console.log(`Created ${maType} market area ${marketAreaName} with ${definitionValues.length} locations:`,
                marketArea.locations.map(l => l.id).join(', '));

            marketAreas.push(marketArea);
        }

        console.log(`Successfully created ${marketAreas.length} supported market areas from template`);
        return marketAreas;
    };


    
    // Enhanced definition type mapping - only return supported types
    const mapDefinitionTypeToMAType = (definitionType) => {
        if (!definitionType) return null;

        // Normalize the input for consistent comparison
        const normalizedType = definitionType.toUpperCase().trim();

        // ZIP type mappings
        if (normalizedType.includes('ZIP') || normalizedType.includes('ZCTA')) {
            return 'zip';
        }
        
        // County type mappings
        if (normalizedType.includes('COUNTY')) {
            return 'county';
        }
        
        // Place type mappings
        if (normalizedType.includes('PLACE')) {
            return 'place';
        }

        // Return null for any other type (will be filtered out)
        return null;
    };

    // Process standard format with color support
    const processStandardData = (data, workbook) => {
        // Check if we have data with at least 2 rows (headers + data)
        if (!data || data.length < 2) {
            throw new Error("Invalid data format: The Excel file must have headers and at least one row of data");
        }

        console.log("Processing standard format data:", data);
        const headers = data[0];

        // Helper function to get cell background color from workbook
        const getCellBackgroundColor = (row, col) => {
            try {
                // Get the first sheet
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Convert from zero-based (JS) to one-based (Excel) indexing
                const colLetter = XLSX.utils.encode_col(col);
                const rowNumber = row + 1;
                const cellAddress = `${colLetter}${rowNumber}`;
                
                // Check if cell exists and has fill information
                if (sheet[cellAddress] && sheet[cellAddress].s && sheet[cellAddress].s.fill) {
                    const fill = sheet[cellAddress].s.fill;
                    
                    // Check for fill color (could be fgColor or bgColor)
                    if (fill.fgColor && fill.fgColor.rgb) {
                        return `#${fill.fgColor.rgb.substring(fill.fgColor.rgb.length - 6)}`;
                    }
                    if (fill.bgColor && fill.bgColor.rgb) {
                        return `#${fill.bgColor.rgb.substring(fill.bgColor.rgb.length - 6)}`;
                    }
                }
                return null; // No background color found
            } catch (error) {
                console.warn("Error getting cell background color:", error);
                return null;
            }
        };

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
            
            console.log(`Processing row ${i}:`, row);

            // Extract state information if available
            const state = stateIndex !== -1 && row[stateIndex] ? String(row[stateIndex]).trim() : "CA";

            // Determine the market area type and normalize it
            const maType = normalizeMarketAreaType(String(row[typeIndex]));

            // Skip unsupported market area types
            if (!SUPPORTED_MARKET_AREA_TYPES.includes(maType)) {
                console.log(`Skipping unsupported market area type: ${maType} for row ${i}`);
                continue;
            }

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

            // Create style settings object with defaults
            const styleSettings = {
                fillColor: "#0078D4", // Default blue
                fillOpacity: 0.35,    // Default opacity
                borderColor: "#0078D4", // Default blue
                borderWidth: 2,       // Default width
                noFill: false,
                noBorder: false
            };

            // Try to get cell background color for fill
            if (fillColorIndex !== -1) {
                const cellBgColor = getCellBackgroundColor(i, fillColorIndex);
                const textValue = row[fillColorIndex] ? String(row[fillColorIndex]) : "";
                
                if (textValue === "No Fill") {
                    styleSettings.noFill = true;
                    styleSettings.fillOpacity = 0;
                    console.log(`Row ${i}: Using No Fill (100% transparency)`);
                } 
                else if (cellBgColor) {
                    styleSettings.fillColor = cellBgColor;
                    console.log(`Row ${i}: Using cell background color for fill: ${cellBgColor}`);
                }
                else if (textValue && textValue !== "Text Color") {
                    styleSettings.fillColor = ensureHexColor(textValue);
                    console.log(`Row ${i}: Using fill color from text: ${styleSettings.fillColor}`);
                }
            }

            // Try to get cell background color for border
            if (borderColorIndex !== -1) {
                const cellBgColor = getCellBackgroundColor(i, borderColorIndex);
                const textValue = row[borderColorIndex] ? String(row[borderColorIndex]) : "";
                
                if (textValue === "No Border") {
                    styleSettings.noBorder = true;
                    styleSettings.borderWidth = 0;
                    console.log(`Row ${i}: Using No Border (border width = 0)`);
                } 
                else if (cellBgColor) {
                    styleSettings.borderColor = cellBgColor;
                    console.log(`Row ${i}: Using cell background color for border: ${cellBgColor}`);
                }
                else if (textValue && textValue !== "Text Color") {
                    styleSettings.borderColor = ensureHexColor(textValue);
                    console.log(`Row ${i}: Using border color from text: ${styleSettings.borderColor}`);
                }
            }

            // Handle transparency/opacity
            if (fillOpacityIndex !== -1 && row[fillOpacityIndex] !== undefined) {
                const transparencyValue = String(row[fillOpacityIndex] || "").trim();
                
                if (transparencyValue === "No Fill") {
                    styleSettings.noFill = true;
                    styleSettings.fillOpacity = 0;
                    console.log(`Row ${i}: Using No Fill from transparency column`);
                }
                else if (transparencyValue.endsWith("%")) {
                    // Convert percentage transparency to opacity (e.g., 70% transparency → 0.3 opacity)
                    const transparencyPercent = parseInt(transparencyValue);
                    if (!isNaN(transparencyPercent)) {
                        styleSettings.fillOpacity = (100 - transparencyPercent) / 100;
                        console.log(`Row ${i}: Setting transparency to ${transparencyPercent}% (opacity: ${styleSettings.fillOpacity})`);
                    }
                }
                else {
                    // Convert to 0-1 range if value is 0-100
                    let opacity = Number(transparencyValue);
                    if (!isNaN(opacity)) {
                        if (opacity > 1 && opacity <= 100) {
                            // If it's like "70" (meaning 70% transparency)
                            styleSettings.fillOpacity = (100 - opacity) / 100;
                        } else {
                            // Assume it's already an opacity value
                            styleSettings.fillOpacity = opacity;
                        }
                        
                        // Add noFill flag based on opacity
                        styleSettings.noFill = styleSettings.fillOpacity === 0;
                        console.log(`Row ${i}: Setting opacity to ${styleSettings.fillOpacity}`);
                    }
                }
            }

            // Handle border width
            if (borderWidthIndex !== -1 && row[borderWidthIndex] !== undefined) {
                const borderWidthValue = String(row[borderWidthIndex] || "").trim();
                
                if (borderWidthValue === "No Border") {
                    styleSettings.noBorder = true;
                    styleSettings.borderWidth = 0;
                    console.log(`Row ${i}: Setting No Border from border width column`);
                }
                else if (!isNaN(parseInt(borderWidthValue))) {
                    styleSettings.borderWidth = Number(borderWidthValue) || 1;
                    styleSettings.noBorder = styleSettings.borderWidth === 0;
                    console.log(`Row ${i}: Setting border width to ${styleSettings.borderWidth}`);
                }
            }

            // Create market area object
            const marketArea = {
                name: String(row[nameIndex]),
                short_name: String(row[nameIndex]).substring(0, 20),
                ma_type: maType,
                description: `Imported from ${fileName}`,
                style_settings: styleSettings,
                project: effectiveProjectId,
                project_id: effectiveProjectId
            };

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
                } else if (maType === 'place') {
                    locations = [{
                        id: marketArea.name,
                        name: marketArea.name,
                        state: state || "CA"
                    }];
                }
            }

            // Assign the locations to the market area
            marketArea.locations = locations;

            marketAreas.push(marketArea);
        }

        return marketAreas;
    };

    // Helper function to ensure color is in hex format with enhanced color name support
    const ensureHexColor = (color) => {
        if (!color) return "#0078D4"; // Default blue

        // Common color names mapping
        const colorMap = {
            'red': '#FF0000',
            'blue': '#0000FF',
            'green': '#008000',
            'yellow': '#FFFF00',
            'orange': '#FFA500',
            'purple': '#800080',
            'black': '#000000',
            'white': '#FFFFFF',
            'gray': '#808080',
            'grey': '#808080',
            'pink': '#FFC0CB',
            'brown': '#A52A2A',
            'teal': '#008080',
            'navy': '#000080',
            'lime': '#00FF00',
            'cyan': '#00FFFF',
            'magenta': '#FF00FF',
            'maroon': '#800000',
            'olive': '#808000',
            'silver': '#C0C0C0',
            'aqua': '#00FFFF',
            'fuchsia': '#FF00FF'
        };

        // If already a hex color, return as is
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }

        // Check if it's a standard color name
        const lcColor = typeof color === 'string' ? color.toLowerCase() : '';
        if (colorMap[lcColor]) {
            console.log(`Converting color name "${color}" to hex: ${colorMap[lcColor]}`);
            return colorMap[lcColor];
        }

        // Try to convert from string like "rgb(255, 0, 0)" to hex
        if (typeof color === 'string' && color.startsWith('rgb')) {
            try {
                const matches = color.match(/\d+/g);
                if (matches && matches.length >= 3) {
                    const r = parseInt(matches[0]);
                    const g = parseInt(matches[1]);
                    const b = parseInt(matches[2]);
                    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                    console.log(`Converting RGB color "${color}" to hex: ${hex}`);
                    return hex;
                }
            } catch (e) {
                console.warn(`Failed to parse RGB color: ${color}`, e);
            }
        }

        // If it looks like a hex color without the #, add it
        if (typeof color === 'string' && /^[0-9A-Fa-f]{6}$/.test(color)) {
            return `#${color}`;
        }

        console.log(`Using default color for unrecognized format: ${color}`);
        return "#0078D4"; // Default blue
    };

    // Helper function to normalize market area type - only return supported types
    const normalizeMarketAreaType = (type) => {
        if (!type) return null;
        
        const lcType = type.toLowerCase();

        // Map to supported types only
        if (lcType.includes('zip') || lcType.includes('zcta')) return 'zip';
        if (lcType.includes('county')) return 'county';
        if (lcType.includes('place')) return 'place';

        // Return null for unsupported types
        return null;
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
                            Select an Excel file to import market areas. Only ZIP, Place, and County market areas will be imported.
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
        // Log what's being updated for debugging
        console.log(`Updating market area ${index}:`, {
            name: updatedMarketArea.name,
            style_settings: updatedMarketArea.style_settings
        });
        
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
                            Review and confirm the market areas to be imported. Only ZIP, Place, and County types are supported.
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

function MarketAreaImportTab({ marketArea, index, onUpdate }) {
    // Create editable copy of market area with ref tracking for theme sync
    const [editableMarketArea, setEditableMarketArea] = useState({ ...marketArea });
    const [forceKey, setForceKey] = useState(0); // Force re-render key

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
    // Handle style changes with debugging and force refresh
    const handleStyleChange = (type, value) => {
        console.log(`Style change: ${type} = ${value}`);
        
        // Handle batch updates from theme selection
        if (type === "batchUpdate" || type === "completeThemeUpdate") {
            // Create a completely new market area object with spread to avoid reference issues
            const updatedMarketArea = JSON.parse(JSON.stringify({
                ...editableMarketArea,
                style_settings: {
                    ...(editableMarketArea.style_settings || {}),
                    ...(type === "completeThemeUpdate" ? value.styles : value),
                    // Ensure theme name is captured
                    themeName: type === "completeThemeUpdate" ? value.theme : (value.themeName || currentThemeName)
                }
            }));
            
            console.log("Batch updating market area with theme:", updatedMarketArea);
            
            // Force component refresh with a larger key increment for batch updates
            setForceKey(prevKey => prevKey + 100);
            
            // First update local state to ensure UI consistency
            setEditableMarketArea(updatedMarketArea);
            
            // Then notify parent component
            setTimeout(() => {
                onUpdate(index, updatedMarketArea);
            }, 0);
            
            return;
        }
        
        // For individual property updates
        const updatedMarketArea = JSON.parse(JSON.stringify(editableMarketArea)); // Deep clone
        const newStyleSettings = { ...(updatedMarketArea.style_settings || {}) };

        if (type === "noBorder") {
            newStyleSettings.noBorder = value;
            if (value) {
                newStyleSettings.borderWidth = 0;
            } else if (newStyleSettings.borderWidth === 0) {
                newStyleSettings.borderWidth = 3;
            }
        } else if (type === "noFill") {
            newStyleSettings.noFill = value;
            if (value) {
                newStyleSettings.fillOpacity = 0;
            } else if (newStyleSettings.fillOpacity === 0) {
                newStyleSettings.fillOpacity = 0.35;
            }
        } else if (type === "fillOpacity") {
            newStyleSettings.fillOpacity = Math.max(0, Math.min(1, value));
            if (newStyleSettings.fillOpacity === 0) {
                newStyleSettings.noFill = true;
            } else {
                newStyleSettings.noFill = false;
            }
        } else if (type === "borderWidth") {
            newStyleSettings.borderWidth = Math.max(0, Number(value));
            if (newStyleSettings.borderWidth === 0) {
                newStyleSettings.noBorder = true;
            } else {
                newStyleSettings.noBorder = false;
            }
        } else {
            newStyleSettings[type] = value;
        }

        updatedMarketArea.style_settings = newStyleSettings;
        
        console.log("Updated market area after style change:", updatedMarketArea);
        
        // Force component refresh with new key
        setForceKey(prevKey => prevKey + 1);
        
        // Update local state first
        setEditableMarketArea(updatedMarketArea);
        
        // Then notify parent component
        onUpdate(index, updatedMarketArea);
    };

    // In StyleSettingsPanel.jsx
    const handleThemeSelect = (newSettings) => {
        console.log('StyleSettingsPanel received new settings:', newSettings);
        
        // Force a complete UI refresh with a specific key update
        setForceKey(prevKey => prevKey + 100); // Use a larger increment to ensure a fresh key
        
        // Instead of updating each property individually, update the entire style object
        // in the parent component at once
        
        // Update the current theme name immediately
        setCurrentThemeName(newSettings.themeName || 'Custom');
        
        // Create a complete theme update to pass to parent
        const fullStyleUpdate = {
        type: 'COMPLETE_THEME_UPDATE',
        theme: newSettings.themeName || 'Custom',
        styles: {
            fillColor: newSettings.fillColor,
            fillOpacity: newSettings.fillOpacity,
            borderColor: newSettings.borderColor,
            borderWidth: newSettings.borderWidth,
            excelFill: newSettings.excelFill || '#ffffff',
            excelText: newSettings.excelText || '#000000',
            noFill: newSettings.noFill,
            noBorder: newSettings.noBorder
        }
        };
        
        // Close theme selector
        setIsThemeSelectorOpen(false);
        
        // Notify parent with full theme update
        if (typeof onStyleChange === 'function') {
        onStyleChange('completeThemeUpdate', fullStyleUpdate);
        }
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

            {/* Style Settings - adding key to force re-render */}
            <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Style Settings
                </h4>
                <StyleSettingsPanel
                    key={`style-panel-${forceKey}`}
                    styleSettings={styleSettings}
                    onStyleChange={handleStyleChange}
                    currentTheme={styleSettings.themeName || 'Default'}
                />
            </div>

            {/* Locations */}
            <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Locations
                </h4>
                {renderLocationsSummary()}
            </div>
        </div>
    );
}