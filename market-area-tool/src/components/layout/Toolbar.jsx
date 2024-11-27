import { useState, useEffect, Fragment, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import {
  ChevronDownIcon,
  ArrowLeftIcon,
  PhotoIcon,
  MapIcon,
  TableCellsIcon,
  CodeBracketSquareIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useMap } from "../../contexts/MapContext";
import { useMarketAreas } from "../../contexts/MarketAreaContext";
import { enrichmentService } from "../../services/enrichmentService";
import { toast } from "react-hot-toast";
import axios from "axios";

export default function Toolbar({ onCreateMA, onToggleList }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const searchInputRef = useRef(null);
  const { mapView } = useMap();
  const { marketAreas } = useMarketAreas();
  const GEOCODING_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

  const handleBack = () => {
    navigate("/");
  };

  // Export Data (Enrichment)
  const handleExportData = async () => {
    if (!marketAreas.length) {
        toast.error("No market areas defined to export");
        return;
    }

    try {
        setIsExporting(true);
        const loadingToast = toast.loading("Enriching market areas...");

        const enrichedData = await enrichmentService.enrichAreas(marketAreas);
        const csvContent = enrichmentService.exportToCSV(enrichedData, marketAreas);

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `market_areas_enriched_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);

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
      toast.error('Map not ready for export');
      return;
    }

    try {
      setIsExporting(true);
      toast.loading('Exporting map as JPEG...');

      const mapContainer = mapView.container;
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true
      });

      const link = document.createElement('a');
      link.download = `market_areas_map_${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss();
      toast.success('Map exported successfully');
    } catch (error) {
      console.error('JPEG export failed:', error);
      toast.error('Failed to export map: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export MXD (WebMap)
  const handleExportMXD = async () => {
    if (!mapView || !marketAreas.length) {
      toast.error('No map content to export');
      return;
    }

    try {
      setIsExporting(true);
      toast.loading('Preparing web map export...');

      // Create a web map JSON that ArcGIS Pro can import
      const webMapJson = {
        operationalLayers: marketAreas.map(area => ({
          id: area.id,
          title: area.name,
          visibility: true,
          opacity: 1,
          geometryType: area.ma_type === 'radius' ? 'esriGeometryPolygon' : undefined,
          features: area.ma_type === 'radius' 
            ? area.radius_points.map(point => ({
                geometry: point.geometry,
                attributes: {
                  name: area.name,
                  radius: point.radius
                }
              }))
            : area.locations.map(loc => ({
                geometry: loc.geometry,
                attributes: {
                  name: area.name,
                  id: loc.id
                }
              })),
          style: area.style_settings
        })),
        baseMap: {
          baseMapLayers: [
            {
              id: "defaultBasemap",
              title: "Default Basemap",
              url: "https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
              visibility: true
            }
          ]
        },
        initialExtent: mapView.extent.toJSON()
      };

      // Create and trigger download
      const blob = new Blob([JSON.stringify(webMapJson, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `market_areas_webmap_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss();
      toast.success('Web map exported successfully');
    } catch (error) {
      console.error('Web map export failed:', error);
      toast.error('Failed to export web map: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export Definitions
  const handleExportDefinitions = () => {
    if (!marketAreas.length) {
      toast.error('No market areas to export');
      return;
    }

    try {
      setIsExporting(true);
      toast.loading('Exporting market area definitions...');

      const definitions = marketAreas.map(area => ({
        id: area.id,
        name: area.name,
        type: area.ma_type,
        shortName: area.short_name,
        styleSettings: area.style_settings,
        geometry: area.geometry,
        locations: area.locations,
        radiusPoints: area.radius_points
      }));

      const blob = new Blob([JSON.stringify(definitions, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `market_areas_definitions_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss();
      toast.success('Definitions exported successfully');
    } catch (error) {
      console.error('Definitions export failed:', error);
      toast.error('Failed to export definitions: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Import MA JSON
  const handleImportMAJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        setIsExporting(true);
        toast.loading('Importing market areas...');

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const definitions = JSON.parse(e.target.result);
            
            // Validate the imported data
            if (!Array.isArray(definitions)) {
              throw new Error('Invalid import format');
            }

            // TODO: Implement the import logic using your API
            // This would typically involve calling your backend to create new market areas
            
            toast.dismiss();
            toast.success('Market areas imported successfully');
          } catch (error) {
            console.error('Import processing failed:', error);
            toast.error('Failed to process import: ' + error.message);
          }
        };

        reader.readAsText(file);
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import: ' + error.message);
      } finally {
        setIsExporting(false);
      }
    };

    input.click();
  };

  // Handle search input changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 3) {
        setSuggestions([]);
        setIsDropdownOpen(false);
        return;
      }

      try {
        const response = await axios.get("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest", {
          params: {
            f: 'json',
            text: searchQuery,
            maxSuggestions: 5,
            token: GEOCODING_API_KEY,
          },
        });

        setSuggestions(response.data.suggestions || []);
        setIsDropdownOpen(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setIsDropdownOpen(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, GEOCODING_API_KEY]);

  // Handle clicking outside the search input to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle selecting a suggestion
  const handleSelectSuggestion = async (suggestion) => {
    setSearchQuery(suggestion.text);
    setIsDropdownOpen(false);

    if (!mapView) {
      console.error("MapView instance is not available.");
      return;
    }

    try {
      const response = await axios.get("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates", {
        params: {
          f: 'json',
          singleLine: suggestion.text,
          maxLocations: 1,
          outFields: 'location',
          token: GEOCODING_API_KEY,
        },
      });

      if (response.data.candidates && response.data.candidates.length > 0) {
        const { x, y } = response.data.candidates[0].location;
        mapView.center = [x, y];
        mapView.zoom = 12;
        console.log(`Map centered at: [${x}, ${y}]`);
      } else {
        console.warn("No location found for the selected suggestion.");
      }
    } catch (error) {
      console.error("Error fetching location details:", error);
    }
  };

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
            <Menu.Button className="inline-flex items-center px-3 py-2 text-sm 
                                  text-gray-600 hover:text-gray-900 dark:text-gray-300 
                                  dark:hover:text-white">
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
              <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md 
                                   bg-white dark:bg-gray-700 shadow-lg ring-1 ring-black 
                                   ring-opacity-5 focus:outline-none">
                {/* Export Options */}
                <div className="py-1">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Export Options
                  </div>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleExportData}
                        disabled={isExporting}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <MapIcon className="mr-3 h-5 w-5" />
                        Export MXD
                      </button>
                    )}
                  </Menu.Item>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleExportDefinitions}
                        disabled={isExporting}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <DocumentArrowDownIcon className="mr-3 h-5 w-5" />
                        Export Definitions
                      </button>
                    )}
                  </Menu.Item>
                </div>

                {/* Import Options */}
                <div className="border-t border-gray-100 dark:border-gray-600">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Import Options
                  </div>
                  
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleImportMAJSON}
                        disabled={isExporting}
                        className={`${
                          active ? 'bg-gray-100 dark:bg-gray-600' : ''
                        } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200
                           ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <CodeBracketSquareIcon className="mr-3 h-5 w-5" />
                        Import MA JSON
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 max-w-2xl mx-4 relative" ref={searchInputRef}>
          <div className="relative">
            <MagnifyingGlassIcon 
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" 
            />
            <input
              type="text"
              placeholder="Search for zip, state, city, or county..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 pl-10 pr-3 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:border-green-500 dark:focus:border-green-400
                       focus:outline-none focus:ring-1 focus:ring-green-500"
            />

            {/* Search Suggestions Dropdown */}
            {isDropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 
                            border border-gray-300 dark:border-gray-600 rounded-md 
                            shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 
                             dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 
                             focus:outline-none"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
    </div>
  );
}