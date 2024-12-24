// src/components/market-areas/Toolbar.jsx
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

  const isCreatingMARef = useRef(false);
  const cleanupProject = useProjectCleanup();

  const handleBack = () => {
    cleanupProject();
    navigate("/");
  };

  const handleExportData = async ({
    variables,
    formattedMarketAreas,
    selectedMarketAreas,
    fileName,
  }) => {
    if (!variables || variables.length === 0) {
      setIsExportDialogOpen(true);
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Enriching market areas...");

      const enrichedData = await enrichmentService.enrichAreas(
        selectedMarketAreas,
        variables
      );

      const csvContent = enrichmentService.exportToCSV(
        enrichedData,
        selectedMarketAreas,
        variables
      );

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `${fileName}.csv`);

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
  
      // Take the screenshot of the map
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100,
      });
  
      const finalCanvas = document.createElement("canvas");
      const mainImage = new Image();
  
      await new Promise((resolve) => {
        mainImage.onload = () => {
          finalCanvas.width = mainImage.width;
          finalCanvas.height = mainImage.height;
          const finalCtx = finalCanvas.getContext("2d");
          finalCtx.drawImage(mainImage, 0, 0);
  
          // Draw the scale bar
          const padding = 20;
          const barWidth = 90;
          const barHeight = 20;
          const lineThickness = 2;
          const xPos = finalCanvas.width - barWidth - padding;
          const yPos = finalCanvas.height - padding;
  
          // Calculate actual ground distance
          const pixelSizeInMeters = mapView.resolution;
          const scaleBarGroundDistance = pixelSizeInMeters * barWidth;
          // Apply a correction factor to match Esri's scale
          const correctionFactor = 0.75;
          const scaleBarMiles = (scaleBarGroundDistance * 0.000621371) * correctionFactor;
  
          // Format with one decimal place
          const scaleText = scaleBarMiles < 10 
            ? `${scaleBarMiles.toFixed(1)} mi` 
            : `${Math.round(scaleBarMiles)} mi`;
  
          // Draw the black inverted U-shaped scale
          finalCtx.fillStyle = "#000000";
          // Top line
          finalCtx.fillRect(xPos, yPos - barHeight, barWidth, lineThickness);
          // Left line
          finalCtx.fillRect(xPos, yPos - barHeight, lineThickness, barHeight);
          // Right line
          finalCtx.fillRect(xPos + barWidth - lineThickness, yPos - barHeight, lineThickness, barHeight);
  
          // Draw text below the inverted U
          finalCtx.font = "12px Arial";
          finalCtx.fillStyle = "#000000";
          finalCtx.textAlign = "center";
          finalCtx.textBaseline = "top";
          finalCtx.fillText(scaleText, xPos + barWidth / 2, yPos - barHeight/3);
  
          resolve();
        };
        mainImage.src = screenshot.dataUrl;
      });
  
      const finalDataUrl = finalCanvas.toDataURL("image/jpeg", 1.0);
      const response = await fetch(finalDataUrl);
      const blob = await response.blob();
  
      const date = new Date().toISOString().split("T")[0];
      const filename = `market_areas_map_${date}.jpg`;
      saveAs(blob, filename);
  
      toast.dismiss(loadingToast);
      toast.success("Map exported successfully with scale bar");
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

      await projection.load();
      const zip = new JSZip();

      const toKmlCoordinates = (rings) => {
        return rings
          .map((ring) =>
            ring.map((coord) => `${coord[0]},${coord[1]},0`).join(" ")
          )
          .join(" ");
      };

      // Process each selected market area
      for (const maId of selectedMAIds) {
        const area = marketAreas.find((m) => m.id === maId);
        if (!area) continue;

        let kmlPlacemarks = "";

        // Process radius points
        if (area.ma_type === "radius" && Array.isArray(area.radius_points)) {
          for (const pt of area.radius_points) {
            if (!pt.geometry) continue;

            const projectedGeom = projection.project(pt.geometry, { wkid: 4326 });
            if (!projectedGeom || !projectedGeom.rings) continue;

            const coords = toKmlCoordinates(projectedGeom.rings);
            kmlPlacemarks += `
  <Placemark>
    <name>${area.name}</name>
    <description>${MA_TYPE_MAPPING[area.ma_type] || area.ma_type} - ${area.short_name || ""}</description>
    <styleUrl>#polygonStyle</styleUrl>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${coords}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`;
          }
        }
        // Process other locations
        else if (area.locations && Array.isArray(area.locations)) {
          for (const loc of area.locations) {
            if (!loc.geometry) continue;

            const projectedGeom = projection.project(loc.geometry, { wkid: 4326 });
            if (!projectedGeom || !projectedGeom.rings) continue;

            const coords = toKmlCoordinates(projectedGeom.rings);
            kmlPlacemarks += `
  <Placemark>
    <name>${area.name}</name>
    <description>${MA_TYPE_MAPPING[area.ma_type] || area.ma_type} - ${area.short_name || ""}</description>
    <styleUrl>#polygonStyle</styleUrl>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${coords}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`;
          }
        }

        // Create KML content for this market area
        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://earth.google.com/kml/2.2">
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
      </PolyStyle>
    </Style>
    ${kmlPlacemarks}
  </Document>
  </kml>`;

        // Create sanitized filename
        const fileName = `${area.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.kml`;
        
        // Add KML file directly to the ZIP root
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
              goToOverride: (view, params) => {
                params.target.scale = 50000;
                return view.goTo(params.target);
              },
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

            sw.on("select-result", (event) => {
              if (event.result && event.result.extent) {
                mapView.goTo({
                  target: event.result.extent.center,
                  zoom: 14,
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

        <div
          ref={searchWidgetRef}
          className="flex-1 max-w-2xl mx-4 relative border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        ></div>

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
