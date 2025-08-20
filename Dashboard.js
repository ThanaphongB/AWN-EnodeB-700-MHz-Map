// Dashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { database as db } from "./firebase-config";
import { ref, onValue } from "firebase/database";
import { Bar, Line } from "react-chartjs-2";
import "chart.js/auto";
import "chartjs-adapter-date-fns";

import { FaMapMarkedAlt, FaMoon, FaSun, FaBars, FaTimes, FaServer, FaQuestionCircle } from "react-icons/fa";


export default function Dashboard() {
  const [sites, setSites] = useState([]);
  const [alarms, setAlarms] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDownOnly, setShowDownOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const colors = {
    bg: darkMode ? "#121212" : "#f9f9f9",
    text: darkMode ? "#eee" : "#222",
    headerBg: darkMode ? "#1f1f1f" : "#e0e0e0",
    downBg: darkMode ? "#3a1f1f" : "#ffd6d6",
    onlineBg: darkMode ? "#1b1b1b" : "#e6ffe6",
    downColor: darkMode ? "#ff6b6b" : "#d10b0b",
    onlineColor: darkMode ? "#75c575" : "#117a11",
    cardBg: darkMode ? "#1e1e2f" : "#ffffff",
    cardShadow: darkMode ? "0 6px 20px rgba(0,0,0,0.5)" : "0 6px 20px rgba(0,0,0,0.1)",
    sidebarBg: darkMode ? "#1b1b1b" : "#ffffff",
    sidebarText: darkMode ? "#eee" : "#222"
  };

  // Load Data
  useEffect(() => {
    const sitesRef = ref(db, "geojson_sites");
    const alarmsRef = ref(db, "enodeb_alarms");
    onValue(sitesRef, snapshot => { if (snapshot.exists()) setSites(Object.values(snapshot.val())); });
    onValue(alarmsRef, snapshot => { if (snapshot.exists()) setAlarms(snapshot.val()); setLoading(false); });
  }, []);

  const sitesWithStatus = useMemo(() =>
    sites.map(site => {
      const alarm = Object.values(alarms).find(a => a.eNodeB_Site_Code === site.awn_site_code);
      const isDown = alarm && alarm.status !== "NORMAL" && (!alarm.alarm_cleared || alarm.alarm_cleared === "");
      return { ...site, isDown, alarm };
    }), [sites, alarms]);

  const filteredSites = useMemo(() => {
    let result = sitesWithStatus;
    if (showDownOnly) result = result.filter(s => s.isDown);
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.awn_site_code.toLowerCase().includes(lower) ||
        (s.province && s.province.toLowerCase().includes(lower)) ||
        (s.district && s.district.toLowerCase().includes(lower))
      );
    }
    return result;
  }, [sitesWithStatus, showDownOnly, searchTerm]);

  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSites.slice(start, start + itemsPerPage);
  }, [filteredSites, currentPage]);

  const totalSites = sitesWithStatus.length;
  const downSites = sitesWithStatus.filter(s => s.isDown);
  const onlineSites = totalSites - downSites.length;

  // Chart Data
  // Chart Data
  const downByProvince = {};
  downSites.forEach(s => {
    if (s.province && s.province.trim() !== "") {
      const prov = s.province.trim();
      downByProvince[prov] = (downByProvince[prov] || 0) + 1;
    }
  });
  const chartData = {
    labels: Object.keys(downByProvince),
    datasets: [{
      label: "Sites Down",
      data: Object.values(downByProvince),
      backgroundColor: "rgba(255, 99, 132, 0.8)",
      borderColor: "rgba(255, 99, 132, 1)",
      borderWidth: 1,
      borderRadius: 6
    }]
  };

  const chartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      axis: "y",
      intersect: true,
    },
    plugins: {
      legend: { labels: { color: colors.text, font: { size: 13 } } },
      tooltip: {
        enabled: true,
        mode: "nearest",
        axis: "y",
        intersect: true,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
      },
    },
    scales: {
      x: {
        ticks: { color: colors.text, font: { size: 13 } },
        grid: { color: darkMode ? "#333" : "#ccc" },
        beginAtZero: true,
        barPercentage: 0.8,
        categoryPercentage: 0.9,
      },
      y: {
        ticks: { color: colors.text, font: { size: 13 } },
        grid: { color: darkMode ? "#333" : "#ccc" },
      },
    },
  };

  const formatDate = (isoString) => { if (!isoString) return null; const d = new Date(isoString); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
  const occurredCountByDate = {}; const clearedCountByDate = {};
  Object.values(alarms).forEach(alarm => {
    const occurredDate = formatDate(alarm.alarm_occurred);
    if (occurredDate) occurredCountByDate[occurredDate] = (occurredCountByDate[occurredDate] || 0) + 1;
    const clearedDate = formatDate(alarm.alarm_cleared);
    if (clearedDate) clearedCountByDate[clearedDate] = (clearedCountByDate[clearedDate] || 0) + 1;
  });
  const allDates = Array.from(new Set([...Object.keys(occurredCountByDate), ...Object.keys(clearedCountByDate)])).sort();
  const occurredData = allDates.map(d => occurredCountByDate[d] || 0);
  const clearedData = allDates.map(d => clearedCountByDate[d] || 0);
  const timeSeriesData = {
    labels: allDates,
    datasets: [
      { label: "Alarm Occurred", data: occurredData, borderColor: "#f44336", backgroundColor: "rgba(244,67,54,0.25)", fill: true, tension: 0.3 },
      { label: "Alarm Cleared", data: clearedData, borderColor: "#4caf50", backgroundColor: "rgba(76,175,80,0.25)", fill: true, tension: 0.3 },
    ]
  };
  const timeSeriesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: colors.text, font: { size: 13 } } },
      tooltip: { mode: 'index', intersect: false, titleFont: { size: 14 }, bodyFont: { size: 13 } }
    },
    scales: {
      x: { ticks: { color: colors.text, font: { size: 13 } }, grid: { color: darkMode ? "#333" : "#ccc" } },
      y: { ticks: { color: colors.text, font: { size: 13 } }, grid: { color: darkMode ? "#333" : "#ccc" } },
    }
  };

  if (loading) return <p style={{ textAlign: "center", marginTop: 50, color: colors.text }}>กำลังโหลดข้อมูล...</p>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: colors.bg, color: colors.text, fontSize: 14, transition:"all 0.3s" }}>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} darkMode={darkMode} setDarkMode={setDarkMode} colors={colors} />
      <MainContent
        sites={sitesWithStatus} downSites={downSites.length} onlineSites={onlineSites}
        paginatedSites={paginatedSites} currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages}
        chartData={chartData} chartOptions={chartOptions} timeSeriesData={timeSeriesData} timeSeriesOptions={timeSeriesOptions}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm} showDownOnly={showDownOnly} setShowDownOnly={setShowDownOnly}
        colors={colors}
      />
    </div>
  );
}

// Sidebar Component
// Sidebar Component (เต็ม พร้อม sub-menu)
// Sidebar Component - VSCode Style
const Sidebar = ({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode, colors }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const menuItems = [
    { label: "Map", icon: <FaMapMarkedAlt />, onClick: () => window.location.href = "mapenodeB_updated.html" },
    { label: "Database", icon: <FaServer />, onClick: () => window.location.href = "https://console.firebase.google.com/project/login-mnoc-700-mhz/database/login-mnoc-700-mhz-default-rtdb/data?fb_gclid=CjwKCAjwtfvEBhAmEiwA-DsKjjRWv1tF5KycIYkhLMXzz0twfSE_RIaOfAHJk63Ak4Ka8Kc2y898BhoCLfIQAvD_BwE" },
    { label: "Settings", icon: <FaBars />, subMenu: [
      { label: "General", onClick: () => window.location.href = "settings_general.html" },
      { label: "Notifications", onClick: () => window.location.href = "settings_notifications.html" },
      { label: "User Management", onClick: () => window.location.href = "settings_users.html" }
    ]},
    { label: "Help", icon: <FaQuestionCircle />, onClick: () => window.location.href = "help.html" }, 
    { label: darkMode ? "Light Mode" : "Dark Mode", icon: darkMode ? <FaSun /> : <FaMoon />, onClick: () => setDarkMode(!darkMode) }
  ];

  const sidebarBgGradient = darkMode 
    ? "linear-gradient(180deg, #1a1a1a 0%, #2c2c2c 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #e0e0e0 100%)";

  const hoverGradient = darkMode 
    ? "linear-gradient(90deg, #4caf50 0%, #81c784 100%)"
    : "linear-gradient(90deg, #4285F4 0%, #6fa8f9 100%)";

  return (
    <div style={{
      flex: sidebarOpen ? "0 0 240px" : "0 0 60px",
      transition: "flex 0.3s ease",
      background: sidebarBgGradient,
      display: "flex",
      flexDirection: "column",
      padding: sidebarOpen ? 20 : 12,
      borderRadius: "0 12px 12px 0",
      boxShadow: "4px 0 20px rgba(0,0,0,0.25)",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Toggle Sidebar */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          background: "transparent",
          border: "none",
          color: colors.sidebarText,
          fontSize: 20,
          cursor: "pointer",
          borderRadius: "50%",
          width: 42,
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          marginBottom: sidebarOpen ? 24 : 0,
          transform: sidebarOpen ? "rotate(180deg)" : "rotate(0deg)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}
      >
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Logo */}
      {sidebarOpen && (
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: colors.accent }}>MNOC</h2>
        </div>
      )}

      {/* Menu Items */}
      {menuItems.map((item, idx) => (
        <div
          key={idx}
          style={{ position: "relative", marginBottom: 6 }}
          onMouseEnter={() => setHoveredMenu(idx)}
          onMouseLeave={() => setHoveredMenu(null)}
        >
          <MenuButton
            sidebarOpen={sidebarOpen}
            icon={item.icon}
            label={item.label}
            active={activeMenu === idx}
            onClick={() => {
              setActiveMenu(activeMenu === idx ? null : idx);
              item.onClick && item.onClick();
            }}
            hoverGradient={hoverGradient}
          />

          {/* Tooltip when mini mode */}
          {!sidebarOpen && hoveredMenu === idx && (
            <div style={{
              position: "absolute",
              left: 60,
              top: 0,
              padding: "6px 12px",
              background: hoverGradient,
              color: "#fff",
              borderRadius: 6,
              whiteSpace: "nowrap",
              fontSize: 13,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              transition: "opacity 0.3s",
              opacity: 1
            }}>
              {item.label}
            </div>
          )}

          {/* Sub Menu */}
          {item.subMenu && (
            <div style={{
              maxHeight: activeMenu === idx ? `${item.subMenu.length * 46}px` : "0px",
              overflow: "hidden",
              transition: "max-height 0.4s ease",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginLeft: sidebarOpen ? 16 : 0,
            }}>
              {item.subMenu.map((sub, sidx) => (
                <button
                  key={sidx}
                  onClick={sub.onClick}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: colors.text,
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                    transition: "all 0.25s ease",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = hoverGradient}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// MenuButton Component with Gradient Hover
const MenuButton = ({ sidebarOpen, icon, label, active, onClick, hoverGradient }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: sidebarOpen ? "12px 16px" : "12px 0",
      width: "100%",
      border: "none",
      background: active ? hoverGradient : "transparent",
      color: active ? "#fff" : "#ccc",
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 14,
      transition: "all 0.3s ease",
      justifyContent: sidebarOpen ? "flex-start" : "center",
      boxShadow: active ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
      position: "relative"
    }}
    onMouseEnter={e => { if(!active) e.currentTarget.style.background = hoverGradient; }}
    onMouseLeave={e => { if(!active) e.currentTarget.style.background = active ? hoverGradient : "transparent"; }}
  >
    <span style={{ fontSize: 18 }}>{icon}</span>
    {sidebarOpen && <span>{label}</span>}
  </button>
);



// Main Content Component
const MainContent = ({ sites, downSites, onlineSites, paginatedSites, currentPage, setCurrentPage, totalPages, chartData, chartOptions, timeSeriesData, timeSeriesOptions, searchTerm, setSearchTerm, showDownOnly, setShowDownOnly, colors }) => (
  <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
    <Header />
    <SummarySection downSites={downSites} onlineSites={onlineSites} colors={colors} />
    <ChartsSection chartData={chartData} chartOptions={chartOptions} timeSeriesData={timeSeriesData} timeSeriesOptions={timeSeriesOptions} />
    <FilterSection searchTerm={searchTerm} setSearchTerm={setSearchTerm} showDownOnly={showDownOnly} setShowDownOnly={setShowDownOnly} colors={colors} />
    <TableSection paginatedSites={paginatedSites} colors={colors} />
    <PaginationSection currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} />
  </div>
);

// Header
const Header = () => (
  <div style={{ textAlign: "center", marginBottom: 20 }}>
    <img src="/NT_Logo.svg.png" alt="Logo" style={{ maxWidth: 120, marginBottom: 8 }} />
    <h1 style={{ fontSize: 20 }}>MNOC Alarm Monitoring Dashboard</h1>
  </div>
);

// Summary Section
const SummarySection = ({ downSites, onlineSites, colors }) => (
  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
    <SummaryCard title="🔴 Down Sites" value={downSites} color={colors.downColor} bg={colors.cardBg} shadow={colors.cardShadow} />
    <SummaryCard title="🟢 Online Sites" value={onlineSites} color={colors.onlineColor} bg={colors.cardBg} shadow={colors.cardShadow} />
  </div>
);

// Charts Section
const ChartsSection = ({ chartData, chartOptions, timeSeriesData, timeSeriesOptions }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", marginBottom: 36 }}>
    <div style={{ flex: "1 1 450px", minWidth: 300, height: 360 }}>
      <h2 style={{ textAlign: "center", fontSize: 15 }}>Sites Down by Province</h2>
      <Bar data={chartData} options={chartOptions} />
    </div>
    <div style={{ flex: "1 1 450px", minWidth: 300, height: 360 }}>
      <h2 style={{ textAlign: "center", fontSize: 15 }}>Alarm Occurred / Cleared (/day)</h2>
      <Line data={timeSeriesData} options={timeSeriesOptions} />
    </div>
  </div>
);

// Filter Section
const FilterSection = ({ searchTerm, setSearchTerm, showDownOnly, setShowDownOnly, colors }) => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="ค้นหา Site / จังหวัด / อำเภอ"
      style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc", minWidth: 200 }}
    />
    <button
      style={{ padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: colors.downColor, color: "#fff" }}
      onClick={() => setShowDownOnly(!showDownOnly)}
    >
      {showDownOnly ? "Show All Sites" : "Show Sites Down Only"}
    </button>
  </div>
);

// Table Section
const TableSection = ({ paginatedSites, colors }) => (
  <div style={{ overflowX: "auto", borderRadius: 12 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
      <thead style={{ background: colors.headerBg, position: "sticky", top: 0, zIndex: 2 }}>
        <tr>
          {["AWN Site Code", "Province", "District", "Status", "Alarm Name", "Occurred", "Cleared"].map((col, idx) => (
            <th key={idx} style={{ padding: 10 }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {paginatedSites.map((site, idx) => (
          <tr key={idx} style={{ backgroundColor: site.isDown ? colors.downBg : colors.onlineBg, color: site.isDown ? colors.downColor : colors.onlineColor }}>
            <td>{site.awn_site_code}</td>
            <td>{site.province}</td>
            <td>{site.district}</td>
            <td>{site.isDown ? "Down" : "Online"}</td>
            <td>{site.alarm?.alarm_name || "-"}</td>
            <td>{site.alarm?.alarm_occurred || "-"}</td>
            <td>{site.alarm?.alarm_cleared || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Pagination Section
const PaginationSection = ({ currentPage, setCurrentPage, totalPages }) => (
  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>◀ ก่อนหน้า</button>
    <span style={{ alignSelf: "center", fontWeight: 600 }}>หน้า {currentPage} / {totalPages || 1}</span>
    <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>ถัดไป ▶</button>
  </div>
);

// Summary Card Component
const SummaryCard = ({ title, value, color, bg, shadow }) => (
  <div style={{ flex:"1 1 180px", background:bg, color:color, textAlign:"center", padding:18, borderRadius:10, boxShadow:shadow, transition:"transform 0.2s", cursor:"pointer" }}
       onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
       onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
    <h2 style={{ fontSize:15 }}>{title}</h2>
    <p style={{ fontSize:36, fontWeight:700 }}>{value}</p>
  </div>
);

// Button style function
const buttonStyle = (bg) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  background: bg,
  color: "#fff",
  fontWeight: "bold",
  fontSize: 14,
  justifyContent:"center"
});
