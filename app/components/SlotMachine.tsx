'use client';

import { useState, useEffect } from 'react';
import { CHARACTERS, MODELS } from '@/app/lib/constants';

interface SlotMachineProps {
    onComplete: (matches: { characterId: string; modelId: string }[]) => void;
}

export default function SlotMachine({ onComplete }: SlotMachineProps) {
    const [slots, setSlots] = useState(
        CHARACTERS.map((char) => ({
            character: char,
            model: MODELS[0],
            isRolling: true,
        }))
    );

    useEffect(() => {
        // Pre-calculate unique random models for each slot
        const shuffledModels = [...MODELS].sort(() => Math.random() - 0.5);

        // Start rolling effect
        const intervals = slots.map((_, index) => {
            return setInterval(() => {
                setSlots((prev) => {
                    const newSlots = [...prev];
                    if (newSlots[index].isRolling) {
                        const randomModel = MODELS[Math.floor(Math.random() * MODELS.length)];
                        newSlots[index].model = randomModel;
                    }
                    return newSlots;
                });
            }, 100);
        });

        // Stop rolling one by one and assign the unique model
        const timeouts = slots.map((_, index) => {
            return setTimeout(() => {
                setSlots((prev) => {
                    const newSlots = [...prev];
                    newSlots[index].isRolling = false;
                    // Assign the pre-calculated unique model
                    newSlots[index].model = shuffledModels[index % shuffledModels.length];
                    return newSlots;
                });
                clearInterval(intervals[index]);
            }, 2000 + index * 800);
        });

        return () => {
            intervals.forEach(clearInterval);
            timeouts.forEach(clearTimeout);
        };
    }, []);

    // Check for completion
    useEffect(() => {
        if (slots.every((s) => !s.isRolling)) {
            const timer = setTimeout(() => {
                onComplete(slots.map(s => ({ characterId: s.character.id, modelId: s.model.id })));
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [slots, onComplete]);

    return (
        <div className="slot-screen">
            <h2 className="slot-title">
                <span>AI 모델</span> 매칭 중...
            </h2>
            
            <div className="slot-grid">
                {slots.map((slot) => (
                    <div 
                        key={slot.character.id} 
                        className={`slot-card ${slot.isRolling ? 'rolling' : ''}`}
                    >
                        <div className="slot-emoji">{slot.character.emoji}</div>
                        
                        <div className="slot-info">
                            <div className="slot-name">{slot.character.name}</div>
                            <div className="slot-role">{slot.character.role}</div>
                        </div>
                        
                        <div className="slot-divider" />
                        
                        <div className={`slot-model ${slot.isRolling ? 'rolling' : 'ready'}`}>
                            {slot.model.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
