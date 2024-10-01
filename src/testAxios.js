const axios = require('axios');

async function testAxios() {
  try {
    const response = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testAxios();