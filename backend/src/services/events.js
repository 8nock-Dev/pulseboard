// In-memory store mapping userId -> Set<Response>
// When a monitor check completes, we emit the result to all connected
// browser tabs belonging to that user via Server-Sent Events.
const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
  console.log(`[SSE] Client connected: ${userId} (total: ${clients.get(userId).size})`);
}

function removeClient(userId, res) {
  if (!clients.has(userId)) return;
  clients.get(userId).delete(res);
  if (clients.get(userId).size === 0) {
    clients.delete(userId);
  }
}

function emitToUser(userId, payload) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  userClients.forEach((res) => {
    try {
      res.write(message);
    } catch {
      // Client disconnected — the 'close' event will handle cleanup
    }
  });
}

module.exports = { addClient, removeClient, emitToUser };
