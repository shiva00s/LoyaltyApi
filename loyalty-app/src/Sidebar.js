import React, { useState, useEffect } from 'react';
import './Sidebar.css';
import { 
    FaTachometerAlt, FaFileAlt, FaCog, FaUsersCog, FaAward,
    FaTrophy, FaStar, FaTools, FaUserShield, FaEnvelopeOpenText, FaUsers,
    FaUserEdit, FaUserSlash, FaChevronDown 
} from 'react-icons/fa';
import { useAuth } from './AuthContext';
// We no longer need apiCall in this file
// import { apiCall } from './ApiService'; 

// --- NEW HELPER COMPONENT: A single menu link ---
const NavLink = ({ to, icon, label, currentView, setView }) => (
  <li 
    className={currentView === to ? 'active-submenu' : ''} 
    onClick={() => setView(to)}
  >
    {icon}
    <span>{label}</span>
  </li>
);

// --- NEW HELPER COMPONENT: A collapsible submenu ---
const SubMenu = ({ 
  label, 
  icon, 
  children, 
  name, 
  activeView, 
  openMenu, 
  setOpenMenu 
}) => {
  const isOpen = openMenu === name;
  const isChildActive = React.Children.toArray(children).some(
    child => child.props.to === activeView
  );

  const toggleMenu = () => {
    setOpenMenu(isOpen ? null : name);
  };

  return (
    <>
      <li 
        className={`menu-item ${isOpen ? 'open' : ''} ${isChildActive ? 'active-parent' : ''}`}
        onClick={toggleMenu}
      >
        {icon}
        <span>{label}</span>
        <FaChevronDown className="chevron" />
      </li>
      <ul className="submenu">
        {children}
      </ul>
    </>
  );
};


// --- THIS IS THE FIX ---
// The 'features' prop is now passed in from App.js
function Sidebar({ setView, currentView, features }) {
  const { user } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const isAdmin = user && user.role === 'Admin';
  
  // --- THIS ENTIRE useEffect BLOCK IS DELETED ---
  // (We no longer fetch features here)
  // --- END DELETE ---

  // --- NEW: Set active menu on view change (Unchanged) ---
  useEffect(() => {
    if (['reports', 'staffReport', 'customerReport', 'tierReport'].includes(currentView)) {
      setOpenMenu('reports');
    } else if ([
        'staffManagement', 'userManagement', 'adminTool', 'bulkAddCoupon', 
        'promotions', 'customerMergeTool', 'customerBlacklist'
      ].includes(currentView)) {
      setOpenMenu('admin');
    }
  }, [currentView]);

  // Determine visibility based on the 'features' prop
  const showPromotions = features.Promotions;
  const showReports = features.Reports;
  const showTierReport = features.TierReport;
  const showCustomerReport = features.CustomerReport;
  const showBulkAdd = features.BulkAdd;
  const showMerge = features.Merge;
  const showStaffManagement = features.StaffManagement;
  const showCustomerBlacklist = features.CustomerBlacklist;
  const showCustomerHistory = features.CustomerHistory;
  const showUserManagement = features.UserManagement;

  const anyReportsVisible = showReports || (isAdmin && showTierReport) || (isAdmin && showCustomerReport);
  
  const anyAdminToolsVisible = isAdmin && (
    showStaffManagement || showUserManagement || showCustomerHistory || 
    showBulkAdd || showPromotions || showMerge || showCustomerBlacklist
  );

  // --- The rest of the return() is identical to your file ---
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <FaAward /> 
        <span>Loyalty System</span>
      </div>

      <ul className="sidebar-menu">
        {/* --- 1. Dashboard (Top Level) --- */}
        <li 
          className={currentView === 'dashboard' ? 'active' : ''} 
          onClick={() => setView('dashboard')}
        >
          <FaTachometerAlt />
          <span>Dashboard</span>
        </li>
        
        {/* --- 2. Reports (Submenu) --- */}
        {anyReportsVisible && (
          <SubMenu 
            label="Reports" 
            icon={<FaFileAlt />} 
            name="reports"
            activeView={currentView}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          >
            {showReports && (
              <NavLink to="reports" icon={<FaFileAlt />} label="Main Report" currentView={currentView} setView={setView} />
            )}
            {showReports && (
              <NavLink to="staffReport" icon={<FaUsersCog />} label="Staff Report" currentView={currentView} setView={setView} />
            )}
            {showReports && showCustomerReport && (
              <NavLink to="customerReport" icon={<FaUsers />} label="Customer Report" currentView={currentView} setView={setView} />
            )}
            {isAdmin && showReports && showTierReport && (
              <NavLink to="tierReport" icon={<FaTrophy />} label="Tier Report" currentView={currentView} setView={setView} />
            )}
          </SubMenu>
        )}
        
        {/* --- 3. Admin Tools (Submenu) --- */}
        {anyAdminToolsVisible && (
          <SubMenu 
            label="Admin Tools" 
            icon={<FaTools />} 
            name="admin"
            activeView={currentView}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          >
            {showStaffManagement && (
              <NavLink to="staffManagement" icon={<FaUserEdit />} label="Staff Management" currentView={currentView} setView={setView} />
            )}
            {showUserManagement && (
              <NavLink to="userManagement" icon={<FaUserShield />} label="User Management" currentView={currentView} setView={setView} />
            )}
            {showCustomerHistory && (
              <NavLink to="adminTool" icon={<FaTools />} label="Customer History/Void" currentView={currentView} setView={setView} />
            )}
            {showBulkAdd && (
              <NavLink to="bulkAddCoupon" icon={<FaEnvelopeOpenText />} label="Bulk Add Coupons" currentView={currentView} setView={setView} />
            )}
            {showPromotions && (
              <NavLink to="promotions" icon={<FaStar />} label="Promotions" currentView={currentView} setView={setView} />
            )}
            {showMerge && (
              <NavLink to="customerMergeTool" icon={<FaUsers />} label="Customer Merge" currentView={currentView} setView={setView} />
            )}
            {showCustomerBlacklist && (
              <NavLink to="customerBlacklist" icon={<FaUserSlash />} label="Customer Blacklist" currentView={currentView} setView={setView} />
            )}
          </SubMenu>
        )}

        {/* --- 4. Settings (Top Level) --- */}
        {isAdmin && (
          <li 
            className={currentView === 'settings' ? 'active' : ''} 
            onClick={() => setView('settings')}
          >
            <FaCog />
            <span>Settings</span>
          </li>
        )}
 
      </ul>
    </nav>
  );
}

export default Sidebar;