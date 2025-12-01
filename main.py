from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from routes import predict

db = predict.db

app = FastAPI()

# Include routes
app.include_router(predict.router)

# Background job chạy mỗi 5 phút
def scheduled_job():
    today_str = datetime.now().strftime("%Y-%m-%d")
    result = predict.predict_weather_next_day(today_str)
    if result is not None and not result.empty:
        db["predictions_log"].insert_many(result.to_dict(orient="records"))
        print(f"[{datetime.now()}] Auto predict saved for {today_str}")


# Khởi động scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_job, "interval", seconds=10)
scheduler.start()
