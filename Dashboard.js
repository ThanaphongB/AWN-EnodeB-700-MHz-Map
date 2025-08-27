import React, { useEffect, useState, useMemo, useCallback } from "react";
import { database as db } from "./firebase-config";
import { ref, onValue } from "firebase/database";
import { Bar, Line } from "react-chartjs-2";
import "chart.js/auto";
import "chartjs-adapter-date-fns";
import { FaMapMarkedAlt, FaMoon, FaSun, FaBars, FaTimes, FaServer, FaQuestionCircle, FaSearch, FaFilter, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";

export default function Dashboard() {
  const [sites, setSites] = useState([]);
  const [alarms, setAlarms] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDownOnly, setShowDownOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const itemsPerPage = 25;

  // Update window width for responsive
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width=== 0 ? window.screen.width : width);
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      
      // Auto-close sidebar on mobile when resizing
      if (width < 768 && sidebarOpen) {
        setSidebarOpen(false);
      } else if (width >= 768 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  const colors = useMemo(() => ({
    bg: darkMode ? "#0f0f23" : "#f5f7fa",
    text: darkMode ? "#e2e8f0" : "#2d3748",
    headerBg: darkMode ? "#1a202c" : "#edf2f7",
    downBg: darkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(254, 202, 202, 0.5)",
    onlineBg: darkMode ? "rgba(72, 187, 120, 0.15)" : "rgba(220, 252, 231, 0.5)",
    downColor: darkMode ? "#f87171" : "#e53e3e",
    onlineColor: darkMode ? "#4ade80" : "#38a169",
    cardBg: darkMode ? "#1e293b" : "#ffffff",
    cardShadow: darkMode ? "0 10px 25px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.08)",
    sidebarBg: darkMode ? "#111827" : "#ffffff",
    sidebarText: darkMode ? "#d1d5db" : "#4b5563",
    accent: darkMode ? "#3b82f6" : "#2563eb",
    accentHover: darkMode ? "#60a5fa" : "#1d4ed8",
    gradient: darkMode 
      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    border: darkMode ? "#334155" : "#e2e8f0"
  }), [darkMode]);

  // Load Data with shimmer effect
  useEffect(() => {
  const sitesRef = ref(db, "geojson_sites");
  const alarmsRef = ref(db, "enodeb_alarms");

  const unsubscribeSites = onValue(sitesRef, snapshot => {
  if (snapshot.exists()) setSites(Object.values(snapshot.val()));
});

const unsubscribeAlarms = onValue(alarmsRef, snapshot => {
  if (snapshot.exists()) setAlarms(snapshot.val());
  setLoading(false);
});


  return () => {
    unsubscribeSites();
    unsubscribeAlarms();
  };
}, []);


  const normalize = str =>
  String(str || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // ลบช่องว่าง ขีด ฯลฯ เหลือแต่ A-Z0-9

const sitesWithStatus = useMemo(() =>
  sites.map(site => {
    const siteCodeNorm = normalize(site.awn_site_code);

    // 🔎 หา alarm ที่ site_code ใกล้เคียงกัน
    const alarm = Object.values(alarms).find(a => {
      const alarmCodeNorm = normalize(a.eNodeB_Site_Code);
      return siteCodeNorm.includes(alarmCodeNorm) || alarmCodeNorm.includes(siteCodeNorm);
    });

    const isDown =
      alarm &&
      alarm.status?.trim().toUpperCase() !== "NORMAL" &&
      (!alarm.alarm_cleared || alarm.alarm_cleared === null || alarm.alarm_cleared === "");

    return { ...site, isDown, alarm };
  }),
  [sites, alarms]
);


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
  // เรียงตามเวลาเกิด alarm ล่าสุด (เกิดก่อน = เก่าสุด)
  const sortedSites = [...filteredSites].sort((a, b) => {
    const timeA = a.alarm?.alarm_occurred ? new Date(a.alarm.alarm_occurred).getTime() : 0;
    const timeB = b.alarm?.alarm_occurred ? new Date(b.alarm.alarm_occurred).getTime() : 0;
    return timeB - timeA; // timeB - timeA = เรียงจากใหม่ -> เก่า
  });

  const start = (currentPage - 1) * itemsPerPage;
  return sortedSites.slice(start, start + itemsPerPage);
}, [filteredSites, currentPage]);


  const totalSites = sitesWithStatus.length;
  const downSites = sitesWithStatus.filter(s => s.isDown).length;
  const onlineSites = totalSites - downSites;

  // Chart Data with animations
  const chartData = useMemo(() => {
    const downByProvince = {};
    sitesWithStatus.filter(s => s.isDown).forEach(s => {
      if (s.province && s.province.trim() !== "") {
        const prov = s.province.trim();
        downByProvince[prov] = (downByProvince[prov] || 0) + 1;
      }
    });
    
    return {
      labels: Object.keys(downByProvince),
      datasets: [{
        label: "Sites Down",
        data: Object.values(downByProvince),
        backgroundColor: darkMode ? "rgba(239, 68, 68, 0.7)" : "rgba(239, 68, 68, 0.6)",
        borderColor: darkMode ? "#f87171" : "#e53e3e",
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: darkMode ? "rgba(239, 68, 68, 0.9)" : "rgba(239, 68, 68, 0.8)",
      }]
    };
  }, [sitesWithStatus, darkMode]);

  const chartOptions = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    interaction: { mode: "nearest", axis: "y", intersect: true },
    plugins: {
      legend: { 
        labels: { 
          color: colors.text, 
          font: { size: 13 },
          usePointStyle: true,
          padding: 20
        } 
      },
      tooltip: { 
        enabled: true, 
        mode: "nearest", 
        axis: "y", 
        intersect: true, 
        titleFont: { size: 14 }, 
        bodyFont: { size: 13 },
        backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.border,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      },
    },
    scales: {
      x: { 
        ticks: { 
          color: colors.text, 
          font: { size: 13 },
          padding: 8
        }, 
        grid: { 
          color: darkMode ? "#334155" : "#e2e8f0",
          drawBorder: false
        }, 
        beginAtZero: true, 
        barPercentage: 0.8, 
        categoryPercentage: 0.9 
      },
      y: { 
        ticks: { 
          color: colors.text, 
          font: { size: 13 },
          padding: 8
        }, 
        grid: { 
          color: darkMode ? "#334155" : "#e2e8f0",
          drawBorder: false
        } 
      },
    },
  }), [colors.text, colors.border, darkMode]);

  const timeSeriesData = useMemo(() => {
    const formatDate = (isoString) => { 
      if (!isoString) return null; 
      const d = new Date(isoString); 
      return isNaN(d) ? null : d.toISOString().slice(0, 10); 
    };
    
    const occurredCountByDate = {}; 
    const clearedCountByDate = {};
    
    Object.values(alarms).forEach(alarm => {
      const occurredDate = formatDate(alarm.alarm_occurred);
      if (occurredDate) occurredCountByDate[occurredDate] = (occurredCountByDate[occurredDate] || 0) + 1;
      const clearedDate = formatDate(alarm.alarm_cleared);
      if (clearedDate) clearedCountByDate[clearedDate] = (clearedCountByDate[clearedDate] || 0) + 1;
    });
    
    const allDates = Array.from(new Set([...Object.keys(occurredCountByDate), ...Object.keys(clearedCountByDate)])).sort();
    const occurredData = allDates.map(d => occurredCountByDate[d] || 0);
    const clearedData = allDates.map(d => clearedCountByDate[d] || 0);
    
    return {
      labels: allDates,
      datasets: [
        { 
          label: "Alarm Occurred", 
          data: occurredData, 
          borderColor: darkMode ? "#f87171" : "#e53e3e", 
          backgroundColor: darkMode ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)", 
          fill: true, 
          tension: 0.4,
          pointBackgroundColor: darkMode ? "#f87171" : "#e53e3e",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        { 
          label: "Alarm Cleared", 
          data: clearedData, 
          borderColor: darkMode ? "#4ade80" : "#38a169", 
          backgroundColor: darkMode ? "rgba(72, 187, 120, 0.2)" : "rgba(72, 187, 120, 0.1)", 
          fill: true, 
          tension: 0.4,
          pointBackgroundColor: darkMode ? "#4ade80" : "#38a169",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
      ]
    };
  }, [alarms, darkMode]);

  const timeSeriesOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1500,
      easing: 'easeOutQuart'
    },
    plugins: { 
      legend: { 
        labels: { 
          color: colors.text, 
          font: { size: 13 },
          usePointStyle: true,
          padding: 20
        } 
      }, 
      tooltip: { 
        mode: 'index', 
        intersect: false, 
        titleFont: { size: 14 }, 
        bodyFont: { size: 13 },
        backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.border,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      } 
    },
    scales: {
      x: { 
        ticks: { 
          color: colors.text, 
          font: { size: 13 },
          padding: 8
        }, 
        grid: { 
          color: darkMode ? "#334155" : "#e2e8f0",
          drawBorder: false
        } 
      },
      y: { 
        ticks: { 
          color: colors.text, 
          font: { size: 13 },
          padding: 8
        }, 
        grid: { 
          color: darkMode ? "#334155" : "#e2e8f0",
          drawBorder: false
        } 
      },
    }
  }), [colors.text, colors.border, darkMode]);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  if (loading) return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh",
      background: colors.bg,
      color: colors.text
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ 
          width: "60px", 
          height: "60px", 
          border: `5px solid ${colors.accent}33`, 
          borderTop: `5px solid ${colors.accent}`, 
          borderRadius: "50%", 
          animation: "spin 1s linear infinite",
          margin: "0 auto 20px"
        }}></div>
        <p style={{ fontSize: 18 }}>กำลังโหลดข้อมูล...</p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (sitesWithStatus.length === 0) return (
    <div style={{ 
      textAlign: "center", 
      marginTop: 50, 
      color: colors.text,
      background: colors.bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{ fontSize: "80px", marginBottom: "20px", opacity: 0.7 }}>📡</div>
      <h2 style={{ fontSize: 24, marginBottom: 10 }}>ไม่พบข้อมูล</h2>
      <p style={{ fontSize: 16, opacity: 0.8 }}>ไม่มีข้อมูลไซต์หรือการแจ้งเตือนในระบบ</p>
    </div>
  );

  return (
    <div style={{ 
      display: "flex", 
      minHeight: "100vh", 
      background: colors.bg, 
      color: colors.text, 
      fontSize: isMobile ? 12 : (isTablet ? 13 : 14),
      transition: "all 0.3s",
      overflow: "hidden"
    }}>
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        colors={colors} 
        windowWidth={windowWidth} 
        isMobile={isMobile}
        isTablet={isTablet}
      />
      <MainContent
        sites={sitesWithStatus} 
        downSites={downSites} 
        onlineSites={onlineSites}
        paginatedSites={paginatedSites} 
        currentPage={currentPage} 
        setCurrentPage={handlePageChange} 
        totalPages={totalPages}
        chartData={chartData} 
        chartOptions={chartOptions} 
        timeSeriesData={timeSeriesData} 
        timeSeriesOptions={timeSeriesOptions}
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm} 
        showDownOnly={showDownOnly} 
        setShowDownOnly={setShowDownOnly}
        colors={colors} 
        windowWidth={windowWidth}
        isMobile={isMobile}
        isTablet={isTablet}
      />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Sidebar Component with enhanced design
const Sidebar = ({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode, colors, windowWidth, isMobile, isTablet }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredMenu, setHoveredMenu] = useState(null);
  
  const menuItems = [
    { label: "Map", icon: <FaMapMarkedAlt />, onClick: () => window.location.href = "mapenodeB_updated.html" },
    { label: "Database", icon: <FaServer />, onClick: () => window.location.href = "https://console.firebase.google.com/project/login-mnoc-700-mhz/database/login-mnoc-700-mhz-default-rtdb/data?fb_gclid=CjwKCAjwtfvEBhAmEiwA-DsKjjRWv1tF5KycIYkhLMXzz0twfSE_RIaOfAHJk63Ak4Ka8Kc2y898BhoCLfIQAvD_BwE" },
    { 
      label: "Settings", 
      icon: <FaBars />, 
      subMenu: [
        { label: "General", onClick: () => window.location.href = "settings_general.html" },
        { label: "Notifications", onClick: () => window.location.href = "settings_notifications.html" },
        { label: "User Management", onClick: () => window.location.href = "settings_users.html" }
      ]
    },
    { label: "Help", icon: <FaQuestionCircle />, onClick: () => window.location.href = "help.html" }, 
    { label: darkMode ? "Light Mode" : "Dark Mode", icon: darkMode ? <FaSun /> : <FaMoon />, onClick: () => setDarkMode(!darkMode) }
  ];
  
  const sidebarBgGradient = darkMode 
    ? "linear-gradient(180deg, #111827 0%, #1f2937 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)";
    
  const hoverGradient = darkMode 
    ? "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)"
    : "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)";
    
  // Auto-close sidebar on mobile when menu item is clicked
  const handleMenuItemClick = (onClick) => {
    if (isMobile) {
      setSidebarOpen(false);
    }
    if (onClick) onClick();
  };
    
  return (
    <div style={{
      flex: sidebarOpen ? (isMobile ? "0 0 280px" : (isTablet ? "0 0 240px" : "0 0 220px")) : "0 0 60px",
      transition: "flex 0.3s ease",
      background: sidebarBgGradient,
      display: "flex",
      flexDirection: "column",
      padding: sidebarOpen ? 20 : 12,
      borderRadius: "0 16px 16px 0",
      boxShadow: "4px 0 25px rgba(0,0,0,0.2)",
      overflow: "hidden",
      position: "relative",
      zIndex: 10
    }}>
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
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          alignSelf: "flex-end"
        }}
      >
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>
      
      {sidebarOpen && (
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: colors.gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            fontSize: 24,
            fontWeight: "bold",
            color: "#fff"
          }}>
            MN
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: colors.accent }}>MNOC</h2>
          <p style={{ fontSize: 12, color: colors.sidebarText, opacity: 0.7 }}>Monitoring Dashboard</p>
        </div>
      )}
      
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: `${colors.accent}33 transparent` }}>
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
                handleMenuItemClick(item.onClick);
              }}
              hoverGradient={hoverGradient}
              colors={colors}
            />
            
            {!sidebarOpen && hoveredMenu === idx && (
              <div style={{
                position: "absolute",
                left: 60,
                top: 0,
                padding: "8px 16px",
                background: hoverGradient,
                color: "#fff",
                borderRadius: 8,
                whiteSpace: "nowrap",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                transition: "opacity 0.3s",
                opacity: 1,
                zIndex: 10,
                fontWeight: 500
              }}>
                {item.label}
              </div>
            )}
            
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
                    onClick={() => handleMenuItemClick(sub.onClick)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: colors.text,
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 13,
                      transition: "all 0.25s ease",
                      fontWeight: 400
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
      
      {sidebarOpen && (
        <div style={{ 
          textAlign: "center", 
          marginTop: 20, 
          paddingTop: 20, 
          borderTop: `1px solid ${colors.border}`,
          fontSize: 11,
          color: colors.sidebarText,
          opacity: 0.6
        }}>
          © 2023 MNOC System
        </div>
      )}
    </div>
  );
};

const MenuButton = ({ sidebarOpen, icon, label, active, onClick, hoverGradient, colors }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: sidebarOpen ? "14px 16px" : "14px 0",
      width: "100%",
      border: "none",
      background: active ? hoverGradient : "transparent",
      color: active ? "#fff" : colors.sidebarText,
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 14,
      transition: "all 0.3s ease",
      justifyContent: sidebarOpen ? "flex-start" : "center",
      boxShadow: active ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
      position: "relative",
      fontWeight: active ? 600 : 400
    }}
    onMouseEnter={e => { 
      if(!active) {
        e.currentTarget.style.background = colors.accent + "20";
        e.currentTarget.style.color = colors.accent;
      }
    }}
    onMouseLeave={e => { 
      if(!active) {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = colors.sidebarText;
      }
    }}
  >
    <span style={{ fontSize: 18 }}>{icon}</span>
    {sidebarOpen && <span>{label}</span>}
  </button>
);

// Main Content Component with enhanced design
const MainContent = ({ 
  sites, 
  downSites, 
  onlineSites, 
  paginatedSites, 
  currentPage, 
  setCurrentPage, 
  totalPages, 
  chartData, 
  chartOptions, 
  timeSeriesData, 
  timeSeriesOptions, 
  searchTerm, 
  setSearchTerm, 
  showDownOnly, 
  setShowDownOnly, 
  colors, 
  windowWidth,
  isMobile,
  isTablet
}) => (
  <div style={{ 
    flex: 1, 
    padding: isMobile ? 16 : (isTablet ? 20 : 24), 
    minWidth: 0,
    overflowY: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: `${colors.accent}33 transparent`
  }}>
    <Header colors={colors} isMobile={isMobile} isTablet={isTablet} />
    <SummarySection downSites={downSites} onlineSites={onlineSites} colors={colors} isMobile={isMobile} isTablet={isTablet} />
    <ChartsSection 
      chartData={chartData} 
      chartOptions={chartOptions} 
      timeSeriesData={timeSeriesData} 
      timeSeriesOptions={timeSeriesOptions} 
      colors={colors}
      isMobile={isMobile}
      isTablet={isTablet}
    />
    <FilterSection 
      searchTerm={searchTerm} 
      setSearchTerm={setSearchTerm} 
      showDownOnly={showDownOnly} 
      setShowDownOnly={setShowDownOnly} 
      colors={colors} 
      isMobile={isMobile}
      isTablet={isTablet}
    />
    <TableSection 
      paginatedSites={paginatedSites} 
      colors={colors} 
      windowWidth={windowWidth}
      isMobile={isMobile}
      isTablet={isTablet}
    />
    <PaginationSection 
      currentPage={currentPage} 
      setCurrentPage={setCurrentPage} 
      totalPages={totalPages} 
      colors={colors}
      isMobile={isMobile}
    />
  </div>
);

const Header = ({ colors, isMobile, isTablet }) => (
  <div style={{ 
    textAlign: "center", 
    marginBottom: isMobile ? 20 : (isTablet ? 25 : 30),
    animation: "fadeIn 0.8s ease-out"
  }}>
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: isMobile ? 60 : (isTablet ? 70 : 80),
      height: isMobile ? 60 : (isTablet ? 70 : 80),
      borderRadius: "50%",
      background: colors.gradient,
      marginBottom: isMobile ? 12 : 16
    }}>
      <img src="/NT_Logo.svg.png" alt="Logo" style={{ maxWidth: isMobile ? 40 : (isTablet ? 45 : 50), maxHeight: isMobile ? 40 : (isTablet ? 45 : 50) }} />
    </div>
    <h1 style={{ 
      fontSize: isMobile ? 22 : (isTablet ? 25 : 28), 
      fontWeight: 700, 
      background: colors.gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      marginBottom: isMobile ? 6 : 8
    }}>
      MNOC Alarm Monitoring
    </h1>
    <p style={{ fontSize: isMobile ? 14 : 16, color: colors.text, opacity: 0.8 }}>
      Real-time Network Status Dashboard
    </p>
  </div>
);

const SummarySection = ({ downSites, onlineSites, colors, isMobile, isTablet }) => (
  <div style={{ 
    display: "flex", 
    gap: isMobile ? 15 : 20, 
    flexWrap: "wrap", 
    justifyContent: "center", 
    marginBottom: isMobile ? 25 : (isTablet ? 30 : 36),
    animation: "fadeIn 0.8s ease-out 0.2s both"
  }}>
    <SummaryCard 
      title="Sites Down" 
      value={downSites} 
      icon={<FaExclamationTriangle />}
      color={colors.downColor} 
      bg={colors.downBg} 
      shadow={colors.cardShadow}
      colors={colors}
      isMobile={isMobile}
      isTablet={isTablet}
    />
    <SummaryCard 
      title="Sites Online" 
      value={onlineSites} 
      icon={<FaCheckCircle />}
      color={colors.onlineColor} 
      bg={colors.onlineBg} 
      shadow={colors.cardShadow}
      colors={colors}
      isMobile={isMobile}
      isTablet={isTablet}
    />
  </div>
);

const ChartsSection = ({ chartData, chartOptions, timeSeriesData, timeSeriesOptions, colors, isMobile, isTablet }) => (
  <div style={{ 
    display: "flex", 
    flexWrap: "wrap", 
    gap: isMobile ? 16 : 24, 
    justifyContent: "center", 
    marginBottom: isMobile ? 30 : 40,
    animation: "fadeIn 0.8s ease-out 0.4s both"
  }}>
    <div style={{ 
      flex: "1 1 450px", 
      minWidth: 300, 
      height: isMobile ? 250 : (isTablet ? 300 : 360),
      background: colors.cardBg,
      borderRadius: 16,
      padding: isMobile ? 15 : 20,
      boxShadow: colors.cardShadow,
      border: `1px solid ${colors.border}`
    }}>
      <h2 style={{ 
        textAlign: "center", 
        fontSize: isMobile ? 14 : 16, 
        marginBottom: isMobile ? 12 : 16,
        fontWeight: 600,
        color: colors.text
      }}>Sites Down by Province</h2>
      <Bar data={chartData} options={chartOptions} />
    </div>
    <div style={{ 
      flex: "1 1 450px", 
      minWidth: 300, 
      height: isMobile ? 250 : (isTablet ? 300 : 360),
      background: colors.cardBg,
      borderRadius: 16,
      padding: isMobile ? 15 : 20,
      boxShadow: colors.cardShadow,
      border: `1px solid ${colors.border}`
    }}>
      <h2 style={{ 
        textAlign: "center", 
        fontSize: isMobile ? 14 : 16, 
        marginBottom: isMobile ? 12 : 16,
        fontWeight: 600,
        color: colors.text
      }}>Alarm Occurred / Cleared (/day)</h2>
      <Line data={timeSeriesData} options={timeSeriesOptions} />
    </div>
  </div>
);

const FilterSection = ({ searchTerm, setSearchTerm, showDownOnly, setShowDownOnly, colors, isMobile, isTablet }) => (
  <div style={{ 
    display: "flex", 
    gap: isMobile ? 12 : 16, 
    flexWrap: "wrap", 
    marginBottom: isMobile ? 20 : 24,
    background: colors.cardBg,
    padding: isMobile ? 14 : (isTablet ? 17 : 20),
    borderRadius: 16,
    boxShadow: colors.cardShadow,
    border: `1px solid ${colors.border}`,
    animation: "fadeIn 0.8s ease-out 0.6s both"
  }}>
    <div style={{ 
      flex: 1, 
      display: "flex", 
      alignItems: "center",
      background: colors.bg,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: "0 16px",
      minWidth: isMobile ? "100%" : (isTablet ? 200 : 250)
    }}>
      <FaSearch style={{ color: colors.text, opacity: 0.5, marginRight: 12 }} />
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ค้นหา Site / จังหวัด / อำเภอ"
        style={{ 
          flex: 1, 
          padding: isMobile ? "10px 0" : "12px 0", 
          border: "none", 
          background: "transparent",
          color: colors.text,
          outline: "none",
          fontSize: isMobile ? 13 : 14
        }}
      />
    </div>
    <button
      style={{ 
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: isMobile ? "10px 14px" : (isTablet ? "11px 17px" : "12px 20px"),
        borderRadius: 12, 
        border: "none", 
        cursor: "pointer", 
        background: showDownOnly ? colors.downColor : colors.accent, 
        color: "#fff",
        fontWeight: 600,
        fontSize: isMobile ? 13 : 14,
        transition: "all 0.3s",
        boxShadow: showDownOnly ? "0 4px 12px rgba(239, 68, 68, 0.3)" : "0 4px 12px rgba(59, 130, 246, 0.3)",
        whiteSpace: "nowrap"
      }}
      onClick={() => setShowDownOnly(!showDownOnly)}
    >
      <FaFilter />
      {showDownOnly ? "Show All Sites" : "Show Sites Down Only"}
    </button>
  </div>
);

const TableSection = ({ paginatedSites, colors, windowWidth, isMobile, isTablet }) => (
  <div style={{ 
    overflowX: "auto", 
    borderRadius: 16,
    background: colors.cardBg,
    boxShadow: colors.cardShadow,
    marginBottom: isMobile ? 20 : 24,
    border: `1px solid ${colors.border}`,
    animation: "fadeIn 0.8s ease-out 0.8s both"
  }}>
    <table style={{ 
      width: "100%", 
      borderCollapse: "collapse",
      fontSize: isMobile ? 11 : (isTablet ? 12 : 14)
    }}>
      <thead style={{ 
        background: colors.headerBg, 
        position: "sticky", 
        top: 0, 
        zIndex: 2 
      }}>
        <tr>
          {["AWN Site Code", "Province", "District", "Status", "Alarm Name", "Occurred", "Cleared"].map((col, idx) => (
            <th key={idx} style={{ 
              padding: isMobile ? 8 : (isTablet ? 10 : 14),
              textAlign: "left",
              fontWeight: 600,
              color: colors.text,
              borderBottom: `2px solid ${colors.border}`,
              fontSize: isMobile ? 10 : (isTablet ? 11 : 13)
            }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {paginatedSites.map((site) => (
          <tr 
            key={site.awn_site_code} 
            style={{ 
              backgroundColor: site.isDown ? colors.downBg : colors.onlineBg, 
              color: site.isDown ? colors.downColor : colors.onlineColor,
              borderBottom: `1px solid ${colors.border}`,
              transition: "background-color 0.3s"
            }}
          >
            <td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14), fontWeight: 600 }}>{site.awn_site_code}</td>
            <td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>{site.province || "-"}</td>
            <td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>{site.district || "-"}</td>
            <td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 20,
                background: site.isDown ? colors.downColor : colors.onlineColor,
                color: "#fff",
                fontSize: isMobile ? 9 : (isTablet ? 10 : 12),
                fontWeight: 600
              }}>
                {site.isDown ? <FaExclamationTriangle /> : <FaCheckCircle />}
                {site.isDown ? "Down" : "Online"}
              </span>
            </td>
            <td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>
  {site.alarm?.alarm_name || "-"}
</td>
<td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>
  {site.alarm?.alarm_occurred ? site.alarm.alarm_occurred.slice(0, 19).replace("T", " ") : "-"}
</td>
<td style={{ padding: isMobile ? 8 : (isTablet ? 10 : 14) }}>
  {site.alarm?.alarm_cleared ? site.alarm.alarm_cleared.slice(0, 19).replace("T", " ") : "-"}
</td>


          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PaginationSection = ({ currentPage, setCurrentPage, totalPages, colors, isMobile }) => {
  const handlePageChange = (newPage) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };
  
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = isMobile ? 3 : 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (startPage > 1) pages.push(1);
      if (startPage > 2) pages.push('...');
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) pages.push('...');
      if (endPage < totalPages) pages.push(totalPages);
    }
    
    return pages;
  };
  
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center",
      gap: isMobile ? 6 : 8, 
      marginTop: isMobile ? 15 : 20,
      marginBottom: isMobile ? 15 : 20,
      flexWrap: "wrap",
      animation: "fadeIn 0.8s ease-out 1s both"
    }}>
      <button 
        onClick={() => handlePageChange(currentPage - 1)} 
        disabled={currentPage === 1}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: isMobile ? "8px 12px" : "10px 14px",
          borderRadius: 10,
          border: "none",
          background: currentPage === 1 ? `${colors.text}20` : colors.accent,
          color: currentPage === 1 ? colors.text : "#fff",
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
          transition: "all 0.3s",
          fontWeight: 500,
          fontSize: isMobile ? 12 : 14
        }}
      >
        <span>◀</span>
        <span>{isMobile ? "ก่อน" : "ก่อนหน้า"}</span>
      </button>
      
      {getPageNumbers().map((page, idx) => (
        <button
          key={idx}
          onClick={() => typeof page === 'number' && handlePageChange(page)}
          disabled={page === '...'}
          style={{
            padding: isMobile ? "8px 12px" : "10px 14px",
            borderRadius: 10,
            border: "none",
            background: page === currentPage ? colors.accent : "transparent",
            color: page === currentPage ? "#fff" : colors.text,
            cursor: page === '...' ? "default" : "pointer",
            fontWeight: page === currentPage ? 600 : 500,
            minWidth: isMobile ? "36px" : "44px",
            transition: "all 0.3s",
            fontSize: isMobile ? 12 : 14
          }}
        >
          {page}
        </button>
      ))}
      
      <button 
        onClick={() => handlePageChange(currentPage + 1)} 
        disabled={currentPage === totalPages || totalPages === 0}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: isMobile ? "8px 12px" : "10px 14px",
          borderRadius: 10,
          border: "none",
          background: currentPage === totalPages || totalPages === 0 ? `${colors.text}20` : colors.accent,
          color: currentPage === totalPages || totalPages === 0 ? colors.text : "#fff",
          cursor: currentPage === totalPages || totalPages === 0 ? "not-allowed" : "pointer",
          transition: "all 0.3s",
          fontWeight: 500,
          fontSize: isMobile ? 12 : 14
        }}
      >
        <span>{isMobile ? "ถัดไป" : "ถัดไป"}</span>
        <span>▶</span>
      </button>
    </div>
  );
};

const SummaryCard = ({ title, value, icon, color, bg, shadow, colors, isMobile, isTablet }) => (
  <div 
    style={{ 
      flex: "1 1 200px", 
      background: bg, 
      color: color, 
      textAlign: "center", 
      padding: isMobile ? 18 : (isTablet ? 21 : 24), 
      borderRadius: 16, 
      boxShadow: shadow, 
      transition: "all 0.3s",
      cursor: "pointer",
      border: `1px solid ${color}33`,
      position: "relative",
      overflow: "hidden"
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-5px)";
      e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.15)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = shadow;
    }}
  >
    <div style={{
      position: "absolute",
      top: -20,
      right: -20,
      width: 100,
      height: 100,
      borderRadius: "50%",
      background: `${color}20`,
      zIndex: 0
    }}></div>
    <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ 
        fontSize: isMobile ? 28 : (isTablet ? 30 : 32), 
        marginBottom: isMobile ? 10 : 12,
        display: "flex",
        justifyContent: "center"
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, marginBottom: isMobile ? 6 : 8 }}>{title}</h2>
      <p style={{ fontSize: isMobile ? 36 : 42, fontWeight: 700, lineHeight: 1 }}>{value}</p>
    </div>
  </div>
);
