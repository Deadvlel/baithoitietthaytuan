from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI()

# Mount thư mục static cho frontend (CSS/JS)
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Include routes
app.include_router(predict_router, prefix="/predict", tags=["Predict"])
app.include_router(data_analysis_router, prefix="/analysis", tags=["Analysis"])
app.include_router(cluster_router, prefix="/cluster", tags=["Weather AI"])

@app.get("/")
def root():
    # Redirect sang trang giao diện frontend
    return RedirectResponse(url="/ui")


@app.get("/ui")
def serve_frontend():
    """
    Trả về file HTML frontend chính.
    """
    return FileResponse("frontend/index.html")

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

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
