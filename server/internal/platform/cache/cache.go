package cache

import (
	"context"
	"strings"
	"sync"
	"time"
)

type Store interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration)
	DeletePrefix(ctx context.Context, prefix string)
}

type Memory struct {
	mu    sync.RWMutex
	items map[string]entry
}

type entry struct {
	value     []byte
	expiresAt time.Time
}

func NewMemory() *Memory {
	return &Memory{items: map[string]entry{}}
}

func (c *Memory) Get(_ context.Context, key string) ([]byte, bool) {
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()
	if !ok || item.expiresAt.Before(time.Now()) {
		return nil, false
	}
	return append([]byte(nil), item.value...), true
}

func (c *Memory) Set(_ context.Context, key string, value []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = entry{
		value:     append([]byte(nil), value...),
		expiresAt: time.Now().Add(ttl),
	}
}

func (c *Memory) DeletePrefix(_ context.Context, prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.items {
		if strings.HasPrefix(key, prefix) {
			delete(c.items, key)
		}
	}
}
