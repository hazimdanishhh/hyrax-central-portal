import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import SideNav from "../components/sideNav/SideNav";

export default function AppLayout() {
  return (
    <div className="content">
      <SideNav />

      <main>
        <Navbar />
        <Outlet />
      </main>
    </div>
  );
}
