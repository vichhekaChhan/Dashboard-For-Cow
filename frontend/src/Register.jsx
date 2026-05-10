import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, Input, Button, Typography, Alert } from 'antd';
import { LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await axios.post('/api/auth/register', { username, email, password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <Title level={2} style={{ textAlign: 'center' }}>Create Account</Title>
        <Typography.Paragraph style={{ textAlign: 'center' }}>Join WalkScale today</Typography.Paragraph>
        
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              size="large"
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Input 
              prefix={<MailOutlined />} 
              placeholder="Email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            Register
          </Button>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}