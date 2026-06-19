import { motion, AnimatePresence } from "framer-motion";
import "./ActionModal.scss";
import Button from "../../buttons/button/Button";
import { useEffect, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import GoogleDrivePicker from "../../googleDrive/GoogleDrivePicker";

export default function ActionModal({
  open,
  onClose,
  title = "Confirm Action",
  description = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  loading = false,
  requireInput = false,
  inputPlaceholder = "Enter reason...",
  modalType,
  // ADD THESE PROPS
  requireQuotation = false,
  requireWonDetails = false,
}) {
  const { darkMode } = useTheme();

  // CHANGE STATE to an object to handle multiple fields
  const [formValues, setFormValues] = useState({
    reason: "",
    quotation_url: "",
    po_number: "",
    po_document_url: "",
    actual_revenue: "",
  });

  useEffect(() => {
    if (open) {
      setFormValues({
        reason: "",
        quotation_url: "",
        po_number: "",
        po_document_url: "",
        actual_revenue: "",
      });
    }
  }, [open]);

  if (!open) return null;

  // DYNAMIC VALIDATION: Disable confirm if required fields are empty
  const isConfirmDisabled = () => {
    if (loading) return true;
    if (requireInput && !formValues.reason) return true;
    if (requireQuotation && !formValues.quotation_url) return true;
    if (
      requireWonDetails &&
      (!formValues.po_number ||
        !formValues.po_document_url ||
        !formValues.actual_revenue)
    )
      return true;
    return false;
  };

  const handleConfirm = () => {
    if (isConfirmDisabled()) return;
    onConfirm(formValues); // Return the whole object instead of just 'reason'
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modalOverlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={
            darkMode ? "modalContent sectionDark" : "modalContent sectionLight"
          }
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          <h3>{title}</h3>
          <p>{description}</p>

          <div className="flex flex-col gap-4 mt-4">
            {/* ORIGINAL REASON INPUT */}
            {requireInput && (
              <input
                type="text"
                placeholder={inputPlaceholder}
                value={formValues.reason}
                onChange={(e) =>
                  setFormValues({ ...formValues, reason: e.target.value })
                }
              />
            )}

            {/* QUOTATION INPUT (For PROPOSAL -> NEGOTIATION) */}
            {requireQuotation && (
              <div className="flex flex-col gap-1">
                <label className="textXXS textBold">Quotation Document *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1"
                    placeholder="No document selected..."
                    value={formValues.quotation_url}
                  />
                  <GoogleDrivePicker
                    label="Attach"
                    onSelect={(file) =>
                      setFormValues({ ...formValues, quotation_url: file.url })
                    }
                  />
                </div>
              </div>
            )}

            {/* WON DETAILS INPUTS (For NEGOTIATION -> WON) */}
            {requireWonDetails && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="textXXS textBold">
                    Actual Revenue (RM) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={formValues.actual_revenue}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        actual_revenue: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="textXXS textBold">PO Number (SAP) *</label>
                  <input
                    type="text"
                    placeholder="Enter PO Number"
                    value={formValues.po_number}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        po_number: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="textXXS textBold">
                    Purchase Order Document *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      className="flex-1"
                      placeholder="No PO selected..."
                      value={formValues.po_document_url}
                    />
                    <GoogleDrivePicker
                      label="Attach"
                      onSelect={(file) =>
                        setFormValues({
                          ...formValues,
                          po_document_url: file.url,
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modalActions mt-6">
            <Button
              name={cancelText}
              style="button buttonType4 textXXS"
              onClick={onClose}
              disabled={loading}
            />

            <Button
              name={confirmText}
              style={
                modalType === "approve" || modalType === "save"
                  ? "button buttonTypeApprove textXXS"
                  : "button buttonTypeDelete textXXS"
              }
              onClick={handleConfirm}
              disabled={isConfirmDisabled()}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
