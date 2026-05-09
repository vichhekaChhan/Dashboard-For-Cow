/**
 * WalkScale Dashboard — Walk-Over Weight System
 * Stack: React + Ant Design v5 + Recharts + Socket.io
 *
 * Install dependencies:
 *   npm install antd @ant-design/icons recharts socket.io-client
 *
 * Usage:
 *   Import this component and render it in your App.jsx
 *   Set SOCKET_URL to your Node.js server address
 *
 * Data contract (from ESP32 / Postman):
 *   POST /api/weight-log
 *   { "device_id": "LORA-A1B2", "weight_kg": 72.4, "timestamp": "2025-05-08T10:30:00.000Z" }
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout, Menu, Card, Row, Col, Statistic, Table, Tag, Badge,
  Typography, Space, Button, Tooltip, Divider, Empty, Alert,
  ConfigProvider, theme as antTheme,
} from 'antd';
import {
  DashboardOutlined, LineChartOutlined, DeploymentUnitOutlined,
  UnorderedListOutlined, ExportOutlined, SettingOutlined,
  QuestionCircleOutlined, UserOutlined, WifiOutlined,
  DisconnectOutlined, RadarChartOutlined, ThunderboltOutlined,
  ClockCircleOutlined, ApiOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { io } from 'socket.io-client';

import logo from './assets/logo.jpg';

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

// ── Config ──────────────────────────────────────────────────────────────────
const SOCKET_URL = 'http://localhost:3001';
const SIMULATE_INTERVAL_MS = 3500;
const MAX_CHART_POINTS = 20;
const MAX_TABLE_ROWS = 50;

const MOCK_DEVICES = ['LORA-A1B2', 'LORA-C3D4', 'LORA-E5F6', 'LORA-G7H8'];
const DEVICE_COLORS = {
  'LORA-A1B2': 'blue',
  'LORA-C3D4': 'green',
  'LORA-E5F6': 'purple',
  'LORA-G7H8': 'orange',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomWeight() {
  return parseFloat((Math.random() * 180 + 40).toFixed(1));
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false });
}
function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { hour12: false });
}
function getDeviceColor(id) {
  return DEVICE_COLORS[id] || 'default';
}

// ── Sidebar nav items ────────────────────────────────────────────────────────
const navItems = [
  { key: 'dashboard',  icon: <DashboardOutlined />,       label: 'Dashboard' },
  { type: 'divider' },
  { key: 'settings',   icon: <SettingOutlined />,          label: 'Settings' },
  { key: 'api',        icon: <QuestionCircleOutlined />,   label: 'API docs' },
];

// ── Table columns ─────────────────────────────────────────────────────────────
const columns = [
  {
    title: '#',
    dataIndex: 'index',
    key: 'index',
    width: 55,
    render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
  },
  {
    title: 'Device ID',
    dataIndex: 'device_id',
    key: 'device_id',
    render: (id) => (
      <Tag
        icon={<RadarChartOutlined />}
        color={getDeviceColor(id)}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      >
        {id}
      </Tag>
    ),
    filters: MOCK_DEVICES.map((d) => ({ text: d, value: d })),
    onFilter: (value, record) => record.device_id === value,
  },
  {
    title: 'Weight',
    dataIndex: 'weight_kg',
    key: 'weight_kg',
    sorter: (a, b) => a.weight_kg - b.weight_kg,
    render: (w) => (
      <Text strong style={{ fontFamily: 'monospace', fontSize: 14 }}>
        {w.toFixed(1)} kg
      </Text>
    ),
  },
  {
    title: 'Timestamp',
    dataIndex: 'timestamp',
    key: 'timestamp',
    render: (ts) => (
      <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {formatDateTime(ts)}
      </Text>
    ),
  },
  {
    title: 'Status',
    key: 'status',
    render: () => (
      <Badge status="success" text={<Text style={{ fontSize: 12 }}>Logged</Text>} />
    ),
  },
];

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Card size="small" style={{ padding: '6px 10px', minWidth: 140 }}>
      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{label}</Text>
      <Text strong style={{ fontFamily: 'monospace', fontSize: 15 }}>
        {payload[0].value.toFixed(1)} kg
      </Text>
      <br />
      <Tag size="small" color={getDeviceColor(payload[0]?.payload?.device_id)} style={{ fontSize: 10, marginTop: 4 }}>
        {payload[0]?.payload?.device_id}
      </Tag>
    </Card>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Alert
          message="Dashboard Error"
          description={this.state.error?.toString()}
          type="error"
          showIcon
          style={{ margin: 50 }}
        />
      );
    }
    return this.props.children;
  }
}

// ── Main Dashboard Component ──────────────────────────────────────────────────
function WalkScaleDashboardContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [socketConnected, setSocketConnected] = useState(false);
  const [simulating, setSimulating] = useState(true);

  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [deviceMap, setDeviceMap] = useState({});
  const [latestEntry, setLatestEntry] = useState(null);
  const [readingCount, setReadingCount] = useState(0);

  const socketRef = useRef(null);
  const simRef = useRef(null);
  const countRef = useRef(0);

  // ── Ingest a new reading ──────────────────────────────────────────────────
  const ingestReading = useCallback((payload) => {
    if (!payload || !payload.device_id || payload.weight_kg === undefined) return;
    
    const device_id = payload.device_id;
    const weight_kg = parseFloat(payload.weight_kg);
    if (isNaN(weight_kg)) return;
    
    const timestamp = payload.timestamp || new Date().toISOString();

    countRef.current += 1;
    const entry = { device_id, weight_kg, timestamp, index: countRef.current, key: `${timestamp}-${countRef.current}` };

    setReadingCount(countRef.current);
    setLatestEntry(entry);

    setLogs((prev) => {
      // safely prepend to logs
      return [entry, ...(prev || [])].slice(0, MAX_TABLE_ROWS);
    });

    setChartData((prev) => {
      const point = { time: formatTime(timestamp), weight_kg, device_id };
      return [...(prev || []), point].slice(-MAX_CHART_POINTS);
    });

    setDeviceMap((prev) => ({
      ...(prev || {}),
      [device_id]: {
        count: ((prev && prev[device_id]?.count) || 0) + 1,
        lastWeight: weight_kg,
        lastSeen: timestamp,
      },
    }));
  }, []);

  // ── Fetch historical data on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch(`${SOCKET_URL}/api/weight-log?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // data is descending from DB (newest first). Let's ingest them from oldest to newest to build correct chart & logs order.
          // Note: logs table expects newest first, which ingestReading already does via [entry, ...prev]
          data.reverse().forEach((row) => {
            // Need numeric values
            ingestReading({
              device_id: row.device_id,
              weight_kg: parseFloat(row.weight_kg),
              timestamp: row.timestamp || new Date().toISOString()
            });
          });
        }
      })
      .catch((err) => console.error('Failed to fetch weight history:', err));
  }, [ingestReading]);

  // ── Socket.io connection ──────────────────────────────────────────────────
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    
    socketRef.current.on('connect', () => {
      setSocketConnected(true);
      setSimulating(false); // turn off simulation when real socket connects
    });
    
    socketRef.current.on('disconnect', () => {
      setSocketConnected(false);
    });

    const handleNewWeight = (payload) => {
      ingestReading(payload);
    };

    socketRef.current.on('new_weight', handleNewWeight);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.off('new_weight', handleNewWeight);
        socketRef.current.disconnect();
      }
    };
  }, [ingestReading]);

  // ── Simulation (replace with real socket when hardware is ready) ──────────
  useEffect(() => {
    if (!simulating) {
      clearInterval(simRef.current);
      return;
    }
    simRef.current = setInterval(() => {
      if (Math.random() < 0.65) {
        ingestReading({
          device_id: MOCK_DEVICES[Math.floor(Math.random() * MOCK_DEVICES.length)],
          weight_kg: randomWeight(),
          timestamp: new Date().toISOString(),
        });
      }
    }, SIMULATE_INTERVAL_MS);
    return () => clearInterval(simRef.current);
  }, [simulating, ingestReading]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const validLogs = logs || [];
  const avgWeight = validLogs.length
    ? (validLogs.reduce((s, l) => s + (l.weight_kg || 0), 0) / validLogs.length).toFixed(1)
    : null;
  const activeDevices = Object.keys(deviceMap || {}).length;
  const systemOnline = readingCount > 0;

  // ── Trigger a single manual reading ──────────────────────────────────────
  const triggerManual = () => {
    ingestReading({
      device_id: MOCK_DEVICES[Math.floor(Math.random() * MOCK_DEVICES.length)],
      weight_kg: randomWeight(),
      timestamp: new Date().toISOString(),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1d9e75',
          borderRadius: 8,
          fontFamily: "'Inter', 'DM Sans', sans-serif",
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>

        {/* ── Sidebar ── */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
        >
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '18px 8px' : '18px 16px',
            borderBottom: '1px solid #f0f0f0', marginBottom: 4,
          }}>
            <img 
              src={logo} 
              alt="Logo" 
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} 
            />
            {!collapsed && (
              <div>
                <Title level={5} style={{ margin: 0, lineHeight: 1.2, fontSize: 14 }}>Dashboard</Title>
                <Text type="secondary" style={{ fontSize: 11 }}>v1.0 · LoRa</Text>
              </div>
            )}
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ border: 'none', fontSize: 13 }}
          />

          {/* Bottom user row */}
          {!collapsed && (
            <div style={{
              position: 'absolute', bottom: 48, left: 0, right: 0,
              padding: '10px 16px', borderTop: '1px solid #f0f0f0',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <UserOutlined style={{ fontSize: 16, color: '#888' }} />
              <div>
                <Text style={{ fontSize: 13, display: 'block', lineHeight: 1.2 }}>Admin</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>admin@walkscale.io</Text>
              </div>
            </div>
          )}
        </Sider>

        <Layout>

          {/* ── Top bar ── */}
          <Header style={{
            background: '#fff', padding: '0 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0', height: 56, lineHeight: '56px',
          }}>
            <Title level={5} style={{ margin: 0, fontWeight: 500 }}>Dashboard</Title>

            <Space>
              {/* Socket status badge */}
              <Tooltip title={socketConnected ? 'Socket.io connected' : 'Socket disconnected — running simulation'}>
                <Tag
                  icon={socketConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                  color={socketConnected ? 'success' : 'warning'}
                  style={{ cursor: 'default' }}
                >
                  {socketConnected ? 'Socket connected' : 'Simulation mode'}
                </Tag>
              </Tooltip>
            </Space>
          </Header>

          <Content style={{ padding: 24, background: '#f5f6fa', minHeight: 'calc(100vh - 56px)' }}>

            {/* ── API hint banner ── */}
            {readingCount === 0 && (
              <Alert
                icon={<ApiOutlined />}
                message="System ready — waiting for scale data"
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    POST to <Text code>http://localhost:3001/api/weight-log</Text> with{' '}
                    <Text code>{'{ "device_id": "LORA-A1B2", "weight_kg": 72.4, "timestamp": "..." }'}</Text>
                  </Text>
                }
                type="info"
                showIcon
                style={{ marginBottom: 20, borderRadius: 8 }}
              />
            )}

            {/* ── Stat cards ── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic
                    title={<Space><ClockCircleOutlined />Total weigh-ins</Space>}
                    value={readingCount}
                    valueStyle={{ fontFamily: 'monospace', fontSize: 28, color: '#1d9e75' }}
                    suffix={<Text type="secondary" style={{ fontSize: 12 }}>readings</Text>}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>This session</Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic
                    title="Average weight"
                    value={avgWeight ?? '—'}
                    valueStyle={{ fontFamily: 'monospace', fontSize: 28 }}
                    suffix={avgWeight ? 'kg' : ''}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {logs.length > 0 ? `Mean of last ${logs.length} readings` : 'No data yet'}
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic
                    title={<Space><DeploymentUnitOutlined />Active devices</Space>}
                    value={activeDevices}
                    valueStyle={{ fontFamily: 'monospace', fontSize: 28, color: '#1890ff' }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {activeDevices === 1 ? '1 LoRa node online' : `${activeDevices} LoRa nodes online`}
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ borderRadius: 10 }}>
                  <Statistic
                    title="System status"
                    value={systemOnline ? 'Active' : 'Ready'}
                    valueStyle={{
                      fontSize: 22,
                      color: systemOnline ? '#1d9e75' : '#faad14',
                    }}
                    prefix={
                      <Badge
                        status={systemOnline ? 'processing' : 'warning'}
                        style={{ marginRight: 4 }}
                      />
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {systemOnline ? 'Receiving data' : 'Awaiting ESP32'}
                  </Text>
                </Card>
              </Col>
            </Row>

            {/* ── Current weight + Device list ── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>

              {/* Current weight */}
              <Col xs={24} lg={12}>
                <Card
                  title="Current / last weighed"
                  size="small"
                  style={{ borderRadius: 10, minHeight: 200 }}
                  extra={
                    latestEntry && (
                      <Tag color={getDeviceColor(latestEntry.device_id)} icon={<RadarChartOutlined />}>
                        {latestEntry.device_id}
                      </Tag>
                    )
                  }
                >
                  {!latestEntry ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Space direction="vertical" size={2}>
                          <Text type="secondary">Waiting for scale...</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            System ready — POST to /api/weight-log
                          </Text>
                        </Space>
                      }
                      style={{ margin: '20px 0' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Weight reading
                      </Text>
                      <div style={{
                        fontFamily: 'monospace', fontSize: 64, fontWeight: 600,
                        lineHeight: 1.1, color: '#1d9e75', letterSpacing: -2,
                      }}>
                        {latestEntry.weight_kg.toFixed(1)}
                        <span style={{ fontSize: 22, fontWeight: 400, color: '#888', marginLeft: 6 }}>kg</span>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Received at {formatTime(latestEntry.timestamp)}
                      </Text>
                    </div>
                  )}
                </Card>
              </Col>

              {/* Device registry */}
              <Col xs={24} lg={12}>
                <Card
                  title="Device registry"
                  size="small"
                  style={{ borderRadius: 10, minHeight: 200 }}
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {activeDevices} device{activeDevices !== 1 ? 's' : ''} seen
                    </Text>
                  }
                >
                  {activeDevices === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No devices detected yet" style={{ margin: '20px 0' }} />
                  ) : (
                    Object.entries(deviceMap).map(([id, info]) => (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                      }}>
                        <Space>
                          <Badge status="processing" color="#1d9e75" />
                          <Tag
                            color={getDeviceColor(id)}
                            icon={<RadarChartOutlined />}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          >
                            {id}
                          </Tag>
                        </Space>
                        <Space size="large">
                          <Text type="secondary" style={{ fontSize: 12 }}>{info.count} readings</Text>
                          <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
                            {info.lastWeight.toFixed(1)} kg
                          </Text>
                        </Space>
                      </div>
                    ))
                  )}
                </Card>
              </Col>
            </Row>

            {/* ── Weight history chart ── */}
            <Card
              title="Weight history"
              size="small"
              style={{ borderRadius: 10, marginBottom: 16 }}
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {chartData.length > 0
                    ? `${chartData.length} points — last: ${chartData[chartData.length - 1]?.weight_kg.toFixed(1)} kg`
                    : 'Waiting for data'}
                </Text>
              }
            >
              {chartData.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No chart data yet" style={{ margin: '30px 0' }} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d9e75" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1d9e75" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: '#aaa' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e8e8e8' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#aaa' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v} kg`}
                      domain={['auto', 'auto']}
                    />
                    <RechartTooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="weight_kg"
                      stroke="#1d9e75"
                      strokeWidth={2}
                      fill="url(#weightGrad)"
                      dot={{ fill: '#1d9e75', r: 3, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* ── Log table ── */}
            <Card
              title="Weigh-in log"
              size="small"
              style={{ borderRadius: 10 }}
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {logs.length} record{logs.length !== 1 ? 's' : ''}
                </Text>
              }
            >
              <Table
                columns={columns}
                dataSource={logs}
                size="small"
                pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No records yet — waiting for incoming data"
                    />
                  ),
                }}
                rowClassName={(_, i) => (i === 0 && logs.length > 0 ? 'table-new-row' : '')}
                style={{ fontSize: 13 }}
              />
            </Card>

          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default function WalkScaleDashboard() {
  return (
    <ErrorBoundary>
      <WalkScaleDashboardContent />
    </ErrorBoundary>
  );
}
