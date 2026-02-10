import React, { useState, useEffect, memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Form, Button } from 'react-bootstrap';
import '../../css/styles.css';

const OutputNode = memo(({ id, data, isConnectable }) => {
  const protocol = data.protocol || 'udp';
  const mode = data.mode || 'client';
  const [ip, setIp] = useState(data.ip || '');
  const [port, setPort] = useState(data.port ? String(data.port) : '');
  const [isEditing, setIsEditing] = useState((!data.ip && mode === 'client') || !data.port);
  const [isDeleting, setIsDeleting] = useState(false);
  const packets = data.packets || 0;
  const dataRate = data.dataRate || 0;

  useEffect(() => {
    if (data.ip) setIp(data.ip);
    if (data.port) setPort(String(data.port));
  }, [data.ip, data.port]);

  const handleSave = () => {
    if ((mode === 'client' && ip && port) || (mode === 'server' && port)) {
      setIsEditing(false);
      if (data.onUpdate) {
        data.onUpdate(id, { ip, port });
      }
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    if (data.onDelete) {
      try {
        // Ensure port is a valid number
        const portNum = parseInt(port, 10);
        console.log('Deleting output:', { protocol, mode, ip, port, portNum });

        await data.onDelete(id, { protocol, mode, ip, port: portNum });
      } catch (error) {
        console.error('Error deleting output:', error);
        setIsDeleting(false);
      }
    }
  };

  const formatDataRate = (rate) => {
    if (rate >= 1000000) {
      return `${(rate / 1000000).toFixed(1)} MB/s`;
    } else if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1)} KB/s`;
    }
    return `${rate} B/s`;
  };

  const getBorderColor = () => {
    if (protocol === 'udp' && mode === 'client') return '#8b5cf6'; // Purple
    if (protocol === 'udp' && mode === 'server') return '#ec4899'; // Pink
    if (protocol === 'tcp' && mode === 'client') return '#10b981'; // Green
    if (protocol === 'tcp' && mode === 'server') return '#f59e0b'; // Amber
    return '#8b5cf6';
  };

  const borderColor = getBorderColor();

  const getProtocolLabel = () => {
    return `${protocol.toUpperCase()} ${mode === 'server' ? 'Server' : 'Client'}`;
  };

  return (
    <div style={{
      background: '#ffffff',
      border: `2px solid ${borderColor}`,
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      padding: '14px',
      minWidth: '260px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      opacity: isDeleting ? 0.5 : 1,
      transition: 'opacity 0.3s'
    }}>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        isConnectable={isConnectable}
        style={{
          background: borderColor,
          width: '16px',
          height: '16px',
          border: '3px solid white',
          boxShadow: `0 0 12px ${borderColor}99`
        }}
      />

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '2px solid #e2e8f0'
      }}>
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#1e293b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Output
          </div>
          <div style={{
            fontSize: '10px',
            color: borderColor,
            fontWeight: '600',
            marginTop: '2px'
          }}>
            {getProtocolLabel()}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline-danger"
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            fontSize: '11px',
            padding: '3px 8px'
          }}
        >
          {isDeleting ? '...' : '×'}
        </Button>
      </div>

      {/* Stats - Only show when not editing */}
      {!isEditing && (
        <div style={{
          marginBottom: '10px',
          padding: '8px',
          background: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '11px'
          }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Packets:</span>
            <span style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>
              {packets.toLocaleString()}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Rate:</span>
            <span style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>
              {formatDataRate(dataRate)}
            </span>
          </div>
        </div>
      )}

      {/* Connection Info */}
      {isEditing ? (
        <div>
          {/* IP Address - Only for client mode */}
          {mode === 'client' && (
            <div style={{ marginBottom: '8px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '3px',
                display: 'block'
              }}>
                IP Address
              </label>
              <Form.Control
                type="text"
                size="sm"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="127.0.0.1"
                style={{ fontSize: '12px' }}
              />
            </div>
          )}

          {/* Port */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '3px',
              display: 'block'
            }}>
              Port
            </label>
            <Form.Control
              type="number"
              size="sm"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="14550"
              style={{ fontSize: '12px' }}
            />
          </div>

          {/* Save Button */}
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={!port || (mode === 'client' && !ip)}
            style={{
              width: '100%',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            Save
          </Button>
        </div>
      ) : (
        <div>
          {/* Display Mode */}
          <div style={{
            padding: '8px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            marginBottom: '8px'
          }}>
            {mode === 'client' && (
              <div style={{
                fontSize: '12px',
                marginBottom: '4px',
                color: '#475569'
              }}>
                <span style={{ fontWeight: '600' }}>IP:</span>{' '}
                <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{ip}</span>
              </div>
            )}
            <div style={{
              fontSize: '12px',
              color: '#475569'
            }}>
              <span style={{ fontWeight: '600' }}>Port:</span>{' '}
              <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{port}</span>
            </div>
          </div>

          {/* Edit Button */}
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setIsEditing(true)}
            style={{
              width: '100%',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
});

OutputNode.displayName = 'OutputNode';

export default OutputNode;
