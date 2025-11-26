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
        
        // Turn-specific instructions based on 기승전결 (6턴 구조)
        const turnRoles = [
            '기(起) - 토론의 시작: 주제를 희망적으로 열고 핵심 키워드를 제시하세요.',
            '승(承) - 반박 시작: 유토의 주장을 정면 반박하며 긴장감을 시작하세요.',
            '승(承) - 관전 & 드립: 양측 싸움을 구경하며 가볍게 드립을 치세요.',
            '전(轉) - 재반박: 디스토의 공격에 맞서 새로운 논리로 반격하세요.',
            '전(轉) - 최고조 공격: 가장 강력한 팩트로 상대를 압박하세요.',
            '전(轉) - 클라이맥스 반전: 양측을 모두 정리하고 예상 못한 반전을 던지세요.'
        ];
        const currentRole = turnRoles[turnIndex] || '';

        contextPrompt += `**현재 턴: ${turnIndex + 1}턴 (${currentRole})**

**지시사항:**
1. 위의 전체 대화 기록을 읽고 흐름을 파악하세요.
2. ${lastSpeaker ? `직전 발언자(${lastSpeaker})의 말을 직접 인용하며 반응하세요.` : '주제에 대해 첫 발언을 하세요.'}
3. 이전 발언자들이 언급한 키워드를 활용해서 연결하세요.
4. 이미 나온 말을 반복하지 말고 새로운 관점을 제시하세요.
5. 당신의 역할(${character.name}, ${currentRole})에 맞게 답변하세요.`;

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
