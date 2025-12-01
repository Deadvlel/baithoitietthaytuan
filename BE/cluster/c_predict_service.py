import numpy as np
from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_CENTROIDS = "weather_centroids"

class WeatherPredictor:
    def __init__(self):
        self.client = MongoClient(MONGO_URI)
        self.db = self.client[DB_NAME]
        self.collection = self.db[COLLECTION_CENTROIDS]
        self.centroids = []
        self.scaler_params = {}
        self.load_model()

    def load_model(self):
        saved_data = list(self.collection.find({}))
        if not saved_data:
            raise Exception("DB Empty")
        self.centroids = saved_data
        self.scaler_params = saved_data[0]['scaler_params']

    def predict(self, precipitation, cloudcover, temperature):
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
        
        if nearest_cluster_id == 0 and precipitation >= 0.1:
            final_result = "Mưa phùn"
            note = "Rule Override: Precip > 0.1 in Overcast"

        if precipitation > 0 and temperature <= 1.0:
            final_result = "Tuyết rơi"
            note = f"Rule Override: Snow logic (Temp {temperature}°C)"

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

if __name__ == "__main__":
    predictor = WeatherPredictor()

    print("\n--- Test 1: Âm u (Mây 98%, Mưa 0) ---")
    print("Result:", predictor.predict(precipitation=0.0, cloudcover=98, temperature=15)['predicted_label'])

    print("\n--- Test 2: Mưa phùn (Mây 95%, Mưa 0.15) ---")
    print("Result:", predictor.predict(precipitation=0.15, cloudcover=95, temperature=15)['predicted_label'])

    print("\n--- Test 3: Tuyết rơi (Lạnh -2 độ) ---")
    print("Result:", predictor.predict(precipitation=2.5, cloudcover=100, temperature=-2)['predicted_label'])