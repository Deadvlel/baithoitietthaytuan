import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from pymongo import MongoClient
from datetime import datetime
import time 
from apscheduler.schedulers.background import BackgroundScheduler 


BEST_K = 6
FEATURES = ['precipitation', 'cloudcover']

CLUSTER_LABELS = { 
    0: 'Âm u', 
    1: 'Quang đãng (1)',
    2: 'Mưa vừa', 
    3: 'Mưa lớn', 
    4: 'Mưa nhẹ', 
    5: 'Quang đãng (2)' 
}

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_HOURLY = "new_york_hourly"
COLLECTION_CENTROIDS = "weather_centroids" 

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
hourly_collection = db[COLLECTION_HOURLY]
centroids_collection = db[COLLECTION_CENTROIDS]

def update_weather_centroids():
    cursor = hourly_collection.find({}, {"_id": 0, FEATURES[0]: 1, FEATURES[1]: 1})
    df = pd.DataFrame(list(cursor))
    
    if df.empty:
        print("Lỗi: Không có dữ liệu")
        return 

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[FEATURES])
    kmeans = KMeans(n_clusters=BEST_K, random_state=42, n_init='auto').fit(X_scaled)
    
    centers_unscaled = scaler.inverse_transform(kmeans.cluster_centers_)
    
    scaler_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'features': FEATURES
    }
    
    centroids_to_db = []
    for i, center in enumerate(centers_unscaled):
        centroid_doc = {
            "cluster_id": i,
            "label": CLUSTER_LABELS.get(i, "UNKNOWN"), 
            "features_v": {f: float(v) for f, v in zip(FEATURES, center)}, 
            "k_value": BEST_K,
            "scaler_params": scaler_params,
            "status": "Active",
            "date_generated": datetime.now().isoformat()
        }
        centroids_to_db.append(centroid_doc)
    
    centroids_collection.delete_many({}) 
    centroids_collection.insert_many(centroids_to_db)
    
if __name__ == '__main__':
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        update_weather_centroids, 
        trigger='cron', 
        hour=13, 
        minute=57, 
        id='daily_clustering_job'
    )
    
    print("chay")
    
    update_weather_centroids() 

    scheduler.start()

    try:
        while True:
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()