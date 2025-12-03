// Thay đổi BASE_URL nếu frontend chạy ở domain khác
// Mặc định: cùng host với FastAPI (vd: http://localhost:8000)
const BASE_URL = "";

// Đăng ký plugin zoom cho Chart.js (chartjs-plugin-zoom đã được load trong index.html)
try {
  if (typeof Chart !== "undefined" && typeof ChartZoom !== "undefined") {
    Chart.register(ChartZoom);
  }
} catch (e) {
  console.warn("Không thể đăng ký ChartZoom plugin:", e);
}

function setResult(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  } catch {
    el.textContent = String(data);
  }
}

async function callApi(url, options = {}, targetResultId) {
  setResult(targetResultId, "Đang gọi API...");
  try {
    const res = await fetch(BASE_URL + url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      const text = await res.text();
      setResult(targetResultId, `Lỗi HTTP ${res.status}: ${text}`);
      return;
    }

    if (contentType.includes("application/json")) {
      const json = await res.json();
      setResult(targetResultId, json);
    } else {
      const text = await res.text();
      setResult(targetResultId, text);
    }
  } catch (err) {
    setResult(targetResultId, `Lỗi khi gọi API: ${err}`);
  }
}

// === HÀM RENDER MỚI CHO SO SÁNH CÁC NĂM ===
function renderSeasonalComparisonChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    
    // Tạo danh sách màu sắc cho các năm
    const colorPalette = [
        "rgba(255, 99, 132, 1)", // Đỏ
        "rgba(54, 162, 235, 1)", // Xanh dương
        "rgba(255, 206, 86, 1)", // Vàng
        "rgba(75, 192, 192, 1)", // Xanh lá
        "rgba(153, 102, 255, 1)", // Tím
    ];

    // Lấy labels (tháng 1-12) từ dataset đầu tiên
    const labels = data.datasets.length > 0 ? data.datasets[0].points.map((p) => p.x) : [];

    // Chuyển đổi data.datasets thành format của Chart.js
    const datasets = data.datasets.map((ds, index) => {
        const values = ds.points.map((p) => p.y);
        const color = colorPalette[index % colorPalette.length]; // Chọn màu theo chỉ mục

        return {
            label: ds.label, // Tên năm (ví dụ: "2024", "2025", ...)
            data: values,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.1)'), // Màu nền nhạt
            tension: 0.25,
            fill: false, // Rất quan trọng để so sánh
            pointRadius: 4,
            pointHoverRadius: 6,
        };
    });

    return new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: data.x_label || "Month (1-12)",
                    },
                    ticks: {
                        stepSize: 1, // Đảm bảo chỉ hiển thị các tháng 1-12
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: data.y_label || "Y",
                    },
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    },
                },
            }
        },
    });
}
// === KẾT THÚC HÀM RENDER MỚI ===


document.addEventListener("DOMContentLoaded", () => {
  // Tabs điều hướng
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (!targetId) return;

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add("active");
    });
  });

  // Predict theo ngày
  const btnPredict = document.getElementById("btn-predict");
  btnPredict?.addEventListener("click", () => {
    const dateInput = document.getElementById("predict-date");
    const day = dateInput?.value;
    if (!day) {
      setResult("predict-result", "Vui lòng chọn ngày (YYYY-MM-DD).");
      return;
    }
    callApi(`/predict/predict/${day}`, {}, "predict-result");
  });

  // Cluster auto
  const btnClusterAuto = document.getElementById("btn-cluster-auto");
  btnClusterAuto?.addEventListener("click", () => {
    callApi("/cluster/cluster/auto-latest", {}, "cluster-auto-result");
  });

  // Cluster manual
  const btnClusterManual = document.getElementById("btn-cluster-manual");
  btnClusterManual?.addEventListener("click", () => {
    const precipitation = parseFloat(document.getElementById("precipitation")?.value || "0");
    const cloudcover = parseFloat(document.getElementById("cloudcover")?.value || "0");
    const temperature = parseFloat(document.getElementById("temperature")?.value || "0");

    const payload = { precipitation, cloudcover, temperature };

    callApi(
      "/cluster/cluster/manual",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "cluster-manual-result"
    );
  });

  // Nút lấy dữ liệu thời tiết mới nhất (ingestion)
  const btnRefreshIngestion = document.getElementById("btn-refresh-ingestion");
  btnRefreshIngestion?.addEventListener("click", () => {
    callApi(
      "/ingestion/refresh",
      {
        method: "POST",
      },
      "ingestion-result"
    );
  });

  // ====== PHÂN TÍCH DỮ LIỆU (3 câu) ======

  let q1ChartInstance = null;
  let q2ChartInstance = null;
  let q3ChartInstance = null;

  async function fetchChartData(paramsObj) {
    const params = new URLSearchParams(paramsObj);
    const res = await fetch(`${BASE_URL}/analysis/chart-data?${params.toString()}`);
    return res.json();
  }

  function renderHistogramChart(canvasId, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    const labels = data.bin_mids || data.bin_edges;
    const counts = data.counts;

    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label,
            data: counts,
            backgroundColor: "rgba(129, 140, 248, 0.6)",
            borderColor: "rgba(129, 140, 248, 1)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: data.x_label || "X",
            },
          },
          y: {
            title: {
              display: true,
              text: data.y_label || "Y",
            },
          },
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "xy",
            },
            pan: {
              enabled: true,
              mode: "xy",
            },
          },
        },
      },
    });
  }

  function renderLineLikeChart(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    const labels = data.points.map((p) => p.x);
    const values = data.points.map((p) => p.y);

    const {
      label = `${data.variable} - ${data.kind}`,
      isScatter = false,
      fillArea = true,
    } = options;

    return new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: "rgba(56, 189, 248, 1)",
            backgroundColor: "rgba(56, 189, 248, 0.3)",
            tension: isScatter ? 0 : 0.25,
            fill: fillArea,
            showLine: !isScatter ? true : false,
            pointRadius: isScatter ? 3 : 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: data.x_label || "X",
            },
          },
          y: {
            title: {
              display: true,
              text: data.y_label || "Y",
            },
          },
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "xy",
            },
            pan: {
              enabled: true,
              mode: "xy",
            },
          },
        },
      },
    });
  }

  // Câu 1: time-series + histogram
  const btnQ1 = document.getElementById("btn-q1-draw");
  btnQ1?.addEventListener("click", async () => {
    const variable = document.getElementById("q1-variable")?.value || "temperature";
    const chartType = document.getElementById("q1-chart-type")?.value || "line";
    const windowSelect = document.getElementById("q1-window");
    const binsInput = document.getElementById("q1-bins");

    const days = windowSelect ? parseInt(windowSelect.value, 10) || 30 : 30;
    const bins = binsInput ? parseInt(binsInput.value, 10) || 20 : 20;

    setResult("q1-result", "Đang gọi API /analysis/chart-data (Câu 1)...");

    try {
      const chartKind = chartType === "histogram" ? "histogram" : "time_series";
      const params = {
        variable,
        chart_kind: chartKind,
      };
      if (chartKind === "time_series" || chartKind === "histogram") {
        params.days = String(days);
      }
      if (chartKind === "histogram") {
        params.bins = String(bins);
      }

      const json = await fetchChartData(params);
      if (json.status !== "success") {
        setResult("q1-result", json);
        return;
      }

      const data = json.data;
      setResult("q1-result", data);

      if (q1ChartInstance) {
        q1ChartInstance.destroy();
      }

      if (data.kind === "histogram") {
        q1ChartInstance = renderHistogramChart(
          "q1-chart",
          data,
          `${data.variable} - histogram`
        );
      } else {
        const isScatter = chartType === "scatter";
        q1ChartInstance = renderLineLikeChart("q1-chart", data, {
          isScatter,
          fillArea: !isScatter,
        });
      }
    } catch (err) {
      setResult("q1-result", `Lỗi khi gọi API chart-data (Câu 1): ${err}`);
    }
  });

  // Câu 2: trend_monthly
  const btnQ2 = document.getElementById("btn-q2-draw");
  btnQ2?.addEventListener("click", async () => {
    const variable = document.getElementById("q2-variable")?.value || "temperature";
    setResult("q2-result", "Đang gọi API /analysis/chart-data (Câu 2)...");

    try {
      const json = await fetchChartData({
        variable,
        chart_kind: "trend_monthly",
      });

      if (json.status !== "success") {
        setResult("q2-result", json);
        return;
      }

      const data = json.data;
      setResult("q2-result", data);

      if (q2ChartInstance) {
        q2ChartInstance.destroy();
      }

      q2ChartInstance = renderLineLikeChart("q2-chart", data, {
        isScatter: false,
        fillArea: true,
      });
    } catch (err) {
      setResult("q2-result", `Lỗi khi gọi API chart-data (Câu 2): ${err}`);
    }
  });

  // Câu 3: seasonality_monthly (Vẽ một đường trung bình)
  const btnQ3 = document.getElementById("btn-q3-draw");
  btnQ3?.addEventListener("click", async () => {
    const variable = document.getElementById("q3-variable")?.value || "temperature";
    setResult("q3-result", "Đang gọi API /analysis/chart-data (Vẽ seasonal Câu 3)...");

    try {
      const json = await fetchChartData({
        variable,
        chart_kind: "seasonality_monthly",
      });

      if (json.status !== "success") {
        setResult("q3-result", json);
        return;
      }

      const data = json.data;
      setResult("q3-result", data);

      if (q3ChartInstance) {
        q3ChartInstance.destroy();
      }

      q3ChartInstance = renderLineLikeChart("q3-chart", data, {
        isScatter: false,
        fillArea: false,
      });
    } catch (err) {
      setResult("q3-result", `Lỗi khi gọi API chart-data (Vẽ seasonal Câu 3): ${err}`);
    }
  });
  
  // NÚT MỚI: So sánh các năm (Vẽ nhiều đường)
  const btnQ3Compare = document.getElementById("btn-q3-compare");
  btnQ3Compare?.addEventListener("click", async () => {
    const variable = document.getElementById("q3-variable")?.value || "temperature";
    setResult("q3-result", "Đang gọi API /analysis/chart-data (So sánh các năm)...");

    try {
      const json = await fetchChartData({
        variable,
        chart_kind: "seasonal_yearly_comparison", // Loại chart mới
      });

      if (json.status !== "success") {
        setResult("q3-result", json);
        return;
      }

      const data = json.data;
      setResult("q3-result", data);

      if (q3ChartInstance) {
        q3ChartInstance.destroy();
      }

      // Gọi hàm render mới
      q3ChartInstance = renderSeasonalComparisonChart("q3-chart", data); 

    } catch (err) {
      setResult("q3-result", `Lỗi khi gọi API chart-data (So sánh các năm): ${err}`);
    }
  });

  // Nút reset zoom cho từng chart
  const btnQ1Reset = document.getElementById("btn-q1-reset");
  btnQ1Reset?.addEventListener("click", () => {
    if (q1ChartInstance && typeof q1ChartInstance.resetZoom === "function") {
      q1ChartInstance.resetZoom();
    }
  });

  const btnQ2Reset = document.getElementById("btn-q2-reset");
  btnQ2Reset?.addEventListener("click", () => {
    if (q2ChartInstance && typeof q2ChartInstance.resetZoom === "function") {
      q2ChartInstance.resetZoom();
    }
  });

  const btnQ3Reset = document.getElementById("btn-q3-reset");
  btnQ3Reset?.addEventListener("click", () => {
    if (q3ChartInstance && typeof q3ChartInstance.resetZoom === "function") {
      q3ChartInstance.resetZoom();
    }
  });
});