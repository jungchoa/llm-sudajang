'use client';

import { useState, useRef } from 'react';
import { CHARACTERS, MODELS } from '@/app/lib/constants';
import SlotMachine from '@/app/components/SlotMachine';
import ChatInterface from '@/app/components/ChatInterface';


type GameState = 'start' | 'slot' | 'chat' | 'result';

interface Match {
  characterId: string;
  modelId: string;
}

// Configuration
const TOTAL_TURNS = 9; // 3 rounds of 3 characters each
const MID_SUMMARY_AFTER_TURN = 6; // Insert mid-summary after turn 6 (2 full rounds)

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [topic, setTopic] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);

  const isProcessingTurn = useRef(false);

  const handleStart = () => {
    if (!topic.trim()) return;
    setGameState('slot');
  };

  const handleSlotComplete = (results: Match[]) => {
    setMatches(results);
    setGameState('chat');
    const initialMessages = [{ role: 'user', content: topic }];
    setMessages(initialMessages);

    setTimeout(() => processTurn(0, initialMessages, results), 1000);
  };

  // Mid-summary function (사회자 중간 개입)
  const processMidSummary = async (currentMessages: any[], currentMatches: Match[], nextTurnIndex: number) => {
    setIsStreaming(true);

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) throw new Error('Failed to fetch summary');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', isMidSummary: true }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        content += chunk;

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: 'assistant',
            content: content,
            isMidSummary: true
          };
          return newMsgs;
        });
      }

      setIsStreaming(false);

      const updatedMessages = [...currentMessages, {
        role: 'assistant',
        content: content,
        isMidSummary: true
      }];

      // Continue with next turn after summary
      setTimeout(() => processTurn(nextTurnIndex, updatedMessages, currentMatches), 1500);

    } catch (error) {
      console.error('Error in processMidSummary:', error);
      setIsStreaming(false);
      // Continue anyway
      setTimeout(() => processTurn(nextTurnIndex, currentMessages, currentMatches), 1000);
    }
  };

  const processTurn = async (turnIndex: number, currentMessages: any[], currentMatches: Match[]) => {
    if (turnIndex >= TOTAL_TURNS) {
      await processModerator(currentMessages);
      return;
    }

    // Check if we should insert mid-summary (after turn 6, before turn 7)
    if (turnIndex === MID_SUMMARY_AFTER_TURN) {
      // Pass turnIndex + 1 to continue to the NEXT turn after summary
      await processMidSummary(currentMessages, currentMatches, turnIndex + 1);
      return;
    }

    setCurrentTurn(turnIndex);
    setIsStreaming(true);
    isProcessingTurn.current = true;

    const characterIndex = turnIndex % 3;
    const character = CHARACTERS[characterIndex];
    const match = currentMatches.find(m => m.characterId === character.id);

    if (!match) {
      console.error('No match found for character', character.id);
      setIsStreaming(false);
      return;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          characterId: character.id,
          modelId: match.modelId,
          turnIndex: turnIndex,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch chat response');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', characterId: character.id, modelId: match.modelId }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        content += chunk;

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: 'assistant',
            content: content,
            characterId: character.id,
            modelId: match.modelId
          };
          return newMsgs;
        });
      }

      setIsStreaming(false);
      isProcessingTurn.current = false;

      // If content is empty, remove the placeholder message
      if (!content || content.trim() === '') {
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].content === '') {
            return newMsgs.slice(0, -1);
          }
          return newMsgs;
        });
        // Continue to next turn without adding empty message
        setTimeout(() => processTurn(turnIndex + 1, currentMessages, currentMatches), 1000);
        return;
      }

      const updatedMessages = [...currentMessages, {
        role: 'assistant',
        content: content,
        characterId: character.id,
        modelId: match.modelId
      }];

      setTimeout(() => processTurn(turnIndex + 1, updatedMessages, currentMatches), 1000);

    } catch (error) {
      console.error('Error in processTurn:', error);
      setIsStreaming(false);
      isProcessingTurn.current = false;

      setMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].content === '') {
          return newMsgs.slice(0, -1);
        }
        return newMsgs;
      });

      // Try to continue with next turn even if this one failed
      setTimeout(() => processTurn(turnIndex + 1, currentMessages, currentMatches), 1000);
    }
  };

  const processModerator = async (finalMessages: any[]) => {
    setIsStreaming(true);

    const randomModel = MODELS[Math.floor(Math.random() * MODELS.length)];

    try {
      const response = await fetch('/api/moderator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: finalMessages,
          modelId: randomModel.id
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch moderator response');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', isModerator: true, modelId: randomModel.id }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        content += chunk;

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: 'assistant',
            content: content,
            isModerator: true,
            modelId: randomModel.id
          };
          return newMsgs;
        });
      }

      setIsStreaming(false);
      setGameState('result');

    } catch (error) {
      console.error('Error in processModerator:', error);
      setIsStreaming(false);
      setGameState('result');
    }
  };

  const handleReset = () => {
    setGameState('start');
    setTopic('');
    setMatches([]);
    setMessages([]);
    setIsStreaming(false);
    setCurrentTurn(0);
    isProcessingTurn.current = false;
  };

  return (
    <>
      {/* Start Screen */}
      {gameState === 'start' && (
        <div className="start-screen">
          <div className="start-content animate-fade-in">
            <div className="logo-section">
              <h1 className="logo-title">
                LLM-Sudajang
              </h1>
              <p className="logo-subtitle">
                세 명의 AI가 당신이 던진 주제로 열띤 토론을 벌입니다. 
                낙관론자, 비관론자, 그리고 밈 중독자의 대결!
              </p>
              <div className="hero-image-container">
                <img 
                  src="/assets/images/hero_slot.png" 
                  alt="AI Slot Machine" 
                  className="hero-image"
                />
              </div>
              <p className="logo-credit">
                Inspired by Andrej Karpathy's LLM Council
              </p>
            </div>

            <div className="input-section">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="토론 주제를 입력하세요"
                className="input-field"
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
              <button
                onClick={handleStart}
                disabled={!topic.trim()}
                className="btn-primary"
              >
                토론 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Machine Screen */}
      {gameState === 'slot' && (
        <SlotMachine onComplete={handleSlotComplete} />
      )}

      {/* Chat Screen */}
      {(gameState === 'chat' || gameState === 'result') && (
        <ChatInterface 
          messages={messages} 
          isStreaming={isStreaming} 
          isFinished={gameState === 'result'}
          onReset={handleReset}
        />
      )}
    </>
  );
}
