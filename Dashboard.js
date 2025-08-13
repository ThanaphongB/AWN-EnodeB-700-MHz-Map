import React, { useEffect, useState } from "react";
import { database as db } from "./firebase-config";
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

  const sitesWithStatus = sites.map((site) => {
    const alarm = Object.values(alarms).find(
      (a) => a.eNodeB_Site_Code === site.awn_site_code
    );

    const isDown =
      alarm &&
      alarm.status !== "NORMAL" &&
      (!alarm.alarm_cleared || alarm.alarm_cleared === "");

    return { ...site, isDown, alarm };
  });

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

  const totalItems = filteredSites.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSites = filteredSites.slice(startIndex, endIndex);

  const goToPrevPage = () => setCurrentPage((page) => Math.max(page - 1, 1));
  const goToNextPage = () =>
    setCurrentPage((page) => Math.min(page + 1, totalPages));

  const totalSites = sitesWithStatus.length;
  const downSites = sitesWithStatus.filter((s) => s.isDown);
  const onlineSites = totalSites - downSites.length;

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

  const formatDate = (isoString) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
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

  return (
    <>
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }
        .dashboard-container {
          padding: 24px;
          max-width: 1100px;
          margin: auto;
          background-color: ${bgColor};
          border-radius: 12px;
          box-shadow: ${darkMode
            ? "0 8px 20px rgba(0,0,0,0.8)"
            : "0 8px 20px rgba(0,0,0,0.1)"};
          color: ${textColor};
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .summary-cards {
          display: flex;
          gap: 24px;
          justify-content: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .summary-card {
          flex: 1 1 200px;
          padding: 28px 36px;
          border-radius: 12px;
          text-align: center;
          box-shadow: ${darkMode
            ? "0 4px 8px rgba(255, 99, 132, 0.7)"
            : "0 4px 8px rgba(255, 99, 132, 0.3)"};
          min-width: 200px;
          max-width: 320px;
          color: inherit;
        }
        .summary-card.online {
          background: ${darkMode ? "#1b4d1b" : "#d1e7dd"};
          box-shadow: ${darkMode
            ? "0 4px 8px rgba(40, 167, 69, 0.7)"
            : "0 4px 8px rgba(40, 167, 69, 0.3)"};
          color: ${darkMode ? "#c1e1c1" : "#0f5132"};
        }
        .filters {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .filter-group {
          flex: 1 1 200px;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 200px;
        }
        .chart-container {
          background: ${darkMode ? "#1e2a38" : "#fff"};
          padding: 20px;
          border-radius: 12px;
          box-shadow: ${darkMode
            ? "0 3px 10px rgba(0,0,0,0.8)"
            : "0 3px 10px rgba(0,0,0,0.1)"};
          margin-bottom: 40px;
          max-width: 100%;
          overflow-x: auto;
        }
        .table-wrapper {
          overflow-x: auto;
          border-radius: 12px;
          box-shadow: ${darkMode
            ? "0 3px 10px rgba(0,0,0,0.8)"
            : "0 3px 10px rgba(0,0,0,0.1)"};
        }
        table {
          width: 100%;
          border-collapse: collapse;
          color: ${textColor};
          min-width: 600px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid ${darkMode ? "#444" : "#ccc"};
          white-space: nowrap;
        }
        thead {
          background-color: ${headerBg};
        }
        .pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        button {
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          background-color: ${darkMode ? "#274262" : "#ddd"};
          color: ${darkMode ? "#eee" : "#333"};
          font-weight: 600;
          user-select: none;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        @media (max-width: 768px) {
          .summary-cards {
            flex-direction: column;
            align-items: center;
          }
          .filters {
            flex-direction: column;
          }
          .filter-group {
            width: 100%;
            justify-content: flex-start;
          }
          table {
            min-width: 100%;
          }
          th, td {
            padding: 8px;
            font-size: 14px;
          }
        }
        @media (max-width: 480px) {
          h1 {
            font-size: 22px;
          }
          h2 {
            font-size: 18px;
          }
          th, td {
            padding: 6px 8px;
            font-size: 12px;
          }
          button {
            padding: 6px 12px;
            font-size: 14px;
          }
        }
      `}</style>

      <div className="dashboard-container">
        <h1 style={{ marginBottom: 24, textAlign: "center" }}>
          📊 Alarm Monitoring Dashboard
        </h1>

        {/* Toggle Theme */}
        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <label
            style={{
              marginRight: 8,
              fontWeight: "600",
              fontSize: 14,
              cursor: "pointer",
            }}
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
        <div className="summary-cards">
          <div className="summary-card" style={{ background: darkMode ? "#7b1a1a" : "#f8d7da", color: darkMode ? "#f9d6d5" : "#842029" }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>🔴 Down Sites</h2>
            <p style={{ fontSize: 42, fontWeight: "700", margin: "12px 0 0", color: darkMode ? "#ff6b6b" : "#d10b0b" }}>
              {downSites.length}
            </p>
          </div>
          <div className="summary-card online">
            <h2 style={{ margin: 0, fontSize: 22 }}>🟢 Online Sites</h2>
            <p style={{ fontSize: 42, fontWeight: "700", margin: "12px 0 0", color: darkMode ? "#75c575" : "#117a11" }}>
              {onlineSites}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="filters">
          <div className="filter-group">
            <label
              htmlFor="filterDown"
              style={{ marginRight: 10, fontWeight: "600", fontSize: 16, color: textColor }}
            >
              แสดงเฉพาะ Sites ที่ Down:
            </label>
            <select
              id="filterDown"
              value={showDownOnly ? "yes" : "no"}
              onChange={(e) => {
                setShowDownOnly(e.target.value === "yes");
                setCurrentPage(1);
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

          <div className="filter-group">
            <label
              htmlFor="searchSite"
              style={{ marginRight: 10, fontWeight: "600", fontSize: 16, color: textColor }}
            >
              ค้นหา Site:
            </label>
            <input
              id="searchSite"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ค้นหาจาก AWN Site, จังหวัด, อำเภอ"
              style={{
                flex: "1 1 auto",
                fontSize: 16,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1.5px solid ${darkMode ? "#444" : "#ccc"}`,
                backgroundColor: darkMode ? "#222" : "#fff",
                color: textColor,
              }}
            />
          </div>
        </div>

        {/* Chart by Province */}
        <div className="chart-container" style={{ marginBottom: 40 }}>
          <h2 style={{ marginBottom: 12, textAlign: "center" }}>
            จำนวน Sites Down แยกตามจังหวัด
          </h2>
          <Bar data={chartData} options={chartOptions} />
        </div>

        {/* Time series chart */}
        <div className="chart-container" style={{ marginBottom: 40 }}>
          <h2 style={{ marginBottom: 12, textAlign: "center" }}>
            จำนวน Alarm Occurred และ Alarm Cleared (วันต่อวัน)
          </h2>
          <Line data={timeSeriesData} options={timeSeriesOptions} />
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>AWN Site Code</th>
                <th>Province</th>
                <th>District</th>
                <th>Status</th>
                <th>Alarm Name</th>
                <th>Occurred</th>
                <th>Cleared</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSites.map((site, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: site.isDown ? downBg : onlineBg,
                    color: site.isDown ? downColor : onlineColor,
                  }}
                >
                  <td>{site.awn_site_code}</td>
                  <td>{site.province}</td>
                  <td>{site.district}</td>
                  <td>{site.isDown ? "Down" : "Online"}</td>
                  <td>{site.alarm?.alarm_name || "-"}</td>
                  <td>{site.alarm?.alarm_occurred || "-"}</td>
                  <td>{site.alarm?.alarm_cleared || "-"}</td>
                </tr>
              ))}
              {paginatedSites.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: 20, color: textColor }}>
                    ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination" aria-label="pagination navigation">
          <button onClick={goToPrevPage} disabled={currentPage === 1} aria-label="Previous page">
            ◀ ก่อนหน้า
          </button>
          <span style={{ alignSelf: "center", color: textColor, fontWeight: "600" }}>
            หน้า {currentPage} / {totalPages || 1}
          </span>
          <button onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0} aria-label="Next page">
            ถัดไป ▶
          </button>
        </div>
      </div>
    </>
  );
}
