import React from "react";

function PageTitle({ title, subtitle }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
        justifyContent: "start",
        gap: "8px",
        textAlign: "start",
      }}
    >
      <h2 className="textBold textXXL">{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

export default PageTitle;
