import esriConfig from '@arcgis/core/config';
import OAuthInfo from '@arcgis/core/identity/OAuthInfo';
import IdentityManager from '@arcgis/core/identity/IdentityManager';

// ArcGIS authentication configuration
const AUTH_CONFIG = {
  clientId: import.meta.env.VITE_ARCGIS_CLIENT_ID,
  clientSecret: import.meta.env.VITE_ARCGIS_CLIENT_SECRET,
  portalUrl: 'https://www.arcgis.com',
  authScope: 'geocode services',
};

// CORS-enabled servers that need to be registered
const ARCGIS_SERVERS = [
  "geocode-api.arcgis.com",
  "route-api.arcgis.com", 
  "services.arcgis.com",
  "basemaps.arcgis.com",
  "basemaps-api.arcgis.com",
  "tiles.arcgis.com",
  "www.arcgis.com"
];

// Default map configuration
export const DEFAULT_MAP_CONFIG = {
  basemap: 'streets-navigation-vector',
  center: [-98.5795, 39.8283], // Center of US
  zoom: 4,
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
  }
};

/**
 * Initializes OAuth authentication for ArcGIS services
 */
async function initializeAuthentication() {
  try {
    // Configure OAuth
    const oauthInfo = new OAuthInfo({
      appId: AUTH_CONFIG.clientId,
      portalUrl: AUTH_CONFIG.portalUrl,
      popup: false,
      popupCallbackUrl: window.location.origin + '/oauth-callback.html',
      scope: AUTH_CONFIG.authScope,
    });

    // Register the authentication details
    IdentityManager.registerOAuthInfos([oauthInfo]);

    // Check for existing credentials
    try {
      await IdentityManager.checkSignInStatus(AUTH_CONFIG.portalUrl + '/sharing');
    } catch {
      // If no existing credentials, sign in
      await IdentityManager.getCredential(AUTH_CONFIG.portalUrl + '/sharing');
    }

    console.log('[ArcGIS] Authentication initialized successfully');
    return true;
  } catch (error) {
    console.error('[ArcGIS] Authentication initialization failed:', error);
    throw error;
  }
}

/**
 * Configures CORS settings and general ArcGIS configuration
 */
function initializeCorsAndConfig() {
  try {
    // Set assets path
    esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets/';
    
    // Configure workers
    esriConfig.workers.loaderConfig = {
      paths: {
        'esri': 'https://js.arcgis.com/4.31/esri'
      }
    };

    // Initialize CORS servers array if needed
    if (!esriConfig.request.corsEnabledServers) {
      esriConfig.request.corsEnabledServers = [];
    }

    // Add all required CORS servers
    ARCGIS_SERVERS.forEach(server => {
      if (!esriConfig.request.corsEnabledServers.includes(server)) {
        esriConfig.request.corsEnabledServers.push(server);
      }
    });

    // Configure request parameters
    esriConfig.request.timeout = 30000;
    esriConfig.request.retries = 3;

    console.log('[ArcGIS] CORS and general configuration initialized');
    return true;
  } catch (error) {
    console.error('[ArcGIS] CORS and config initialization failed:', error);
    throw error;
  }
}

/**
 * Main initialization function for ArcGIS services
 */
export async function initializeArcGIS() {
  console.log('[ArcGIS] Starting initialization...');
  
  try {
    // Initialize CORS and general configuration
    initializeCorsAndConfig();
    
    // Initialize authentication
    await initializeAuthentication();
    
    console.log('[ArcGIS] Initialization completed successfully');
    return true;
  } catch (error) {
    console.error('[ArcGIS] Initialization failed:', error);
    throw error;
  }
}

/**
 * Signs out the current user and clears credentials
 */
export async function signOut() {
  try {
    await IdentityManager.destroyCredentials();
    console.log('[ArcGIS] Sign out successful');
    return true;
  } catch (error) {
    console.error('[ArcGIS] Sign out failed:', error);
    throw error;
  }
}

// Export configuration objects for use in other components
export { AUTH_CONFIG, ARCGIS_SERVERS };