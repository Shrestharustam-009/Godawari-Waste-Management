const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign(
  { id: 4, role: 'DRIVER', type: 'user', username: 'aditya.rauniyar' },
  process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_IMMEDIATELY',
  { expiresIn: '15m' }
);

async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/v1/accounting/categories', {
      headers: { Cookie: `accessToken=${token}` }
    });
    console.log("STATUS:", res.status);
    const data = await res.json();
    console.log("DATA:", data);
  } catch (err) {
    console.log("ERROR:", err);
  }
}
test();
