import { NextRequest } from "next/server";
import { getLeaderboard, getCompetition, getAllSubmissions, addViolation, getViolations } from "@/lib/database";

export const dynamic = "force-dynamic";

// SSE for real-time updates
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastData = "";

      const sendUpdate = () => {
        try {
          const leaderboard = getLeaderboard();
          const competition = getCompetition();
          const submissions = getAllSubmissions().slice(0, 10); // Last 10 submissions
          const violations = getViolations().slice(0, 20); // Last 20 violations

          const data = JSON.stringify({
            leaderboard,
            competition,
            recentSubmissions: submissions,
            recentViolations: violations,
            timestamp: Date.now(),
          });

          // Only send if data changed
          if (data !== lastData) {
            lastData = data;
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch (error) {
          console.error("SSE error:", error);
        }
      };

      // Send initial data
      sendUpdate();

      // Poll for changes every 1 second
      const interval = setInterval(sendUpdate, 1000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Report violations from team page
export async function POST(request: NextRequest) {
  try {
    const { type, team, count, details } = await request.json();
    
    if (team && type) {
      addViolation(team, type, details || `Count: ${count || 1}`);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
