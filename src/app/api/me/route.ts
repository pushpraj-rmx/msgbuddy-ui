import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      return NextResponse.json(
        { message: `Backend returned non-JSON response: ${text.substring(0, 100)}` },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    // Handle network errors or JSON parse errors
    if (error.message?.includes("JSON")) {
      return NextResponse.json(
        { message: "Backend returned invalid response. Is the API URL correct?" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { message: error.message || "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
