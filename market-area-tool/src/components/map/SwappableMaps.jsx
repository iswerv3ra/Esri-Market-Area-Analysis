import { useEffect, useRef, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Legend from '@arcgis/core/widgets/Legend';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Zoom from '@arcgis/core/widgets/Zoom';
import Home from '@arcgis/core/widgets/Home';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Locate from '@arcgis/core/widgets/Locate';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';

const createLayers = () => {
  return {
    population: new FeatureLayer({
      url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
      renderer: {
        type: "dot-density",
        field: "TOTPOP_CY",
        dotValue: 100,
        dotBlending: "overlay",
        dotSize: 1,
        outline: {
          width: 0.5,
          color: [50, 50, 50, 0.2]
        },
        referenceScale: 577790,
        symbol: {
          type: "simple-marker",
          size: 1,
          color: "#E60049",
          style: "circle"
        },
      },
      title: "Population Density (2024)",
      minScale: 300000
    }),
    income: new FeatureLayer({
      url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
      renderer: {
        type: "class-breaks",
        field: "MEDHINC_CY",
        classBreakInfos: [
          { minValue: 0, maxValue: 50000, symbol: { type: "simple-fill", color: "#edf8e9", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "< $50,000" },
          { minValue: 50000, maxValue: 100000, symbol: { type: "simple-fill", color: "#bae4b3", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "$50,000 - $100,000" },
          { minValue: 100000, maxValue: 150000, symbol: { type: "simple-fill", color: "#74c476", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "$100,000 - $150,000" },
          { minValue: 150000, maxValue: 999999999, symbol: { type: "simple-fill", color: "#238b45", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "> $150,000" }
        ]
      },
      popupTemplate: {
        title: "Census Tract {NAME}",
        content: [{
          type: "fields",
          fieldInfos: [{
            fieldName: "MEDHINC_CY",
            label: "Median Household Income (2024)",
            format: {
              digitSeparator: true,
              places: 0,
              type: "currency"
            }
          }]
        }]
      },
      title: "Median Household Income (2024)",
      minScale: 300000
    }),
    growth: new FeatureLayer({
      url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
      renderer: {
        type: "class-breaks",
        field: "HHGRW20CY",
        classBreakInfos: [
          { minValue: -100, maxValue: 0, symbol: { type: "simple-fill", color: "#fee0d2", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "Negative Growth" },
          { minValue: 0, maxValue: 5, symbol: { type: "simple-fill", color: "#fc9272", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "0% - 5%" },
          { minValue: 5, maxValue: 10, symbol: { type: "simple-fill", color: "#de2d26", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "5% - 10%" },
          { minValue: 10, maxValue: 100, symbol: { type: "simple-fill", color: "#a50f15", outline: { width: 0.5, color: [50, 50, 50, 0.2] }}, label: "> 10%" }
        ]
      },
      popupTemplate: {
        title: "Census Tract {NAME}",
        content: [{
          type: "fields",
          fieldInfos: [{
            fieldName: "HHGRW20CY",
            label: "Household Growth Rate (2020-2024)",
            format: {
              digitSeparator: true,
              places: 2
            }
          }]
        }]
      },
      title: "Household Growth Rate (2020-2024)",
      minScale: 300000
    })
  };
};

const SwappableMaps = ({ visualizationType, onMapViewCreated }) => {
  const mapRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    let view = null;
    
    const initializeMap = async () => {
      try {
        const layers = createLayers();
        
        const map = new Map({
          basemap: "arcgis-navigation",
          layers: [layers[visualizationType]]
        });

        view = new MapView({
          container: mapRef.current,
          map: map,
          zoom: 13,
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

        viewRef.current = view;

        // Add widgets
        const widgets = [
          {
            widget: new Zoom({ view }),
            position: "top-left"
          },
          {
            widget: new Home({ view }),
            position: "top-left"
          },
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
          },
          {
            widget: new ScaleBar({
              view,
              unit: "imperial"
            }),
            position: "bottom-right"
          },
          {
            widget: new Legend({
              view,
              style: "card"
            }),
            position: "bottom-left"
          }
        ];

        widgets.forEach(({ widget, position }) => {
          view.ui.add(widget, position);
        });

        if (onMapViewCreated) {
          onMapViewCreated(view);
        }

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [onMapViewCreated]);

  // Handle visualization type changes
  useEffect(() => {
    if (viewRef.current) {
      const layers = createLayers();
      viewRef.current.map.layers.removeAll();
      viewRef.current.map.layers.add(layers[visualizationType]);
    }
  }, [visualizationType]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full relative"
      style={{ 
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
};

export default SwappableMaps;
