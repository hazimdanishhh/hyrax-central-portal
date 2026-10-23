// src/pages/user/sales/reports/tabs/ReportSection.jsx

/**
 * A titled block inside a Sales Reports tab -- the same heading markup the
 * single-page report used (chartSection / chartHeading), so sections look
 * unchanged. `pdfOverviewSection` keeps each section together in the PDF.
 */
export default function ReportSection({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <div className="pdfOverviewSection">
      <div
        className="chartSection"
        style={{ gap: "1rem", display: "flex", flexDirection: "column" }}
      >
        <div className="chartHeading">
          <div className="chartTitle">
            {Icon && <Icon size={24} />}
            <h2 className="textL textBold">{title}</h2>
          </div>
          {description && <p className="textXS textLight">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
