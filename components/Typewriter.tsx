import React, { useState, useEffect } from 'react';

const messages = [
  "D-Chat",
  "Your Data, Your Control.",
  "Decentralized. Private. Yours.",
  "Secure Messaging for Web3.",
  "Chat Without Central Servers.",
  "End-to-End Encrypted. Forever."
];

export const Typewriter: React.FC = () => {
  const [text, setText] = useState('');
  const [msgIndex, setMsgIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentMessage = messages[msgIndex];
    
    const handleTyping = () => {
      if (!isDeleting) {
        // Typing
        setText(currentMessage.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else {
        // Deleting
        setText(currentMessage.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      }
    };

    let timer: any;

    if (!isDeleting && charIndex === currentMessage.length) {
      // Finished typing, wait before deleting
      timer = setTimeout(() => setIsDeleting(true), 2000); // 2s pause
    } else if (isDeleting && charIndex === 0) {
      // Finished deleting, move to next message
      setIsDeleting(false);
      setMsgIndex((prev) => (prev + 1) % messages.length);
    } else {
      // Typing speed
      const speed = isDeleting ? 40 : 80;
      timer = setTimeout(handleTyping, speed);
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, msgIndex]);

  return (
    <h1 className="text-3xl font-bold text-center mb-2 min-h-[40px]">
      {text}
      <span className="animate-pulse text-indigo-500">|</span>
    </h1>
  );
};