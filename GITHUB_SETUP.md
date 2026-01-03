# GitHub Setup & Team Collaboration Guide

## 🚀 PART 1: PUSHING CODE TO GITHUB (For Arsal)

### Step 1: Create .gitignore File
First, let's exclude files that shouldn't be on GitHub:

```bash
cd /Users/apple/Documents/AI_project
```

Create a `.gitignore` file with the following content:

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv
pip-log.txt
pip-delete-this-directory.txt

# TensorFlow/PyTorch Models
*.h5
*.pt
*.pth
*.ckpt
face_recognition_model.pt

# Environment variables
.env
.env.local

# Database
*.db
*.sqlite

# Face data (optional - if contains real face images)
backend/face_data/

# Node modules
node_modules/
frontend/node_modules/

# Build files
frontend/dist/
frontend/build/
.vite/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

---

### Step 2: Initialize Git Repository

```bash
# Check if already initialized
git status

# If not, initialize
git init
```

---

### Step 3: Push to GitHub

Follow these commands in order:

```bash
cd /Users/apple/Documents/AI_project

# Add all files
git add .

# Commit
git commit -m "Initial commit: AI Attendance System"

# Add remote (create repo on GitHub first!)
git remote add origin https://github.com/ArsalAjmal/AI-Attendance-System.git

# Push
git push -u origin main
```

---

## 👥 PART 2: TEAM MEMBERS SETUP

### Clone & Run:

```bash
# Clone
git clone https://github.com/ArsalAjmal/AI-Attendance-System.git
cd AI-Attendance-System

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Run
cd ..
chmod +x start.sh
./start.sh
```

---

## 🔄 DAILY WORKFLOW

```bash
# Before work
git pull origin main

# After work
git add .
git commit -m "Your message"
git push origin main
```
