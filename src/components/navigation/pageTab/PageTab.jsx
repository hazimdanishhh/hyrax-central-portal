import "./PageTab.scss";
import Button from "../../buttons/button/Button";
import TabScroller from "@/components/navigation/tabScroller/TabScroller";

function PageTab({ tabs = [], style, currentTab, onTabChange }) {
  return (
    <TabScroller ariaLabel="Page sections">
      {tabs.map((tab, index) => (
        <Button
          key={index}
          name={tab}
          onClick={() => onTabChange(index)}
          style={`button buttonTypeTab textRegular textXS ${style} ${
            currentTab === index ? "active" : ""
          }`}
        />
      ))}
    </TabScroller>
  );
}

export default PageTab;
