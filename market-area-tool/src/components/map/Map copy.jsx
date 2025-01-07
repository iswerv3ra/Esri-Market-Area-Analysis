import { useEffect, useRef, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Zoom from '@arcgis/core/widgets/Zoom';
import Home from '@arcgis/core/widgets/Home';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Locate from '@arcgis/core/widgets/Locate';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import { useMap } from '../../contexts/MapContext';

// Initialize the API key
const API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

// Orange County coordinates
const ORANGE_COUNTY_COORDS = {
  longitude: -117.8311,
  latitude: 33.7175,
  zoom: 10
};

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

export default function MapComponent({ onToggleList }) {
  const mapRef = useRef(null);
  const { setMapView } = useMap();
  const initCompleteRef = useRef(false);
  const [maps, setMaps] = useState([
    { id: 1, name: 'Core Map', active: true, mapView: null, mapInstance: null },
    { id: 2,name:'Heat Map', active: false, mapView: null, mapInstance: null },
    { id: 3, name: 'Dot Density',active: false, mapView: null, mapInstance: null },
  ]);
  const [editingTabId, setEditingTabId] = useState(null);
  const [activeMapId, setActiveMapId] = useState(1);

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

  const handleTabClick = (mapId) => {
    // Only switch if clicking a different tab
    if (mapId !== activeMapId) {
      setActiveMapId(mapId);
      setMaps(maps.map(map => ({
        ...map,
        active: map.id === mapId
      })));
    }
  };

  const addNewMap = () => {
    const newMapId = maps.length + 1;
    const newMap = {
      id: newMapId,
      name: `Map ${newMapId}`,
      active: false,
      mapView: null,
      mapInstance: null
    };
    setMaps([...maps, newMap]);
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

  const goToLocation = async (view, longitude, latitude, zoom = 12) => {
    try {
      await view.goTo({
        center: [longitude, latitude],
        zoom: zoom
      }, {
        duration: 1000,
        easing: 'ease-in-out'
      });
      console.log('[Map] Successfully moved to location:', [longitude, latitude]);
    } catch (error) {
      console.error('[Map] Error moving to location:', error);
    }
  };

  // Initialize or update map for active tab
  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      try {
        console.log('[Map] Starting map initialization');

        const map = new Map({
          basemap: "arcgis-navigation",
          layers: [],
        });

        const view = new MapView({
          container: mapRef.current,
          map: map,
          zoom: activeMapId === 1 ? 13 : ORANGE_COUNTY_COORDS.zoom,
          center: activeMapId === 1 ? undefined : [ORANGE_COUNTY_COORDS.longitude, ORANGE_COUNTY_COORDS.latitude],
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
          },
          popup: {
            dockEnabled: true,
            dockOptions: {
              position: "auto",
              breakpoint: false,
              margin: {
                bottom: 35
              }
            }
          }
        });

        view.when(() => {
          const attributionNode = view.ui.find("attribution");
          if (attributionNode) {
            view.ui.remove(attributionNode);
            view.ui.add(attributionNode, "manual");
            
            const attributionDiv = attributionNode.container;
            if (attributionDiv) {
              attributionDiv.style.position = 'fixed';
              attributionDiv.style.bottom = '0';
              attributionDiv.style.left = '0';
              attributionDiv.style.right = '0';
              attributionDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              attributionDiv.style.padding = '5px';
              attributionDiv.style.zIndex = '50';
              attributionDiv.style.fontSize = '11px';
              attributionDiv.style.textAlign = 'center';
            }
          }
        });

        console.log('[Map] Waiting for view to initialize');
        await view.when();
        if (!isMounted) return;
        console.log('[Map] View initialized successfully');

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

        // Center non-core maps on Orange County after initialization
        if (activeMapId !== 1) {
          await view.when();
          if (isMounted) {
            await goToLocation(view, ORANGE_COUNTY_COORDS.longitude, ORANGE_COUNTY_COORDS.latitude, ORANGE_COUNTY_COORDS.zoom);
          }
        }

        // Update the maps state with the new view
        setMaps(currentMaps => 
          currentMaps.map(m => 
            m.id === activeMapId 
              ? { ...m, mapView: view, mapInstance: map } 
              : m
          )
        );

        // Only set the main mapView context for the Core Map
        if (activeMapId === 1) {
          setMapView(view);
        }
        // Auto-toggle MA list after map initialization for Core Map only
        if (activeMapId === 1 && !initCompleteRef.current && onToggleList) {
          console.log('[Map] Triggering auto-toggle of MA list');
          setTimeout(() => {
            onToggleList();
            initCompleteRef.current = true;
          }, 1000);
        }

      } catch (error) {
        console.error('[Map] Error initializing map:', error);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      // Cleanup previous map view
      const currentMap = maps.find(m => m.id === activeMapId);
      if (currentMap?.mapView && !currentMap.mapView.destroyed) {
        currentMap.mapView.destroy();
      }
    };
  }, [activeMapId, setMapView, onToggleList]);

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
            onClick={addNewMap}
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
    </div>
  );
}