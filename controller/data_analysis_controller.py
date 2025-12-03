import pandas as pd
import numpy as np
from pymongo import MongoClient
from datetime import datetime, timedelta
from typing import Literal, Optional, Dict, Any, List

TIME_COLUMN = "date"
VARIABLES = ["temperature", "relative_humidity", "precipitation"]

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_NAME = "new_york_hourly"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]


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
    days: int = 30,
) -> Dict[str, Any]:
    """
    Dữ liệu time series (theo thời gian thật) cho 1 biến, trong N ngày gần nhất.
    FE có thể dùng cho:
    - Line chart
    - Scatter
    - Histogram (tự tính hoặc dùng histogram API riêng)
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    df_win = _filter_time_window(df, days)
    if df_win.empty:
        return None

    series = df_win[var].dropna()

    points = [
        {"x": ts.isoformat(), "y": float(val)}
        for ts, val in series.items()
    ]

    return {
        "kind": "time_series",
        "variable": var,
        "window_days": days,
        "x_label": "datetime",
        "y_label": var,
        "points": points,
    }


def get_histogram_data(
    variable: str,
    days: int = 30,
    bins: int = 20,
) -> Dict[str, Any]:
    """Histogram của 1 biến trong N ngày gần nhất."""
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

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

    data = df[var].resample("M").mean().dropna()
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
    Seasonal line: dữ liệu re-sampling về tháng, group theo Month (1-12).
    """
    var = _validate_variable(variable)

    df = load_data()
    if df is None:
        return None

    # Dùng chính series resample('M') rồi group theo month-of-year
    monthly = df[var].resample("M").mean().dropna()
    if monthly.empty:
        return None

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


def get_chart_data(
    variable: str,
    chart_kind: Literal[
        "time_series",
        "histogram",
        "trend_monthly",
        "seasonality_monthly",
    ] = "time_series",
    days: int = 30,
    bins: int = 20,
) -> Dict[str, Any]:
    """
    Hàm tổng cho routes gọi, hỗ trợ nhiều loại chart:
    - chart_kind = 'time_series'        -> time series trong N ngày (dùng cho line & scatter)
    - chart_kind = 'histogram'          -> histogram trong N ngày
    - chart_kind = 'trend_monthly'      -> trend theo tháng (resample M)
    - chart_kind = 'seasonality_monthly'-> seasonal line theo Month (1-12)
    """
    if chart_kind == "time_series":
        return get_time_series_data(variable, days)
    if chart_kind == "histogram":
        return get_histogram_data(variable, days, bins)
    if chart_kind == "trend_monthly":
        return get_trend_data(variable)
    if chart_kind == "seasonality_monthly":
        return get_seasonality_data(variable)

    raise ValueError(
        "chart_kind không hợp lệ. Hỗ trợ: "
        "'time_series', 'histogram', 'trend_monthly', 'seasonality_monthly'"
    )