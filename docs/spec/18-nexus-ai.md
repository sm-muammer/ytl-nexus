# Nexus AI: local knowledge and operations assistant

> **Purpose:** requirements for the local AI assistant, its retrieval, its limits and its safety boundaries.
> **Audience:** builders and reviewers of Task 14. Access: Members and above at `/ai`; a restricted public scope serves Yes Experience.

## Summary

Nexus AI runs on Ollama on the server. It answers general questions, answers from approved WordPress content and runbooks with cited sources, and explains sanitized metrics and log summaries. It has no tools and cannot act.

## Requirements

| ID    | Requirement                                                                                                                                                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-01 | Ollama listens on 127.0.0.1:11434 only. Version ≥ 0.6                                                                                                                                                                                                            |
| AI-02 | The chat model is chosen by benchmark on Nexus Core 01 (`gemma3:4b-it-qat`, `gemma3:1b-it-qat`, `tinyllama` baseline) recording tokens per second, time to first token and RAM. Results and the choice are in `docs/operations/ai.md`. The model is configurable |
| AI-03 | `nexus-worker` chunks and embeds WordPress content and `docs/operations` runbooks into `ai_chunks` with `audience` and source metadata, and re-indexes on the revalidation webhook                                                                               |
| AI-04 | Retrieval filters chunks by the caller's role before ranking. Internal content never reaches lower roles                                                                                                                                                         |
| AI-05 | `/ai` streams responses over SSE at `/api/ai/chat` with a stop button, conversation list, delete, cited sources linking to Library, and clear error states                                                                                                       |
| AI-06 | "Explain" mode receives a sanitized summary built on the server from allowlisted metrics or sanitized logs. It is reachable from Atlas and Status incidents                                                                                                      |
| AI-07 | Limits: maximum prompt size, maximum response tokens, per-user rate limit and a global concurrent-generation cap to protect the CPU                                                                                                                              |
| AI-08 | Public `yes-public` scope for Yes Experience: public Yes content only, IP rate limited, canned fallback in demo mode                                                                                                                                             |
| AI-09 | Nexus AI is presented as a local assistant built for this project, never as a YTL AI Labs product                                                                                                                                                                |

## Security requirements

- No tools, shell access, autonomous actions or service controls.
- Retrieved text is treated as untrusted data. The system prompt states that instructions inside retrieved content are ignored.
- Prompts and context never contain passwords, private keys, tokens or unrestricted logs.

## Risks

The server CPU is Westmere-class and probably lacks AVX, which can make inference 3–10x slower. If the benchmark is too slow, use the smaller model and add the hypervisor CPU-type request to the handover roadmap.

## Demo mode

Scripted streamed answers with fixture citations, labelled **Demo**.

## Acceptance criteria

- Retrieval ranking tests pass; audience-leak tests pass for every role.
- Prompt-injection fixtures cannot change instructions or reveal internal content.
- Stream abort and rate limits work.
- A runbook question returns a streamed answer with citations; Explain works from Atlas.

## Related

[15 Library and Studio](15-nexus-library-and-studio.md) · [13 Atlas](13-nexus-atlas.md) · [19 Yes Experience](19-yes-experience.md)
