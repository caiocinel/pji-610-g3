// Configuração do PM2 na VPS. O build standalone é publicado em /opt/velas-luamme/current
// e as variáveis de ambiente ficam em /opt/velas-luamme/.env (fora das releases).
module.exports = {
  apps: [
    {
      name: "velas-luamme",
      cwd: "/opt/velas-luamme/current",
      script: "server.js",
      node_args: "--env-file=/opt/velas-luamme/.env",
      env: {
        NODE_ENV: "production",
        PORT: "3210",
        HOSTNAME: "127.0.0.1",
      },
      max_memory_restart: "400M",
    },
  ],
};
