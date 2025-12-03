from fastapi import APIRouter

from ingestion.extract_service import ingest_latest_weather


router = APIRouter()


@router.post("/refresh")
def refresh_weather_data():
    """
    Gọi lại quá trình ingestion từ Open-Meteo và ghi vào MongoDB.
    Dùng cho nút \"Lấy dữ liệu mới nhất\" trên frontend.
    """
    try:
        stats = ingest_latest_weather()
        return {"status": "success", "data": stats}
    except Exception as e:
        return {"status": "error", "message": str(e)}


