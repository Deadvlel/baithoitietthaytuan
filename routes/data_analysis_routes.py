from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

from controller.data_analysis_controller import generate_charts, IMAGE_OUTPUT_DIR

router = APIRouter()

# Lấy ảnh theo tên file
@router.get("/image/{filename}")
def get_image(filename: str):
    path = os.path.join(IMAGE_OUTPUT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "Image not found"}

# Route trigger manual refresh
@router.post("/refresh")
def refresh_charts():
    generate_charts()
    return {"status": "ok", "message": "Charts updated manually"}
