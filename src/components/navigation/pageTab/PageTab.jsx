import { useState } from "react";
import "./PageTab.scss";
import Button from "../../buttons/button/Button";

function PageTab({ tabs = [], style, currentTab, onTabChange }) {
  return (
    <div className="pageTabContainer">
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
    </div>
  );
}

export default PageTab;
