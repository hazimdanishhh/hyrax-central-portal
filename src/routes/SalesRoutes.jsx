import { Navigate, Route } from "react-router-dom";
import Quotations from "../pages/user/sales/quotations/Quotations";
import Reports from "../pages/user/sales/reports/Reports";
import AccessRoute from "./AccessRoute";
import LeadsManagement from "../pages/user/sales/leads/list/LeadsManagement";
import LeadsPageLayout from "../pages/user/sales/leads/LeadsPageLayout";
import LeadsOverview from "../pages/user/sales/leads/overview/LeadsOverview";
import ClientsPageLayout from "../pages/user/sales/clients/ClientsPageLayout";
import ClientsManagement from "../pages/user/sales/clients/list/ClientsManagement";
import SapClients from "../pages/user/sales/clients/sap/SapClients";
import Orders from "../pages/user/sales/orders/Orders";
import OrdersPageLayout from "../pages/user/sales/orders/OrdersPageLayout";
import SalesBudgetsManagement from "../pages/user/sales/orders/budgets/SalesBudgetsManagement";
import SalesTargetsManagement from "../pages/user/sales/leads/targets/SalesTargetsManagement";

export default (
  <Route path="sales">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* REPORTS */}
    <Route
      path="reports"
      element={
        <AccessRoute departments={["SAL", "MGM"]} roles={["manager"]}>
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
      <Route index element={<Navigate to="prospects" replace />} />

      <Route
        path="prospects"
        element={
          <AccessRoute departments={["SAL"]}>
            <ClientsManagement />
          </AccessRoute>
        }
      >
        <Route path=":clientId" element={null} />
      </Route>

      <Route
        path="sap"
        element={
          <AccessRoute departments={["SAL"]}>
            <SapClients />
          </AccessRoute>
        }
      >
        <Route path=":customerCode" element={null} />
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

      {/* TARGETS (Forecast 1 -- CRM pipeline quota per rep) */}
      <Route
        path="targets"
        element={
          <AccessRoute departments={["SAL"]} roles={["manager"]}>
            <SalesTargetsManagement />
          </AccessRoute>
        }
      />
    </Route>

    {/* SALES ORDERS */}
    <Route
      path="orders"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <OrdersPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="all" replace />} />
      <Route
        path="all"
        element={
          <AccessRoute departments={["SAL"]} roles={["manager"]}>
            <Orders />
          </AccessRoute>
        }
      />

      {/* BUDGETS (Forecast 2 -- SAP invoice quota per rep) */}
      <Route
        path="budgets"
        element={
          <AccessRoute departments={["SAL"]} roles={["manager"]}>
            <SalesBudgetsManagement />
          </AccessRoute>
        }
      />
    </Route>

    {/* QUOTATIONS -- intentional placeholder, not an orphan route (confirmed
        2026-08). This is reserved for a future in-app quotation-generation
        feature; Hyrax doesn't use SAP's own quotation module (OQUT/QUT1),
        same "feature exists in SAP, never turned on" pattern as OCFW/OCFT/
        OPRC/OFAA elsewhere. Nav entry stays commented out in
        sideNavLinkData.js until the page has real content. */}
    <Route
      path="quotations"
      element={
        <AccessRoute departments={["SAL"]}>
          <Quotations />
        </AccessRoute>
      }
    />
  </Route>
);
