import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Panel, PanelButton, PanelInput } from '../components/Panel';
import { MessageSquare, Send } from 'lucide-react';

export const Chat: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { userChat, chats, sendMessage } = useStore();
  const [message, setMessage] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [userChat?.messages, selectedChatId]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Admin view - list of all chats
  if (isAdmin) {
    const selectedChat = chats.find(c => c.id === selectedChatId);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat List */}
        <Panel title="Daftar Chat" icon={<MessageSquare />}>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {chats.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Belum ada chat</p>
            ) : (
              chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedChatId === chat.id
                      ? 'bg-red-600/20 border border-red-500/50'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                        {chat.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{chat.username}</p>
                        <p className="text-gray-400 text-sm truncate max-w-[150px]">
                          {chat.messages?.[chat.messages.length - 1]?.content || 'No messages'}
                        </p>
                      </div>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Panel>

        {/* Chat Messages */}
        <div className="lg:col-span-2">
          <Panel title={selectedChat ? `Chat dengan ${selectedChat.username}` : 'Pilih Chat'}>
            {selectedChat ? (
              <div className="flex flex-col h-[600px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-800/30 rounded-lg">
                  {selectedChat.messages?.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex ${msg.senderId === 'admin' || msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.senderId === 'admin' || msg.senderId === user?.uid
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {msg.timestamp?.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <PanelInput
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ketik pesan..."
                    className="flex-1 mb-0"
                  />
                  <PanelButton onClick={handleSend}>
                    <Send className="w-4 h-4" />
                  </PanelButton>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Pilih chat untuk melihat pesan</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    );
  }

  // Customer view
  return (
    <Panel title="Chat dengan Admin" icon={<MessageSquare />}>
      <div className="flex flex-col h-[600px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-gray-800/30 rounded-lg">
          {userChat?.messages?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Belum ada pesan. Kirim pesan pertama Anda!</p>
            </div>
          ) : (
            userChat?.messages?.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg flex items-start gap-3 ${
                    msg.senderId === user?.uid
                      ? 'flex-row-reverse'
                      : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      msg.senderId === user?.uid
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}
                  >
                    {msg.senderId === user?.uid 
                      ? user.username.charAt(0).toUpperCase()
                      : 'A'
                    }
                  </div>
                  <div
                    className={`p-3 rounded-lg ${
                      msg.senderId === user?.uid
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp?.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <PanelInput
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ketik pesan..."
            className="flex-1 mb-0"
          />
          <PanelButton onClick={handleSend}>
            <Send className="w-4 h-4" />
          </PanelButton>
        </div>
      </div>
    </Panel>
  );
};
