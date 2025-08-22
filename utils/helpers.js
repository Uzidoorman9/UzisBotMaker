export function formatDuration(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60));
  return `${hr}h ${min}m ${sec}s`;
}

export function pushMemory(userMemory, userId, role, content) {
  const arr = userMemory.get(userId) || [];
  arr.push({ role, content });
  if (arr.length > 50) arr.shift();
  userMemory.set(userId, arr);
}

export function getLastMessages(userMemory, userId, limit = 40) {
  const history = userMemory.get(userId) || [];
  return history.slice(-limit);
}
