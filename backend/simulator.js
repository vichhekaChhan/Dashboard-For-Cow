const http = require('http');

// Configuration
const PORT = 3001;
const HOST = 'localhost';
const INTERVAL_MS = 5000; // Send data every 5 seconds

// Calculate past dates for ages
const today = new Date();
const getDateMonthsAgo = (months) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
};

// Define our mock cows so they actually have ages and genders for the new logic
const MOCK_COWS_DATA = [
  { cow_tag: 'COW-1', cow_name: 'Calfy', breed: 'Zebu', gender: 'Female', birth_date: getDateMonthsAgo(6) }, // 6 months
  { cow_tag: 'COW-2', cow_name: 'Yearly', breed: 'Zebu', gender: 'Female', birth_date: getDateMonthsAgo(12) }, // 12 months
  { cow_tag: 'COW-3', cow_name: 'Teen', breed: 'Zebu', gender: 'Male', birth_date: getDateMonthsAgo(18) }, // 18 months
  { cow_tag: 'COW-4', cow_name: 'Big Momma', breed: 'Zebu', gender: 'Female', birth_date: getDateMonthsAgo(36) }, // Adult Cow
  { cow_tag: 'COW-5', cow_name: 'Ferdinand', breed: 'Zebu', gender: 'Bull', birth_date: getDateMonthsAgo(48) }, // Adult Bull
];

const MOCK_COWS = MOCK_COWS_DATA.map(c => c.cow_tag);

function generateRandomWeight() {
  // Simulate a cow's weight between 50 and 680 kg to hit all categories
  return (Math.random() * (680 - 50) + 50).toFixed(2);
}

function registerCow(cowData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(cowData);
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/cows',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', (error) => reject(error));
    req.write(payload);
    req.end();
  });
}

function sendWeightData() {
  const payload = JSON.stringify({
    cow_tag: MOCK_COWS[Math.floor(Math.random() * MOCK_COWS.length)],
    weight_kg: parseFloat(generateRandomWeight())
  });

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/weight-records',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(`[Sent] Payload: ${payload}`);
      console.log(`[Received] Status: ${res.statusCode} | Data: ${data}\n`);
    });
  });

  req.on('error', (error) => {
    console.error('Simulation error - Is the backend server running on port 3001?');
    console.error(`Error details: ${error.message}\n`);
  });

  req.write(payload);
  req.end();
}

async function startSimulator() {
  console.log('Registering mock cows to ensure age-based health calculations work...');
  for (const cow of MOCK_COWS_DATA) {
    try {
      await registerCow(cow);
    } catch (e) {
      console.log(`Failed to register ${cow.cow_tag}: ${e.message}`);
    }
  }
  
  console.log(`\nStarting Cow IoT Simulator... Sending data every ${INTERVAL_MS / 1000} seconds.\n`);
  // Send first payload immediately
  sendWeightData();
  // Loop simulation
  setInterval(sendWeightData, INTERVAL_MS);
}

startSimulator();
