import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence } from "framer-motion";
import { IdentificationBadgeIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchBusinessPartners } from "../../../../features/finance/businessPartners/private/api/businessPartnersService";
import { useBusinessPartner } from "../../../../features/finance/businessPartners/private/hooks/useBusinessPartner";
import BusinessPartnersList from "../../../../components/finance/businessPartnersList/BusinessPartnersList";
import BusinessPartnerSidebar from "./detail/BusinessPartnerSidebar";
import { getBusinessPartnersFilterConfig } from "./filterConfig";

/**
 * Read-only Business Partners list -- Finance's own view of sap_customers
 * (OCRD), broadened beyond Sales' Customer+Lead-only "SAP Clients" page
 * (sapCustomersService.js) to default to Customer+Vendor instead, since
 * Finance reconciles both AR and AP. See businessPartnersService.js's own
 * comment for the cardType default/override logic. SAP is the system of
 * record, so there's no create/edit/delete here, just
 * search/filter/paginate, plus a read-only detail sidebar on click (same
 * URL-driven pattern as SapClients.jsx).
 */
export default function BusinessPartners() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { customerCode } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: partners,
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
    queryKey: "finance_business_partners",
    queryFn: fetchBusinessPartners,
    pageSize: 20,
    defaultSortBy: "customer_name",
    defaultSortOrder: "ascending",
  });

  const { data: fetchedPartner } = useBusinessPartner(customerCode);

  // Same fallback shape as SapClients.jsx's own selectedRow -- current
  // page's results first (instant UI), else the direct fetch (a shared URL,
  // or a customer/vendor badge deep-linking straight here from an
  // Invoice/Payment/Bill/Vendor Payment card).
  const selectedRow = useMemo(() => {
    if (!customerCode) return null;

    const partnerInList = partners?.find(
      (partner) => partner.customer_code === customerCode,
    );
    if (partnerInList) return partnerInList;

    return fetchedPartner || null;
  }, [customerCode, partners, fetchedPartner]);

  const sidebarOpen = !!selectedRow;

  const filterConfig = getBusinessPartnersFilterConfig();
  const hasData = partners.length > 0;

  function handleOpenSidebar(partner) {
    navigate(`${partner.customer_code}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/finance/business-partners?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs
            icon={IdentificationBadgeIcon}
            current="Business Partners"
          />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search business partners..."
            />

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

            <PageResult
              data={partners}
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
                <NoResult />
              ) : error ? (
                <NoResult title="Error loading results" />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {partners.map((partner) => (
                    <BusinessPartnersList
                      key={partner.customer_code}
                      partner={partner}
                      onClick={() => handleOpenSidebar(partner)}
                    />
                  ))}
                </CardLayout>
              )}
            </div>
          </CardWrapper>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Business Partner"
            icon={IdentificationBadgeIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <BusinessPartnerSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
