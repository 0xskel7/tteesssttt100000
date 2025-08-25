from flask import Flask, request, jsonify, render_template
from predict import predict
import os, base64
from PIL import Image
from io import BytesIO

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
TEMP_FILE_NAME = 'temp_upload.jpg'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/result')
def result_page():
    prediction = request.args.get("prediction", "❌ لا توجد نتيجة")
    return render_template('result.html', prediction=prediction)

@app.route('/camera-predict', methods=['POST'])
def camera_predict():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"error": "No image data"}), 400

        image_data = data['image'].split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))

        file_path = os.path.join(UPLOAD_FOLDER, TEMP_FILE_NAME)
        image.save(file_path)

        result = predict(file_path)

        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({"prediction": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
