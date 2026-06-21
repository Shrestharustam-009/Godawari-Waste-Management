const http = require('http');

const postData = JSON.stringify({
  username: 'admin',
  password: 'admin@2024'
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/auth/staff/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS:`);
  console.log(res.headers);
  
  if (res.headers['set-cookie']) {
    console.log('\n✅ SUCCESS: Secure HttpOnly cookies received!');
    res.headers['set-cookie'].forEach(cookie => console.log(' -> ' + cookie));
  } else {
    console.log('❌ FAILED: No cookies received.');
  }

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\nBODY:');
    const parsed = JSON.parse(body);
    console.log(parsed);
    
    // Verify tokens are NOT in the body
    if (!parsed.data.tokens) {
      console.log('\n✅ SUCCESS: Tokens are correctly hidden from the response body!');
    } else {
      console.log('❌ FAILED: Tokens are exposed in the body.');
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
