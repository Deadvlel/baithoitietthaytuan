from fastapi import APIRouter
from controller.ingestion_controller import fetch_and_store_weather_data, trigger_all_post_ingestion_jobs

router = APIRouter()

@router.post("/refresh")
def api_refresh_data():
    """
    API để nạp (ingest) dữ liệu thời tiết mới nhất ngay lập tức 
    và kích hoạt cập nhật cache Data Analysis.
    """
    try:
        # 1. Nạp dữ liệu mới
        ingestion_result = fetch_and_store_weather_data()
        
        # 2. Cập nhật cache Data Analysis
        trigger_all_post_ingestion_jobs()

        return {"status": "success", "data": ingestion_result}
    
    except Exception as e:
        return {"status": "error", "message": f"Lỗi nạp dữ liệu: {str(e)}"}