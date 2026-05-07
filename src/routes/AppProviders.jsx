// src/routes/AppProviders.jsx

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/reactQuery";
import { AuthProvider } from "../context/AuthContext";
import { ProfileProvider } from "../context/ProfileContext";
import { AccessControlProvider } from "../context/AccessControlContext";
import { EmployeeProvider } from "../context/EmployeeContext";
import ThemeProvider from "../context/ThemeContext";
import { MessageProvider } from "../context/MessageContext";
import { AttendanceProvider } from "../context/AttendanceProvider";

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProfileProvider>
          <AccessControlProvider>
            <EmployeeProvider>
              <ThemeProvider>
                <MessageProvider>
                  <AttendanceProvider>{children}</AttendanceProvider>
                </MessageProvider>
              </ThemeProvider>
            </EmployeeProvider>
          </AccessControlProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
