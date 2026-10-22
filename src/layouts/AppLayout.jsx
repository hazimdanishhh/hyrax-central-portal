import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import SideNav from "../components/sideNav/SideNav";
import MobileNav from "../components/mobileNav/MobileNav";
import MessageUI from "../components/messageUI/MessageUI";
import { useNotificationsRealtime } from "../features/notifications/private/hooks/useNotificationsRealtime";
import BottomTabBar from "../components/bottomTabBar/BottomTabBar";

// Navigation by screen size:
//   > 768px  SideNav + Navbar (profile, notifications, refresh)
//   ≤ 768px  BottomTabBar + the MobileNav drawer its Menu button opens; the
//            Navbar is hidden, its profile and refresh moved into the drawer
// The drawer's open state lives here (it used to live inside Navbar) because
// the bar that opens it and the drawer itself are siblings now.
export default function AppLayout() {
  useNotificationsRealtime();
  const [mobileNavIsOpen, setMobileNavIsOpen] = useState(false);
  const { pathname } = useLocation();

  // Any navigation closes the drawer: a link inside it, a bottom-bar tab, or
  // the browser back button.
  useEffect(() => {
    setMobileNavIsOpen(false);
  }, [pathname]);

  return (
    <div className="content">
      <SideNav />

      <main>
        <MessageUI />
        <Navbar />
        <Outlet />
      </main>

      <MobileNav
        mobileNavIsOpen={mobileNavIsOpen}
        onClose={() => setMobileNavIsOpen(false)}
      />
      <BottomTabBar
        menuOpen={mobileNavIsOpen}
        onMenuToggle={() => setMobileNavIsOpen((open) => !open)}
      />
    </div>
  );
}
