import React, { useState } from "react";
import Papa from "papaparse";
import { DownloadSimple, FileCsvIcon, Spinner } from "@phosphor-icons/react";
import { fetchLeads } from "../../features/sales/leads/private/api/leadsService";
import { useMessage } from "../../context/MessageContext";

export default function ExportData({ search, filters, sortBy, sortOrder }) {
  const [isExporting, setIsExporting] = useState(false);
  const { showMessage } = useMessage();

  const handleExportCSV = async () => {
    setIsExporting(true);

    try {
      showMessage("Exporting CSV Data...", "loading");

      // 1. Fetch ALL data matching current filters (bypassing pagination)
      const { data } = await fetchLeads({
        search,
        filters,
        sortBy: sortBy || "created_at",
        sortOrder: sortOrder || "descending",
        isExport: true, // Triggers the bypass
      });

      if (!data || data.length === 0) {
        alert("No data to export based on current filters.");
        return;
      }

      // 2. Flatten the data for a clean Excel/CSV experience
      const flattenedData = data.map((lead) => ({
        "Lead Title": lead.title,
        Client: lead.client?.name || "N/A",
        Owner: lead.lead_owner?.full_name || "Unassigned",
        "Product Type": lead.product_type || "N/A", // NEW
        Stage: lead.stage,
        "Close Probability (%)": lead.close_probability || 0,
        "Expected Revenue (RM)": lead.expected_revenue || 0,
        "Actual Revenue (RM)": lead.actual_revenue || 0, // NEW
        "PO Number": lead.po_number || "", // NEW
        Source: lead.lead_source_type?.name || "Unknown",
        "On Hold": lead.is_on_hold ? "Yes" : "No",
        "Hold Reason": lead.hold_reason || "", // NEW
        Cancelled: lead.is_cancelled ? "Yes" : "No",
        "Cancel Reason": lead.cancel_reason || "", // NEW
        "Lose Reason": lead.lose_reason?.name || "", // NEW (maps to the joined table)
        "Created Date": lead.created_date,
        "Updated Date": lead.updated_date,
      }));

      // 3. Convert to CSV string
      const csvString = Papa.unparse(flattenedData);

      // 4. Trigger browser download
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Sales_Leads_Export_${new Date().toISOString().split("T")[0]}.csv`,
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
      className="button buttonType4 approval textXXS"
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
