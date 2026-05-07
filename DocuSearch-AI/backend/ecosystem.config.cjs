module.exports = {
  apps: [
    {
      name: 'docusearch-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M', // PENTING: Batasi penggunaan memori maksimal 300MB agar VPS 512MB tidak crash
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
