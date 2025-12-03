import pandas as pd
import numpy as np
from pymongo import MongoClient
from datetime import datetime, timedelta
from typing import Literal, Optional, Dict, Any, List # Import Optional

TIME_COLUMN = "date"
VARIABLES = ["temperature", "relative_humidity", "precipitation"]

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_NAME = "new_york_hourly"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ------------------ KHU VỰC CACHE MỚI -------------------
CHART_CACHE: Dict[str, Any] = {}
CORRELATION_MATRIX_CACHE: Optional[Dict[str, Any]] = None
# --------------------------------------------------------


def load_data():
    """Load toàn bộ dữ liệu từ MongoDB, chuẩn hóa index thời gian."""
    data = list(collection.find({}))
    if not data:
        return None

    df = pd.DataFrame(data)
    df.drop(columns=["_id"], errors="ignore", inplace=True)

    df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN])
    df.set_index(TIME_COLUMN, inplace=True)
    df.sort_index(inplace=True)
    df["Month"] = df.index.month
    return df


def _validate_variable(variable: str) -> str:
    v = variable.lower()
    if v not in VARIABLES:
        raise ValueError(f"Variable '{variable}' không hợp lệ. Hỗ trợ: {', '.join(VARIABLES)}")
    return v


def _filter_time_window(df: pd.DataFrame, days: int) -> pd.DataFrame:
    """Lọc dữ liệu trong N ngày gần nhất."""
    if df.empty:
        return df
    end = df.index.max()
    start = end - timedelta(days=days)
    return df.loc[start:end]


def get_time_series_data(
    variable: str,
    days: Optional[int] = 30, # Cho phép days là None (tức là 'all')
    resample_freq: Optional[str] = None, # THAM SỐ MỚI: Tần suất gộp
) -> Dict[str, Any]:
    """
    Dữ liệu time series (theo thời gian thật) cho 1 biến, trong N ngày gần nhất,
    có thể được gộp (resample) theo tần suất: H, D, W, M.
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    df_win = df
    if days is not None: # Nếu days là None (tức là 'all'), ta dùng toàn bộ df
        df_win = _filter_time_window(df, days)
    
    if df_win.empty:
        return None

    series = df_win[var].dropna()
    
    # LOGIC RESAMPLING (Gộp theo tần suất)
    freq = resample_freq.upper() if resample_freq else "H"
    if freq != "H":
        # Thực hiện resampling theo tần suất (D, W, M,...) và tính trung bình (mean)
        series = series.resample(freq).mean().dropna()

    # Định dạng trục X và nhãn trục X cho phù hợp với tần suất gộp
    x_format = "%Y-%m-%d %H:%M:%S"
    x_label = f"{var} - Hourly"
    
    if freq == "D":
        x_format = "%Y-%m-%d"
        x_label = f"{var} - Daily Mean"
    elif freq == "W":
        x_format = "%Y-%m-%d" # Ngày đầu tiên của tuần
        x_label = f"{var} - Weekly Mean"
    elif freq == "M":
        x_format = "%Y-%m"
        x_label = f"{var} - Monthly Mean"
    # Nếu là "H", dùng mặc định

    points = [
        {"x": ts.strftime(x_format), "y": float(val)}
        for ts, val in series.items()
    ]

    return {
        "kind": "time_series",
        "variable": var,
        "window_days": days,
        "resample_freq": freq, # Trả về tần suất gộp
        "x_label": x_label, # Nhãn trục X đã cập nhật
        "y_label": var,
        "points": points,
    }


def get_histogram_data(
    variable: str,
    days: Optional[int] = 30, # Cho phép days là None (tức là 'all')
    bins: int = 20,
) -> Dict[str, Any]:
    """Histogram của 1 biến trong N ngày gần nhất."""
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    df_win = df
    if days is not None: # Nếu days là None (tức là 'all'), ta dùng toàn bộ df
        df_win = _filter_time_window(df, days)
        
    if df_win.empty:
        return None

    series = df_win[var].dropna()
    if series.empty:
        return None

    # Dùng numpy trực tiếp thay vì pd.np (đã bị remove trong pandas mới)
    counts, bin_edges = np.histogram(series.values, bins=bins)

    # Trả về mid-point mỗi bin cho FE vẽ nếu cần
    mids: List[float] = []
    for i in range(len(bin_edges) - 1):
        mids.append(float((bin_edges[i] + bin_edges[i + 1]) / 2.0))

    return {
        "kind": "histogram",
        "variable": var,
        "window_days": days,
        "bins": bins,
        "x_label": var,
        "y_label": "count",
        "bin_edges": [float(b) for b in bin_edges],
        "counts": [int(c) for c in counts],
        "bin_mids": mids,
    }


def get_trend_data(variable: str) -> Dict[str, Any]:
    """
    Trend: dữ liệu sau khi resample về tháng (mean theo tháng) theo thời gian.
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    data = df[var].resample("ME").mean().dropna()
    if data.empty:
        return None

    points = [
        {"x": ts.strftime("%Y-%m"), "y": float(val)}
        for ts, val in data.items()
    ]

    return {
        "kind": "trend_monthly",
        "variable": var,
        "x_label": "month (YYYY-MM)",
        "y_label": var,
        "points": points,
    }


def get_seasonality_data(variable: str) -> Dict[str, Any]:
    """
    Seasonal line (Trung bình): dữ liệu re-sampling về tháng, group theo Month (1-12).
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    # Dùng chính series resample('M') rồi group theo month-of-year
    monthly = df[var].resample("ME").mean().dropna()
    if monthly.empty:
        return None

    # Tính trung bình của tất cả các năm cho mỗi tháng
    seasonal = monthly.groupby(monthly.index.month).mean()

    points = [
        {"x": int(month), "y": float(val)}
        for month, val in seasonal.items()
    ]

    return {
        "kind": "seasonality_monthly",
        "variable": var,
        "x_label": "Month (1-12)",
        "y_label": var,
        "points": points,
    }


def get_seasonal_comparison_data(variable: str) -> Dict[str, Any]:
    """
    Seasonal line comparison: dữ liệu re-sampling về tháng, so sánh giữa tất cả các năm có sẵn.
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    # 1. Re-sample về monthly mean
    monthly = df[var].resample("ME").mean().dropna()
    if monthly.empty:
        return None

    # *** LOGIC MỚI: TỰ ĐỘNG LẤY TẤT CẢ CÁC NĂM CÓ DỮ LIỆU ***
    
    # 2. Tạo cột Year và Month cho pivot
    monthly_df = monthly.to_frame(name=var)
    monthly_df["Year"] = monthly_df.index.year
    monthly_df["Month"] = monthly_df.index.month

    # 3. Pivot: Month làm index, Year làm columns
    pivoted_df = monthly_df.pivot(index="Month", columns="Year", values=var)

    # 4. Chuyển đổi thành format cho frontend (nhiều series)
    datasets = []
    # Lấy tất cả các cột Năm có trong pivoted_df (ví dụ: [2024, 2025, 2026] nếu dữ liệu có)
    years = sorted(pivoted_df.columns.tolist()) 

    # Chỉ so sánh những năm có đủ dữ liệu từ 2024 trở đi.
    # Ở đây, ta sẽ chỉ lấy các năm >= 2024 theo yêu cầu ban đầu.
    years = [y for y in years if y >= 2024]
    
    for year in years:
        series_data = pivoted_df[year].dropna()
        # Đảm bảo trục x (Month) có giá trị từ 1-12
        points = [
            {"x": int(month), "y": float(val)}
            for month, val in series_data.items()
        ]
        datasets.append(
            {
                "label": str(year), # Label là tên năm (vd: "2024")
                "points": points,
            }
        )
    
    # Lọc bỏ nếu không có năm nào >= 2024
    if not datasets:
        return None

    return {
        "kind": "seasonal_yearly_comparison",
        "variable": var,
        "x_label": "Month (1-12)",
        "y_label": var,
        "datasets": datasets, # Trả về list datasets thay vì points
        "years": years,
    }


# ------------------ HÀM MỚI VÀ SỬA ĐỔI CHO CACHING ------------------

def _calculate_correlation_matrix() -> Optional[Dict[str, Any]]:
    """Logic tính toán correlation matrix gốc (đã được tách ra)."""
    df = load_data()
    if df is None or df.empty:
        return None
    
    # Reset index để loại bỏ cột date
    df_numeric = df.reset_index(drop=True)
    
    # Loại bỏ các cột không cần thiết
    columns_to_drop = ['Unnamed: 0', 'date']
    df_numeric = df_numeric.drop(columns=columns_to_drop, errors='ignore')
    
    # Chỉ giữ các cột numeric
    df_numeric = df_numeric.select_dtypes(include=[np.number])
    
    # Tính correlation matrix
    corr_matrix = df_numeric.corr()
    
    return {
        "variables": corr_matrix.columns.tolist(),
        "matrix": corr_matrix.values.tolist(),
        "data": [
            {
                "var1": var1,
                "var2": var2,
                "correlation": round(corr_matrix.loc[var1, var2], 3)
            }
            for var1 in corr_matrix.columns
            for var2 in corr_matrix.columns
        ]
    }

def update_correlation_matrix_cache():
    """Hàm cập nhật cache cho Correlation Matrix."""
    global CORRELATION_MATRIX_CACHE
    CORRELATION_MATRIX_CACHE = _calculate_correlation_matrix()

def update_chart_cache():
    """Cập nhật cache cho các loại chart tính trên toàn bộ dữ liệu (Trend, Seasonality, Comparison)."""
    global CHART_CACHE
    CHART_CACHE = {} # Xóa cache cũ

    # Tận dụng các hàm tính toán gốc
    for var in VARIABLES:
        # 1. Trend Monthly
        trend_data = get_trend_data(var)
        if trend_data:
            CHART_CACHE[f"trend_monthly_{var}"] = trend_data

        # 2. Seasonality Monthly
        seasonality_data = get_seasonality_data(var)
        if seasonality_data:
            CHART_CACHE[f"seasonality_monthly_{var}"] = seasonality_data

        # 3. Seasonal Yearly Comparison
        comparison_data = get_seasonal_comparison_data(var)
        if comparison_data:
            CHART_CACHE[f"seasonal_yearly_comparison_{var}"] = comparison_data

def get_correlation_matrix():
    """
    Trả về ma trận correlation. Ưu tiên đọc từ cache.
    """
    if CORRELATION_MATRIX_CACHE:
        return CORRELATION_MATRIX_CACHE
    
    # Nếu cache rỗng (lần chạy đầu), tính toán trực tiếp
    return _calculate_correlation_matrix()

# ---------------------------------------------------------------------
# SỬA ĐỔI HÀM get_chart_data ĐỂ DÙNG CACHE
def get_chart_data(
    variable: str,
    chart_kind: Literal[
        "time_series",
        "histogram",
        "trend_monthly",
        "seasonality_monthly",
        "seasonal_yearly_comparison", 
    ] = "time_series",
    days: Optional[int] = 30, 
    bins: int = 20,
    resample_freq: Optional[str] = None, 
) -> Dict[str, Any]:

    # 1. KIỂM TRA CACHE cho các chart tính trên toàn bộ dữ liệu
    if chart_kind in ["trend_monthly", "seasonality_monthly", "seasonal_yearly_comparison"]:
        cache_key = f"{chart_kind}_{variable}"
        if cache_key in CHART_CACHE:
            return CHART_CACHE[cache_key]

    # 2. TÍNH TOÁN theo yêu cầu (Time Series, Histogram, và trường hợp cache miss)
    if chart_kind == "time_series":
        return get_time_series_data(variable, days, resample_freq) 
    if chart_kind == "histogram":
        return get_histogram_data(variable, days, bins)
    
    # Fallback/Tính toán nếu cache miss
    if chart_kind == "trend_monthly":
        return get_trend_data(variable)
    if chart_kind == "seasonality_monthly":
        return get_seasonality_data(variable)
    if chart_kind == "seasonal_yearly_comparison": 
        return get_seasonal_comparison_data(variable)

    raise ValueError(
        "chart_kind không hợp lệ. Hỗ trợ: "
        "'time_series', 'histogram', 'trend_monthly', 'seasonality_monthly', 'seasonal_yearly_comparison'"
    )