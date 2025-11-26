import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { MODERATOR_SYSTEM_PROMPT, MODELS, CHARACTERS } from '@/app/lib/constants';

export const maxDuration = 60;

// Helper: Format conversation history
function formatConversationLog(messages: any[]): string {
    return messages
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map((msg) => {
            if (msg.role === 'user') {
                return `[주제] ${msg.content}`;
            }
            const char = CHARACTERS.find(c => c.id === msg.characterId);
            const name = char ? char.name : '???';
            return `${name}: "${msg.content}"`;
        })
        .join('\n');
}

export async function POST(req: Request) {
    try {
        const { messages, modelId } = await req.json();

        const modelInfo = MODELS.find((m) => m.id === modelId) || MODELS[0];

        let model;
        switch (modelInfo.provider) {
            case 'openai':
                model = openai(modelInfo.id);
                break;
            case 'anthropic':
                model = anthropic(modelInfo.id);
                break;
            case 'google':
                model = google(modelInfo.id);
                break;
            default:
                model = openai('gpt-4o');
        }

        // Format conversation as a single user message
        const conversationLog = formatConversationLog(messages);
        
        const contextPrompt = `아래는 방금 끝난 수다 내용이야. 사회자로서 정리해줘!

=== 수다 기록 ===
${conversationLog}
=== 수다 끝 ===

위 형식대로 MVP 선정하고 한줄평 + 결론 내려줘!`;

        const result = await streamText({
            model,
            system: MODERATOR_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: contextPrompt
                }
            ],
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('Moderator API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
