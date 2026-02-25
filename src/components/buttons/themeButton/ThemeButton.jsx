import "../button/Button.scss";
import { useTheme } from "../../../context/ThemeContext";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";

function ThemeButton({ name, style }) {
  const { darkMode, toggleMode } = useTheme();

  return (
    <button onClick={toggleMode} className={style}>
      {name && (darkMode ? "Light Mode" : "Dark Mode")}

      {darkMode ? (
        <SunIcon size={style === "iconButton" ? "24" : "20"} />
      ) : (
        <MoonIcon size={style === "iconButton" ? "24" : "20"} />
      )}
    </button>
  );
}

export default ThemeButton;
