import { PackageIcon } from "@phosphor-icons/react";
import "./NoResult.scss";

function NoResult() {
  return (
    <div className="noResultContainer">
      <PackageIcon size={40} weight="fill" />
      <p className="textBold textM">No results found</p>
    </div>
  );
}

export default NoResult;
