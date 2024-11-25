import esriConfig from '@arcgis/core/config';

// Configure the API key and other settings
export function initializeArcGIS() {
  esriConfig.apiKey = "AAPKaa7d8fe6258a4473ac0cfc276d4827fbLlKs8QW26nYdgEbty7iT9YqSgy4sCe66u74mNS8ZoCJfZe2e5AtQUyAZGO7vK0em";
  
  // Set assets path
  esriConfig.assetsPath = "/assets";
  
  // Configure workers
  esriConfig.workers.loaderConfig = {
    paths: {
      'esri': 'https://js.arcgis.com/4.27/esri'
    }
  };
}

export const defaultMapConfig = {
  basemap: 'streets-navigation-vector',
  center: [-98.5795, 39.8283], // Center of US
  zoom: 4
};