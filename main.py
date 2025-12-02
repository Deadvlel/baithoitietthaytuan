from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from threading import Thread
import time

# Import routes
from routes.predict_routes import router as predict_router
from routes.data_analysis_routes import router as data_analysis_router
from routes.cluster_routes import router as cluster_router

# Import controllers
import controller.predict_controller as predict_controller
from controller.data_analysis_controller import generate_charts

app = FastAPI()

# Include routes
app.include_router(predict_router, prefix="/predict", tags=["Predict"])
app.include_router(data_analysis_router, prefix="/analysis", tags=["Analysis"])
app.include_router(cluster_router, prefix="/cluster", tags=["Weather AI"])

@app.get("/")
def root():
    return {"message": "Welcome to Weather AI API"}

# Predict
# Background job chạy mỗi 5 phút
def scheduled_job():
    today_str = datetime.now().strftime("%Y-%m-%d")
    result = predict_controller.predict_weather_next_day(today_str)
    if result is not None and not result.empty:
        predict_controller.db["predictions_log"].insert_many(result.to_dict(orient="records"))
        print(f"[{datetime.now()}] Auto predict saved for {today_str}")


# Khởi động scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_job, "interval", minutes=5)
scheduler.start()

# Data Analysis
def background():
    while True:
        generate_charts()
        time.sleep(300)

@app.on_event("startup")
def start_bg_job():
    thread = Thread(target=background, daemon=True)
    thread.start()

# Clus
# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
