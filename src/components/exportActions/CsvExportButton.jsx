import React, { useState } from "react";
import Papa from "papaparse";
import { DownloadSimple, FileCsvIcon, Spinner } from "@phosphor-icons/react";
import { useMessage } from "../../context/MessageContext";

/**
 * Generic CSV export button -- no feature imports, same shape as
 * ExportActions.jsx's PDF export (presentational, data passed in via props).
 * `fetchFn` is any *Service.js list-fetch function that supports the
 * `isExport: true` pagination-bypass (see leadsService.js's fetchLeads).
 * `columns` is an array of `{ label, accessor }`, where `accessor` is either
 * a row key or a `(row) => value` function -- co-locate this array next to
 * the page's own tableConfig.jsx (e.g. exportConfig.js).
 */
export default function CsvExportButton({
  fetchFn,
  columns,
  fileNamePrefix,
  search,
  filters,
  sortBy,
  sortOrder,
  defaultSortBy = "created_at",
  defaultSortOrder = "descending",
}) {
  const [isExporting, setIsExporting] = useState(false);
  const { showMessage } = useMessage();

  const handleExportCSV = async () => {
    setIsExporting(true);

    try {
      showMessage("Exporting CSV Data...", "loading");

      const { data } = await fetchFn({
        search,
        filters,
        sortBy: sortBy || defaultSortBy,
        sortOrder: sortOrder || defaultSortOrder,
        isExport: true,
      });

      if (!data || data.length === 0) {
        alert("No data to export based on current filters.");
        return;
      }

      const flattenedData = data.map((record) => {
        const row = {};
        columns.forEach(({ label, accessor }) => {
          row[label] =
            typeof accessor === "function"
              ? accessor(record)
              : record[accessor];
        });
        return row;
      });

      const csvString = Papa.unparse(flattenedData);

      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${fileNamePrefix}_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showMessage("CSV Data Exported", "success");
    } catch (error) {
      console.error("Failed to export data:", error);
      showMessage("Failed to export CSV Data", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportCSV}
      disabled={isExporting}
      className="button buttonType4 blue textXXS"
    >
      {isExporting ? (
        <Spinner className="animate-spin" />
      ) : (
        <FileCsvIcon weight="fill" />
      )}
      {isExporting ? "Exporting..." : "Export CSV"}
    </button>
  );
}
