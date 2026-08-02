"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@shaily/ui";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code provided in URL parameters.");
      return;
    }

    async function exchangeToken() {
      try {
        const response = await fetch(`${API_URL}/api/channels/oauth/callback?code=${code}`);
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to finalize authorization.");
        }
        
        setStatus("success");
        setTimeout(() => {
          router.push("/channels");
        }, 2000);
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "OAuth exchange failed.");
      }
    }

    exchangeToken();
  }, [searchParams, router, API_URL]);

  return (
    <Card className="max-w-md w-full bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
      <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="animate-spin text-violet-400" size={40} />
            <h3 className="text-md font-semibold text-zinc-200">Connecting YouTube Channel...</h3>
            <p className="text-zinc-550 text-xs leading-relaxed">
              Exchanging authentication tokens with Google APIs. Please do not close this window.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="text-emerald-500" size={40} />
            <h3 className="text-md font-semibold text-zinc-200">✓ Authentication successful</h3>
            <p className="text-zinc-550 text-xs leading-relaxed">
              Tokens encrypted and stored securely. Redirecting to Channels Dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="text-rose-500" size={40} />
            <h3 className="text-md font-semibold text-zinc-200">Authentication Failed</h3>
            <p className="text-rose-400/80 text-xs leading-relaxed max-w-xs">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push("/channels")}
              className="mt-2 text-xs text-violet-400 hover:underline cursor-pointer"
            >
              Back to Channels Dashboard
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="flex items-center justify-center flex-1 py-12">
      <Suspense fallback={
        <Card className="max-w-md w-full bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
            <Loader2 className="animate-spin text-violet-400" size={40} />
            <h3 className="text-md font-semibold text-zinc-200">Loading Callback Context...</h3>
          </CardContent>
        </Card>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
