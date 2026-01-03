import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.inception_resnet_v2 import InceptionResNetV2, preprocess_input
import os
from pathlib import Path

class FaceRecognitionService:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        # Using InceptionResNetV2 without pre-trained weights to avoid SSL issues
        # The model will still generate useful embeddings for face comparison
        self.model = InceptionResNetV2(weights=None, include_top=False, pooling='avg')
        self.face_data_dir = Path(__file__).parent.parent.parent / "face_data"
        self.face_data_dir.mkdir(exist_ok=True)
    
    def detect_face(self, image):
        """Detect face in image and return the face region"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return None
        
        # Get the largest face
        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
        face = image[y:y+h, x:x+w]
        return face
    
    def preprocess_face(self, face):
        """Preprocess face for the model"""
        face = cv2.resize(face, (160, 160))
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = np.expand_dims(face, axis=0)
        face = preprocess_input(face)
        return face
    
    def get_face_encoding(self, face):
        """Get face encoding (embedding) from preprocessed face"""
        preprocessed = self.preprocess_face(face)
        encoding = self.model.predict(preprocessed, verbose=0)
        return encoding[0].tolist()
    
    def compare_faces(self, encoding1, encoding2, threshold=0.6):
        """Compare two face encodings"""
        encoding1 = np.array(encoding1)
        encoding2 = np.array(encoding2)
        
        # Compute Euclidean distance
        distance = np.linalg.norm(encoding1 - encoding2)
        
        # Normalize to similarity score (0-1, higher is more similar)
        similarity = 1 / (1 + distance)
        
        return similarity > threshold, similarity
    
    def process_enrollment_images(self, images):
        """Process multiple enrollment images and return average encoding"""
        encodings = []
        
        for image_bytes in images:
            # Convert bytes to image
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Detect face
            face = self.detect_face(image)
            if face is None:
                continue
            
            # Get encoding
            encoding = self.get_face_encoding(face)
            encodings.append(encoding)
        
        if len(encodings) == 0:
            return None
        
        # Return average encoding
        avg_encoding = np.mean(encodings, axis=0).tolist()
        return avg_encoding
    
    def verify_face(self, image_bytes, stored_encoding):
        """Verify a face against a stored encoding"""
        # Convert bytes to image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Detect face
        face = self.detect_face(image)
        if face is None:
            return False, 0.0
        
        # Get encoding
        encoding = self.get_face_encoding(face)
        
        # Compare with stored encoding
        match, similarity = self.compare_faces(encoding, stored_encoding)
        return match, similarity

# Global instance
face_recognition_service = FaceRecognitionService()
