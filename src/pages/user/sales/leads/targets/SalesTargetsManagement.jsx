// pages/user/sales/leads/targets/SalesTargetsManagement.jsx
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
import { fetchSalesTargets } from "../../../../../features/sales/salesTargets/private/api/salesTargetsService";
import useSalesTargetsMutations from "../../../../../features/sales/salesTargets/private/hooks/useSalesTargetsMutations";
import { useSalesTargetById } from "../../../../../features/sales/salesTargets/private/hooks/useSalesTargetById";
import { salesTargetsTableConfig } from "./tableConfig";
import { getSalesTargetsFilterConfig } from "./filterConfig";
import PageTitle from "../../../../../components/pageTitle/PageTitle";

/**
 * Sales Targets management (Forecast 1 -- CRM pipeline quota per rep).
 * Sales-manager-only, per lead_owner_id + target_month. Small settings-style
 * table -- no card/table layout toggle, no bulk actions.
 */
export default function SalesTargetsManagement() {
  const navigate = useNavigate();
  const { targetId } = useParams();
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
    data: salesTargets,
    totalCount,
    page,
    totalPages,
    filters,
    activeFilters,
    hasActiveFilters,
    setPage,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "sales_targets",
    queryFn: fetchSalesTargets,
    pageSize: 20,
    defaultSortBy: "target_month",
    defaultSortOrder: "descending",
  });

  const {
    createSalesTarget,
    updateSalesTarget,
    deleteSalesTarget,
    creating,
    updating,
    deleting,
  } = useSalesTargetsMutations();

  const filterConfig = getSalesTargetsFilterConfig();
  const columns = salesTargetsTableConfig();
  const tableColumns = columns.filter((c) => c.key !== "id");

  const isSaving = creating || updating;
  const hasData = salesTargets.length > 0;

  // URL-driven (:targetId), same pattern as EmployeeManagement.jsx -- check
  // the already-loaded page first, else fall back to useSalesTargetById for
  // a deep link to a row not on the current page. This page's sidebar is
  // always in edit mode whenever open (no separate view-only state), so
  // isEditing just mirrors sidebarOpen rather than needing its own toggle.
  const { data: fetchedTarget } = useSalesTargetById(targetId);

  const selectedRow = useMemo(() => {
    if (targetId === "new") return {};
    if (!targetId) return null;

    const targetInList = salesTargets?.find((t) => t.id === targetId);
    if (targetInList) return targetInList;

    return fetchedTarget || null;
  }, [targetId, salesTargets, fetchedTarget]);

  const sidebarOpen = !!selectedRow;

  function handleOpenSidebar(row) {
    navigate(`${row.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/sales/leads/targets?${searchParams.toString()}`);
  }

  async function handleConfirmAction() {
    try {
      if (modalType === "delete") {
        await deleteSalesTarget(selectedRowId);
      }

      if (modalType === "save") {
        if (pendingSaveRow.id) {
          await updateSalesTarget(pendingSaveRow);
        } else {
          await createSalesTarget(pendingSaveRow);
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
        title="Pipeline Targets"
        subtitle="Set and manage pipeline targets to track progress and performance against goals"
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
              name: "Add Target",
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
        data={salesTargets}
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
          <NoResult title="No targets set for this period yet." />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : (
          <DataTable
            data={salesTargets}
            columns={tableColumns}
            rowKey="id"
            onRowClick={handleOpenSidebar}
          />
        )}
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title={selectedRow?.id ? "Edit Target" : "Add Target"}
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
        title={modalType === "save" ? "Save Target" : "Delete Target"}
        description={
          modalType === "save"
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to delete this target?"
        }
        confirmText={modalType === "save" ? "Save" : "Delete"}
        loading={modalType === "save" ? isSaving : deleting}
        onConfirm={handleConfirmAction}
        modalType={modalType}
      />
    </>
  );
}
