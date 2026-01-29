import "../button/Button.scss";
import { useTheme } from "../../../context/ThemeContext";
import { Moon, Sun } from "phosphor-react";

function ThemeButton({ name, style }) {
  const { darkMode, toggleMode } = useTheme();

  return (
    <button onClick={toggleMode} className={style}>
      {name && (darkMode ? "Light Mode" : "Dark Mode")}

      {darkMode ? (
        <Sun size={style === "iconButton" ? "24" : "20"} />
      ) : (
        <Moon size={style === "iconButton" ? "24" : "20"} />
      )}
    </button>
  );
}

export default ThemeButton;
