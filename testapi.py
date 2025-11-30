from flask import Flask
from routes.predRoute import pred_bp

app = Flask(__name__)

app.register_blueprint(pred_bp)

if __name__ == '__main__':
    app.run(debug=True)
