import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage';
import SignIn from './pages/SignIn';
import Register from './pages/Register';
import ManagePapers from './pages/ManagePapers';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminManagePapers from './pages/admin/AdminManagePapers';
import AdminManageUsers from './pages/admin/AdminManageUsers';
import AdminPendingApprovals from './pages/admin/AdminPendingApprovals';
import AdminPaperRequests from './pages/admin/AdminPaperRequests';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          
          {/* User Routes */}
          <Route path="/manage-papers" element={<ManagePapers />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/manage-papers" element={<AdminManagePapers />} />
          <Route path="/admin/manage-users" element={<AdminManageUsers />} />
          <Route path="/admin/pending-approvals" element={<AdminPendingApprovals />} />
          <Route path="/admin/paper-requests" element={<AdminPaperRequests />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
