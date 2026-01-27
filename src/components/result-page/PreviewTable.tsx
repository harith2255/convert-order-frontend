import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { Card } from "../Card";

interface PreviewTableProps {
  previewData: any[];
  previewHeaders: string[];
  schemeDetails?: any[];
  id: string;
  onViewFull: () => void;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  previewData,
  previewHeaders,
  schemeDetails,
  onViewFull,
}) => {
  if (!previewData || previewData.length === 0) return null;

  return (
    <Card>
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-green-600" />
          Converted File Preview
        </h3>
        <div className="text-xs text-gray-500">Showing first 10 rows</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 font-medium">
            <tr>
              {previewHeaders.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 border-b border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {previewData.map((row, i) => {
              // Highlights row if it appears in schemeDetails (matching by SAPCODE)
              const isSchemeRow = schemeDetails?.some(
                (s) => s.productCode === row["SAPCODE"]
              );

              return (
                <tr
                  key={i}
                  className={
                    isSchemeRow ? "bg-yellow-100 hover:bg-yellow-200" : "hover:bg-gray-50"
                  }
                >
                  {previewHeaders.map((h) => {
                    // Skip internal or object keys
                    if (h.startsWith("_") || typeof row[h] === "object") {
                      if (row[h] === null)
                        return (
                          <td
                            key={h}
                            className="px-4 py-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap"
                          ></td>
                        );

                      return (
                        <td
                          key={h}
                          className="px-4 py-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap text-xs text-gray-400 font-mono"
                        >
                          {JSON.stringify(row[h]).slice(0, 20)}...
                        </td>
                      );
                    }

                    return (
                      <td
                        key={h}
                        className="px-4 py-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap relative group"
                      >
                        {row[h]}
                        {h === "ORDERQTY" && row._upsell && (
                          <div className="absolute top-1 right-1 cursor-help group/icon">
                            <div className="absolute z-10 hidden group-hover/icon:block bg-black text-white text-xs px-2 py-1 rounded -top-8 left-1/2 -translate-x-1/2 w-48 text-center shadow-lg">
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
        <button
          onClick={onViewFull}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Full File & Edit
        </button>
      </div>
    </Card>
  );
};
