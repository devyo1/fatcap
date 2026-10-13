import { requireUser } from '@/lib/auth';
import { chatMessages, chatWindow, CHAT_MAX } from '@/lib/chat';
import ChatRoom from '@/components/ChatRoom';

export const metadata = { title: 'Chat' };

export default async function Chat() {
  const me = await requireUser();
  const [messages, win] = [await chatMessages(), chatWindow()];
  return (
    <>
      <div className="page-head chat-head">
        <div>
          <h1 className="title">Chat</h1>
          <p className="mono mute stat-line">Everyone, live. Wiped clean every {win.hours === 24 ? 'night' : `${win.hours} hours`}.</p>
        </div>
      </div>
      <ChatRoom me={me.username} isAdmin={me.is_admin} initial={messages} wipeAt={win.wipeAt.toISOString()} max={CHAT_MAX} />
    </>
  );
}
