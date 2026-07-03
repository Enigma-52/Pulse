package ingest

import (
	"sync"
	"time"
)

// rateLimiter is a simple token bucket: rps tokens per second with a burst of rps.
// A nil limiter (rps <= 0) allows everything.
type rateLimiter struct {
	mu     sync.Mutex
	rps    float64
	tokens float64
	last   time.Time
}

func newRateLimiter(rps int) *rateLimiter {
	if rps <= 0 {
		return nil
	}
	return &rateLimiter{rps: float64(rps), tokens: float64(rps), last: time.Now()}
}

func (l *rateLimiter) allow() bool {
	if l == nil {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	l.tokens += now.Sub(l.last).Seconds() * l.rps
	if l.tokens > l.rps {
		l.tokens = l.rps
	}
	l.last = now

	if l.tokens < 1 {
		return false
	}
	l.tokens--
	return true
}
