import express from 'express';
import { spawn } from 'child_process';
import readline from 'readline';

const app = express();
app.use(express.json());

// Spawn MCP server process
console.log('Starting Brave Search MCP server...');
const mcpProcess = spawn('node', ['dist/index.js'], {
  env: { 
    ...process.env, 
    BRAVE_API_KEY: process.env.BRAVE_API_KEY 
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Track pending requests
const pendingRequests = new Map();

// Setup readline for line-by-line reading from stdout
const rl = readline.createInterface({
  input: mcpProcess.stdout,
  crlfDelay: Infinity
});

// Handle responses from MCP server
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('Received response:', response.id);
    
    const callback = pendingRequests.get(response.id);
    if (callback) {
      callback(response);
      pendingRequests.delete(response.id);
    }
  } catch (err) {
    console.error('Error parsing MCP response:', err);
  }
});

// Handle stderr from MCP server
mcpProcess.stderr.on('data', (data) => {
  console.error('MCP Server Error:', data.toString());
});

// Handle MCP process exit
mcpProcess.on('exit', (code) => {
  console.error(`MCP server process exited with code ${code}`);
  process.exit(1);
});

// Health check endpoint
app.get('/health', (req, res) => {
  if (mcpProcess.killed) {
    return res.status(503).json({ status: 'down', message: 'MCP server not running' });
  }
  res.json({ status: 'up', message: 'MCP server running' });
});

// Main RPC endpoint
app.post('/rpc', (req, res) => {
  const jsonRpcRequest = req.body;
  
  console.log('Received request:', jsonRpcRequest.id, jsonRpcRequest.method);
  
  // Create promise to wait for response
  const responsePromise = new Promise((resolve, reject) => {
    // Set timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(jsonRpcRequest.id);
      reject(new Error('Request timeout'));
    }, 30000); // 30 second timeout
    
    pendingRequests.set(jsonRpcRequest.id, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
  
  // Send request to MCP server
  try {
    mcpProcess.stdin.write(JSON.stringify(jsonRpcRequest) + '\n');
  } catch (err) {
    pendingRequests.delete(jsonRpcRequest.id);
    return res.status(500).json({
      jsonrpc: '2.0',
      id: jsonRpcRequest.id,
      error: {
        code: -32603,
        message: 'Failed to send request to MCP server',
        data: err.message
      }
    });
  }
  
  // Wait for response and send back
  responsePromise
    .then(response => {
      console.log('Sending response:', response.id);
      res.json(response);
    })
    .catch(err => {
      console.error('Request failed:', err);
      res.status(500).json({
        jsonrpc: '2.0',
        id: jsonRpcRequest.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: err.message
        }
      });
    });
});

// Start HTTP server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${PORT}/rpc`);
  console.log(`  GET  http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  mcpProcess.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  mcpProcess.kill();
  process.exit(0);
});