import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import AccountingAnalysis from './pages/accounting/AccountingAnalysis';
import IncomeLedger from './pages/accounting/IncomeLedger';
import ExpenseLedger from './pages/accounting/ExpenseLedger';
import VehicleExpenses from './pages/accounting/VehicleExpenses';
import StaffSalary from './pages/accounting/StaffSalary';
import FleetHR from './pages/FleetHR';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';

// Temporary placeholder for other routes
const Placeholder = ({ title }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
    <h1 className="text-3xl font-bold text-slate-900 mb-6">{title}</h1>
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[400px] flex items-center justify-center">
      <p className="text-slate-400">{title} module coming soon...</p>
    </div>
  </div>
);

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes inside the App Shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/accounting/analysis" element={<AccountingAnalysis />} />
          <Route path="/accounting/income" element={<IncomeLedger />} />
          <Route path="/accounting/expense" element={<ExpenseLedger />} />
          <Route path="/accounting/vehicle-expenses" element={<VehicleExpenses />} />
          <Route path="/accounting/staff-salary" element={<StaffSalary />} />
          <Route path="/fleet" element={<FleetHR />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Default redirect for authenticated users */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Route>
      </Route>
    </Routes>
  );
}

export default App;
