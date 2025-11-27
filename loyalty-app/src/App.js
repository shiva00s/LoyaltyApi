import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import "./App.css";

// Components & Services
import * as signalR from "@microsoft/signalr";
import StaffReport from "./StaffReport.js";
import CustomerReport from './CustomerReport.js';
import StaffManagement from './StaffManagement.js';
import CustomerBlacklist from './CustomerBlacklist.js';
import Sidebar from "./Sidebar.js";
import Dashboard from "./Dashboard.js";
import Report from "./Report.js";
import CustomerDashboard from "./CustomerDashboard.js";
import Settings from "./Settings.js";
import TierReport from "./TierReport.js";
import Promotions from "./Promotions.js";
import CustomerSearch from "./CustomerSearch.js";
import CustomerMergeTool from "./CustomerMergeTool.js";
import Register from "./Register.js";
import Login from "./Login.js";
import UserManagement from "./UserManagement.js";
import BulkAddCoupon from "./BulkAddCoupon.js";
import { useAuth } from "./AuthContext";
import { apiCall } from "./ApiService";
import NotificationBell from "./Components/NotificationBell";
import LoadingSpinner from "./Components/LoadingSpinner";

// Search
import AsyncSelect from "react-select/async";
import debounce from "lodash.debounce";

// --- NEW: Theme Toggle Component (Copied from previous step) ---
import { FaSun, FaMoon } from 'react-icons/fa';
function ThemeToggle({ currentTheme, toggleTheme }) {
    return (
        <button 
            className="btn btn-link text-light me-3" 
            onClick={toggleTheme}
            style={{ fontSize: '1.2em', cursor: 'pointer', padding: '0' }}
            title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
            {currentTheme === 'dark' ? <FaSun /> : <FaMoon />}
        </button>
    );
}
// --- END NEW ---

// --- NEW: Default features (Moved from Sidebar.js) ---
const defaultFeatures = {
    BulkAdd: true,
    Merge: true,
    Promotions: true,
    Reports: true,
    TierReport: true,
    CustomerReport: true,
    StaffManagement: true,
    CustomerHistory: true, 
    UserManagement: true,
    CustomerBlacklist: true,
    EnableNotifications: true, // <-- NEW
    EnableThemeToggle: true   // <-- NEW
};
// --- END NEW ---

const SIGNALR_URL = process.env.REACT_APP_SIGNALR_URL || "http://localhost:5212/notificationhub";

function App() {
  const [customer, setCustomer] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState([]);
  const [currentView, setView] = useState("dashboard");
  const [staffList, setStaffList] = useState([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [reportFilters, setReportFilters] = useState(null);
  const [authView, setAuthView] = useState("login");
  
  // --- NEW: Feature state is now in App.js ---
  const [features, setFeatures] = useState(defaultFeatures);
  
  const triggerRefresh = () => setRefreshCounter((c) => c + 1);
  const { isAuthenticated, isCheckingAuth, logout, user, setThemePreference } = useAuth(); // Get theme function

  // Customer select (Unchanged)
  const handleSelectCustomer = async (selectedOption) => {
    if (!selectedOption || !selectedOption.value) return;
    setCustomer(null);
    setReportFilters(null);
    try {
      const data = await apiCall(`customer/${selectedOption.value}`);
      setCustomer(data);
      setView("customerDashboard");
    } catch (e) {
      console.error("Customer fetch failed", e);
    }
  };

  const handleSelectChange = handleSelectCustomer;

  // View handlers (Unchanged)
  const handleSetView = (view) => {
    setCustomer(null);
    setReportFilters(null);
    setAuthView("login");
    setView(view);
  };
  const handleSetViewWithFilter = (view, filters) => {
    setCustomer(null);
    setReportFilters(filters);
    setView(view);
  };

  // Autocomplete search (Unchanged)
  const fetchOptions = useCallback(async (inputValue) => {
    if (inputValue.length < 2) return [];
    try {
      const data = await apiCall(`customer/autocomplete?query=${inputValue}`);
      return Array.isArray(data)
        ? data.map((s) => ({
            value: s.cardNo,
            label: `${s.cName || "N/A"} (${s.cardNo}) - ${s.cContact || "No Mobile"}`
          }))
        : [];
    } catch {
      return [];
    }
  }, []);
  const loadOptions = useMemo(() => debounce(fetchOptions, 300), [fetchOptions]);

  // --- NEW: Theme Toggle Handler (Copied from previous step) ---
  const handleThemeToggle = () => {
    const newTheme = user?.themePreference === 'dark' ? 'light' : 'dark';
    setThemePreference(newTheme);
  };
  
  // --- UPDATED: useEffect hook for Staff, Notifications, SignalR, AND Features ---
  useEffect(() => {
    if (!isAuthenticated) {
      setStaffList([]);
      setNotifList([]);
      setNotifCount(0);
      setFeatures(defaultFeatures); // Reset features on logout
      return;
    }

    let isMounted = true;

    // 1. Function to fetch Staff
    const fetchStaff = async () => {
      try {
        const names = await apiCall("staff");
        if (isMounted) setStaffList(names);
      } catch (error) {
        console.error("Failed to fetch staff list", error);
      }
    };

    // 2. Function to fetch today's old notifications
    const fetchNotifications = async () => {
      try {
        const oldNotifications = await apiCall("notification");
        if (isMounted && Array.isArray(oldNotifications)) {
          const formattedList = oldNotifications.map(n => ({
            text: n.message,
            time: n.dateCreated
          }));
          setNotifList((prev) => {
            const existingMessages = new Set(prev.map(n => n.text));
            const newOldNotifications = formattedList.filter(n => !existingMessages.has(n.text));
            return [...prev, ...newOldNotifications];
          });
        }
      } catch (error) {
        console.error("Failed to fetch old notifications", error);
      }
    };

    // 3. Function to connect to SignalR
    const setupSignalR = () => {
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(SIGNALR_URL)
        .withAutomaticReconnect()
        .build();
      connection.start().catch((err) => console.error("SignalR notification error:", err));
      connection.on("PointsConverted", (msg) => {
        setNotifCount((n) => n + 1);
        setNotifList((prev) => {
          const existingMessages = new Set(prev.map(n => n.text));
          if (existingMessages.has(msg)) return prev; 
          const updated = [{ text: msg, time: new Date() }, ...prev];
          return updated.slice(0, 10);
        });
        toast.success("✅ " + msg);
      });
      return connection;
    };

    // --- NEW: 4. Function to fetch Features ---
    const fetchFeatures = async () => {
        try {
            const settings = await apiCall('settings');
            const featureMap = settings.reduce((acc, item) => {
                if (item.settingKey.startsWith('Feature_')) {
                    const key = item.settingKey.replace('Feature_', '');
                    acc[key] = item.settingValue === 'True';
                }
                return acc;
            }, {});
            if (isMounted) {
              setFeatures(prev => ({...prev, ...featureMap}));
            }
        } catch (error) {
            console.error("Failed to load feature settings. Using defaults.", error);
        }
    };
    // --- END NEW ---

    // --- Run all functions ---
    fetchStaff();
    fetchNotifications();
    fetchFeatures(); // <-- NEW
    const signalRConnection = setupSignalR();

    // Cleanup function
    return () => {
      isMounted = false;
      signalRConnection.stop();
    };
  }, [isAuthenticated]);
  // --- END of UPDATED useEffect ---

  // Render main views
  const isAdmin = user?.role === "Admin";

  const renderView = () => {
    // (This entire renderView function is unchanged)
    // ... (switch case for all views) ...
    if (customer) {
      return (
        <CustomerDashboard
          customer={customer}
          onClear={() => handleSetView("dashboard")}
          staffList={staffList}
        />
      );
    }
    switch (currentView) {
      case "dashboard": return <Dashboard onCustomerSelect={handleSelectChange} refreshCounter={refreshCounter} staffList={staffList} />;
      case "reports": return <Report staffList={staffList} onCustomerSelect={handleSelectChange} initialFilters={reportFilters} />;
      case "settings": return <Settings />;
      case "promotions": return <Promotions onSaveComplete={triggerRefresh} />;
      case "adminTool": return <CustomerSearch onTransactionComplete={triggerRefresh} staffList={staffList} />;
      case "staffReport": return <StaffReport onNavigateToReport={handleSetViewWithFilter} />;
      case "tierReport": return <TierReport />;
      case "customerReport": return <CustomerReport onNavigateToReport={handleSetViewWithFilter} />;
      case "bulkAddCoupon": return isAdmin ? <BulkAddCoupon staffList={staffList} onTransactionComplete={triggerRefresh} /> : <Dashboard />;
      case "customerMergeTool": return isAdmin ? <CustomerMergeTool onTransactionComplete={triggerRefresh} /> : <Dashboard />;
      case "staffManagement": return isAdmin ? <StaffManagement /> : <Dashboard />;
      case "customerBlacklist": return isAdmin ? <CustomerBlacklist /> : <Dashboard />;
      case "userManagement": return isAdmin ? <UserManagement /> : <Dashboard />;
      default: return <Dashboard />;
    }
  };

  if (isCheckingAuth) return <LoadingSpinner message="Checking Session..." />;

  // Login/Register layout (Unchanged)
  if (!isAuthenticated) {
    return (
      <div className="app-layout login-layout">
        <ToastContainer autoClose={3000} position="top-right" theme="dark" />
        {authView === "login" ? (
          <Login onSwitchToRegister={() => setAuthView("register")} />
        ) : (
          <Register setView={setAuthView} />
        )}
      </div>
    );
  }

  // Header title logic (Unchanged)
  let headerTitle = currentView.charAt(0).toUpperCase() + currentView.slice(1);
  if (currentView === "staffReport") headerTitle = "Staff Report";
  if (currentView === "tierReport") headerTitle = "Tier Report";
  if (currentView === 'customerReport') headerTitle = 'Customer Report';
  if (currentView === "adminTool") headerTitle = "Admin Tool";
  if (currentView === 'staffManagement') headerTitle = 'Staff Management';
  if (currentView === "userManagement") headerTitle = "User Management";
  if (currentView === "customerMergeTool") headerTitle = "Customer Merge Tool";
  if (currentView === 'customerBlacklist') headerTitle = 'Customer Blacklist';
  if (currentView === "bulkAddCoupon") headerTitle = "Bulk Add Coupon";
  if (customer) headerTitle = `Customer: ${customer.cName || customer.cardNo}`;

  return (
    // Remove dynamic class from here, it's on the <body> tag now
    <div className="app-layout"> 
      <ToastContainer autoClose={3000} position="top-right" theme={user?.themePreference || 'dark'} />
      
      {/* Pass features prop down to Sidebar */}
      <Sidebar setView={handleSetView} currentView={currentView} features={features} />

      <main className="main-content">
        <header className="main-header">
          <h1>{headerTitle}</h1>

          {/* Search Bar (Unchanged) */}
          <div className="header-search-container" style={{ verticalAlign: "middle" }}>
            <AsyncSelect
              classNamePrefix="header-select"
              cacheOptions defaultOptions loadOptions={loadOptions}
              onChange={handleSelectCustomer}
              placeholder="Search Customer Card/Mobile..."
              noOptionsMessage={() => "Type to search customers..."}
              value={null}
              // (styles are unchanged)
            />
          </div>

          {/* --- UPDATED: Notification + User + Theme --- */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            
            {/* --- FIX: Conditionally render Theme Toggle --- */}
            {user && features.EnableThemeToggle && (
                <ThemeToggle 
                    currentTheme={user.themePreference} 
                    toggleTheme={handleThemeToggle} 
                />
            )}

            {/* --- FIX: Conditionally render Notification Bell --- */}
            {features.EnableNotifications && (
              <NotificationBell
                count={notifCount}
                list={notifList}
                onClear={() => setNotifCount(0)}
              />
            )}

            Welcome, <strong>{user?.staffName || user?.username}</strong> |
            <button onClick={logout} className="btn-void logout-button">
              Log Out
            </button>
          </div>
          {/* --- END UPDATED --- */}
        </header>

        <div className="content-area">{renderView()}</div>
      </main>
    </div>
  );
}

export default App;