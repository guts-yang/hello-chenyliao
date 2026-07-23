package ratelimit

import (
	"context"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Limiter interface {
	Allow(ctx context.Context, key string) bool
	Reset(key string)
}

type InMemory struct {
	mu      sync.Mutex
	rate    rate.Limit
	burst   int
	buckets map[string]*entry
	stop    chan struct{}
	stopped bool
}

type entry struct {
	limiter  *rate.Limiter
	lastUsed time.Time
}

func NewMemory(burst int, window time.Duration) *InMemory {
	if burst <= 0 {
		burst = 1
	}
	if window <= 0 {
		window = time.Minute
	}
	l := &InMemory{
		rate:    rate.Limit(float64(burst) / window.Seconds()),
		burst:   burst,
		buckets: map[string]*entry{},
		stop:    make(chan struct{}),
	}
	go l.runJanitor(window * 10)
	return l
}

func (l *InMemory) Allow(_ context.Context, key string) bool {
	if key == "" {
		key = "_default"
	}
	l.mu.Lock()
	bucket, ok := l.buckets[key]
	if !ok {
		bucket = &entry{limiter: rate.NewLimiter(l.rate, l.burst)}
		l.buckets[key] = bucket
	}
	bucket.lastUsed = time.Now()
	l.mu.Unlock()
	return bucket.limiter.Allow()
}

func (l *InMemory) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.buckets, key)
}

func (l *InMemory) Stop() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.stopped {
		return
	}
	l.stopped = true
	close(l.stop)
}

func (l *InMemory) runJanitor(idleAfter time.Duration) {
	ticker := time.NewTicker(idleAfter)
	defer ticker.Stop()
	for {
		select {
		case <-l.stop:
			return
		case now := <-ticker.C:
			l.evictIdle(now, idleAfter)
		}
	}
}

func (l *InMemory) evictIdle(now time.Time, idleAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for key, bucket := range l.buckets {
		if now.Sub(bucket.lastUsed) > idleAfter {
			delete(l.buckets, key)
		}
	}
}

// AllowAll always permits requests (used when Redis is misconfigured and
// operators prefer availability over enforcement).
type AllowAll struct{}

func (AllowAll) Allow(context.Context, string) bool { return true }
func (AllowAll) Reset(string)                       {}
