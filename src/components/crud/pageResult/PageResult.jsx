import CardLayout from "../../cardLayout/CardLayout";
import Button from "../../buttons/button/Button";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import "./PageResult.scss";

export default function PageResult({
  data,
  totalCount,
  page,
  setPage,
  totalPages,
  error,
}) {
  const [inputValue, setInputValue] = useState(page);

  // keep input synced when page changes externally
  useEffect(() => {
    setInputValue(page);
  }, [page]);

  return (
    <CardLayout style="pageResultContainer">
      {error ? (
        <p className="textRegular textXXS">Error loading results</p>
      ) : (
        <p className="textRegular textXXS">
          <strong>Total Result: </strong>
          {data.length} / {totalCount}
        </p>
      )}

      <CardLayout style="pageNumberContainer">
        <Button
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
