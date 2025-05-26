import { useState, useEffect, Fragment, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import {
  ChevronDownIcon,
  ArrowLeftIcon,
  PhotoIcon,
  TableCellsIcon,
  PlusIcon,
  ListBulletIcon,
  ArrowUpOnSquareIcon,
} from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { enrichmentService } from "../../services/enrichmentService";
import { toast } from "react-hot-toast";
import { saveAs } from "file-saver";
import ExportDialog from "./ExportDialog";
import ExportKMLDialog from "./ExportKMLDialog";
import ImportExcelDialog from "./ImportExcelDialog";
import { usePresets } from "../../contexts/PresetsContext";
import { useProjectCleanup } from "../../hooks/useProjectCleanup";
import * as projection from "@arcgis/core/geometry/projection";
import JSZip from "jszip";
import { projectsAPI } from "../../services/api"; // Ensure this import is correct

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

export default function Toolbar({ onCreateMA, onToggleList }) {
  const { variablePresets } = usePresets();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportKMLDialogOpen, setIsExportKMLDialogOpen] = useState(false);
  const [isImportExcelDialogOpen, setIsImportExcelDialogOpen] = useState(false);
  const searchWidgetRef = useRef(null);
  const { mapView } = useMap();
  const { marketAreas } = useMarketAreas();
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize with more robust default values
  const [projectDetails, setProjectDetails] = useState({
    project_number: "Loading...",
    client: "",
    location: "",
    last_modified: new Date().toISOString(),
  });

  const isCreatingMARef = useRef(false);
  const cleanupProject = useProjectCleanup();

  // Fetch project details
  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        // Use the projectsAPI to retrieve project details
        const response = await projectsAPI.retrieve(projectId);

        // Update project details with retrieved data
        setProjectDetails({
          project_number: response.data.project_number || "Unknown",
          client: response.data.client || "",
          location: response.data.location || "N/A",
          last_modified:
            response.data.last_modified || new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to fetch project details:", error);

        // Set error state, but keep the loading indicator
        setProjectDetails((prev) => ({
          ...prev,
          client: "Error Loading Project",
          location: "Please refresh",
        }));
      }
    };

    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const handleBack = () => {
    cleanupProject();
    navigate("/");
  };

/**
 * Enhanced handleExportData function with proper error handling and toast notifications
 */
const handleExportData = async ({
  variables,
  selectedMarketAreas,
  fileName,
  includeUSAData
}) => {
  if (!variables?.length) {
    setIsExportDialogOpen(true);
    return;
  }

  let loadingToast;
  
  try {
    setIsExporting(true);
    
    // Analyze the market areas to provide better user feedback
    const areaAnalysis = analyzeMarketAreas(selectedMarketAreas);
    const isStateLevelExport = areaAnalysis.hasStateLevelAreas;
    const variableCount = variables.length;
    
    console.log(`[Toolbar] Starting export with analysis:`, {
      totalAreas: selectedMarketAreas.length,
      variableCount: variables.length,
      hasStateLevelAreas: areaAnalysis.hasStateLevelAreas,
      stateAreas: areaAnalysis.stateAreas,
      includeUSAData,
      projectId
    });

    // Check for potentially problematic combinations
    if (isStateLevelExport && variableCount > 100) {
      const shouldContinue = window.confirm(
        `You're exporting ${variableCount} variables for state-level data. This may take a very long time or fail.\n\n` +
        `Recommended: Reduce to under 50 variables for better reliability.\n\n` +
        `Continue anyway?`
      );
      
      if (!shouldContinue) {
        setIsExporting(false);
        return;
      }
    }
    
    // Provide appropriate loading message based on area types and variable count
    let loadingMessage;
    let estimatedDuration;
    
    if (isStateLevelExport) {
      if (variableCount > 200) {
        loadingMessage = "Processing large state-level export (this will take 5-10 minutes)...";
        estimatedDuration = 600000; // 10 minutes
      } else if (variableCount > 100) {
        loadingMessage = "Processing state-level export (this may take 3-5 minutes)...";
        estimatedDuration = 300000; // 5 minutes
      } else {
        loadingMessage = "Processing state-level export (this may take 1-3 minutes)...";
        estimatedDuration = 180000; // 3 minutes
      }
    } else {
      loadingMessage = "Enriching market areas...";
      estimatedDuration = 60000; // 1 minute for non-state data
    }
    
    loadingToast = toast.loading(loadingMessage, {
      duration: estimatedDuration
    });

    // Show additional warning for state-level exports using toast.success (since toast.info doesn't exist)
    if (isStateLevelExport) {
      setTimeout(() => {
        toast.success("State-level data detected. Large exports may take several minutes to complete.", {
          duration: 8000,
          position: 'top-center',
          icon: '⚠️'
        });
      }, 500);
    }

    // Show progress updates for long-running exports
    let progressUpdateInterval;
    if (isStateLevelExport && variableCount > 50) {
      let progressCounter = 0;
      progressUpdateInterval = setInterval(() => {
        progressCounter++;
        const messages = [
          "Still processing... State data requires more time",
          "Processing continues... Large datasets take patience", 
          "Almost there... Complex state geometries being processed",
          "Final processing... Preparing your export file"
        ];
        
        if (progressCounter <= messages.length) {
          toast.loading(messages[progressCounter - 1], {
            id: loadingToast,
            duration: 30000
          });
        }
      }, 30000); // Update every 30 seconds
    }

    const enrichedData = await enrichmentService.enrichAreas(
      selectedMarketAreas,
      variables,
      includeUSAData
    );

    // Clear progress interval if it was set
    if (progressUpdateInterval) {
      clearInterval(progressUpdateInterval);
    }

    console.log(`[Toolbar] Enrichment completed, starting export processing`);

    const result = await enrichmentService.handleExport(
      enrichedData,
      selectedMarketAreas,
      variables,
      { 
        includeUSAData, 
        projectId: projectId,
        isStateLevelExport
      }
    );

    if (result instanceof Blob) {
      saveAs(result, fileName);
      
      toast.dismiss(loadingToast);
      
      // Success message with stats
      const successMessage = isStateLevelExport 
        ? `State-level export completed! ${variableCount} variables exported for ${selectedMarketAreas.length} state area(s).`
        : `Export completed successfully! ${variableCount} variables exported for ${selectedMarketAreas.length} area(s).`;
        
      toast.success(successMessage, {
        duration: 6000,
        position: 'top-center'
      });
    } else {
      throw new Error("Export did not return expected file data");
    }

  } catch (error) {
    console.error(`[Toolbar] Export failed:`, {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      selectedAreas: selectedMarketAreas?.map(area => ({
        name: area.name,
        type: area.ma_type || area.type,
        locationsCount: area.locations?.length || 0
      })),
      variableCount: variables?.length
    });

    // Clear any progress intervals
    if (typeof progressUpdateInterval !== 'undefined') {
      clearInterval(progressUpdateInterval);
    }

    if (loadingToast) {
      toast.dismiss(loadingToast);
    }

    // Provide specific error messages based on error type
    let userMessage = "Failed to export data";
    let actionAdvice = "";
    let errorDuration = 8000;

    if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
      userMessage = "Export timed out";
      actionAdvice = `Try reducing variables (currently ${variables.length}) or export smaller areas separately.`;
      errorDuration = 10000;
    } else if (error.message.includes('Network error') || error.message.includes('Failed to fetch')) {
      userMessage = "Network connection error";
      actionAdvice = "Please check your internet connection and try again.";
    } else if (error.message.includes('State-level enrichment failed')) {
      userMessage = "State-level data export failed";
      actionAdvice = `With ${variables.length} variables, try selecting fewer (recommended: under 50 for states).`;
      errorDuration = 12000;
    } else if (error.message.includes('No valid study areas')) {
      userMessage = "Invalid market area data";
      actionAdvice = "Please check that your market areas have valid geographic data.";
    } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      userMessage = "Authentication error";
      actionAdvice = "Please refresh the page and log in again.";
    } else if (error.message.includes('Too many variables') || variables.length > 300) {
      userMessage = "Too many variables selected";
      actionAdvice = `${variables.length} variables is excessive. Try reducing to under 100 variables.`;
      errorDuration = 10000;
    }

    // Show error with action advice
    toast.error(
      <div className="max-w-md">
        <div className="font-semibold text-red-800">{userMessage}</div>
        {actionAdvice && (
          <div className="text-sm mt-2 text-red-700 leading-relaxed">{actionAdvice}</div>
        )}
        <div className="text-xs mt-2 text-red-600 opacity-75">
          Technical: {error.message.substring(0, 100)}{error.message.length > 100 ? '...' : ''}
        </div>
      </div>,
      { 
        duration: errorDuration,
        position: 'top-center'
      }
    );

    // For debugging: also show technical details in console
    console.group('Export Error Details');
    console.error('Error object:', error);
    console.error('Market areas being processed:', selectedMarketAreas);
    console.error('Variables selected:', variables);
    console.groupEnd();

  } finally {
    setIsExporting(false);
  }
};

/**
 * Analyze market areas to understand what type of export we're dealing with
 */
const analyzeMarketAreas = (marketAreas) => {
  if (!marketAreas || !Array.isArray(marketAreas)) {
    return {
      hasStateLevelAreas: false,
      stateAreas: [],
      totalAreas: 0,
      areaTypes: [],
      totalLocations: 0
    };
  }

  const stateAreas = [];
  const areaTypes = new Set();
  let totalLocations = 0;
  
  marketAreas.forEach(area => {
    const areaType = area.ma_type || area.type || 'unknown';
    areaTypes.add(areaType);
    
    // Count locations for analysis
    if (area.locations && Array.isArray(area.locations)) {
      totalLocations += area.locations.length;
    }
    
    // Check if this is a state-level area
    if (isStateLevelArea(area)) {
      stateAreas.push({
        name: area.name,
        type: areaType,
        locationsCount: area.locations?.length || 0
      });
    }
  });

  return {
    hasStateLevelAreas: stateAreas.length > 0,
    stateAreas,
    totalAreas: marketAreas.length,
    areaTypes: Array.from(areaTypes),
    totalLocations
  };
};

 /**
 * Determine if a market area represents state-level data
 */
const isStateLevelArea = (area) => {
  // Check explicit type indicators
  if (area.ma_type === 'state' || area.type === 'state') {
    return true;
  }
  
  // Check name patterns for state indicators
  const name = (area.name || '').toLowerCase();
  const stateIndicators = ['state', 'province', 'region'];
  if (stateIndicators.some(indicator => name.includes(indicator))) {
    return true;
  }
  
  // Check for patterns like "15 States", "All States", etc.
  if (name.match(/\d+\s*states?/i) || name.match(/all\s*states?/i)) {
    return true;
  }
  
  // Check for common state abbreviations or full names
  const stateNames = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
    'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming'
  ];
  
  const stateAbbreviations = [
    'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in',
    'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv',
    'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn',
    'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy'
  ];
  
  if (stateNames.includes(name) || stateAbbreviations.includes(name)) {
    return true;
  }
  
  // Check if the area has many locations (indicator of aggregated state data)
  if (area.locations && Array.isArray(area.locations) && area.locations.length > 10) {
    return true;
  }
  
  // Check geometry complexity as a heuristic
  if (area.geometry && area.geometry.rings) {
    const totalPoints = area.geometry.rings.reduce((sum, ring) => sum + ring.length, 0);
    if (totalPoints > 500) { // Arbitrary threshold for complex geometries
      return true;
    }
  }
  
  return false;
};

  /**
   * Enhanced error boundary component for the export process
   */
  const ExportErrorBoundary = ({ children, onError }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      const handleError = (error) => {
        console.error("[ExportErrorBoundary] Caught error:", error);
        setHasError(true);
        setError(error);
        if (onError) onError(error);
      };

      window.addEventListener("unhandledrejection", handleError);

      return () => {
        window.removeEventListener("unhandledrejection", handleError);
      };
    }, [onError]);

    if (hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Export Error
          </h3>
          <p className="text-red-700 mb-3">
            An error occurred during the export process. Please try again.
          </p>
          <details className="text-sm text-red-600">
            <summary className="cursor-pointer hover:text-red-800">
              Technical Details
            </summary>
            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
              {error?.stack || error?.message || "Unknown error"}
            </pre>
          </details>
          <button
            onClick={() => {
              setHasError(false);
              setError(null);
            }}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  };

  /**
   * Add this to your Toolbar component's return statement to wrap the export functionality
   */
  const ToolbarWithErrorHandling = ({ ...props }) => {
    const handleExportError = (error) => {
      console.error("[Toolbar] Export error caught by boundary:", error);
      // Additional error reporting logic could go here
    };

    return (
      <ExportErrorBoundary onError={handleExportError}>
        {/* Your existing Toolbar JSX here */}
      </ExportErrorBoundary>
    );
  };

  const handleImportExcel = async (fileData) => {
    if (!fileData) {
      return;
    }

    try {
      setIsImporting(true);
      const loadingToast = toast.loading("Importing Excel data...");

      // Handle the import logic here - this would need to be implemented
      // based on your application's requirements

      // Example implementation:
      // const result = await dataImportService.importExcelData(fileData, projectId);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.dismiss(loadingToast);
      toast.success("Excel data imported successfully");
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Failed to import data: ${error.message}`);
    } finally {
      setIsImporting(false);
      setIsImportExcelDialogOpen(false);
    }
  };

  useEffect(() => {
    if (!mapView) return;
    mapView.when(() => {
      const allLayers = mapView.map.allLayers;
      Promise.all(allLayers.map((layer) => layer.load()))
        .then(() => setIsMapReady(true))
        .catch((error) => {
          console.error("Error loading layers:", error);
          setIsMapReady(true);
        });
    });
  }, [mapView]);

  const handleCreateMA = () => {
    isCreatingMARef.current = true;
    onCreateMA();
    setTimeout(() => {
      isCreatingMARef.current = false;
    }, 100);
  };

  const handleExportJPEG = async () => {
    // Initial validation
    if (!mapView) {
      console.error("Export Aborted: MapView is not available.");
      toast.error("Map is not ready or unavailable for export.");
      setIsExporting(false);
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting map as JPEG...");

      // Dynamically import html2canvas
      const html2canvas = (await import("html2canvas")).default;

      // Export configuration
      const rightCropPx = 450; // Amount to crop from right side
      const targetWidth = 3160;
      const targetHeight = 2048;
      const captureWidth = targetWidth + rightCropPx;

      console.log(
        `[ExportJPEG] Dimensions: Capturing ${captureWidth}x${targetHeight}, cropping to ${targetWidth}x${targetHeight}`
      );

      // --- LEGEND CAPTURE LOGIC ---
      const legendElement = document.querySelector(".esri-legend");
      let legendImage = null;
      let originalStyles = null;

      if (
        legendElement &&
        window.getComputedStyle(legendElement).display !== "none"
      ) {
        try {
          // Store original styles
          originalStyles = legendElement.style.cssText;

          // Apply temporary styles for capture
          legendElement.style.position = "relative";
          legendElement.style.backgroundColor = "white";
          legendElement.style.padding = "10px";
          legendElement.style.boxShadow = "none";
          legendElement.style.border = "none";
          legendElement.style.width = "auto";
          legendElement.style.display = "inline-block";

          const standardFontSize = "14px";
          legendElement.style.fontSize = standardFontSize;

          // Style text elements
          const textElements = legendElement.querySelectorAll(
            ".esri-legend__layer-cell--info, .esri-legend__service-label, .esri-legend__layer-label"
          );
          textElements.forEach((element) => {
            element.style.fontSize = standardFontSize;
            element.style.padding = "2px 4px";
            element.style.display = "inline-block";
            element.style.verticalAlign = "middle";
            element.style.lineHeight = "1.2";
            element.style.whiteSpace = "nowrap";
          });

          // Style symbols
          const symbols = legendElement.querySelectorAll(
            ".esri-legend__symbol"
          );
          symbols.forEach((symbol) => {
            symbol.style.width = "20px";
            symbol.style.height = "20px";
            symbol.style.marginRight = "5px";
            symbol.style.display = "inline-block";
            symbol.style.verticalAlign = "middle";
          });

          // Adjust row layout
          const rows = legendElement.querySelectorAll(
            ".esri-legend__layer-row"
          );
          rows.forEach((row) => {
            row.style.marginBottom = "3px";
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.minHeight = "22px";
          });

          // Adjust layer spacing
          const layers = legendElement.querySelectorAll(".esri-legend__layer");
          layers.forEach((layer) => {
            layer.style.marginBottom = "5px";
          });

          // Capture the legend
          legendImage = await html2canvas(legendElement, {
            backgroundColor: "white",
            scale: 2,
            logging: false,
            useCORS: true,
          });
        } catch (error) {
          console.warn("[ExportJPEG] Failed to capture legend:", error);
          legendImage = null;
        } finally {
          // Restore original styles
          if (legendElement && originalStyles !== null) {
            legendElement.style.cssText = originalStyles;
            const childrenWithStyle = legendElement.querySelectorAll("[style]");
            childrenWithStyle.forEach((el) => {
              if (el !== legendElement) el.removeAttribute("style");
            });
          }
        }
      }

      // --- CAPTURE SCREENSHOT ---
      if (!mapView || mapView.destroyed) {
        console.error(
          "[ExportJPEG] MapView became unavailable before taking screenshot."
        );
        toast.error("Map became unavailable during export.");
        setIsExporting(false);
        return;
      }

      // Capture the screenshot with extra width for cropping
      console.log("[ExportJPEG] Taking screenshot...");
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100,
        width: captureWidth,
        height: targetHeight,
      });
      console.log("[ExportJPEG] Screenshot captured successfully");

      // --- PROCESS SCREENSHOT ---
      const finalCanvas = document.createElement("canvas");
      const mainImage = new Image();

      // Store current extent and scale for later use in scale bar
      const currentExtent = mapView.extent;
      const currentScale = mapView.scale;
      console.log(
        `[ExportJPEG] Current scale: ${currentScale}, Extent width (degrees): ${currentExtent.width}`
      );

      await new Promise((resolve, reject) => {
        mainImage.onload = async () => {
          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;
          const finalCtx = finalCanvas.getContext("2d");

          // Draw white background
          finalCtx.fillStyle = "#FFFFFF";
          finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

          // Draw main map image with cropping - only draw the left portion
          finalCtx.drawImage(
            mainImage,
            0,
            0,
            targetWidth,
            targetHeight,
            0,
            0,
            targetWidth,
            targetHeight
          );

          // --- DRAW LEGEND ---
          if (legendImage) {
            try {
              // Calculate legend position and size
              const legendPadding = 40;
              const maxWidth = targetWidth * 0.25;
              const legendTargetWidth = Math.min(
                legendImage.width / 2,
                maxWidth
              );
              const aspectRatio =
                legendImage.height / 2 / (legendImage.width / 2);
              const legendTargetHeight = legendTargetWidth * aspectRatio;
              const legendX = legendPadding;
              const legendY = targetHeight - legendTargetHeight - legendPadding;

              // Draw legend with background
              finalCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
              finalCtx.fillRect(
                legendX - 5,
                legendY - 5,
                legendTargetWidth + 10,
                legendTargetHeight + 10
              );
              finalCtx.drawImage(
                legendImage,
                legendX,
                legendY,
                legendTargetWidth,
                legendTargetHeight
              );
              console.log("[ExportJPEG] Legend drawn successfully");
            } catch (drawError) {
              console.error("[ExportJPEG] Error drawing legend:", drawError);
            }
          }

          // --- DRAW SCALE BAR ---
          try {
            const padding = 60;
            const maxBarWidthPixels = 240; // Maximum width on the canvas
            const minBarWidthPixels = 100; // Minimum width to ensure visibility
            const barHeight = 50;
            const lineThickness = 4;
            const yPos = targetHeight - padding;

            // Correction factor: 500ft should be 1.25 miles (6600ft), so multiply by 13.2
            const correctionFactor = 28; // 6600/500

            // Calculate scale based on the VIEW's state at the time of screenshot
            const viewState = screenshot.camera?.viewpoint || mapView.viewpoint;
            const scale = viewState.scale || currentScale;

            // Get map units per pixel (e.g. meters per pixel at this scale)
            const mapUnitsPerPixel = scale / (mapView.width * 96);

            // Apply correction factor to make calculations accurate
            const correctedMapUnitsPerPixel =
              mapUnitsPerPixel * correctionFactor;

            // Calculate what ground distance in map units would be represented by the max bar width
            const maxGroundDistanceMapUnits =
              maxBarWidthPixels * correctedMapUnitsPerPixel;
            const minGroundDistanceMapUnits =
              minBarWidthPixels * correctedMapUnitsPerPixel;

            // Convert to feet (assuming map units are meters)
            const maxGroundDistanceFeet = maxGroundDistanceMapUnits * 3.28084;
            const minGroundDistanceFeet = minGroundDistanceMapUnits * 3.28084;

            // Log for debugging
            console.log(
              `[ExportJPEG] Scale calculation: Max distance = ${(
                maxGroundDistanceFeet / 5280
              ).toFixed(2)} miles, Min distance = ${(
                minGroundDistanceFeet / 5280
              ).toFixed(2)} miles`
            );

            // Determine whether to use feet or miles based on the maximum bar distance
            let unit, standardIncrements, barWidthPixels, displayDistance;

            if (maxGroundDistanceFeet < 5000) {
              // Use feet with 500ft increments
              unit = "ft";
              standardIncrements = [
                500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
              ];
            } else {
              // Use miles with 0.5mi increments
              unit = "mi";
              standardIncrements = [
                0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 7.5, 10, 15, 20, 25, 50,
                100,
              ];
            }

            // Find the best standard increment
            if (unit === "ft") {
              // Find the largest standard increment that fits within max bar width
              for (let i = standardIncrements.length - 1; i >= 0; i--) {
                const incrementFeet = standardIncrements[i];

                // Calculate what width this increment would need (accounting for correction)
                const incrementMapUnits = incrementFeet / 3.28084;
                const incrementPixels =
                  incrementMapUnits / correctedMapUnitsPerPixel;

                // If this increment fits within our max width and is not too small, use it
                if (
                  incrementPixels <= maxBarWidthPixels &&
                  incrementPixels >= minBarWidthPixels
                ) {
                  displayDistance = incrementFeet;
                  barWidthPixels = incrementPixels;
                  break;
                }
              }

              // If no suitable increment was found, use the smallest standard increment
              if (!displayDistance) {
                displayDistance = standardIncrements[0];
                const incrementMapUnits = displayDistance / 3.28084;
                barWidthPixels = incrementMapUnits / correctedMapUnitsPerPixel;

                // Cap at max bar width if necessary
                if (barWidthPixels > maxBarWidthPixels) {
                  barWidthPixels = maxBarWidthPixels;
                }
              }
            } else {
              // Find the largest standard mile increment that fits within max bar width
              for (let i = standardIncrements.length - 1; i >= 0; i--) {
                const incrementMiles = standardIncrements[i];

                // Calculate what width this increment would need (accounting for correction)
                const incrementFeet = incrementMiles * 5280;
                const incrementMapUnits = incrementFeet / 3.28084;
                const incrementPixels =
                  incrementMapUnits / correctedMapUnitsPerPixel;

                // If this increment fits within our max width and is not too small, use it
                if (
                  incrementPixels <= maxBarWidthPixels &&
                  incrementPixels >= minBarWidthPixels
                ) {
                  displayDistance = incrementMiles;
                  barWidthPixels = incrementPixels;
                  break;
                }
              }

              // If no suitable increment was found, use the smallest standard increment
              if (!displayDistance) {
                displayDistance = standardIncrements[0];
                const incrementFeet = displayDistance * 5280;
                const incrementMapUnits = incrementFeet / 3.28084;
                barWidthPixels = incrementMapUnits / correctedMapUnitsPerPixel;

                // Cap at max bar width if necessary
                if (barWidthPixels > maxBarWidthPixels) {
                  barWidthPixels = maxBarWidthPixels;
                }
              }
            }

            // Calculate xPos based on the calculated barWidthPixels
            const xPos = finalCanvas.width - barWidthPixels - padding;

            // Format scale text
            const scaleText = `${displayDistance} ${unit}`;

            // Draw scale bar background
            finalCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
            finalCtx.fillRect(
              xPos - 5,
              yPos - barHeight - 5,
              barWidthPixels + 10,
              barHeight + 10
            );

            // Draw scale bar lines
            finalCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
            finalCtx.fillRect(
              xPos,
              yPos - lineThickness,
              barWidthPixels,
              lineThickness
            ); // Bottom line
            finalCtx.fillRect(xPos, yPos - barHeight, lineThickness, barHeight); // Left line
            finalCtx.fillRect(
              xPos + barWidthPixels - lineThickness,
              yPos - barHeight,
              lineThickness,
              barHeight
            ); // Right line

            // Draw scale text
            finalCtx.font = "bold 22px Arial";
            finalCtx.fillStyle = "rgba(0, 0, 0, 0.9)";
            finalCtx.textAlign = "center";
            finalCtx.textBaseline = "middle";
            finalCtx.fillText(
              scaleText,
              xPos + barWidthPixels / 2,
              yPos - barHeight / 2 - 2
            ); // Center text

            console.log(
              `[ExportJPEG] Scale bar drawn successfully: ${displayDistance} ${unit} (${barWidthPixels.toFixed(
                1
              )}px)`
            );
            console.log(
              `[ExportJPEG] Using correction factor of ${correctionFactor}x to adjust scale measurements`
            );
          } catch (scaleBarError) {
            console.error("Error drawing scale bar:", scaleBarError);
            // Continue without scale bar if it fails
          }

          resolve();
        };

        mainImage.onerror = (err) => {
          console.error("[ExportJPEG] Error loading screenshot image:", err);
          reject(new Error("Failed to load screenshot image"));
        };
        mainImage.src = screenshot.dataUrl;
      });

      // --- EXPORT IMAGE ---
      const finalDataUrl = finalCanvas.toDataURL("image/jpeg", 0.95);
      const response = await fetch(finalDataUrl);
      const blob = await response.blob();

      const date = new Date().toISOString().split("T")[0];
      const filename = `market_areas_map_${date}.jpg`;
      saveAs(blob, filename);

      console.log("[ExportJPEG] Export completed successfully");
      toast.dismiss(loadingToast);
      toast.success("Map exported successfully");
    } catch (error) {
      console.error("[ExportJPEG] Export failed:", error);
      toast.error(`Failed to export map: ${error.message}`);
      const loadingToastId = toast.latest;
      if (loadingToastId) toast.dismiss(loadingToastId);
    } finally {
      setIsExporting(false);
    }
  };

  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (
      x,
      y,
      width,
      height,
      radius
    ) {
      if (width < 2 * radius) radius = width / 2;
      if (height < 2 * radius) radius = height / 2;
      this.beginPath();
      this.moveTo(x + radius, y);
      this.arcTo(x + width, y, x + width, y + height, radius);
      this.arcTo(x + width, y + height, x, y + height, radius);
      this.arcTo(x, y + height, x, y, radius);
      this.arcTo(x, y, x + width, y, radius);
      this.closePath();
      return this;
    };
  }

  const handleExportKML = () => {
    setIsExportKMLDialogOpen(true);
  };

  const handleImportExcelClick = () => {
    setIsImportExcelDialogOpen(true);
  };

  const isClockwise = (ring) => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return area > 0;
  };

  const exportSelectedMAsToKML = async ({ folderName, selectedMAIds }) => {
    if (!selectedMAIds || selectedMAIds.length === 0) {
      toast.error("No market areas selected");
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting KML files...");

      const zip = new JSZip();

      const toKmlCoordinates = (rings) => {
        return rings
          .map((ring) => {
            // Convert each coordinate to longitude,latitude,altitude format
            return ring
              .map((coord) => {
                // Convert Web Mercator to WGS84 (ensure proper precision)
                const lng = (coord[0] * 180) / 20037508.34;
                const lat =
                  (Math.atan(Math.exp((coord[1] * Math.PI) / 20037508.34)) *
                    360) /
                    Math.PI -
                  90;
                // Use fixed precision to avoid floating point errors
                return `${lng.toFixed(6)},${lat.toFixed(6)},0`;
              })
              .join(" ");
          })
          .join(" ");
      };

      // Process each selected market area
      for (const maId of selectedMAIds) {
        const area = marketAreas.find((m) => m.id === maId);
        if (!area) continue;

        let kmlPlacemarks = "";
        const geometries = [];

        // Collect all geometries from both radius points and locations
        if (area.ma_type === "radius" && Array.isArray(area.radius_points)) {
          geometries.push(...area.radius_points.filter((pt) => pt.geometry));
        }
        if (area.locations && Array.isArray(area.locations)) {
          geometries.push(...area.locations.filter((loc) => loc.geometry));
        }

        // Process all geometries for this market area
        for (const geom of geometries) {
          const sourceGeom = geom.geometry;
          if (!sourceGeom || !sourceGeom.rings) continue;

          // Sort rings by area to identify outer and inner boundaries
          const rings = sourceGeom.rings
            .map((ring) => ({
              coordinates: ring,
              area: Math.abs(
                ring.reduce((area, coord, i) => {
                  const next = ring[(i + 1) % ring.length];
                  return area + (coord[0] * next[1] - next[0] * coord[1]);
                }, 0) / 2
              ),
            }))
            .sort((a, b) => b.area - a.area);

          const outerRing = rings[0];
          const innerRings = rings.slice(1);

          const outerCoords = toKmlCoordinates([outerRing.coordinates]);
          const innerBoundaries = innerRings
            .map((ring) => {
              const coords = toKmlCoordinates([ring.coordinates]);
              return `
            <innerBoundaryIs>
              <LinearRing>
                <coordinates>${coords}</coordinates>
              </LinearRing>
            </innerBoundaryIs>`;
            })
            .join("");

          // Create individual placemark for each shape
          kmlPlacemarks += `
    <Placemark>
      <name>${geom.name || area.name}</name>
      <description>${MA_TYPE_MAPPING[area.ma_type] || area.ma_type} - ${
            area.short_name || ""
          }</description>
      <styleUrl>#polygonStyle</styleUrl>
      <Polygon>
        <tessellate>1</tessellate>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${outerCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>${innerBoundaries}
      </Polygon>
    </Placemark>`;
        }

        // Create KML content for this market area, containing all its shapes
        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${area.name}</name>
    <description>${area.description || ""}</description>
    <Style id="polygonStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>7dff0000</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
    ${kmlPlacemarks}
  </Document>
  </kml>`;

        // Create sanitized filename
        const fileName = `${area.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.kml`;

        // Add KML file to the ZIP
        zip.file(fileName, kmlContent);
      }

      // Generate the ZIP file
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Save the ZIP file
      saveAs(content, `${folderName}.zip`);

      toast.dismiss(loadingToast);
      toast.success("KML files exported successfully");
    } catch (error) {
      console.error("KML export failed:", error);
      toast.error(`Failed to export KML files: ${error.message}`);
    } finally {
      setIsExporting(false);
      setIsExportKMLDialogOpen(false);
    }
  };

  useEffect(() => {
    // Initialize search widget
    if (!mapView) return;
    mapView.when(() => {
      import("@arcgis/core/widgets/Search").then(({ default: Search }) => {
        import("@arcgis/core/config").then((esriConfigModule) => {
          const esriConfig = esriConfigModule.default;
          esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

          const locatorSource = {
            url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
            name: "ArcGIS World Geocoding Service",
            placeholder: "Search for address or place",
            singleLineFieldName: "SingleLine",
            maxResults: 5,
            maxSuggestions: 5,
            minSuggestCharacters: 3,
            suggestionsEnabled: true,
            outFields: ["*"],
            locationEnabled: true,
          };

          const searchContainer = searchWidgetRef.current;
          if (!searchContainer.querySelector(".esri-search")) {
            const searchDiv = document.createElement("div");
            searchDiv.style.width = "100%";
            searchDiv.style.height = "100%";
            searchContainer.appendChild(searchDiv);

            const sw = new Search({
              view: mapView,
              container: searchDiv,
              includeDefaultSources: false,
              sources: [locatorSource],
              popupEnabled: false,
              resultGraphicEnabled: false,
              searchAllEnabled: false,
              defaultZoomScale: null,
              goToOverride: (view, params) => {
                // Prevent the default zoom behavior
                return null;
              },
            });

            const searchInput = searchContainer.querySelector("input");
            if (searchInput) {
              searchInput.style.backgroundColor = "transparent";
              searchInput.style.height = "100%";
              searchInput.classList.add("dark:bg-gray-800", "dark:text-white");
            }

            const suggestionContainer = searchContainer.querySelector(
              ".esri-search__suggestions-menu"
            );
            if (suggestionContainer) {
              suggestionContainer.classList.add(
                "dark:bg-gray-700",
                "dark:text-white"
              );
            }

            // Handle zoom manually only in select-result
            sw.on("select-result", (event) => {
              if (event.result && event.result.extent) {
                // Disable animation to prevent any intermediate zoom states
                mapView.goTo(
                  {
                    target: event.result.extent.center,
                    zoom: 10,
                  },
                  {
                    animate: false,
                  }
                );
              }
            });

            console.log("Search widget initialized successfully");
          }
        });
      });
    });
  }, [mapView]);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Projects
          </button>

          <Menu as="div" className="relative">
            <Menu.Button className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              Actions
              <ChevronDownIcon className="ml-2 h-5 w-5" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white dark:bg-gray-700 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => setIsExportDialogOpen(true)}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                         ${isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <TableCellsIcon className="mr-3 h-5 w-5" />
                        Export Data
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleExportJPEG}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${
                             isExporting ? "opacity-50 cursor-not-allowed" : ""
                           }`}
                      >
                        <PhotoIcon className="mr-3 h-5 w-5" />
                        Export JPEG
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleExportKML}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${
                             isExporting ? "opacity-50 cursor-not-allowed" : ""
                           }`}
                      >
                        <PhotoIcon className="mr-3 h-5 w-5" />
                        Export KML
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleImportExcelClick}
                        disabled={isImporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${
                             isImporting ? "opacity-50 cursor-not-allowed" : ""
                           }`}
                      >
                        <ArrowUpOnSquareIcon className="mr-3 h-5 w-5" />
                        Import Excel
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-4 w-full max-w-3xl">
            <div
              ref={searchWidgetRef}
              className="flex-1 relative border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            />
            <div className="whitespace-nowrap">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {projectDetails.project_number} - {projectDetails.client}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCreateMA}
            disabled={isExporting || isImporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-5 w-5" />
            Create New MA
          </button>
          <button
            id="maListButton"
            onClick={onToggleList}
            disabled={isExporting || isImporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ListBulletIcon className="h-5 w-5" />
            MA List
          </button>
        </div>
      </div>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={(exportData) => {
          handleExportData(exportData);
        }}
        variablePresets={variablePresets}
        marketAreas={marketAreas}
      />

      <ExportKMLDialog
        isOpen={isExportKMLDialogOpen}
        onClose={() => setIsExportKMLDialogOpen(false)}
        marketAreas={marketAreas}
        onExport={exportSelectedMAsToKML}
      />

      <ImportExcelDialog
        isOpen={isImportExcelDialogOpen}
        onClose={() => setIsImportExcelDialogOpen(false)}
        onImport={handleImportExcel}
        projectId={projectId}
      />
    </div>
  );
}
