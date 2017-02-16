local err = redis.call("hset", KEYS[1], ARGV[1],ARGV[2])
return { err }