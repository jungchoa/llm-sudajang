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
        .map((msg, idx) => {
            if (msg.role === 'user') {
                return `[주제] ${msg.content}`;
            }
            const char = characters.find(c => c.id === msg.characterId);
            const name = char ? char.name : (msg.isModerator ? '사회자' : '???');
            return `[${idx}턴] ${name}: "${msg.content}"`;
        })
        .join('\n');
}

// Helper: Extract key topics mentioned so far
function extractKeyTopics(messages: any[]): string[] {
    const topics: string[] = [];
    const keywords = ['창의력', '위험', '일자리', '윤리', '통제', '감정', '공감', '효율', '대체', '협력', '경쟁', '교육', '미래', '기회', '위기'];
    
    messages.forEach(msg => {
        if (msg.content) {
            keywords.forEach(kw => {
                if (msg.content.includes(kw) && !topics.includes(kw)) {
                    topics.push(kw);
                }
            });
        }
    });
    
    return topics.slice(0, 5); // Max 5 keywords
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, characterId, modelId, turnIndex } = body;

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
        const keyTopics = extractKeyTopics(filteredMessages);
        
        // Find the last valid assistant message
        const lastAssistantMsg = [...filteredMessages].reverse().find((m: any) => m.role === 'assistant' && m.content);
        const lastSpeaker = lastAssistantMsg 
            ? CHARACTERS.find(c => c.id === lastAssistantMsg.characterId)?.name || '이전 발언자'
            : null;
        
        // Build context injection prompt
        let contextPrompt = `
=== 현재까지의 전체 대화 기록 ===
${conversationLog}
=== 대화 기록 끝 ===

`;
        
        if (keyTopics.length > 0) {
            contextPrompt += `**지금까지 언급된 키워드:** ${keyTopics.join(', ')}\n\n`;
        }
        
        if (lastSpeaker && lastAssistantMsg) {
            contextPrompt += `**직전 발언:** ${lastSpeaker}가 "${lastAssistantMsg.content.slice(0, 100)}${lastAssistantMsg.content.length > 100 ? '...' : ''}"라고 말했습니다.\n\n`;
        }
        
        contextPrompt += `**지시사항:**
1. 위의 전체 대화 기록을 읽고 흐름을 파악하세요.
2. ${lastSpeaker ? `직전 발언자(${lastSpeaker})의 말에 먼저 반응하세요.` : '주제에 대해 첫 발언을 하세요.'}
3. 가능하다면 토론 초반에 나왔던 다른 사람의 의견도 끌어와서 비교하거나 연결하세요.
4. 이미 누군가 했던 말을 똑같이 반복하지 마세요. 새로운 관점을 제시하세요.
5. 당신의 캐릭터(${character.name})답게 답변하세요.`;

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
