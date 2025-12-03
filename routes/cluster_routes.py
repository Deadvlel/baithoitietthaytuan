from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from controller.cluster_controller import WeatherPredictor
from controller.clustering_services_controller import update_weather_centroids

router = APIRouter()

predictor = WeatherPredictor()

class WeatherInput(BaseModel):
    precipitation: float
    cloudcover: float
    temperature: float

# API 1: Nhập tay (Dành cho test hoặc nhập số liệu tùy chỉnh)
@router.post("/cluster/manual")
def predict_manual(data: WeatherInput):
    try:
        result = predictor.predict_logic(
            precipitation=data.precipitation,
            cloudcover=data.cloudcover,
            temperature=data.temperature
        )
        return {"status": "success", "mode": "manual", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# API 2: Tự động (Frontend chỉ cần gọi cái này là xong)
@router.get("/cluster/auto-latest")
def predict_auto():
    try:
        result = predictor.predict_from_latest_log()
        
        if not result:
            return {
                "status": "error", 
                "message": "Chưa có dữ liệu dự báo nào trong DB (Hãy chạy Code 1 trước)"
            }
            
        return {"status": "success", "mode": "auto_db", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/cluster/update")
def update_centroids():
    try:
        update_weather_centroids()
        return {"status": "success", "message": "Weather centroids updated in DB"}
    except Exception as e:
        return {"status": "error", "message": str(e)}