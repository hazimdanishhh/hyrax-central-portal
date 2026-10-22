// src/pages/user/sales/reports/tabs/TabState.jsx

import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";

/**
 * Loading / error states shared by every tab. A tab's own failure shows
 * here and nowhere else -- the other tabs keep working.
 */
export default function TabState({ isLoading, error, children }) {
  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }
  if (error) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <NoResult
          title={
            /access denied/i.test(error.message ?? "")
              ? "You don't have access to Sales Reports."
              : "This tab couldn't load. The other tabs are unaffected."
          }
        />
      </CardLayout>
    );
  }
  return children;
}
