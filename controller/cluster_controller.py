import numpy as np
from pymongo import MongoClient, DESCENDING

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_CENTROIDS = "weather_centroids"
COLLECTION_LOGS = "prediction_logs" 

class WeatherPredictor:
    def __init__(self):
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = self.client[DB_NAME]
            
            self.collection_model = self.db[COLLECTION_CENTROIDS]
            self.collection_logs = self.db[COLLECTION_LOGS] 

            self.centroids = []
            self.scaler_params = {}
            
            self.client.server_info()
            self.load_model()

    def load_model(self):
        saved_data = list(self.collection_model.find({}))
        if not saved_data:
            raise Exception("DB Empty")
        self.centroids = saved_data
        self.scaler_params = saved_data[0]['scaler_params']

    def predict_logic(self, precipitation, cloudcover, temperature):
        if not self.centroids:
            raise Exception("Model not ready")

        mean_vals = np.array(self.scaler_params['mean'])
        scale_vals = np.array(self.scaler_params['scale'])
        
        input_raw = np.array([precipitation, cloudcover])
        input_scaled = (input_raw - mean_vals) / scale_vals

        min_dist = float('inf')
        nearest_cluster_id = -1
        base_label = "Unknown"

        for centroid in self.centroids:
            centroid_raw = np.array([
                centroid['features_v']['precipitation'],
                centroid['features_v']['cloudcover']
            ])
            centroid_scaled = (centroid_raw - mean_vals) / scale_vals
            dist = np.linalg.norm(input_scaled - centroid_scaled)
            
            if dist < min_dist:
                min_dist = dist
                nearest_cluster_id = centroid['cluster_id']
                base_label = centroid['label']

        final_result = base_label
        note = "AI Decision"
        
        if nearest_cluster_id in [0, 1, 5] and precipitation >= 0.1:
            final_result = "Mưa phùn"
            note = f"Rule Override: Cluster {nearest_cluster_id}"

        if nearest_cluster_id in [0, 4, 5] and precipitation > 0.6 and temperature <= 6.0:
            final_result = "Tuyết rơi"
            note = f"Snow Rule: Cluster {nearest_cluster_id}"

        return {
            "predicted_label": final_result,
            "base_cluster": nearest_cluster_id,
            "inputs": {
                "precipitation": precipitation,
                "cloudcover": cloudcover,
                "temperature": temperature
            },
            "logic_note": note
        }

    def predict_from_latest_log(self):
        latest_log = self.collection_logs.find_one(sort=[("_id", DESCENDING)])
        
        if not latest_log:
            return None
        pred_data = latest_log.get("prediction", {})
        
        cloud = pred_data.get("pred_cloudcover", 0)
        temp = pred_data.get("pred_temperature", 0)
        prec = pred_data.get("pred_precipitation", 0)
        date_for = latest_log.get("predicted_date", "Unknown")

        result = self.predict_logic(
            precipitation=prec,
            cloudcover=cloud,
            temperature=temp
        )
        
        result["date_forecast"] = date_for
        return result
