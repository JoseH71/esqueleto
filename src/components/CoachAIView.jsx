import { useState, useRef, useEffect } from 'react';
import { askCoachAI } from '../utils/aiCoachService';
import './CoachAIView.css';

/**
 * CoachAIView Component
 * Chat interface powered by Gemini 2.0 Flash
 */
export default function CoachAIView() {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "¡Hola, Jose! 👋 Soy tu Coach de Esqueleto, potenciado por Gemini. \n\nPuedes preguntarme lo que quieras sobre tu entrenamiento: \n- '¿Cómo van mis piernas?' \n- '¿He mejorado en Press Banca?' \n- 'Dame un resumen de mi semana'",
            sender: 'ai',
            type: 'neutral'
        }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || isThinking) return;

        const userMsg = { id: Date.now(), text: trimmedInput, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        try {
            const aiResponse = await askCoachAI(trimmedInput);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: aiResponse.text,
                sender: 'ai',
                type: aiResponse.type
            }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: "Error al conectar con Gemini. Inténtalo de nuevo.",
                sender: 'ai',
                type: 'error'
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleQuickQuestion = (q) => {
        setInput(q);
    };

    return (
        <div className="coach-ai-view">
            <header className="ai-header">
                <h1>🤖 Coach IA</h1>
                <p>Potenciado por Gemini 3.0 Flash</p>
            </header>

            <div className="chat-container">
                <div className="messages-list">
                    {messages.map(msg => (
                        <div key={msg.id} className={`message-bubble ${msg.sender} ${msg.type || ''}`}>
                            <div className="message-content">
                                {msg.sender === 'ai' && <span className="ai-avatar">🤖</span>}
                                <div className="message-text">
                                    {msg.text.split('\n').map((line, i) => (
                                        <p key={i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="message-bubble ai">
                            <div className="message-content">
                                <span className="ai-avatar pulse">🤖</span>
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="quick-questions">
                    <button onClick={() => handleQuickQuestion("¿Cómo van mis piernas?")}>🦵 Piernas</button>
                    <button onClick={() => handleQuickQuestion("¿Cómo va mi Press Banca?")}>📈 Press Banca</button>
                    <button onClick={() => handleQuickQuestion("Dame un resumen de mi semana")}>📊 Resumen</button>
                    <button onClick={() => handleQuickQuestion("¿Qué debería mejorar?")}>🎯 Mejorar</button>
                </div>

                <form className="chat-input-area" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Pregunta a tu Coach..."
                        disabled={isThinking}
                    />
                    <button type="submit" className="btn-send" disabled={!input.trim() || isThinking}>
                        {isThinking ? '...' : '➤'}
                    </button>
                </form>
            </div>
        </div>
    );
}
