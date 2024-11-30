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
import ScaleBar from "@arcgis/core/widgets/ScaleBar"; // Static Import

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

  const handleBack = () => {
    navigate("/");
  };

  const handleExportData = async ({
    variables,
    formattedMarketAreas,
    selectedMarketAreas,
    fileName,
  }) => {
    console.log(
      "handleExportData called with full market areas:",
      selectedMarketAreas
    );

    console.log("handleExportData called with:", {
      variables,
      selectedMarketAreas,
      fileName,
    });

    if (!variables || variables.length === 0) {
      console.log("No variables selected, opening dialog");
      setIsExportDialogOpen(true);
      return;
    }

    try {
      console.log("Starting export process");
      setIsExporting(true);
      const loadingToast = toast.loading("Enriching market areas...");

      // Get the enriched data
      const enrichedData = await enrichmentService.enrichAreas(
        selectedMarketAreas,
        variables
      );

      console.log("Enriched data:", enrichedData);
      console.log("Selected market areas:", selectedMarketAreas);

      // Generate CSV content
      const csvContent = enrichmentService.exportToCSV(
        enrichedData,
        selectedMarketAreas, // Pass the actual market areas array
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

  // Add this function back to your component
  const handleExportPDF = async () => {
    if (!mapView) {
      toast.error("Map not ready for export");
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting map as PDF...");

      // Create and add scale bar first
      const tempScaleBar = new ScaleBar({
        view: mapView,
        unit: "dual",
        style: "ruler",
        visible: true,
      });

      mapView.ui.add(tempScaleBar, "top-left");

      // Wait for scale bar to render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Capture the map view as a screenshot
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100,
        includeUI: true,
      });

      // Initialize jsPDF
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [screenshot.data.width, screenshot.data.height],
      });

      // Add the image to the PDF
      pdf.addImage(
        screenshot.dataUrl,
        "PNG",
        0,
        0,
        screenshot.data.width,
        screenshot.data.height
      );

      // Save the PDF
      pdf.save(
        `market_areas_map_${new Date().toISOString().split("T")[0]}.pdf`
      );

      // Cleanup
      mapView.ui.remove(tempScaleBar);

      toast.dismiss(loadingToast);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Failed to export PDF: " + error.message);
    } finally {
      setIsExporting(false);
    }
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
      console.log("Starting JPEG export process");
  
      // Get the current scale from the mapView
      const scale = mapView.scale;
  
      // Keep original canvas size
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
  
      // Calculate initial distances - adjusted divisor to match ESRI scale
      const metersDistance = scale / 24;  // Adjusted from /6 to /24 to better match ESRI scale
      const milesDistance = metersDistance * 0.000621371;
  
      // Function to get nice round numbers
      const getNiceNumber = (value) => {
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const normalized = value / magnitude;
        
        // Array of nice numbers to snap to
        const niceNumbers = [1, 2, 2.5, 5, 10];
        
        // Find the closest nice number that's larger than our value
        for (const nice of niceNumbers) {
          if (nice >= normalized) {
            return nice * magnitude;
          }
        }
        return niceNumbers[niceNumbers.length - 1] * magnitude * 10;
      };
  
      // Get nice round number for display
      let displayDistance;
      let displayText;
      let originalWidth = 320; // This is our default/maximum width
  
      // Convert to feet to check threshold
      const feetDistance = milesDistance * 5280;
  
      // Use miles if over 1000ft, otherwise use feet
      if (feetDistance >= 1000) {
        displayDistance = getNiceNumber(milesDistance);
        displayText = `${displayDistance} mi`;
      } else {
        displayDistance = getNiceNumber(feetDistance);
        displayText = `${numberWithCommas(displayDistance)} ft`;
      }
  
      // Calculate the actual bar width based on the nice number
      const widthRatio = feetDistance >= 1000
        ? displayDistance / milesDistance 
        : (displayDistance / 5280) / milesDistance;
      const barWidth = Math.min(originalWidth, originalWidth * widthRatio);
  
      // Draw background with semi-transparency
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
      ctx.fill();
  
      // Reset shadow
      ctx.shadowColor = 'transparent';
  
      const drawScaleBar = (y, text) => {
        const startX = (canvas.width - barWidth) / 2; // Center the bar
  
        // Draw main bar
        ctx.fillStyle = '#333333';
        ctx.fillRect(startX, y, barWidth, 2);
  
        // Draw start and end markers
        ctx.fillRect(startX, y - 5, 1, 10);
        ctx.fillRect(startX + barWidth, y - 5, 1, 10);
  
        // Add text
        ctx.font = '18px Arial';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.fillText(text, startX + barWidth / 2, y + 25);
      };
  
      // Draw scale bar
      drawScaleBar(35, displayText);
  
      // Convert canvas to data URL
      const scaleBarImage = canvas.toDataURL();
  
      // Take the main screenshot
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 100
      });
  
      // Create final canvas and combine images
      const finalCanvas = document.createElement('canvas');
      const mainImage = new Image();
      const scaleBarImg = new Image();
  
      await new Promise((resolve, reject) => {
        mainImage.onload = () => {
          finalCanvas.width = mainImage.width;
          finalCanvas.height = mainImage.height;
          const finalCtx = finalCanvas.getContext('2d');
  
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
  
      // Export final image
      const finalDataUrl = finalCanvas.toDataURL('image/jpeg', 1.0);
      const response = await fetch(finalDataUrl);
      const blob = await response.blob();
      
      const date = new Date().toISOString().split("T")[0];
      const filename = `market_areas_map_${date}.jpg`;
      saveAs(blob, filename);
  
      toast.dismiss(loadingToast);
      toast.success("Map exported successfully with scale bar");
      
    } catch (error) {
      console.error("JPEG export failed:", error);
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error("Failed to export map: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Helper function to format miles
  function formatMiles(miles) {
    if (miles >= 1) {
      return `${miles.toFixed(1)} mi`;
    } else {
      return `${(miles * 5280).toFixed(0)} ft`;
    }
  }
  
  // Helper function to format kilometers
  function formatKilometers(km) {
    if (km >= 1) {
      return `${km.toFixed(1)} km`;
    } else {
      return `${(km * 1000).toFixed(0)} m`;
    }
  }
  
  // Helper function to add commas to large numbers
  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  // Add this to your component if not already present
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
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

  // Export MXD (WebMap)
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

      toast.dismiss();
      toast.success("Web map exported successfully");
    } catch (error) {
      console.error("Web map export failed:", error);
      toast.error("Failed to export web map: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Initialize the ArcGIS Search widget
  useEffect(() => {
    let searchWidget;

    const initializeSearchWidget = async () => {
      if (!mapView) return;

      try {
        const [Search] = await Promise.all([
          import("@arcgis/core/widgets/Search").then(
            (module) => module.default
          ),
        ]);

        searchWidget = new Search({
          view: mapView,
          container: searchWidgetRef.current,
        });

        searchWidget.on("select-result", (event) => {
          if (event.result && event.result.extent) {
            mapView.goTo({
              target: event.result.extent.center,
              zoom: 14,
            });
          }
        });

        console.log("Search widget initialized");
      } catch (error) {
        console.error("Error initializing Search widget:", error);
      }
    };

    initializeSearchWidget();

    return () => {
      if (searchWidget) {
        searchWidget.destroy();
        console.log("Search widget destroyed");
      }
    };
  }, [mapView]);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="h-14 px-4 flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 
                   dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Projects
          </button>

          <Menu as="div" className="relative">
            <Menu.Button
              className="inline-flex items-center px-3 py-2 text-sm 
                                text-gray-600 hover:text-gray-900 dark:text-gray-300 
                                dark:hover:text-white"
            >
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
              <Menu.Items
                className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md 
                                 bg-white dark:bg-gray-700 shadow-lg ring-1 ring-black 
                                 ring-opacity-5 focus:outline-none"
              >
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
                        onClick={handleExportMXD}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${
                             isExporting ? "opacity-50 cursor-not-allowed" : ""
                           }`}
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

        {/* Center section - Search Widget */}
        <div
          ref={searchWidgetRef}
          className="flex-1 max-w-2xl mx-4 relative border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        ></div>

        {/* Right section - Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onCreateMA}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white 
                     rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 
                     focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-5 w-5" />
            Create New MA
          </button>
          <button
            onClick={onToggleList}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white 
                     rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 
                     focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ListBulletIcon className="h-5 w-5" />
            Toggle MA List
          </button>
        </div>
      </div>

      {/* Export Dialog */}
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
