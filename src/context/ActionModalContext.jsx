import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import ActionModal from "../components/modals/actionModal/ActionModal";

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({
    open: false,

    title: "",
    description: "",
    confirmText: "",
    cancelText: "",

    modalType: "confirm",

    loading: false,

    requireInput: false,
    inputPlaceholder: "",

    onConfirm: null,
    onClose: null,
  });

  /**
   * OPEN MODAL
   */
  const openModal = useCallback((config) => {
    setModal({
      open: true,

      title: config.title || "",
      description: config.description || "",
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Cancel",

      modalType: config.modalType || "confirm",

      loading: config.loading || false,

      // ADD THESE TWO:
      requireInput: config.requireInput || false,
      inputPlaceholder: config.inputPlaceholder || "Enter reason...",

      onConfirm: config.onConfirm || null,
      onClose: config.onClose || null,
    });
  }, []);
  /**
   * CLOSE MODAL
   */
  const closeModal = useCallback(() => {
    // 1. Run the side-effect OUTSIDE the state updater
    if (modal.onClose) {
      modal.onClose();
    }

    // 2. Only perform pure state updates inside the setter
    setModal((prev) => ({
      ...prev,
      open: false,
      loading: false,
    }));
  }, [modal.onClose]); // <-- Add modal.onClose as a dependency

  /**
   * UPDATE MODAL
   */
  const updateModal = useCallback((updates) => {
    setModal((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  /**
   * CONFIRM
   */
  const handleConfirm = useCallback(
    async (reason) => {
      if (modal.onConfirm) {
        setModal((prev) => ({ ...prev, loading: true }));

        try {
          await modal.onConfirm(reason);
        } catch (error) {
          console.error("Action failed:", error);
        } finally {
          setModal((prev) => ({ ...prev, loading: false }));
          closeModal();
        }
      } else {
        closeModal();
      }
    },
    [modal.onConfirm, closeModal],
  );

  const value = useMemo(
    () => ({
      modal,
      openModal,
      closeModal,
      updateModal,
    }),
    [modal, openModal, closeModal, updateModal],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}

      <ActionModal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        description={modal.description}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        loading={modal.loading}
        onConfirm={handleConfirm}
        modalType={modal.modalType}
        requireInput={modal.requireInput}
        inputPlaceholder={modal.inputPlaceholder}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used inside ModalProvider");
  }

  return context;
}
