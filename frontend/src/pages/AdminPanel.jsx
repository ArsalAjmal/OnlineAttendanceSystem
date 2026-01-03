import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AdminPanel.css';

const API_BASE_URL = 'http://localhost:8000';

function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('register');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [newEmployee, setNewEmployee] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    department: '',
    position: ''
  });
  const [enrollmentImages, setEnrollmentImages] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    } else if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [activeTab, dateFilter]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      console.log('Setting video source');
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    console.log('Starting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      console.log('Stream obtained:', stream);
      
      streamRef.current = stream;
      setIsCameraActive(true);
      console.log('Camera active set to true');
      
    } catch (err) {
      console.error('Error accessing camera:', err);
      setMessage({ 
        type: 'error', 
        text: `Failed to access camera: ${err.message}. Please check browser permissions.` 
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCapturedImages(prev => [...prev, { file, url: URL.createObjectURL(blob) }]);
      setEnrollmentImages(prev => [...prev, file]);
      
      if (capturedImages.length + 1 >= 5) {
        stopCamera();
        setMessage({ type: 'success', text: '5 images captured! Ready to register.' });
      }
    }, 'image/jpeg', 0.9);
  };

  const removeImage = (index) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setEnrollmentImages(prev => prev.filter((_, i) => i !== index));
  };

  const resetCapture = () => {
    setCapturedImages([]);
    setEnrollmentImages([]);
    stopCamera();
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      console.log('Fetching employees...');
      const response = await axios.get(`${API_BASE_URL}/admin/employees`);
      console.log('Employees fetched:', response.data);
      setEmployees(response.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setMessage({ type: 'error', text: 'Failed to load employees' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = dateFilter ? { date: dateFilter } : {};
      const response = await axios.get(`${API_BASE_URL}/admin/attendance`, { params });
      setAttendance(response.data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeStatus = async (employeeId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/employee-status/${employeeId}`);
      setSelectedEmployee(response.data);
    } catch (err) {
      console.error('Failed to fetch employee status:', err);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setEnrollmentImages(files);
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    
    if (enrollmentImages.length < 3) {
      setMessage({ type: 'error', text: 'Please capture at least 3 face images' });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      
      formData.append('employee_data', JSON.stringify(newEmployee));
      
      enrollmentImages.forEach((image, index) => {
        formData.append('images', image);
      });

      await axios.post(`${API_BASE_URL}/admin/register-employee`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage({ type: 'success', text: 'Employee registered successfully!' });
      setNewEmployee({
        employee_id: '',
        full_name: '',
        email: '',
        department: '',
        position: ''
      });
      setEnrollmentImages([]);
      setCapturedImages([]);
      stopCamera();
      
      fetchEmployees();
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'Failed to register employee' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/admin/employees/${employeeId}`);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const exportAttendance = () => {
    const csvContent = [
      ['Date', 'Time', 'Employee ID', 'Employee Name', 'Status'].join(','),
      ...attendance.map(record => [
        new Date(record.timestamp).toLocaleDateString(),
        new Date(record.timestamp).toLocaleTimeString(),
        record.employee_id,
        record.employee_name,
        record.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${dateFilter || 'all'}.csv`;
    a.click();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on-time': return '#10b981';
      case 'late': return '#f59e0b';
      case 'early-leave': return '#ef4444';
      case 'absent': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <button onClick={onClose} className="close-button">× Close</button>
      </div>

      <div className="admin-body">
        <div className="admin-sidebar">
          <button
            className={activeTab === 'register' ? 'active' : ''}
            onClick={() => setActiveTab('register')}
          >
            <span className="icon">➕</span>
            <span className="text">Register Employee</span>
          </button>
          <button
            className={activeTab === 'employees' ? 'active' : ''}
            onClick={() => setActiveTab('employees')}
          >
            <span className="icon">👥</span>
            <span className="text">All Employees</span>
          </button>
          <button
            className={activeTab === 'attendance' ? 'active' : ''}
            onClick={() => setActiveTab('attendance')}
          >
            <span className="icon">📋</span>
            <span className="text">Attendance Records</span>
          </button>
          <button
            className={activeTab === 'status' ? 'active' : ''}
            onClick={() => setActiveTab('status')}
          >
            <span className="icon">📊</span>
            <span className="text">Employee Status</span>
          </button>
        </div>

        <div className="admin-content">{activeTab === 'register' && (
          <div className="register-section">
            <h2>Register New Employee</h2>
            
            {message.text && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleRegisterEmployee}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    value={newEmployee.employee_id}
                    onChange={(e) => setNewEmployee({...newEmployee, employee_id: e.target.value})}
                    required
                    placeholder="e.g., EMP001"
                  />
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={newEmployee.full_name}
                    onChange={(e) => setNewEmployee({...newEmployee, full_name: e.target.value})}
                    required
                    placeholder="e.g., John Doe"
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                    required
                    placeholder="e.g., john.doe@company.com"
                  />
                </div>

                <div className="form-group">
                  <label>Department *</label>
                  <select
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                    required
                  >
                    <option value="">Select Department</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Research & Development">Research & Development</option>
                    <option value="Administration">Administration</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Position *</label>
                  <select
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                    required
                  >
                    <option value="">Select Position</option>
                    <option value="Chief Executive Officer">Chief Executive Officer</option>
                    <option value="Chief Technology Officer">Chief Technology Officer</option>
                    <option value="Chief Financial Officer">Chief Financial Officer</option>
                    <option value="Senior Manager">Senior Manager</option>
                    <option value="Manager">Manager</option>
                    <option value="Assistant Manager">Assistant Manager</option>
                    <option value="Team Lead">Team Lead</option>
                    <option value="Senior Executive">Senior Executive</option>
                    <option value="Executive">Executive</option>
                    <option value="Senior Officer">Senior Officer</option>
                    <option value="Officer">Officer</option>
                    <option value="Associate">Associate</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
              </div>

              <div className="form-group camera-section">
                <label>Capture Face Images (3-5 images required) *</label>
                
                {!isCameraActive && capturedImages.length === 0 && (
                  <button 
                    type="button" 
                    className="btn-camera"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Button clicked!');
                      startCamera();
                    }}
                  >
                    Start Camera
                  </button>
                )}

                {isCameraActive && (
                  <div className="camera-container">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline
                      muted
                      className="video-preview"
                    />
                    <div className="camera-controls">
                      <button 
                        type="button" 
                        className="btn-capture"
                        onClick={captureImage}
                      >
                        Capture ({capturedImages.length}/5)
                      </button>
                      <button 
                        type="button" 
                        className="btn-stop"
                        onClick={stopCamera}
                      >
                        Stop Camera
                      </button>
                    </div>
                  </div>
                )}

                {capturedImages.length > 0 && (
                  <div className="captured-images">
                    <div className="image-count">
                      {capturedImages.length} image(s) captured {capturedImages.length >= 3 ? '✓' : `(need ${3 - capturedImages.length} more)`}
                    </div>
                    <div className="image-grid">
                      {capturedImages.map((img, index) => (
                        <div key={index} className="captured-image">
                          <img src={img.url} alt={`Capture ${index + 1}`} />
                          <button 
                            type="button"
                            className="btn-remove"
                            onClick={() => removeImage(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {!isCameraActive && capturedImages.length < 5 && (
                      <button 
                        type="button" 
                        className="btn-camera-small"
                        onClick={startCamera}
                      >
                        Capture More
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="btn-reset"
                      onClick={resetCapture}
                    >
                      Reset All
                    </button>
                  </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              <button type="submit" className="btn-submit" disabled={loading || capturedImages.length < 3}>
                {loading ? 'Registering...' : 'Register Employee'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="employees-section">
            <h2>All Employees ({employees.length})</h2>
            
            {loading ? (
              <div className="loading">Loading...</div>
            ) : employees.length === 0 ? (
              <div className="no-data">
                <p>No employees registered yet.</p>
                <button 
                  onClick={() => setActiveTab('register')}
                  className="btn-primary"
                >
                  Register First Employee
                </button>
              </div>
            ) : (
              <div className="data-list">
                <div className="data-row data-header">
                  <div className="data-cell id-cell">
                    <span className="cell-label">Employee ID</span>
                  </div>
                  <div className="data-cell name-cell">
                    <span className="cell-label">Name</span>
                  </div>
                  <div className="data-cell email-cell">
                    <span className="cell-label">Email</span>
                  </div>
                  <div className="data-cell dept-cell">
                    <span className="cell-label">Department</span>
                  </div>
                  <div className="data-cell position-cell">
                    <span className="cell-label">Position</span>
                  </div>
                  <div className="data-cell status-cell">
                    <span className="cell-label">Status</span>
                  </div>
                  <div className="data-cell action-cell">
                    <span className="cell-label">Actions</span>
                  </div>
                </div>
                {employees.map((emp) => (
                  <div key={emp._id} className="data-row">
                    <div className="data-cell id-cell">
                      <span className="cell-value">{emp.employee_id}</span>
                    </div>
                    <div className="data-cell name-cell">
                      <span className="cell-value">{emp.full_name}</span>
                    </div>
                    <div className="data-cell email-cell">
                      <span className="cell-value">{emp.email}</span>
                    </div>
                    <div className="data-cell dept-cell">
                      <span className="cell-value">{emp.department || '-'}</span>
                    </div>
                    <div className="data-cell position-cell">
                      <span className="cell-value">{emp.position || '-'}</span>
                    </div>
                    <div className="data-cell status-cell">
                      <span className="status-badge enrolled">Enrolled</span>
                    </div>
                    <div className="data-cell action-cell">
                      <button
                        onClick={() => handleDeleteEmployee(emp.employee_id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="attendance-section">
            <div className="section-header">
              <h2>Attendance Records ({attendance.length})</h2>
              <div className="controls">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="date-input"
                />
                <button 
                  onClick={() => {
                    setDateFilter('');
                    fetchAttendance();
                  }} 
                  className="btn-clear"
                >
                  Clear
                </button>
                <button onClick={exportAttendance} className="btn-export">
                  📥 Export CSV
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className="data-list attendance-data">
                {attendance.length === 0 ? (
                  <div className="no-data">No attendance records found.</div>
                ) : (
                  <>
                    <div className="data-row data-header">
                      <div className="data-cell date-cell">
                        <span className="cell-label">Date</span>
                      </div>
                      <div className="data-cell time-cell">
                        <span className="cell-label">Time</span>
                      </div>
                      <div className="data-cell emp-id-cell">
                        <span className="cell-label">Employee ID</span>
                      </div>
                      <div className="data-cell emp-name-cell">
                        <span className="cell-label">Employee Name</span>
                      </div>
                      <div className="data-cell status-cell">
                        <span className="cell-label">Status</span>
                      </div>
                    </div>
                    {attendance.map((record, index) => (
                      <div key={index} className="data-row attendance-row">
                        <div className="data-cell date-cell">
                          <span className="cell-value">{new Date(record.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="data-cell time-cell">
                          <span className="cell-value">{new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="data-cell emp-id-cell">
                          <span className="cell-value">{record.employee_id}</span>
                        </div>
                        <div className="data-cell emp-name-cell">
                          <span className="cell-value">{record.employee_name}</span>
                        </div>
                        <div className="data-cell status-cell">
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(record.status) }}
                          >
                            {record.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="status-section">
            <h2>Employee Attendance Status</h2>
            
            <div className="employee-selector">
              <select
                value={selectedEmployee?.employee_id || ''}
                onChange={(e) => fetchEmployeeStatus(e.target.value)}
                className="employee-dropdown"
              >
                <option value="">Select an employee</option>
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {selectedEmployee && (
              <div className="status-details">
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Total Days</h3>
                    <p className="stat-value">{selectedEmployee.total_days}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Present</h3>
                    <p className="stat-value green">{selectedEmployee.present_count}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Late Arrivals</h3>
                    <p className="stat-value orange">{selectedEmployee.late_count}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Early Leaves</h3>
                    <p className="stat-value red">{selectedEmployee.early_leave_count}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Absences</h3>
                    <p className="stat-value gray">{selectedEmployee.absent_count}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Attendance Rate</h3>
                    <p className="stat-value">{selectedEmployee.attendance_rate}%</p>
                  </div>
                </div>

                <div className="recent-attendance">
                  <h3>Recent Attendance</h3>
                  <div className="data-list recent-data">
                    {selectedEmployee.recent_records?.length === 0 ? (
                      <div className="no-data">No recent attendance records.</div>
                    ) : (
                      <>
                        <div className="data-row data-header">
                          <div className="data-cell date-cell">
                            <span className="cell-label">Date</span>
                          </div>
                          <div className="data-cell time-cell">
                            <span className="cell-label">Check In Time</span>
                          </div>
                          <div className="data-cell status-cell">
                            <span className="cell-label">Status</span>
                          </div>
                        </div>
                        {selectedEmployee.recent_records?.map((record, index) => (
                          <div key={index} className="data-row recent-row">
                            <div className="data-cell date-cell">
                              <span className="cell-value">{new Date(record.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <div className="data-cell time-cell">
                              <span className="cell-value">{new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="data-cell status-cell">
                              <span
                                className="status-badge"
                                style={{ backgroundColor: getStatusColor(record.status) }}
                              >
                                {record.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
