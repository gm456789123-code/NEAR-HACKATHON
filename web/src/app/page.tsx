import { ChatView } from "@/components/chat/chat-view";
import { ControlPanel } from "@/components/layout/control-panel";

export default function HomePage() {
  return (
    <div className="flex flex-1 min-h-0">
      <ChatView />
      <ControlPanel />
    </div>
  );
}
