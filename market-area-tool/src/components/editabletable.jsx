import React, { useState } from 'react';
import ColorSwatchCell from './ColorSwatchCell';

const EditableTable = ({ title, data, setData, columns, onSave }) => {
  const [editingId, setEditingId] = useState(null);
  const [editedRow, setEditedRow] = useState(null);

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditedRow({ ...row });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditedRow(null);
  };

  const handleSave = async () => {
    try {
      await onSave(editedRow);
      setData(data.map((row) => (row.id === editedRow.id ? editedRow : row)));
      setEditingId(null);
      setEditedRow(null);
    } catch (error) {
      console.error('Error saving row:', error);
    }
  };

  const handleChange = (field, value, rowData) => {
    if (field === 'color_swatch') {
      // Handle color swatch changes
      setEditedRow({
        ...editedRow,
        ...value // This includes R, G, B, and Hex values
      });
    } else {
      setEditedRow({
        ...editedRow,
        [field]: value
      });
    }
  };

  const renderCell = (row, column) => {
    const isEditing = row.id === editingId;
    const value = editingId === row.id ? 
      (editedRow[column.field] ?? '') : 
      (row[column.field] ?? '');
    if (column.type === 'color') {
      return (
        <ColorSwatchCell
          value={value}
          row={editingId === row.id ? editedRow : row}
          isEditing={isEditing}
          onChange={(colorValues) => handleChange('color_swatch', colorValues, row)}
        />
      );
    }

    if (isEditing && !column.isReadOnly) {
      if (column.type === 'select') {
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(column.field, e.target.value, row)}
            className="w-full p-2 border rounded"
          >
            {column.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          type={column.type}
          value={value || ''}
          onChange={(e) => handleChange(column.field, e.target.value, row)}
          className="w-full p-2 border rounded"
        />
      );
    }

    return <span>{value}</span>;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
      <div className="px-4 py-5 sm:px-6 border-b dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  {column.header}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {renderCell(row, column)}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {editingId === row.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSave}
                        className="text-green-600 hover:text-green-900 dark:hover:text-green-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(row)}
                      className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditableTable;