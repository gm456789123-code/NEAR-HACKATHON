import { NextRequest, NextResponse } from "next/server";
import { runTask } from "@/lib/orchestrator";

interface TaskBody {
  task?: unknown;
}

export async function POST(req: NextRequest) {
  const body: TaskBody = await req.json().catch((): TaskBody => ({}));
  if (typeof body.task !== "string" || body.task.trim() === "") {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  try {
    const result = await runTask(body.task);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run task" },
      { status: 500 }
    );
  }
}
