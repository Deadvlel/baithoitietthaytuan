from fastapi import APIRouter

from controller.predict_controller import predict_weather_next_day

# Khởi tạo router
router = APIRouter()

# Route: predict theo ngày cụ thể
@router.get("/predict/{day}")
def run_predict(day: str):
    try:
        result = predict_weather_next_day(day)
        if result is None:
            return {"status": "error", "message": f"No data for {day}"}
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}
