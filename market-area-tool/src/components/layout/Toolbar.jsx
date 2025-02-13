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
} from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { enrichmentService } from "../../services/enrichmentService";
import { toast } from "react-hot-toast";
import { saveAs } from "file-saver";
import ExportDialog from "./ExportDialog";
import ExportKMLDialog from "./ExportKMLDialog";
import { usePresets } from "../../contexts/PresetsContext";
import { useProjectCleanup } from "../../hooks/useProjectCleanup";
import * as projection from "@arcgis/core/geometry/projection";
import JSZip from "jszip";
import { projectsAPI } from "../../services/api";  // Ensure this import is correct

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
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportKMLDialogOpen, setIsExportKMLDialogOpen] = useState(false);
  const searchWidgetRef = useRef(null);
  const { mapView } = useMap();
  const { marketAreas } = useMarketAreas();
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Initialize with more robust default values
  const [projectDetails, setProjectDetails] = useState({
    project_number: 'Loading...',
    client: '',
    location: '',
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
          project_number: response.data.project_number || 'Unknown',
          client: response.data.client || '',
          location: response.data.location || 'N/A',
          last_modified: response.data.last_modified || new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to fetch project details:', error);
        
        // Set error state, but keep the loading indicator
        setProjectDetails(prev => ({
          ...prev,
          client: 'Error Loading Project',
          location: 'Please refresh'
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
  
    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Enriching market areas...");
  
      const enrichedData = await enrichmentService.enrichAreas(
        selectedMarketAreas,
        variables,
        includeUSAData
      );
  
      const result = await enrichmentService.handleExport(
        enrichedData,
        selectedMarketAreas,
        variables,
        { 
          includeUSAData, 
          projectId: projectId  // Pass the project ID explicitly
        }
      );
  
      if (result instanceof Blob) {
        saveAs(result, fileName);
      }
  
      toast.dismiss(loadingToast);
      toast.success("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Failed to export data: ${error.message}`);
    } finally {
      setIsExporting(false);
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
    if (!mapView) {
      console.log("No mapView available");
      toast.error("Map not ready for export");
      return;
    }
  
    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting map as JPEG...");
  
      const html2canvas = (await import('html2canvas')).default;
  
      const targetWidth = 3160;
      const targetHeight = 2048;
  
      const legendElement = document.querySelector(".esri-legend");
      let legendImage = null;
      let originalStyles = null;
  
      if (legendElement && window.getComputedStyle(legendElement).display !== 'none') {
        try {
          // Store original styles
          originalStyles = legendElement.style.cssText;
  
          // Apply temporary styles for capture
          legendElement.style.position = 'relative';
          legendElement.style.backgroundColor = 'white';
          legendElement.style.padding = '10px';
          legendElement.style.width = 'auto';
          legendElement.style.display = 'inline-block';
          
          // Set consistent font size for all text elements
          const standardFontSize = '14px';
          legendElement.style.fontSize = standardFontSize;
          
          // Style all text elements in the legend to ensure consistency
          const textElements = legendElement.querySelectorAll('.esri-legend__layer-cell--info, .esri-legend__service-label, .esri-legend__layer-label');
          textElements.forEach(element => {
            element.style.fontSize = standardFontSize;
            element.style.padding = '2px 6px';  // Reduced padding
            element.style.display = 'inline-block';
            element.style.verticalAlign = 'middle';
            element.style.lineHeight = '1.1';  // Tighter line height
          });
          
          // Style symbols consistently
          const symbols = legendElement.querySelectorAll('.esri-legend__symbol');
          symbols.forEach(symbol => {
            symbol.style.width = '24px';
            symbol.style.height = '24px';
            symbol.style.marginRight = '4px';  // Reduced margin
            symbol.style.display = 'inline-block';
            symbol.style.verticalAlign = 'middle';
          });
  
          // Optimize layout for compactness
          const rows = legendElement.querySelectorAll('.esri-legend__layer-row');
          rows.forEach(row => {
            row.style.marginBottom = '2px';  // Reduced margin
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.minHeight = '24px';  // Ensure consistent height
          });
          
          // Reduce spacing between legend sections
          const layers = legendElement.querySelectorAll('.esri-legend__layer');
          layers.forEach(layer => {
            layer.style.marginBottom = '4px';  // Reduced margin between layers
          });
  
          // Capture the legend with higher resolution
          legendImage = await html2canvas(legendElement, {
            backgroundColor: 'white',
            scale: 2,
            logging: false,
            useCORS: true
          });
  
          // Restore original styles
          legendElement.style.cssText = originalStyles;
          symbols.forEach(symbol => symbol.removeAttribute('style'));
          textElements.forEach(element => element.removeAttribute('style'));
          rows.forEach(row => row.removeAttribute('style'));
        } catch (error) {
          console.warn("Failed to capture legend:", error);
          if (originalStyles) {
            legendElement.style.cssText = originalStyles;
          }
        }
      }
  
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100,
        width: targetWidth,
        height: targetHeight
      });
  
      const finalCanvas = document.createElement("canvas");
      const mainImage = new Image();
  
      await new Promise((resolve) => {
        mainImage.onload = async () => {
          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;
          const finalCtx = finalCanvas.getContext("2d");
          
          // Draw white background
          finalCtx.fillStyle = "#FFFFFF";
          finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
          
          // Draw main map image
          finalCtx.drawImage(mainImage, 0, 0);
  
          // Draw the legend if we captured it
          if (legendImage) {
            console.log("Drawing legend", legendImage.width, legendImage.height);
            const maxWidth = targetWidth * 0.20; // Maximum 20% of map width
            const legendWidth = Math.min(legendImage.width, maxWidth);
            const aspectRatio = legendImage.height / legendImage.width;
            const legendHeight = legendWidth * aspectRatio;
  
            finalCtx.drawImage(
              legendImage,
              40, // x position
              targetHeight - legendHeight - 40, // y position from bottom
              legendWidth,
              legendHeight
            );
          }
  
          // Draw scale bar with 50% transparent background
          const padding = 60;
          const barWidth = 240;
          const barHeight = 50;
          const lineThickness = 4;
          const xPos = finalCanvas.width - barWidth - padding;
          const yPos = targetHeight - padding;
  
          // Calculate scale
          const pixelSizeInMeters = mapView.resolution;
          const scaleBarGroundDistance = pixelSizeInMeters * barWidth;
          const correctionFactor = 0.75;
          const scaleBarMiles = (scaleBarGroundDistance * 0.000621371) * correctionFactor;
  
          // Determine scale text
          let scaleText;
          if (scaleBarMiles < 1) {
            const scaleBarFeet = scaleBarGroundDistance * 3.28084;
            const scaleBarFeetRounded = Math.round(scaleBarFeet / 1000) * 1000;
            scaleText = `${scaleBarFeetRounded} ft`;
          } else {
            const scaleBarMilesRounded = Math.round(scaleBarMiles);
            scaleText = `${scaleBarMilesRounded} mi`;
          }
  
          // Draw scale bar background with 50% transparency
          finalCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
          finalCtx.fillRect(
            xPos - 2,
            yPos - barHeight - 2,
            barWidth + 4,
            barHeight + 4
          );
  
          // Draw scale bar
          finalCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
          finalCtx.fillRect(xPos, yPos - barHeight, barWidth, lineThickness);
          finalCtx.fillRect(xPos, yPos - barHeight, lineThickness, barHeight);
          finalCtx.fillRect(xPos + barWidth - lineThickness, yPos - barHeight, lineThickness, barHeight);
  
          // Draw scale text
          finalCtx.font = "bold 24px Arial";
          finalCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
          finalCtx.textAlign = "left";
          finalCtx.textBaseline = "middle";
          finalCtx.fillText(scaleText, xPos + lineThickness + 4, yPos - barHeight / 2.5);
  
          resolve();
        };
        mainImage.src = screenshot.dataUrl;
      });
  
      // Export final image
      const finalDataUrl = finalCanvas.toDataURL("image/jpeg", 1.0);
      const response = await fetch(finalDataUrl);
      const blob = await response.blob();
  
      const date = new Date().toISOString().split("T")[0];
      const filename = `market_areas_map_${date}.jpg`;
      saveAs(blob, filename);
  
      toast.dismiss(loadingToast);
      toast.success("Map exported successfully with legend and scale bar");
    } catch (error) {
      console.error("JPEG export failed:", error);
      toast.error("Failed to export map: " + error.message);
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
            return ring.map((coord) => {
              // Convert Web Mercator to WGS84 (ensure proper precision)
              const lng = (coord[0] * 180) / 20037508.34;
              const lat = (Math.atan(Math.exp((coord[1] * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
              // Use fixed precision to avoid floating point errors
              return `${lng.toFixed(6)},${lat.toFixed(6)},0`;
            }).join(" ");
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
          geometries.push(...area.radius_points.filter(pt => pt.geometry));
        }
        if (area.locations && Array.isArray(area.locations)) {
          geometries.push(...area.locations.filter(loc => loc.geometry));
        }
  
        // Process all geometries for this market area
        for (const geom of geometries) {
          const sourceGeom = geom.geometry;
          if (!sourceGeom || !sourceGeom.rings) continue;
  
          // Sort rings by area to identify outer and inner boundaries
          const rings = sourceGeom.rings.map(ring => ({
            coordinates: ring,
            area: Math.abs(ring.reduce((area, coord, i) => {
              const next = ring[(i + 1) % ring.length];
              return area + (coord[0] * next[1] - next[0] * coord[1]);
            }, 0) / 2)
          })).sort((a, b) => b.area - a.area);
  
          const outerRing = rings[0];
          const innerRings = rings.slice(1);
  
          const outerCoords = toKmlCoordinates([outerRing.coordinates]);
          const innerBoundaries = innerRings.map(ring => {
            const coords = toKmlCoordinates([ring.coordinates]);
            return `
            <innerBoundaryIs>
              <LinearRing>
                <coordinates>${coords}</coordinates>
              </LinearRing>
            </innerBoundaryIs>`;
          }).join("");
  
          // Create individual placemark for each shape
          kmlPlacemarks += `
    <Placemark>
      <name>${geom.name || area.name}</name>
      <description>${MA_TYPE_MAPPING[area.ma_type] || area.ma_type} - ${area.short_name || ""}</description>
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
              }
            });

            const searchInput = searchContainer.querySelector("input");
            if (searchInput) {
              searchInput.style.backgroundColor = "transparent";
              searchInput.style.height = "100%";
              searchInput.classList.add("dark:bg-gray-800", "dark:text-white");
            }

            const suggestionContainer = searchContainer.querySelector(".esri-search__suggestions-menu");
            if (suggestionContainer) {
              suggestionContainer.classList.add("dark:bg-gray-700", "dark:text-white");
            }

            // Handle zoom manually only in select-result
            sw.on("select-result", (event) => {
              if (event.result && event.result.extent) {
                // Disable animation to prevent any intermediate zoom states
                mapView.goTo({
                  target: event.result.extent.center,
                  zoom: 10
                }, {
                  animate: false
                });
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
                           ${isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
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
                           ${isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <PhotoIcon className="mr-3 h-5 w-5" />
                        Export KML
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
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-5 w-5" />
            Create New MA
          </button>
          <button
            id="maListButton"
            onClick={onToggleList}
            disabled={isExporting}
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
    </div>
  );
}