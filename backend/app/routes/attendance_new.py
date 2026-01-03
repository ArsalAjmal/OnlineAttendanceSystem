from fastapi import APIRouter, HTTPException, status, UploadFile, File
from datetime import datetime, time, timedelta, timezone
from app.database import get_database
from app.services.face_recognition import face_recognition_service

router = APIRouter(prefix="/attendance", tags=["Attendance"])

PKT = timezone(timedelta(hours=5))

def determine_status(check_in_time: datetime) -> tuple:
    work_start = time(9, 0)
    work_end = time(17, 0)
    check_time = check_in_time.time()
    
    if check_time <= work_start:
        return "on-time", "On Time - Welcome!"
    elif work_start < check_time < work_end:
        time_diff = datetime.combine(datetime.today(), check_time) - datetime.combine(datetime.today(), work_start)
        hours_late = time_diff.seconds / 3600
        
        if hours_late < 1:
            minutes_late = int((hours_late * 60))
            return "late", f"Late Arrival - {minutes_late} minutes late"
        else:
            return "late", f"Late Arrival - {hours_late:.1f} hours late"
    else:
        return "late", "Late Check-in - After working hours"

@router.post("/mark")
async def mark_attendance(image: UploadFile = File(...)):
    db = get_database()
    employees_collection = db.employees
    attendance_collection = db.attendance
    
    image_bytes = await image.read()
    
    matched_employee = None
    best_similarity = 0
    
    async for employee in employees_collection.find():
        if not employee.get("face_embedding"):
            continue
        
        match, similarity = face_recognition_service.verify_face(
            image_bytes, 
            employee["face_embedding"]
        )
        
        if match and similarity > best_similarity:
            best_similarity = similarity
            matched_employee = employee
    
    if not matched_employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Face not recognized. Please contact admin to register."
        )
    
    current_time_pkt = datetime.now(PKT)
    today_start_pkt = current_time_pkt.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end_pkt = today_start_pkt + timedelta(days=1)
    
    today_start_utc = today_start_pkt.astimezone(timezone.utc).replace(tzinfo=None)
    today_end_utc = today_end_pkt.astimezone(timezone.utc).replace(tzinfo=None)
    
    existing_attendance = await attendance_collection.find_one({
        "employee_id": matched_employee["employee_id"],
        "timestamp": {"$gte": today_start_utc, "$lt": today_end_utc}
    })
    
    if existing_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already marked for today"
        )
    
    attendance_status, status_message = determine_status(current_time_pkt)
    
    attendance_doc = {
        "employee_id": matched_employee["employee_id"],
        "timestamp": datetime.now(timezone.utc).replace(tzinfo=None),
        "timestamp_pkt": current_time_pkt.replace(tzinfo=None),
        "status": attendance_status,
        "similarity": best_similarity
    }
    
    await attendance_collection.insert_one(attendance_doc)
    
    return {
        "message": "Attendance marked successfully",
        "employee_id": matched_employee["employee_id"],
        "employee_name": matched_employee["full_name"],
        "timestamp": current_time_pkt.replace(tzinfo=None),
        "status": attendance_status,
        "status_message": status_message,
        "similarity": round(best_similarity, 2)
    }
