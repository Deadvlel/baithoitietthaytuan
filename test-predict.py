from pymongo import MongoClient
import pandas as pd
import pickle
from datetime import datetime, timedelta

# Kết nối DB
client = MongoClient("mongodb://localhost:27017")
db = client["weather_db"]
collection = db["new_york_hourly"]

# Load models
with open("./models/cloudcover_model.pkl", "rb") as f:
    model_cloud = pickle.load(f)
with open("./models/temperature_model.pkl", "rb") as f:
    model_temp = pickle.load(f)
with open("./models/precipitation_model.pkl", "rb") as f:
    model_prec = pickle.load(f)

logs_collection = db["prediction_logs"]

# Hàm lấy dữ liệu theo ngày
def fetch_day_df(day_str: str):
    day_start = datetime.strptime(day_str, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1)
    cursor = collection.find({"date": {"$gte": day_start, "$lt": day_end}})
    return pd.DataFrame(list(cursor))

# Hàm predict cho cả ngày hôm sau (không theo giờ)
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

    # Dự đoán cho toàn bộ dữ liệu, sau đó lấy trung bình để ra giá trị của ngày hôm sau
    pred_cloud = model_cloud.predict(X_cloud).mean()
    pred_temp  = model_temp.predict(X_temp).mean()
    pred_prec  = model_prec.predict(X_prec).mean()

    result = {
        "date": next_day,
        "pred_cloudcover": float(pred_cloud),
        "pred_temperature": float(pred_temp),
        "pred_precipitation": float(pred_prec)
    }

    # Lưu log vào DB
    logs_collection.insert_one({
        "selected_date": selected_date,
        "predicted_date": next_day,
        "prediction": result
    })

    return result

# Chạy trực tiếp trên terminal
if __name__ == "__main__":
    day = input("Nhập ngày (YYYY-MM-DD): ").strip()
    result = predict_weather_next_day(day)

    if result is None:
        print(f"❌ Không có dữ liệu cho ngày {day}")
    else:
        print("✅ Dự đoán cho cả ngày mai:")
        for k, v in result.items():
            print(f"{k}: {v}")

