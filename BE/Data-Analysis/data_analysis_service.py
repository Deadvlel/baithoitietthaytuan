import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import time
import os
from datetime import datetime

# --- CẤU HÌNH HỆ THỐNG ---
IMAGE_OUTPUT_DIR = './static/images'  # Thư mục lưu ảnh cho Frontend
CSV_FILE_PATH = 'load.csv'            # File dữ liệu nằm cùng thư mục
SLEEP_TIME = 300                      # Chu kỳ chạy: 300s = 5 phút

# Cấu hình biến phân tích
TIME_COLUMN = 'date'
VARIABLES = ['temperature', 'relative_humidity', 'precipitation']

# Tạo thư mục lưu ảnh nếu chưa có
if not os.path.exists(IMAGE_OUTPUT_DIR):
    os.makedirs(IMAGE_OUTPUT_DIR)

# Thiết lập style chung
sns.set_style("darkgrid")
plt.rcParams["figure.figsize"] = (12, 6)

def load_data():
    """Hàm đọc và tiền xử lý dữ liệu từ load.csv"""
    print("... Đang đọc dữ liệu từ file load.csv ...")
    try:
        df = pd.read_csv(CSV_FILE_PATH)
        
        # Chuyển cột thời gian sang datetime
        df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN])
        
        # Set Index là thời gian
        df.set_index(TIME_COLUMN, inplace=True)
        df.sort_index(inplace=True)
        
        # Tạo cột Month cho bài toán Seasonality
        df['Month'] = df.index.month
        
        return df
    except FileNotFoundError:
        print(f"LỖI: Không tìm thấy file {CSV_FILE_PATH}")
        return None
    except Exception as e:
        print(f"LỖI DATA: {e}")
        return None

# --- PATTERN 1: VẼ DỮ LIỆU THEO THỜI GIAN (LINE, SCATTER, HISTOGRAM) ---
def task_1_visualize_patterns(df):
    print("--- Đang thực hiện Task 1: Basic Patterns ---")
    
    for var in VARIABLES:
        if var not in df.columns or not pd.api.types.is_numeric_dtype(df[var]):
            continue
            
        # Vẽ cho cả 2 khung thời gian: W (Tuần) và M (Tháng)
        for freq in ['W', 'M']:
            suffix = "Tuan" if freq == 'W' else "Thang"
            
            # Resample dữ liệu
            data = df[var].resample(freq).mean().dropna()
            if data.empty: continue

            # 1. Line Chart
            plt.figure()
            plt.plot(data.index, data.values, marker='o', linestyle='-')
            plt.title(f"Line Chart: {var} theo {suffix}")
            plt.xlabel("Thời Gian")
            plt.ylabel(var)
            plt.tight_layout()
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_line_{var}_{freq}.png")
            plt.close()

            # 2. Scatter Plot
            plt.figure()
            plt.scatter(data.index, data.values, alpha=0.6)
            plt.title(f"Scatter Plot: {var} theo {suffix}")
            plt.xlabel("Thời Gian")
            plt.tight_layout()
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_scatter_{var}_{freq}.png")
            plt.close()

            # 3. Histogram
            plt.figure()
            sns.histplot(data, kde=True)
            plt.title(f"Histogram: Phân phối {var} theo {suffix}")
            plt.tight_layout()
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_hist_{var}_{freq}.png")
            plt.close()

# --- PATTERN 2: VẼ TREND (ROLLING MEAN) ---
def task_2_trend_analysis(df):
    print("--- Đang thực hiện Task 2: Trend Analysis ---")
    
    ROLLING_WINDOW = 3
    FREQ = 'M' # Mặc định theo tháng
    
    for var in VARIABLES:
        if var not in df.columns: continue
            
        resampled_mean = df[var].resample(FREQ).mean().dropna()
        
        # Nếu dữ liệu ít quá thì chuyển sang Tuần
        if len(resampled_mean) < ROLLING_WINDOW:
            FREQ_ALT = 'W'
            resampled_mean = df[var].resample(FREQ_ALT).mean().dropna()
            window_size = 4
            freq_name = "Tuan"
        else:
            window_size = ROLLING_WINDOW
            freq_name = "Thang"
            
        # Tính Rolling Mean
        rolling_mean = resampled_mean.rolling(window=window_size, center=True).mean()
        
        plt.figure()
        # Vẽ dữ liệu gốc (mờ)
        plt.plot(resampled_mean.index, resampled_mean.values, label='Trung bình', color='lightblue', linestyle='--')
        # Vẽ Trend (đậm)
        plt.plot(rolling_mean.index, rolling_mean.values, label=f'Trend ({freq_name})', color='darkred', linewidth=2)
        
        plt.title(f"Trend Xu Hướng: {var}")
        plt.legend()
        plt.tight_layout()
        plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern2_trend_{var}.png")
        plt.close()

# --- PATTERN 3: SEASONAL LINE (MÙA VỤ) ---
def task_3_seasonal_analysis(df):
    print("--- Đang thực hiện Task 3: Seasonal Analysis ---")
    
    for var in VARIABLES:
        if var not in df.columns: continue

        # Group by Month
        seasonal_mean = df.groupby('Month')[var].mean()
        
        plt.figure()
        plt.plot(seasonal_mean.index, seasonal_mean.values, marker='o', color='darkgreen', linewidth=2)
        plt.title(f"Seasonal (Mùa vụ): {var} theo Tháng")
        plt.xlabel("Tháng (1-12)")
        plt.xticks(seasonal_mean.index) # Hiện đủ số từ 1-12
        plt.grid(True)
        plt.tight_layout()
        plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern3_seasonality_{var}.png")
        plt.close()

# --- MAIN LOOP (SERVICE THÔNG MINH) ---
def run_service():
    print("=== DATA ANALYSIS SERVICE STARTED ===")
    print(f"Lưu ý: Ảnh sẽ được lưu vào {IMAGE_OUTPUT_DIR}")
    print("Mẹo: Tạo file 'run_now.txt' trong cùng thư mục để kích hoạt chạy ngay lập tức.")
    
    TRIGGER_FILE = 'run_now.txt' # Tên file dùng làm nút bấm
    last_run_time = 0            # Thời điểm chạy lần cuối
    
    while True:
        current_time = time.time()
        
        # Điều kiện 1: Đã quá 5 phút (300 giây) chưa chạy
        is_time_up = (current_time - last_run_time) >= SLEEP_TIME
        
        # Điều kiện 2: Có ai đó "bấm nút" (tồn tại file run_now.txt)
        is_triggered = os.path.exists(TRIGGER_FILE)
        
        if is_time_up or is_triggered:
            if is_triggered:
                print("\n[EVENT] >> Phát hiện yêu cầu chạy ngay lập tức (Nút bấm)!")
                # Xóa file trigger để không bị chạy lặp lại
                try:
                    os.remove(TRIGGER_FILE)
                except:
                    pass
            else:
                print(f"\n[AUTO] >> Đã đến giờ chạy định kỳ ({SLEEP_TIME}s)...")

            # --- THỰC THI PHÂN TÍCH ---
            try:
                start_ts = datetime.now()
                print(f"[{start_ts.strftime('%H:%M:%S')}] Bắt đầu phân tích...")
                
                df = load_data()
                if df is not None:
                    # Chỉ còn chạy Task 1, 2, 3
                    task_1_visualize_patterns(df)
                    task_2_trend_analysis(df)
                    task_3_seasonal_analysis(df)
                    print("-> Đã hoàn thành và lưu ảnh.")
                
                # Cập nhật thời gian chạy cuối cùng
                last_run_time = time.time()
                
            except Exception as e:
                print(f"LỖI TRONG QUÁ TRÌNH CHẠY: {e}")
            
            print(f"--- Đang chờ lượt tiếp theo (hoặc chờ file {TRIGGER_FILE})... ---")
            
        # Thay vì ngủ 300s, ta chỉ ngủ 1s rồi dậy kiểm tra tiếp
        time.sleep(1)

if __name__ == "__main__":
    run_service()