import { requireUser } from '@/lib/auth';
import { chatMessages, chatReactions, chatWindow, CHAT_MAX, REACTIONS } from '@/lib/chat';
import ChatRoom from '@/components/ChatRoom';

export const metadata = { title: 'Chat' };

export default async function Chat() {
  const me = await requireUser();
  const [messages, reactions] = await Promise.all([chatMessages(), chatReactions()]);
  return (
    <>
      <div className="page-head chat-head"><h1 className="title">Chat</h1></div>
      <ChatRoom
        me={me.username} isAdmin={me.is_admin} initial={messages} reactions={reactions}
        wipeAt={chatWindow().wipeAt.toISOString()} max={CHAT_MAX} emojis={REACTIONS}
      />
    </>
  );
}
