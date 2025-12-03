from fastapi import APIRouter

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
    days: int = 30,
    bins: int = 20,
):
    """
    API chính cho FE lấy dữ liệu vẽ chart.

    - variable: 'temperature' | 'relative_humidity' | 'precipitation'
    - chart_kind:
        + 'time_series'          -> line/scatter theo thời gian (trong `days` ngày gần nhất)
        + 'histogram'            -> histogram trong `days` ngày gần nhất
        + 'trend_monthly'        -> trend resample theo tháng
        + 'seasonality_monthly'  -> seasonal line theo Month (1-12)
    - days: số ngày gần nhất dùng cho time_series / histogram
    - bins: số bins cho histogram
    """
    try:
        result = get_chart_data(
            variable=variable,
            chart_kind=chart_kind,  # type: ignore[arg-type]
            days=days,
            bins=bins,
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

