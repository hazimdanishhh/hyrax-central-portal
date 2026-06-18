import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { FilePdf, Spinner } from "@phosphor-icons/react";

export default function ExportActions({
  targetRef,
  fileName = "Dashboard_Export",
  reportTitle = "Dashboard Report",
  subtitle = "",
  logoUrl = null, // Optional: Pass a path to your logo (e.g., "/logo.png")
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!targetRef.current) return;
    setIsExporting(true);

    try {
      // 1. Take snapshot of the dashboard (Forcing Desktop Layout)
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        // Force the virtual window to be desktop size so media queries trigger
        windowWidth: 1200,
        onclone: (clonedDoc, clonedElement) => {
          // Force the cloned container to maintain desktop width
          clonedElement.style.width = "1200px";
          clonedElement.style.minWidth = "1200px";
          clonedElement.style.padding = "20px"; // Optional: adds breathing room
        },
      });
      const imgData = canvas.toDataURL("image/png");

      // 2. Initialize jsPDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      let currentY = 15; // Start drawing 15mm from the top

      // 3. Add Logo (If provided)
      if (logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = logoUrl;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          // Define how tall you want the logo to be (in mm)
          const targetHeight = 12;
          // Calculate the correct width mathematically to prevent smooshing
          const aspectRatio = img.width / img.height;
          const targetWidth = targetHeight * aspectRatio;

          // Note: Passing the 'img' element directly handles both Base64 and URLs safely in jsPDF
          pdf.addImage(
            img,
            "PNG",
            margin,
            currentY - 5,
            targetWidth,
            targetHeight,
          );
          currentY += targetHeight + 4; // Push text down dynamically based on logo height
        } catch (logoErr) {
          console.warn("Could not load logo for PDF. Skipping.", logoErr);
        }
      }

      // 4. Add Report Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(30, 41, 59); // Dark slate color
      pdf.text(reportTitle, margin, currentY);
      currentY += 6;

      // 5. Add Subtitle / Metadata (e.g., Date and Filters)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // Lighter gray

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

      // Draw a subtle horizontal divider line
      currentY += 2;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5; // Add some breathing room before the charts start

      // 6. Calculate the remaining space for the Dashboard Image
      const dashboardImageWidth = pageWidth - margin * 2;
      const dashboardImageHeight =
        (canvas.height * dashboardImageWidth) / canvas.width;

      // 7. Add the Dashboard snapshot onto the PDF below the header
      pdf.addImage(
        imgData,
        "PNG",
        margin,
        currentY,
        dashboardImageWidth,
        dashboardImageHeight,
      );

      // 8. Download the file
      pdf.save(`${fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("An error occurred while generating the PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExportPDF}
      disabled={isExporting}
      className="button buttonType5 textXXS"
    >
      {isExporting ? (
        <Spinner className="animate-spin" />
      ) : (
        <FilePdf weight="bold" />
      )}
      {isExporting ? "Generating PDF..." : "Export to PDF"}
    </button>
  );
}
