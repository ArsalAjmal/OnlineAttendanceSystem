from fastapi import APIRouter, HTTPException, status, UploadFile, File
from typing import List
from datetime import datetime, timedelta, timezone
from app.database import get_database
from app.services.face_recognition import face_recognition_service
from bson import ObjectId
import json

router = APIRouter(prefix="/admin", tags=["Admin"])

PKT = timezone(timedelta(hours=5))

@router.post("/register-employee")
async def register_employee(
    employee_data: str = File(...),
    images: List[UploadFile] = File(...)
):
    if len(images) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload at least 3 face images"
        )
    
    try:
        emp_data = json.loads(employee_data)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee data format"
        )
    
    db = get_database()
    employees_collection = db.employees
    
    existing = await employees_collection.find_one({"employee_id": emp_data["employee_id"]})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID already exists"
        )
    
    image_bytes_list = []
    for image in images:
        image_bytes = await image.read()
        image_bytes_list.append(image_bytes)
    
    # Process images and get face embedding
    embedding = face_recognition_service.process_enrollment_images(image_bytes_list)
    
    if embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the images"
        )
    
    employee_doc = {
        "employee_id": emp_data["employee_id"],
        "full_name": emp_data["full_name"],
        "email": emp_data["email"],
        "department": emp_data.get("department"),
        "position": emp_data.get("position"),
        "face_embedding": embedding,
        "created_at": datetime.now(PKT).replace(tzinfo=None)
    }
    
    await employees_collection.insert_one(employee_doc)
    
    return {"message": "Employee registered successfully"}

@router.get("/employees")
async def get_all_employees():
    db = get_database()
    employees_collection = db.employees
    
    employees = []
    async for emp in employees_collection.find():
        employees.append({
            "_id": str(emp["_id"]),
            "employee_id": emp["employee_id"],
            "full_name": emp["full_name"],
            "email": emp["email"],
            "department": emp.get("department"),
            "position": emp.get("position"),
            "created_at": emp.get("created_at")
        })
    
    return employees

@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    db = get_database()
    employees_collection = db.employees
    attendance_collection = db.attendance
    
    result = await employees_collection.delete_one({"employee_id": employee_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    await attendance_collection.delete_many({"employee_id": employee_id})
    
    return {"message": "Employee and associated attendance records deleted successfully"}

@router.get("/attendance")
async def get_all_attendance(date: str = None):
    db = get_database()
    attendance_collection = db.attendance
    employees_collection = db.employees
    
    query = {}
    
    if date:
        try:
            target_date = datetime.fromisoformat(date)
            start_date = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(days=1)
            query["timestamp"] = {"$gte": start_date, "$lt": end_date}
        except:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
    
    attendance_records = []
    async for record in attendance_collection.find(query).sort("timestamp", -1):
        # Get employee info
        employee = await employees_collection.find_one({"employee_id": record["employee_id"]})
        
        attendance_records.append({
            "employee_id": record["employee_id"],
            "employee_name": employee["full_name"] if employee else "Unknown",
            "timestamp": record["timestamp"],
            "status": record["status"]
        })
    
    return attendance_records

@router.get("/employee-status/{employee_id}")
async def get_employee_status(employee_id: str):
    db = get_database()
    attendance_collection = db.attendance
    employees_collection = db.employees
    
    employee = await employees_collection.find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    records = []
    async for record in attendance_collection.find({"employee_id": employee_id}).sort("timestamp", -1):
        records.append(record)
    
    total_days = len(records)
    on_time_count = sum(1 for r in records if r["status"] == "on-time")
    late_count = sum(1 for r in records if r["status"] == "late")
    early_leave_count = sum(1 for r in records if r["status"] == "early-leave")
    present_count = on_time_count + late_count + early_leave_count
    
    registration_date = employee.get("created_at", datetime.utcnow()).replace(hour=0, minute=0, second=0, microsecond=0)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    working_days = 0
    current_date = registration_date
    while current_date <= today:
        if current_date.weekday() < 5:
            working_days += 1
        current_date += timedelta(days=1)
    
    if total_days > 0 and working_days == 0:
        working_days = 1
    
    absent_count = max(0, working_days - total_days)
    attendance_rate = (present_count / working_days * 100) if working_days > 0 else 0
    
    recent_records = [
        {
            "timestamp": r["timestamp"],
            "status": r["status"]
        }
        for r in records[:10]
    ]
    
    return {
        "employee_id": employee_id,
        "employee_name": employee["full_name"],
        "total_days": total_days,
        "present_count": present_count,
        "late_count": late_count,
        "early_leave_count": early_leave_count,
        "absent_count": absent_count,
        "attendance_rate": round(attendance_rate, 2),
        "recent_records": recent_records
    }
