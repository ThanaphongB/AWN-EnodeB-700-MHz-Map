import React, { useEffect, useState } from "react";
import { database as db } from "./firebase-config"; // ปรับ path ให้ถูกต้อง
import { ref, onValue } from "firebase/database";
import { Bar, Line } from "react-chartjs-2";
import "chart.js/auto";
import "chartjs-adapter-date-fns";

export default function Dashboard() {
  const [sites, setSites] = useState([]);
  const [alarms, setAlarms] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDownOnly, setShowDownOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 25;

  useEffect(() => {
    const sitesRef = ref(db, "geojson_sites");
    const alarmsRef = ref(db, "enodeb_alarms");

    onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        setSites(Object.values(snapshot.val()));
      }
    });

    onValue(alarmsRef, (snapshot) => {
      if (snapshot.exists()) {
        setAlarms(snapshot.val());
        setLoading(false);
      }
    });
  }, []);

  if (loading)
    return (
      <p
        style={{
          color: darkMode ? "#bbb" : "#444",
          textAlign: "center",
          marginTop: 50,
        }}
      >
        กำลังโหลดข้อมูล...
      </p>
    );

  // รวมสถานะ site + alarm
  const sitesWithStatus = sites.map((site) => {
    const alarm = Object.values(alarms).find(
      (a) => a.eNodeB_Site_Code === site.awn_site_code
    );

    const isDown =
      alarm &&
      alarm.status !== "NORMAL" &&
      (!alarm.alarm_cleared || alarm.alarm_cleared === "");

    return { ...site, isDown };
  });

  // กรองตาม toggle และ search
  let filteredSites = sitesWithStatus;

  if (showDownOnly) {
    filteredSites = filteredSites.filter((s) => s.isDown);
  }

  if (searchTerm.trim() !== "") {
    const lowerSearch = searchTerm.toLowerCase();
    filteredSites = filteredSites.filter(
      (s) =>
        s.awn_site_code.toLowerCase().includes(lowerSearch) ||
        (s.province && s.province.toLowerCase().includes(lowerSearch)) ||
        (s.district && s.district.toLowerCase().includes(lowerSearch))
    );
  }

  // Pagination Logic
  const totalItems = filteredSites.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSites = filteredSites.slice(startIndex, endIndex);

  const goToPrevPage = () => setCurrentPage((page) => Math.max(page - 1, 1));
  const goToNextPage = () =>
    setCurrentPage((page) => Math.min(page + 1, totalPages));

  // สรุปข้อมูล dashboard
  const totalSites = sitesWithStatus.length;
  const downSites = sitesWithStatus.filter((s) => s.isDown);
  const onlineSites = totalSites - downSites.length;

  // สรุป down ตามจังหวัด
  const downByProvince = {};
  downSites.forEach((s) => {
    downByProvince[s.province] = (downByProvince[s.province] || 0) + 1;
  });

  const chartData = {
    labels: Object.keys(downByProvince),
    datasets: [
      {
        label: "Sites Down",
        data: Object.values(downByProvince),
        backgroundColor: "rgba(255, 99, 132, 0.8)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 2,
        hoverBackgroundColor: "rgba(255, 99, 132, 1)",
        hoverBorderColor: "rgba(255, 69, 69, 1)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: darkMode ? "#eee" : "#333", font: { size: 14 } } },
      tooltip: {
        enabled: true,
        backgroundColor: darkMode ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
        titleFont: { size: 16, weight: "bold" },
        bodyFont: { size: 14 },
        padding: 10,
        cornerRadius: 6,
        titleColor: darkMode ? "#fff" : "#000",
        bodyColor: darkMode ? "#eee" : "#222",
      },
    },
    scales: {
      x: {
        ticks: { color: darkMode ? "#ccc" : "#444", font: { size: 14 } },
        grid: { color: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: darkMode ? "#ccc" : "#444", font: { size: 14 } },
        grid: {
          color: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          borderDash: [5, 5],
        },
      },
    },
  };

  // === Time Series Data Preparation ===
  const formatDate = (isoString) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const occurredCountByDate = {};
  const clearedCountByDate = {};

  Object.values(alarms).forEach((alarm) => {
    const occurredDate = formatDate(alarm.alarm_occurred);
    if (occurredDate) {
      occurredCountByDate[occurredDate] = (occurredCountByDate[occurredDate] || 0) + 1;
    }

    const clearedDate = formatDate(alarm.alarm_cleared);
    if (clearedDate) {
      clearedCountByDate[clearedDate] = (clearedCountByDate[clearedDate] || 0) + 1;
    }
  });

  const allDates = Array.from(
    new Set([...Object.keys(occurredCountByDate), ...Object.keys(clearedCountByDate)])
  ).sort();

  const occurredData = allDates.map((date) => occurredCountByDate[date] || 0);
  const clearedData = allDates.map((date) => clearedCountByDate[date] || 0);

  const timeSeriesData = {
    labels: allDates,
    datasets: [
      {
        label: "Alarm Occurred",
        data: occurredData,
        borderColor: "#f44336",
        backgroundColor: "rgba(244, 67, 54, 0.2)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Alarm Cleared",
        data: clearedData,
        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.2)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const timeSeriesOptions = {
    responsive: true,
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: darkMode ? "#eee" : "#333", font: { size: 14, weight: "bold" } },
        position: "top",
      },
      tooltip: {
        enabled: true,
        backgroundColor: darkMode ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
        titleFont: { size: 16, weight: "bold" },
        bodyFont: { size: 14 },
        padding: 10,
        cornerRadius: 6,
        titleColor: darkMode ? "#fff" : "#000",
        bodyColor: darkMode ? "#eee" : "#222",
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
          tooltipFormat: "yyyy-MM-dd",
          displayFormats: { day: "yyyy-MM-dd" },
        },
        ticks: { color: darkMode ? "#ccc" : "#444", font: { size: 14 } },
        grid: { color: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: darkMode ? "#ccc" : "#444", font: { size: 14 } },
        grid: {
          color: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          borderDash: [5, 5],
        },
      },
    },
  };

  const bgColor = darkMode ? "#121212" : "#f9f9f9";
  const textColor = darkMode ? "#eee" : "#222";
  const headerBg = darkMode ? "#274262" : "#ddd";
  const downBg = darkMode ? "#3a1f1f" : "#ffd6d6";
  const onlineBg = darkMode ? "#1b1b1b" : "#e6ffe6";
  const downColor = darkMode ? "#ff6b6b" : "#d10b0b";
  const onlineColor = darkMode ? "#75c575" : "#117a11";

  // ฟังก์ชันแปลงเวลาจาก ISO เป็น readable string
  const formatDateTime = (isoString) => {
    if (!isoString) return "-";
    const dt = new Date(isoString);
    if (isNaN(dt)) return "-";
    return dt.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        maxWidth: 1100,
        margin: "auto",
        backgroundColor: bgColor,
        borderRadius: 12,
        boxShadow: darkMode
          ? "0 8px 20px rgba(0,0,0,0.8)"
          : "0 8px 20px rgba(0,0,0,0.1)",
        color: textColor,
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 24, textAlign: "center" }}>
        📊 Alarm Monitoring Dashboard
      </h1>

      {/* Toggle Theme */}
      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <label
          style={{ marginRight: 8, fontWeight: "600", fontSize: 14, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
            style={{ marginRight: 6 }}
          />
          Dark Mode
        </label>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "flex",
          gap: 24,
          justifyContent: "center",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            background: darkMode ? "#7b1a1a" : "#f8d7da",
            padding: "28px 36px",
            borderRadius: 12,
            boxShadow: darkMode
              ? "0 4px 8px rgba(255, 99, 132, 0.7)"
              : "0 4px 8px rgba(255, 99, 132, 0.3)",
            flex: 1,
            textAlign: "center",
            color: darkMode ? "#f9d6d5" : "#842029",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>🔴 Down Sites</h2>
          <p
            style={{
              fontSize: 42,
              fontWeight: "700",
              margin: "12px 0 0",
              color: darkMode ? "#ff6b6b" : "#d10b0b",
            }}
          >
            {downSites.length}
          </p>
        </div>
        <div
          style={{
            background: darkMode ? "#1b4d1b" : "#d1e7dd",
            padding: "28px 36px",
            borderRadius: 12,
            boxShadow: darkMode
              ? "0 4px 8px rgba(40, 167, 69, 0.7)"
              : "0 4px 8px rgba(40, 167, 69, 0.3)",
            flex: 1,
            textAlign: "center",
            color: darkMode ? "#c1e1c1" : "#0f5132",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>🟢 Online Sites</h2>
          <p
            style={{
              fontSize: 42,
              fontWeight: "700",
              margin: "12px 0 0",
              color: darkMode ? "#75c575" : "#117a11",
            }}
          >
            {onlineSites}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label
            htmlFor="filterDown"
            style={{
              marginRight: 10,
              fontWeight: "600",
              fontSize: 16,
              color: textColor,
            }}
          >
            แสดงเฉพาะ Sites ที่ Down:
          </label>
          <select
            id="filterDown"
            value={showDownOnly ? "yes" : "no"}
            onChange={(e) => {
              setShowDownOnly(e.target.value === "yes");
              setCurrentPage(1); // reset page
            }}
            style={{
              fontSize: 16,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1.5px solid ${darkMode ? "#444" : "#ccc"}`,
              backgroundColor: darkMode ? "#222" : "#fff",
              color: textColor,
              cursor: "pointer",
            }}
          >
            <option value="no">ทั้งหมด</option>
            <option value="yes">Down เท่านั้น</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="searchSite"
            style={{
              marginRight: 10,
              fontWeight: "600",
              fontSize: 16,
              color: textColor,
            }}
          >
            ค้นหา Site:
          </label>
          <input
            id="searchSite"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // reset page
            }}
            placeholder="พิมพ์รหัส หรือชื่อจังหวัด..."
            style={{
              fontSize: 16,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1.5px solid ${darkMode ? "#444" : "#ccc"}`,
              backgroundColor: darkMode ? "#222" : "#fff",
              color: textColor,
              minWidth: 220,
            }}
          />
        </div>
      </div>

      {/* Chart - Down by Province */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, marginBottom: 16, color: textColor }}>
          📍 Down Sites by Province
        </h2>
        <div
          style={{
            background: darkMode ? "#1e2a38" : "#fff",
            padding: 20,
            borderRadius: 12,
            boxShadow: darkMode
              ? "0 3px 10px rgba(0,0,0,0.8)"
              : "0 3px 10px rgba(0,0,0,0.1)",
          }}
        >
          <Bar data={chartData} options={chartOptions} />
        </div>
      </section>

      {/* Chart - Alarm Time Series */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 24, marginBottom: 16, color: textColor }}>
          ⏰ Alarm Occurred / Cleared Over Time
        </h2>
        <div
          style={{
            background: darkMode ? "#1e2a38" : "#fff",
            padding: 20,
            borderRadius: 12,
            boxShadow: darkMode
              ? "0 3px 10px rgba(0,0,0,0.8)"
              : "0 3px 10px rgba(0,0,0,0.1)",
            maxWidth: 900,
            margin: "auto",
          }}
        >
          <Line data={timeSeriesData} options={timeSeriesOptions} />
        </div>
      </section>

      {/* Table */}
      <section>
        <h2 style={{ fontSize: 24, marginBottom: 16, color: textColor }}>
          📋 Site Details
        </h2>
        <div
          style={{
            overflowX: "auto",
            borderRadius: 12,
            boxShadow: darkMode
              ? "0 3px 10px rgba(0,0,0,0.8)"
              : "0 3px 10px rgba(0,0,0,0.1)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              color: textColor,
            }}
          >
            <thead style={{ backgroundColor: headerBg }}>
              <tr>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  AWN Site Code
                </th>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  Province
                </th>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  District
                </th>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  Alarm Occurred
                </th>
                <th
                  style={{
                    padding: "14px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: `2px solid ${darkMode ? "#444" : "#ccc"}`,
                  }}
                >
                  Alarm Cleared
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedSites.map((site) => {
                const alarm = Object.values(alarms).find(
                  (a) => a.eNodeB_Site_Code === site.awn_site_code
                );

                return (
                  <tr
                    key={site.awn_site_code}
                    style={{
                      backgroundColor: site.isDown ? downBg : onlineBg,
                      color: site.isDown ? downColor : onlineColor,
                      borderBottom: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                      transition: "background-color 0.3s",
                    }}
                  >
                    <td style={{ padding: "12px" }}>{site.awn_site_code}</td>
                    <td style={{ padding: "12px" }}>{site.province}</td>
                    <td style={{ padding: "12px" }}>{site.district}</td>
                    <td style={{ padding: "12px", fontWeight: "600" }}>
                      {site.isDown ? (
                        <span style={{ color: downColor }}>🔴 Down</span>
                      ) : (
                        <span style={{ color: onlineColor }}>🟢 Online</span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {alarm ? formatDateTime(alarm.alarm_occurred) : "-"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {alarm ? formatDateTime(alarm.alarm_cleared) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 1}
            style={{
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              backgroundColor: darkMode ? "#274262" : "#ddd",
              color: darkMode ? "#eee" : "#333",
              fontWeight: "600",
              userSelect: "none",
            }}
          >
            Prev
          </button>
          <span
            style={{
              lineHeight: "32px",
              fontWeight: "600",
              userSelect: "none",
              color: textColor,
            }}
          >
            หน้า {currentPage} / {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            style={{
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              backgroundColor: darkMode ? "#274262" : "#ddd",
              color: darkMode ? "#eee" : "#333",
              fontWeight: "600",
              userSelect: "none",
            }}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
