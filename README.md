<!-- Set up -->
python -m venv venv

venv\Scripts\activate

<!-- Lib -->
pip install -r requirements.txt

<!-- Run main.py -->

uvicorn main:app --reload

<!-- Open host -->

http://localhost:8000/docs