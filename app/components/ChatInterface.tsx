'use client';

import { useEffect, useRef } from 'react';
import { CHARACTERS, MODELS } from '@/app/lib/constants';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    characterId?: string;
    modelId?: string;
    isModerator?: boolean;
    isMidSummary?: boolean;
}

interface ChatInterfaceProps {
    messages: Message[];
    isStreaming: boolean;
    isFinished?: boolean;
    onReset?: () => void;
}

export default function ChatInterface({ messages, isStreaming, isFinished, onReset }: ChatInterfaceProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isStreaming]);

    // Extract topic from the first user message
    const topicMessage = messages.find(m => m.role === 'user');
    const topic = topicMessage ? topicMessage.content : '';

    return (
        <div className="chat-screen">
            {/* Sticky Header with Topic */}
            <header className="chat-header">
                <div className="chat-header-content">
                    <div className="chat-header-row">
                        <div className="topic-badge">
                            <span className="topic-label">주제:</span>
                            <span className="topic-text">{topic}</span>
                        </div>
                        {onReset && (
                            <button onClick={onReset} className="home-button">
                                🏠 새 토론
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Messages Container */}
            <div className="chat-messages">
                <div className="chat-messages-inner">
                    {messages.map((msg, index) => {
                        // Skip system and user messages (topic shown in header)
                        if (msg.role === 'system' || msg.role === 'user') return null;

                        const character = CHARACTERS.find((c) => c.id === msg.characterId);
                        const model = MODELS.find((m) => m.id === msg.modelId);
                        const isModerator = msg.isModerator;
                        const isMidSummary = (msg as any).isMidSummary;

                        // Mid-summary message (중간 정리)
                        if (isMidSummary) {
                            return (
                                <div key={index} className="mid-summary-card">
                                    <div className="mid-summary-header">
                                        <span className="mid-summary-icon">⚡</span>
                                        <span className="mid-summary-title">중간 정리</span>
                                    </div>
                                    <div className="mid-summary-bubble">
                                        {msg.content || '정리 중...'}
                                    </div>
                                </div>
                            );
                        }

                        // Final moderator message
                        if (isModerator) {
                            return (
                                <div key={index} className="moderator-card">
                                    <div className="moderator-header">
                                        <span className="moderator-title">📋 사회자의 정리</span>
                                        <span className="moderator-badge">
                                            {model?.name || 'AI'}
                                        </span>
                                    </div>
                                    <div className="moderator-bubble">
                                        {msg.content || '분석 중...'}
                                    </div>
                                </div>
                            );
                        }

                        // If no character found, skip
                        if (!character) return null;

                        // Character message
                        return (
                            <div 
                                key={index} 
                                className="message-card"
                                data-character={msg.characterId}
                            >
                                <div className="message-header">
                                    <span className="message-avatar">{character?.emoji}</span>
                                    <span className="message-name">{character?.name}</span>
                                    <span className="message-model-badge">{model?.name}</span>
                                </div>
                                <div className="message-bubble">
                                    {msg.content || '생각 중...'}
                                </div>
                            </div>
                        );
                    })}

                    {/* Streaming Indicator */}
                    {isStreaming && (
                        <div className="streaming-indicator">
                            <div className="streaming-dots">
                                <span className="streaming-dot" />
                                <span className="streaming-dot" />
                                <span className="streaming-dot" />
                            </div>
                        </div>
                    )}

                    {/* Finished - Show large reset button */}
                    {isFinished && !isStreaming && onReset && (
                        <div className="finish-actions">
                            <button onClick={onReset} className="btn-restart">
                                🔄 새로운 주제로 토론하기
                            </button>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
    );
}
