// src/pages/Presets.jsx
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Import from enrichment service
import { enrichmentService, analysisCategories, getAllVariables } from '../services/enrichmentService';

// Market area types definition
const marketAreaTypes = [
  { value: 'radius', label: 'Radius' },
  { value: 'zip', label: 'Zip Code' },
  { value: 'county', label: 'County' },
  { value: 'place', label: 'Place' },
  { value: 'tract', label: 'Census Tract' },
  { value: 'block', label: 'Census Block' },
  { value: 'blockgroup', label: 'Census Block Group' },
  { value: 'cbsa', label: 'CBSA' },
  { value: 'state', label: 'State' },
  { value: 'usa', label: 'USA' },
];

const DEFAULT_STYLE = {
  fillColor: '#0078D4',
  fillOpacity: 0.3,
  borderColor: '#0078D4',
  borderWidth: 2,
};

/**
 * Modal Component
 * A reusable modal component that handles its own visibility and accessibility features.
 */
const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          aria-label="Close Modal"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="p-6">
          <h2 id="modal-title" className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </h2>
          <div className="max-h-96 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

/**
 * StylePresetModalContent Component
 * Handles viewing and editing of Style Presets within the modal.
 */
const StylePresetModalContent = ({ preset, updatePreset, closeModal }) => {
  const [editableStyles, setEditableStyles] = useState(() =>
    JSON.parse(JSON.stringify(preset.styles))
  );

  const handleEdit = (type, property, value) => {
    setEditableStyles((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [property]: value,
      },
    }));
  };

  const saveChanges = () => {
    updatePreset(preset.id, editableStyles);
    toast.success('Style preset updated');
    closeModal();
  };

  return (
    <div>
      <p>
        <strong>Name:</strong> {preset.name}
      </p>
      <h4 className="mt-4 mb-2 font-medium">Styles:</h4>
      <div className="space-y-4">
        {marketAreaTypes.map((typeItem) => (
          <div key={typeItem.value} className="mb-3">
            <p className="font-semibold">{typeItem.label}</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Fill Color */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Fill Color:</span>
                <input
                  type="color"
                  value={editableStyles[typeItem.value].fillColor}
                  onChange={(e) => handleEdit(typeItem.value, 'fillColor', e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer"
                />
                <span
                  className="h-8 w-8 rounded"
                  style={{ backgroundColor: editableStyles[typeItem.value].fillColor }}
                ></span>
              </div>

              {/* Fill Opacity */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Fill Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editableStyles[typeItem.value].fillOpacity * 100}
                  onChange={(e) =>
                    handleEdit(typeItem.value, 'fillOpacity', Number(e.target.value) / 100)
                  }
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                  {Math.round(editableStyles[typeItem.value].fillOpacity * 100)}%
                </span>
              </div>

              {/* Border Color */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Border Color:</span>
                <input
                  type="color"
                  value={editableStyles[typeItem.value].borderColor}
                  onChange={(e) => handleEdit(typeItem.value, 'borderColor', e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer"
                />
                <span
                  className="h-8 w-8 rounded"
                  style={{ backgroundColor: editableStyles[typeItem.value].borderColor }}
                ></span>
              </div>

              {/* Border Width */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Border Width:</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={editableStyles[typeItem.value].borderWidth}
                  onChange={(e) =>
                    handleEdit(typeItem.value, 'borderWidth', Number(e.target.value))
                  }
                  className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">px</span>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Preview:</span>
                <div
                  className="h-8 w-16 rounded border-2 relative overflow-hidden"
                  style={{
                    backgroundColor: editableStyles[typeItem.value].fillColor,
                    opacity: editableStyles[typeItem.value].fillOpacity,
                    borderColor: editableStyles[typeItem.value].borderColor,
                    borderWidth: `${editableStyles[typeItem.value].borderWidth}px`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Preview
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Changes Button */}
      <button
        onClick={saveChanges}
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        Save Changes
      </button>
    </div>
  );
};

/**
 * VariablePresetModalContent Component
 * Handles viewing and managing Variable Presets within the modal.
 */
const VariablePresetModalContent = ({ preset, removeVariable, closeModal }) => {
  const getVariableLabel = (variableId) => {
    for (const category of Object.values(analysisCategories)) {
      const variable = category.variables.find((v) => v.id === variableId);
      if (variable) {
        return variable.label;
      }
    }
    return variableId; // Return the ID if no label is found
  };

  return (
    <div>
      <p>
        <strong>Name:</strong> {preset.name}
      </p>
      <h4 className="mt-4 mb-2 font-medium">Variables:</h4>
      <ul className="list-disc list-inside max-h-60 overflow-y-auto space-y-2">
        {preset.variables.map((varId) => (
          <li key={varId} className="flex items-center justify-between">
            <span>{getVariableLabel(varId)}</span>
            <button
              onClick={() => removeVariable(varId)}
              className="text-red-600 hover:text-red-700"
              title="Remove Variable"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * VariablesPanel Component
 * Manages the selection of analysis variables with search and expand/collapse functionalities.
 */
const VariablesPanel = ({ selectedVariables, setSelectedVariables, searchTerm, setSearchTerm }) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  };

  const toggleAllInCategory = (variables) => {
    setSelectedVariables((prevSelected) => {
      const newSelected = new Set(prevSelected);
      const allSelected = variables.every((v) => newSelected.has(v.id));

      variables.forEach((variable) => {
        if (allSelected) {
          newSelected.delete(variable.id);
        } else {
          newSelected.add(variable.id);
        }
      });

      return newSelected;
    });
  };

  const shouldShowCategory = (category) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return category.variables.some(
      (variable) =>
        variable.id.toLowerCase().includes(searchLower) ||
        variable.label.toLowerCase().includes(searchLower)
    );
  };

  const shouldShowVariable = (variable) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      variable.id.toLowerCase().includes(searchLower) ||
      variable.label.toLowerCase().includes(searchLower)
    );
  };

  // Handler for Global Select All
  const handleGlobalSelectAll = () => {
    const allVariableIds = getAllVariables();
    const allSelected = allVariableIds.every((id) => selectedVariables.has(id));
    if (allSelected) {
      setSelectedVariables(new Set());
      toast.success('All variables deselected');
    } else {
      setSelectedVariables(new Set(allVariableIds));
      toast.success('All variables selected');
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search variables..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 pl-10 
                     shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          {/* Global Select All Button */}
          <button
            onClick={handleGlobalSelectAll}
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            {getAllVariables().every((id) => selectedVariables.has(id)) ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-auto p-4">
        {Object.entries(analysisCategories).map(([categoryId, category]) => {
          if (!shouldShowCategory(category)) return null;

          const isExpanded = expandedCategories.has(categoryId);
          const filteredVariables = category.variables.filter(shouldShowVariable);

          if (filteredVariables.length === 0) return null;

          return (
            <div key={categoryId} className="mb-4">
              {/* Category Header */}
              <div
                className="flex items-center gap-2 py-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 
                         rounded cursor-pointer"
                onClick={() => toggleCategory(categoryId)}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
                <span className="font-medium">{category.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllInCategory(category.variables);
                  }}
                  className="ml-auto text-sm text-blue-600 hover:text-blue-700"
                >
                  {category.variables.every((v) => selectedVariables.has(v.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Variables in Category */}
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {filteredVariables.map((variable) => (
                    <label
                      key={variable.id}
                      className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 
                               rounded-md cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVariables.has(variable.id)}
                        onChange={(e) => {
                          setSelectedVariables((prevSelected) => {
                            const newSelected = new Set(prevSelected);
                            if (e.target.checked) {
                              newSelected.add(variable.id);
                            } else {
                              newSelected.delete(variable.id);
                            }
                            return newSelected;
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{variable.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{variable.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * StyleEditor Component
 * Allows users to customize styles for different market area types.
 */
const StyleEditor = ({ currentStyle, setCurrentStyle }) => {
  const handleStyleChange = (type, property, value) => {
    setCurrentStyle((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [property]: value,
      },
    }));
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid gap-4">
        {marketAreaTypes.map((type) => (
          <div key={type.value} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">{type.label}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">Fill Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={currentStyle[type.value].fillColor}
                    onChange={(e) => handleStyleChange(type.value, 'fillColor', e.target.value)}
                    className="h-8 w-8 rounded cursor-pointer"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentStyle[type.value].fillOpacity * 100}
                    onChange={(e) =>
                      handleStyleChange(type.value, 'fillOpacity', Number(e.target.value) / 100)
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                    {Math.round(currentStyle[type.value].fillOpacity * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">Border</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={currentStyle[type.value].borderColor}
                    onChange={(e) => handleStyleChange(type.value, 'borderColor', e.target.value)}
                    className="h-8 w-8 rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={currentStyle[type.value].borderWidth}
                    onChange={(e) =>
                      handleStyleChange(type.value, 'borderWidth', Number(e.target.value))
                    }
                    className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">px</span>
                </div>
              </div>

              {/* Preview */}
              <div
                className="h-16 w-full rounded-lg border-2 relative overflow-hidden"
                style={{
                  backgroundColor: currentStyle[type.value].fillColor,
                  opacity: currentStyle[type.value].fillOpacity,
                  borderColor: currentStyle[type.value].borderColor,
                  borderWidth: `${currentStyle[type.value].borderWidth}px`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  Preview
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Presets Component
 * The main component that brings together Style Editor, Variables Selector, Saved Presets, and Modal functionalities.
 */
export default function Presets() {
  // Style Presets State
  const [stylePresets, setStylePresets] = useState(() => {
    const saved = localStorage.getItem('savedStylePresets');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentStyle, setCurrentStyle] = useState(() => {
    const saved = localStorage.getItem('currentStylePreset');
    try {
      return saved
        ? JSON.parse(saved)
        : marketAreaTypes.reduce((acc, type) => {
            acc[type.value] = { ...DEFAULT_STYLE }; // Deep clone
            return acc;
          }, {});
    } catch {
      return marketAreaTypes.reduce((acc, type) => {
        acc[type.value] = { ...DEFAULT_STYLE };
        return acc;
      }, {});
    }
  });

  // Variable Presets State
  const [variablePresets, setVariablePresets] = useState(() => {
    const saved = localStorage.getItem('savedVariablePresets');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedVariables, setSelectedVariables] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [newPresetName, setNewPresetName] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState(null);

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('savedStylePresets', JSON.stringify(stylePresets));
    localStorage.setItem('currentStylePreset', JSON.stringify(currentStyle));
    localStorage.setItem('savedVariablePresets', JSON.stringify(variablePresets));
  }, [stylePresets, currentStyle, variablePresets]);

  // Style Preset Handlers
  const handleSaveStylePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    // Check for duplicate preset names
    if (
      stylePresets.some(
        (preset) => preset.name.toLowerCase() === newPresetName.trim().toLowerCase()
      )
    ) {
      toast.error('A style preset with this name already exists');
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      styles: { ...currentStyle },
    };

    setStylePresets((prev) => [...prev, newPreset]);
    setNewPresetName('');
    toast.success('Style preset saved');
  };

  // Variable Preset Handlers
  const handleSaveVariablePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    // Check for duplicate preset names
    if (
      variablePresets.some(
        (preset) => preset.name.toLowerCase() === newPresetName.trim().toLowerCase()
      )
    ) {
      toast.error('A variable preset with this name already exists');
      return;
    }

    if (selectedVariables.size === 0) {
      toast.error('Please select at least one variable');
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      variables: Array.from(selectedVariables),
    };

    setVariablePresets((prev) => [...prev, newPreset]);
    setNewPresetName('');
    toast.success('Variable preset saved');
  };

  /**
   * Function to get variable label from ID
   * If labels are needed instead of just IDs, you can use this function within VariablePresetModalContent.
   */
  const getVariableLabel = (variableId) => {
    for (const category of Object.values(analysisCategories)) {
      const variable = category.variables.find((v) => v.id === variableId);
      if (variable) {
        return variable.label;
      }
    }
    return variableId; // Return the ID if no label is found
  };

  /**
   * Function to open the modal with preset details
   * Depending on the type ('style' or 'variable'), it sets the appropriate content.
   */
  const openPresetModal = (preset, type) => {
    setModalTitle(`${type === 'style' ? 'Style' : 'Variable'} Preset Details`);
    if (type === 'style') {
      setModalContent(
        <StylePresetModalContent
          preset={preset}
          updatePreset={updateStylePreset}
          closeModal={closeModal}
        />
      );
    } else if (type === 'variable') {
      setModalContent(
        <VariablePresetModalContent
          preset={preset}
          removeVariable={(varId) => removeVariableFromPreset(preset.id, varId)}
          closeModal={closeModal}
        />
      );
    }
    setIsModalOpen(true);
  };

  /**
   * Handler to close the modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setModalTitle('');
  };

  /**
   * Function to update a style preset after editing
   */
  const updateStylePreset = (presetId, updatedStyles) => {
    setStylePresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId ? { ...preset, styles: updatedStyles } : preset
      )
    );
  };

  /**
   * Function to remove a variable from a variable preset
   */
  const removeVariableFromPreset = (presetId, varId) => {
    setVariablePresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId
          ? { ...preset, variables: preset.variables.filter((id) => id !== varId) }
          : preset
      )
    );
    toast.success('Variable removed from preset');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Market Area Presets</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Style Editor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Style Editor</h2>
            </div>
            <StyleEditor currentStyle={currentStyle} setCurrentStyle={setCurrentStyle} />
          </div>

          {/* Middle Panel - Variables Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Analysis Variables</h2>
            </div>
            <VariablesPanel
              selectedVariables={selectedVariables}
              setSelectedVariables={setSelectedVariables}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </div>

          {/* Right Panel - Saved Presets */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Saved Presets</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Enter preset name"
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 
                           shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleSaveStylePreset}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                  title="Save Style Preset"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span className="ml-2">Save Style</span>
                </button>
                <button
                  onClick={handleSaveVariablePreset}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                  title="Save Variable Preset"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span className="ml-2">Save Variable</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* Style Presets */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Style Presets</h3>
                <div className="space-y-2">
                  {stylePresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 
                               dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white">{preset.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCurrentStyle(preset.styles);
                            toast.success('Style preset applied');
                          }}
                          className="text-blue-600 hover:text-blue-700"
                          title="Apply Preset"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPresetModal(preset, 'style')}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                          title="View Preset Details"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to delete the style preset "${preset.name}"?`
                              )
                            ) {
                              setStylePresets((prev) => prev.filter((p) => p.id !== preset.id));
                              toast.success('Style preset deleted');
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Preset"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stylePresets.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No style presets saved
                    </div>
                  )}
                </div>
              </div>

              {/* Variable Presets */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Variable Presets</h3>
                <div className="space-y-2">
                  {variablePresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 
                               dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white">{preset.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">
                          {preset.variables.length} variables
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedVariables(new Set(preset.variables));
                            toast.success('Variable preset applied');
                          }}
                          className="text-blue-600 hover:text-blue-700"
                          title="Apply Preset"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPresetModal(preset, 'variable')}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                          title="View Preset Details"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to delete the variable preset "${preset.name}"?`
                              )
                            ) {
                              setVariablePresets((prev) => prev.filter((p) => p.id !== preset.id));
                              toast.success('Variable preset deleted');
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Preset"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {variablePresets.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No variable presets saved
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal for Preset Details */}
        <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle}>
          {modalContent}
        </Modal>
      </div>
    </div>
  );
}
