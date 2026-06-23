import { motion, AnimatePresence } from "framer-motion";
import "./ActionModal.scss";
import Button from "../../buttons/button/Button";
import { useEffect, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import GoogleDrivePicker from "../../googleDrive/GoogleDrivePicker";
import { XIcon } from "@phosphor-icons/react";

export default function ActionModal({
  open,
  onClose,
  title = "Confirm Action",
  description = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  loading = false,
  modalType,
  fields = [], // NEW: Array of field configurations
}) {
  const { darkMode } = useTheme();
  const [formValues, setFormValues] = useState({});

  // Reset and initialize dynamic fields when modal opens
  useEffect(() => {
    if (open) {
      const initialValues = {};
      fields.forEach((field) => {
        initialValues[field.name] = field.defaultValue || "";
      });
      setFormValues(initialValues);
    }
  }, [open, fields]);

  if (!open) return null;

  // Dynamically check if required fields are filled
  const isConfirmDisabled = () => {
    if (loading) return true;
    for (const field of fields) {
      if (field.required && !formValues[field.name]) {
        return true;
      }
    }
    return false;
  };

  const handleConfirm = () => {
    if (isConfirmDisabled()) return;
    onConfirm(formValues);
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
          <button onClick={onClose} className="modalCloseButton">
            <XIcon size={24} />
          </button>

          <h3>{title}</h3>
          {description && <p>{description}</p>}

          <div className="modalInputContainer">
            {/* DYNAMIC FIELD RENDERING */}
            {fields.map((field) => (
              <div key={field.name} className="modalInputSegment">
                {field.label && (
                  <label className="textXXS textBold">
                    {field.label} {field.required && "*"}
                  </label>
                )}

                {field.type === "drive" ? (
                  <div className="modalInput">
                    <input
                      type="text"
                      readOnly
                      className="flex-1"
                      placeholder={
                        field.placeholder || "No document selected..."
                      }
                      value={formValues[field.name] || ""}
                    />
                    <GoogleDrivePicker
                      label="Attach"
                      onSelect={(file) =>
                        setFormValues({ ...formValues, [field.name]: file.url })
                      }
                    />
                  </div>
                ) : field.type === "select" ? (
                  /* NEW: SELECT DROPDOWN LOGIC */
                  <select
                    className="inputField flex-1"
                    value={formValues[field.name] || ""}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        [field.name]: e.target.value,
                      })
                    }
                  >
                    <option value="" disabled>
                      {field.placeholder || "Select an option..."}
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || "text"}
                    min={field.min}
                    placeholder={field.placeholder}
                    value={formValues[field.name] || ""}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        [field.name]: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            ))}
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
