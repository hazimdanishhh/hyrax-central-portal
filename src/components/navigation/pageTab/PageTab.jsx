import { NavLink } from "react-router";
import "./PageTab.scss";

function PageTab({ tabs = [] }) {
  return (
    <div className="pageTabContainer">
      {tabs.map((tab, index) => {
        const Icon = tab.icon;

        return (
          <NavLink
            key={index}
            to={tab.to}
            className={({ isActive }) =>
              `button buttonTypeTab textRegular textXS ${
                isActive ? "active" : ""
              }`
            }
          >
            {Icon && (
              <div className="pageTabIcon">
                <Icon size={15} />
              </div>
            )}
            {tab.name}
          </NavLink>
        );
      })}
    </div>
  );
}

export default PageTab;
