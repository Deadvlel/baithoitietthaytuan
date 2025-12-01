from fastapi import APIRouter
from pymongo import MongoClient
import pandas as pd
import pickle
from datetime import datetime, timedelta

# Kết nối DB
client = MongoClient("mongodb://localhost:27017")
db = client["weather_db"]
collection = db["new_york_hourly"]

__all__ = ["db", "collection", "predict_weather_next_day", "router"]

# Load models
with open("models/cloudcover_model.pkl", "rb") as f:
    model_cloud = pickle.load(f)
with open("models/temperature_model.pkl", "rb") as f:
    model_temp = pickle.load(f)
with open("models/precipitation_model.pkl", "rb") as f:
    model_prec = pickle.load(f)

# Khởi tạo router
router = APIRouter()

# Hàm lấy dữ liệu theo ngày
def fetch_day_df(day_str: str):
    day_start = datetime.strptime(day_str, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    cursor = collection.find({"date": {"$gte": day_start, "$lt": day_end}})
    return pd.DataFrame(list(cursor))

# Hàm predict cho ngày hôm sau
def predict_weather_next_day(selected_date: str):
    next_day = (datetime.strptime(selected_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    df_input = fetch_day_df(selected_date)
    if df_input.empty:
        return None

    # Chuẩn bị dữ liệu đầu vào
    X_base = df_input.drop(columns=["_id", "date"], errors="ignore")
    X_cloud = X_base.drop(columns=["cloudcover", "cloudcover_next", "temperature_next", "precipitation_next"], errors="ignore")
    X_temp  = X_base.drop(columns=["temperature", "temperature_next", "cloudcover_next", "precipitation_next"], errors="ignore")
    X_prec  = X_base.drop(columns=["precipitation", "precipitation_next", "cloudcover_next", "temperature_next"], errors="ignore")

    # Dự đoán
    # Lấy giờ từ dữ liệu gốc
    hours = df_input["date"].dt.strftime("%H:%M:%S")

    df_result = pd.DataFrame({
    "datetime": [next_day + " " + h for h in hours],  # ghép ngày hôm sau + giờ gốc
    "pred_cloudcover": model_cloud.predict(X_cloud),
    "pred_temperature": model_temp.predict(X_temp),
    "pred_precipitation": model_prec.predict(X_prec)
    })

    return df_result

# Route: predict theo ngày cụ thể
@router.get("/predict/{day}")
def run_predict(day: str):
    result = predict_weather_next_day(day)
    if result is None or result.empty:
        return {"status": "error", "message": f"No data for {day}"}
    return {"status": "success", "data": result.to_dict(orient="records")}

# Route: predict latest (ngày hôm nay → ngày mai)
@router.get("/predict/latest")
def run_predict_latest():
    today_str = datetime.now().strftime("%Y-%m-%d")
    result = predict_weather_next_day(today_str)
    if result is None or result.empty:
        return {"status": "error", "message": f"No data for {today_str}"}
    return {"status": "success", "data": result.to_dict(orient="records")}
