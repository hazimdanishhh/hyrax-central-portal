import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // NEW IMPORT
import { FilePdf, Spinner } from "@phosphor-icons/react";
import { fetchLeads } from "../../features/sales/leads/private/api/leadsService"; // Adjust path as needed

// Helper to convert an image URL into Base64
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

  const handleExportFullPDF = async () => {
    if (!targetRef.current) return;
    setIsExporting(true);

    try {
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
        Product: lead.product_type || "N/A", // NEW
        Stage: lead.stage,
        "Prob. (%)": lead.close_probability || 0,
        "Exp. Rev (RM)": lead.expected_revenue || 0, // Abbreviated
        "Act. Rev (RM)": lead.actual_revenue || 0, // NEW
        Source: lead.lead_source_type?.name || "Unknown",
        Created: lead.created_date,
      }));

      // ==========================================
      // 2. CAPTURE DASHBOARD SNAPSHOT
      // ==========================================
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        windowWidth: 1025,
        onclone: (clonedDoc, clonedElement) => {
          clonedElement.style.width = "1200px";
          clonedElement.style.minWidth = "1200px";
          clonedElement.style.padding = "0";
        },
      });
      const imgData = canvas.toDataURL("image/png");

      // ==========================================
      // 3. INITIALIZE PDF & DRAW HEADER
      // ==========================================
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
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
      // 4. DRAW DASHBOARD IMAGE (WITH MULTI-PAGE SPLITTING)
      // ==========================================
      const pageHeight = pdf.internal.pageSize.getHeight();
      const dashboardImageWidth = pageWidth - margin * 2;
      const dashboardImageHeight =
        (canvas.height * dashboardImageWidth) / canvas.width;

      let heightLeft = dashboardImageHeight;
      let position = currentY;

      // Draw the first chunk of the image on Page 1
      pdf.addImage(
        imgData,
        "PNG",
        margin,
        position,
        dashboardImageWidth,
        dashboardImageHeight,
      );

      // Calculate how much of the image we just consumed
      heightLeft -= pageHeight - position;

      // If the image is taller than the remaining space on page 1, loop and add pages
      while (heightLeft > 0) {
        pdf.addPage();
        position -= pageHeight; // Shift the image UP by exactly one page height

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          position,
          dashboardImageWidth,
          dashboardImageHeight,
        );

        heightLeft -= pageHeight;
      }

      // ==========================================
      // 5. ADD NEW PAGE & DRAW THE DATA TABLE
      // ==========================================
      if (flattenedData.length > 0) {
        pdf.addPage();

        // Extract headers from the object keys
        const tableHeaders = Object.keys(flattenedData[0]);
        // Map the data into an array of arrays for autoTable
        const tableRows = flattenedData.map(Object.values);

        autoTable(pdf, {
          head: [tableHeaders],
          body: tableRows,
          startY: 15, // Start slightly down from the top of the new page
          theme: "striped",
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [30, 41, 59], // Slate 800 to match your dashboard vibe
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252], // Slate 50
          },
          margin: { top: 15, left: margin, right: margin },
        });
      }

      // ==========================================
      // 6. SAVE THE PDF
      // ==========================================
      pdf.save(`${fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Failed to generate Full Report:", error);
      alert("An error occurred while generating the report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportFullPDF}
      disabled={isExporting}
      className="button buttonType5 textXXS"
    >
      {isExporting ? (
        <Spinner className="animate-spin" />
      ) : (
        <FilePdf weight="bold" />
      )}
      {isExporting ? "Generating Report..." : "Export PDF Report"}
    </button>
  );
}
