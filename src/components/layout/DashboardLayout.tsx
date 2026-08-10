import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import "./DashboardLayout.scss";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen((current) => !current);

  return (
    <div className="dashboard-container">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className={`sidebar-backdrop${isSidebarOpen ? " open" : ""}`} onClick={closeSidebar} />
      <div className="main-wrapper">
        <Navbar onToggleSidebar={toggleSidebar} />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}