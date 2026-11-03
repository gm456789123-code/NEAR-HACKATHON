import { NextResponse } from "next/server";
import { policyEngine } from "@/lib/near";

export async function GET() {
  try {
    const requests = await policyEngine.listPendingRequests();
    return NextResponse.json(requests);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load approvals" },
      { status: 500 }
    );
  }
}
