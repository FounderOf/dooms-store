import React from 'react';

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '', icon }) => {
  return (
    <div className={`relative bg-gray-900/90 backdrop-blur-sm border border-red-500/30 rounded-lg overflow-hidden ${className}`}>
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none"></div>
      
      {/* Header */}
      <div className="relative px-6 py-4 border-b border-red-500/20 bg-gradient-to-r from-red-900/20 to-transparent">
        <div className="flex items-center gap-3">
          {icon && <span className="text-red-400">{icon}</span>}
          <h2 className="text-xl font-bold text-red-400 tracking-wide">{title}</h2>
        </div>
        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500"></div>
      </div>

      {/* Content */}
      <div className="relative p-6">
        {children}
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-red-500/50"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-red-500/50"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-red-500/50"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-red-500/50"></div>
    </div>
  );
};

export const PanelButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <button
      className={`px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/30 border border-red-400/30 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const PanelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ 
  label, 
  className = '', 
  ...props 
}) => {
  return (
    <div className="mb-4">
      {label && <label className="block text-red-300 text-sm font-semibold mb-2">{label}</label>}
      <input
        className={`w-full px-4 py-3 bg-gray-800/50 border border-red-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all ${className}`}
        {...props}
      />
    </div>
  );
};

export const PanelTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ 
  label, 
  className = '', 
  ...props 
}) => {
  return (
    <div className="mb-4">
      {label && <label className="block text-red-300 text-sm font-semibold mb-2">{label}</label>}
      <textarea
        className={`w-full px-4 py-3 bg-gray-800/50 border border-red-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all ${className}`}
        {...props}
      />
    </div>
  );
};

export const Badge: React.FC<{ badge: { name: string; icon: string; color: string } }> = ({ badge }) => {
  return (
    <span 
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
      style={{ 
        backgroundColor: badge.color + '20',
        color: badge.color,
        border: `1px solid ${badge.color}40`
      }}
    >
      <span>{badge.icon}</span>
      <span>{badge.name}</span>
    </span>
  );
};
