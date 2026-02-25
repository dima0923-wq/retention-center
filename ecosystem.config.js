module.exports = {
  apps: [{
    name: "retention-center",
    script: "node_modules/.bin/next",
    args: "start",
    cwd: "/opt/retention-center",
    instances: 4,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    max_memory_restart: "512M",
    watch: false,
    autorestart: true
  }]
};
