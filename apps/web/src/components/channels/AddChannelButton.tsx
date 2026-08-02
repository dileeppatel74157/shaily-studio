"use client";

import React from "react";
import { Button } from "@shaily/ui";
import { Plus, Youtube } from "lucide-react";

export default function AddChannelButton() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleConnect = () => {
    window.location.href = `${API_URL}/api/channels/connect/youtube`;
  };

  return (
    <Button
      onClick={handleConnect}
      className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-2 h-9 px-4 rounded-lg cursor-pointer"
    >
      <Plus size={14} />
      <Youtube size={14} />
      <span>Add Channel</span>
    </Button>
  );
}
