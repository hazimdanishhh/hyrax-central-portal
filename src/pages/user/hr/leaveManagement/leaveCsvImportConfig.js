// Concrete CsvImportModal config for HR2000 leave-CSV import -- see
// src/components/crud/csvImportModal/CsvImportModal.jsx for the generic
// engine this configures. This is that component's first real consumer,
// not a leave-specific one-off.
//
// EL_ELeaveData.csv has no header row, 6 raw columns: employee_code,
// leave_date (DD/MM/YYYY), leave_type, day_fraction, remarks, and a 6th
// column confirmed to be a mechanically ASCII-shifted duplicate of column 1
// -- discarded here (ignore: true), never sent to the RPC.
//
// Deliberately no per-field client-side validation or dedup here -- every
// row is sent to sync_leave_ledger_from_snapshot exactly as parsed (raw,
// trimmed strings); all real validation/identity logic lives server-side,
// so client and server can never disagree about what's valid or what
// counts as a duplicate.
export function getLeaveCsvImportConfig({ runImport, onImported }) {
  return {
    entityLabel: "leave record",
    expectedColumnCount: 6,
    columns: [
      { index: 0, key: "employee_code" },
      { index: 1, key: "leave_date" },
      { index: 2, key: "leave_type" },
      { index: 3, key: "day_fraction" },
      { index: 4, key: "remarks" },
      { index: 5, key: null, ignore: true },
    ],
    buildPayloadRow: (row) => ({
      employee_code: row.employee_code,
      leave_date: row.leave_date,
      leave_type: row.leave_type,
      day_fraction: row.day_fraction,
      remarks: row.remarks || null,
    }),
    runImport,
    onImported,

    // The sync AUTO-CREATES leave type codes it has not seen (since
    // 2026-09-23 -- before that, one unknown code aborted the entire upload
    // and there was no way to add the missing type from the portal, so leave
    // sync stopped and stayed stopped).
    //
    // An auto-created type defaults to is_paid = true, which is right more
    // often than not but is exactly WRONG for a new no-pay type -- and an
    // unpaid type reported as paid overstates paidLeaveDaysTotal in the
    // payroll package. So the import must SAY what it invented. Reporting it
    // here, with the link, is what makes the "default to paid" safe.
    resultNotices: (result) => {
      const created = result?.createdLeaveTypes || [];
      if (created.length === 0) return [];

      return [
        {
          text: `${created.length} new leave type${created.length === 1 ? "" : "s"} (${created.join(", ")}) ${created.length === 1 ? "was" : "were"} created from this file and default to PAID. Confirm whether that is correct --`,
          linkTo: "/app/hr/leaves/types",
          linkLabel: "review Leave Types",
        },
      ];
    },
  };
}
