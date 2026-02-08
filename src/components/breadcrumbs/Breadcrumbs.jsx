import { CaretRight } from "phosphor-react";
import "./Breadcrumbs.scss";
import { Link } from "react-router";
import SectionHeader from "../sectionHeader/SectionHeader";

function Breadcrumbs({ icon, current, icon1, to1, name1 }) {
  const Icon = icon;
  const Icon1 = icon1;

  return (
    <div className="breadcrumbsWrapper">
      {to1 && name1 && (
        <>
          <Link to={to1} className="breadcrumbLink">
            {Icon1 && <Icon1 size="16" weight="fill" />}
            <p className="textBold textXS">{name1}</p>
          </Link>
          <CaretRight size={16} />
        </>
      )}

      <div className="breadcrumbCurrent">
        {Icon && <Icon size="16" weight="fill" />}
        {current && <p className="textBold textXS">{current}</p>}
      </div>
    </div>
  );
}

export default Breadcrumbs;
