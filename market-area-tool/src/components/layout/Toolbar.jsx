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
import ExportDialog from "./ExportDialog"; // Add this import
import { usePresets } from "../../contexts/PresetsContext"; // Assuming we'll create a PresetsContext

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

  // In Toolbar component
  const handleExportData = async (selectedVariables = []) => {
    console.log("handleExportData called with variables:", selectedVariables);

    if (!marketAreas.length) {
      toast.error("No market areas defined to export");
      return;
    }

    // If no variables selected, open dialog
    if (!selectedVariables.length) {
      console.log("No variables selected, opening dialog");
      setIsExportDialogOpen(true);
      return;
    }

    try {
      console.log("Starting export process");
      setIsExporting(true);
      const loadingToast = toast.loading("Enriching market areas...");

      const variables =
        selectedVariables.length > 0 ? selectedVariables : getAllVariables();

      console.log("Variables to export:", variables);

      const enrichedData = await enrichmentService.enrichAreas(
        marketAreas,
        variables
      );
      const csvContent = enrichmentService.exportToCSV(
        enrichedData,
        marketAreas,
        variables
      );

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      saveAs(
        blob,
        `market_areas_enriched_${new Date().toISOString().split("T")[0]}.csv`
      );

      toast.dismiss(loadingToast);
      toast.success("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Failed to export data: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Export JPEG
  const handleExportJPEG = async () => {
    if (!mapView) {
      toast.error("Map not ready for export");
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting map as JPEG...");

      const screenshot = await mapView.takeScreenshot({
        format: "png", // Use "jpeg" if supported
        quality: 90,
      });

      // Convert to Blob
      const response = await fetch(screenshot.dataUrl);
      const blob = await response.blob();

      // Save the image
      saveAs(
        blob,
        `market_areas_map_${new Date().toISOString().split("T")[0]}.jpg`
      );

      toast.dismiss(loadingToast);
      toast.success("Map exported successfully");
    } catch (error) {
      console.error("JPEG export failed:", error);
      toast.error("Failed to export map: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export PDF using jsPDF
  const handleExportPDF = async () => {
    if (!mapView) {
      toast.error("Map not ready for export");
      return;
    }

    try {
      setIsExporting(true);
      const loadingToast = toast.loading("Exporting map as PDF...");

      // Capture the map view as a screenshot
      const screenshot = await mapView.takeScreenshot({
        format: "png",
        quality: 90,
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

      toast.dismiss(loadingToast);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Failed to export PDF: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

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
                        onClick={() => handleExportData()}
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
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className={`${
                          active ? "bg-gray-100 dark:bg-gray-600" : ""
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${
                             isExporting ? "opacity-50 cursor-not-allowed" : ""
                           }`}
                      >
                        <DocumentArrowDownIcon className="mr-3 h-5 w-5" />
                        Export PDF
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

      {/* Fix the ExportDialog props */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => {
          console.log("Closing export dialog");
          setIsExportDialogOpen(false);
        }}
        onExport={(variables) => {
          console.log("Export triggered with variables:", variables);
          handleExportData(variables);
        }}
        variablePresets={variablePresets} // Fix the props syntax
      />
    </div>
  );
}
