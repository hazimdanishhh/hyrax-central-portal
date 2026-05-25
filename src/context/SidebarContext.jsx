import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";

import { AnimatePresence } from "framer-motion";
import DataSidebar from "../components/dataSidebar/DataSidebar";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [sidebar, setSidebar] = useState({
    open: false,

    // DataSidebar props
    title: "",
    icon: null,
    rowData: {},
    columns: [],

    onSave: null,
    onDelete: null,
    onCancel: null,
    onClose: null,

    creating: false,
    saving: false,
    deleting: false,

    cannotUpdate: false,
    isEditing: true,
    fullPage: false,

    children: null,
  });

  /**
   * OPEN SIDEBAR
   */
  const openSidebar = useCallback((config) => {
    setSidebar({
      open: true,

      title: config.title || "",
      icon: config.icon || null,
      rowData: config.rowData || {},
      columns: config.columns || [],

      onSave: config.onSave || null,
      onDelete: config.onDelete || null,
      onCancel: config.onCancel || null,
      onClose: config.onClose || null,

      creating: config.creating || false,
      saving: config.saving || false,
      deleting: config.deleting || false,

      cannotUpdate: config.cannotUpdate || false,
      isEditing: config.isEditing !== undefined ? config.isEditing : true,

      fullPage: config.fullPage || false,

      children: config.children || null,
    });
  }, []);

  /**
   * CLOSE SIDEBAR
   */
  const closeSidebar = useCallback(() => {
    // 1. Run the side-effect (like navigation) OUTSIDE the state updater
    if (sidebar.onClose) {
      sidebar.onClose();
    }

    // 2. Only perform pure state updates inside the setter
    setSidebar((prev) => ({
      ...prev,
      open: false,
    }));
  }, [sidebar.onClose]);

  /**
   * UPDATE SIDEBAR
   * Useful for toggling edit state dynamically
   */
  const updateSidebar = useCallback((updates) => {
    setSidebar((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const value = useMemo(
    () => ({
      sidebar,
      openSidebar,
      closeSidebar,
      updateSidebar,
    }),
    [sidebar, openSidebar, closeSidebar, updateSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {sidebar.open && (
          <DataSidebar
            title={sidebar.title}
            icon={sidebar.icon}
            open={sidebar.open}
            onClose={closeSidebar}
            rowData={sidebar.rowData}
            columns={sidebar.columns}
            onSave={sidebar.onSave}
            onDelete={sidebar.onDelete}
            onCancel={sidebar.onCancel}
            creating={sidebar.creating}
            saving={sidebar.saving}
            deleting={sidebar.deleting}
            cannotUpdate={sidebar.cannotUpdate}
            isEditing={sidebar.isEditing}
            fullPage={sidebar.fullPage}
          >
            {sidebar.children}
          </DataSidebar>
        )}
      </AnimatePresence>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }

  return context;
}
