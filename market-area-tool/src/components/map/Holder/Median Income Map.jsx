import { useEffect, useRef } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Legend from '@arcgis/core/widgets/Legend';

// Initialize the API key
const API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurJFjeEBoGOztYNmDEDsJ91F0pjIxcWhHJrxnWXtWOEKMti287Bs6E1oNcGDpDlRxshH3qqosM5FZAoRGU6SczbuurBtsXOXIef39Eia3J11BSBE1hPNla2S6mRKAsuSAGM6qXNsg-A-B4EsyQJQ2659AVgnbyISk4-3bqAcXSGdxd48agv5GOufGX382QIckdN21BhJdzEP3v3Xt1nKug1Y.AT1_ioxXSAbW";

const IncomeMap = () => {
  const mapRef = useRef(null);

  useEffect(() => {
    // Initialize the ArcGIS API configuration
    esriConfig.apiKey = API_KEY;
    
    const initializeMap = async () => {
      try {
        // Define the renderer using class breaks for distinct legend entries
        const renderer = {
          type: "class-breaks",
          field: "MEDHINC_CY",
          classBreakInfos: [
            {
              minValue: 0,
              maxValue: 50000,
              symbol: {
                type: "simple-fill",
                color: "#9e9ac8",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$50K or Less"
            },
            {
              minValue: 50000,
              maxValue: 75000,
              symbol: {
                type: "simple-fill",
                color: "#cde0c4",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$50K - $75K"
            },
            {
              minValue: 75000,
              maxValue: 100000,
              symbol: {
                type: "simple-fill",
                color: "#fff7bc",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$75K - $100K"
            },
            {
              minValue: 100000,
              maxValue: 125000,
              symbol: {
                type: "simple-fill",
                color: "#fdd49e",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$100K - $125K"
            },
            {
              minValue: 125000,
              maxValue: 150000,
              symbol: {
                type: "simple-fill",
                color: "#fc8d59",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$125K - $150K"
            },
            {
              minValue: 150000,
              maxValue: 500000,
              symbol: {
                type: "simple-fill",
                color: "#d7301f",
                outline: {
                  color: [50, 50, 50, 0.2],
                  width: "0.5px"
                }
              },
              label: "$150K or More"
            }
          ]
        };

        // Create the feature layer for income data
        const incomeLayer = new FeatureLayer({
          url: "https://services8.arcgis.com/peDZJliSvYims39Q/ArcGIS/rest/services/Esri_Updated_Demographics_Variables_2024/FeatureServer/12", // Using census tract layer
          renderer: renderer,
          title: "Median Household Income by Census Tract (2024)",
          outFields: ["MEDHINC_CY", "NAME", "STATE_NAME"],
          popupTemplate: {
            title: "Census Tract {NAME}",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "MEDHINC_CY",
                    label: "Median Household Income (2024)",
                    format: {
                      digitSeparator: true,
                      places: 0,
                      type: "currency"
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
          minScale: 300000 // Set a minimum scale to improve performance with tract data
        });

        // Create the map
        const map = new Map({
          basemap: "arcgis-topographic",
          layers: [incomeLayer]
        });

        // Create the view
        const view = new MapView({
          container: mapRef.current,
          map: map,
          center: [-117.83, 33.7175],
          zoom: 14,
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
            layer: incomeLayer,
            title: "Census Tracts (Esri USA 2024)\n2024 Median Household Income",
            style: "classic"  // Use classic style for vertical legend layout
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
              item.style.fontWeight = "900";  // Maximum boldness
              item.style.color = "#000000";   // Pure black for maximum contrast
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

export default IncomeMap;