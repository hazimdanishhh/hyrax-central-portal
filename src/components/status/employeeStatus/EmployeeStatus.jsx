import "./EmployeeStatus.scss";

function EmployeeStatus({ status }) {
  return (
    <>
      <span
        className={
          status === "active" || status === "Active"
            ? "textLight textXXXS employeeStatus active"
            : "textLight textXXXS employeeStatus inactive"
        }
      >
        <div
          className={
            status === "active" || status === "Active"
              ? "textLight textXXXS statusLight active"
              : "textLight textXXXS statusLight inactive"
          }
        />
        {status || "Status Undefined"}
      </span>
    </>
  );
}

export default EmployeeStatus;
