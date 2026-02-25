import { HouseIcon } from "@phosphor-icons/react";
import RouterButton from "../../components/buttons/routerButton/RouterButton";
import { useTheme } from "../../context/ThemeContext";

export default function Error404() {
  const { darkMode, toggleMode } = useTheme();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <h1>404</h1>
          <p>Page not found</p>
          <RouterButton
            name="Go Back"
            to="/app"
            icon={HouseIcon}
            style="button buttonType2"
          />
        </div>
      </div>
    </section>
  );
}
