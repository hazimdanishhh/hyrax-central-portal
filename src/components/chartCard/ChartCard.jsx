import CardLayout from "../cardLayout/CardLayout";
import SectionHeader from "../sectionHeader/SectionHeader";

export default function ChartCard({ icon, title, subtitle, children, style }) {
  return (
    <CardLayout style={`cardLayout1 generalCard ${style}`}>
      {title && <SectionHeader icon={icon} title={title} />}
      {subtitle && <p className="textLight textXXXS">{subtitle}</p>}

      {children}
    </CardLayout>
  );
}
