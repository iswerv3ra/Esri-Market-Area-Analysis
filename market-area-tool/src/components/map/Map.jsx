import { useEffect, useRef, useCallback } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Zoom from '@arcgis/core/widgets/Zoom';
import Home from '@arcgis/core/widgets/Home';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Locate from '@arcgis/core/widgets/Locate';
import { useMap } from '../../contexts/MapContext';

// Initialize the API key
const API_KEY = "AAPKaa7d8fe6258a4473ac0cfc276d4827fbLlKs8QW26nYdgEbty7iT9YqSgy4sCe66u74mNS8ZoCJfZe2e5AtQUyAZGO7vK0em";

// Debug API key status
console.log('ArcGIS API Key Status:', {
  exists: !!API_KEY,
  length: API_KEY?.length,
  preview: API_KEY ? `${API_KEY.substring(0, 8)}...` : 'Not found'
});

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

export default function MapComponent() {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const { setMapView, setActiveLayerType } = useMap();

  // Initialize ArcGIS configuration
  useEffect(() => {
    try {
      console.log('[Map] Initializing ArcGIS configuration');
      
      if (!API_KEY) {
        throw new Error('ArcGIS API key not found');
      }

      if (!esriConfig.apiKey) {
        esriConfig.apiKey = API_KEY;
        esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets/';
        
        // Configure CORS servers
        const requiredServers = [
          "route-api.arcgis.com",
          "services.arcgis.com",
          "basemaps.arcgis.com",
          "basemaps-api.arcgis.com",
          "tiles.arcgis.com",
          "*.arcgis.com",
          "geocode.arcgis.com",
          "geocode-api.arcgis.com"
        ];

        esriConfig.request.corsEnabledServers = [
          ...new Set([
            ...(esriConfig.request.corsEnabledServers || []),
            ...requiredServers
          ])
        ];

        esriConfig.request.timeout = 30000;
        esriConfig.request.retries = 3;

        console.log('[Map] Configuration complete:', {
          apiKey: !!esriConfig.apiKey,
          assetsPath: esriConfig.assetsPath,
          corsServers: esriConfig.request.corsEnabledServers
        });
      }
    } catch (error) {
      console.error('[Map] Configuration error:', error);
    }
  }, []);

  const goToLocation = useCallback(async (view, longitude, latitude, zoom = 12) => {
    try {
      console.log('[Map] Moving to location:', { longitude, latitude, zoom });
      await view.goTo({
        center: [longitude, latitude],
        zoom: zoom
      }, {
        duration: 1000,
        easing: 'ease-in-out'
      });
      console.log('[Map] Successfully moved to location');
    } catch (error) {
      console.error('[Map] Error moving to location:', error);
    }
  }, []);

  // Initialize map view
  useEffect(() => {
    if (!mapRef.current || viewRef.current) {
      console.log('[Map] Skipping initialization - already initialized or no container');
      return;
    }

    const initializeMap = async () => {
      try {
        console.log('[Map] Starting map initialization');

        const map = new Map({
          basemap: "arcgis-navigation",
          layers: []
        });

        console.log('[Map] Creating view');
        const view = new MapView({
          container: mapRef.current,
          map: map,
          zoom: 13,
          center: [-118.2437, 34.0522],
          padding: { top: 10, right: 10, bottom: 50, left: 10 },
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
              margin: { bottom: 50 }
            }
          }
        });

        console.log('[Map] Waiting for view to initialize');
        await view.when();
        viewRef.current = view;
        console.log('[Map] View initialized successfully');

        // Add widgets
        console.log('[Map] Adding widgets');
        const widgets = [
          { widget: new Zoom({ view }), position: "bottom-right" },
          { widget: new Home({ view }), position: "top-left" },
          { 
            widget: new BasemapToggle({
              view,
              nextBasemap: "arcgis-imagery"
            }),
            position: "bottom-right"
          },
          {
            widget: new Locate({
              view,
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

        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        console.log('[Map] Setting map view and layer type');
        setMapView(view);
        setActiveLayerType('streetsSample');

        // Handle geolocation
        if (navigator.geolocation) {
          console.log('[Map] Getting user location');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              goToLocation(view, position.coords.longitude, position.coords.latitude);
            },
            (error) => {
              console.warn('[Map] Geolocation error:', error);
              goToLocation(view, -118.2437, 34.0522);
            }
          );
        } else {
          console.warn('[Map] Geolocation not supported');
          goToLocation(view, -118.2437, 34.0522);
        }
      } catch (error) {
        console.error('[Map] Error in map initialization:', error);
      }
    };

    initializeMap();

    return () => {
      if (viewRef.current) {
        console.log('[Map] Cleaning up map view');
        viewRef.current.destroy();
        viewRef.current = null;
        setMapView(null);
      }
    };
  }, [setMapView, setActiveLayerType, goToLocation]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full relative"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <ZoomAlert />
    </div>
  );
}