import CardLayout from "../cardLayout/CardLayout";
import SectionHeader from "../sectionHeader/SectionHeader";

export default function ChartCard({ icon, title, children, style }) {
  return (
    <CardLayout style={`cardLayout1 generalCard ${style}`}>
      {title && <SectionHeader icon={icon} title={title} />}
      {children}
    </CardLayout>
  );
}
