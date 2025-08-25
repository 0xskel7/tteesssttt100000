import tensorflow as tf
from tensorflow.keras.preprocessing import image
import numpy as np
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "my_model.keras")

# تحميل النموذج (تأكد من رفع my_model.keras)
model = tf.keras.models.load_model(MODEL_PATH)

def predict(img_path):
    img = image.load_img(img_path, target_size=(224, 224))
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0
    preds = model.predict(x)
    return "Malignant" if preds[0] > 0.5 else "Benign"
