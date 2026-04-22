import { streamText } from 'hono/streaming';

/**
 * AiStreamingService
 * 统一处理不同提供商的流式输出，确保前端接收到的 SSE 格式一致且安全。
 */
export class AiStreamingService {
  /**
   * 将 Provider 的原始流转换为归一化的 SSE 流
   * 使用 TransformStream API 保证在 Cloudflare Workers 中的最佳性能
   */
  static transformStream(source: ReadableStream, provider: 'openai' | 'workers-ai'): ReadableStream {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transform = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });

        if (provider === 'openai') {
          // OpenAI 固有格式就是 data: {...}\n\n
          // 我们只需要过滤 [DONE] 标识，防止前端解析异常
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.includes('data: [DONE]')) continue;
            if (line.trim()) {
              controller.enqueue(encoder.encode(line + '\n\n'));
            }
          }
        } else if (provider === 'workers-ai') {
          // Workers AI 输出通常是逐行 JSON 块: {"response": "..."}
          // 需要封装成 OpenAI 兼容的 data: {"choices":[{"delta":{"content":"..."}}]}
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const content = parsed.response || '';
              if (content) {
                const sseData = {
                  choices: [{ delta: { content } }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseData)}\n\n`));
              }
            } catch (e) {
              // 忽略非 JSON 行或断句中的残片
              console.warn('[AiStreamingService] JSON parse error on Workers AI line:', line);
            }
          }
        }
      },
      flush(controller) {
        // 执行流结束后的清理（如发送自定义结束符或埋点数据）
      }
    });

    return source.pipeThrough(transform);
  }
}
