// Thay đổi BASE_URL nếu frontend chạy ở domain khác
// Mặc định: cùng host với FastAPI (vd: http://localhost:8000)
const BASE_URL = "";

// === HÀM HELPER CƠ BẢN ===
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

// === CẤU HÌNH ZOOM & PAN (MỚI) ===
const commonZoomOptions = {
    pan: {
        enabled: true,
        mode: 'x', // Chỉ cho phép kéo sang trái/phải
    },
    zoom: {
        wheel: {
            enabled: true, // Cho phép lăn chuột để zoom
        },
        pinch: {
            enabled: true // Cho phép dùng 2 ngón tay zoom trên mobile
        },
        mode: 'x', // Chỉ zoom trục X (thời gian)
    }
};

// === CÁC HÀM RENDER CHART (CHART.JS) ===

function renderSeasonalComparisonChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    
    // Danh sách màu sắc cho các năm
    const colorPalette = [
        "rgba(255, 99, 132, 1)", // Đỏ
        "rgba(54, 162, 235, 1)", // Xanh dương
        "rgba(255, 206, 86, 1)", // Vàng
        "rgba(75, 192, 192, 1)", // Xanh lá
        "rgba(153, 102, 255, 1)", // Tím
    ];

    const labels = data.datasets.length > 0 ? data.datasets[0].points.map((p) => p.x) : [];

    const datasets = data.datasets.map((ds, index) => {
        const values = ds.points.map((p) => p.y);
        const color = colorPalette[index % colorPalette.length];

        return {
            label: ds.label, 
            data: values,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.1)'),
            tension: 0.25,
            fill: false,
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
                    title: { display: true, text: data.x_label || "Month (1-12)" },
                    ticks: { stepSize: 1 },
                },
                y: {
                    title: { display: true, text: data.y_label || "Y" },
                },
            },
            plugins: {
                legend: { display: true, position: 'top' },
                zoom: commonZoomOptions, // <--- KÍCH HOẠT ZOOM
                title: {
                    display: true,
                    text: 'Mẹo: Lăn chuột để phóng to, giữ chuột trái kéo để di chuyển',
                    position: 'bottom',
                    font: { size: 10, style: 'italic' },
                    color: '#666'
                }
            }
        },
    });
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
        maintainAspectRatio: false, // Fix chiều cao
        scales: {
          x: { title: { display: true, text: data.x_label || "X" } },
          y: { title: { display: true, text: data.y_label || "Y" } },
        },
        plugins: {
            zoom: commonZoomOptions, // <--- KÍCH HOẠT ZOOM
            title: {
                display: true,
                text: 'Lăn chuột để Zoom',
                position: 'bottom',
                font: { size: 10, style: 'italic' }
            }
        }
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
            showLine: !isScatter,
            pointRadius: isScatter ? 3 : 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Fix chiều cao
        scales: {
          x: { title: { display: true, text: data.x_label || "X" } },
          y: { title: { display: true, text: data.y_label || "Y" } },
        },
        plugins: {
            zoom: commonZoomOptions, // <--- KÍCH HOẠT ZOOM
            title: {
                display: true,
                text: 'Mẹo: Lăn chuột để phóng to, Kéo để di chuyển',
                position: 'bottom',
                font: { size: 10, style: 'italic' },
                color: '#666'
            }
        }
      },
    });
}

// === MAIN LOGIC (GIỮ NGUYÊN) ===

document.addEventListener("DOMContentLoaded", () => {
  // 1. Tabs điều hướng
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

  // 2. Predict theo ngày
  const btnPredict = document.getElementById("btn-predict");
  btnPredict?.addEventListener("click", async () => {
    const dateInput = document.getElementById("predict-date");
    const day = dateInput?.value;
    
    // UI Elements
    const defaultView = document.getElementById('forecast-default');
    const resultView = document.getElementById('forecast-visual-result');
    const btn = btnPredict;

    if (!day) {
      alert("Vui lòng chọn ngày (YYYY-MM-DD).");
      return;
    }

    // Loading
    const originalText = '<i class="fa-solid fa-magnifying-glass-chart"></i> &nbsp;Lấy dự báo';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/predict/predict/${day}`);
        if (!res.ok) {
            const text = await res.text();
            alert(`Lỗi HTTP ${res.status}: ${text}`);
            return;
        }

        const json = await res.json();

        if (json.status === 'success') {
            const data = json.data;
            
            // Lấy 3 biến số quan trọng
            const temp = parseFloat(data.pred_temperature);
            const rain = parseFloat(data.pred_precipitation);
            const cloud = parseFloat(data.pred_cloudcover);

            // --- Logic Icon Minh Họa ---
            let iconClass = "fa-cloud-sun";
            let colorClass = "icon-cloud"; 

            if (rain > 1.0) {
                iconClass = "fa-cloud-showers-heavy";
                colorClass = "icon-rain";
            } else if (rain > 0.1) {
                iconClass = "fa-cloud-rain";
                colorClass = "icon-rain";
            } else if (cloud > 60) {
                iconClass = "fa-cloud";
                colorClass = "icon-cloud";
            } else if (cloud > 30) {
                iconClass = "fa-cloud-sun";
                colorClass = "icon-sun";
            } else {
                iconClass = "fa-sun";
                colorClass = "icon-sun";
            }

            // --- CẬP NHẬT GIAO DIỆN ---
            // 1. Icon minh họa
            const iconEl = document.getElementById('f-icon');
            if(iconEl) iconEl.className = `fa-solid ${iconClass} ${colorClass}`;

            // 2. Ngày
            const dateEl = document.getElementById('f-date-display');
            if(dateEl) dateEl.textContent = `Dự báo cho ngày: ${data.date}`;
            
            // 3. Số liệu
            const tempEl = document.getElementById('f-temp');
            if(tempEl) tempEl.textContent = `${temp.toFixed(1)}°C`;
            
            const rainEl = document.getElementById('f-rain');
            if(rainEl) rainEl.textContent = `${rain.toFixed(2)}mm`;
            
            const cloudEl = document.getElementById('f-cloud');
            if(cloudEl) cloudEl.textContent = `${cloud.toFixed(1)}%`;

            // Hiện kết quả
            if(defaultView) defaultView.style.display = 'none';
            if(resultView) resultView.style.display = 'block';

        } else {
            alert("Lỗi từ server: " + (json.message || JSON.stringify(json)));
        }

    } catch (err) {
        console.error(err);
        alert(`Lỗi kết nối: ${err}`);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
  });

  // ============================================================
  // 3. Cluster Auto (VISUAL UI)
  // ============================================================
  const btnClusterAuto = document.getElementById("btn-cluster-auto");
  btnClusterAuto?.addEventListener("click", async () => {
    const resultContainer = document.getElementById('cluster-visual-result');
    const btn = btnClusterAuto;

    // Hiệu ứng Loading
    const originalText = '<i class="fa-solid fa-wand-magic-sparkles"></i> &nbsp;Phân tích ngay';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...';
    btn.disabled = true;
    
    // Ẩn kết quả cũ nếu có
    if (resultContainer) resultContainer.style.display = 'none';

    try {
        const res = await fetch(BASE_URL + "/cluster/cluster/auto-latest");
        const json = await res.json();

        if (json.status === 'success') {
            const data = json.data;
            const label = data.predicted_label;
            
            // Map icon & color
            const iconEl = document.getElementById('w-icon');
            let iconClass = 'fa-cloud';
            let colorClass = 'icon-cloud';

            if (label.includes("Âm u")) {
                iconClass = "fa-cloud";
                colorClass = "icon-cloud";
            } 
            else if (label.includes("Quang đãng")) {
                iconClass = "fa-sun";
                colorClass = "icon-sun";
            }
            else if (label.includes("Mưa nhẹ")) {
                iconClass = "fa-cloud-rain";
                colorClass = "icon-rain";
            }
            else if (label.includes("Mưa vừa")) {
                iconClass = "fa-cloud-showers-heavy";
                colorClass = "icon-rain";
            }
            else if (label.includes("Mưa lớn")) {
                iconClass = "fa-cloud-bolt"; 
                colorClass = "icon-storm";
            }

            // Update DOM
            if (iconEl) iconEl.className = `fa-solid ${iconClass} ${colorClass}`;
            
            const wLabel = document.getElementById('w-label');
            if (wLabel) wLabel.textContent = label;

            const wDate = document.getElementById('w-date');
            if (wDate) wDate.textContent = `Dự báo cho ngày: ${data.date_forecast}`;
            
            const inputs = data.inputs || {};
            const wTemp = document.getElementById('w-temp');
            const wRain = document.getElementById('w-rain');
            const wCloud = document.getElementById('w-cloud');

            if(wTemp) wTemp.textContent = `${parseFloat(inputs.temperature || 0).toFixed(1)}°C`;
            if(wRain) wRain.textContent = `${parseFloat(inputs.precipitation || 0).toFixed(2)}mm`;
            if(wCloud) wCloud.textContent = `${parseFloat(inputs.cloudcover || 0).toFixed(1)}%`;
            
            const wNote = document.getElementById('w-note');
            if(wNote) wNote.textContent = data.logic_note || "AI Analysis";

            // Hiện kết quả
            if (resultContainer) resultContainer.style.display = 'block';

        } else {
            alert("API Error: " + (json.message || JSON.stringify(json)));
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi kết nối tới Server: " + err);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
  });


  // ====== 4. PHÂN TÍCH DỮ LIỆU ======

  let q1ChartInstance = null;
  let q2ChartInstance = null;
  let q3ChartInstance = null;

  async function fetchChartData(paramsObj) {
    const params = new URLSearchParams(paramsObj);
    const res = await fetch(`${BASE_URL}/analysis/chart-data?${params.toString()}`);
    return res.json();
  }

  // Câu 1
  const btnQ1 = document.getElementById("btn-q1-draw");
  btnQ1?.addEventListener("click", async () => {
    const variable = document.getElementById("q1-variable")?.value || "temperature";
    const chartType = document.getElementById("q1-chart-type")?.value || "line";
    const windowSelect = document.getElementById("q1-window");
    const binsInput = document.getElementById("q1-bins");

    const days = windowSelect ? parseInt(windowSelect.value, 10) || 30 : 30;
    const bins = binsInput ? parseInt(binsInput.value, 10) || 20 : 20;

    setResult("q1-result", "Đang tải dữ liệu...");

    try {
      const chartKind = chartType === "histogram" ? "histogram" : "time_series";
      const params = { variable, chart_kind: chartKind };
      
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
      setResult("q1-result", data); // Hiển thị text log

      if (q1ChartInstance) q1ChartInstance.destroy();

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
      setResult("q1-result", `Lỗi: ${err}`);
    }
  });

  // Câu 2
  const btnQ2 = document.getElementById("btn-q2-draw");
  btnQ2?.addEventListener("click", async () => {
    const variable = document.getElementById("q2-variable")?.value || "temperature";
    setResult("q2-result", "Đang tải dữ liệu...");

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

      if (q2ChartInstance) q2ChartInstance.destroy();

      q2ChartInstance = renderLineLikeChart("q2-chart", data, {
        isScatter: false,
        fillArea: true,
      });
    } catch (err) {
      setResult("q2-result", `Lỗi: ${err}`);
    }
  });

  // Câu 3: seasonality_monthly (1 đường trung bình)
  const btnQ3 = document.getElementById("btn-q3-draw");
  btnQ3?.addEventListener("click", async () => {
    const variable = document.getElementById("q3-variable")?.value || "temperature";
    setResult("q3-result", "Đang tải dữ liệu...");

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

      if (q3ChartInstance) q3ChartInstance.destroy();

      q3ChartInstance = renderLineLikeChart("q3-chart", data, {
        isScatter: false,
        fillArea: false,
      });
    } catch (err) {
      setResult("q3-result", `Lỗi: ${err}`);
    }
  });
  
  // Câu 3: So sánh các năm (Nhiều đường)
  const btnQ3Compare = document.getElementById("btn-q3-compare");
  btnQ3Compare?.addEventListener("click", async () => {
    const variable = document.getElementById("q3-variable")?.value || "temperature";
    setResult("q3-result", "Đang tải dữ liệu so sánh các năm...");

    try {
      const json = await fetchChartData({
        variable,
        chart_kind: "seasonal_yearly_comparison",
      });

      if (json.status !== "success") {
        setResult("q3-result", json);
        return;
      }

      const data = json.data;
      setResult("q3-result", data);

      if (q3ChartInstance) q3ChartInstance.destroy();

      q3ChartInstance = renderSeasonalComparisonChart("q3-chart", data); 

    } catch (err) {
      setResult("q3-result", `Lỗi: ${err}`);
    }
  });
});