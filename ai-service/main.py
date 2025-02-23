from flask import Flask, request, jsonify
import cv2
import numpy as np
import imagehash
from PIL import Image
import json
import os

app = Flask(__name__)

# Load stored image hashes (temporary storage, later move to DB)
HASH_STORE = "stored_hashes.json"
if os.path.exists(HASH_STORE):
    with open(HASH_STORE, "r") as f:
        stored_hashes = json.load(f)
else:
    stored_hashes = {}

# Function to compute perceptual hash
def compute_phash(image):
    img = Image.fromarray(image)
    phash = imagehash.phash(img)  # Perceptual hash
    return str(phash)

@app.route('/check_duplicate', methods=['POST'])
def check_duplicate():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        # Read image from request
        file = request.files['image'].read()
        np_img = np.frombuffer(file, np.uint8)
        image = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        # Compute hash
        img_hash = compute_phash(image)

        # Check if hash already exists
        for stored_hash in stored_hashes.values():
            if img_hash == stored_hash:
                return jsonify({"duplicate": True, "hash": img_hash})

        # If unique, store it
        image_id = str(len(stored_hashes) + 1)
        stored_hashes[image_id] = img_hash

        # Save to file
        with open(HASH_STORE, "w") as f:
            json.dump(stored_hashes, f)

        return jsonify({"duplicate": False, "hash": img_hash})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=True)
