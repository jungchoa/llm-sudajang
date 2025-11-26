import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { MID_SUMMARY_PROMPT, CHARACTERS } from '@/app/lib/constants';

export const maxDuration = 30;

function formatConversationLog(messages: any[]): string {
    return messages
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map((msg, idx) => {
            if (msg.role === 'user') {
                return `[주제] ${msg.content}`;
            }
            const char = CHARACTERS.find(c => c.id === msg.characterId);
            const name = char ? char.name : (msg.isModerator ? '사회자' : '???');
            return `[${idx}턴] ${name}: "${msg.content}"`;
        })
        .join('\n');
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // Filter out empty messages
        const filteredMessages = messages
            .filter((msg: any) => msg.content && msg.content.trim() !== '');

        const conversationLog = formatConversationLog(filteredMessages);

        const result = await streamText({
            model: openai('gpt-4o'), // Use GPT-4o for summaries (fast & reliable)
            system: MID_SUMMARY_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `지금까지의 대화입니다:\n\n${conversationLog}\n\n중간 정리를 해주세요.`
                }
            ],
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('Summary API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

