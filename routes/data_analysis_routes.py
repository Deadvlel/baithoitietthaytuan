from fastapi import APIRouter
from typing import Optional # Import Optional

from controller.data_analysis_controller import (
    VARIABLES,
    get_chart_data,
)


router = APIRouter()


@router.get("/variables")
def list_variables():
    """Trả về danh sách các biến hỗ trợ."""
    return {"status": "success", "variables": VARIABLES}


@router.get("/chart-data")
def api_chart_data(
    variable: str,
    chart_kind: str = "time_series",
    days: str = "30", # Thay đổi kiểu sang str để có thể nhận 'all'
    bins: int = 20,
    resample_freq: Optional[str] = None, # THAM SỐ MỚI
):
    """
    API chính cho FE lấy dữ liệu vẽ chart.

    - variable: 'temperature' | 'relative_humidity' | 'precipitation'
    - chart_kind:
        + 'time_series'          -> line/scatter theo thời gian (trong `days` ngày gần nhất, có thể gộp)
        + 'histogram'            -> histogram trong `days` ngày gần nhất
        + 'trend_monthly'        -> trend resample theo tháng
        + 'seasonality_monthly'  -> seasonal line theo Month (1-12) (trung bình các năm)
        + 'seasonal_yearly_comparison' -> so sánh seasonal line theo Month (1-12) của tất cả các năm
    - days: số ngày gần nhất dùng cho time_series / histogram, hoặc 'all'
    - bins: số bins cho histogram
    - resample_freq: tần suất gộp dữ liệu ('H', 'D', 'W', 'M')
    """
    try:
        # Chuyển đổi days về int nếu không phải 'all'
        days_int = int(days) if days.lower() != "all" else None
        
        result = get_chart_data(
            variable=variable,
            chart_kind=chart_kind,  # type: ignore[arg-type]
            days=days_int,
            bins=bins,
            resample_freq=resample_freq, # TRUYỀN THAM SỐ MỚI
        )
        if result is None:
            return {"status": "error", "message": "No data in database"}

        return {
            "status": "success",
            "variables": VARIABLES,
            "data": result,
        }
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Internal error: {e}"}