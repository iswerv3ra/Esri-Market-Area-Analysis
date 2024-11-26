// src/components/Map/Map.jsx

import { useEffect, useRef } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Zoom from '@arcgis/core/widgets/Zoom';
import Home from '@arcgis/core/widgets/Home';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Locate from '@arcgis/core/widgets/Locate';
// Removed the local CSS import
// import '@arcgis/core/assets/esri/themes/light/main.css';
import { useMap } from '../../contexts/MapContext';

// Initialize the API key
const API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

// Create ZoomAlert component inline since it's specific to the map
const ZoomAlert = () => {
  const { isOutsideZoomRange, zoomMessage } = useMap();

  if (!isOutsideZoomRange || !zoomMessage) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            {/* Warning Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              {zoomMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MapComponent() {
  const mapRef = useRef(null);
  const { setMapView, setActiveLayerType } = useMap(); // Destructure setActiveLayerType

  // Initialize ArcGIS configuration
  useEffect(() => {
    try {
      // Set the API key
      esriConfig.apiKey = API_KEY;

      // Set the assetsPath to use CDN
      esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets/';

      // Initialize corsEnabledServers array if it doesn't exist
      if (!esriConfig.request.corsEnabledServers) {
        esriConfig.request.corsEnabledServers = [];
      }

      // Add the required servers
      const serversToAdd = [
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

      // Set other configurations
      esriConfig.request.timeout = 30000; // 30 seconds timeout
      esriConfig.request.retries = 3;

      console.log("[Map] ArcGIS configuration initialized", {
        apiKey: !!API_KEY,
        corsServers: esriConfig.request.corsEnabledServers
      });
    } catch (error) {
      console.error("[Map] Error initializing ArcGIS configuration:", error);
    }
  }, []);

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

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const initializeMap = async () => {
      try {
        console.log('[Map] Starting map initialization');

        // Create the map with a standard basemap
        const map = new Map({
          basemap: "arcgis-navigation", // Use the navigation basemap
          layers: [],
        });

        // Create the map view
        const view = new MapView({
          container: mapRef.current,
          map: map,
          zoom: 13,
          center: [-118.2437, 34.0522], // Default to Los Angeles
          padding: {
            top: 10,
            right: 10,
            bottom: 50,
            left: 10
          },
          constraints: {
            snapToZoom: false,
            rotationEnabled: false,
            minZoom: 2,
            maxZoom: 20
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
                bottom: 50
              }
            }
          }
        });

        console.log('[Map] Waiting for view to initialize');
        await view.when();
        if (!isMounted) return; // Prevent state updates if unmounted
        console.log('[Map] View initialized successfully');

        // Add widgets
        const widgets = [
          {
            widget: new Zoom({
              view: view
            }),
            position: "bottom-right"
          },
          {
            widget: new Home({
              view: view
            }),
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
          }
        ];

        // Add all widgets to the view
        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        // Set the map view in context
        setMapView(view);

        // Set the active layer to 'streetsSample' for testing
        setActiveLayerType('streetsSample'); // Use the sample layer first

        // Handle geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              goToLocation(view, longitude, latitude);
            },
            (error) => {
              console.warn('[Map] Geolocation error:', error.message);
              goToLocation(view, -118.2437, 34.0522); // Default to LA
            }
          );
        } else {
          console.warn('[Map] Geolocation not supported');
          goToLocation(view, -118.2437, 34.0522); // Default to LA
        }

      } catch (error) {
        console.error('[Map] Error initializing map:', error);
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      isMounted = false;
      if (mapRef.current) {
        console.log('[Map] Cleaning up map view');
        setMapView(null);
      }
    };
  }, []); // **IMPORTANT:** Empty dependency array to run only once

  return (
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
  );
}
