import CardLayout from "../../cardLayout/CardLayout";
import Button from "../../buttons/button/Button";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import "./PageResult.scss";
import { useTheme } from "../../../context/ThemeContext";

// "Showing 1–50 of 134" (with a page size), else "Showing 20 of 134".
function resultText(shown, total, page, pageSize) {
  if (!total) return "No results";
  if (!pageSize) return `Showing ${shown} of ${total}`;
  const from = (page - 1) * pageSize + 1;
  return `Showing ${from}–${from + shown - 1} of ${total}`;
}

export default function PageResult({
  data,
  totalCount,
  page,
  setPage,
  totalPages,
  error,
  // Optional (2026-10-27, §9a): the page size, for "Showing 1–50 of 134",
  // and children (e.g. the SortBar) shown next to the count.
  pageSize,
  children,
}) {
  const [inputValue, setInputValue] = useState(page);
  const { darkMode } = useTheme();

  // keep input synced when page changes externally
  useEffect(() => {
    setInputValue(page);
  }, [page]);

  return (
    <CardLayout style={`pageResultContainer ${darkMode ? "dark" : "light"}`}>
      {error ? (
        <p className="textRegular textXXS">Error loading results</p>
      ) : (
        <div className="pageResultSummary">
          <p className="textRegular textXXS">
            {resultText(data.length, totalCount, page, pageSize)}
          </p>
          {children}
        </div>
      )}

      <CardLayout style="pageNumberContainer">
        <Button
          size={20}
          icon={CaretLeftIcon}
          disabled={page === 1}
          style="iconButton2 textXXS"
          // onClick={() => setPage((p) => Math.max(1, p - 1))}
          onClick={() => setPage(page - 1)}
        />

        {/* Page Input */}
        <div className="pageInputContainer">
          Page:
          <input
            type="number"
            value={inputValue}
            min={1}
            max={totalPages || 1}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                let nextPage = Number(inputValue);

                if (isNaN(nextPage)) return;

                // clamp value
                nextPage = Math.max(1, Math.min(nextPage, totalPages || 1));

                setPage(nextPage);
              }
            }}
            onBlur={() => {
              // optional: apply when user clicks away
              let nextPage = Number(inputValue);

              if (isNaN(nextPage)) {
                setInputValue(page);
                return;
              }

              nextPage = Math.max(1, Math.min(nextPage, totalPages || 1));

              setPage(nextPage);
            }}
            className="pageInput"
          />
          /{totalPages === 0 ? 1 : totalPages}
        </div>

        <Button
          size={20}
          icon={CaretRightIcon}
          disabled={totalPages === 0 || page === totalPages}
          style="iconButton2 textXXS"
          // onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
          onClick={() => setPage(page + 1)}
        />
      </CardLayout>
    </CardLayout>
  );
}
