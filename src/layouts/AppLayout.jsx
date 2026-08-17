import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import SideNav from "../components/sideNav/SideNav";
import MessageUI from "../components/messageUI/MessageUI";
import GeneralAccessBanner from "../components/generalAccessBanner/GeneralAccessBanner";

export default function AppLayout() {
  return (
    <div className="content">
      <SideNav />

      <main>
        <MessageUI />
        <Navbar />
        <GeneralAccessBanner />
        <Outlet />
      </main>
    </div>
  );
}
