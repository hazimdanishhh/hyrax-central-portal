import { ShieldWarningIcon } from "@phosphor-icons/react";
import "./UnauthorizedUser.scss";

function UnauthorizedUser({ title }) {
  return (
    <div className="unauthorizedContainer">
      <ShieldWarningIcon size={40} weight="fill" />
      <p className="textBold textM">
        {title || "You do not have access to this page"}
      </p>
    </div>
  );
}

export default UnauthorizedUser;
