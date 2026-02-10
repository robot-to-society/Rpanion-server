import React from 'react'
import PropTypes from 'prop-types';

// Socket IO connection status
function SocketIOFooter (props) {
  return (
    <div className="socketio-footer">
      <div className={`status-indicator ${props.socketioStatus ? 'connected' : 'error'}`}>
        <i className={`bi ${props.socketioStatus ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`}></i>
        {props.socketioStatus ? 'REALTIME DATA STREAM ACTIVE' : 'REALTIME DATA STREAM OFFLINE'}
      </div>
    </div>
  )
}

// PropTypes validation
SocketIOFooter.propTypes = {
  socketioStatus: PropTypes.bool.isRequired
};

export default SocketIOFooter;
