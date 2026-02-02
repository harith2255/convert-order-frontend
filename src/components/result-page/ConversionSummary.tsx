import React from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Card } from "../Card";
import { conversionData } from "../../types";

interface ConversionSummaryProps {
  success: boolean;
  data: conversionData;
  errorCount: number;
}

export const ConversionSummary: React.FC<ConversionSummaryProps> = ({
  success,
  data,
  errorCount,
}) => {
  return (
    <Card>
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {success ? (
            <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold">
              {success ? "Conversion Successful" : "Conversion Failed"}
            </h2>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-neutral-600">
              <span>
                Processed: <strong>{data.successRows + errorCount}</strong> rows
              </span>
              {data.processingTime && data.processingTime !== "-" && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> {data.processingTime}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
