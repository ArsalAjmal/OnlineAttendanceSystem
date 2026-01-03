from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from app.config import settings
import certifi

client = None
database = None

def get_database():
    global client, database
    if client is None:
        client = AsyncIOMotorClient(settings.MONGODB_URL, tlsCAFile=certifi.where())
        database = client[settings.DATABASE_NAME]
    return database

def close_database():
    global client
    if client:
        client.close()

def get_sync_database():
    sync_client = MongoClient(settings.MONGODB_URL, tlsCAFile=certifi.where())
    return sync_client[settings.DATABASE_NAME]

def get_employees_collection():
    db = get_database()
    return db.employees

def get_attendance_collection():
    db = get_database()
    return db.attendance

def init_db():
    db = get_sync_database()
    db.employees.create_index("employee_id", unique=True)
    db.employees.create_index("email", unique=True)
    db.attendance.create_index([("employee_id", 1), ("timestamp", -1)])
    print("Database initialized successfully!")
