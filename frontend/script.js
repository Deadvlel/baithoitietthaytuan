/************************************************************
 * 1. CẤU HÌNH HỆ THỐNG
 ************************************************************/
const BASE_URL = ""; // Nếu frontend host riêng, sửa tại đây

// Kiểm tra HammerJS
if (typeof Hammer === "undefined") {
    console.warn("Cảnh báo: HammerJS chưa được tải. Tính năng Pan sẽ không hoạt động!");
}

// Đăng ký plugin Zoom (Chart.js)
if (typeof ChartZoom !== "undefined" && typeof Chart !== "undefined") {
    Chart.register(ChartZoom);
}


/************************************************************
 * 2. HÀM TIỆN ÍCH (HELPERS)
 ************************************************************/
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
            headers: { "Content-Type": "application/json" },
            ...options,
        });

        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            const text = await res.text();
            setResult(targetResultId, `Lỗi HTTP ${res.status}: ${text}`);
            return;
        }

        if (contentType.includes("application/json")) {
            setResult(targetResultId, await res.json());
        } else {
            setResult(targetResultId, await res.text());
        }
    } catch (err) {
        setResult(targetResultId, `Lỗi khi gọi API: ${err}`);
    }
}


/************************************************************
 * 3. CẤU HÌNH ZOOM / PAN CHO CHART.JS
 ************************************************************/

const commonZoomOptions = {
    pan: {
        enabled: true,
        mode: "x",
        threshold: 10,
    },
    zoom: {
        wheel: { enabled: true, speed: 0.1 },
        pinch: { enabled: true },
        mode: "x",
    },
    limits: {
        x: { min: "original", max: "original", minRange: 1 },
    },
};

/* === ZOOM/PAN RIÊNG CHO SEASONALITY === */
const seasonalityZoomOptions = {
    pan: {
        enabled: true,       
        mode: "x",           
        threshold: 10,       
        modifierKey: null,   
        onPanComplete: ({ chart }) => {
            // Reset drag state sau pan để tránh zoom không mong muốn
            if (chart._zoomState) {
                chart._zoomState.dragStart = null;
                chart._zoomState.dragEnd = null;
            }
        },
    },
    zoom: {
        wheel: { enabled: true, speed: 0.12 }, 
        pinch: { enabled: true },             
        drag: { enabled: false },              
        mode: "x",
    },
    limits: {
        x: { min: "original", max: "original", minRange: 1 },
    },
};


/************************************************************
 * 4. HÀM RENDER BIỂU ĐỒ (Chart.js)
 ************************************************************/

// 4.1 – So sánh theo năm (multiple line)
function renderSeasonalComparisonChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    const colors = [
        "rgba(255,99,132,1)",
        "rgba(54,162,235,1)",
        "rgba(255,206,86,1)",
        "rgba(75,192,192,1)",
        "rgba(153,102,255,1)",
    ];

    const labels = data.datasets[0]?.points.map((p) => p.x) || [];

    const datasets = data.datasets.map((ds, i) => {
        const color = colors[i % colors.length];
        return {
            label: ds.label,
            data: ds.points.map((p) => p.y),
            borderColor: color,
            backgroundColor: color.replace("1)", "0.1)"),
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
        };
    });

    return new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: data.x_label || "Month" } },
                y: { title: { display: true, text: data.y_label || "Value" } },
            },
            plugins: {
                legend: { position: "top" },
                zoom: commonZoomOptions,
                title: {
                    display: true,
                    text: "Lăn chuột để zoom – kéo để dịch chuyển",
                    position: "bottom",
                    font: { size: 10, style: "italic" },
                },
            },
        },
    });
}

// 4.2 – Histogram
function renderHistogramChart(canvasId, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    return new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.bin_mids || data.bin_edges,
            datasets: [
                {
                    label,
                    data: data.counts,
                    backgroundColor: "rgba(129,140,248,0.6)",
                    borderColor: "rgba(129,140,248,1)",
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { zoom: commonZoomOptions },
        },
    });
}

// 4.3 – Line / Scatter chung
function renderLineLikeChart(canvasId, data, { label, isScatter = false, fillArea = true }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    const labels = data.points.map((p) => p.x);
    const values = data.points.map((p) => p.y);

    return new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label,
                    data: values,
                    tension: isScatter ? 0 : 0.25,
                    borderColor: "rgba(56,189,248,1)",
                    backgroundColor: "rgba(56,189,248,0.3)",
                    fill: fillArea,
                    showLine: !isScatter,
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
                        text: data.x_label || 'datetime' // SỬ DỤNG data.x_label
                    } 
                },
                y: { 
                    title: { 
                        display: true, 
                        text: data.y_label || 'Value' // SỬ DỤNG data.y_label
                    } 
                },
            },
            plugins: { zoom: commonZoomOptions },
        },
    });
}

// 4.4 – Seasonality chart riêng – CHỈ PAN, KHÔNG DRAG ZOOM
function renderSeasonalityChart(canvasId, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    const labels = data.points.map(p => p.x);
    const values = data.points.map(p => p.y);

    return new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                borderColor: "rgba(56,189,248,1)",
                backgroundColor: "rgba(56,189,248,0.3)",
                tension: 0.25,
                pointRadius: 3,
                fill: false
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                zoom: seasonalityZoomOptions,
            },
        },
    });
}


/************************************************************
 * 5. LOGIC GIAO DIỆN (UI EVENTS)
 ************************************************************/
document.addEventListener("DOMContentLoaded", () => {
    
    // Lấy sidebar element
    const analysisSidebar = document.getElementById("main-analysis-sidebar");

    /* --- TAB NAVIGATION --- */
    document.querySelectorAll(".tab-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.tab;
            
            // Ẩn/hiện sidebar dựa trên tab được chọn
            if (id === "tab-analysis" && analysisSidebar) {
                // Kiểm tra media query để chỉ hiện trên màn hình lớn
                if (window.matchMedia("(min-width: 1025px)").matches) {
                    analysisSidebar.style.display = "block";
                }
            } else if (analysisSidebar) {
                analysisSidebar.style.display = "none";
            }

            document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(id)?.classList.add("active");
        });
    });

    // Ban đầu, thiết lập trạng thái ẩn/hiện của sidebar
    const activeTabId = document.querySelector(".tab-button.active").dataset.tab;
    if (analysisSidebar) {
        if (activeTabId === "tab-analysis" && window.matchMedia("(min-width: 1025px)").matches) {
            analysisSidebar.style.display = "block";
        } else {
            analysisSidebar.style.display = "none";
        }
    }


    /* --- ANALYSIS QUICK NAV --- */
    document.querySelectorAll(".analysis-nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                // Cuộn mượt mà đến phần tử, trừ đi một khoảng offset nhỏ cho thanh header/tabs
                // 90px (Header) + ~60px (Sticky Tabs) + 10px (khoảng cách) = ~160px
                window.scrollTo({
                    top: targetEl.offsetTop - 160, 
                    behavior: 'smooth'
                });
            }
        });
    });

    /* --- PREDICT --- */
    const btnPredict = document.getElementById("btn-predict");
    btnPredict?.addEventListener("click", async () => {
        const day = document.getElementById("predict-date")?.value;
        if (!day) return alert("Vui lòng chọn ngày!");
        const btn = btnPredict;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fa-spinner fa-spin"></i> Đang xử lý...';
        btn.disabled = true;

        try {
            const res = await fetch(`${BASE_URL}/predict/predict/${day}`);
            const json = await res.json();
            if (json.status === "success") updateForecastUI(json.data);
            else alert(json.message);
        } catch (e) { alert("Lỗi kết nối: " + e); }
        finally { btn.innerHTML = original; btn.disabled = false; }
    });

    /* --- CLUSTER AUTO --- */
    const btnClusterAuto = document.getElementById("btn-cluster-auto");
    btnClusterAuto?.addEventListener("click", async () => {
        const btn = btnClusterAuto;
        const resultDiv = document.getElementById("cluster-visual-result");
        const loading = '<i class="fa-spinner fa-spin"></i> Đang phân tích...';
        const original = btn.innerHTML;
        btn.innerHTML = loading;
        btn.disabled = true;
        resultDiv.style.display = "none";

        try {
            const res = await fetch(`${BASE_URL}/cluster/cluster/auto-latest`);
            const json = await res.json();
            if (json.status === "success") updateClusterUI(json.data);
            else alert(json.message);
        } catch (e) { alert("Lỗi kết nối: " + e); }
        finally { btn.innerHTML = original; btn.disabled = false; }
    });

    /* --- INGESTION --- */
    document.getElementById("btn-refresh-ingestion")?.addEventListener("click", () => {
        callApi("/ingestion/refresh", { method: "POST" }, "ingestion-result");
    });

    /* --- ANALYSIS CHARTS --- */
    let q1Chart, q2Chart, q3Chart;

    async function fetchChart(params) {
        const query = new URLSearchParams(params);
        const res = await fetch(`${BASE_URL}/analysis/chart-data?${query.toString()}`);
        return res.json();
    }

    // --- Q1
    document.getElementById("btn-q1-draw")?.addEventListener("click", async () => {
        const variable = document.getElementById("q1-variable")?.value;
        const chartType = document.getElementById("q1-chart-type")?.value;
        const rangeDays = document.getElementById("q1-window")?.value; 
        const resampleFreq = document.getElementById("q1-resample-freq")?.value; 

        setResult("q1-result", "Đang tải dữ liệu...");
        const params = {
            variable,
            chart_kind: chartType === "histogram" ? "histogram" : "time_series",
            days: rangeDays, 
            bins: document.getElementById("q1-bins")?.value,
            resample_freq: resampleFreq, 
        };
        const json = await fetchChart(params);
        if (json.status !== "success") return setResult("q1-result", json);

        const data = json.data;
        setResult("q1-result", data);

        if (q1Chart) q1Chart.destroy();
        if (data.kind === "histogram") {
            q1Chart = renderHistogramChart("q1-chart", data, `${data.variable} - histogram`);
        } else {
            q1Chart = renderLineLikeChart("q1-chart", data, {
                label: `${data.x_label}`, 
                isScatter: chartType === "scatter",
                fillArea: chartType !== "scatter",
            });
        }
    });
    // --- Q2
    document.getElementById("btn-q2-draw")?.addEventListener("click", async () => {
        setResult("q2-result", "Đang tải dữ liệu...");
        const variable = document.getElementById("q2-variable")?.value;
        const json = await fetchChart({ variable, chart_kind: "trend_monthly" });
        if (json.status !== "success") return setResult("q2-result", json);

        const data = json.data;
        setResult("q2-result", data);

        if (q2Chart) q2Chart.destroy();
        q2Chart = renderLineLikeChart("q2-chart", data, { label: `${variable} - trend` });
    });

    // --- Q3 SEASONALITY
    document.getElementById("btn-q3-draw")?.addEventListener("click", async () => {
        setResult("q3-result", "Đang tải dữ liệu...");
        const variable = document.getElementById("q3-variable")?.value;
        const json = await fetchChart({ variable, chart_kind: "seasonality_monthly" });
        if (json.status !== "success") return setResult("q3-result", json);

        const data = json.data;
        setResult("q3-result", data);

        if (q3Chart) q3Chart.destroy();
        q3Chart = renderSeasonalityChart("q3-chart", data, `${variable} - seasonality`);
    });

    // --- Q3 COMPARE YEAR
    document.getElementById("btn-q3-compare")?.addEventListener("click", async () => {
        setResult("q3-result", "Đang tải dữ liệu...");
        const variable = document.getElementById("q3-variable")?.value;
        const json = await fetchChart({ variable, chart_kind: "seasonal_yearly_comparison" });
        if (json.status !== "success") return setResult("q3-result", json);

        const data = json.data;
        setResult("q3-result", data);

        if (q3Chart) q3Chart.destroy();
        q3Chart = renderSeasonalComparisonChart("q3-chart", data);
    });
});


/************************************************************
 * 6.5 – UPDATE UI CHO PREDICT & CLUSTER
 ************************************************************/
function updateForecastUI(data) {
    const temp = parseFloat(data.pred_temperature);
    const rain = parseFloat(data.pred_precipitation);
    const cloud = parseFloat(data.pred_cloudcover);

    const iconEl = document.getElementById("f-icon");

    let icon = "fa-cloud-sun";
    let color = "icon-cloud";

    if (rain > 1.0) { icon = "fa-cloud-showers-heavy"; color = "icon-rain"; }
    else if (rain > 0.1) { icon = "fa-cloud-rain"; color = "icon-rain"; }
    else if (cloud > 60) { icon = "fa-cloud"; color = "icon-cloud"; }
    else if (cloud > 30) { icon = "fa-cloud-sun"; color = "icon-sun"; }
    else { icon = "fa-sun"; color = "icon-sun"; }

    if (iconEl) iconEl.className = `fa-solid ${icon} ${color}`;

    document.getElementById("f-date-display").textContent = `Dự báo cho ngày: ${data.date}`;
    document.getElementById("f-temp").textContent = `${temp.toFixed(1)}°C`;
    document.getElementById("f-rain").textContent = `${rain.toFixed(2)}mm`;
    document.getElementById("f-cloud").textContent = `${cloud.toFixed(1)}%`;

    document.getElementById("forecast-default").style.display = "none";
    document.getElementById("forecast-visual-result").style.display = "block";
}

function updateClusterUI(data) {
    const label = data.predicted_label;
    const iconEl = document.getElementById("w-icon");

    let icon = "fa-cloud", color = "icon-cloud";

    if (label.includes("Quang")) { icon = "fa-sun"; color = "icon-sun"; }
    else if (label.includes("Mưa nhẹ")) { icon = "fa-cloud-rain"; color = "icon-rain"; }
    else if (label.includes("Mưa vừa")) { icon = "fa-cloud-showers-heavy"; color = "icon-rain"; }
    else if (label.includes("Mưa lớn")) { icon = "fa-cloud-bolt"; color = "icon-storm"; }

    iconEl.className = `fa-solid ${icon} ${color}`;

    document.getElementById("w-label").textContent = label;
    document.getElementById("w-date").textContent = `Dự báo cho ngày: ${data.date_forecast}`;

    const i = data.inputs || {};
    document.getElementById("w-temp").textContent = `${parseFloat(i.temperature || 0).toFixed(1)}°C`;
    document.getElementById("w-rain").textContent = `${parseFloat(i.precipitation || 0).toFixed(2)}mm`;
    document.getElementById("w-cloud").textContent = `${parseFloat(i.cloudcover || 0).toFixed(1)}%`;

    document.getElementById("w-note").textContent = data.logic_note;
    document.getElementById("cluster-visual-result").style.display = "block";
}
/**
 * Tạo màu nền OPAQUE (RGB) cho ô ma trận correlation dựa trên giá trị (từ -1 đến 1).
 * Sử dụng nội suy giữa Màu Trắng và Màu Cực Đại (Xanh/Đỏ) để tạo hiệu ứng Heatmap.
 * @param {number} value 
 * @returns {string} Màu nền CSS (rgb)
 */
function getCorrelationColor(value) {
    if (isNaN(value)) return 'rgb(243, 244, 246)'; // Màu nền xám nhẹ cho NaN
    
    const clampedValue = Math.max(-1, Math.min(1, value));
    const absValue = Math.abs(clampedValue);
    const white = 255;
    
    let r, g, b;

    if (clampedValue > 0) {
        // Blue transition (Positive): từ White (255) đến Deep Blue (~67, 97, 238)
        const R_blue = 67;
        const G_blue = 97;
        const B_blue = 238;
        
        // Công thức nội suy: White + (Màu Đích - White) * |Giá trị|
        r = Math.round(white + (R_blue - white) * absValue);
        g = Math.round(white + (G_blue - white) * absValue);
        b = Math.round(white + (B_blue - white) * absValue);
        
    } else if (clampedValue < 0) {
        // Red transition (Negative): từ White (255) đến Deep Red (~239, 68, 68)
        const R_red = 239;
        const G_red = 68;
        const B_red = 68;
        
        // Công thức nội suy: White + (Màu Đích - White) * |Giá trị|
        r = Math.round(white + (R_red - white) * absValue);
        g = Math.round(white + (G_red - white) * absValue);
        b = Math.round(white + (B_red - white) * absValue);
        
    } else {
        // Gần bằng 0 (No correlation): Light Gray
        return 'rgb(229, 231, 235)';
    }

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Render ma trận tương quan thành một bảng HTML.
 * @param {string[]} variables 
 * @param {number[][]} matrix 
 */
function renderCorrelationTable(variables, matrix) {
    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">';
    
    // Header Row... (Giữ nguyên)

    // Data Rows
    html += '<tbody>';
    for (let i = 0; i < variables.length; i++) {
        html += `<tr>`;
        // Header cột đầu tiên... (Giữ nguyên)
        
        // Các ô dữ liệu
        for (let j = 0; j < variables.length; j++) {
            const value = matrix[i][j];
            const isDiagonal = (i === j);
            const displayValue = isDiagonal ? '1.000' : (value !== null && value !== undefined) ? value.toFixed(3) : 'NaN';
            
            // *** ĐIỀU CHỈNH MÀU ĐƯỜNG CHÉO: Dùng màu xanh dương rất nhạt (RGB) ***
            const bgColor = isDiagonal ? 'rgb(220, 230, 255)' : getCorrelationColor(value); 
            
            // LOGIC MÀU CHỮ: Vẫn dùng màu trắng cho nền đậm (> 0.6)
            const textColor = isDiagonal ? 'var(--primary-color)' : 
                              (Math.abs(value) > 0.6) ? '#ffffff' : 'var(--text-main)';
html += `<td style="padding: 10px; border: 1px solid #e5e7eb; background-color: ${bgColor}; color: ${textColor}; font-weight: ${isDiagonal ? 700 : 500};">
                        ${displayValue}
                     </td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';
    html += '</table>';

    document.getElementById('q4-corr-matrix-table').innerHTML = html;
}

document.getElementById('btn-q4-load-corr').addEventListener('click', async () => {
    const resultBox = document.getElementById('q4-result');
    const matrixContainer = document.getElementById('q4-corr-matrix-table');
    const loadButton = document.getElementById('btn-q4-load-corr');

    resultBox.textContent = 'Đang tải dữ liệu...';
    matrixContainer.innerHTML = '';
    loadButton.disabled = true;

    try {
        const response = await fetch('/analysis/correlation-matrix');
        const jsonResponse = await response.json();

        resultBox.textContent = JSON.stringify(jsonResponse, null, 2);
        
        if (jsonResponse.status === 'success') {
            const { variables, matrix } = jsonResponse;
            renderCorrelationTable(variables, matrix);
            document.getElementById('q4-corr-container').querySelector('p').style.display = 'none'; // Ẩn placeholder
        } else {
            matrixContainer.innerHTML = `<p style="color: #ef4444; text-align: center;">Lỗi: ${jsonResponse.message || 'Không thể lấy ma trận tương quan.'}</p>`;
        }

    } catch (error) {
        resultBox.textContent = `Lỗi kết nối API: ${error.message}`;
        matrixContainer.innerHTML = `<p style="color: #ef4444; text-align: center;">Lỗi kết nối: ${error.message}</p>`;
    } finally {
        loadButton.disabled = false;
    }
});
