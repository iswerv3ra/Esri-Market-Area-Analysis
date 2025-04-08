'use client';

import React, { useState, useEffect, useCallback } from 'react';

const PipelinePointStyleEditor = ({ config, onChange, onPreview }) => {
    // --- Local State Management ---
    const [pipelineConfig, setPipelineConfig] = useState({});
    const [statusColors, setStatusColors] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // --- Effect to Sync Local State with Incoming Config Prop ---
    // This runs ONLY when the config prop from the parent changes.
    useEffect(() => {
        console.log("PipelineEditor: Syncing local state with new config prop:", config);
        const initialConfig = config || {}; // Ensure config is an object
        setPipelineConfig(initialConfig);
        setStatusColors(
            initialConfig.statusColors || { // Use incoming or default colors
                "Under Construction": "#FF9800",
                "Approved": "#4CAF50",
                "Pending": "#2196F3",
                "Proposed": "#9C27B0",
                "Conceptual": "#607D8B",
                "Stalled": "#F44336",
                "Inactive": "#9E9E9E",
                "Pre-Leasing/Pre-Selling": "#FFEB3B",
                "Complete": "#00BCD4",
                "default": "#FFA500"
            }
        );
        setHasUnsavedChanges(false);
    }, [config]); // Dependency: Only the incoming config prop

    // --- Get Unique Statuses ---
    const getUniqueStatuses = useCallback(() => {
        const data = pipelineConfig?.customData?.data || [];
        const statusColumn = pipelineConfig?.statusColumn || 'Status';
        const statusSet = new Set();
        const defaultStatuses = [
            "Under Construction", "Approved", "Pending", "Proposed",
            "Conceptual", "Stalled", "Inactive", "Pre-Leasing/Pre-Selling", "Complete"
        ];
        defaultStatuses.forEach(status => statusSet.add(status));
        data.forEach(item => {
            if (item && item[statusColumn]) {
                statusSet.add(item[statusColumn]);
            }
        });
        return Array.from(statusSet);
    }, [pipelineConfig]); // Depends on pipelineConfig

    const statuses = getUniqueStatuses();

    // --- Event Handlers ---

    // Helper to update local config without calling onChange
    const updateLocalConfig = (newValues) => {
        const updatedLocalConfig = {
            ...pipelineConfig,
            ...newValues,
            type: 'pipe' // Always ensure type is correct
        };
        setPipelineConfig(updatedLocalConfig); // Update local state
        setHasUnsavedChanges(true);
    };

    // Helper to update local status colors without calling onChange
    const updateLocalStatusColors = (newStatusColors) => {
        setStatusColors(newStatusColors); // Update local state
        setHasUnsavedChanges(true);
    };

    const handleTitleChange = (e) => {
        updateLocalConfig({ title: e.target.value });
    };

    const handleStatusColumnChange = (e) => {
        updateLocalConfig({ statusColumn: e.target.value });
    };

    const handleColorChange = (status, color) => {
        const newColors = { ...statusColors, [status]: color };
        updateLocalStatusColors(newColors);
    };

    const handleSymbolStyleChange = (e) => {
        updateLocalConfig({
            symbol: { ...pipelineConfig.symbol, style: e.target.value }
        });
    };

    const handleSymbolSizeChange = (e) => {
        updateLocalConfig({
            symbol: { ...pipelineConfig.symbol, size: Number(e.target.value) }
        });
    };

    const handleOutlineWidthChange = (e) => {
        updateLocalConfig({
            symbol: {
                ...pipelineConfig.symbol,
                outline: { ...pipelineConfig.symbol?.outline, width: Number(e.target.value) }
            }
        });
    };

    const handleOutlineColorChange = (e) => {
        updateLocalConfig({
            symbol: {
                ...pipelineConfig.symbol,
                outline: { ...pipelineConfig.symbol?.outline, color: e.target.value }
            }
        });
    };

    // --- Handle Preview (doesn't submit changes) ---
    const handlePreview = () => {
        if (onPreview) {
            // Construct the config based on the current local state
            const configForPreview = {
                ...pipelineConfig,
                statusColors: statusColors,
                type: 'pipe'
            };
            console.log("PipelineEditor: Calling onPreview with:", configForPreview);
            onPreview(configForPreview);
        }
    };

    // --- Submit changes to parent ---
    const handleApplyChanges = () => {
        if (onChange) {
            const updatedConfig = {
                ...pipelineConfig,
                statusColors: statusColors,
                type: 'pipe'
            };
            console.log("PipelineEditor: Applying changes with:", updatedConfig);
            onChange(updatedConfig);
            setHasUnsavedChanges(false);
        }
    };

    // --- Render ---
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Pipeline Visualization Settings
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Configure how pipeline projects are displayed based on their status.
                </p>
            </div>

            {/* Basic configuration */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Map Title
                </label>
                <input
                    type="text"
                    value={pipelineConfig.title || ''}
                    onChange={handleTitleChange}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Status column configuration */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status Column Name
                </label>
                <input
                    type="text"
                    value={pipelineConfig.statusColumn || 'Status'}
                    onChange={handleStatusColumnChange}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Status Color Configuration */}
            <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Status Colors
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {statuses.map(status => (
                        <div key={status} className="flex items-center space-x-2">
                            <input
                                type="color"
                                value={statusColors[status] || '#CCCCCC'}
                                onChange={e => handleColorChange(status, e.target.value)}
                                className="h-8 w-8 cursor-pointer"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{status}</span>
                        </div>
                    ))}
                    {/* Default color */}
                    <div className="flex items-center space-x-2">
                        <input
                            type="color"
                            value={statusColors.default || '#FFA500'}
                            onChange={e => handleColorChange('default', e.target.value)}
                            className="h-8 w-8 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Default</span>
                    </div>
                </div>
            </div>

            {/* Symbol configuration */}
            <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">
                    Marker Style
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Shape */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Shape
                        </label>
                        <select
                            value={pipelineConfig.symbol?.style || 'circle'}
                            onChange={handleSymbolStyleChange}
                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="circle">Circle</option>
                            <option value="square">Square</option>
                            <option value="diamond">Diamond</option>
                            <option value="triangle">Triangle</option>
                            <option value="cross">Cross</option>
                        </select>
                    </div>

                    {/* Size */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Size
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="30"
                            value={pipelineConfig.symbol?.size || 12}
                            onChange={handleSymbolSizeChange}
                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    {/* Outline Width */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Outline Width
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            value={pipelineConfig.symbol?.outline?.width ?? 1}
                            onChange={handleOutlineWidthChange}
                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    {/* Outline Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Outline Color
                        </label>
                        <input
                            type="color"
                            value={pipelineConfig.symbol?.outline?.color || '#FFFFFF'}
                            onChange={handleOutlineColorChange}
                            className="block h-10 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end space-x-4">
                {hasUnsavedChanges && (
                    <div className="flex items-center text-sm text-amber-600 dark:text-amber-400 mr-auto">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                        </svg>
                        Unsaved changes
                    </div>
                )}
                <button
                    type="button"
                    onClick={handlePreview}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Preview Only
                </button>
                <button
                    type="button"
                    onClick={handleApplyChanges}
                    disabled={!hasUnsavedChanges}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                        hasUnsavedChanges 
                            ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                            : 'bg-blue-400 cursor-not-allowed'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                >
                    Apply Changes
                </button>
            </div>
        </div>
    );
};

export default PipelinePointStyleEditor;