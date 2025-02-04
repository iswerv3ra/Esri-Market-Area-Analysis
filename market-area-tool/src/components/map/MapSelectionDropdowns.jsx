import React from 'react';

const MapSelectionDropdowns = ({ 
  selectedVariable,
  selectedVisualizationType,
  onVariableChange,
  onVisualizationTypeChange 
}) => {
  // Define variable categories and their options
  const variableOptions = [
    {
      category: "Demographics",
      options: [
        { value: "TOTPOP_CY", label: "Total Population", field: "TOTPOP_CY" },
        { value: "MEDAGE_CY", label: "Median Age", field: "MEDAGE_CY" },
        { value: "AVGHHSZ_CY", label: "Average Household Size", field: "AVGHHSZ_CY" }
      ]
    },
    {
      category: "Economic",
      options: [
        { value: "MEDHINC_CY", label: "Median Household Income", field: "MEDHINC_CY" },
        { value: "PCI_CY", label: "Per Capita Income", field: "PCI_CY" },
        { value: "UNEMPRT_CY", label: "Unemployment Rate", field: "UNEMPRT_CY" }
      ]
    },
    {
      category: "Housing",
      options: [
        { value: "MEDVAL_CY", label: "Median Home Value", field: "MEDVAL_CY" },
        { value: "AVGVAL_CY", label: "Average Home Value", field: "AVGVAL_CY" },
        { value: "HAI_CY", label: "Housing Affordability Index", field: "HAI_CY" }
      ]
    },
    {
      category: "Growth",
      options: [
        { value: "POPGRW20CY", label: "Population Growth Rate", field: "POPGRW20CY" },
        { value: "HHGRW20CY", label: "Household Growth Rate", field: "HHGRW20CY" }
      ]
    }
  ];

  const visualizationTypes = [
    { value: "choropleth", label: "Color-coded (Choropleth)" },
    { value: "dotDensity", label: "Dot Density" }
  ];

  return (
    <div className="flex items-center space-x-2">
      <select
        value={selectedVariable || ""}
        onChange={(e) => onVariableChange(e.target.value)}
        className="block w-64 rounded-md border border-gray-300 dark:border-gray-600 
                 bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
                 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
                 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select variable</option>
        {variableOptions.map((category) => (
          <optgroup key={category.category} label={category.category}>
            {category.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        value={selectedVisualizationType || ""}
        onChange={(e) => onVisualizationTypeChange(e.target.value)}
        disabled={!selectedVariable}
        className="block w-48 rounded-md border border-gray-300 dark:border-gray-600 
                 bg-white dark:bg-gray-700 py-2 px-3 text-sm font-medium 
                 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 
                 focus:ring-blue-500 focus:border-blue-500 
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select visualization</option>
        {visualizationTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MapSelectionDropdowns;