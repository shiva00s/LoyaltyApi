import React, { useState, useEffect, useCallback } from 'react';
// import { toast } from 'react-toastify'; // <-- This is correctly removed as it's not used
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'; // <-- Kept for SignalR
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


const HUB_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5212'}/dashboard-hub`; // <-- Kept for SignalR

function Dashboard({ onCustomerSelect, refreshCounter }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('Today');
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  // --- Main data fetch function ---
  const fetchAllData = useCallback(async () => {
    if (!isLoading) setIsLoading(true);
    try {
      const data = await apiCall('dashboard');
      setDashboardData(data);
    } catch (error) {
      setDashboardData(null);
    } finally {
        setIsLoading(false);
    }
  }, [isLoading]); // <-- Dependency is correct

  // --- useEffect for initial data load and refreshCounter ---
  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCounter]); // <-- Runs when refreshCounter changes

  // --- NEW: Correct useEffect for SignalR ---
  useEffect(() => {
  let connection;

  const setupSignalR = async () => {
    connection = new HubConnectionBuilder()
      .withUrl(HUB_URL) // <-- REMOVED the token options
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

      // Listen for the "ReceiveDashboardUpdate" message from the server
      connection.on("dashboardupdated", () => {
        console.log("SignalR: Received dashboard update. Refetching...");
        fetchAllData(); // Call fetchAllData to get new data
      });

      try {
        await connection.start();
        console.log("SignalR: Connected to dashboard hub.");
      } catch (err) {
        console.error("SignalR: Connection failed: ", err);
      }
    };

    if (token) {
      setupSignalR();
    }

    // Cleanup function to stop the connection when component unmounts
    return () => {
      if (connection) {
        connection.stop().then(() => console.log("SignalR: Connection stopped."));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchAllData]); // <-- Runs when token or fetchAllData function changes
  // --- END: Correct useEffect for SignalR ---


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
  if (isLoading || !dashboardData) {
    return <LoadingSpinner message="Loading Dashboard..." />;
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
    currentStats = { couponsCreated: 0, valueCreated: 0, couponsRedeemed: 0, valueRedeemed: 0, createdBy: [], redeemedBy: [] };
  }


  return (
    <div className="dashboard-layout">

      {/* --- REPLACED DashboardControls with simple Tabs --- */}
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