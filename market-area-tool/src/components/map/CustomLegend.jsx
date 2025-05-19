// CustomLegend.jsx
import React from 'react';

const CustomLegend = ({ type, config }) => {
  if (!config) return null;
  
  // For pipeline visualization (status-based)
  if (type === 'pipe') {
    const statusColors = config.statusColors || {};
    const statuses = Object.keys(statusColors).filter(s => s !== 'default');
    
    return (
      <div className="bg-white border border-gray-300 rounded-md shadow-md p-3 max-w-xs">
        <h3 className="text-sm font-semibold mb-2 text-black">
          {config.title || 'Pipeline Projects'}
        </h3>
        <div className="space-y-1.5">
          {statuses.map(status => (
            <div key={status} className="flex items-center">
              <div 
                className="w-4 h-4 mr-2 rounded-full flex-shrink-0"
                style={{ 
                  backgroundColor: statusColors[status],
                  border: `${config.symbol?.outline?.width || 1}px solid ${config.symbol?.outline?.color || '#FFFFFF'}`
                }}
              />
              <span className="text-xs text-black truncate">{status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // For comp and custom visualization (value-based breaks)
  if (type === 'comp' || type === 'custom') {
    const classBreaks = config.classBreakInfos || [];
    const valueColumn = config.valueColumn || '';
    
    // Simple legend for non-class-breaks mode
    if (classBreaks.length === 0) {
      return (
        <div className="bg-white border border-gray-300 rounded-md shadow-md p-3 max-w-xs">
          <h3 className="text-sm font-semibold mb-2 text-black">
            {config.title || `${valueColumn || (type === 'comp' ? 'Comparable Properties' : 'Custom Data Points')}`}
          </h3>
          <div className="flex items-center">
            <div 
              className="w-4 h-4 mr-2 rounded-full flex-shrink-0"
              style={{ 
                backgroundColor: config.symbol?.color || '#800080',
                border: `${config.symbol?.outline?.width || 1}px solid ${config.symbol?.outline?.color || '#FFFFFF'}`
              }}
            />
            <span className="text-xs text-black">
              {config.legendInfo?.label || (type === 'comp' ? 'Comparable Property' : 'Data Point')}
            </span>
          </div>
        </div>
      );
    }
    
    // Class breaks legend with value column in the title
    return (
      <div className="bg-white border border-gray-300 rounded-md shadow-md p-3 max-w-xs">
        <h3 className="text-sm font-semibold mb-2 text-black">
          {valueColumn ? `${valueColumn} Values` : (config.title || 'Data Distribution')}
        </h3>
        <div className="space-y-1.5">
          {classBreaks.map((breakInfo, index) => (
            <div key={index} className="flex items-center">
              <div 
                className="w-4 h-4 mr-2 rounded-full flex-shrink-0"
                style={{ 
                  backgroundColor: breakInfo.symbol?.color || '#800080',
                  border: `${breakInfo.symbol?.outline?.width || 1}px solid ${breakInfo.symbol?.outline?.color || '#FFFFFF'}`
                }}
              />
              <span className="text-xs text-black truncate">
                {breakInfo.label || `${breakInfo.minValue} - ${breakInfo.maxValue === Infinity ? 'max' : breakInfo.maxValue}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
};

export default CustomLegend;