import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { chatMessages, chatReactions, chatWindow, CHAT_MAX, REACTIONS } from '@/lib/chat';
import ChatRoom from '@/components/ChatRoom';

export const metadata = { title: 'Chat' };

export default async function Chat() {
  const me = await requireUser();
  const [messages, reactions, blocked] = await Promise.all([
    chatMessages(), chatReactions(),
    q<{ username: string }>('SELECT m.username FROM blocks b JOIN members m ON m.id = b.blocked_id WHERE b.blocker_id = $1', [me.id]),
  ]);
  return (
    <>
      <div className="page-head chat-head"><h1 className="title">Chat</h1></div>
      <ChatRoom
        me={me.username} isAdmin={me.is_admin} initial={messages} reactions={reactions}
        wipeAt={chatWindow().wipeAt.toISOString()} max={CHAT_MAX} emojis={REACTIONS} hide={blocked.map((b) => b.username)}
      />
    </>
  );
}
