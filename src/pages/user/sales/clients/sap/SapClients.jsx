// pages/user/sales/clients/sap/SapClients.jsx
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence } from "framer-motion";
import { UsersIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { fetchSapCustomers } from "../../../../../features/sales/clients/private/api/sapCustomersService";
import { useSapCustomer } from "../../../../../features/sales/clients/private/hooks/useSapCustomer";
import PageTitle from "../../../../../components/pageTitle/PageTitle";
import SapClientsList from "../../../../../components/sales/clients/sapClientsList/SapClientsList";
import SapClientSidebar from "./detail/SapClientSidebar";
import { getSapClientsFilterConfig } from "./filterConfig";

/**
 * Read-only SAP Clients list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/paginate over sap_customers
 * (OCRD), plus a read-only detail sidebar on click (same URL-driven pattern
 * as Prospects' ClientsManagement.jsx).
 */
export default function SapClients() {
  const navigate = useNavigate();
  const { customerCode } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: customers,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    activeFilters,
    hasActiveFilters,
    setPage,
    setSearch,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "sap_customers",
    queryFn: fetchSapCustomers,
    pageSize: 20,
    defaultSortBy: "customer_name",
    defaultSortOrder: "ascending",
  });

  const { data: fetchedCustomer } = useSapCustomer(customerCode);

  // Find selected row: current page's results first (instant UI), else fall
  // back to the direct fetch (for a shared URL to a customer not on this page).
  const selectedRow = useMemo(() => {
    if (!customerCode) return null;

    const customerInList = customers?.find(
      (customer) => customer.customer_code === customerCode,
    );
    if (customerInList) return customerInList;

    return fetchedCustomer || null;
  }, [customerCode, customers, fetchedCustomer]);

  const sidebarOpen = !!selectedRow;

  const filterConfig = getSapClientsFilterConfig();
  const hasData = customers.length > 0;

  function handleOpenSidebar(customer) {
    navigate(`${customer.customer_code}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/sales/clients/sap?${searchParams.toString()}`);
  }

  return (
    <>
      <PageTitle
        title="SAP Clients"
        subtitle="Customer records synced from SAP"
      />

      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search SAP clients..."
      />

      {/* ACTIVE FILTERS */}
      {hasActiveFilters && (
        <ActiveFiltersBar
          search={search}
          setSearch={setSearch}
          filters={activeFilters}
          setFilters={setFilters}
          filterConfig={filterConfig}
          resetParams={resetParams}
        />
      )}

      {/* RESULT NUMBER + NEXT AND PREVIOUS BUTTONS */}
      <PageResult
        data={customers}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      {/* CARD LIST */}
      <CardLayout style="cardWrapperScroll generalCard">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult />
        ) : error ? (
          <NoResult title="Error Loading Results" />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {customers.map((customer) => (
              <SapClientsList
                key={customer.customer_code}
                customer={customer}
                onClick={() => handleOpenSidebar(customer)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      {/* DETAIL SIDEBAR (read-only) */}
      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="SAP Client"
            icon={UsersIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <SapClientSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
