// components/attendanceActivityClockin/clockInSidebar/ClockInSidebar.jsx

import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { CalendarDotsIcon } from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import LoadingIcon from "../../loadingIcon/LoadingIcon";

/**
 * The clock-in form (2026-10-22), shared by ClockinMini (SideNav, MobileNav)
 * and BottomTabBar's clock button. Pass it the fields from
 * useClockInOutAction().
 *
 * Rendered through a portal into document.body, never in place. DataSidebar
 * is `position: fixed`, and a fixed element is laid out against its nearest
 * ancestor with a transform, filter or backdrop-filter instead of the screen
 * when one exists: inside BottomTabBar (backdrop-filter) it would be squeezed
 * into the 60px bar, and inside MobileNav (translateZ) it sat in the
 * drawer's stacking context below the bottom bar, which covered its Save
 * button.
 */
export default function ClockInSidebar({
  sidebarOpen,
  attendanceTypesLoading,
  columns,
  closeClockIn,
  handleClockIn,
  saving,
}) {
  return createPortal(
    <AnimatePresence>
      {sidebarOpen &&
        (attendanceTypesLoading ? (
          <LoadingIcon />
        ) : (
          <DataSidebar
            title="Attendance Activity"
            icon={CalendarDotsIcon}
            open={sidebarOpen}
            onClose={closeClockIn}
            rowData={{}}
            columns={columns}
            onSave={handleClockIn}
            // `saving` is what disables DataForm's submit button
            // (DataForm.jsx:193). Both clock-in sidebars omitted it, so the
            // button stayed live for the whole insert -- the other half of
            // the duplicate-row problem, alongside the ref guard in
            // useClockInOutAction.
            saving={saving}
            creating
          />
        ))}
    </AnimatePresence>,
    document.body,
  );
}
