import openmeteo_requests
import pandas as pd
import requests
from retry_requests import retry
from pymongo import MongoClient
from datetime import datetime
from typing import Dict, Any


MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_NAME = "new_york_hourly"


def ingest_latest_weather(start_date: str = "2024-01-01") -> Dict[str, Any]:
    """
    Gọi Open-Meteo archive API để lấy dữ liệu thời tiết từ start_date đến hôm nay
    và ghi vào MongoDB (collection new_york_hourly).

    Trả về thống kê đơn giản cho FE/route hiển thị.
    """
    today_str = datetime.now().strftime("%Y-%m-%d")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # Chuẩn bị client có retry
    retry_session = retry(requests.Session(), retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": 40.7143,
        "longitude": -74.006,
        "start_date": start_date,
        "end_date": today_str,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "dew_point_2m",
            "apparent_temperature",
            "surface_pressure",
            "wind_speed_10m",
            "precipitation",
            "cloudcover",
            "weather_code",
        ],
        "timezone": "America/New_York",
    }

    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]

    hourly = response.Hourly()
    hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
    hourly_relative_humidity_2m = hourly.Variables(1).ValuesAsNumpy()
    hourly_dew_point_2m = hourly.Variables(2).ValuesAsNumpy()
    hourly_apparent_temperature = hourly.Variables(3).ValuesAsNumpy()
    hourly_surface_pressure = hourly.Variables(4).ValuesAsNumpy()
    hourly_wind_speed_10m = hourly.Variables(5).ValuesAsNumpy()
    hourly_precipitation = hourly.Variables(6).ValuesAsNumpy()
    hourly_cloud_cover = hourly.Variables(7).ValuesAsNumpy()
    hourly_weather_code = hourly.Variables(8).ValuesAsNumpy()

    data = {
        "date": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left",
        )
    }

    data["temperature"] = hourly_temperature_2m
    data["relative_humidity"] = hourly_relative_humidity_2m
    data["dew_point"] = hourly_dew_point_2m
    data["apparent_temperature"] = hourly_apparent_temperature
    data["surface_pressure"] = hourly_surface_pressure
    data["wind_speed"] = hourly_wind_speed_10m
    data["precipitation"] = hourly_precipitation
    data["cloudcover"] = hourly_cloud_cover
    data["weather_code"] = hourly_weather_code

    df = pd.DataFrame(data=data)
    df = df.round(
        {
            "temperature": 4,
            "relative_humidity": 4,
            "dew_point": 4,
            "apparent_temperature": 4,
            "surface_pressure": 4,
            "wind_speed": 4,
        }
    )

    # Xóa dữ liệu cũ và ghi mới toàn bộ (giống notebook gốc)
    deleted = collection.delete_many({}).deleted_count
    records = df.to_dict(orient="records")
    inserted = 0
    if records:
        result = collection.insert_many(records)
        inserted = len(result.inserted_ids)

    return {
        "start_date": start_date,
        "end_date": today_str,
        "rows": len(df),
        "deleted_old_rows": int(deleted),
        "inserted_rows": int(inserted),
    }

