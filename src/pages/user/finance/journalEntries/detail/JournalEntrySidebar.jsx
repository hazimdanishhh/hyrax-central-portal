import { BookOpenIcon } from "@phosphor-icons/react";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import { formatDate } from "../../../../../functions/formatDate";
import { useJournalEntryLines } from "../../../../../features/finance/journalEntries/private/hooks/useJournalEntryLines";
import { journalLinesTableConfig } from "./journalLinesTableConfig";

/**
 * Read-only detail view for a GL journal entry -- no Edit button anywhere,
 * no isEditing/setIsEditing received, which is what keeps DataSidebar
 * permanently in its read-only (children-only) mode for this entity.
 */
export default function JournalEntrySidebar({ selectedRow }) {
  const {
    data: lines,
    isLoading,
    error,
  } = useJournalEntryLines(selectedRow?.trans_id);

  const columns = journalLinesTableConfig();
  const hasData = lines?.length > 0;

  return (
    <>
      <CardLayout style="cardLayout1 generalCard cardPadding">
        <DetailFieldGrid
          fields={[
            { label: "Memo", value: selectedRow.memo },
            { label: "Reference", value: selectedRow.reference_1 },
            { label: "Reference 2", value: selectedRow.reference_2 },
            { label: "Trans. Type", value: selectedRow.trans_type },
            {
              label: "Posting Date",
              value: formatDate(selectedRow.posting_date),
            },
            { label: "Due Date", value: formatDate(selectedRow.due_date) },
          ]}
        />
      </CardLayout>

      <CardLayout style="generalCard cardPaddingSmall">
        <SectionHeader icon={BookOpenIcon} title="Line Items" />

        {isLoading ? (
          <LoadingIcon />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : !hasData ? (
          <NoResult />
        ) : (
          <DataTable data={lines} columns={columns} rowKey="line_id" />
        )}
      </CardLayout>
    </>
  );
}
