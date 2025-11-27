import React from 'react';
import { FaUserTie } from 'react-icons/fa';
import '../Dashboard.css';// We will reuse the dashboard's CSS

// This is a simple component that just displays the list of staff
function StaffList({ staffList }) {
  return (
    <div className="card list-card staff-list-card"> {/* Added new class */}
      <div className="card-header">
        <h3><FaUserTie /> Staff List</h3>
      </div>
      <div className="card-body scrollable-list">
        {staffList.length === 0 ? (
          <div className="info-card">
            <p>No staff found.</p>
          </div>
        ) : (
          staffList.map((staffName, index) => (
            <div key={index} className="info-card">
              <div className="info-card-header">
                <strong>{staffName}</strong>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StaffList;