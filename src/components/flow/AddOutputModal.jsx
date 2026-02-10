import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import '../../css/styles.css';

/**
 * AddOutputModal - Modal for adding new MAVLink outputs
 *
 * Features:
 * - Protocol selection (UDP/TCP)
 * - Mode selection (Client/Server)
 * - Conditional IP input (Client mode only)
 * - Port input (always visible)
 * - Spaceship UI styling
 */
const AddOutputModal = ({ onClose, onAdd }) => {
  const [protocol, setProtocol] = useState('udp');
  const [mode, setMode] = useState('client');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(14550);

  const handleAdd = () => {
    // Validate inputs
    if (mode === 'client' && !ip) {
      alert('Please enter an IP address for client mode');
      return;
    }

    if (!port || port < 1 || port > 65535) {
      alert('Please enter a valid port (1-65535)');
      return;
    }

    const config = {
      protocol,
      mode,
      ...(mode === 'client' ? { ip } : {}),
      port: parseInt(port, 10)
    };

    onAdd(config);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="add-output-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="add-output-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-secondary)',
          border: '2px solid var(--color-accent-cyan)',
          borderRadius: '8px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '90vw',
          boxShadow: '0 0 30px var(--glow-cyan)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h4 style={{
          fontFamily: "'Orbitron', sans-serif",
          color: 'var(--color-accent-cyan)',
          marginBottom: '20px',
          textShadow: '0 0 10px var(--glow-cyan)',
          textAlign: 'center',
        }}>
          Add MAVLink Output
        </h4>

        {/* Protocol Selection */}
        <Form.Group className="mb-3">
          <Form.Label style={{
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}>
            Protocol
          </Form.Label>
          <Form.Select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-accent-cyan)',
            }}
          >
            <option value="udp">UDP</option>
            <option value="tcp">TCP</option>
          </Form.Select>
        </Form.Group>

        {/* Mode Selection */}
        <Form.Group className="mb-3">
          <Form.Label style={{
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}>
            Mode
          </Form.Label>
          <Form.Select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-accent-cyan)',
            }}
          >
            <option value="client">Client</option>
            <option value="server">Server</option>
          </Form.Select>
        </Form.Group>

        {/* IP Address (Client mode only) */}
        {mode === 'client' && (
          <Form.Group className="mb-3">
            <Form.Label style={{
              color: 'var(--color-text-primary)',
              fontSize: '0.9rem',
              fontWeight: '600',
            }}>
              IP Address
            </Form.Label>
            <Form.Control
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="192.168.1.100"
              autoFocus
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-accent-cyan)',
              }}
            />
          </Form.Group>
        )}

        {/* Port */}
        <Form.Group className="mb-3">
          <Form.Label style={{
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}>
            Port
          </Form.Label>
          <Form.Control
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="14550"
            min="1"
            max="65535"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-accent-cyan)',
            }}
          />
        </Form.Group>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginTop: '20px',
        }}>
          <Button
            variant="success"
            onClick={handleAdd}
            disabled={mode === 'client' && !ip}
            style={{
              flex: 1,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: '600',
            }}
          >
            Add Output
          </Button>
          <Button
            variant="outline-secondary"
            onClick={onClose}
            style={{
              flex: 1,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: '600',
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddOutputModal;
