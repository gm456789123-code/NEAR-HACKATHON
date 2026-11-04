import { ChatView } from "@/components/chat/chat-view";
import { ControlPanel } from "@/components/layout/control-panel";

export default function HomePage() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 h-full overflow-hidden">
      <ChatView />
      <ControlPanel />
    </div>
  );
}
