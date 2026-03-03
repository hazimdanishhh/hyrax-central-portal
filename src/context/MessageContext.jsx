import { createContext, useContext, useState, useCallback } from "react";

const MessageContext = createContext(null);

export function MessageProvider({ children }) {
  const [message, setMessage] = useState(null); // ✅ NULL by default

  /**
   * Show message globally
   */
  const showMessage = useCallback((text, type = "info") => {
    setMessage({ text, type });
  }, []);

  /**
   * Clear message manually
   */
  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  return (
    <MessageContext.Provider
      value={{
        message,
        showMessage,
        clearMessage,
        setMessage, // optional but useful
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}

export const useMessage = () => useContext(MessageContext);
