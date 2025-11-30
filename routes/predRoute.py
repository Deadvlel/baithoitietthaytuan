from flask import Blueprint, jsonify
import import_ipynb
import os

pred_bp = Blueprint('pred_bp', __name__)

original_dir = os.getcwd()
notebook_dir = os.path.join(original_dir, "prediction")
os.chdir(notebook_dir)

from prediction import prediction

os.chdir(original_dir)

@pred_bp.route('/predict', methods=['GET'])
def predict_weather():
    try:
        result_df = prediction.predict_tomorrow()
        return jsonify(result_df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
