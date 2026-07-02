import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FilePdf, Spinner } from "@phosphor-icons/react";
import { fetchLeads } from "../../features/sales/leads/private/api/leadsService";
import { useMessage } from "../../context/MessageContext";

const getBase64ImageFromUrl = async (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

export default function ExportFullReport({
  targetRef,
  search,
  filters,
  sortBy,
  sortOrder,
  fileName = "Sales_Leads_Report",
  reportTitle = "Sales Leads Report",
  subtitle = "",
  logoUrl = null,
}) {
  const [isExporting, setIsExporting] = useState(false);
  const { showMessage } = useMessage();

  const handleExportFullPDF = async () => {
    if (!targetRef.current) return;
    setIsExporting(true);

    try {
      showMessage("Exporting PDF Report...", "loading");
      // ==========================================
      // 1. FETCH RAW DATA FOR THE TABLE
      // ==========================================
      const { data } = await fetchLeads({
        search,
        filters,
        sortBy: sortBy || "created_at",
        sortOrder: sortOrder || "descending",
        isExport: true,
      });

      const flattenedData = (data || []).map((lead) => ({
        "Lead Title": lead.title,
        Client: lead.client?.name || "N/A",
        Owner: lead.lead_owner?.full_name || "Unassigned",
        Product: lead.product_type || "N/A",
        Stage: lead.stage,
        "Prob. (%)": lead.close_probability || 0,
        "Exp. Rev (RM)": lead.expected_revenue || 0,
        "Act. Rev (RM)": lead.actual_revenue || 0,
        Source: lead.lead_source_type?.name || "Unknown",
        Created: lead.created_date,
      }));

      // ==========================================
      // 2. INITIALIZE PDF & DRAW HEADER
      // ==========================================
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let currentY = 15;

      if (logoUrl) {
        try {
          const base64Logo = await getBase64ImageFromUrl(logoUrl);
          const img = new Image();
          img.src = base64Logo;
          await new Promise((res) => (img.onload = res));

          const targetHeight = 12;
          const targetWidth = targetHeight * (img.width / img.height);

          pdf.addImage(
            base64Logo,
            "PNG",
            margin,
            currentY - 5,
            targetWidth,
            targetHeight,
          );
          currentY += targetHeight + 4;
        } catch (logoErr) {
          console.warn("Could not load logo", logoErr);
        }
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(30, 41, 59);
      pdf.text(reportTitle, margin, currentY);
      currentY += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);

      const dateString = `Generated on: ${new Date().toLocaleDateString(
        "en-MY",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      )}`;

      pdf.text(dateString, margin, currentY);
      currentY += 5;

      if (subtitle) {
        pdf.text(subtitle, margin, currentY);
        currentY += 5;
      }

      currentY += 2;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;

      // ==========================================
      // 3. CAPTURE & DRAW DASHBOARD SECTIONS
      // ==========================================
      const sections = Array.from(
        targetRef.current.querySelectorAll(".pdfOverviewSection"),
      );

      const dashboardImageWidth = pageWidth - margin * 2;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        const canvas = await html2canvas(section, {
          scale: 1.5,
          useCORS: true,
          windowWidth: 1025,
          onclone: (clonedDoc, clonedElement) => {
            clonedElement.style.width = "1220px";
            clonedElement.style.minWidth = "1220px";
            clonedElement.style.padding = "0";
            // Ensure white background so transparency doesn't render black
            clonedElement.style.backgroundColor = "#ffffff";
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.75);
        const dashboardImageHeight =
          (canvas.height * dashboardImageWidth) / canvas.width;

        // Smart Pagination: If this section exceeds page bounds, break to next page
        if (
          currentY + dashboardImageHeight > pageHeight - margin &&
          currentY > margin + 20
        ) {
          pdf.addPage();
          currentY = margin;
        }

        // Draw the section
        pdf.addImage(
          imgData,
          "JPEG",
          margin,
          currentY,
          dashboardImageWidth,
          dashboardImageHeight,
          undefined,
          "FAST",
        );

        // Move cursor down for the next section with a 10mm gap
        currentY += dashboardImageHeight + 10;
      }

      // ==========================================
      // 4. ADD NEW PAGE & DRAW THE DATA TABLE
      // ==========================================
      if (flattenedData.length > 0) {
        pdf.addPage();

        const tableHeaders = Object.keys(flattenedData[0]);
        const tableRows = flattenedData.map(Object.values);

        autoTable(pdf, {
          head: [tableHeaders],
          body: tableRows,
          startY: 15,
          theme: "striped",
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          margin: { top: 15, left: margin, right: margin },
        });
      }

      // ==========================================
      // 5. SAVE THE PDF
      // ==========================================
      pdf.save(`${fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
      showMessage("PDF Exported", "success");
    } catch (error) {
      console.error("Failed to generate Full Report:", error);
      showMessage("Failed to generate PDF Report", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportFullPDF}
      disabled={isExporting}
      className="button buttonType4 approval textXXS"
    >
      {isExporting ? (
        <Spinner className="animate-spin" />
      ) : (
        <FilePdf weight="fill" />
      )}
      {isExporting ? "Generating Report..." : "Export PDF Report"}
    </button>
  );
}
