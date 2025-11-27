import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaPrint, FaToggleOn, FaToggleOff, FaAward, FaWrench, FaCogs } from 'react-icons/fa'; // Added FaTools
import './Settings.css'; 
import { apiCall } from './ApiService'; 
import { useAuth } from './AuthContext';
import LoadingSpinner from './Components/LoadingSpinner';

function Settings() {
    const { user } = useAuth(); // Get user role
    const [settings, setSettings] = useState({
        // Tier Settings
        PointsPerCoupon_Bronze: '100',
        CouponValue_Bronze: '250',
        PointsPerCoupon_Silver: '100',
        CouponValue_Silver: '250',
        PointsPerCoupon_Gold: '100',
        CouponValue_Gold: '250',
        DefaultExpiryDays: '900',
        TierThreshold_Silver: '10',
        TierThreshold_Gold: '50',
        
        // Print Settings
        PrintMode: 'Preview',
        PrinterName: 'RP3200',
        Feature_PrintShopHeader: 'False',
        Shop_Name: '',
        Shop_Address: '',
        Shop_Contact: '',

        // Feature Toggles
        Feature_BulkAdd: 'True',
        Feature_CustomerMerge: 'True',
        Feature_Promotions: 'True',
        Feature_Merge: 'True', 
        Feature_Reports: 'True',
        Feature_CustomerReport: 'True',
        Feature_StaffManagement: 'True',
        Feature_CustomerBlacklist: 'True',
        Feature_CustomerHistory: 'True', 
        Feature_UserManagement: 'True',
        Feature_TierReport: 'True',
        Feature_EnableNotifications: 'True',
        Feature_EnableThemeToggle: 'True',     
        
        // Worker Settings
        Worker_SyncIntervalMinutes: '60',
        Worker_SummaryIntervalMinutes: '2',
        Worker_PointCheckIntervalMinutes: '1',
        Worker_RunMode: '24/7',
        Worker_StartTime: '07:00',
        Worker_EndTime: '22:00',

        // Email Settings
        Email_EnableAlerts: 'False',
        Email_AdminAddress: '',
        Email_SendGridKey: ''
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isTestingPrint, setIsTestingPrint] = useState(false); 
    // --- THIS IS THE FIX: Set default tab to 'general' ---
    const [activeTab, setActiveTab] = useState('general'); 
    
    const isSuperAdmin = user?.role === 'Admin'; 

    // (useEffect, handleInputChange, handleToggleChange, handleSave, handleTestPrint)
    // ... all of these helper functions remain exactly the same ...
    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const data = await apiCall('settings');
                
                const settingsObject = data.reduce((obj, item) => {
                    obj[item.settingKey] = item.settingValue;
                    return obj;
                }, {});
                setSettings(prev => ({ ...prev, ...settingsObject }));
            } catch (err) {
                // apiCall handles the toast
            }
            setIsLoading(false);
        };
        fetchSettings();
     }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleChange = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: prev[key] === 'True' ? 'False' : 'True'
        }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        const settingsArray = Object.keys(settings).map(key => ({
            settingKey: key,
            settingValue: settings[key]
        }));
        try {
            await apiCall('settings', {
                method: 'PUT',
                body: JSON.stringify(settingsArray)
            });
            toast.success("Settings saved successfully!");
        } catch (err) {
            // apiCall handles the toast error
        }
        setIsLoading(false);
    };

    const handleTestPrint = async () => {
        const printerName = settings.PrinterName;
        if (!printerName) {
            toast.error("Please enter a Raw Printer Name before testing.");
            return;
        }
        setIsTestingPrint(true);
        try {
            await apiCall('customer/test-print', {
                method: 'POST',
                body: JSON.stringify({ printerName: printerName })
            });
            toast.success(`Test print job sent to '${printerName}'.`);
        } catch (err) {
            console.error("Test print failed:", err);
        }
        setIsTestingPrint(false);
    };

    if (isLoading && !settings.PointsPerCoupon_Bronze) {
        return <LoadingSpinner message="Loading settings..." />;
    }

    const renderTierInputs = (tierName) => (
        <div className="card">
            <div className="card-header">
                <h3>{tierName} Tier</h3>
            </div>
            <div className="card-body">
                <div className="form-group">
                    <label htmlFor={`PointsPerCoupon_${tierName}`}>Points for 1 Coupon</label>
                    <input type="number" id={`PointsPerCoupon_${tierName}`} name={`PointsPerCoupon_${tierName}`} value={settings[`PointsPerCoupon_${tierName}`]} onChange={handleInputChange} className="form-input"/>
                    <p>Points a {tierName} customer needs to earn one coupon.</p>
                </div>
                <div className="form-group">
                    <label htmlFor={`CouponValue_${tierName}`}>Value of 1 Coupon (in rs)</label>
                    <input type="number" id={`CouponValue_${tierName}`} name={`CouponValue_${tierName}`} value={settings[`CouponValue_${tierName}`]} onChange={handleInputChange} className="form-input"/>
                    <p>Monetary value of a {tierName} customer's coupon.</p>
                </div>
            </div>
        </div>
    );

    const renderToggleInput = (key, label, description) => {
        const isEnabled = settings[key] === 'True';
        return (
            <div className="form-group">
                <label>{label}</label>
                <button 
                    className={`toggle-btn ${isEnabled ? 'enabled' : ''}`}
                    onClick={() => handleToggleChange(key)}
                    disabled={!isSuperAdmin || isLoading}
                >
                    {isEnabled ? <FaToggleOn /> : <FaToggleOff />}
                    {isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                <p>{description}</p>
            </div>
        );
    };

    const renderPrintSettings = () => (
        <div className="card">
            <div className="card-header">
                <h3>Shop Header (Receipt)</h3>
            </div>
            <div className="card-body">
                {renderToggleInput(
                    'Feature_PrintShopHeader',
                    'Show Shop Header on Receipt',
                    'Enable to print Shop Name, Address, and Contact on receipts.'
                )}
                <hr style={{borderColor: '#4a4d59', margin: '20px 0', borderStyle: 'dashed'}} />
                <div className="form-group">
                    <label htmlFor="Shop_Name">Shop Name</label>
                    <input type="text" id="Shop_Name" name="Shop_Name" value={settings.Shop_Name} onChange={handleInputChange} className="form-input"/>
                    <p>e.g., "My Super Store"</p>
                </div>
                <div className="form-group">
                    <label htmlFor="Shop_Address">Shop Address</label>
                    <input type="text" id="Shop_Address" name="Shop_Address" value={settings.Shop_Address} onChange={handleInputChange} className="form-input"/>
                    <p>e.g., "123 Main St, City"</p>
                </div>
                <div className="form-group">
                    <label htmlFor="Shop_Contact">Shop Contact</label>
                    <input type="text" id="Shop_Contact" name="Shop_Contact" value={settings.Shop_Contact} onChange={handleInputChange} className="form-input"/>
                    <p>e.g., "Ph: 555-1234"</p>
                </div>
            </div>
        </div>
    );

    // --- MODIFIED: This card now ONLY contains run mode ---
    const renderWorkerRunMode = () => (
        <div className="card">
            <div className="card-header">
                <h3>Worker Run Mode</h3>
            </div>
            <div className="card-body">
                 <div className="form-group">
                  <label htmlFor="Worker_RunMode">Worker Run Mode</label>
                  <select id="Worker_RunMode" name="Worker_RunMode" value={settings.Worker_RunMode} onChange={handleInputChange} className="form-select">
                    <option value="24/7">24/7 (Always On)</option>
                    <option value="BusinessHours">Business Hours Only</option>
                  </select>
                  <p>Select if the worker should run 24/7 or only during set hours.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="Worker_StartTime">Worker Start Time (HH:mm)</label>
                  <input type="text" id="Worker_StartTime" name="Worker_StartTime" value={settings.Worker_StartTime} onChange={handleInputChange} className="form-input"/>
                  <p>Format: HH:mm (e.g., 07:00)</p>
                </div>
                <div className="form-group">
                  <label htmlFor="Worker_EndTime">Worker End Time (HH:mm)</label>
                  <input type="text" id="Worker_EndTime" name="Worker_EndTime" value={settings.Worker_EndTime} onChange={handleInputChange} className="form-input"/>
                  <p>Format: HH:mm (e.g., 22:00)</p>
                </div>
            </div>
        </div>
    );
    
    // --- NEW: Card for Worker Intervals ---
    const renderWorkerIntervals = () => (
        <div className="card">
            <div className="card-header">
                <h3>Worker Intervals</h3>
            </div>
            <div className="card-body">
                <div className="form-group">
                    <label htmlFor="Worker_SyncIntervalMinutes">Customer Sync (Mins)</label>
                    <input type="number" id="Worker_SyncIntervalMinutes" name="Worker_SyncIntervalMinutes" value={settings.Worker_SyncIntervalMinutes} onChange={handleInputChange} className="form-input"/>
                    <p>How often to sync with BillnusBP. Default: 60</p>
                </div>
                <div className="form-group">
                    <label htmlFor="Worker_SummaryIntervalMinutes">Dashboard Sync (Mins)</label>
                    <input type="number" id="Worker_SummaryIntervalMinutes" name="Worker_SummaryIntervalMinutes" value={settings.Worker_SummaryIntervalMinutes} onChange={handleInputChange} className="form-input"/>
                    <p>How often to refresh dashboard stats. Default: 2</p>
                </div>
                <div className="form-group">
                    <label htmlFor="Worker_PointCheckIntervalMinutes">Point Conversion (Mins)</label>
                    <input type="number" id="Worker_PointCheckIntervalMinutes" name="Worker_PointCheckIntervalMinutes" value={settings.Worker_PointCheckIntervalMinutes} onChange={handleInputChange} className="form-input"/>
                    <p>How often to check for new points. Default: 1</p>
                </div>
            </div>
        </div>
    );
    
    // --- NEW: Card for General Rules ---
    const renderGeneralRules = () => (
        <div className="card">
            <div className="card-header">
                <h3>General Rules</h3>
            </div>
            <div className="card-body">
                <div className="form-group">
                    <label htmlFor="DefaultExpiryDays">Coupon Expiry (in Days)</label>
                    <input type="number" id="DefaultExpiryDays" name="DefaultExpiryDays" value={settings.DefaultExpiryDays} onChange={handleInputChange} className="form-input"/>
                    <p>Days a new coupon is valid before it expires. (e.g., 90)</p>
                </div>
                <div className="form-group">
                    <label htmlFor="TierThreshold_Silver">Silver Tier Threshold</label>
                    <input type="number" id="TierThreshold_Silver" name="TierThreshold_Silver" value={settings.TierThreshold_Silver} onChange={handleInputChange} className="form-input"/>
                    <p>Total redemptions needed to reach Silver tier. (e.g., 10)</p>
                </div>
                <div className="form-group">
                    <label htmlFor="TierThreshold_Gold">Gold Tier Threshold</label>
                    <input type="number" id="TierThreshold_Gold" name="TierThreshold_Gold" value={settings.TierThreshold_Gold} onChange={handleInputChange} className="form-input"/>
                    <p>Total redemptions needed to reach Gold tier. (e.g., 50)</p>
                </div>
            </div>
        </div>
    );
    
    // --- NEW: Card for Print Mode ---
    const renderPrintMode = () => (
         <div className="card">
            <div className="card-header">
                <h3>Print Mode</h3>
            </div>
            <div className="card-body">
                <div className="form-group">
                    <label htmlFor="PrintMode">Print Mode</label>
                    <select id="PrintMode" name="PrintMode" value={settings.PrintMode} onChange={handleInputChange} className="form-select">
                        <option value="Preview">Show Print Preview</option>
                        <option value="Raw">Raw (Direct Print)</option>
                    </select>
                    <p>Choose "Preview" or "Raw" for direct thermal printing.</p>
                </div>
                <div className="form-group">
                    <label htmlFor="PrinterName">Raw Printer Name</label>
                    <input type="text" id="PrinterName" name="PrinterName" value={settings.PrinterName} onChange={handleInputChange} className="form-input"/>
                    <p>The *exact* name of the thermal printer (e.g., "RP3150").</p>
                </div>
                <div className="form-group" style={{marginTop: '20px'}}>
                    <button onClick={handleTestPrint} disabled={isLoading || isTestingPrint || !isSuperAdmin} className="tab-button">
                        <FaPrint /> {isTestingPrint ? "Sending..." : "Test Print"}
                    </button>
                    <p>Send a sample receipt to the 'Raw Printer Name' above.</p>
                </div>
            </div>
        </div>
    );

    const renderEmailSettings = () => (
        <div className="card">
            <div className="card-header"><h3>Email Alert Settings</h3></div>
            <div className="card-body">
                {renderToggleInput('Email_EnableAlerts','Enable Email Alerts','Send an alert to the admin email when a background job fails.')}
                <hr style={{borderColor: '#4a4d59', margin: '20px 0', borderStyle: 'dashed'}} />
                <div className="form-group">
                    <label htmlFor="Email_AdminAddress">Admin Email Address</label>
                    <input type="email" id="Email_AdminAddress" name="Email_AdminAddress" value={settings.Email_AdminAddress} onChange={handleInputChange} className="form-input"/>
                    <p>The email address to send alerts to.</p>
                </div>
                <div className="form-group">
                    <label htmlFor="Email_SendGridKey">SendGrid API Key</label>
                    <input type="password" id="Email_SendGridKey" name="Email_SendGridKey" value={settings.Email_SendGridKey} onChange={handleInputChange} className="form-input"/>
                    <p>The secret API key from your SendGrid account (free tier).</p>
                </div>
            </div>
        </div>
    );
    
    // ---
    // --- FINAL RETURN BLOCK (Tabs Re-organized) ---
    // ---
    return (
        <div className="settings-page">
            
            <div className="card promotions-header">
                <h2>Loyalty Settings</h2>
                <button onClick={handleSave} disabled={isLoading || isTestingPrint || !isSuperAdmin} className="tab-button active">
                    {isLoading ? "Saving..." : "Save All Settings"}
                </button>
            </div>
            
            <div className="settings-tabs">
                <button 
                    className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    <FaWrench /> General
                </button>
                <button 
                    className={`tab-button ${activeTab === 'loyalty' ? 'active' : ''}`}
                    onClick={() => setActiveTab('loyalty')}
                >
                    <FaAward /> Tiers
                </button>
                {isSuperAdmin && (
                    <>
                        <button 
                            className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
                            onClick={() => setActiveTab('features')}
                        >
                            <FaToggleOn /> Features
                        </button>
                        <button 
                            className={`tab-button ${activeTab === 'advanced' ? 'active' : ''}`}
                            onClick={() => setActiveTab('advanced')}
                        >
                            <FaCogs /> Advanced
                        </button>
                    </>
                )}
            </div>

            <div className="settings-tab-content">
                
                {/* --- Tab 1: General Settings (NEW 3-COLUMN LAYOUT) --- */}
                {activeTab === 'general' && (
                    <div id="general-settings" className="settings-horizontal-layout settings-row-1">
                        {renderGeneralRules()}
                        {renderPrintMode()}
                        {renderWorkerIntervals()}
                    </div>
                )}

                {/* --- Tab 2: Loyalty & Tiers (Unchanged) --- */}
                {activeTab === 'loyalty' && (
                    <div id="loyalty-settings">
                        <div className="settings-horizontal-layout settings-row-1">
                            {renderTierInputs('Bronze')}
                            {renderTierInputs('Silver')}
                            {renderTierInputs('Gold')}
                        </div>
                    </div>
                )}

                {/* --- Tab 3: Features (Unchanged 3-col layout) --- */}
                {activeTab === 'features' && isSuperAdmin && (
                    <div id="feature-settings">
                        <div className="settings-horizontal-layout settings-row-1">
                            <div className="card feature-control-panel">
                                <div className="card-header"><h3>Core Features</h3></div>
                                <div className="card-body">
                                    {renderToggleInput('Feature_EnableNotifications', 'Notification Bell', 'Show the real-time notification bell.')}
                                    {renderToggleInput('Feature_EnableThemeToggle', 'Theme Toggle', 'Allow users to switch themes.')}
                                    {renderToggleInput('Feature_Promotions', 'Promotions', 'Enable the Promotions management page.')}
                                </div>
                            </div>
                            <div className="card feature-control-panel">
                                <div className="card-header"><h3>Admin Tools</h3></div>
                                <div className="card-body">
                                    {renderToggleInput('Feature_UserManagement', 'User Management', 'Enable the user account management page.')}
                                    {renderToggleInput('Feature_StaffManagement', 'Staff Management', 'Enable the staff enable/disable page.')}
                                    {renderToggleInput('Feature_CustomerHistory', 'Customer History/Void', 'Enable the customer transaction viewer.')}
                                    {renderToggleInput('Feature_CustomerMerge', 'Customer Merge Tool', 'Enable the account merge tool.')}
                                    {renderToggleInput('Feature_CustomerBlacklist', 'Customer Blacklist', 'Enable the customer blacklist feature.')}
                                    {renderToggleInput('Feature_BulkAdd', 'Bulk Add Coupons', 'Enable the Bulk Coupon Issuance tool.')}
                                </div>
                            </div>
                            <div className="card feature-control-panel">
                                <div className="card-header"><h3>Report Toggles</h3></div>
                                <div className="card-body">
                                    {renderToggleInput('Feature_Reports', 'Advanced Reports', 'Enable/Disable ALL Staff, Tier, and Main Search reports.')}
                                    {renderToggleInput('Feature_CustomerReport', 'Customer Report', 'Enable the Customer Performance Report.')}
                                    {renderToggleInput('Feature_TierReport', 'Tier Report', 'Enable the Tier Summary Report.')}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Tab 4: Advanced Config (NOW 3-COL) --- */}
                {activeTab === 'advanced' && isSuperAdmin && (
                    <div id="advanced-settings">
                        <div className="settings-horizontal-layout settings-row-3"> 
                            {renderPrintSettings()}
                            {renderWorkerRunMode()} 
                            {renderEmailSettings()}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default Settings;