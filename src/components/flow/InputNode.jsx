import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import '../../css/styles.css';

const InputNode = memo(({ data, id }) => {
  const [serialPortSelected, setSerialPortSelected] = useState('');
  const [baudRateSelected, setBaudRateSelected] = useState(57600);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options
  const [mavVersion, setMavVersion] = useState('2');
  const [enableTCP, setEnableTCP] = useState(true);
  const [enableUDPB, setEnableUDPB] = useState(false);
  const [udpbPort, setUdpbPort] = useState(14550);
  const [doLogging, setDoLogging] = useState(false);

  const serialPorts = data.serialPorts || [];
  const baudRates = data.baudRates || [];
  const isConnected = data.isConnected || false;
  const fcStatus = data.fcStatus || {};
  const token = data.token;

  // Initialize selections from data
  useEffect(() => {
    if (data.serialPort) setSerialPortSelected(data.serialPort);
    if (data.baudRate) setBaudRateSelected(data.baudRate);
  }, [data.serialPort, data.baudRate]);

  const handleConnect = () => {
    if (!token) {
      console.error('No authentication token');
      return;
    }

    setLoading(true);

    fetch('/api/FCModify', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        inputType: 'UART',
        device: serialPortSelected,
        baud: baudRateSelected,
        mavversion: mavVersion,
        enableHeartbeat: false,
        enableTCP: enableTCP,
        enableUDPB: enableUDPB,
        UDPBPort: udpbPort,
        enableDSRequest: false,
        doLogging: doLogging
      })
    })
      .then(response => response.json())
      .then(() => {
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to modify FC connection:', err);
        setLoading(false);
      });
  };

  // Simple, clean node styling
  const nodeStyle = {
    padding: '16px',
    borderRadius: '8px',
    border: `2px solid ${isConnected ? '#4ade80' : '#64748b'}`,
    background: '#ffffff',
    minWidth: '320px',
    maxWidth: '320px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const headerStyle = {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '2px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '4px',
    display: 'block'
  };

  const statusBadge = {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    background: isConnected ? '#dcfce7' : '#f1f5f9',
    color: isConnected ? '#166534' : '#475569',
    border: `1px solid ${isConnected ? '#86efac' : '#cbd5e1'}`
  };

  const infoRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: '12px',
    borderBottom: '1px solid #f1f5f9'
  };

  const infoLabel = {
    color: '#64748b',
    fontWeight: '500'
  };

  const infoValue = {
    color: '#0f172a',
    fontWeight: '600',
    fontFamily: 'monospace'
  };

  return (
    <div style={nodeStyle}>
      <Handle
        type="source"
        position={Position.Right}
        id="fc-output"
        style={{
          background: isConnected ? '#4ade80' : '#94a3b8',
          width: '16px',
          height: '16px',
          border: '3px solid white',
          boxShadow: isConnected ? '0 0 12px rgba(74, 222, 128, 0.6)' : '0 2px 4px rgba(0,0,0,0.2)'
        }}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...headerStyle
      }}>
        <span>Flight Controller</span>
        {fcStatus.sysid && (
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#64748b',
            padding: '2px 6px',
            background: '#f1f5f9',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            ID:{fcStatus.sysid}
          </span>
        )}
      </div>

      {/* Status Badge */}
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <span style={statusBadge}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      {/* Telemetry Status - Only show when connected */}
      {isConnected && (
        <div style={{
          marginBottom: '12px',
          padding: '10px',
          background: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={infoRow}>
            <span style={infoLabel}>Packets:</span>
            <span style={infoValue}>{fcStatus.numpackets || 0}</span>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Rate:</span>
            <span style={infoValue}>{fcStatus.byteRate || 0} B/s</span>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Vehicle:</span>
            <span style={infoValue}>{fcStatus.vehType || 'N/A'}</span>
          </div>
          <div style={{ ...infoRow, borderBottom: 'none' }}>
            <span style={infoLabel}>Firmware:</span>
            <span style={infoValue}>{fcStatus.FW || 'N/A'}</span>
          </div>
        </div>
      )}

      {/* Serial Port Selection */}
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Serial Port</label>
        <Form.Select
          size="sm"
          value={serialPortSelected}
          onChange={(e) => setSerialPortSelected(e.target.value)}
          disabled={isConnected || loading}
          style={{ fontSize: '12px' }}
        >
          <option value="">Select port...</option>
          {serialPorts.map((port) => (
            <option key={port.value || port} value={port.value || port}>
              {port.label || port}
            </option>
          ))}
        </Form.Select>
      </div>

      {/* Baud Rate Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Baud Rate</label>
        <Form.Select
          size="sm"
          value={baudRateSelected}
          onChange={(e) => setBaudRateSelected(parseInt(e.target.value))}
          disabled={isConnected || loading}
          style={{ fontSize: '12px' }}
        >
          {baudRates.map((rate) => (
            <option key={rate.value || rate} value={rate.value || rate}>
              {rate.label || rate}
            </option>
          ))}
        </Form.Select>
      </div>

      {/* Connect/Disconnect Button */}
      <Button
        size="sm"
        variant={isConnected ? 'danger' : 'primary'}
        onClick={handleConnect}
        disabled={loading || !serialPortSelected}
        style={{
          width: '100%',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '10px'
        }}
      >
        {loading ? 'Processing...' : isConnected ? 'Disconnect' : 'Connect'}
      </Button>

      {/* Advanced Options */}
      <Button
        size="sm"
        variant="outline-secondary"
        onClick={() => setShowAdvanced(!showAdvanced)}
        disabled={isConnected || loading}
        style={{
          width: '100%',
          fontSize: '11px',
          padding: '4px 8px'
        }}
      >
        {showAdvanced ? '▼ Hide Options' : '▶ Advanced Options'}
      </Button>

      {showAdvanced && !isConnected && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          {/* MAVLink Version */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ ...labelStyle, fontSize: '11px' }}>MAVLink Version</label>
            <Form.Select
              size="sm"
              value={mavVersion}
              onChange={(e) => setMavVersion(e.target.value)}
              style={{ fontSize: '11px' }}
            >
              <option value="1">1.0</option>
              <option value="2">2.0</option>
            </Form.Select>
          </div>

          {/* TCP Server */}
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: '11px' }}>
              TCP Server (5760)
            </label>
            <input
              type="checkbox"
              checked={enableTCP}
              onChange={(e) => setEnableTCP(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>

          {/* UDP Broadcast */}
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: '11px' }}>
              UDP Broadcast
            </label>
            <input
              type="checkbox"
              checked={enableUDPB}
              onChange={(e) => setEnableUDPB(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>

          {enableUDPB && (
            <div style={{ marginBottom: '6px', marginLeft: '22px' }}>
              <Form.Control
                type="number"
                size="sm"
                value={udpbPort}
                onChange={(e) => setUdpbPort(parseInt(e.target.value))}
                style={{ fontSize: '11px' }}
              />
            </div>
          )}

          {/* Logging */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: '11px' }}>
              Enable Logging
            </label>
            <input
              type="checkbox"
              checked={doLogging}
              onChange={(e) => setDoLogging(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

InputNode.displayName = 'InputNode';

export default InputNode;
