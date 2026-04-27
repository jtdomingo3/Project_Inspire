const API_URL = 'http://localhost:3002/api';
const USERNAME = 'admin';
const PASSWORD = 'password123';

async function testClaude() {
  try {
    console.log('1. Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    
    const token = loginData.token;
    console.log('   Login successful.');

    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };

    console.log('2. Creating a new conversation...');
    const convRes = await fetch(`${API_URL}/assistant/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Test Run - Claude Debug', model: 'claude-3-5-haiku-20241022' })
    });
    const convData = await convRes.json();
    if (!convRes.ok) throw new Error(`Conv creation failed: ${JSON.stringify(convData)}`);
    
    const convId = convData.conversation.id;
    console.log(`   Conversation created with ID: ${convId}`);

    console.log('3. Sending query to Claude (this may take a few seconds)...');
    const queryRes = await fetch(`${API_URL}/assistant/conversations/${convId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'Hi Claude, what can you do?', model: 'claude-3-5-haiku-20241022' })
    });
    const queryData = await queryRes.json();

    console.log('\n--- API RESPONSE ---');
    console.log(JSON.stringify(queryData, null, 2));
    console.log('--- END OF RESPONSE ---\n');

    if (queryData.warning) {
      console.log('⚠️  The backend reported an error in the "warning" field:');
      console.log(`   ${queryData.warning}`);
    } else {
      console.log('✅ The call was successful!');
    }

  } catch (error) {
    console.error('❌ Test failed:');
    console.error(`   ${error.message}`);
  }
}

testClaude();
