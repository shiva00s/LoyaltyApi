import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { FaPlusCircle, FaCheckCircle } from 'react-icons/fa';
import { apiCall } from './ApiService';
import { useAuth } from './AuthContext';

// Import the new components
import StatCard from './Components/StatCard';
import StatsBreakdown from './Components/StatsBreakdown';
import LatestRedemptionsList from './Components/LatestRedemptionsList';
import PendingCustomersList from './Components/PendingCustomersList';
import TopRedeemersList from './Components/TopRedeemersList';
import InactiveCustomersList from './Components/InactiveCustomersList';
import LoadingSpinner from './Components/LoadingSpinner';

// Use the environment variable or fallback to default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5212';
const HUB_URL = `${API_BASE_URL}/dashboard-hub`;

function Dashboard({ onCustomerSelect, refreshCounter }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('Today');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();
  const connectionRef = useRef(null);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);

  // --- Main data fetch function ---
  const fetchAllData = useCallback(async () => {
    if (!token) {
      console.log("⚠️ No token available, skipping data fetch");
      setIsLoading(false);
      return;
    }

    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("🔄 Fetching dashboard data...");
      const data = await apiCall('dashboard');
      console.log("✅ Dashboard data fetched successfully");
      if (isMountedRef.current) {
        setDashboardData(data);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("❌ Failed to fetch dashboard data:", error);
      if (isMountedRef.current) {
        setError(error.message || "Failed to load dashboard data");
        setDashboardData(null);
        setIsLoading(false);
      }
    }
  }, [token]);

  // --- useEffect for initial data load and refreshCounter ---
  useEffect(() => {
    console.log("📊 Dashboard: Initial load or refresh triggered");
    fetchAllData();
  }, [refreshCounter, fetchAllData]);

  // --- FIXED: useEffect for SignalR - Prevent race condition ---
  useEffect(() => {
    if (!token) {
      console.log("⚠️ No token available, skipping SignalR connection");
      return;
    }

    let connection = null;
    let isCancelled = false;

    const setupSignalR = async () => {
      if (isConnectingRef.current || isCancelled) {
        console.log("⚠️ SignalR: Already connecting or cancelled, skipping...");
        return;
      }

      isConnectingRef.current = true;

      try {
        // Clean token (remove Bearer prefix if present)
        const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
        
        console.log("🔄 Setting up SignalR connection...");
        
        // Create connection with token in query string
        connection = new HubConnectionBuilder()
          .withUrl(`${HUB_URL}?access_token=${cleanToken}`, {
            skipNegotiation: true,
            transport: HttpTransportType.WebSockets
          })
          .configureLogging(LogLevel.Warning) // Changed to Warning to reduce noise
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .build();

        connectionRef.current = connection;

        // Listen for "DashboardUpdated" event
        connection.on("DashboardUpdated", () => {
          console.log("📢 SignalR: Dashboard update received!");
          if (isMountedRef.current && !isCancelled) {
            fetchAllData();
          }
        });

        // Handle reconnection
        connection.onreconnecting((error) => {
          console.warn("⚠️ SignalR: Reconnecting...", error?.message || '');
        });

        connection.onreconnected((connectionId) => {
          console.log("✅ SignalR: Reconnected! ID:", connectionId);
        });

        connection.onclose((error) => {
          if (error && !isCancelled) {
            console.error("❌ SignalR: Connection closed:", error.message);
          } else {
            console.log("SignalR: Connection closed");
          }
          isConnectingRef.current = false;
        });

        // Start connection only if not cancelled
        if (!isCancelled) {
          await connection.start();
          console.log("✅ SignalR: Connected! ID:", connection.connectionId);
          isConnectingRef.current = false;
        }
        
      } catch (err) {
        isConnectingRef.current = false;
        if (!isCancelled) {
          console.error("❌ SignalR: Connection failed:", err.message);
          // Don't throw - allow app to work without real-time updates
        }
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(() => {
      setupSignalR();
    }, 100);

    // Cleanup function
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      
      if (connectionRef.current) {
        console.log("🔌 SignalR: Stopping connection...");
        connectionRef.current.stop()
          .then(() => {
            console.log("SignalR: Stopped cleanly");
            connectionRef.current = null;
            isConnectingRef.current = false;
          })
          .catch(err => {
            console.error("SignalR: Error stopping:", err.message);
            isConnectingRef.current = false;
          });
      }
    };
  }, [token, fetchAllData]);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- Customer Click Handler ---
  const handleCustomerClick = useCallback((cardNo, cName, cContact) => {
    if (onCustomerSelect && cardNo) {
      onCustomerSelect({
        value: cardNo,
        label: `${cName || 'N/A'} | Card: ${cardNo} | Mob: ${cContact || 'N/A'}`
      });
    } else {
      console.error("onCustomerSelect function missing or cardNo missing");
    }
  }, [onCustomerSelect]);

  // --- Render Logic ---
  if (isLoading) {
    return <LoadingSpinner message="Loading Dashboard..." />;
  }

  if (error) {
    return (
      <div className="dashboard-error" style={{ padding: '20px', textAlign: 'center' }}>
        <h3>❌ Failed to Load Dashboard</h3>
        <p style={{ color: '#e74c3c', marginBottom: '15px' }}>{error}</p>
        <button 
          onClick={fetchAllData} 
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="dashboard-error" style={{ padding: '20px', textAlign: 'center' }}>
        <h3>⚠️ No Dashboard Data Available</h3>
        <button 
          onClick={fetchAllData}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          🔄 Refresh
        </button>
      </div>
    );
  }

  // Get the correct stats data based on the selected tab
  let currentStats;
  let periodLabel = "Today";
  if (statsPeriod === 'Today' && dashboardData.stats?.today) {
    currentStats = dashboardData.stats.today;
    periodLabel = "Today";
  } else if (statsPeriod === 'Weekly' && dashboardData.stats?.weekly) {
    currentStats = dashboardData.stats.weekly;
    periodLabel = "Weekly";
  } else if (statsPeriod === 'ThirtyDays' && dashboardData.stats?.thirtyDays) {
    currentStats = dashboardData.stats.thirtyDays;
    periodLabel = "Last 30 Days";
  } else {
    currentStats = { 
      couponsCreated: 0, 
      valueCreated: 0, 
      couponsRedeemed: 0, 
      valueRedeemed: 0, 
      createdBy: [], 
      redeemedBy: [] 
    };
  }

  return (
    <div className="dashboard-layout">
      {/* --- Dashboard Tabs --- */}
      <div className="dashboard-controls">
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${statsPeriod === 'Today' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('Today')}
          >
            Today
          </button>
          <button
            className={`tab-button ${statsPeriod === 'Weekly' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('Weekly')}
          >
            Weekly
          </button>
          <button
            className={`tab-button ${statsPeriod === 'ThirtyDays' ? 'active' : ''}`}
            onClick={() => setStatsPeriod('ThirtyDays')}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <StatCard
        icon={<FaPlusCircle />}
        label="Coupons Created"
        value={currentStats.couponsCreated ?? 0}
        subtext={currentStats.valueCreated ?? 0}
        customClass="created-card"
      />
      <StatCard
        icon={<FaCheckCircle />}
        label="Coupons Redeemed"
        value={currentStats.couponsRedeemed ?? 0}
        subtext={currentStats.valueRedeemed ?? 0}
        customClass="redeemed-card"
      />

      {/* Stats Breakdown Card */}
      <StatsBreakdown
        periodLabel={periodLabel}
        statsData={currentStats}
      />

      {/* List Cards */}
      <LatestRedemptionsList
        redemptions={dashboardData.latestRedemptions ?? []}
        onCustomerClick={handleCustomerClick}
      />
      <PendingCustomersList
        customers={dashboardData.pendingCustomers ?? []}
        onCustomerClick={handleCustomerClick}
      />
      <TopRedeemersList
        redeemers={dashboardData.topRedeemers ?? []}
        onCustomerClick={handleCustomerClick}
      />
      <InactiveCustomersList
        customers={dashboardData.inactiveCustomers ?? []}
        onCustomerClick={handleCustomerClick}
      />
    </div>
  );
}

export default Dashboard;
