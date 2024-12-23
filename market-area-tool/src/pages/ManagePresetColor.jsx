// src/pages/ManagePresetColor.jsx

import React, { useState } from 'react';
import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

const EditableTable = ({ title, data, setData, columns }) => {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditValues({ ...row });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  // No backend calls now, just update local state
  const handleSave = () => {
    setData((prev) => prev.map((item) => (item.id === editingId ? editValues : item)));
    setEditingId(null);
    setEditValues({});
  };

  const handleChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const hexToRgb = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  };

  const rgbToHex = (r, g, b) => {
    const toHex = (num) => num.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  const handleColorChange = (newHex) => {
    const { r, g, b } = hexToRgb(newHex);
    setEditValues((prev) => ({
      ...prev,
      R: r.toString(),
      G: g.toString(),
      B: b.toString(),
      Hex: newHex.toUpperCase(),
    }));
  };

  const computeSwatchColor = (row) => {
    const r = parseInt(row.R, 10) || 0;
    const g = parseInt(row.G, 10) || 0;
    const b = parseInt(row.B, 10) || 0;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const renderCell = (row, col) => {
    const value = editingId === row.id ? editValues[col.field] : row[col.field];
    const isEditing = editingId === row.id;

    if (col.field === 'color_swatch') {
      const swatchColor = computeSwatchColor(isEditing ? editValues : row);

      if (isEditing) {
        const r = parseInt(editValues.R, 10) || 0;
        const g = parseInt(editValues.G, 10) || 0;
        const b = parseInt(editValues.B, 10) || 0;
        const currentHex = rgbToHex(r, g, b);
        return (
          <input
            type="color"
            value={currentHex}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-10 h-6 border border-gray-300 cursor-pointer"
          />
        );
      }

      return (
        <div
          className="w-6 h-4 rounded border border-gray-300"
          style={{ background: swatchColor }}
        ></div>
      );
    }

    if (col.type === 'select') {
      return isEditing ? (
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          value={value}
          onChange={(e) => handleChange(col.field, e.target.value)}
        >
          {col.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        value
      );
    }

    if (isEditing) {
      return (
        <input
          type={col.type || 'text'}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full"
          value={value || ''}
          onChange={(e) => handleChange(col.field, e.target.value)}
        />
      );
    }

    return value;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col mb-8">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
              <th className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
              >
                {columns.map((col) => (
                  <td key={col.field} className="p-2 text-gray-700 whitespace-nowrap">
                    {renderCell(row, col)}
                  </td>
                ))}
                <td className="p-2">
                  {editingId === row.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="text-green-600 hover:text-green-700 flex items-center"
                        title="Save"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-gray-600 hover:text-gray-700"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(row)}
                      className="text-blue-600 hover:text-blue-700 flex items-center"
                      title="Edit"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-4 text-center text-sm text-gray-500"
                >
                  No data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function ManagePresetColor() {
  const tcgThemesData = [
    { theme_key: 'A', theme_name: 'CMA', fill: 'Yes', fill_color: '1', transparency: '65%', border: 'No', weight: '-', excel_fill: '1', excel_text: 'White' },
    { theme_key: 'B', theme_name: 'PMA', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '3', excel_fill: '2', excel_text: 'White' },
    { theme_key: 'C', theme_name: 'Subject MSA', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '3', excel_fill: '3', excel_text: 'White' },
    { theme_key: 'D', theme_name: 'Micro-Market (Sub-CMA)', fill: 'Yes', fill_color: '4', transparency: '65%', border: 'No', weight: '-', excel_fill: '4', excel_text: 'White' },
    { theme_key: 'E', theme_name: 'Submarket 1', fill: 'Yes', fill_color: '5', transparency: '65%', border: 'No', weight: '-', excel_fill: '25', excel_text: 'Black' },
    { theme_key: 'F', theme_name: 'Submarket 2', fill: 'Yes', fill_color: '6', transparency: '65%', border: 'No', weight: '-', excel_fill: '26', excel_text: 'Black' },
    { theme_key: 'G', theme_name: 'Submarket 3', fill: 'Yes', fill_color: '7', transparency: '65%', border: 'No', weight: '-', excel_fill: '27', excel_text: 'Black' },
    { theme_key: 'H', theme_name: 'Submarket 4', fill: 'Yes', fill_color: '8', transparency: '65%', border: 'No', weight: '-', excel_fill: '28', excel_text: 'Black' },
    { theme_key: 'I', theme_name: 'Submarket 5', fill: 'Yes', fill_color: '9', transparency: '65%', border: 'No', weight: '-', excel_fill: '29', excel_text: 'Black' },
    { theme_key: 'J', theme_name: 'Submarket 6', fill: 'Yes', fill_color: '10', transparency: '65%', border: 'No', weight: '-', excel_fill: '30', excel_text: 'Black' },
    { theme_key: 'K', theme_name: 'Submarket 7', fill: 'Yes', fill_color: '11', transparency: '65%', border: 'No', weight: '-', excel_fill: '31', excel_text: 'Black' },
    { theme_key: 'L', theme_name: 'Submarket 8', fill: 'Yes', fill_color: '12', transparency: '65%', border: 'No', weight: '-', excel_fill: '32', excel_text: 'Black' },
    { theme_key: 'M', theme_name: 'Submarket 9', fill: 'Yes', fill_color: '13', transparency: '65%', border: 'No', weight: '-', excel_fill: '33', excel_text: 'Black' },
    { theme_key: 'N', theme_name: 'Submarket 10', fill: 'Yes', fill_color: '14', transparency: '65%', border: 'No', weight: '-', excel_fill: '14', excel_text: 'White' },
    { theme_key: 'O', theme_name: 'Submarket 11', fill: 'Yes', fill_color: '15', transparency: '65%', border: 'No', weight: '-', excel_fill: '15', excel_text: 'White' },
    { theme_key: 'P', theme_name: 'Submarket 12', fill: 'Yes', fill_color: '16', transparency: '65%', border: 'No', weight: '-', excel_fill: '16', excel_text: 'Black' },
    { theme_key: 'Q', theme_name: 'Submarket 13', fill: 'Yes', fill_color: '17', transparency: '65%', border: 'No', weight: '-', excel_fill: '17', excel_text: 'White' },
    { theme_key: 'R', theme_name: 'Submarket 14', fill: 'Yes', fill_color: '18', transparency: '65%', border: 'No', weight: '-', excel_fill: '18', excel_text: 'White' },
    { theme_key: 'S', theme_name: 'Submarket 15', fill: 'Yes', fill_color: '19', transparency: '65%', border: 'No', weight: '-', excel_fill: '19', excel_text: 'White' },
    { theme_key: 'T', theme_name: 'Submarket 16', fill: 'Yes', fill_color: '20', transparency: '65%', border: 'No', weight: '-', excel_fill: '20', excel_text: 'White' },
    { theme_key: 'U', theme_name: 'MSA 1', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '2 or 3', excel_fill: '21', excel_text: 'White' },
    { theme_key: 'V', theme_name: 'MSA 2', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '2 or 3', excel_fill: '22', excel_text: 'Black' },
    { theme_key: 'W', theme_name: 'MSA 3', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '2 or 3', excel_fill: '23', excel_text: 'White' },
    { theme_key: 'X', theme_name: 'MSA 4', fill: 'No', fill_color: '-', transparency: '-', border: 'Yes', weight: '2 or 3', excel_fill: '24', excel_text: 'Black' },
  ];

  const colorKeysData = [
    { key_number: '1', color_name: 'TCG Red', R: '255', G: '0', B: '0', Hex: '#FF0000' },
    { key_number: '2', color_name: 'TCG Blue', R: '0', G: '102', B: '255', Hex: '#0066FF' },
    { key_number: '3', color_name: 'Carbon Gray Dark', R: '58', G: '56', B: '56', Hex: '#3A3838' },
    { key_number: '4', color_name: 'TCG Red Dark', R: '191', G: '0', B: '0', Hex: '#BF0000' },
    { key_number: '5', color_name: 'TCG Orange', R: '255', G: '171', B: '101', Hex: '#FFAB65' },
    { key_number: '6', color_name: 'TCG Green', R: '179', G: '255', B: '196', Hex: '#B3FFC4' },
    { key_number: '7', color_name: 'TCG Cyan', R: '57', G: '255', B: '255', Hex: '#39FFFF' },
    { key_number: '8', color_name: 'TCG Purple', R: '92', G: '0', B: '184', Hex: '#5C00B8' },
    { key_number: '9', color_name: 'Pink', R: '255', G: '71', B: '207', Hex: '#FF47CF' },
    { key_number: '10', color_name: 'Forest Green', R: '76', G: '122', B: '29', Hex: '#4C7A1D' },
    { key_number: '11', color_name: 'Astronaut Blue', R: '5', G: '74', B: '99', Hex: '#054A63' },
    { key_number: '12', color_name: 'Brown', R: '148', G: '112', B: '60', Hex: '#94703C' },
    { key_number: '13', color_name: 'Yellow', R: '255', G: '255', B: '153', Hex: '#FFFF99' },
    { key_number: '14', color_name: 'Carbon Gray', R: '117', G: '113', B: '113', Hex: '#757171' },
    { key_number: '15', color_name: 'Rust', R: '142', G: '47', B: '0', Hex: '#8E2F00' },
    { key_number: '16', color_name: 'TCG Green Dark', R: '0', G: '191', B: '44', Hex: '#00BF2C' },
    { key_number: '17', color_name: 'TCG Purple Dark', R: '92', G: '0', B: '184', Hex: '#5C00B8' },
    { key_number: '18', color_name: 'TCG Blue Dark', R: '0', G: '51', B: '128', Hex: '#003380' },
    { key_number: '19', color_name: 'TCG Cyan Dark', R: '0', G: '155', B: '155', Hex: '#009B9B' },
    { key_number: '20', color_name: 'Rust Dark', R: '92', G: '31', B: '0', Hex: '#5C1F00' },
    { key_number: '21', color_name: 'Carbon Gray Light', R: '174', G: '170', B: '170', Hex: '#AEAAAA' },
    { key_number: '22', color_name: 'Gray Light', R: '242', G: '242', B: '242', Hex: '#F2F2F2' },
    { key_number: '23', color_name: 'Black', R: '0', G: '0', B: '0', Hex: '#000000' },
    { key_number: '24', color_name: 'White', R: '255', G: '255', B: '255', Hex: '#FFFFFF' },
    { key_number: '25', color_name: 'TCG Orange Light', R: '255', G: '204', B: '162', Hex: '#FFCCA2' },
    { key_number: '26', color_name: 'TCG Green Light', R: '204', G: '255', B: '216', Hex: '#CCFFD8' },
    { key_number: '27', color_name: 'TCG Cyan Light', R: '174', G: '255', B: '255', Hex: '#AEFFFF' },
    { key_number: '28', color_name: 'TCG Purple Light', R: '157', G: '62', B: '253', Hex: '#9D3EFD' },
    { key_number: '29', color_name: 'Pink Light', R: '252', G: '178', B: '236', Hex: '#FCB2EC' },
    { key_number: '30', color_name: 'Forest Green Light', R: '111', G: '179', B: '43', Hex: '#6FB32B' },
    { key_number: '31', color_name: 'Astronaut Blue Light', R: '8', G: '124', B: '167', Hex: '#087CA7' },
    { key_number: '32', color_name: 'Brown Light', R: '209', G: '182', B: '143', Hex: '#D1B68F' },
    { key_number: '33', color_name: 'Yellow Light', R: '255', G: '255', B: '217', Hex: '#FFFFD9' },
  ];

  const [tcgThemes, setTcgThemes] = useState(() => tcgThemesData.map((row, index) => ({ ...row, id: index + 1 })));
  const [colorKeys, setColorKeys] = useState(() => colorKeysData.map((row, index) => ({ ...row, id: index + 1 })));

  const tcgThemeColumns = [
    { field: 'theme_key', header: 'Theme Key', type: 'text' },
    { field: 'theme_name', header: 'Theme Name', type: 'text' },
    {
      field: 'fill',
      header: 'Fill?',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    { field: 'fill_color', header: 'Fill Color', type: 'text' },
    { field: 'transparency', header: 'Transparency (%)', type: 'text' },
    {
      field: 'border',
      header: 'Border?',
      type: 'select',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
    },
    { field: 'weight', header: 'Weight', type: 'text' },
    { field: 'excel_fill', header: 'Excel Fill', type: 'text' },
    { field: 'excel_text', header: 'Excel Text', type: 'text' },
  ];

  const colorKeyColumns = [
    { field: 'key_number', header: 'Key #', type: 'text' },
    { field: 'color_name', header: 'Color Name', type: 'text' },
    { field: 'R', header: 'R', type: 'number' },
    { field: 'G', header: 'G', type: 'number' },
    { field: 'B', header: 'B', type: 'number' },
    { field: 'Hex', header: 'Hex', type: 'text' },
    { field: 'color_swatch', header: 'Swatch' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Manage Preset Colors
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Edit the TCG Themes and Color Keys below. For Color Keys, click edit and select a custom color in the swatch column to update R, G, B, and Hex in real time.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <EditableTable
          title="TCG Themes"
          data={tcgThemes}
          setData={setTcgThemes}
          columns={tcgThemeColumns}
        />
        <EditableTable
          title="Color Keys"
          data={colorKeys}
          setData={setColorKeys}
          columns={colorKeyColumns}
        />
      </div>
    </div>
  );
}
