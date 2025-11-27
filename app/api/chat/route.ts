import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { CHARACTERS, MODELS } from '@/app/lib/constants';

export const maxDuration = 30;

function formatConversationLog(messages: any[], characters: typeof CHARACTERS): string {
    return messages
        .filter(msg => msg.content && msg.content.trim() !== '' && msg.role === 'assistant')
        .map((msg) => {
            const char = characters.find(c => c.id === msg.characterId);
            const name = char ? char.name : '???';
            return `${name}: "${msg.content}"`;
        })
        .join('\n');
}

function extractMainTopic(messages: any[]): string {
    const userMsg = messages.find(msg => msg.role === 'user');
    return userMsg?.content || '주제 없음';
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

        const filteredMessages = messages.filter((msg: any) => msg.content && msg.content.trim() !== '');
        const mainTopic = extractMainTopic(filteredMessages);
        const conversationLog = formatConversationLog(filteredMessages, CHARACTERS);
        
        const lastAssistantMsg = [...filteredMessages].reverse().find((m: any) => m.role === 'assistant' && m.content);
        const lastSpeaker = lastAssistantMsg 
            ? CHARACTERS.find(c => c.id === lastAssistantMsg.characterId)?.name || '앞사람'
            : null;
        
        let contextPrompt = `
[1. 메인 주제 - 절대 잊지 말 것!]
"${mainTopic}"
-> 모든 답변은 이 주제와 연결되어야 함

[2. 지금까지의 대화]
${conversationLog || '(첫 발언)'}
`;

        if (lastSpeaker && lastAssistantMsg) {
            contextPrompt += `
[3. 직전 발언]
${lastSpeaker}: "${lastAssistantMsg.content}"
`;
        }

        contextPrompt += `
[4. 네가 할 일 - ${character.name}]

답변 전 생각해:
- 직전 발언이 메인 주제(${mainTopic})와 어떻게 연결되지?
- 내 캐릭터로서 어떤 새로운 관점을 줄 수 있지?
- 이전에 나온 말 반복하고 있진 않지?

규칙:
- 직전 발언에 반응 + 메인 주제 관점에서 재해석
- 앞사람 말꼬리만 잡지 말고, 주제에 대한 더 깊은 통찰을 던져
- 이전 표현/논점 반복 금지. 매번 새로운 각도로!
- 2-3문장으로 짧게!`;

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
