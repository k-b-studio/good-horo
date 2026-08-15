# API ThaiLLM Playground
`https://playground.thaillm.or.th/`

## How to Use
- Use your API key to make requests to the ThaiLLM API. Both call styles below are fully supported.
- Authentication accepts either Authorization: Bearer <key> (OpenAI-standard, shown in the examples) 
or apikey: <key> (legacy). Existing integrations using the apikey header continue to work unchanged.

## Available Models:
- OpenThaiGPT-ThaiLLM-8B-Instruct-v7.2 (shorthand: openthaigpt) by AIEAT
- Pathumma-ThaiLLM-qwen3-8b-think-3.0.0 (shorthand: pathumma) by NECTEC
- Typhoon-S-ThaiLLM-8B-Instruct (shorthand: typhoon) by SCB 10X
- THaLLE-0.2-ThaiLLM-8B-fa (shorthand: thalle or kbtg) by KBTG

## New (OpenAI-compatible) — recommended
Single endpoint. Pick the model by name in the request body — shorthand (e.g. openthaigpt) or full name (e.g. OpenThaiGPT-ThaiLLM-8B-Instruct-v7.2, case-insensitive).

```
curl http://thaillm.or.th/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $THAILLM_API_KEY" \
  -d '{
    "model": "openthaigpt",
    "messages": [
      {"role": "user", "content": "สวัสดี"}
    ],
    "max_tokens": 2048
  }'
```

## Legacy (path-based) — still supported
The model name is part of the URL path and "model" in the body is set to "/model". Existing integrations will keep working unchanged.

```
curl http://thaillm.or.th/api/openthaigpt/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $THAILLM_API_KEY" \
  -d '{
    "model": "/model",
    "messages": [
      {"role": "user", "content": "สวัสดี"}
    ],
    "max_tokens": 2048
  }'
```
List available models: GET http://thaillm.or.th/api/v1/models

## Rate Limits
- 5 requests per second
- 200 requests per minute

## Key storage
The live key is **not** stored in this file. It lives in `.env.local`
(gitignored) as `THAILLM_API_KEY`, and in Vercel project env vars for deploys.
