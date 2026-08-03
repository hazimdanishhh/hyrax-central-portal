import { useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { LifebuoyIcon } from "@phosphor-icons/react";
import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import NoResult from "@/components/crud/noResult/NoResult";
import HelpSearchBar from "@/components/help/helpSearchBar/HelpSearchBar";
import { helpCategories, allHelpItems } from "@/data/help";
import { filterHelpItems, getHelpTabPathForType } from "@/functions/helpSearch";
import "./HelpPageLayout.scss";

// Route stays fully universal (R2 -- no AccessRoute wrapper anywhere in
// HelpRoutes.jsx) -- don't add role/department gating here.
export default function HelpPageLayout() {
  const { darkMode } = useTheme();
  const [search, setSearch] = useState("");

  const searchResults = useMemo(
    () => filterHelpItems(allHelpItems, search),
    [search],
  );

  const isSearching = search.trim().length > 0;

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={LifebuoyIcon} current="Help & Support" />

          <CardWrapper>
            <HelpSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search FAQs, guides, glossary, contacts..."
            />

            {isSearching ? (
              searchResults.length === 0 ? (
                <NoResult title="No matching Help content" />
              ) : (
                <div className="helpSearchResults">
                  {searchResults.map((item) => (
                    <NavLink
                      key={item.id}
                      to={`/app/help/${getHelpTabPathForType(item.type)}`}
                      className="helpSearchResultCard generalCard"
                      onClick={() => setSearch("")}
                    >
                      <span className="helpSearchResultType textXXS textLight">
                        {item.type}
                      </span>
                      <p className="textBold textXS">{item.title}</p>
                      {item.summary && (
                        <p className="textLight textXXS">{item.summary}</p>
                      )}
                    </NavLink>
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="pageTabContainer">
                  {helpCategories.map((category) => {
                    const Icon = category.icon;

                    return (
                      <NavLink
                        key={category.id}
                        to={`/app/help/${category.path}`}
                        className={({ isActive }) =>
                          `button buttonTypeTab textRegular textXS ${
                            isActive ? "active" : ""
                          }`
                        }
                      >
                        <div className="pageTabIcon">
                          <Icon size={15} />
                        </div>
                        {category.label}
                      </NavLink>
                    );
                  })}
                </div>
                <Outlet />
              </>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
