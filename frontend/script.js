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

    /* --- TAB NAVIGATION --- */
    document.querySelectorAll(".tab-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.tab;
            document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(id)?.classList.add("active");
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
        const rangeDays = document.getElementById("q1-window")?.value; // Lấy giá trị phạm vi
        const resampleFreq = document.getElementById("q1-resample-freq")?.value; // LẤY TẦN SUẤT GỘP

        setResult("q1-result", "Đang tải dữ liệu...");
        const params = {
            variable,
            chart_kind: chartType === "histogram" ? "histogram" : "time_series",
            days: rangeDays, // Gửi phạm vi
            bins: document.getElementById("q1-bins")?.value,
            resample_freq: resampleFreq, // GỬI TẦN SUẤT GỘP MỚI
        };
        const json = await fetchChart(params);
        if (json.status !== "success") return setResult("q1-result", json);

        const data = json.data;
        setResult("q1-result", data);

        if (q1Chart) q1Chart.destroy();
        if (data.kind === "histogram") {
            q1Chart = renderHistogramChart("q1-chart", data, `${data.variable} - histogram`);
        } else {
            // Nhãn trục Y sẽ được lấy từ data.y_label bên trong renderLineLikeChart
            q1Chart = renderLineLikeChart("q1-chart", data, {
                label: `${data.x_label}`, // Dùng x_label làm label dataset tạm, y_label sẽ dùng từ data.y_label
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
