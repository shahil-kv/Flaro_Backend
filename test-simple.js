// Simple test to isolate the issue
console.log('Starting simple test...');

try {
  console.log('Testing basic Node.js functionality...');
  console.log('Node version:', process.version);
  console.log('Current working directory:', process.cwd());
  
  console.log('Testing ts-node import...');
  const { register } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  
  console.log('Registering ts-node...');
  register('ts-node/esm', pathToFileURL('./'));
  
  console.log('Attempting to import main.ts...');
  const mainModule = await import('./src/main.ts');
  console.log('✅ Main module loaded successfully!');
  
} catch (error) {
  console.error('❌ Error occurred:');
  console.error('Error type:', error?.constructor?.name || 'unknown');
  console.error('Error message:', error?.message || 'no message');
  console.error('Error stack:', error?.stack || 'no stack');
  console.error('Full error object:', error);
}
