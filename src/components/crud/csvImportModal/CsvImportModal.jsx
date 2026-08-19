import { useRef, useState } from "react";
import {
  UploadSimpleIcon,
  WarningIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import DataTable from "../../dataTable/DataTable";
import CardLayout from "../../cardLayout/CardLayout";
import Button from "../../buttons/button/Button";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import { parseCsvFile, buildImportRows, buildPayload } from "./csvImportUtils";
import "./CsvImportModal.scss";

/**
 * Generic, config-driven CSV bulk-import engine. Not specific to any one
 * feature -- pass a `config` describing the expected columns and how to run
 * the import, and this component handles the file-select -> parse ->
 * preview -> (guardrail) -> result flow, built on the existing DataSidebar
 * (isEditing=false, fullPage) rather than a new modal shell.
 *
 * config shape:
 *   entityLabel: string                      -- e.g. "leave record"
 *   expectedColumnCount: number
 *   columns: [{ index, key, label, ignore }] -- positional column spec
 *   buildPayloadRow: (row) => object          -- keyed row -> RPC payload row
 *   runImport: ({ rows, dryRun, allowShrink }) => Promise<summary>
 *   guardrailMessage: (summary) => string
 *   onImported: () => void                    -- called once a sync actually commits
 */
export default function CsvImportModal({ open, onClose, title, icon, config }) {
  // select -> preview -> guardrail -> result -> error
  const [step, setStep] = useState("select");
  const [busy, setBusy] = useState(false);
  const [payloadRows, setPayloadRows] = useState([]);
  const [shapeErrors, setShapeErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [guardrail, setGuardrail] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const inputRef = useRef();

  function reset() {
    setStep("select");
    setBusy(false);
    setPayloadRows([]);
    setShapeErrors([]);
    setPreview(null);
    setGuardrail(null);
    setResult(null);
    setErrorMessage("");
    setErrorDetails([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function parseRpcError(err) {
    // Postgres RAISE EXCEPTION ... USING detail = '<jsonb array>' surfaces
    // here as err.details (a JSON string) -- see sync_leave_ledger_rpc.sql's
    // structural-validation block.
    let details = [];
    if (err?.details) {
      try {
        details = JSON.parse(err.details);
      } catch {
        details = [];
      }
    }
    return { message: err?.message || "Import failed.", details };
  }

  async function handleFileSelected(file) {
    if (!file) return;

    setBusy(true);
    try {
      const rawRows = await parseCsvFile(file);
      const { rows, shapeErrors: errs, isEmpty } = buildImportRows(
        rawRows,
        config,
      );

      if (isEmpty || errs.length > 0) {
        setShapeErrors(errs);
        setErrorMessage(
          isEmpty
            ? "The file is empty."
            : "This file doesn't look like the expected export -- some rows have the wrong number of columns.",
        );
        setStep("error");
        return;
      }

      const rpcRows = buildPayload(rows, config);
      setPayloadRows(rpcRows);

      const summary = await config.runImport({
        rows: rpcRows,
        dryRun: true,
        allowShrink: false,
      });

      setPreview(summary);
      setStep("preview");
    } catch (err) {
      const { message, details } = parseRpcError(err);
      setErrorMessage(message);
      setErrorDetails(details);
      setStep("error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleConfirmPreview() {
    setBusy(true);
    try {
      const summary = await config.runImport({
        rows: payloadRows,
        dryRun: false,
        allowShrink: false,
      });

      if (summary.status === "blocked_guardrail") {
        setGuardrail(summary);
        setStep("guardrail");
      } else {
        setResult(summary);
        setStep("result");
        config.onImported?.();
      }
    } catch (err) {
      const { message, details } = parseRpcError(err);
      setErrorMessage(message);
      setErrorDetails(details);
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleForceSync() {
    setBusy(true);
    try {
      const summary = await config.runImport({
        rows: payloadRows,
        dryRun: false,
        allowShrink: true,
      });
      setResult(summary);
      setStep("result");
      config.onImported?.();
    } catch (err) {
      const { message, details } = parseRpcError(err);
      setErrorMessage(message);
      setErrorDetails(details);
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  const skipped = preview?.skipped || result?.skipped || [];

  if (!open) return null;

  return (
    <DataSidebar
      title={title}
      icon={icon}
      open={open}
      onClose={handleClose}
      isEditing={false}
      fullPage
    >
      <div className="csvImportModal">
        {/* SELECT */}
        {step === "select" && (
          <CardLayout style="cardLayout1 cardGapSmall csvImportSelect">
            <p className="textRegular textXS">
              Upload a CSV of {config.entityLabel}s to sync. Expected format:{" "}
              {config.expectedColumnCount} columns, no header row.
            </p>

            {busy ? (
              <LoadingIcon />
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
                <Button
                  name="Select CSV File"
                  icon2={UploadSimpleIcon}
                  style="button buttonType2"
                  onClick={() => inputRef.current.click()}
                />
              </>
            )}
          </CardLayout>
        )}

        {/* ERROR (structural: bad file shape, or a rejected-whole-batch RPC exception) */}
        {step === "error" && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportBanner csvImportBannerError">
              <XCircleIcon size={20} weight="fill" />
              <p className="textRegular textXS">{errorMessage}</p>
            </div>

            {(shapeErrors.length > 0 || errorDetails.length > 0) && (
              <DataTable
                data={shapeErrors.length > 0 ? shapeErrors : errorDetails}
                rowKey={shapeErrors.length > 0 ? "lineNumber" : "src_ordinal"}
                columns={
                  shapeErrors.length > 0
                    ? [
                        { key: "lineNumber", label: "Line", getValue: (r) => r.lineNumber },
                        { key: "columnCount", label: "Columns Found", getValue: (r) => r.columnCount },
                        { key: "expected", label: "Expected", getValue: (r) => r.expected },
                        { key: "raw", label: "Row", getValue: (r) => r.raw },
                      ]
                    : [
                        { key: "src_ordinal", label: "Line", getValue: (r) => r.src_ordinal },
                        { key: "employee_code", label: "Employee Code", getValue: (r) => r.employee_code },
                        { key: "leave_date", label: "Date", getValue: (r) => r.leave_date },
                        { key: "leave_type", label: "Type", getValue: (r) => r.leave_type },
                        { key: "reason", label: "Reason", getValue: (r) => r.reason },
                      ]
                }
              />
            )}

            <Button
              name="Try Again"
              icon2={ArrowClockwiseIcon}
              style="button buttonType4"
              onClick={reset}
            />
          </CardLayout>
        )}

        {/* PREVIEW (dry run -- nothing written yet) */}
        {step === "preview" && preview && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportStatRow">
              <StatTile label="Would Add" value={preview.wouldAddCount} />
              <StatTile label="Unchanged" value={preview.wouldKeepCount} />
              <StatTile
                label="Would Remove"
                value={preview.wouldRemoveCount}
                emphasize={preview.wouldRemoveCount > 0}
              />
            </div>

            {preview.wouldTripGuardrail && (
              <div className="csvImportBanner csvImportBannerWarning">
                <WarningIcon size={20} weight="fill" />
                <p className="textRegular textXS">
                  This upload looks significantly smaller than what's currently
                  stored -- you'll be asked to confirm before anything is
                  removed.
                </p>
              </div>
            )}

            {skipped.length > 0 && (
              <SkippedTable skipped={skipped} />
            )}

            <div className="csvImportActions">
              <Button
                name="Cancel"
                style="button buttonType4"
                onClick={handleClose}
                disabled={busy}
              />
              <Button
                name={busy ? "Syncing..." : "Continue"}
                style="button buttonType2"
                onClick={handleConfirmPreview}
                disabled={busy}
              />
            </div>
          </CardLayout>
        )}

        {/* GUARDRAIL CONFIRMATION -- nothing has been written yet */}
        {step === "guardrail" && guardrail && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportBanner csvImportBannerWarning">
              <WarningIcon size={20} weight="fill" />
              <p className="textRegular textXS">{guardrail.message}</p>
            </div>

            <p className="textBold textXS">
              {guardrail.wouldRemoveCount} record(s) would be removed:
            </p>
            <DataTable
              data={guardrail.wouldRemoveSample || []}
              rowKey="leave_date"
              columns={[
                { key: "employee_code", label: "Employee", getValue: (r) => r.employee_code },
                { key: "leave_date", label: "Date", getValue: (r) => r.leave_date },
                { key: "leave_type_code", label: "Type", getValue: (r) => r.leave_type_code },
              ]}
            />

            <div className="csvImportActions">
              <Button
                name="Cancel"
                style="button buttonType4"
                onClick={() => setStep("preview")}
                disabled={busy}
              />
              <Button
                name={busy ? "Syncing..." : "Force Sync Anyway"}
                style="button buttonTypeDelete"
                onClick={handleForceSync}
                disabled={busy}
              />
            </div>
          </CardLayout>
        )}

        {/* RESULT -- the sync has committed */}
        {step === "result" && result && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportBanner csvImportBannerSuccess">
              <CheckCircleIcon size={20} weight="fill" />
              <p className="textRegular textXS">Sync complete.</p>
            </div>

            <div className="csvImportStatRow">
              <StatTile label="Added" value={result.added} />
              <StatTile label="Unchanged" value={result.updated} />
              <StatTile
                label="Removed"
                value={result.removed}
                emphasize={result.removed > 0}
              />
            </div>

            {result.removed > 0 && (
              <>
                <p className="textBold textXS csvImportRemovedHeading">
                  Removed -- these leave records were no longer present in the
                  new export (approved leave rescinded upstream):
                </p>
                <DataTable
                  data={result.removedSample || []}
                  rowKey="leave_date"
                  columns={[
                    { key: "employee_code", label: "Employee", getValue: (r) => r.employee_code },
                    { key: "leave_date", label: "Date", getValue: (r) => r.leave_date },
                    { key: "leave_type_code", label: "Type", getValue: (r) => r.leave_type_code },
                  ]}
                />
              </>
            )}

            {skipped.length > 0 && <SkippedTable skipped={skipped} />}

            <Button name="Done" style="button buttonType2" onClick={handleClose} />
          </CardLayout>
        )}
      </div>
    </DataSidebar>
  );
}

function StatTile({ label, value, emphasize }) {
  return (
    <div className={`csvImportStatTile ${emphasize ? "emphasize" : ""}`}>
      <p className="textBold textL">{value ?? 0}</p>
      <p className="textLight textXXS">{label}</p>
    </div>
  );
}

function SkippedTable({ skipped }) {
  return (
    <>
      <p className="textBold textXS">
        Skipped ({skipped.length}) -- couldn't be matched, everything else was
        still synced:
      </p>
      <DataTable
        data={skipped}
        rowKey="src_ordinal"
        columns={[
          { key: "employee_code", label: "Employee Code", getValue: (r) => r.employee_code },
          { key: "leave_date", label: "Date", getValue: (r) => r.leave_date },
          { key: "leave_type", label: "Type", getValue: (r) => r.leave_type },
          { key: "reason", label: "Reason", getValue: (r) => r.reason },
        ]}
      />
    </>
  );
}
