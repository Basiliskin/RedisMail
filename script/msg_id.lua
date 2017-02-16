local tmp = redis.call("hget", KEYS[1], ARGV[1])
if not tmp then
	tmp = 1
else
	tmp = tmp + 1
end
local err = redis.call("hset", KEYS[1], ARGV[1],tmp)
return { tmp }