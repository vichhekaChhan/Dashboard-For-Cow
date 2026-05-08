const http = require('http');

const PORT = 3001;

function generateRandomWeight() {
  // Simulate a person's weight between 50 and 120 kg
  return (Math.random() * (120 - 50) + 50).toFixed(2);
}

function sendWeightData() {
  const payload = JSON.stringify({
    device_id: `LORA-NODE-${Math.floor(Math.random() * 5) + 1}`,
    weight_kg: parseFloat(generateRandomWeight()),
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/weight-log',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`Simulator sent: ${payload}`);
      console.log(`Server responded: ${res.statusCode} ${data}`);
    });
  });

  req.on('error', (error) => {
    console.error('Simulation error (is server running?):', error.message);
  });

  req.write(payload);
  req.end();
}

console.log('Starting simulator... Sending data every 5 seconds.');
setInterval(sendWeightData, 5000);
// Send immediately on start
sendWeightData();
