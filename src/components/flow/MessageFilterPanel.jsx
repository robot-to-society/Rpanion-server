import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemType = 'MESSAGE';

function MessageItem({ msgid, name, count }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemType,
    item: { msgid, name, count },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <ListGroup.Item
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
      }}
    >
      <div>
        <strong>{name}</strong> <small style={{ color: '#6c757d' }}>(ID: {msgid})</small>
      </div>
      <Badge bg="secondary">{count} packets</Badge>
    </ListGroup.Item>
  );
}

MessageItem.propTypes = {
  msgid: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
};

function DropZone({ title, messages, onDrop, zoneType }) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemType,
    drop: (item) => onDrop(item, zoneType),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const backgroundColor = zoneType === 'allowed' ? '#d4edda' : '#f8d7da';
  const borderColor = zoneType === 'allowed' ? '#28a745' : '#dc3545';
  const hoverColor = zoneType === 'allowed' ? '#c3e6cb' : '#f5c6cb';

  return (
    <div
      ref={drop}
      style={{
        border: `2px dashed ${isOver ? borderColor : '#cbd5e1'}`,
        borderRadius: '8px',
        padding: '10px',
        minHeight: '300px',
        maxHeight: '400px',
        overflowY: 'auto',
        background: isOver ? hoverColor : backgroundColor,
      }}
    >
      <h6 style={{ marginBottom: '10px', color: '#475569', fontWeight: 'bold' }}>{title}</h6>
      <ListGroup>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
            Drop messages here
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.msgid}
              msgid={msg.msgid}
              name={msg.name}
              count={msg.count}
            />
          ))
        )}
      </ListGroup>
    </div>
  );
}

DropZone.propTypes = {
  title: PropTypes.string.isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    msgid: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired,
  })).isRequired,
  onDrop: PropTypes.func.isRequired,
  zoneType: PropTypes.string.isRequired,
};

function MessageFilterPanel({ show, onClose, edgeData, token, detectedMessages }) {
  const [allowedMessages, setAllowedMessages] = useState([]);
  const [blockedMessages, setBlockedMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load existing filter when panel opens
  useEffect(() => {
    if (show && edgeData && detectedMessages) {
      // Fetch existing filter for this edge
      fetch(`/api/getEdgeFilter?edgeId=${edgeData.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((filter) => {
          const blockedIds = filter.blockedMsgIds || [];
          const allowed = [];
          const blocked = [];

          // Convert detectedMessages object to array and sort by message ID
          Object.values(detectedMessages).forEach((msg) => {
            if (blockedIds.includes(msg.msgid)) {
              blocked.push(msg);
            } else {
              allowed.push(msg);
            }
          });

          // Sort by message ID for consistent display
          allowed.sort((a, b) => a.msgid - b.msgid);
          blocked.sort((a, b) => a.msgid - b.msgid);

          setAllowedMessages(allowed);
          setBlockedMessages(blocked);
        })
        .catch((err) => {
          console.error('Failed to load filter:', err);
          // If filter doesn't exist, all messages are allowed by default
          const allowed = Object.values(detectedMessages).sort((a, b) => a.msgid - b.msgid);
          setAllowedMessages(allowed);
          setBlockedMessages([]);
        });
    }
  }, [show, edgeData, token, detectedMessages]);

  const handleDrop = (item, zone) => {
    if (zone === 'allowed') {
      // Move from blocked to allowed
      setBlockedMessages((prev) => prev.filter((m) => m.msgid !== item.msgid));
      if (!allowedMessages.find((m) => m.msgid === item.msgid)) {
        setAllowedMessages((prev) => [...prev, item].sort((a, b) => a.msgid - b.msgid));
      }
    } else {
      // Move from allowed to blocked
      setAllowedMessages((prev) => prev.filter((m) => m.msgid !== item.msgid));
      if (!blockedMessages.find((m) => m.msgid === item.msgid)) {
        setBlockedMessages((prev) => [...prev, item].sort((a, b) => a.msgid - b.msgid));
      }
    }
  };

  const handleSave = () => {
    setLoading(true);
    const blockedIds = blockedMessages.map((m) => m.msgid);

    fetch('/api/setEdgeFilter', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        edgeId: edgeData.id,
        blockedMsgIds: blockedIds,
        outputIP: edgeData.data?.ip,
        outputPort: edgeData.data?.port,
        outputProtocol: edgeData.data?.protocol || 'udp',
        outputMode: edgeData.data?.mode || 'client',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.success) {
          onClose();
        } else {
          console.error('Failed to save filter:', data.error);
          alert('Failed to save filter: ' + (data.error || 'Unknown error'));
        }
      })
      .catch((err) => {
        console.error('Failed to save filter:', err);
        alert('Failed to save filter: ' + err.message);
        setLoading(false);
      });
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>MAVLink Message Filter</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {detectedMessages && Object.keys(detectedMessages).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6c757d', padding: '40px' }}>
            <p>No MAVLink messages detected yet.</p>
            <p>Connect your flight controller to see available messages.</p>
          </div>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <div style={{ marginBottom: '15px', color: '#6c757d' }}>
              <small>Drag messages between lists to allow or block them. Blocked messages will not be forwarded to this output.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <DropZone
                title="✓ Allowed Messages"
                messages={allowedMessages}
                onDrop={handleDrop}
                zoneType="allowed"
              />
              <DropZone
                title="✗ Blocked Messages"
                messages={blockedMessages}
                onDrop={handleDrop}
                zoneType="blocked"
              />
            </div>
          </DndProvider>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading || !detectedMessages || Object.keys(detectedMessages).length === 0}>
          {loading ? 'Saving...' : 'Save Filter'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

MessageFilterPanel.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  edgeData: PropTypes.object,
  token: PropTypes.string.isRequired,
  detectedMessages: PropTypes.object,
};

export default MessageFilterPanel;
