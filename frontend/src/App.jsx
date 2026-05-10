import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalkScaleDashboard from "./WalkScaleDashboard";
import Login from "./Login";
import Register from "./Register";
import PrivateRoute from "./PrivateRoute";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <WalkScaleDashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}
