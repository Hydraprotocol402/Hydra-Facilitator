# Testing Alerts in Production

This guide explains how to safely trigger production alerts for testing without security issues.

## Security Features

All test endpoints are **protected by API key authentication** to prevent unauthorized access:

- Requires `X-API-Key` header
- API key configured via `ALERT_TEST_API_KEY` environment variable
- If no API key is set, endpoints return `401 Unauthorized`
- Test endpoints are rate-limited by existing throttling

## Setup

1. **Generate a secure API key:**
   ```bash
   # Generate a random 32-character API key
   openssl rand -hex 16
   ```

2. **Add to Coolify environment variables:**
   - Variable: `ALERT_TEST_API_KEY`
   - Value: Your generated API key (e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

3. **Redeploy** the NestJS application

## Test Endpoints

All endpoints require the `X-API-Key` header:

### 1. Test Error Rate Alert

Triggers error metrics to test `HighErrorRate` alert (threshold: 1% error rate for 5 minutes).

```bash
# Single error (won't trigger alert immediately, need multiple)
curl -H "X-API-Key: your-api-key" \
  https://api.hydraprotocol.org/health/test/error

# To trigger alert, call multiple times (need >1% error rate for 5 min)
# Or use a loop:
for i in {1..50}; do
  curl -H "X-API-Key: your-api-key" \
    https://api.hydraprotocol.org/health/test/error
  sleep 1
done
```

**What happens:**
- Returns `500 Internal Server Error`
- Records error metrics with route `/health/test/error`
- After multiple calls (>1% error rate for 5 min), triggers `HighErrorRate` alert
- Alert will show: Service: `hydra-x402-facilitator`, Route: `/health/test/error`

### 2. Test Slow Response Time Alert

Triggers slow response metrics to test `SlowResponseTime` alert (threshold: P95 > 1s for 5 minutes).

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.hydraprotocol.org/health/test/slow
```

**What happens:**
- Returns after 2 seconds
- Records response time metrics with route `/health/test/slow`
- After multiple calls (P95 > 1s for 5 min), triggers `SlowResponseTime` alert
- Alert will show: Service: `hydra-x402-facilitator`, Route: `/health/test/slow`, Method: `GET`

### 3. Test Endpoints Info

Get information about test endpoints:

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.hydraprotocol.org/health/test/metrics
```

## Production Alert Examples

When alerts trigger, you'll see real production data in Discord:

**HighErrorRate Alert:**
```
🔥 FIRING: HighErrorRate
Service: hydra-x402-facilitator
Route: /health/test/error
Status Code: 500
```

**SlowResponseTime Alert:**
```
🔥 FIRING: SlowResponseTime
Service: hydra-x402-facilitator
Route: /health/test/slow
Method: GET
```

## Security Notes

✅ **Safe for production:**
- API key protection prevents unauthorized access
- Rate limiting prevents abuse
- Endpoints only generate metrics, no data exposure
- Error messages are generic (no sensitive info)

✅ **Best practices:**
- Use a strong, randomly generated API key
- Rotate the API key periodically
- Only share the API key with trusted team members
- Consider restricting access by IP if needed (via reverse proxy/firewall)

⚠️ **Important:**
- Test endpoints are real endpoints that generate real metrics
- Multiple rapid calls can trigger rate limiting
- Alert thresholds are real (5 minutes duration)
- Use these endpoints sparingly in production

## Troubleshooting

**401 Unauthorized:**
- Check `ALERT_TEST_API_KEY` is set in environment variables
- Verify API key matches the `X-API-Key` header value
- Redeploy after adding environment variable

**Rate Limited:**
- Wait a few seconds between calls
- Reduce number of requests

**Alert not triggering:**
- Alerts need to meet threshold for the full duration (see `alerts.yml`)
- Error rate needs >1% for 5 minutes
- Slow response needs P95 >1s for 5 minutes
- Check Prometheus metrics to verify data is being collected

