import React, { useCallback, useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';

import basePage from './basePage.jsx';
import InputNode from './components/flow/InputNode.jsx';
import HubNode from './components/flow/HubNode.jsx';
import OutputNode from './components/flow/OutputNode.jsx';
import MessageFilterPanel from './components/flow/MessageFilterPanel.jsx';
import './components/flow/FlowStyles.css';
import './css/styles.css';

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 200;

const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: layoutedNodes, edges };
};

// Custom node types
const nodeTypes = {
  inputNode: InputNode,
  hubNode: HubNode,
  outputNode: OutputNode,
};

class FlightControllerFlow extends basePage {
  constructor(props) {
    super(props, true); // true = use Socket.IO

    this.state = {
      ...this.state,
      FCStatus: {},
      serialPorts: [],
      baudRates: [],
      UDPoutputs: [],
      telemetryStatus: [],
      detectedMessages: {},
    };

    // Socket.IO listeners
    this.socket.on('FCStatus', (msg) => {
      this.handleSocketUpdate(msg);
    });

    this.socket.on('DetectedMessages', (msg) => {
      this.setState({ detectedMessages: msg });
    });

    this.socket.on('reconnect', () => {
      this.componentDidMount();
    });
  }

  componentDidMount() {
    fetch('/api/FCDetails', {
      headers: { Authorization: `Bearer ${this.state.token}` }
    })
      .then(response => response.json())
      .then(state => {
        this.setState(state);
      })
      .catch(err => console.error('Failed to fetch FC details:', err));

    fetch('/api/FCOutputs', {
      headers: { Authorization: `Bearer ${this.state.token}` }
    })
      .then(response => response.json())
      .then(state => {
        this.setState(state);
        this.loadDone();
      })
      .catch(err => console.error('Failed to fetch FC outputs:', err));
  }

  handleSocketUpdate = (msg) => {
    this.setState({ FCStatus: msg });
  }

  handleAddOutput = (config) => {
    const { protocol, mode, ip, port } = config;

    fetch('/api/addoutput', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({ protocol, mode, ip, port })
    })
      .then(response => response.json())
      .then(state => {
        this.setState(state);
      })
      .catch(err => {
        console.error('Failed to add output:', err);
        this.setState({ error: 'Failed to add output' });
      });
  }

  handleRemoveOutput = (config) => {
    const { protocol, mode, ip, port } = config;

    console.log('handleRemoveOutput called with:', config);

    // Validate port number
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      console.error('Invalid port number. Received:', port, 'Type:', typeof port, 'Parsed:', portNum);
      alert(`Invalid port number: ${port}`);
      return;
    }

    fetch('/api/removeoutput', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        protocol,
        mode,
        removeoutputIP: ip,
        removeoutputPort: portNum
      })
    })
      .then(response => response.json())
      .then(state => {
        this.setState(state);
      })
      .catch(err => {
        console.error('Failed to remove output:', err);
        this.setState({ error: 'Failed to remove output' });
      });
  }

  handleUpdateRouterSettings = (settings) => {
    const { enableHeartbeat, enableDSRequest } = settings;

    fetch('/api/updateRouterSettings', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({ enableHeartbeat, enableDSRequest })
    })
      .then(response => response.json())
      .then(state => {
        this.setState(state);
      })
      .catch(err => console.error('Failed to update router settings:', err));
  }

  renderTitle() {
    return ''; // No title for clean UI
  }

  renderContent() {
    return (
      <FlowDiagram
        fcStatus={this.state.FCStatus}
        serialPorts={this.state.serialPorts}
        baudRates={this.state.baudRates}
        udpOutputs={this.state.UDPoutputs}
        telemetryStatus={this.state.telemetryStatus}
        token={this.state.token}
        detectedMessages={this.state.detectedMessages}
        onAddOutput={this.handleAddOutput}
        onRemoveOutput={this.handleRemoveOutput}
        onUpdateRouterSettings={this.handleUpdateRouterSettings}
      />
    );
  }
}

// Functional component for React Flow diagram
function FlowDiagram({
  fcStatus,
  serialPorts,
  baudRates,
  udpOutputs,
  telemetryStatus,
  token,
  detectedMessages,
  onAddOutput,
  onRemoveOutput,
  onUpdateRouterSettings,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useRef(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Build graph from data - using useEffect to avoid infinite loops
  useEffect(() => {
    // Safely handle props with defaults
    const safeUdpOutputs = udpOutputs || [];
    const safeTelemetryStatus = Array.isArray(telemetryStatus) ? telemetryStatus : [];
    const safeFCStatus = fcStatus || {};
    const safeSerialPorts = serialPorts || [];
    const safeBaudRates = baudRates || [];
    const newNodes = [];
    const newEdges = [];

    // 1. Input Node (Flight Controller)
    newNodes.push({
      id: 'input-fc',
      type: 'inputNode',
      data: {
        serialPorts: safeSerialPorts,
        baudRates: safeBaudRates,
        isConnected: safeFCStatus.telemetryStatus || false,
        serialPort: safeFCStatus.SerialPort || '',
        baudRate: safeFCStatus.Baud || 57600,
        fcStatus: safeFCStatus, // Pass full fcStatus for telemetry display
        token: token,
      },
      position: { x: 0, y: 0 },
    });

    // 2. Hub Node (mavlink-routerd)
    // Get telemetry data from either telemetryStatus array or fcStatus object
    const totalPackets = safeTelemetryStatus.length > 0
      ? (safeTelemetryStatus.find(item => item.name === 'Packets')?.value || 0)
      : (safeFCStatus.numpackets || 0);
    const dataRate = safeTelemetryStatus.length > 0
      ? parseInt((safeTelemetryStatus.find(item => item.name === 'Data Rate')?.value || '0').replace(/[^0-9]/g, '')) || 0
      : parseInt(safeFCStatus.byteRate) || 0;

    newNodes.push({
      id: 'hub-router',
      type: 'hubNode',
      data: {
        totalPackets: parseInt(totalPackets) || 0,
        dataRate: dataRate,
        outputCount: safeUdpOutputs.length + 1, // +1 for connection to hub
        enableHeartbeat: safeFCStatus.enableHeartbeat || false,
        enableDSRequest: safeFCStatus.enableDSRequest || false,
        onAddOutput: onAddOutput,
        onUpdateRouterSettings: onUpdateRouterSettings,
        token: token,
      },
      position: { x: 400, y: 0 },
    });

    // Edge from Input to Hub
    newEdges.push({
      id: 'e-input-hub',
      source: 'input-fc',
      target: 'hub-router',
      animated: safeFCStatus.telemetryStatus || false,
      style: {
        stroke: safeFCStatus.telemetryStatus ? '#4ade80' : '#94a3b8',
        strokeWidth: 4,
        filter: safeFCStatus.telemetryStatus ? 'drop-shadow(0 0 4px rgba(74, 222, 128, 0.5))' : 'none',
      },
      type: 'smoothstep',
    });

    // 3. Output Nodes (UDP outputs)
    if (safeUdpOutputs.length > 0) {
      safeUdpOutputs.forEach((output, index) => {
        const nodeId = `output-${index}`;

        newNodes.push({
          id: nodeId,
          type: 'outputNode',
          data: {
            protocol: output.protocol || 'udp',
            mode: output.mode || 'client',
            ip: output.IP,
            port: parseInt(output.Port, 10) || 0,
            packets: parseInt(output.packetspersec) || 0,
            dataRate: parseInt(output.bytestreamsizePerSec) || 0,
            onDelete: async (id, data) => {
              // Call parent handler to remove output
              if (onRemoveOutput) {
                onRemoveOutput({
                  protocol: data.protocol || 'udp',
                  mode: data.mode || 'client',
                  ip: data.ip,
                  port: data.port
                });
              }
            },
          },
          position: { x: 800, y: index * 150 },
        });

        // Edge from Hub to Output
        const hasData = (output.packetspersec || 0) > 0;
        newEdges.push({
          id: `e-hub-${nodeId}`,
          source: 'hub-router',
          sourceHandle: `output-${index}`,
          target: nodeId,
          animated: hasData,
          label: `${output.packetspersec || 0} pkt/s`,
          labelStyle: {
            fontSize: '11px',
            fontWeight: '600',
            fill: '#64748b',
            fontFamily: 'monospace'
          },
          labelBgStyle: {
            fill: 'white',
            fillOpacity: 0.9
          },
          style: {
            stroke: hasData ? '#8b5cf6' : '#cbd5e1',
            strokeWidth: 4,
            filter: hasData ? 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.5))' : 'none',
          },
          type: 'smoothstep',
        });
      });
    }

    // Apply Dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [fcStatus, serialPorts, baudRates, udpOutputs, telemetryStatus, setNodes, setEdges]);

  // Fit view when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && reactFlowInstance.current) {
      // Small delay to ensure nodes are rendered
      const timer = setTimeout(() => {
        reactFlowInstance.current.fitView({ padding: 0.2, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onEdgeClick = useCallback((event, edge) => {
    // Only allow filtering on hub -> output edges
    if (edge.source === 'hub-router' && edge.target.startsWith('output-')) {
      setSelectedEdge(edge);
      setShowFilterPanel(true);
    }
  }, []);

  const onInit = (instance) => {
    reactFlowInstance.current = instance;
    // Fit view only on initial load
    instance.fitView({ padding: 0.2 });
  };

  return (
    <div style={{ width: '100%', height: '85vh' }}>
      {/* React Flow Canvas */}
      <div style={{
        height: '100%',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#f8fafc',
        overflow: 'hidden'
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onInit={onInit}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          minZoom={0.5}
          maxZoom={2.0}
        >
          <Background
            color="#cbd5e1"
            gap={20}
            size={1}
            style={{ opacity: 0.3 }}
          />
          <Controls
            style={{
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'inputNode') return '#4ade80';
              if (node.type === 'hubNode') return '#3b82f6';
              if (node.type === 'outputNode') return '#8b5cf6';
              return '#94a3b8';
            }}
            style={{
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          />
        </ReactFlow>
      </div>

      {/* Message Filter Panel */}
      <MessageFilterPanel
        show={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        edgeData={selectedEdge}
        token={token}
        detectedMessages={detectedMessages}
      />
    </div>
  );
}

FlowDiagram.propTypes = {
  fcStatus: PropTypes.object,
  serialPorts: PropTypes.array,
  baudRates: PropTypes.array,
  udpOutputs: PropTypes.array,
  telemetryStatus: PropTypes.array,
  token: PropTypes.string,
  detectedMessages: PropTypes.object,
  onAddOutput: PropTypes.func.isRequired,
  onRemoveOutput: PropTypes.func.isRequired,
  onUpdateRouterSettings: PropTypes.func.isRequired,
};

export default FlightControllerFlow;
