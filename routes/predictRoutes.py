from fastapi import APIRouter

from controller import predict_weather_next_day

# Khởi tạo router
router = APIRouter()

# Route: kiểm tra server có chạy không
@router.get("/")
def read_root():
    return {"status": "ok", "service": "Weather data is running."}

# Route: predict theo ngày cụ thể
@router.get("/predict/{day}")
def run_predict(day: str):
    result = predict_weather_next_day(day)
    if result is None or result.empty:
        return {"status": "error", "message": f"No data for {day}"}
    return {"status": "success", "data": result.to_dict(orient="records")}