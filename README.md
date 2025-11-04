Supervisório de Computadores
Sistema de monitoramento em tempo real do parque de computadores da empresa, com integração ao Zabbix.

📋 Funcionalidades
  ✅ Monitoramento em tempo real de CPU e RAM
  
  ✅ Organização por blocos/setores
  
  ✅ Wake-on-LAN para ligar computadores remotamente
  
  ✅ Ping para verificar conectividade
  
  ✅ Dashboard com estatísticas por bloco
  
  ✅ Interface responsiva e moderna
  
  ✅ Atualização automática dos dados
  
🛠️ Tecnologias
Frontend
HTML5

CSS3

JavaScript Vanilla

Font Awesome (ícones)

Backend

Node.js

Express

Axios (comunicação com Zabbix API)

Wake-on-LAN

Ping



📦 Estrutura do Projeto
supervisorio/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env
└── README.md


🚀 Instalação
1. Clone o repositório
bash
git clone <seu-repositorio>
cd supervisorio
2. Configure o Backend
bash
cd backend
npm install

4. Configure as variáveis de ambiente
Edite o arquivo .env com suas credenciais do Zabbix:

env
PORT=3000
ZABBIX_URL=http://seu-servidor-zabbix/api_jsonrpc.php
ZABBIX_USER=Admin
ZABBIX_PASSWORD=sua-senha

4. Inicie o servidor
bash
npm start
Ou para desenvolvimento com auto-reload:

bash
npm run dev
5. Configure o Frontend
Abra o arquivo frontend/app.js e ajuste a URL da API se necessário:

javascript
const API_URL = 'http://localhost:3000/api';
6. Acesse o sistema
Abra o arquivo frontend/index.html em seu navegador ou sirva via HTTP server:

bash
cd frontend
python3 -m http.server 8080
Acesse: http://localhost:8080

🔧 Configuração do Zabbix
Itens necessários nos hosts do Zabbix:
CPU Usage
Key: system.cpu.util[,avg1]
Tipo: Numeric (float)
Memory Usage
Key: vm.memory.util
Tipo: Numeric (float)
Nomenclatura dos hosts:
Para que o sistema organize corretamente por blocos, nomeie os hosts seguindo o padrão:

PC-[BLOCO]-[NÚMERO]
Exemplos:

PC-TI-001 → Bloco: TI
PC-ADM-001 → Bloco: ADM
PC-PROD-001 → Bloco: PROD
📡 API Endpoints
GET /api/computers
Retorna lista de todos os computadores com métricas atualizadas

Response:

json
[
  {
    "id": 1,
    "name": "PC-TI-001",
    "ip": "192.168.1.10",
    "mac": "N/A",
    "block": "TI",
    "status": "online",
    "cpu": 45.3,
    "ram": 62.1,
    "lastUpdate": "2025-10-23T10:30:00.000Z"
  }
]
POST /api/wol
Envia pacote Wake-on-LAN para ligar um computador

Request:

json
{
  "mac": "00:1B:44:11:3A:B7",
  "ip": "192.168.1.10"
}
Response:

json
{
  "success": true,
  "message": "Wake-on-LAN enviado com sucesso",
  "mac": "00:1B:44:11:3A:B7"
}
POST /api/ping
Faz ping em um host

Request:

json
{
  "ip": "192.168.1.10"
}
Response:

json
{
  "success": true,
  "ip": "192.168.1.10",
  "time": "12.5",
  "packetLoss": "0%"
}
GET /api/health
Verifica status do servidor e conexão com Zabbix

Response:

json
{
  "status": "ok",
  "zabbixConnected": true,
  "timestamp": "2025-10-23T10:30:00.000Z"
}
🎨 Personalização
Cores de Status
Edite styles.css para personalizar as cores:

css
.status-badge.online { color: #10b981; }
.status-badge.warning { color: #f59e0b; }
.status-badge.offline { color: #ef4444; }
Intervalo de Atualização
Edite app.js para alterar o intervalo de atualização (padrão: 5 segundos):

javascript
updateInterval = setInterval(async () => {
    await fetchComputers();
    renderBlockStats();
    renderComputers();
}, 5000); // Altere aqui (em milissegundos)
🔒 Segurança
⚠️ IMPORTANTE:

Nunca exponha o arquivo .env publicamente
Use HTTPS em produção
Implemente autenticação no frontend
Configure CORS adequadamente
Limite as permissões do usuário Zabbix
📝 TODO / Melhorias Futuras
 Adicionar autenticação de usuários
 Implementar WebSocket para updates em tempo real
 Adicionar gráficos históricos
 Sistema de alertas por email/SMS
 Exportar relatórios
 Adicionar mais métricas (disco, rede, etc)
 Interface de administração
 Logs de ações executadas
 
🐛 Troubleshooting
Erro de conexão com Zabbix
Verifique se:

A URL do Zabbix está correta
As credenciais estão corretas
O servidor Zabbix está acessível pela rede
O usuário tem permissões adequadas
Wake-on-LAN não funciona
Verifique se WOL está habilitado na BIOS
Certifique-se que o servidor está na mesma rede
O endereço MAC deve estar correto
O switch deve suportar WOL
Dados não atualizam
Verifique o console do navegador (F12)
Confirme se o backend está rodando
Verifique a configuração de CORS

📄 Licença
MIT

👨‍💻 Suporte
Para dúvidas e suporte, abra uma issue no repositório.

