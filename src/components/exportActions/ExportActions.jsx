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
      // 1. Initialize jsPDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let currentY = 15; // Start drawing 15mm from the top

      // 2. Add Logo (If provided)
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

      // 3. Add Report Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(30, 41, 59); // Dark slate color
      pdf.text(reportTitle, margin, currentY);
      currentY += 6;

      // 4. Add Subtitle / Metadata (e.g., Date and Filters)
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

      // 5. Capture and draw each dashboard section individually, breaking to a
      // new page when a section wouldn't fit -- avoids a single giant image
      // getting cut off at the page edge.
      const dashboardImageWidth = pageWidth - margin * 2;
      const sections = Array.from(
        targetRef.current.querySelectorAll(".pdfOverviewSection"),
      );
      const sectionsToCapture = sections.length ? sections : [targetRef.current];

      for (const section of sectionsToCapture) {
        const canvas = await html2canvas(section, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 1220,
          onclone: (clonedDoc, clonedElement) => {
            clonedElement.style.width = "1220px";
            clonedElement.style.minWidth = "1220px";
            clonedElement.style.backgroundColor = "#ffffff";
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        const dashboardImageHeight =
          (canvas.height * dashboardImageWidth) / canvas.width;

        // Smart pagination: if this section would overflow the page, start a new one
        if (
          currentY + dashboardImageHeight > pageHeight - margin &&
          currentY > margin + 20
        ) {
          pdf.addPage();
          currentY = margin;
        }

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

        currentY += dashboardImageHeight + 10;
      }

      // 6. Download the file
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
