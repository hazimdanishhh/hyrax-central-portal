import { PackageIcon } from "@phosphor-icons/react";
import "./NoResult.scss";

function NoResult({ title }) {
  return (
    <div className="noResultContainer">
      <PackageIcon size={40} weight="fill" />
      <p className="textBold textM">{title || "No results found"}</p>
    </div>
  );
}

export default NoResult;
