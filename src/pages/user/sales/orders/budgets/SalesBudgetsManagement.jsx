// pages/user/sales/orders/budgets/SalesBudgetsManagement.jsx
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import useCrudActionState from "../../../../../hooks/useCrudActionState";
import { fetchSalesBudgets } from "../../../../../features/sales/salesBudgets/private/api/salesBudgetsService";
import { useSalesBudgetsMetadata } from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetsMetadata";
import useSalesBudgetsMutations from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetsMutations";
import { useSalesBudgetById } from "../../../../../features/sales/salesBudgets/private/hooks/useSalesBudgetById";
import { salesBudgetsTableConfig } from "./tableConfig";
import { getSalesBudgetsFilterConfig } from "./filterConfig";
import PageTitle from "../../../../../components/pageTitle/PageTitle";

/**
 * Sales Budgets management (Forecast 2 -- SAP invoice quota per rep).
 * Sales-manager-only, per sales_rep_code + budget_month. Small settings-style
 * table -- no card/table layout toggle, no bulk actions.
 */
export default function SalesBudgetsManagement() {
  const navigate = useNavigate();
  const { budgetId } = useParams();
  const [searchParams] = useSearchParams();

  const {
    modalOpen,
    selectedRowId,
    modalType,
    pendingSaveRow,
    handleRequestSave,
    handleRequestDelete,
    closeActionModal,
  } = useCrudActionState();

  const {
    data: salesBudgets,
    totalCount,
    page,
    totalPages,
    filters,
    activeFilters,
    hasActiveFilters,
    setPage,
    setFilters,
    resetParams,
    isLoading: budgetsLoading,
    isFetching: budgetsFetching,
    error: budgetsError,
  } = usePaginatedQuery({
    queryKey: "sales_budgets",
    queryFn: fetchSalesBudgets,
    pageSize: 20,
    defaultSortBy: "budget_month",
    defaultSortOrder: "descending",
  });

  const {
    salesReps,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useSalesBudgetsMetadata();

  const {
    createSalesBudget,
    updateSalesBudget,
    deleteSalesBudget,
    creating,
    updating,
    deleting,
  } = useSalesBudgetsMutations();

  const filterConfig = getSalesBudgetsFilterConfig({ salesReps });
  const columns = salesBudgetsTableConfig({ salesReps });
  const tableColumns = columns.filter((c) => c.key !== "id");

  const isLoading = budgetsLoading || metadataLoading;
  const isFetching = budgetsFetching || metadataFetching;
  const error = budgetsError || metadataError;
  const isSaving = creating || updating;
  const hasData = salesBudgets.length > 0;

  // URL-driven (:budgetId), same pattern as EmployeeManagement.jsx -- check
  // the already-loaded page first, else fall back to useSalesBudgetById for
  // a deep link to a row not on the current page. Sidebar is always in
  // edit mode whenever open (no view-only state), so isEditing just
  // mirrors sidebarOpen.
  const { data: fetchedBudget } = useSalesBudgetById(budgetId);

  const selectedRow = useMemo(() => {
    if (budgetId === "new") return {};
    if (!budgetId) return null;

    const budgetInList = salesBudgets?.find((b) => b.id === budgetId);
    if (budgetInList) return budgetInList;

    return fetchedBudget || null;
  }, [budgetId, salesBudgets, fetchedBudget]);

  const sidebarOpen = !!selectedRow;

  function handleOpenSidebar(row) {
    navigate(`${row.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/sales/orders/budgets?${searchParams.toString()}`);
  }

  async function handleConfirmAction() {
    try {
      if (modalType === "delete") {
        await deleteSalesBudget(selectedRowId);
      }

      if (modalType === "save") {
        if (pendingSaveRow.id) {
          await updateSalesBudget(pendingSaveRow);
        } else {
          await createSalesBudget(pendingSaveRow);
        }
      }

      closeActionModal();
      handleCloseSidebar();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <PageTitle
        title="Sales Budgets"
        subtitle="Set and manage sales budgets to track progress and performance against goals"
      />

      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        disableSearch
      />

      <PageHeader>
        <PageActions
          actionButtons={[
            {
              icon: PlusCircleIcon,
              name: "Add Budget",
              onClick: () => {
                navigate(`new?${searchParams.toString()}`);
              },
              style: "button buttonType5 approval textXXS",
            },
          ]}
        />
      </PageHeader>

      {hasActiveFilters && (
        <ActiveFiltersBar
          filters={activeFilters}
          setFilters={setFilters}
          filterConfig={filterConfig}
          resetParams={resetParams}
        />
      )}

      <PageResult
        data={salesBudgets}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      <div className="cardWrapperScroll">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult title="No budgets set for this period yet." />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : (
          <DataTable
            data={salesBudgets}
            columns={tableColumns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
          />
        )}
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit Budget" : "Add Budget"}
            icon={PencilSimpleLineIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            rowData={selectedRow}
            columns={columns}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            saving={isSaving}
            deleting={deleting}
            creating={!selectedRow?.id}
            isEditing={sidebarOpen}
            onCancel={handleCloseSidebar}
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={closeActionModal}
        title={modalType === "save" ? "Save Budget" : "Delete Budget"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this budget?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={modalType === "save" ? isSaving : deleting}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
