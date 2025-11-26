import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { CHARACTERS, MODELS } from '@/app/lib/constants';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Helper: Format conversation history as readable log
function formatConversationLog(messages: any[], characters: typeof CHARACTERS): string {
    return messages
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map((msg) => {
            if (msg.role === 'user') {
                return `[주제] ${msg.content}`;
            }
            const char = characters.find(c => c.id === msg.characterId);
            const name = char ? char.name : (msg.isModerator ? '사회자' : '???');
            return `${name}: "${msg.content}"`;
        })
        .join('\n');
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, characterId, modelId } = body;

        const character = CHARACTERS.find((c) => c.id === characterId);
        const modelInfo = MODELS.find((m) => m.id === modelId);

        if (!character || !modelInfo) {
            return new Response('Invalid character or model', { status: 400 });
        }

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

        // Filter out empty messages
        const filteredMessages = messages.filter((msg: any) => msg.content && msg.content.trim() !== '');
        
        // Build full conversation log
        const conversationLog = formatConversationLog(filteredMessages, CHARACTERS);
        
        // Find the last valid assistant message
        const lastAssistantMsg = [...filteredMessages].reverse().find((m: any) => m.role === 'assistant' && m.content);
        const lastSpeaker = lastAssistantMsg 
            ? CHARACTERS.find(c => c.id === lastAssistantMsg.characterId)?.name || '앞사람'
            : null;
        
        // Build simple context prompt - 캐릭터 성격에 집중!
        let contextPrompt = `
=== 지금까지의 대화 ===
${conversationLog}
=== 대화 끝 ===

`;
        
        if (lastSpeaker && lastAssistantMsg) {
            contextPrompt += `방금 ${lastSpeaker}가 "${lastAssistantMsg.content.slice(0, 80)}${lastAssistantMsg.content.length > 80 ? '...' : ''}"라고 했어.\n\n`;
        }
        
        contextPrompt += `이제 네 차례야. 네 캐릭터(${character.name})답게 반응해!
- 앞사람 말에 먼저 반응하고
- 네 성격대로 말해
- 2-3문장으로 짧게!`;

        // Create the message array for the AI
        const aiMessages = [
            {
                role: 'user' as const,
                content: contextPrompt
            }
        ];

        const result = await streamText({
            model,
            system: character.systemPrompt,
            messages: aiMessages,
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('Chat API Error:', error);
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
