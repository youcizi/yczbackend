import { describe, it, expect } from 'vitest';
import { AiStreamingService } from '../../services/AiStreamingService';

// 辅助函数：将模拟的 Chunk 数组转换为 ReadableStream
function createMockProviderStream(chunks: string[]): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

// 辅助函数：消费流并转换为文本
async function consumeStreamToText(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

describe('AiStreamingService - SSE 转发与转换', () => {
  
  it('应当正确透传并在末尾补全 OpenAI 风格的 SSE 分块', async () => {
    const mockChunks = [
      'data: {"id":"1","choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"id":"2","choices":[{"delta":{"content":" World"}}]}\n',
      'data: [DONE]\n'
    ];
    const sourceStream = createMockProviderStream(mockChunks);

    const transformedStream = AiStreamingService.transformStream(sourceStream, 'openai');
    const finalResult = await consumeStreamToText(transformedStream);

    // 验证内容合并，并确保 [DONE] 被过滤或跳过（当前实现是跳过）
    expect(finalResult).toContain('Hello');
    expect(finalResult).toContain('World');
    expect(finalResult).not.toContain('[DONE]');
    // 验证格式对齐
    expect(finalResult).toContain('data: {"id":"1"');
  });

  it('应当将 Workers AI 的原始 JSON 转换为 OpenAI 兼容的 SSE 格式', async () => {
    const mockChunks = [
      '{"response":"你好"}\n',
      '{"response":"世界"}'
    ];
    const sourceStream = createMockProviderStream(mockChunks);

    const transformedStream = AiStreamingService.transformStream(sourceStream, 'workers-ai');
    const finalResult = await consumeStreamToText(transformedStream);

    // 验证格式转换
    expect(finalResult).toContain('data: {"choices":[{"delta":{"content":"你好"}}]}');
    expect(finalResult).toContain('data: {"choices":[{"delta":{"content":"世界"}}]}');
  });

});
