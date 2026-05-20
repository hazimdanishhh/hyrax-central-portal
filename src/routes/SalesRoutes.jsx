import { Navigate, Route } from "react-router-dom";
import Quotations from "../pages/user/sales/quotations/Quotations";
import Reports from "../pages/user/sales/reports/Reports";
import AccessRoute from "./AccessRoute";
import LeadsManagement from "../pages/user/sales/leads/list/LeadsManagement";
import LeadsPageLayout from "../pages/user/sales/leads/LeadsPageLayout";
import LeadsOverview from "../pages/user/sales/leads/overview/LeadsOverview";
import ClientsPageLayout from "../pages/user/sales/clients/ClientsPageLayout";
import ClientsOverview from "../pages/user/sales/clients/overview/ClientsOverview";
import ClientsManagement from "../pages/user/sales/clients/list/ClientsManagement";
import ContactsManagement from "../pages/user/sales/clients/contacts/ContactsManagement";

export default (
  <Route path="sales">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* REPORTS */}
    <Route
      path="reports"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Reports />
        </AccessRoute>
      }
    />

    {/* CLIENTS */}
    <Route
      path="clients"
      element={
        <AccessRoute departments={["SAL"]}>
          <ClientsPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["SAL"]}>
            <ClientsOverview />
          </AccessRoute>
        }
      />

      <Route
        path="list"
        element={
          <AccessRoute departments={["SAL"]}>
            <ClientsManagement />
          </AccessRoute>
        }
      >
        <Route path=":clientId" element={null} />
      </Route>

      <Route
        path="contacts"
        element={
          <AccessRoute departments={["SAL"]}>
            <ContactsManagement />
          </AccessRoute>
        }
      >
        <Route path=":contactId" element={null} />
      </Route>
    </Route>

    {/* OPPORTUNITIES */}
    <Route
      path="leads"
      element={
        <AccessRoute departments={["SAL"]}>
          <LeadsPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["SAL"]}>
            <LeadsOverview />
          </AccessRoute>
        }
      />

      <Route
        path="list"
        element={
          <AccessRoute departments={["SAL"]}>
            <LeadsManagement />
          </AccessRoute>
        }
      >
        <Route path=":leadId" element={null} />
      </Route>
    </Route>

    {/* QUOTATIONS */}
    <Route
      path="quotations"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Quotations />
        </AccessRoute>
      }
    />
  </Route>
);
