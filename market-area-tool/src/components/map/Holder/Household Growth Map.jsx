import { useEffect, useRef } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Legend from '@arcgis/core/widgets/Legend';

// Initialize the API key
const API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

const HouseholdGrowthMap = () => {
  const mapRef = useRef(null);

  useEffect(() => {
    // Initialize the ArcGIS API configuration
    esriConfig.apiKey = API_KEY;
    
    const initializeMap = async () => {
      try {
        // Define the renderer using class breaks for distinct legend entries
        const renderer = {
          type: "class-breaks",
          field: "HHGRW20CY",
          classBreakInfos: [
            {
              minValue: -10,
              maxValue: -0.5,
              symbol: {
                type: "simple-fill",
                color: "#6a51a3",  // Purple for lowest values
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "Less than -0.5%"
            },
            {
              minValue: -0.5,
              maxValue: -0.25,
              symbol: {
                type: "simple-fill",
                color: "#9e9ac8",  // Light purple
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "-0.5% to -0.25%"
            },
            {
              minValue: -0.25,
              maxValue: 0,
              symbol: {
                type: "simple-fill",
                color: "#cbc9e2",  // Very light purple
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "-0.25% to 0%"
            },
            {
              minValue: 0,
              maxValue: 0.25,
              symbol: {
                type: "simple-fill",
                color: "#fef0d9",  // Very light orange
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "0% to 0.25%"
            },
            {
              minValue: 0.25,
              maxValue: 0.5,
              symbol: {
                type: "simple-fill",
                color: "#fdcc8a",  // Light orange
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "0.25% to 0.5%"
            },
            {
              minValue: 0.5,
              maxValue: 1,
              symbol: {
                type: "simple-fill",
                color: "#fc8d59",  // Orange
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "0.5% to 1%"
            },
            {
              minValue: 1,
              maxValue: 1.5,
              symbol: {
                type: "simple-fill",
                color: "#e34a33",  // Light red
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "1% to 1.5%"
            },
            {
              minValue: 1.5,
              maxValue: 10,
              symbol: {
                type: "simple-fill",
                color: "#b30000",  // Deep red
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "More than 1.5%"
            }
          ]
        };

        // Create the feature layer for household growth data
        const growthLayer = new FeatureLayer({
          url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12",
          renderer: renderer,
          title: "Census Tracts (Esri USA 2024)\n2020-2024 Household Growth Rate",
          outFields: ["HHGRW20CY", "NAME", "STATE_NAME"],
          popupTemplate: {
            title: "Census Tract {NAME}",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "HHGRW20CY",
                    label: "Household Growth Rate (2020-2024)",
                    format: {
                      digitSeparator: true,
                      places: 2,
                      type: "number"
                    }
                  },
                  {
                    fieldName: "STATE_NAME",
                    label: "State"
                  }
                ]
              }
            ]
          },
          minScale: 300000
        });

        // Create the map
        const map = new Map({
          basemap: "arcgis-topographic",
          layers: [growthLayer]
        });

        // Create the view
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-117.83, 33.7175],
          zoom: 10,
          constraints: {
            minZoom: 2,
            maxZoom: 15
          },
          popup: {
            dockEnabled: true,
            dockOptions: {
              position: "auto",
              breakpoint: false
            }
          }
        });

        const legend = new Legend({
          view: view,
          layerInfos: [{
            layer: growthLayer,
            title: "Census Tracts (Esri USA 2024)\n2020-2024 Household Growth Rate",
            style: "classic"
          }]
        });
        
        // Position the legend in the bottom-left corner with a white background
        view.ui.add(legend, "bottom-left");

        // Style the legend container after it's added to the UI
        setTimeout(() => {
          const legendContainer = document.querySelector(".esri-legend");
          if (legendContainer) {
            legendContainer.style.backgroundColor = "white";
            legendContainer.style.border = "1px solid black";
            legendContainer.style.padding = "10px";
            legendContainer.style.margin = "10px";
            
            // Style legend text
            const legendItems = legendContainer.querySelectorAll(".esri-legend__layer-cell--info");
            legendItems.forEach(item => {
              item.style.fontSize = "16px";
              item.style.fontWeight = "900";
              item.style.color = "#000000";
            });

            // Make color swatches larger
            const swatches = legendContainer.querySelectorAll(".esri-legend__symbol");
            swatches.forEach(swatch => {
              swatch.style.width = "30px";
              swatch.style.height = "30px";
              swatch.style.margin = "5px";
            });
          }
        }, 100);

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, []);

  return (
    <div className="w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ 
          minHeight: "500px",
          backgroundColor: "#f5f5f5"
        }}
      />
    </div>
  );
};

export default HouseholdGrowthMap;