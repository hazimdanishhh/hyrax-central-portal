// This is a clear message timeout function
// Current message types = ["success", "error", "info", "loading"]

import { useEffect } from "react";

export function useClearMessage(message, setMessage, timeout = 3000) {
  useEffect(() => {
    if (message && message.type !== "loading") {
      const timer = setTimeout(() => setMessage(null), timeout);
      return () => clearTimeout(timer);
    }
    // If message type is not "loading", clear message with set timeout, otherwise infinite
  }, [message, setMessage, timeout]);
}
