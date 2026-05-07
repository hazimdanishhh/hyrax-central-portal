import { CaretLeftIcon, HouseIcon, WarningIcon } from "@phosphor-icons/react";
import RouterButton from "../../components/buttons/routerButton/RouterButton";
import { useTheme } from "../../context/ThemeContext";
import CardLayout from "../../components/cardLayout/CardLayout";
import "./Error404.scss";
import Button from "../../components/buttons/button/Button";
import { useNavigate } from "react-router";

export default function Error404() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <div className="errorPageContent">
            <WarningIcon size={40} weight="fill" />
            <h1>404</h1>
            <p className="textBold textM">Page Not Found</p>
            <Button
              name="Go Back"
              onClick={(e) => {
                navigate(-1);
              }}
              icon={CaretLeftIcon}
              style="button buttonType4"
            />
            <RouterButton
              name="Go Home"
              to="/app/"
              icon={HouseIcon}
              style="button buttonType4"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
