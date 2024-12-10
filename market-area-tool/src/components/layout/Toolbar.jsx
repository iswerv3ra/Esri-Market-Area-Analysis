import { useState, useEffect, Fragment, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, Transition, Dialog } from "@headlessui/react";
import {
  ChevronDownIcon,
  ArrowLeftIcon,
  PhotoIcon,
  MapIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  ListBulletIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import {
  enrichmentService,
  getAllVariables,
} from "../../services/enrichmentService";
import { toast } from "react-hot-toast";
import axios from "axios";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import ExportDialog from "./ExportDialog";
import { usePresets } from "../../contexts/PresetsContext";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import { useProjectCleanup } from '../../hooks/useProjectCleanup';
// Market area type mapping for consistent formatting
const MA_TYPE_MAPPING = {
  'radius': 'RADIUS',
  'place': 'PLACE',
  'block': 'BLOCK',
  'blockgroup': 'BLOCKGROUP',
  'cbsa': 'CBSA',
  'state': 'STATE',
  'zip': 'ZIP',
  'tract': 'TRACT',
  'county': 'COUNTY',
};

// Main Toolbar Component
export default function Toolbar({ onCreateMA, onToggleList }) {
  const { variablePresets } = usePresets();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const searchWidgetRef = useRef(null);
  const { mapView } = useMap();
  const { marketAreas } = useMarketAreas();
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Flag to prevent toggle during MA creation
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

  // Simplified map initialization
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

      const scale = mapView.scale;
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 80;
      const ctx = canvas.getContext("2d");

      const metersDistance = scale / 24;
      const milesDistance = metersDistance * 0.000621371;

      const getNiceNumber = (value) => {
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const normalized = value / magnitude;
        const niceNumbers = [1, 2, 2.5, 5, 10];
        for (const nice of niceNumbers) {
          if (nice >= normalized) {
            return nice * magnitude;
          }
        }
        return niceNumbers[niceNumbers.length - 1] * magnitude * 10;
      };

      let displayDistance;
      let displayText;
      let originalWidth = 320;

      const feetDistance = milesDistance * 5280;

      if (feetDistance >= 1000) {
        displayDistance = getNiceNumber(milesDistance);
        displayText = `${displayDistance} mi`;
      } else {
        displayDistance = getNiceNumber(feetDistance);
        displayText = `${numberWithCommas(displayDistance)} ft`;
      }

      const widthRatio =
        feetDistance >= 1000
          ? displayDistance / milesDistance
          : displayDistance / 5280 / milesDistance;
      const barWidth = Math.min(originalWidth, originalWidth * widthRatio);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
      ctx.fill();
      ctx.shadowColor = "transparent";

      const drawScaleBar = (y, text) => {
        const startX = (canvas.width - barWidth) / 2;
        ctx.fillStyle = "#333333";
        ctx.fillRect(startX, y, barWidth, 2);
        ctx.fillRect(startX, y - 5, 1, 10);
        ctx.fillRect(startX + barWidth, y - 5, 1, 10);
        ctx.font = "18px Arial";
        ctx.fillStyle = "#333333";
        ctx.textAlign = "center";
        ctx.fillText(text, startX + barWidth / 2, y + 25);
      };

      drawScaleBar(35, displayText);
      const scaleBarImage = canvas.toDataURL();

      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100,
      });

      const finalCanvas = document.createElement("canvas");
      const mainImage = new Image();
      const scaleBarImg = new Image();

      await new Promise((resolve) => {
        mainImage.onload = () => {
          finalCanvas.width = mainImage.width;
          finalCanvas.height = mainImage.height;
          const finalCtx = finalCanvas.getContext("2d");
          finalCtx.drawImage(mainImage, 0, 0);

          scaleBarImg.onload = () => {
            const padding = 30;
            finalCtx.drawImage(
              scaleBarImg,
              mainImage.width - scaleBarImg.width - padding,
              mainImage.height - scaleBarImg.height - padding
            );
            resolve();
          };
          scaleBarImg.src = scaleBarImage;
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

  const handleExportMXD = async () => {
    if (!mapView || !marketAreas.length) {
      toast.error("No map content to export");
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Preparing web map export...");

      const webMapJson = {
        operationalLayers: marketAreas.map((area) => ({
          id: area.id,
          title: area.name,
          visibility: true,
          opacity: 1,
          geometryType:
            area.ma_type === "radius" ? "esriGeometryPolygon" : undefined,
          features:
            area.ma_type === "radius"
              ? area.radius_points.map((point) => ({
                  geometry: point.geometry,
                  attributes: {
                    name: area.name,
                    radius: point.radius,
                  },
                }))
              : area.locations.map((loc) => ({
                  geometry: loc.geometry,
                  attributes: {
                    name: area.name,
                    id: loc.id,
                  },
                })),
          style: area.style_settings,
        })),
        baseMap: {
          baseMapLayers: [
            {
              id: "defaultBasemap",
              title: "Default Basemap",
              url: "https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
              visibility: true,
            },
          ],
        },
        initialExtent: mapView.extent.toJSON(),
      };

      const blob = new Blob([JSON.stringify(webMapJson, null, 2)], {
        type: "application/json",
      });
      saveAs(
        blob,
        `market_areas_webmap_${new Date().toISOString().split("T")[0]}.json`
      );

      toast.dismiss(loadingToast);
      toast.success("Web map exported successfully");
    } catch (error) {
      console.error("Web map export failed:", error);
      toast.error("Failed to export web map: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  
// Updated Search widget initialization
useEffect(() => {
  let searchWidget;

  const initializeSearchWidget = async () => {
    if (!mapView) return;

    try {
      // Import all required modules
      const [Search, esriConfig] = await Promise.all([
        import("@arcgis/core/widgets/Search").then(module => module.default),
        import("@arcgis/core/config").then(module => module.default)
      ]);

      // Configure API Key authentication instead of OAuth
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

      // Configure the locator source with API key
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
        locationEnabled: true
      };

      // Create search container
      const searchContainer = searchWidgetRef.current;
      if (!searchContainer.querySelector(".esri-search")) {
        const searchDiv = document.createElement("div");
        searchDiv.style.width = "100%";
        searchDiv.style.height = "100%";
        searchContainer.appendChild(searchDiv);

        searchWidget = new Search({
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
          }
        });

        // Apply styles to search input
        const searchInput = searchContainer.querySelector("input");
        if (searchInput) {
          searchInput.style.backgroundColor = "transparent";
          searchInput.style.height = "100%";
          searchInput.classList.add("dark:bg-gray-800", "dark:text-white");
        }

        // Apply dark mode styles to suggestions
        const suggestionContainer = searchContainer.querySelector(".esri-search__suggestions-menu");
        if (suggestionContainer) {
          suggestionContainer.classList.add("dark:bg-gray-700", "dark:text-white");
        }

        searchWidget.on("select-result", (event) => {
          if (event.result && event.result.extent) {
            mapView.goTo({
              target: event.result.extent.center,
              zoom: 14
            });
          }
        });

        console.log("Search widget initialized successfully");
      }
    } catch (error) {
      console.error("Error initializing Search widget:", error);
      toast.error("Failed to initialize search functionality");
    }
  };

  initializeSearchWidget();

  return () => {
    if (searchWidget) {
      try {
        searchWidget.destroy();
      } catch (error) {
        console.error("Error destroying search widget:", error);
      }
    }
  };
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
                        Export Enriched Data
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
                        onClick={handleExportMXD}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <MapIcon className="mr-3 h-5 w-5" />
                        Export MXD
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
            onClick={onToggleList}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ListBulletIcon className="h-5 w-5" />
            Toggle MA List
          </button>
        </div>
      </div>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => {
          console.log("Closing export dialog");
          setIsExportDialogOpen(false);
        }}
        onExport={(exportData) => {
          console.log("Export triggered with:", exportData);
          handleExportData(exportData);
        }}
        variablePresets={variablePresets}
        marketAreas={marketAreas}
      />
    </div>
  );
}