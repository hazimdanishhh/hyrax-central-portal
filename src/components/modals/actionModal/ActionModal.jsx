import { motion, AnimatePresence } from "framer-motion";
import "./ActionModal.scss";
import Button from "../../buttons/button/Button";
import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";

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
}) {
  const { darkMode } = useTheme();

  const [inputValue, setInputValue] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    if (requireInput && !inputValue) return;
    onConfirm(inputValue);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modalOverlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={
            darkMode ? "modalContent sectionDark" : "modalContent sectionLight"
          }
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          <h3>{title}</h3>
          <p>{description}</p>

          {requireInput && (
            <textarea
              placeholder={inputPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          )}

          <div className="modalActions">
            <Button
              name={cancelText}
              style="button buttonType4 textXXS"
              onClick={onClose}
              disabled={loading}
            />

            <Button
              name={confirmText}
              style={
                modalType === "approve"
                  ? "button buttonTypeApprove textXXS"
                  : "button buttonTypeDelete textXXS"
              }
              onClick={handleConfirm}
              disabled={loading || (requireInput && !inputValue)}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
