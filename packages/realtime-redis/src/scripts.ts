/** Every Redis key accessed by these scripts is declared in KEYS, with one hash tag per atomic operation. */
export const roomScript = `
local op, id, owner, now = ARGV[1], ARGV[2], ARGV[3], tonumber(ARGV[4])
if op ~= 'remove' then
  local expired = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)
  for _, member in ipairs(expired) do
    redis.call('HDEL', KEYS[1], member)
    redis.call('HDEL', KEYS[4], member)
    redis.call('ZREM', KEYS[2], member)
  end
  redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
end
local raw = redis.call('HGET', KEYS[1], id)
local mine = raw and cjson.decode(raw).owner == owner
if op == 'claim' then
  if not raw and redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[5]) then return 0 end
  if raw and cjson.decode(ARGV[6]).player == cjson.null and cjson.decode(raw).player ~= cjson.null then return 1 end
  redis.call('HSET', KEYS[1], id, ARGV[6])
  redis.call('HDEL', KEYS[4], id)
  redis.call('ZADD', KEYS[2], now, id)
  redis.call('ZADD', KEYS[3], ARGV[7], id)
  return 1
elseif op == 'update' then
  if not mine then return 0 end
  redis.call('HSET', KEYS[1], id, ARGV[6])
  redis.call('HSET', KEYS[4], id, ARGV[6])
  return 1
elseif op == 'remove' then
  if not mine then return 0 end
  redis.call('HDEL', KEYS[1], id)
  redis.call('HDEL', KEYS[4], id)
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
  return 1
elseif op == 'touch' then
  if not mine then return 0 end
  redis.call('ZADD', KEYS[2], now, id)
  redis.call('ZADD', KEYS[3], ARGV[7], id)
  return 1
elseif op == 'changes' then
  if redis.call('HLEN', KEYS[4]) == 0 then return {} end
  local last = redis.call('GET', KEYS[5])
  if last and now - tonumber(last) < tonumber(ARGV[5]) then return nil end
  redis.call('SET', KEYS[5], now)
  local changes = redis.call('HGETALL', KEYS[4])
  redis.call('DEL', KEYS[4])
  return changes
elseif op == 'count' then
  local count = redis.call('ZCARD', KEYS[2])
  if raw then count = count - 1 end
  return count
else
  return redis.call('HGETALL', KEYS[1])
end`;
export const connectionScript = `
if ARGV[1] == 'lease' then
  redis.call('ZADD', KEYS[1], ARGV[3], ARGV[2])
elseif ARGV[1] == 'release' then
  redis.call('ZREM', KEYS[1], ARGV[2])
else
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[3])
  return redis.call('ZCARD', KEYS[1])
end
return 1`;
export const unlockScript =
  "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
export const renewScript =
  "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end";
