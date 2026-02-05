import "./EmployeeStatus.scss";

function EmployeeStatus({ status }) {
  return (
    <>
      <span
        className={
          status === "active"
            ? "textLight textXXS employeeStatus active"
            : "textLight textXXS employeeStatus inactive"
        }
      >
        <div
          className={
            status === "active"
              ? "textLight textXXS statusLight active"
              : "textLight textXXS statusLight inactive"
          }
        />
        {status || "Status Undefined"}
      </span>
    </>
  );
}

export default EmployeeStatus;
