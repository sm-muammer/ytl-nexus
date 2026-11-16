# Nexus AI: local operations and knowledge assistant

> **Purpose:** operation, benchmarks, and maintenance of the local Ollama AI assistant on Nexus Core 01.
> **Audience:** system administrators, platform developers, and infrastructure operators.

## Architecture & Configuration

Nexus AI runs locally on Nexus Core 01 (`sn1lyvx1d0002.ytlcomms.my`) via Ollama bound strictly to `127.0.0.1:11434`. It operates with strict local containment:

- **No external AI API calls:** All inference and embeddings remain entirely on-box.
- **No autonomous actions:** The assistant possesses no tools, no shell execution, and no service manipulation rights.
- **Untrusted Context Guardrails:** Retrieved runbooks and documents are wrapped in `<context>` blocks and treated as untrusted input to defend against prompt injection.
- **Audience Isolation:** Chunks in `ai_chunks` are gated against caller role hierarchy (`public`, `viewer`, `member`, `operator`, `admin`) before ranking. Lower roles never receive internal context.

### Environment Variables

Configured in `/etc/ytl-nexus/web.env` and `.env.local`:

| Variable                   | Default            | Description                                   |
| -------------------------- | ------------------ | --------------------------------------------- |
| `NEXUS_OLLAMA_HOST`        | `127.0.0.1`        | Loopback address for Ollama service           |
| `NEXUS_OLLAMA_PORT`        | `11434`            | Ollama HTTP API listening port                |
| `NEXUS_OLLAMA_CHAT_MODEL`  | `gemma3:1b-it-qat` | Primary chat completion model                 |
| `NEXUS_OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Dense vector embedding model (768 dimensions) |

## Hardware Benchmark (Nexus Core 01)

Benchmarks conducted on 2026-11-16 directly on the target virtualized host:

- **Host:** Nexus Core 01 (Rocky Linux 9.7)
- **CPU:** 8 vCPUs, Intel Xeon (Westmere E56xx/L56xx/X56xx virtualized model)
- **CPU Flags:** SSE, SSE2, SSSE3, SSE4_1, SSE4_2, AES, POPCNT (**AVX / AVX2 not exposed by hypervisor**)
- **RAM:** 15 GiB total, ~8.8 GiB available

### Comparative Benchmark Results

| Model              | Size   | Warm TTFT | Eval Rate (tok/s) | Resident RAM | Quality & Viability Assessment                                                                  |
| ------------------ | ------ | --------- | ----------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `tinyllama:latest` | 637 MB | 0.71 s    | 13.5 tok/s        | ~1.2 GB      | Fast, but hallucinates code and lacks reasoning depth. Used as baseline.                        |
| `gemma3:1b-it-qat` | 1.0 GB | 0.52 s    | **8.35 tok/s**    | ~1.8 GB      | **Selected primary model.** Excellent reasoning, prompt adherence, highly responsive streaming. |
| `gemma3:4b-it-qat` | 3.2 GB | 1.85 s    | 2.91 tok/s        | ~4.5 GB      | Capable, but noticeably sluggish on Westmere CPU without AVX/AVX2.                              |
| `nomic-embed-text` | 274 MB | 0.05 s    | 1.95 s / doc      | ~450 MB      | Standard 768-dim embeddings; high cosine semantic separation for runbooks.                      |

### Model Selection & Recommendation

`gemma3:1b-it-qat` is chosen as the standard chat model for YTL Nexus. At **8.35 tokens/second** and **0.52s time to first token**, it provides smooth interactive streaming while fitting comfortably inside system RAM.

> [!NOTE]
> **Hypervisor Roadmap Recommendation:** If the hypervisor CPU model is upgraded in the future from legacy Westmere to `host-passthrough` (or a Skylake/Ice Lake/Sapphire Rapids profile enabling AVX2/AVX-512), inference speeds will improve 3–5x, making `gemma3:4b-it-qat` or larger models feasible at >15 tok/s.

## Background Worker & Chunk Indexing

- Runbooks in `docs/operations/*.md` are indexed by `nexus-worker` into table `ai_chunks`.
- Headless WordPress posts re-index automatically on revalidation webhooks.
- Text embeddings are serialized as binary Float32 blobs and stored in `ai_chunks.embedding`.
- Real-time similarity ranking uses dot-product cosine similarity against normalized query vectors.
