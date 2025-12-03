from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import time

from routes.predict_routes import router as predict_router
from routes.data_analysis_routes import router as data_analysis_router
from routes.cluster_routes import router as cluster_router
from routes.ingestion_router import router as ingestion_router

import controller.predict_controller as predict_controller
from controller.clustering_services_controller import update_weather_centroids
import controller.data_analysis_controller as data_analysis_controller

def scheduled_job():
    """Hàm này sẽ chạy dự đoán thời tiết (5 phút/lần)"""
    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"[{datetime.now()}] Đang chạy job dự đoán cho ngày: {today_str}...")
    
    try:
        result = predict_controller.predict_weather_next_day(today_str)
        if result is not None:
            print(f"[{datetime.now()}] -> Đã lưu dự đoán thành công.")
        else:
            print(f"[{datetime.now()}] -> Không có dữ liệu để dự đoán.")
    except Exception as e:
        print(f"[{datetime.now()}] -> Lỗi khi chạy job dự đoán: {e}")

def cluster_job():
    print(f"[{datetime.now()}] Đang chạy job cập nhật Cluster...")
    try:
        update_weather_centroids() 
        print(f"[{datetime.now()}] -> Cập nhật Cluster thành công.")
    except Exception as e:
        print(f"[{datetime.now()}] -> Lỗi update cluster: {e}")

def analysis_job():
    """Job tính toán lại Data Analysis, bao gồm Correlation Matrix và các Chart toàn bộ dữ liệu."""
    print(f"[{datetime.now()}] Đang chạy job cập nhật Data Analysis (Correlation Matrix & Charts)...")
    try:
        data_analysis_controller.update_correlation_matrix_cache() 
        data_analysis_controller.update_chart_cache() 
        
        print(f"[{datetime.now()}] -> Cập nhật Data Analysis hoàn tất.")
    except Exception as e:
        print(f"[{datetime.now()}] -> Lỗi update Data Analysis: {e}")
        

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Server đang khởi động: Chạy job lần đầu tiên ---")
    
    scheduled_job()
    cluster_job()
    analysis_job() 
    
    scheduler = BackgroundScheduler()
    
    scheduler.add_job(scheduled_job, "interval", minutes=5, id='predict_job')
    scheduler.add_job(analysis_job, "interval", minutes=5, id='analysis_job')

    scheduler.add_job(
        cluster_job, 
        "cron", 
        hour=2, 
        minute=0, 
        id='cluster_update_job'
    ) 
    
    scheduler.start()
    print("--- Scheduler đã bắt đầu: Dự đoán/Analysis (5 phút/lần), Cluster (2:00 sáng/ngày) ---")
    
    yield 
    

    print("--- Server đang tắt: Dọn dẹp Scheduler ---")
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)


app.mount("/static", StaticFiles(directory="frontend"), name="static")


app.include_router(predict_router, prefix="/predict", tags=["Predict"])
app.include_router(data_analysis_router, prefix="/analysis", tags=["Analysis"])
app.include_router(cluster_router, prefix="/cluster", tags=["Weather AI"])
app.include_router(ingestion_router, prefix="/ingestion", tags=["Ingestion"])


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():

    return RedirectResponse(url="/ui")

@app.get("/ui")
def serve_frontend():
    """
    Trả về file HTML frontend chính.
    """
    return FileResponse("frontend/index.html")