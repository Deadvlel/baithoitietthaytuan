import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import os
import time
from pymongo import MongoClient
from datetime import datetime

IMAGE_OUTPUT_DIR = './models/images'
TIME_COLUMN = 'date'
VARIABLES = ['temperature', 'relative_humidity', 'precipitation']

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "weather_db"
COLLECTION_NAME = "new_york_hourly"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

if not os.path.exists(IMAGE_OUTPUT_DIR):
    os.makedirs(IMAGE_OUTPUT_DIR)

sns.set_style("darkgrid")
plt.rcParams["figure.figsize"] = (12, 6)


def load_data():
    data = list(collection.find({}))
    if not data:
        return None

    df = pd.DataFrame(data)
    df.drop(columns=['_id'], errors='ignore', inplace=True)

    df[TIME_COLUMN] = pd.to_datetime(df[TIME_COLUMN])
    df.set_index(TIME_COLUMN, inplace=True)
    df.sort_index(inplace=True)
    df['Month'] = df.index.month
    return df

"""
======================
PATTERN FUNCTIONS
======================
"""

def task_1_visualize_patterns(df):
    print("Task1 running...")

    for var in VARIABLES:
        for freq in ['W', 'M']:
            data = df[var].resample(freq).mean().dropna()
            if data.empty: continue

            plt.figure()
            plt.plot(data.index, data.values)
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_line_{var}_{freq}.png")
            plt.close()

            plt.figure()
            plt.scatter(data.index, data.values)
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_scatter_{var}_{freq}.png")
            plt.close()

            plt.figure()
            sns.histplot(data, kde=True)
            plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern1_hist_{var}_{freq}.png")
            plt.close()


def task_2_trend_analysis(df):
    print("Task2 running...")

    for var in VARIABLES:
        data = df[var].resample('M').mean().dropna()
        roll = data.rolling(3).mean()

        plt.figure()
        plt.plot(data.index, data.values, linestyle='--')
        plt.plot(roll.index, roll.values)
        plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern2_trend_{var}.png")
        plt.close()


def task_3_seasonal_analysis(df):
    print("Task3 running...")

    for var in VARIABLES:
        seasonal = df.groupby(df.index.month)[var].mean()

        plt.figure()
        plt.plot(seasonal.index, seasonal.values, marker='o')
        plt.savefig(f"{IMAGE_OUTPUT_DIR}/pattern3_seasonality_{var}.png")
        plt.close()


"""
======================
MAIN SERVICE
======================
"""

def generate_charts():
    df = load_data()
    if df is None:
        print("No Data.")
        return

    task_1_visualize_patterns(df)
    task_2_trend_analysis(df)
    task_3_seasonal_analysis(df)

    print("Charts updated!")
