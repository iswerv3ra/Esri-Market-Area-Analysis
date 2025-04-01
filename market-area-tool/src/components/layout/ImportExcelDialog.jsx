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
                // For ZIP codes, create a more robust query with state filtering
                const validZips = marketArea.locations
                    .map(loc => {
                        const zipValue = (loc.id || loc.name || "").trim();
                        if (!zipValue) return null;
                        
                        // Get state information for filtering
                        let stateFilter = "";
                        const stateValue = loc.state || "CA"; // Default to CA if no state
                        
                        // Convert to FIPS code if needed
                        let stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                        if (stateFips) {
                            stateFilter = ` AND STATE = '${stateFips}'`;
                        }
                        
                        // Format ZIP code and add state filter
                        return `(ZIP = '${zipValue.padStart(5, '0')}'${stateFilter})`;
                    })
                    .filter(Boolean); // Remove null/empty values
                
                if (validZips.length === 0) {
                    console.warn("No valid ZIP codes found for market area:", marketArea.id);
                    return [];
                }
                
                whereClause = validZips.join(" OR ");
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
    
            // Skip query if where clause is empty
            if (!whereClause) {
                console.warn(`Empty where clause for market area ${marketArea.id}`);
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
                                    if (!cleanName) return '';
                                    
                                    const stateValue = loc.state || "CA";
                                    const stateFips = STATE_MAPPINGS.getStateFips(stateValue);
                                    const stateFilter = stateFips ? ` AND STATE = '${stateFips}'` : "";
                                    
                                    return `(UPPER(NAME) LIKE UPPER('${cleanName}%')${stateFilter})`;
                                })
                                .filter(Boolean) // Remove empty clauses
                                .join(" OR "),
                                outFields: ["*"],
                                returnGeometry: true,
                                outSpatialReference: mapView.spatialReference
                            });
                            
                            // Skip if where clause is empty
                            if (!simplifiedQuery.where) {
                                console.warn("Simplified place query has empty where clause");
                                return features;
                            }
                            
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
                    
                    // Similar fallback for ZIP code queries
                    if (marketArea.ma_type === 'zip' && features.length === 0) {
                        console.log("Trying alternative approach for ZIP query...");
                        
                        try {
                            // Try with a more flexible ZIP match
                            const simplifiedQuery = new Query({
                                where: marketArea.locations.map(loc => {
                                    const zipValue = (loc.id || loc.name || "").trim();
                                    if (!zipValue) return '';
                                    
                                    // Match on ZIP prefix without state filter as last resort
                                    return `ZIP LIKE '${zipValue}%'`;
                                })
                                .filter(Boolean) // Remove empty clauses
                                .join(" OR "),
                                outFields: ["*"],
                                returnGeometry: true,
                                outSpatialReference: mapView.spatialReference
                            });
                            
                            if (!simplifiedQuery.where) {
                                console.warn("Simplified ZIP query has empty where clause");
                                return features;
                            }
                            
                            console.log("Simplified ZIP query:", simplifiedQuery.where);
                            const retryResult = await layer.queryFeatures(simplifiedQuery);
                            
                            if (retryResult && retryResult.features && retryResult.features.length > 0) {
                                features = retryResult.features;
                                console.log(`Simplified ZIP query successful! Found ${features.length} features`);
                            }
                        } catch (retryError) {
                            console.warn("Alternative ZIP query approach also failed:", retryError);
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
                // ALWAYS ensure state info exists for ALL location types
                const state = loc.state || "CA"; // Default to CA if no state
                console.log(`Normalizing location with state: ${state} for ${marketArea.ma_type}`);
    
                // Create proper spatial reference for any existing geometry
                let geometry = loc.geometry;
                if (geometry && !geometry.spatialReference) {
                    geometry = {
                        ...geometry,
                        spatialReference: { wkid: 4326 } // Add WGS84 spatial reference
                    };
                }
    
                // For ZIP codes, ensure proper formatting
                let id = loc.id || loc.name;
                let name = loc.name || loc.id;
                
                if (marketArea.ma_type === 'zip' && id) {
                    // Format ZIP code properly (ensure 5 digits for numeric values)
                    if (/^\d+$/.test(id)) {
                        id = id.padStart(5, '0');
                        name = id; // Sync name with formatted ID
                    }
                }
    
                return {
                    id: id,
                    name: name,
                    state: state, // Always include state
                    geometry: geometry
                };
            });
        }
    
        // Log the normalized locations for debugging
        console.log(`Normalized ${normalizedData.locations.length} locations for ${marketArea.name}:`, 
            normalizedData.locations.map(loc => `${loc.name || loc.id} (${loc.state})`));
        
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

    const findMatchingFeature = (location, features, maType) => {
        if (!location || !features || features.length === 0) return null;
    
        // Different matching logic based on market area type
        if (maType === 'zip') {
            return features.find(feature => {
                const featureZip = String(feature.attributes.ZIP || '').trim();
                const locationId = String(location.id || location.name || '').trim();
                return featureZip === locationId;
            });
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
        const SUPPORTED_IMPORT_TYPES = ['zip', 'place', 'county']; // Define explicitly for import

        console.log("Processing template format data with support for only ZIP, Place, and County types");

        // Define exact row indices based on Excel structure (0-based)
        const MARKET_AREA_NAME_ROW = 4;  // Excel Row 5
        const SHORT_NAME_ROW = 6;        // Excel Row 7
        // const TEXT_COLOR_ROW = 8;     // Excel Row 9 - Not typically used for MA style
        const DEFINITION_TYPE_ROW = 10;  // Excel Row 11
        const STATE_ROW = 12;            // Excel Row 13
        const COUNTY_ROW = 14;           // Excel Row 15
        const FILL_COLOR_ROW = 23;       // Excel Row 24
        const TRANSPARENCY_ROW = 24;     // Excel Row 25
        const BORDER_COLOR_ROW = 26;     // Excel Row 27
        const BORDER_WEIGHT_ROW = 27;    // Excel Row 28
        const DEFINITION_START_ROW = 29; // Excel Row 30 (first definition value)

        // Validate that we have enough data rows
        if (data.length < DEFINITION_START_ROW) {
            console.warn("Excel file doesn't have enough rows for template format");
            return [];
        }

        // Enhanced helper function to get cell background color from workbook
        const getCellBackgroundColor = (row, col) => {
            if (!workbook) return null;
            try {
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const colLetter = XLSX.utils.encode_col(col);
                const rowNumber = row + 1;
                const cellAddress = `${colLetter}${rowNumber}`;
                if (!sheet[cellAddress]) { return null; }
                if (sheet[cellAddress].s && sheet[cellAddress].s.fill) {
                    const fill = sheet[cellAddress].s.fill;
                    if (fill.fgColor && fill.fgColor.rgb && fill.fgColor.rgb !== '00000000' && fill.fgColor.rgb !== 'FFFFFFFF') { // Ignore black/white default fills sometimes present
                        return `#${fill.fgColor.rgb.substring(fill.fgColor.rgb.length - 6)}`;
                    }
                    if (fill.bgColor && fill.bgColor.rgb && fill.bgColor.rgb !== '00000000' && fill.bgColor.rgb !== 'FFFFFFFF') {
                        return `#${fill.bgColor.rgb.substring(fill.bgColor.rgb.length - 6)}`;
                    }
                }
                return null; // No specific background color found
            } catch (error) {
                console.warn(`Error getting cell background color at ${row + 1}, ${col}:`, error);
                return null;
            }
        };

        // Find all market area columns
        const marketAreaColumns = [];
        const maxCol = data.reduce((max, row) => Math.max(max, row ? row.length : 0), 0); // Find max columns across all rows

        // Check headers in specific rows to find columns
        const nameRowData = data[MARKET_AREA_NAME_ROW] || [];
        const typeRowData = data[DEFINITION_TYPE_ROW] || [];

        for (let col = 3; col < maxCol; col += 2) { // Start from Col D, step by 2
            const marketAreaName = String(nameRowData[col] || "").trim();
            const definitionType = String(typeRowData[col] || "").trim();

            if (marketAreaName && definitionType) {
                const maType = mapDefinitionTypeToMAType(definitionType); // Returns null if unsupported

                // --- Filter for Supported Import Types ---
                if (maType && SUPPORTED_IMPORT_TYPES.includes(maType)) {
                    console.log(`Found supported market area for import in column ${col + 1} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType})`);
                    marketAreaColumns.push(col);
                } else {
                    console.log(`Skipping unsupported market area in column ${col + 1} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType || 'unsupported'})`);
                }
                // --- End Filter ---
            }
        }

        console.log(`Found ${marketAreaColumns.length} supported market areas in template columns: ${marketAreaColumns.map(col => String.fromCharCode(65 + col)).join(', ')}`);

        if (marketAreaColumns.length === 0) {
            console.warn("No supported market areas found in the template columns.");
            return [];
        }

        // Process each market area column
        const marketAreas = [];
        for (const col of marketAreaColumns) {
            const marketAreaName = String(nameRowData[col] || "").trim();
            const definitionType = String(typeRowData[col] || "").trim();
            const maType = mapDefinitionTypeToMAType(definitionType); // Already verified as supported

            console.log(`Processing market area in column ${col + 1} (${String.fromCharCode(65 + col)}): ${marketAreaName} (${definitionType} -> ${maType})`);

            const shortName = (data[SHORT_NAME_ROW] ? String(data[SHORT_NAME_ROW][col] || "").trim() : "") || marketAreaName.substring(0, 20);
            const state = (data[STATE_ROW] ? String(data[STATE_ROW][col] || "").trim() : "") || "CA"; // Default state if empty
            // County field might be relevant for filtering later, but not directly used for location definition here
            // const county = data[COUNTY_ROW] ? String(data[COUNTY_ROW][col] || "").trim() : "";

            // --- Style Extraction Logic (Same as processStandardData, adapted for template rows) ---
            const styleSettings = {
                fillColor: "#0078D4", fillOpacity: 0.35, borderColor: "#0078D4",
                borderWidth: 2, noFill: false, noBorder: false, themeName: "Default",
                excelFill: "#ffffff", excelText: "#000000"
            };

            // Fill Color
            const fillCellBackgroundColor = getCellBackgroundColor(FILL_COLOR_ROW, col);
            const fillTextValue = (data[FILL_COLOR_ROW] && data[FILL_COLOR_ROW][col] != null) ? String(data[FILL_COLOR_ROW][col]).trim() : "";
             if (fillTextValue.toLowerCase() === "no fill") {
                styleSettings.noFill = true; styleSettings.fillOpacity = 0;
            } else if (fillCellBackgroundColor) {
                styleSettings.fillColor = fillCellBackgroundColor;
            } else if (fillTextValue && fillTextValue.toLowerCase() !== "text color") {
                styleSettings.fillColor = ensureHexColor(fillTextValue);
            }

            // Transparency/Opacity (only if not 'noFill')
            const transparencyValue = (data[TRANSPARENCY_ROW] && data[TRANSPARENCY_ROW][col] != null) ? String(data[TRANSPARENCY_ROW][col]).trim() : "";
            if (!styleSettings.noFill && transparencyValue) {
                if (transparencyValue.toLowerCase() === "no fill") {
                    styleSettings.noFill = true; styleSettings.fillOpacity = 0;
                } else if (transparencyValue.endsWith("%")) {
                    const transparencyPercent = parseInt(transparencyValue);
                    if (!isNaN(transparencyPercent)) { styleSettings.fillOpacity = Math.max(0, Math.min(1, (100 - transparencyPercent) / 100)); }
                } else {
                    let opacity = Number(transparencyValue);
                    if (!isNaN(opacity)) {
                        if (opacity > 1 && opacity <= 100) { opacity = (100 - opacity) / 100; }
                        styleSettings.fillOpacity = Math.max(0, Math.min(1, opacity));
                    }
                }
                if (styleSettings.fillOpacity === 0) { styleSettings.noFill = true; }
            }

            // Border Color
            const borderCellBackgroundColor = getCellBackgroundColor(BORDER_COLOR_ROW, col);
            const borderTextValue = (data[BORDER_COLOR_ROW] && data[BORDER_COLOR_ROW][col] != null) ? String(data[BORDER_COLOR_ROW][col]).trim() : "";
             if (borderTextValue.toLowerCase() === "no border") {
                styleSettings.noBorder = true; styleSettings.borderWidth = 0;
            } else if (borderCellBackgroundColor) {
                styleSettings.borderColor = borderCellBackgroundColor;
            } else if (borderTextValue && borderTextValue.toLowerCase() !== "text color") {
                styleSettings.borderColor = ensureHexColor(borderTextValue);
            }

            // Border Width (only if not 'noBorder')
            const borderWidthValue = (data[BORDER_WEIGHT_ROW] && data[BORDER_WEIGHT_ROW][col] != null) ? String(data[BORDER_WEIGHT_ROW][col]).trim() : "";
            if (!styleSettings.noBorder && borderWidthValue) {
                 if (borderWidthValue.toLowerCase() === "no border") {
                    styleSettings.noBorder = true; styleSettings.borderWidth = 0;
                } else if (!isNaN(parseFloat(borderWidthValue))) {
                    styleSettings.borderWidth = Math.max(0, Number(borderWidthValue));
                }
                 if (styleSettings.borderWidth === 0) { styleSettings.noBorder = true; }
            }
            // --- End Style Extraction ---


            // Extract Definition Values
            const definitionValues = [];
            for (let i = DEFINITION_START_ROW; i < data.length; i++) {
                if (!data[i] || data[i][col] == null) continue; // Check for null/undefined
                const rawValue = data[i][col];
                const value = String(rawValue).trim();

                if (value && !value.startsWith("*")) { // Simple check to exclude helper text
                    // Split potentially delimited values within a single cell
                    const potentialValues = value.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
                    for (const pv of potentialValues) {
                        // Add basic type validation if needed (e.g., ensure ZIPs look like ZIPs)
                        if (maType === 'zip' && !/^\d{5}(-\d{4})?$/.test(pv)) {
                            console.warn(`Skipping invalid ZIP format "${pv}" in column ${col + 1}, row ${i + 1}`);
                            continue;
                        }
                        if ((maType === 'county' || maType === 'place') && /^\d+$/.test(pv)) {
                            console.warn(`Skipping numeric-only value "${pv}" for ${maType} in column ${col + 1}, row ${i + 1}`);
                            continue;
                        }
                         if (!definitionValues.includes(pv)) { // Avoid duplicates
                            definitionValues.push(pv);
                        }
                    }
                }
            }

            console.log(`Found ${definitionValues.length} definition values for ${marketAreaName}: ${definitionValues.slice(0, 10).join(', ')}${definitionValues.length > 10 ? '...' : ''}`);

            // Skip if no valid definition values found
            if (definitionValues.length === 0) {
                console.warn(`No valid definition values found for market area ${marketAreaName} in column ${col + 1}, skipping.`);
                continue;
            }

            // Create the market area object
            const marketArea = {
                name: marketAreaName,
                short_name: shortName,
                ma_type: maType,
                description: `Imported from ${fileName} (template)`,
                style_settings: styleSettings,
                project: effectiveProjectId,
                project_id: effectiveProjectId,
                locations: definitionValues.map(val => ({
                    id: val, // Use the value itself as ID for zip/county/place name
                    name: val, // Use the value as name
                    state: state // Assign the state read from the template header
                }))
            };

            console.log(`Processed column ${col + 1} into market area:`, { name: marketArea.name, type: marketArea.ma_type, locCount: marketArea.locations.length, style: marketArea.style_settings });
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
        const SUPPORTED_IMPORT_TYPES = ['zip', 'place', 'county']; // Define explicitly for import

        // Check if we have data with at least 2 rows (headers + data)
        if (!data || data.length < 2) {
            throw new Error("Invalid data format: The Excel file must have headers and at least one row of data");
        }

        console.log("Processing standard format data:", data);
        const headers = data[0].map(h => String(h || '').trim().toLowerCase()); // Normalize headers

        // Helper function to get cell background color from workbook
        const getCellBackgroundColor = (row, col) => {
            if (!workbook) return null;
            try {
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const colLetter = XLSX.utils.encode_col(col);
                const rowNumber = row + 1; // Data starts at row 1 in sheet (Excel row 2)
                const cellAddress = `${colLetter}${rowNumber}`;
                if (sheet[cellAddress] && sheet[cellAddress].s && sheet[cellAddress].s.fill) {
                    const fill = sheet[cellAddress].s.fill;
                    if (fill.fgColor && fill.fgColor.rgb) { return `#${fill.fgColor.rgb.substring(fill.fgColor.rgb.length - 6)}`; }
                    if (fill.bgColor && fill.bgColor.rgb) { return `#${fill.bgColor.rgb.substring(fill.bgColor.rgb.length - 6)}`; }
                } return null;
            } catch (error) { console.warn("Error getting cell background color:", error); return null; }
        };

        // Find key columns and their indices (case-insensitive)
        const findIndex = (possibleHeaders) => headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));

        const nameIndex = findIndex(['name']);
        const typeIndex = findIndex(['type', 'ma_type']);
        const fillColorIndex = findIndex(['fill color', 'fillcolor']);
        const borderColorIndex = findIndex(['border color', 'bordercolor', 'outline color']);
        const borderWidthIndex = findIndex(['border width', 'borderwidth', 'outline width']);
        const fillOpacityIndex = findIndex(['opacity', 'transparency']);
        const locationsIndex = findIndex(['locations', 'areas', 'definition', 'values']);
        const stateIndex = findIndex(['state', 'st']); // Look for 'st' as well

        // Ensure we have the minimum required fields
        if (nameIndex === -1 || typeIndex === -1) {
            console.error("Headers found:", headers);
            throw new Error("Required columns missing: The Excel file must include 'Name' and 'Type' columns (case-insensitive).");
        }

        const marketAreas = [];

        // Process each row (skip header row 0)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows or rows missing required data
            if (!row || !row.length || !row[nameIndex] || !row[typeIndex]) {
                 console.log(`Skipping empty or incomplete row ${i + 1}`);
                 continue;
            }

            console.log(`Processing Excel row ${i + 1}:`, row);

            // Extract state information if available, default to CA
            const state = (stateIndex !== -1 && row[stateIndex]) ? String(row[stateIndex]).trim() : "CA";

            // Determine the market area type and normalize it
            const maTypeRaw = String(row[typeIndex]);
            const maType = normalizeMarketAreaType(maTypeRaw); // Returns null for unsupported

            // --- Explicitly skip unsupported types for IMPORT ---
            if (!maType || !SUPPORTED_IMPORT_TYPES.includes(maType)) {
                console.log(`Skipping row ${i + 1}: Unsupported or invalid market area type "${maTypeRaw}" (Normalized: ${maType}) for import.`);
                continue;
            }
            // --- End explicit check ---

            // Extract locations data if available
            let locations = [];
            if (locationsIndex !== -1 && row[locationsIndex] != null) { // Check for null/undefined explicitly
                try {
                    const locationData = row[locationsIndex];
                    let parsedLocations = [];

                    if (typeof locationData === 'string') {
                        if (locationData.trim().startsWith('[')) { // Crude check for JSON array
                           try { parsedLocations = JSON.parse(locationData); } catch { /* ignore parse error */ }
                        }
                        if (parsedLocations.length === 0) { // If not JSON or parse failed, treat as delimited
                           parsedLocations = locationData.split(/[,;\n]+/).map(loc => loc.trim()).filter(Boolean);
                        }
                    } else if (Array.isArray(locationData)) {
                        parsedLocations = locationData;
                    } else if (typeof locationData === 'number') { // Handle single number case
                        parsedLocations = [String(locationData)];
                    }

                    // Convert parsed data into standard {id, name, state} format
                    locations = parsedLocations.map(loc => {
                        if (typeof loc === 'object' && loc !== null && (loc.id || loc.name)) {
                             // Assume it's already in {id, name} format, add state
                            return { id: String(loc.id || loc.name), name: String(loc.name || loc.id), state: loc.state || state };
                        } else {
                            // Assume it's a simple value (string/number)
                            const valStr = String(loc).trim();
                            return { id: valStr, name: valStr, state: state };
                        }
                    }).filter(loc => loc.id); // Ensure ID exists

                } catch (error) {
                    console.warn(`Failed to parse locations for row ${i + 1}:`, error);
                }
            }
             // If locations array is still empty after parsing or no column found,
             // create a single location based on the market area name and type.
             if (locations.length === 0 && SUPPORTED_IMPORT_TYPES.includes(maType)) {
                 const nameVal = String(row[nameIndex]);
                 locations = [{ id: nameVal, name: nameVal, state: state }];
                 console.log(`No locations found or parsed for row ${i+1}, using market area name "${nameVal}" as the single location.`);
             }


            // Create style settings object with defaults
            const styleSettings = {
                fillColor: "#0078D4", fillOpacity: 0.35, borderColor: "#0078D4",
                borderWidth: 2, noFill: false, noBorder: false, themeName: "Default", // Added themeName default
                excelFill: "#ffffff", excelText: "#000000" // Added Excel defaults
            };

            // Extract styles (Fill Color)
            if (fillColorIndex !== -1) {
                const cellBgColor = getCellBackgroundColor(i, fillColorIndex);
                const textValue = row[fillColorIndex] != null ? String(row[fillColorIndex]).trim() : ""; // Use != null check
                if (textValue.toLowerCase() === "no fill") {
                    styleSettings.noFill = true; styleSettings.fillOpacity = 0;
                } else if (cellBgColor) {
                    styleSettings.fillColor = cellBgColor;
                } else if (textValue && textValue.toLowerCase() !== "text color") {
                    styleSettings.fillColor = ensureHexColor(textValue);
                }
            }

            // Extract styles (Border Color)
            if (borderColorIndex !== -1) {
                const cellBgColor = getCellBackgroundColor(i, borderColorIndex);
                const textValue = row[borderColorIndex] != null ? String(row[borderColorIndex]).trim() : "";
                if (textValue.toLowerCase() === "no border") {
                    styleSettings.noBorder = true; styleSettings.borderWidth = 0;
                } else if (cellBgColor) {
                    styleSettings.borderColor = cellBgColor;
                } else if (textValue && textValue.toLowerCase() !== "text color") {
                    styleSettings.borderColor = ensureHexColor(textValue);
                }
            }

            // Extract styles (Opacity/Transparency) - handle only if not already 'noFill'
            if (fillOpacityIndex !== -1 && row[fillOpacityIndex] != null && !styleSettings.noFill) {
                const transparencyValue = String(row[fillOpacityIndex]).trim();
                if (transparencyValue.toLowerCase() === "no fill") {
                     styleSettings.noFill = true; styleSettings.fillOpacity = 0;
                } else if (transparencyValue.endsWith("%")) {
                    const transparencyPercent = parseInt(transparencyValue);
                    if (!isNaN(transparencyPercent)) { styleSettings.fillOpacity = Math.max(0, Math.min(1, (100 - transparencyPercent) / 100)); }
                } else {
                    let opacity = Number(transparencyValue);
                    if (!isNaN(opacity)) {
                        if (opacity > 1 && opacity <= 100) { opacity = (100 - opacity) / 100; } // Assume % transparency if > 1
                        styleSettings.fillOpacity = Math.max(0, Math.min(1, opacity));
                    }
                }
                if (styleSettings.fillOpacity === 0) { styleSettings.noFill = true; } // Sync noFill if opacity becomes 0
            }

             // Extract styles (Border Width) - handle only if not already 'noBorder'
            if (borderWidthIndex !== -1 && row[borderWidthIndex] != null && !styleSettings.noBorder) {
                const borderWidthValue = String(row[borderWidthIndex]).trim();
                 if (borderWidthValue.toLowerCase() === "no border") {
                    styleSettings.noBorder = true; styleSettings.borderWidth = 0;
                } else if (!isNaN(parseFloat(borderWidthValue))) {
                    styleSettings.borderWidth = Math.max(0, Number(borderWidthValue));
                }
                if (styleSettings.borderWidth === 0) { styleSettings.noBorder = true; } // Sync noBorder if width becomes 0
            }

            // Create final market area object
            const marketAreaName = String(row[nameIndex]);
            const marketArea = {
                name: marketAreaName,
                short_name: marketAreaName.substring(0, 20), // Simple truncation for short name
                ma_type: maType,
                description: `Imported from ${fileName}`,
                style_settings: styleSettings,
                project: effectiveProjectId,
                project_id: effectiveProjectId,
                locations: locations // Assign processed locations
            };

            console.log(`Processed row ${i+1} into market area:`, { name: marketArea.name, type: marketArea.ma_type, locCount: marketArea.locations.length, style: marketArea.style_settings });
            marketAreas.push(marketArea);
        }

         console.log(`Finished processing standard data. Found ${marketAreas.length} supported market areas.`);
        return marketAreas;
    };

    // Helper function to ensure color is in hex format with enhanced color name support
    const ensureHexColor = (color) => {
        if (!color)  return "#0078D4"; // Default blue

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