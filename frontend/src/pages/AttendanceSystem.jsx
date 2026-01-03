import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import AdminPanel from './AdminPanel';
import './AttendanceSystem.css';

const API_BASE_URL = 'http://localhost:8000';

function AttendanceSystem() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [adminError, setAdminError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Auto-start camera on load
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error('Failed to access camera:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  const captureAndMarkAttendance = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        setLoading(true);
        setResult(null);

        try {
          const formData = new FormData();
          formData.append('image', blob, 'attendance.jpg');

          const response = await axios.post(`${API_BASE_URL}/attendance/mark`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          setResult({
            success: true,
            employee_name: response.data.employee_name,
            employee_id: response.data.employee_id,
            timestamp: response.data.timestamp,
            status: response.data.status,
            message: response.data.status_message,
            similarity: response.data.similarity
          });
          setShowResultModal(true);
        } catch (err) {
          setResult({
            success: false,
            message: err.response?.data?.detail || 'Failed to mark attendance. Face not recognized.'
          });
          setShowResultModal(true);
        } finally {
          setLoading(false);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const handleAdminLogin = () => {
    if (adminCredentials.username === 'admin' && adminCredentials.password === 'admin123') {
      setIsAuthenticated(true);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminError('');
      // Clear credentials after successful login
      setAdminCredentials({ username: '', password: '' });
    } else {
      setAdminError('Invalid username or password');
    }
  };

  const handleCloseAdminModal = () => {
    setShowAdminLogin(false);
    setAdminError('');
    setAdminCredentials({ username: '', password: '' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on-time':
        return '#10b981';
      case 'late':
        return '#f59e0b';
      case 'early-leave':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'on-time':
        return 'On Time';
      case 'late':
        return 'Late Arrival';
      case 'early-leave':
        return 'Early Leave';
      default:
        return status;
    }
  };

  if (showAdminPanel && isAuthenticated) {
    return <AdminPanel onClose={() => {
      setShowAdminPanel(false);
      setIsAuthenticated(false);
      setAdminCredentials({ username: '', password: '' });
    }} />;
  }

  return (
    <div className="attendance-system">
      <div className="header">
        <h1>AI Attendance System</h1>
        <button 
          className="admin-button"
          onClick={() => setShowAdminLogin(true)}
        >
          Admin Panel
        </button>
      </div>

      <div className="main-content">
        <div className="instructions">
          <h2>Mark Your Attendance</h2>
          <p>Position your face in the camera and click "Mark Attendance"</p>
        </div>

        <div className="camera-section">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={cameraActive ? 'active' : 'inactive'}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {!cameraActive && (
              <div className="camera-placeholder">
                <p>📷 Camera Loading...</p>
              </div>
            )}
          </div>

          <button 
            onClick={captureAndMarkAttendance}
            className="mark-button"
            disabled={loading || !cameraActive}
          >
            {loading ? 'Verifying...' : 'Mark Attendance'}
          </button>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && result && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal-content result-modal" onClick={(e) => e.stopPropagation()}>
            {result.success ? (
              <>
                <div className="result-icon success-icon">✓</div>
                <h2>Attendance Marked Successfully!</h2>
                <div className="result-details">
                  <div className="detail-item">
                    <span className="label">Employee:</span>
                    <span className="value">{result.employee_name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Employee ID:</span>
                    <span className="value">{result.employee_id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Time:</span>
                    <span className="value">{new Date(result.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                  </div>
                  <div className="detail-item status-item">
                    <span className="label">Status:</span>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(result.status) }}
                    >
                      {getStatusText(result.status)}
                    </span>
                  </div>
                  {result.message && (
                    <div className="status-message">
                      {result.message}
                    </div>
                  )}
                </div>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowResultModal(false)}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="result-icon error-icon">✗</div>
                <h2>Verification Failed</h2>
                <p className="error-message">{result.message}</p>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowResultModal(false)}
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="modal-overlay" onClick={handleCloseAdminModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Admin Login</h2>
            {adminError && <div className="error-message">{adminError}</div>}
            
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                placeholder="Enter username"
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                placeholder="Enter password"
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
            </div>

            <div className="modal-buttons">
              <button onClick={handleAdminLogin} className="btn-primary">
                Login
              </button>
              <button onClick={handleCloseAdminModal} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="footer">
        <p>Powered by Maham, Arsal and Hanzala</p>
      </div>
    </div>
  );
}

export default AttendanceSystem;
