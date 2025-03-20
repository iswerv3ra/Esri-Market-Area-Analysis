import requests
import json
import matplotlib.pyplot as plt

def get_metro_division_geometry(metro_division_name):
    """
    Retrieve geometry for a specific Metro Division
    """
    url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/95/query"
    
    params = {
        "where": f"NAME = '{metro_division_name}'",
        "outFields": "*",
        "returnGeometry": "true",
        "geometryType": "esriGeometryPolygon",
        "spatialRel": "esriSpatialRelIntersects",
        "outSR": "4326",
        "f": "json"
    }
    
    response = requests.get(url, params=params, timeout=30)
    data = response.json()
    
    if data.get("features"):
        feature = data["features"][0]
        return {
            "attributes": feature.get("attributes", {}),
            "geometry": feature.get("geometry", {})
        }
    return None

def plot_metro_division_geometry(metro_division_name):
    """
    Plot the geometry of a Metro Division
    """
    # Retrieve geometry
    metro_data = get_metro_division_geometry(metro_division_name)
    
    if not metro_data:
        print(f"No geometry found for {metro_division_name}")
        return
    
    # Extract coordinates
    geometry = metro_data["geometry"]
    
    if "rings" in geometry:
        # Plot the polygon
        plt.figure(figsize=(10, 8))
        
        for ring in geometry["rings"]:
            # Separate longitude and latitude
            lons = [coord[0] for coord in ring]
            lats = [coord[1] for coord in ring]
            
            plt.plot(lons, lats)
        
        plt.title(f"Geometry of {metro_division_name}")
        plt.xlabel("Longitude")
        plt.ylabel("Latitude")
        plt.grid(True)
        
        # Compute and print centroid
        centroid_lon = metro_data["attributes"].get("CENTLON")
        centroid_lat = metro_data["attributes"].get("CENTLAT")
        
        if centroid_lon and centroid_lat:
            plt.plot(float(centroid_lon), float(centroid_lat), 'ro', label='Centroid')
            plt.legend()
        
        plt.show()
    else:
        print("No ring geometry found")

# Example usage
metro_division = "Anaheim-Santa Ana-Irvine, CA Metro Division"
plot_metro_division_geometry(metro_division)

# Print additional metadata
metro_data = get_metro_division_geometry(metro_division)
if metro_data:
    print("\nMetro Division Metadata:")
    for key, value in metro_data["attributes"].items():
        print(f"{key}: {value}")