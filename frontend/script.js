// Thay đổi BASE_URL nếu frontend chạy ở domain khác
// Mặc định: cùng host với FastAPI (vd: http://localhost:8000)
const BASE_URL = "";

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

  // Câu 3: seasonality_monthly
  const btnQ3 = document.getElementById("btn-q3-draw");
  btnQ3?.addEventListener("click", async () => {
    const variable = document.getElementById("q3-variable")?.value || "temperature";
    setResult("q3-result", "Đang gọi API /analysis/chart-data (Câu 3)...");

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
      setResult("q3-result", `Lỗi khi gọi API chart-data (Câu 3): ${err}`);
    }
  });
});


