import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import "./DashboardLayout.scss";


export default function DashboardLayout() {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}