import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import euclidean_distances
from pymongo import MongoClient
from datetime import datetime

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

REFERENCE_CENTROIDS = np.array([
    [0.0655, 97.14],  
    [0.0012, 5.04],   
    [5.5946, 97.04],  
    [14.0118, 98.82], 
    [1.8594, 97.24],  
    [0.0161, 47.24]   
])

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_HOURLY = "new_york_hourly"
COLLECTION_CENTROIDS = "weather_centroids" 

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
hourly_collection = db[COLLECTION_HOURLY]
centroids_collection = db[COLLECTION_CENTROIDS]

def map_clusters_to_reference(new_centroids, reference_centroids):
    distances = euclidean_distances(new_centroids, reference_centroids)
    mapping = {}
    used_refs = set()
    
    for new_id in range(len(new_centroids)):
        min_dist_idx = None
        min_dist = float('inf')
        
        for ref_id in range(len(reference_centroids)):
            if ref_id not in used_refs and distances[new_id, ref_id] < min_dist:
                min_dist = distances[new_id, ref_id]
                min_dist_idx = ref_id
        
        if min_dist_idx is not None:
            mapping[new_id] = min_dist_idx
            used_refs.add(min_dist_idx)
    
    return mapping

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
    
    cluster_mapping = map_clusters_to_reference(centers_unscaled, REFERENCE_CENTROIDS)
    print(f"Cluster Mapping: {cluster_mapping}")
    
    scaler_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'features': FEATURES
    }
    
    centroids_to_db = []
    for new_id, ref_id in cluster_mapping.items():
        centroid_doc = {
            "cluster_id": ref_id,  
            "label": CLUSTER_LABELS.get(ref_id, "UNKNOWN"), 
            "features_v": {
                FEATURES[0]: float(centers_unscaled[new_id][0]),
                FEATURES[1]: float(centers_unscaled[new_id][1])
            }, 
            "k_value": BEST_K,
            "scaler_params": scaler_params,
            "status": "Active",
            "date_generated": datetime.now().isoformat(),
            "original_cluster_id": new_id  
        }
    centroids_to_db.append(centroid_doc)
    
    centroids_to_db.sort(key=lambda x: x['cluster_id'])
    
    centroids_collection.delete_many({}) 
    centroids_collection.insert_many(centroids_to_db)