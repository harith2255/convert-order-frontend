import React, { useState } from "react";
import { FileSpreadsheet, Gift, RefreshCw } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { toast } from "sonner";
import { downloadSchemeFile } from "../services/orderApi";

interface SchemeSummary {
  count: number;
  totalFreeQty: number;
}

interface SchemeSummaryCardProps {
  orderId: string;
  schemeSummary: SchemeSummary;
  fileName?: string;
}

export function SchemeSummaryCard({
  orderId,
  schemeSummary,
  fileName
}: SchemeSummaryCardProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadSchemeFile(orderId, fileName);
      toast.success("Scheme summary downloaded successfully");
    } catch (err) {
      console.error("Scheme download error:", err);
      toast.error("Failed to download scheme summary");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-yellow-50 border border-yellow-300 rounded-lg">
        
        {/* LEFT CONTENT */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-100 rounded-full">
            <Gift className="w-6 h-6 text-yellow-700" />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-yellow-900">
              Scheme Summary
            </h3>
            <p className="text-yellow-800 text-sm mt-1">
              {schemeSummary.count} products qualified for active schemes
            </p>

            <div className="flex gap-2 mt-3">
              <Badge variant="warning">
                Scheme Items: {schemeSummary.count}
              </Badge>
              <Badge variant="warning">
                Free Qty: {schemeSummary.totalFreeQty}
              </Badge>
            </div>
          </div>
        </div>

        {/* DOWNLOAD BUTTON */}
        <Button
          variant="warning"
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 self-start md:self-center"
        >
          {downloading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Downloading…
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              Download Scheme Summary
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
