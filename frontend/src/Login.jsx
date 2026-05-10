import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, Input, Button, Typography, Alert } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post('/api/auth/login', { username, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // Configure axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <Title level={2} style={{ textAlign: 'center' }}>WalkScale</Title>
        <Typography.Paragraph style={{ textAlign: 'center' }}>Sign in to access your dashboard</Typography.Paragraph>
        
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Username or Email" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              size="large"
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="large"
              required
            />
          </div>
          <Button type="primary" htmlType="submit" size="large" block>
            Log in
          </Button>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            Don't have an account? <Link to="/register">Register here</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}