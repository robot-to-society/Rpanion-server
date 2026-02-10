import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import AddOutputModal from './AddOutputModal.jsx';

const HubNode = ({ data, isConnectable }) => {
  const {
    totalPackets = 0,
    dataRate = 0,
    outputCount = 4,
    enableHeartbeat = false,
    enableDSRequest = false,
    onAddOutput,
    onUpdateRouterSettings,
    token
  } = data;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localHeartbeat, setLocalHeartbeat] = useState(enableHeartbeat);
  const [localDSRequest, setLocalDSRequest] = useState(enableDSRequest);

  // Sync local state with props
  React.useEffect(() => {
    setLocalHeartbeat(enableHeartbeat);
    setLocalDSRequest(enableDSRequest);
  }, [enableHeartbeat, enableDSRequest]);

  const formatDataRate = (bytes) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB/s`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB/s`;
    }
    return `${bytes} B/s`;
  };

  const handleSettingsChange = (field, value) => {
    // Update local state immediately for instant feedback
    if (field === 'heartbeat') {
      setLocalHeartbeat(value);
    } else if (field === 'dsrequest') {
      setLocalDSRequest(value);
    }

    // Send update to server
    if (onUpdateRouterSettings) {
      onUpdateRouterSettings({
        enableHeartbeat: field === 'heartbeat' ? value : localHeartbeat,
        enableDSRequest: field === 'dsrequest' ? value : localDSRequest
      });
    }
  };

  // Generate output handles dynamically
  const outputHandles = Array.from({ length: outputCount }, (_, index) => {
    const verticalPosition = ((index + 1) / (outputCount + 1)) * 100;
    return (
      <Handle
        key={`output-${index}`}
        type="source"
        position={Position.Right}
        id={`output-${index}`}
        style={{
          top: `${verticalPosition}%`,
          background: '#3b82f6',
          width: '16px',
          height: '16px',
          border: '3px solid white',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)'
        }}
        isConnectable={isConnectable}
      />
    );
  });

  return (
    <div style={{
      background: '#ffffff',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      padding: '16px',
      minWidth: '300px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      <Handle
        type="target"
        position={Position.Left}
        id="input-0"
        style={{
          top: '50%',
          background: '#3b82f6',
          width: '16px',
          height: '16px',
          border: '3px solid white',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)'
        }}
        isConnectable={isConnectable}
      />

      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '2px solid #e2e8f0'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#1e293b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          MAVLink Router
        </div>
      </div>

      {/* Stats */}
      <div style={{
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px',
          background: '#f8fafc',
          borderRadius: '6px',
          marginBottom: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{
            fontSize: '12px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            Total Packets
          </span>
          <span style={{
            fontSize: '12px',
            color: '#0f172a',
            fontWeight: '600',
            fontFamily: 'monospace'
          }}>
            {totalPackets.toLocaleString()}
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px',
          background: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{
            fontSize: '12px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            Data Rate
          </span>
          <span style={{
            fontSize: '12px',
            color: '#0f172a',
            fontWeight: '600',
            fontFamily: 'monospace'
          }}>
            {formatDataRate(dataRate)}
          </span>
        </div>
      </div>

      {/* Router Settings */}
      <div style={{
        marginBottom: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            width: '100%',
            padding: '8px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            color: '#475569',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          {showSettings ? '▼' : '▶'} Router Settings
        </button>

        {showSettings && (
          <div style={{
            marginTop: '8px',
            padding: '10px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <label
                htmlFor="hub-heartbeat"
                style={{
                  fontSize: '12px',
                  color: '#475569',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                MAVLink Heartbeat
              </label>
              <input
                type="checkbox"
                id="hub-heartbeat"
                checked={localHeartbeat}
                onChange={(e) => handleSettingsChange('heartbeat', e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <label
                htmlFor="hub-dsrequest"
                style={{
                  fontSize: '12px',
                  color: '#475569',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Datastream Requests
              </label>
              <input
                type="checkbox"
                id="hub-dsrequest"
                checked={localDSRequest}
                onChange={(e) => handleSettingsChange('dsrequest', e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Output Button */}
      {onAddOutput && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '100%',
            padding: '8px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          + Add Output
        </button>
      )}

      {showAddModal && (
        <AddOutputModal
          onClose={() => setShowAddModal(false)}
          onAdd={(config) => {
            if (onAddOutput) {
              onAddOutput(config);
            }
            setShowAddModal(false);
          }}
        />
      )}

      {outputHandles}
    </div>
  );
};

export default HubNode;
