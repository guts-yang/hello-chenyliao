package redisx

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/guts-yang/hello-gutsyang/server/internal/platform/cache"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/ratelimit"
)

func Open(ctx context.Context, addr, password string, db int) (*redis.Client, error) {
	if addr == "" {
		return nil, nil
	}
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis: ping %s: %w", addr, err)
	}
	return client, nil
}

type Cache struct {
	rdb *redis.Client
}

func NewCache(rdb *redis.Client) *Cache {
	return &Cache{rdb: rdb}
}

func (c *Cache) Get(ctx context.Context, key string) ([]byte, bool) {
	val, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return nil, false
	}
	return val, true
}

func (c *Cache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	_ = c.rdb.Set(ctx, key, value, ttl).Err()
}

func (c *Cache) DeletePrefix(ctx context.Context, prefix string) {
	var cursor uint64
	for {
		keys, next, err := c.rdb.Scan(ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = c.rdb.Del(ctx, keys...).Err()
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}

var _ cache.Store = (*Cache)(nil)

// TokenBucket is a Redis-backed fixed-window style limiter using INCR + EXPIRE.
// When Redis errors, Allow returns true (fail-open) so the API stays available.
type TokenBucket struct {
	rdb    *redis.Client
	burst  int
	window time.Duration
}

func NewLimiter(rdb *redis.Client, burst int, window time.Duration) *TokenBucket {
	if burst <= 0 {
		burst = 1
	}
	if window <= 0 {
		window = time.Minute
	}
	return &TokenBucket{rdb: rdb, burst: burst, window: window}
}

func (l *TokenBucket) Allow(ctx context.Context, key string) bool {
	if key == "" {
		key = "_default"
	}
	rk := "rl:" + key
	n, err := l.rdb.Incr(ctx, rk).Result()
	if err != nil {
		return true
	}
	if n == 1 {
		_ = l.rdb.Expire(ctx, rk, l.window).Err()
	}
	return n <= int64(l.burst)
}

func (l *TokenBucket) Reset(key string) {
	_ = l.rdb.Del(context.Background(), "rl:"+key).Err()
}

var _ ratelimit.Limiter = (*TokenBucket)(nil)

// FallbackLimiter tries Redis first; on construction failure callers pass memory.
func NewLimiterOrMemory(rdb *redis.Client, burst int, window time.Duration) ratelimit.Limiter {
	if rdb == nil {
		return ratelimit.NewMemory(burst, window)
	}
	return NewLimiter(rdb, burst, window)
}

func NewCacheOrMemory(rdb *redis.Client) cache.Store {
	if rdb == nil {
		return cache.NewMemory()
	}
	return NewCache(rdb)
}

func WindowSeconds(window time.Duration) string {
	sec := int(window.Seconds())
	if sec < 1 {
		sec = 1
	}
	return strconv.Itoa(sec)
}
