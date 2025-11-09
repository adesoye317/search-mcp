// #!/usr/bin/env node
// import { getOptions } from './config.js';
// import { stdioServer, httpServer } from './protocols/index.js';

// async function main() {
//   const options = getOptions();

//   if (!options) {
//     console.error('Invalid configuration');
//     process.exit(1);
//   }

//   // default to stdio server unless http is explicitly requested
//   if (options.transport === 'http') {
//     httpServer.start();
//     return;
//   }

//   await stdioServer.start();
// }

// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });




import { getOptions } from './config.js';
import { stdioServer, httpServer } from './protocols/index.js';

async function main() {
  console.log('========================================');
  console.log('Starting MCP Server');
  console.log('========================================');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Port:', process.env.PORT);
  console.log('Transport:', process.env.TRANSPORT || process.env.MCP_TRANSPORT);
  console.log('BRAVE_API_KEY set:', !!process.env.BRAVE_API_KEY);
  
  const options = getOptions();
  
  if (!options) {
    console.error('Invalid configuration');
    console.error('Please check your environment variables');
    process.exit(1);
  }

  console.log('Options loaded:', JSON.stringify(options, null, 2));

  // Force HTTP mode for cloud deployment
  // Check if we're in a cloud environment (Render sets PORT automatically)
  const isCloudEnvironment = !!process.env.RENDER || !!process.env.PORT;
  
  if (isCloudEnvironment || options.transport === 'http') {
    console.log('Starting HTTP server...');
    httpServer.start();
    return;
  }

  console.log('Starting stdio server...');
  await stdioServer.start();
}

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('Main error:', error);
  process.exit(1);
});
