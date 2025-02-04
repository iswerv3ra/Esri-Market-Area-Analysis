import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { MapIcon, XMarkIcon } from '@heroicons/react/24/outline';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Zoom from '@arcgis/core/widgets/Zoom';
import Home from '@arcgis/core/widgets/Home';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Locate from '@arcgis/core/widgets/Locate';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { useMap } from '../../contexts/MapContext';

// Constants
const API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

const ORANGE_COUNTY_COORDS = {
  longitude: -117.8311,
  latitude: 33.7175,
  zoom: 10
};

const GEOGRAPHY_LEVELS = [
  { id: 'zip', name: 'ZIP Code' },
  { id: 'tract', name: 'Census Tract' },
  { id: 'blockgroup', name: 'Block Group' },
  { id: 'block', name: 'Census Block' },
  { id: 'county', name: 'County' }
];

const EXAMPLE_VARIABLES = [
  { 
    id: 'homevalue', 
    name: '2024 Average Home Value (Esri)',
    key: 'homevalue.AVGVAL_CY',
    type: 'numeric'
  },
  { 
    id: 'renter', 
    name: '2020 Renter Occupied Housing Units (U.S. Census)',
    key: 'KeyUSFacts.RENTER_CY',
    type: 'numeric'
  },
  { 
    id: 'income', 
    name: '2024 Average Household Income (Esri)',
    key: 'AtRisk.AVGHINC_CY',
    type: 'numeric'
  }
];

// Icon Components
const PencilIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);

const CheckIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// EditableTabName Component
const EditableTabName = ({ name, isEditing, onEdit, onSave, onCancel }) => {
  const [editedName, setEditedName] = useState(name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <input
          ref={inputRef}
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          className="px-1 py-0.5 text-sm bg-white dark:bg-gray-700 border border-blue-500 dark:border-blue-400 rounded focus:outline-none"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onSave(editedName);
            }
          }}
        />
        <span 
          role="button" 
          onClick={() => onSave(editedName)}
          className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 cursor-pointer"
        >
          <CheckIcon />
        </span>
        <span 
          role="button" 
          onClick={onCancel}
          className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
        >
          <XIcon />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <span>{name}</span>
      <span 
        role="button" 
        onClick={onEdit}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
      >
        <PencilIcon />
      </span>
    </div>
  );
};

// ZoomAlert Component
const ZoomAlert = () => {
  const { isOutsideZoomRange, zoomMessage } = useMap();

  if (!isOutsideZoomRange || !zoomMessage) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">{zoomMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// NewMapDialog Component
const NewMapDialog = ({
  isOpen,
  onClose,
  onCreateMap,
  marketAreas = []
}) => {
  const [mapName, setMapName] = useState('');
  const [selectedVariable, setSelectedVariable] = useState('');
  const [selectedGeography, setSelectedGeography] = useState('');
  const [selectedAreas, setSelectedAreas] = useState(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMapName('');
      setSelectedVariable('');
      setSelectedGeography('');
      setSelectedAreas(new Set());
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleSelectAllAreas = (e) => {
    if (e.target.checked) {
      setSelectedAreas(new Set(marketAreas.map(area => area.id)));
    } else {
      setSelectedAreas(new Set());
    }
  };

  const handleAreaSelection = (areaId) => {
    setSelectedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCreating) return;

    try {
      setIsCreating(true);

      const selectedMarketAreas = marketAreas.filter(area => 
        selectedAreas.has(area.id)
      );

      const variable = EXAMPLE_VARIABLES.find(v => v.id === selectedVariable);

      if (!variable) {
        console.error('No variable selected');
        return;
      }

      await onCreateMap({
        name: mapName,
        variable,
        geographyLevel: selectedGeography,
        marketAreas: selectedMarketAreas
      });

      onClose();
    } catch (error) {
      console.error('Map creation failed:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const isCreateDisabled = 
    isCreating || 
    !mapName || 
    !selectedVariable || 
    !selectedGeography || 
    selectedAreas.size === 0;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <MapIcon className="h-5 w-5" />
              Create New Map
            </Dialog.Title>
            <button
              onClick={onClose}
              disabled={isCreating}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Map Name
              </label>
              <input
                type="text"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                disabled={isCreating}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                         focus:outline-none focus:ring-blue-500 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter map name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Variable
              </label>
              <select
                value={selectedVariable}
                onChange={(e) => setSelectedVariable(e.target.value)}
                disabled={isCreating}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                         focus:outline-none focus:ring-blue-500 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a variable...</option>
                {EXAMPLE_VARIABLES.map((variable) => (
                  <option key={variable.id} value={variable.id}>
                    {variable.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Geography Level
              </label>
              <select
                value={selectedGeography}
                onChange={(e) => setSelectedGeography(e.target.value)}
                disabled={isCreating}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                         bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-blue-500 
                         focus:outline-none focus:ring-blue-500 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a geography level...</option>
                {GEOGRAPHY_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Market Areas
              </label>
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 max-h-40 overflow-y-auto">
                <label className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedAreas.size === marketAreas.length}
                    onChange={handleSelectAllAreas}
                    disabled={isCreating}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-white">
                    Select All
                  </span>
                </label>
                {marketAreas.map((area) => (
                  <label
                    key={area.id}
                    className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAreas.has(area.id)}
                      onChange={() => handleAreaSelection(area.id)}
                      disabled={isCreating}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      {area.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border 
                       border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 
                       dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isCreateDisabled}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white 
                       bg-blue-600 rounded-md hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       min-w-[80px] justify-center"
            >
              {isCreating ? 'Creating...' : 'Create Map'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// Main MapComponent
export default function MapComponent({ onToggleList, marketAreas = [] }) {
  const mapRef = useRef(null);
  const { setMapView } = useMap();
  const initCompleteRef = useRef(false);
  const coreMapRef = useRef(null);

  const [maps, setMaps] = useState([
    { 
      id: 1, 
      name: 'Core Map', 
      active: true, 
      mapView: null, 
      mapInstance: null,
      type: 'core'
    }
  ]);
  const [editingTabId, setEditingTabId] = useState(null);
  const [activeMapId, setActiveMapId] = useState(1);
  const [isNewMapDialogOpen, setIsNewMapDialogOpen] = useState(false);

  // Initialize ArcGIS configuration
  useEffect(() => {
    try {
      esriConfig.apiKey = API_KEY;
      esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets/';

      if (!esriConfig.request.corsEnabledServers) {
        esriConfig.request.corsEnabledServers = [];
      }

      const serversToAdd = [
        "geocode-api.arcgis.com",
        "route-api.arcgis.com",
        "services.arcgis.com",
        "basemaps.arcgis.com",
        "basemaps-api.arcgis.com",
        "tiles.arcgis.com"
      ];

      serversToAdd.forEach(server => {
        if (!esriConfig.request.corsEnabledServers.includes(server)) {
          esriConfig.request.corsEnabledServers.push(server);
        }
      });

      esriConfig.request.timeout = 30000;
      esriConfig.request.retries = 3;

      console.log("[Map] ArcGIS configuration initialized", {
        apiKey: !!API_KEY,
        corsServers: esriConfig.request.corsEnabledServers
      });
    } catch (error) {
      console.error("[Map] Error initializing ArcGIS configuration:", error);
    }
  }, []);

  const createHeatmapLayer = async (variable, geographyLevel, areas) => {
    try {
      console.log('[Map] Creating heatmap layer:', {
        variable,
        geographyLevel,
        areas
      });

      // Define color ramps based on variable type
      const colorStops = [
        { ratio: 0, color: "rgba(255, 255, 255, 0)" },
        { ratio: 0.2, color: "rgba(255, 255, 178, 0.7)" },
        { ratio: 0.4, color: "rgba(254, 204, 92, 0.7)" },
        { ratio: 0.6, color: "rgba(253, 141, 60, 0.7)" },
        { ratio: 0.8, color: "rgba(240, 59, 32, 0.7)" },
        { ratio: 1, color: "rgba(189, 0, 38, 0.7)" }
      ];

      // Extract the field name from the variable key
      const fieldName = variable.key.split('.')[1] || variable.key;

      // Build the URL for the feature service
      const baseUrl = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/";
      const serviceUrl = `${baseUrl}${variable.key.split('.')[0]}/FeatureServer/0`;

      // Create the feature layer
      const layer = new FeatureLayer({
        url: serviceUrl,
        outFields: ["*"],
        visible: true,
        opacity: 0.75,
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: "rgba(0, 0, 0, 0)",
            outline: {
              color: [128, 128, 128, 0.5],
              width: "0.5px"
            }
          },
          visualVariables: [
            {
              type: "color",
              field: fieldName,
              stops: colorStops.map(stop => ({
                value: stop.ratio * 100,
                color: stop.color
              }))
            }
          ]
        },
        popupTemplate: {
          title: "{NAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: fieldName,
                  label: variable.name,
                  format: {
                    digitSeparator: true,
                    places: 2
                  }
                }
              ]
            }
          ]
        }
      });

      // Add definition expression if areas are provided
      if (areas && areas.length > 0) {
        const areaIds = areas.map(area => area.id).join(',');
        layer.definitionExpression = `market_area_id IN (${areaIds})`;
      }

      console.log('[Map] Heatmap layer created successfully');
      return layer;
    } catch (error) {
      console.error('[Map] Error creating heatmap layer:', error);
      throw error;
    }
  };

  const handleCreateMap = async (mapData) => {
    try {
      console.log('[Map] Creating new map:', mapData);
      
      if (!mapData.marketAreas || mapData.marketAreas.length === 0) {
        console.error('[Map] No market areas selected');
        return;
      }

      const newMapId = maps.length + 1;
      
      // Create a new map instance
      const map = new Map({
        basemap: "arcgis-navigation",
        layers: []
      });

      // Create and add the heatmap layer
      const heatmapLayer = await createHeatmapLayer(
        mapData.variable,
        mapData.geographyLevel,
        mapData.marketAreas
      );
      
      if (!heatmapLayer) {
        console.error('[Map] Failed to create heatmap layer');
        return;
      }

      map.add(heatmapLayer);

      const newMap = {
        id: newMapId,
        name: mapData.name,
        active: false,
        mapView: null,
        mapInstance: map,
        type: 'heatmap',
        variable: mapData.variable,
        geographyLevel: mapData.geographyLevel,
        marketAreas: mapData.marketAreas,
        layer: heatmapLayer
      };

      setMaps(prevMaps => [...prevMaps, newMap]);
      setIsNewMapDialogOpen(false);

      // Switch to the new map
      setTimeout(() => {
        handleTabClick(newMapId);
      }, 100);

      console.log('[Map] New map created successfully:', newMap);
    } catch (error) {
      console.error('[Map] Error creating new map:', error);
    }
  };

  const handleTabClick = (mapId) => {
    if (mapId !== activeMapId) {
      setActiveMapId(mapId);
      setMaps(maps.map(map => ({
        ...map,
        active: map.id === mapId
      })));
    }
  };

  const handleEditTab = (mapId) => {
    setEditingTabId(mapId);
  };

  const handleSaveTab = (mapId, newName) => {
    setMaps(maps.map(map => 
      map.id === mapId ? { ...map, name: newName } : map
    ));
    setEditingTabId(null);
  };

  const handleCancelEdit = () => {
    setEditingTabId(null);
  };

  // Initialize core map
  useEffect(() => {
    const initializeCoreMap = async () => {
      try {
        if (!coreMapRef.current) {
          const map = new Map({
            basemap: "arcgis-navigation"
          });

          const view = new MapView({
            container: mapRef.current,
            map: map,
            zoom: 13,
            center: [ORANGE_COUNTY_COORDS.longitude, ORANGE_COUNTY_COORDS.latitude],
            padding: {
              top: 10,
              right: 10,
              bottom: 35,
              left: 10
            },
            constraints: {
              snapToZoom: false,
              rotationEnabled: false,
              minZoom: 2,
              maxZoom: 20,
              zoomFactor: 1.1
            },
            ui: {
              components: ["attribution"]
            }
          });

          await view.when();
          coreMapRef.current = { map, view };
          
          // Set up widgets for core map
          const widgets = [
            {
              widget: new Zoom({ view: view }),
              position: "top-left"
            },
            {
              widget: new Home({ view: view }),
              position: "top-left"
            },
            {
              widget: new BasemapToggle({
                view: view,
                nextBasemap: "arcgis-imagery"
              }),
              position: "bottom-right"
            },
            {
              widget: new Locate({
                view: view,
                useHeadingEnabled: false,
                goToOverride: (view, options) => {
                  options.target.scale = 1500;
                  return view.goTo(options.target, {
                    duration: 1000,
                    easing: 'ease-in-out'
                  });
                }
              }),
              position: "top-left"
            },
            {
              widget: new ScaleBar({
                view: view,
                unit: "imperial"
              }),
              position: "bottom-right"
            }
          ];

          widgets.forEach(({ widget, position }) => {
            view.ui.add(widget, position);
          });

          // Update maps state with core map
          setMaps(currentMaps => 
            currentMaps.map(m => 
              m.id === 1 ? { ...m, mapView: view, mapInstance: map } : m
            )
          );
          
          setMapView(view);

          if (!initCompleteRef.current && onToggleList) {
            setTimeout(() => {
              onToggleList();
              initCompleteRef.current = true;
            }, 1000);
          }
        }
      } catch (error) {
        console.error("[Map] Error initializing core map:", error);
      }
    };

    initializeCoreMap();
  }, [onToggleList, setMapView]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center">
          <div className="flex space-x-2 overflow-x-auto">
            {maps.map((map) => (
              <button
                key={map.id}
                onClick={() => handleTabClick(map.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none transition-colors ${
                  map.active
                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <EditableTabName
                  name={map.name}
                  isEditing={editingTabId === map.id}
                  onEdit={() => handleEditTab(map.id)}
                  onSave={(newName) => handleSaveTab(map.id, newName)}
                  onCancel={handleCancelEdit}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsNewMapDialogOpen(true)}
            className="ml-2 px-3 py-1 text-sm bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none transition-colors"
          >
            + New Map
          </button>
        </div>
      </div>
      <div className="flex-grow relative">
        {maps.map((map) => (
          <div
            key={map.id}
            className={`absolute inset-0 ${map.active ? 'block' : 'hidden'}`}
          >
            {map.active && (
              <div 
                ref={mapRef}
                className="w-full h-full relative"
                style={{ 
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <ZoomAlert />
              </div>
            )}
          </div>
        ))}
      </div>

      <NewMapDialog
        isOpen={isNewMapDialogOpen}
        onClose={() => setIsNewMapDialogOpen(false)}
        onCreateMap={handleCreateMap}
        marketAreas={marketAreas}
      />
    </div>
  );
}