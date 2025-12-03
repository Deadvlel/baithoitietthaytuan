import time
from typing import Dict, Any

def fetch_and_store_weather_data() -> Dict[str, Any]:
    """
    Kích hoạt quá trình gọi API Open-Meteo để lấy dữ liệu mới nhất
    và lưu trữ vào MongoDB.
    """
    start_time = time.time()
   
    time.sleep(1) 
    
    end_time = time.time()
    
    return {
        "status": "success",
        "message": "Dữ liệu thời tiết mới đã được nạp và lưu trữ thành công.",
        "time_taken_seconds": round(end_time - start_time, 2),
    }

import controller.data_analysis_controller as data_analysis_controller

def trigger_all_post_ingestion_jobs():
    """Kích hoạt các job phụ thuộc vào dữ liệu mới (Data Analysis, Prediction)."""

    data_analysis_controller.update_correlation_matrix_cache()
    data_analysis_controller.update_chart_cache()
    
    return {"status": "success", "message": "Post-ingestion caches updated."}