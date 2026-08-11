import {
  CaretCircleRightIcon,
  HandshakeIcon,
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
  PlusIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import Button from "../../../../../../components/buttons/button/Button";
import "./ClientSidebar.scss";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import { useState } from "react";
import Breadcrumbs from "../../../../../../components/breadcrumbs/Breadcrumbs";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import { useNavigate } from "react-router";
import DataForm from "../../../../../../components/crud/dataForm/DataForm";
import { useLeads } from "../../../../../../features/sales/leads/private/hooks/useLeads";
import useLeadMutations from "../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { useLeadsMetadata } from "../../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import { useEmployee } from "../../../../../../context/EmployeeContext";
import LeadsList from "../../../../../../components/sales/leads/leadsList/LeadsList";
import { leadTableConfig } from "./constants/leadTableConfig";
import DataTable from "../../../../../../components/dataTable/DataTable";
import { useClientSalesOrders } from "../../../../../../features/sales/orders/private/hooks/useClientSalesOrders";
import { salesOrdersTableConfig } from "../../../orders/tableConfig";

export default function ClientSidebar({
  selectedRow,
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const navigate = useNavigate();
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [tab, setTab] = useState("leads");
  const { employee } = useEmployee();

  // Client identity (2026-08): once linked to a real SAP customer, SAP's
  // data is authoritative for display -- name/phone/contact/city read from
  // the joined sap_customer relation (see clientsService.js/fetchClientById.js),
  // never the native clients.name/address, so there's no second copy left
  // to go stale. A client with no sap_customer_code is a genuine Prospect
  // (no SAP relationship yet), not an error state -- see
  // hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4 for the full
  // decision this implements.
  const isLinked = Boolean(selectedRow.sap_customer_code);
  const displayName = isLinked
    ? selectedRow.sap_customer?.customer_name
    : selectedRow.name;

  // ==============
  // LEADS
  // ==============
  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeads(selectedRow?.id);
  const {
    owners,
    leadSourceTypes,
    isLoading: leadsMetadataLoading,
    isFetching: leadsMetadataFetching,
    error: leadsMetadataError,
  } = useLeadsMetadata(); // Metadata
  const { createLead, creating: creatingLead } = useLeadMutations(); // Mutations
  const leadColumns = leadTableConfig({
    employee,
    owners,
    leadSourceTypes,
  }); // Table Config
  // Add Handler
  const handleAddLead = async (formData) => {
    await createLead({
      ...formData,
      client_id: selectedRow.id,
    });

    setIsAddingLead(false);
  };

  // ==============
  // ORDERS (SAP, read-only)
  // ==============
  const {
    data: ordersResult,
    isLoading: ordersLoading,
    error: ordersError,
  } = useClientSalesOrders(selectedRow?.sap_customer_code);
  const orders = ordersResult?.data ?? [];
  const orderColumns = salesOrdersTableConfig();

  return (
    <div className="clientSidebarContainer">
      {/* --- CLIENT DETAILS SECTION --- */}
      <CardLayout style="cardLayout1 generalCard clientSidebarLeft">
        {!isEditing ? (
          <Button
            name="Edit"
            icon={PencilSimpleLineIcon}
            style="button buttonType4 textXS"
            size={16}
            onClick={() => setIsEditing(!isEditing)}
          />
        ) : (
          <Button
            name="Cancel Edit"
            icon={PencilSimpleSlashIcon}
            onClick={() => setIsEditing(!isEditing)}
            style="button buttonType4 textXS"
            size={16}
          />
        )}
        <p className="textBold">{displayName}</p>

        <div className="clientSidebarDetailsContainer">
          {isLinked ? (
            <StatusBox
              status={`Linked — SAP ${selectedRow.sap_customer_code}`}
              type="green"
            />
          ) : (
            <StatusBox status="Prospect — not yet an SAP customer" type="grey" />
          )}
          {selectedRow.industry_id && (
            <StatusBox status={selectedRow.industry?.name} type="blue" />
          )}
        </div>
        <div className="generalCard cardPaddingSmall">
          {isLinked ? (
            <>
              <span className="textBold textXS">Contact: </span>
              <p className="textRegular textXS">
                {[
                  selectedRow.sap_customer?.contact_person,
                  selectedRow.sap_customer?.phone,
                  selectedRow.sap_customer?.city,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </>
          ) : (
            <>
              <span className="textBold textXS">Address: </span>
              <p className="textRegular textXS">{selectedRow.address}</p>
            </>
          )}
        </div>
      </CardLayout>

      <CardLayout>
        {/* TABS */}
        <div className="pageTabContainer">
          <Button
            icon2={HandshakeIcon}
            onClick={() => setTab("leads")}
            name="Leads"
            style={`button buttonTypeTab ${tab === "leads" && "active"}`}
          />
          <Button
            onClick={() => setTab("orders")}
            name="Orders"
            style={`button buttonTypeTab ${tab === "orders" && "active"}`}
          />
        </div>

        {/* LEADS TAB */}
        {tab === "leads" && (
          <CardLayout style="generalCard cardPaddingSmall">
            <PageHeader>
              <Breadcrumbs icon={HandshakeIcon} current="Latest Leads" />
              {/* ADD BUTTON */}
              <Button
                icon={PlusIcon}
                name="Add Lead"
                style="button buttonType5 approval textXS"
                size={16}
                onClick={() => setIsAddingLead(true)}
                disabled={isAddingLead}
              />
              {/* VIEW ALL BUTTON */}
              <Button
                icon={CaretCircleRightIcon}
                name="View All"
                style="button buttonType5 textXS"
                size={16}
                onClick={() =>
                  navigate(`/app/sales/leads/list?client=${selectedRow.id}`)
                }
                disabled={isAddingLead}
              />
            </PageHeader>

            {/* INLINE ADD FORM */}
            {isAddingLead && (
              <DataForm
                columns={leadColumns}
                rowData={{}}
                onSave={handleAddLead}
                onCancel={() => setIsAddingLead(false)}
                saving={creatingLead}
                creating
                inlineForm
                title="Add Lead"
              />
            )}

            <CardLayout style="cardWrapperScroll generalCard">
              {leadsLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : leadsError ? (
                <NoResult title="Error loading results" />
              ) : leads?.length === 0 ? (
                <NoResult />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {leads?.map((lead) => (
                    <LeadsList
                      key={lead.id}
                      lead={lead}
                      onClick={() =>
                        navigate(`/app/sales/leads/list/${lead.id}`)
                      }
                      setIsEditing={() => setIsEditingLead(true)}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>
          </CardLayout>
        )}

        {/* ORDERS TAB -- read-only sap_sales_orders, filtered by this
            client's sap_customer_code -> sap_sales_orders.customer_code,
            same bridge Orders.jsx's own Customer filter uses. Only ever
            populated for Linked clients -- a Prospect has no SAP customer
            code, so there's nothing to filter by yet. */}
        {tab === "orders" && (
          <CardLayout style="generalCard cardPaddingSmall">
            <PageHeader>
              <Breadcrumbs icon={ReceiptIcon} current="Recent Orders" />
              {/* VIEW ALL BUTTON */}
              <Button
                icon={CaretCircleRightIcon}
                name="View All"
                style="button buttonType5 textXS"
                size={16}
                onClick={() =>
                  navigate(
                    `/app/sales/orders/all?customerCode=${selectedRow.sap_customer_code}`,
                  )
                }
                disabled={!isLinked}
              />
            </PageHeader>

            <CardLayout style="cardWrapperScroll generalCard">
              {!isLinked ? (
                <NoResult title="Prospect — not yet linked to an SAP customer" />
              ) : ordersLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : ordersError ? (
                <NoResult title="Error loading results" />
              ) : orders.length === 0 ? (
                <NoResult />
              ) : (
                <DataTable data={orders} columns={orderColumns} rowKey="doc_entry" />
              )}
            </CardLayout>
          </CardLayout>
        )}
      </CardLayout>
    </div>
  );
}
