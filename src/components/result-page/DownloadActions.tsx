import React from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "../Button";
import { conversionData } from "../../types";

interface DownloadActionsProps {
  data: conversionData;
  downloadingType: string | null;
  onDownload: (type: string) => void;
  divisions: string[];
  selectedDivision: string;
  onDivisionChange: (d: string) => void;
  onDivisionDownload: () => void;
}

export const DownloadActions: React.FC<DownloadActionsProps> = ({
  data,
  downloadingType,
  onDownload,
  divisions,
  selectedDivision,
  onDivisionChange,
  onDivisionDownload,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
      {/* DYNAMIC DOWNLOAD BUTTONS */}
      {data.downloadUrls && data.downloadUrls.length > 0 ? (
        data.downloadUrls.map((dl, idx) => (
          <Button
            key={idx}
            variant="primary"
            onClick={() => onDownload(dl.type)}
            disabled={!!downloadingType}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {downloadingType === dl.type ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {dl.type === "sheets"
                  ? "Download Sheet Orders"
                  : dl.type === "main"
                  ? "Download Main Order"
                  : "Download Excel File"}
              </>
            )}
          </Button>
        ))
      ) : (
        // Fallback for backward compatibility
        <Button
          variant="primary"
          onClick={() => onDownload("single")}
          disabled={!!downloadingType}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          {downloadingType ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Excel File
            </>
          )}
        </Button>
      )}

      {/* Division Report Section */}
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
        {divisions.length > 0 && (
          <select
            value={selectedDivision}
            onChange={(e) => onDivisionChange(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 h-9 bg-white w-full sm:w-auto"
          >
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        <Button
          type="button"
          variant="secondary"
          onClick={onDivisionDownload}
          disabled={!!downloadingType}
          className="inline-flex items-center justify-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 bg-white w-full sm:w-auto"
        >
          {downloadingType === "division" ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {selectedDivision
                ? `Download ${selectedDivision}`
                : "Division Report"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
