import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import SideNav from "../components/sideNav/SideNav";
import MessageUI from "../components/messageUI/MessageUI";
import { useNotificationsRealtime } from "../features/notifications/private/hooks/useNotificationsRealtime";

export default function AppLayout() {
  useNotificationsRealtime();

  return (
    <div className="content">
      <SideNav />

      <main>
        <MessageUI />
        <Navbar />
        <Outlet />
      </main>
    </div>
  );
}
