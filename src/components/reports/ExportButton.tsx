"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type ExportButtonProps = {
  data: Record<string, unknown>[];
  filename?: string;
};

export function ExportButton({
  data,
  filename = "report.csv",
}: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = val === null || val === undefined ? "" : String(val);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];

    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
