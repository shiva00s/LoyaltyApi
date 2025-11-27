import React, { useEffect, useState, useRef } from "react";
import "./NotificationBell.css";

function NotificationBell({ count, list, onClear }) {
    const [shake, setShake] = useState(false);
    const [open, setOpen] = useState(false);
    
    // Create a ref for the wrapper element
    const notifWrapperRef = useRef(null);

    // This effect runs the shake animation
    useEffect(() => {
        if (count > 0) {
            setShake(true);
            const timer = setTimeout(() => setShake(false), 700);
            return () => clearTimeout(timer);
        }
    }, [count]);

    // --- NEW: This effect handles clicking OUTSIDE the component ---
    useEffect(() => {
        // Function to check if click was outside
        function handleClickOutside(event) {
            if (notifWrapperRef.current && !notifWrapperRef.current.contains(event.target)) {
                setOpen(false); // Close the panel
            }
        }

        // Add the listener to the whole page if the panel is open
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            // Remove the listener if the panel is closed
            document.removeEventListener("mousedown", handleClickOutside);
        }

        // Cleanup function to remove listener when component is removed
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]); // This effect only runs when the 'open' state changes
    // --- END NEW ---

    // This function clears the count AND closes the panel
    const handleClearAndClose = () => {
        onClear();      // Clears the count in App.js
        setOpen(false); // Closes this popup
    };

    return (
        // Attach the ref to the wrapper
        <div className="notif-wrapper" ref={notifWrapperRef}>
            <div 
                className={`notif-bell ${shake ? "shake" : ""}`} 
                onClick={() => setOpen(o => !o)} // Click bell to toggle
            >
                <i className="fa fa-bell"></i>
                {count > 0 && <span className="notif-badge">{count}</span>}
            </div>

            {open && (
                <div className="notif-panel">
                    <div className="notif-header">
                        Notifications
                        {list.length > 0 && (
                            // Use the new function here
                            <button className="notif-clear" onClick={handleClearAndClose}>Clear</button>
                        )}
                    </div>

                    <div className="notif-body">
                        {list.length === 0 && (
                            <div className="notif-empty">No new notifications</div>
                        )}

                        {list.map((n, idx) => (
                            <div key={idx} className="notif-item">
                                <div className="notif-text">{n.text}</div>
                                <div className="notif-time">
                                    {new Date(n.time).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NotificationBell;