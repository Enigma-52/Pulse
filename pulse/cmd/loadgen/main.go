// loadgen emits a realistic, continuously-updating stream of OTLP telemetry
// (traces, correlated logs, and metrics) for a fictional e-commerce platform
// spread across multiple services and two deployment environments. It is a
// development tool for populating a local Pulse instance with lifelike data so
// every screen in the dashboard has something meaningful to show.
//
//	go run ./cmd/loadgen                 # backfill 45m of history, then stream live
//	go run ./cmd/loadgen -backfill 120   # backfill two hours
//	go run ./cmd/loadgen -once           # backfill only, then exit
package main

import (
	"bytes"
	"crypto/rand"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	mrand "math/rand"
	"net/http"
	"time"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	collectorLogs "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectorMetrics "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectorTrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/proto"
)

var (
	addr     = flag.String("addr", "http://localhost:4321", "Pulse ingest base URL")
	backfill = flag.Int("backfill", 45, "minutes of history to backfill on startup")
	interval = flag.Int("interval", 3, "seconds between live batches")
	once     = flag.Bool("once", false, "backfill only, then exit")
)

// ── Topology ────────────────────────────────────────────────────────────

var languages = map[string]string{
	"web-frontend": "javascript", "api-gateway": "go", "auth-service": "node",
	"user-service": "go", "product-service": "python", "cart-service": "node",
	"order-service": "java", "payment-service": "rust", "inventory-service": "python",
	"notification-service": "go", "shipping-service": "go",
}

var versions = map[string]string{
	"web-frontend": "4.2.0", "api-gateway": "2.14.1", "auth-service": "1.8.0",
	"user-service": "3.2.7", "product-service": "1.5.0", "cart-service": "2.0.3",
	"order-service": "4.0.2", "payment-service": "2.1.4", "inventory-service": "1.5.0",
	"notification-service": "1.2.1", "shipping-service": "0.9.4",
}

var environments = []struct {
	name   string
	weight int
}{{"production", 7}, {"staging", 3}}

// ── Span tree DSL ───────────────────────────────────────────────────────

type node struct {
	service  string
	name     string
	kind     tracepb.Span_SpanKind
	durMs    int64
	attrs    map[string]any
	errored  bool
	excType  string
	excMsg   string
	excStack string
	log      string // optional info log message emitted for this span
	children []*node
}

func sp(service, name string, kind tracepb.Span_SpanKind, dur int64, attrs map[string]any, children ...*node) *node {
	return &node{service: service, name: name, kind: kind, durMs: dur, attrs: attrs, children: children}
}

func httpServer(method, route string, status int) map[string]any {
	return map[string]any{"http.request.method": method, "http.route": route, "http.response.status_code": status, "url.scheme": "https"}
}
func dbClient(system, name, op, stmt string) map[string]any {
	return map[string]any{"db.system": system, "db.name": name, "db.operation": op, "db.statement": stmt, "server.address": system + ".internal"}
}
func extHTTP(method, url, host string, status int) map[string]any {
	return map[string]any{"http.request.method": method, "url.full": url, "server.address": host, "http.response.status_code": status}
}

// ── Journeys ────────────────────────────────────────────────────────────

func journeyCheckout(fail bool) *node {
	pgReserve := sp("inventory-service", "INSERT reservations", tracepb.Span_SPAN_KIND_CLIENT, 14, dbClient("postgresql", "inventory", "INSERT", "INSERT INTO reservations (sku, qty) VALUES ($1, $2)"))
	inv := sp("inventory-service", "inventory.reserve", tracepb.Span_SPAN_KIND_SERVER, 38, httpServer("POST", "/reserve", 200), pgReserve)

	stripe := sp("payment-service", "POST api.stripe.com/v1/charges", tracepb.Span_SPAN_KIND_CLIENT, 210, extHTTP("POST", "https://api.stripe.com/v1/charges", "api.stripe.com", 200))
	pay := sp("payment-service", "payment.charge", tracepb.Span_SPAN_KIND_SERVER, 240, httpServer("POST", "/charge", 200), stripe)
	pay.log = "charge authorized"

	cart := sp("cart-service", "GET cart:items", tracepb.Span_SPAN_KIND_CLIENT, 4, dbClient("redis", "0", "GET", "GET cart:{user}:items"))
	kafka := sp("order-service", "publish orders.created", tracepb.Span_SPAN_KIND_PRODUCER, 6, map[string]any{"messaging.system": "kafka", "messaging.destination.name": "orders.created"})
	notify := sp("notification-service", "notification.send", tracepb.Span_SPAN_KIND_CONSUMER, 12, map[string]any{"messaging.system": "kafka", "notification.channel": "email"})

	order := sp("order-service", "order.create", tracepb.Span_SPAN_KIND_SERVER, 300, httpServer("POST", "/orders", 201), cart, inv, pay, kafka, notify)
	order.log = "order created"

	if fail {
		stripe.attrs = extHTTP("POST", "https://api.stripe.com/v1/charges", "api.stripe.com", 402)
		markError(stripe, "PaymentDeclinedError", "card declined: insufficient_funds",
			"PaymentDeclinedError: card declined: insufficient_funds\n  at StripeClient.charge (payment/stripe.rs:184)\n  at PaymentService.charge (payment/service.rs:92)")
		markError(pay, "PaymentDeclinedError", "downstream charge failed", stripe.excStack)
		pay.attrs = httpServer("POST", "/charge", 402)
		markError(order, "OrderFailedError", "payment step failed for order",
			"OrderFailedError: payment step failed\n  at OrderService.create (order/Service.java:141)")
		order.attrs = httpServer("POST", "/orders", 500)
	}

	gw := sp("api-gateway", "POST /checkout", tracepb.Span_SPAN_KIND_SERVER, 320, httpServer("POST", "/checkout", statusFor(fail, 201)), order)
	root := sp("web-frontend", "POST /checkout", tracepb.Span_SPAN_KIND_SERVER, 340, httpServer("POST", "/checkout", statusFor(fail, 201)), gw)
	root.log = "checkout requested"
	if fail {
		gw.attrs = httpServer("POST", "/checkout", 500)
		root.attrs = httpServer("POST", "/checkout", 500)
	}
	return root
}

func journeyBrowse(fail bool) *node {
	pg := sp("product-service", "SELECT products", tracepb.Span_SPAN_KIND_CLIENT, 22, dbClient("postgresql", "catalog", "SELECT", "SELECT * FROM products WHERE category = $1 LIMIT 50"))
	cache := sp("product-service", "GET catalog:hot", tracepb.Span_SPAN_KIND_CLIENT, 3, dbClient("redis", "0", "GET", "GET catalog:hot"))
	prod := sp("product-service", "product.list", tracepb.Span_SPAN_KIND_SERVER, 60, httpServer("GET", "/products", 200), cache, pg)
	if fail {
		markError(pg, "QueryTimeoutError", "statement timeout after 3000ms",
			"QueryTimeoutError: statement timeout\n  at Pool.query (product/db.py:57)")
		prod.attrs = httpServer("GET", "/products", 503)
	}
	gw := sp("api-gateway", "GET /products", tracepb.Span_SPAN_KIND_SERVER, 72, httpServer("GET", "/products", statusFor(fail, 200)), prod)
	root := sp("web-frontend", "GET /products", tracepb.Span_SPAN_KIND_SERVER, 88, httpServer("GET", "/products", statusFor(fail, 200)), gw)
	return root
}

func journeyLogin(fail bool) *node {
	sess := sp("auth-service", "SET session", tracepb.Span_SPAN_KIND_CLIENT, 2, dbClient("redis", "0", "SET", "SET session:{id}"))
	users := sp("auth-service", "SELECT users", tracepb.Span_SPAN_KIND_CLIENT, 12, dbClient("postgresql", "identity", "SELECT", "SELECT id, pw_hash FROM users WHERE email = $1"))
	auth := sp("auth-service", "auth.login", tracepb.Span_SPAN_KIND_SERVER, 54, httpServer("POST", "/login", statusFor(fail, 200)), users, sess)
	auth.log = "user authenticated"
	if fail {
		markError(auth, "InvalidCredentialsError", "invalid email or password",
			"InvalidCredentialsError: invalid email or password\n  at AuthService.login (auth/service.js:73)")
		auth.attrs = httpServer("POST", "/login", 401)
	}
	gw := sp("api-gateway", "POST /login", tracepb.Span_SPAN_KIND_SERVER, 66, httpServer("POST", "/login", statusFor(fail, 200)), auth)
	root := sp("web-frontend", "POST /login", tracepb.Span_SPAN_KIND_SERVER, 80, httpServer("POST", "/login", statusFor(fail, 200)), gw)
	return root
}

func journeyProfile(fail bool) *node {
	pg := sp("user-service", "SELECT user", tracepb.Span_SPAN_KIND_CLIENT, 9, dbClient("postgresql", "identity", "SELECT", "SELECT * FROM users WHERE id = $1"))
	usr := sp("user-service", "user.get", tracepb.Span_SPAN_KIND_SERVER, 40, httpServer("GET", "/users/:id", statusFor(fail, 200)), pg)
	if fail {
		markError(pg, "ConnectionPoolExhausted", "timed out acquiring connection from pool",
			"ConnectionPoolExhausted: pool timeout\n  at Pool.acquire (user/db.go:210)")
		usr.attrs = httpServer("GET", "/users/:id", 503)
	}
	gw := sp("api-gateway", "GET /users/:id", tracepb.Span_SPAN_KIND_SERVER, 52, httpServer("GET", "/users/:id", statusFor(fail, 200)), usr)
	root := sp("web-frontend", "GET /account", tracepb.Span_SPAN_KIND_SERVER, 64, httpServer("GET", "/account", statusFor(fail, 200)), gw)
	return root
}

func journeyShipping(fail bool) *node {
	mongo := sp("shipping-service", "find shipments", tracepb.Span_SPAN_KIND_CLIENT, 18, dbClient("mongodb", "logistics", "find", "db.shipments.find({ orderId })"))
	ship := sp("shipping-service", "shipping.track", tracepb.Span_SPAN_KIND_SERVER, 46, httpServer("GET", "/shipping/track", statusFor(fail, 200)), mongo)
	ups := sp("shipping-service", "GET api.ups.com/track", tracepb.Span_SPAN_KIND_CLIENT, 130, extHTTP("GET", "https://api.ups.com/track", "api.ups.com", statusFor(fail, 200)))
	ship.children = append(ship.children, ups)
	if fail {
		markError(ups, "UpstreamTimeout", "ups tracking API timed out",
			"UpstreamTimeout: ups api timeout\n  at UpsClient.track (shipping/ups.go:88)")
		ship.attrs = httpServer("GET", "/shipping/track", 504)
	}
	gw := sp("api-gateway", "GET /shipping/track", tracepb.Span_SPAN_KIND_SERVER, 60, httpServer("GET", "/shipping/track", statusFor(fail, 200)), ship)
	root := sp("web-frontend", "GET /orders/track", tracepb.Span_SPAN_KIND_SERVER, 74, httpServer("GET", "/orders/track", statusFor(fail, 200)), gw)
	return root
}

// journeys with relative weights (checkout is heaviest / most interesting).
var journeys = []struct {
	build   func(bool) *node
	weight  int
	failPct int
}{
	{journeyBrowse, 34, 4},
	{journeyLogin, 20, 6},
	{journeyProfile, 16, 5},
	{journeyCheckout, 20, 9},
	{journeyShipping, 10, 8},
}

func statusFor(fail bool, ok int) int {
	if fail {
		return 500
	}
	return ok
}

func markError(n *node, typ, msg, stack string) {
	n.errored, n.excType, n.excMsg, n.excStack = true, typ, msg, stack
}

// propagate flags an error *status* on every ancestor of a failed span so a
// service's error rate reflects requests that failed downstream — without
// attaching a duplicate exception event (excType stays empty on ancestors).
func propagate(n *node) bool {
	childErr := false
	for _, c := range n.children {
		if propagate(c) {
			childErr = true
		}
	}
	if childErr {
		n.errored = true
	}
	return n.errored
}

// ── Emission ────────────────────────────────────────────────────────────

type placedSpan struct {
	service string
	span    *tracepb.Span
	n       *node
}

func randID(size int) []byte {
	b := make([]byte, size)
	_, _ = rand.Read(b)
	return b
}

// place walks the tree, assigning ids and timing (children fan out with a small
// stagger), appending each span to out. Returns the node's end offset in ms.
func place(n *node, traceID, parentID []byte, baseNano uint64, startMs int64, out *[]placedSpan) int64 {
	id := randID(8)
	end := startMs + n.durMs
	for i, c := range n.children {
		cs := startMs + 2 + int64(i*3)
		ce := place(c, traceID, id, baseNano, cs, out)
		if ce+1 > end {
			end = ce + 1
		}
	}
	s := &tracepb.Span{
		TraceId:           traceID,
		SpanId:            id,
		ParentSpanId:      parentID,
		Name:              n.name,
		Kind:              n.kind,
		StartTimeUnixNano: baseNano + uint64(startMs)*1e6,
		EndTimeUnixNano:   baseNano + uint64(end)*1e6,
		Attributes:        attrKV(n.attrs),
	}
	if n.errored {
		s.Status = &tracepb.Status{Code: tracepb.Status_STATUS_CODE_ERROR, Message: n.excMsg}
	} else {
		s.Status = &tracepb.Status{Code: tracepb.Status_STATUS_CODE_OK}
	}
	// Only spans that actually threw carry an exception event (and thus show up
	// on the Errors page); ancestors merely inherit error *status*.
	if n.excType != "" {
		s.Events = []*tracepb.Span_Event{{
			TimeUnixNano: baseNano + uint64(startMs+n.durMs/2)*1e6,
			Name:         "exception",
			Attributes: attrKV(map[string]any{
				"exception.type": n.excType, "exception.message": n.excMsg, "exception.stacktrace": n.excStack,
			}),
		}}
	}
	*out = append(*out, placedSpan{service: n.service, span: s, n: n})
	return end
}

func attrKV(m map[string]any) []*commonpb.KeyValue {
	out := make([]*commonpb.KeyValue, 0, len(m))
	for k, v := range m {
		out = append(out, &commonpb.KeyValue{Key: k, Value: anyVal(v)})
	}
	return out
}

func anyVal(v any) *commonpb.AnyValue {
	switch t := v.(type) {
	case string:
		return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: t}}
	case int:
		return &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: int64(t)}}
	case int64:
		return &commonpb.AnyValue{Value: &commonpb.AnyValue_IntValue{IntValue: t}}
	case float64:
		return &commonpb.AnyValue{Value: &commonpb.AnyValue_DoubleValue{DoubleValue: t}}
	case bool:
		return &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: t}}
	}
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: fmt.Sprint(v)}}
}

func resourceFor(service, env string) *resourcepb.Resource {
	return &resourcepb.Resource{Attributes: attrKV(map[string]any{
		"service.name":           service,
		"service.version":        versions[service],
		"deployment.environment": env,
		"telemetry.sdk.language": languages[service],
		"host.name":              fmt.Sprintf("%s-%d", service, mrand.Intn(4)+1),
	})}
}

// batch accumulates telemetry for one tick, grouped for efficient export.
type batch struct {
	spans      map[string][]*tracepb.Span // key: service|env
	logs       []*logspb.ResourceLogs
	envOf      map[string]string
	metricReqs *collectorMetrics.ExportMetricsServiceRequest
}

func pickEnv() string {
	total := 0
	for _, e := range environments {
		total += e.weight
	}
	r := mrand.Intn(total)
	for _, e := range environments {
		if r < e.weight {
			return e.name
		}
		r -= e.weight
	}
	return "production"
}

func pickJourney() (func(bool) *node, int) {
	total := 0
	for _, j := range journeys {
		total += j.weight
	}
	r := mrand.Intn(total)
	for _, j := range journeys {
		if r < j.weight {
			return j.build, j.failPct
		}
		r -= j.weight
	}
	return journeys[0].build, journeys[0].failPct
}

func genTraces(tsNano uint64, count int) (*collectorTrace.ExportTraceServiceRequest, *collectorLogs.ExportLogsServiceRequest) {
	type grpKey struct{ service, env string }
	spanGroups := map[grpKey][]*tracepb.Span{}
	logGroups := map[grpKey][]*logspb.LogRecord{}

	for i := 0; i < count; i++ {
		build, failPct := pickJourney()
		fail := mrand.Intn(100) < failPct
		env := pickEnv()
		root := build(fail)
		if fail {
			propagate(root) // error status flows up the call path to the entry service
		}
		traceID := randID(16)

		var placed []placedSpan
		place(root, traceID, nil, tsNano, 0, &placed)
		for _, ps := range placed {
			k := grpKey{ps.service, env}
			spanGroups[k] = append(spanGroups[k], ps.span)

			// Correlated logs: an info line for annotated spans, an error line
			// for every failed span.
			if ps.n.log != "" {
				logGroups[k] = append(logGroups[k], logRecord(ps.span, "info", ps.n.log))
			}
			if ps.n.errored {
				logGroups[k] = append(logGroups[k], logRecord(ps.span, "error",
					fmt.Sprintf("%s: %s", ps.n.excType, ps.n.excMsg)))
			}
		}
	}

	traceReq := &collectorTrace.ExportTraceServiceRequest{}
	for k, spans := range spanGroups {
		traceReq.ResourceSpans = append(traceReq.ResourceSpans, &tracepb.ResourceSpans{
			Resource:   resourceFor(k.service, k.env),
			ScopeSpans: []*tracepb.ScopeSpans{{Scope: scope(k.service), Spans: spans}},
		})
	}
	logReq := &collectorLogs.ExportLogsServiceRequest{}
	for k, recs := range logGroups {
		logReq.ResourceLogs = append(logReq.ResourceLogs, &logspb.ResourceLogs{
			Resource:  resourceFor(k.service, k.env),
			ScopeLogs: []*logspb.ScopeLogs{{Scope: scope(k.service), LogRecords: recs}},
		})
	}
	return traceReq, logReq
}

func scope(service string) *commonpb.InstrumentationScope {
	return &commonpb.InstrumentationScope{Name: "pulse.loadgen/" + service, Version: "1.0.0"}
}

var levelSeverity = map[string]logspb.SeverityNumber{
	"info": logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
	"warn": logspb.SeverityNumber_SEVERITY_NUMBER_WARN,
	"error": logspb.SeverityNumber_SEVERITY_NUMBER_ERROR,
}

func logRecord(s *tracepb.Span, level, msg string) *logspb.LogRecord {
	return &logspb.LogRecord{
		TimeUnixNano:   s.StartTimeUnixNano,
		SeverityNumber: levelSeverity[level],
		SeverityText:   level,
		Body:           anyVal(msg),
		TraceId:        s.TraceId,
		SpanId:         s.SpanId,
		Attributes:     attrKV(map[string]any{"span.name": s.Name}),
	}
}

// genMetrics emits per-service resource utilization and request metrics with a
// time-varying shape so charts have movement.
func genMetrics(tsNano uint64, tsMin float64) *collectorMetrics.ExportMetricsServiceRequest {
	req := &collectorMetrics.ExportMetricsServiceRequest{}
	i := 0
	for service := range languages {
		i++
		phase := float64(i)
		env := "production"
		cpu := clamp(40+22*math.Sin(tsMin/9+phase)+float64(mrand.Intn(8)), 2, 99)
		mem := clamp(55+15*math.Sin(tsMin/17+phase)+float64(mrand.Intn(6)), 5, 97)
		rps := clamp(120+90*math.Sin(tsMin/11+phase)+float64(mrand.Intn(30)), 1, 9999)
		dur := clamp(60+40*math.Sin(tsMin/7+phase)+float64(mrand.Intn(25)), 3, 9999)

		metrics := []*metricspb.Metric{
			gaugeMetric("system.cpu.utilization", "%", cpu, tsNano, nil),
			gaugeMetric("system.memory.utilization", "%", mem, tsNano, nil),
			sumMetric("http.server.request.count", "{request}", rps, tsNano, map[string]any{"http.request.method": "GET"}),
			histMetric("http.server.request.duration", "ms", dur, uint64(rps), tsNano),
		}
		req.ResourceMetrics = append(req.ResourceMetrics, &metricspb.ResourceMetrics{
			Resource:     resourceFor(service, env),
			ScopeMetrics: []*metricspb.ScopeMetrics{{Scope: scope(service), Metrics: metrics}},
		})
	}
	return req
}

func gaugeMetric(name, unit string, v float64, ts uint64, attrs map[string]any) *metricspb.Metric {
	return &metricspb.Metric{Name: name, Unit: unit, Data: &metricspb.Metric_Gauge{Gauge: &metricspb.Gauge{
		DataPoints: []*metricspb.NumberDataPoint{{TimeUnixNano: ts, Value: &metricspb.NumberDataPoint_AsDouble{AsDouble: v}, Attributes: attrKV(attrs)}},
	}}}
}

func sumMetric(name, unit string, v float64, ts uint64, attrs map[string]any) *metricspb.Metric {
	return &metricspb.Metric{Name: name, Unit: unit, Data: &metricspb.Metric_Sum{Sum: &metricspb.Sum{
		IsMonotonic:            true,
		AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA,
		DataPoints:             []*metricspb.NumberDataPoint{{TimeUnixNano: ts, Value: &metricspb.NumberDataPoint_AsDouble{AsDouble: v}, Attributes: attrKV(attrs)}},
	}}}
}

func histMetric(name, unit string, sum float64, count uint64, ts uint64) *metricspb.Metric {
	s := sum
	return &metricspb.Metric{Name: name, Unit: unit, Data: &metricspb.Metric_Histogram{Histogram: &metricspb.Histogram{
		AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA,
		DataPoints:             []*metricspb.HistogramDataPoint{{TimeUnixNano: ts, Count: count, Sum: &s}},
	}}}
}

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

// ── HTTP ────────────────────────────────────────────────────────────────

func post(path string, msg proto.Message) {
	body, err := proto.Marshal(msg)
	if err != nil {
		log.Printf("marshal %s: %v", path, err)
		return
	}
	req, _ := http.NewRequest("POST", *addr+path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("post %s: %v", path, err)
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("post %s -> %d", path, resp.StatusCode)
	}
}

func emit(tsNano uint64, tsMin float64, traceCount int) {
	traceReq, logReq := genTraces(tsNano, traceCount)
	post("/v1/traces", traceReq)
	if len(logReq.ResourceLogs) > 0 {
		post("/v1/logs", logReq)
	}
	post("/v1/metrics", genMetrics(tsNano, tsMin))
}

func main() {
	flag.Parse()
	log.SetFlags(log.Ltime)
	log.Printf("loadgen → %s  (backfill %dm, interval %ds)", *addr, *backfill, *interval)

	// Backfill history in 30s steps so time-range charts are populated at once.
	now := time.Now()
	step := 30 * time.Second
	steps := (*backfill * 60) / 30
	for i := steps; i > 0; i-- {
		t := now.Add(-time.Duration(i) * step)
		emit(uint64(t.UnixNano()), float64(t.Unix())/60.0, 5+mrand.Intn(4))
	}
	log.Printf("backfilled %d steps (~%dm)", steps, *backfill)

	if *once {
		return
	}

	// Live stream.
	tick := time.NewTicker(time.Duration(*interval) * time.Second)
	defer tick.Stop()
	for t := range tick.C {
		emit(uint64(t.UnixNano()), float64(t.Unix())/60.0, 2+mrand.Intn(4))
	}
}
