import React, { useEffect, useState } from "react";
import { database as db } from "./firebase-config"; // ปรับ path ให้ถูกต้อง
import { ref, onValue } from "firebase/database";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

export default function Dashboard() {
  const [sites, setSites] = useState([]);
  const [alarms, setAlarms] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDownOnly, setShowDownOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [darkMode, setDarkMode] = useState(true);

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

  const bgColor = darkMode ? "#121212" : "#f9f9f9";
  const textColor = darkMode ? "#eee" : "#222";
  const headerBg = darkMode ? "#274262" : "#ddd";
  const downBg = darkMode ? "#3a1f1f" : "#ffd6d6";
  const onlineBg = darkMode ? "#1b1b1b" : "#e6ffe6";
  const downColor = darkMode ? "#ff6b6b" : "#d10b0b";
  const onlineColor = darkMode ? "#75c575" : "#117a11";

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
            onChange={(e) => setShowDownOnly(e.target.value === "yes")}
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
            onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Chart */}
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
              minWidth: 600,
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
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
